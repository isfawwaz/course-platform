// RLS isolation matrix — the executable proof of architecture invariant #1:
// "even a buggy handler must not leak cross-org data." Every probe runs AS an
// `authenticated`/`anon` end user against the REAL policies in supabase/migrations/.
//
// Requires the local Supabase stack: `bun run db:test:up` (see package.json / README).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Client } from "pg";
import {
  asUser,
  connect,
  ensureSupabaseGrants,
  visibleCount,
  type QueryFn,
} from "./helpers/db";
import {
  seedTwoOrgs,
  teardownTwoOrgs,
  type OrgFixture,
  type TwoOrgs,
} from "./fixtures/two-orgs";

let client: Client;
let f: TwoOrgs;

beforeAll(async () => {
  client = await connect();
  await ensureSupabaseGrants(client);
  f = await seedTwoOrgs(client);
});

afterAll(async () => {
  if (client) {
    if (f) await teardownTwoOrgs(client, f);
    await client.end();
  }
});

/** A write probe that RLS should reject outright (WITH CHECK violation → throws). */
async function expectBlockedWrite(p: Promise<unknown>): Promise<void> {
  await expect(p).rejects.toThrow();
}

// Org-scoped tables keyed by org_id. The intruder must see ZERO of the target org's rows.
const ORG_SCOPED_TABLES = [
  "memberships",
  "videos",
  "courses",
  "modules",
  "lessons",
  "enrolments",
  "course_completions",
  "certificates",
  "assessments",
  "assessment_questions",
  "assessment_options",
] as const;

const DIRECTIONS = [
  {
    name: "org B users cannot reach org A",
    intruderOwner: () => f.b.ownerId,
    intruderStudent: () => f.b.studentId,
    target: (): OrgFixture => f.a,
  },
  {
    name: "org A users cannot reach org B",
    intruderOwner: () => f.a.ownerId,
    intruderStudent: () => f.a.studentId,
    target: (): OrgFixture => f.b,
  },
] as const;

describe("cross-org read isolation", () => {
  for (const d of DIRECTIONS) {
    describe(d.name, () => {
      test("the org row itself is invisible", async () => {
        const t = d.target();
        for (const uid of [d.intruderOwner(), d.intruderStudent()]) {
          await asUser(client, uid, async (q) => {
            expect(await visibleCount(q, "public.orgs", "id", t.orgId)).toBe(0);
          });
        }
      });

      for (const table of ORG_SCOPED_TABLES) {
        test(`${table}: no rows leak`, async () => {
          const t = d.target();
          for (const uid of [d.intruderOwner(), d.intruderStudent()]) {
            await asUser(client, uid, async (q) => {
              expect(
                await visibleCount(q, `public.${table}`, "org_id", t.orgId),
              ).toBe(0);
            });
          }
        });
      }

      test("public certificate code is not resolvable to a table row", async () => {
        const t = d.target();
        await asUser(client, d.intruderOwner(), async (q) => {
          expect(
            await visibleCount(q, "public.certificates", "code", t.certificateCode),
          ).toBe(0);
        });
      });
    });
  }
});

describe("cross-org write isolation", () => {
  // Acting as org B's OWNER (staff in their own org) — the strongest realistic intruder.
  test("cannot UPDATE another org's course (USING filters the row out)", async () => {
    await asUser(client, f.b.ownerId, async (q) => {
      const { rowCount } = await q(
        "update public.courses set title = 'hijacked' where id = $1",
        [f.a.courseId],
      );
      expect(rowCount).toBe(0);
    });
  });

  test("cannot DELETE another org's certificate", async () => {
    await asUser(client, f.b.ownerId, async (q) => {
      const { rowCount } = await q(
        "delete from public.certificates where id = $1",
        [f.a.certificateId],
      );
      expect(rowCount).toBe(0);
    });
  });

  test("cannot INSERT a course into another org (WITH CHECK blocks it)", async () => {
    await asUser(client, f.b.ownerId, async (q) => {
      await expectBlockedWrite(
        q(
          `insert into public.courses (org_id, title, slug, status, created_by)
           values ($1, 'x', 'x', 'draft', $2)`,
          [f.a.orgId, f.b.ownerId],
        ),
      );
    });
  });

  // Invariant #2 at the DB layer: a staff user cannot smuggle a row into a foreign
  // org by supplying that org's id — WITH CHECK re-evaluates membership on the row.
  test("cannot spoof org_id to plant a certificate in another org", async () => {
    await asUser(client, f.b.ownerId, async (q) => {
      await expectBlockedWrite(
        q(
          `insert into public.certificates
             (org_id, course_id, user_id, completion_id, code,
              student_name_snapshot, course_title_snapshot, org_name_snapshot)
           values ($1, $2, $3, $4, 'CP-SPOOF-0001', 'x', 'x', 'x')`,
          [f.a.orgId, f.a.courseId, f.b.ownerId, f.a.completionId],
        ),
      );
    });
  });

  test("a student cannot self-grant an enrolment", async () => {
    await asUser(client, f.a.studentId, async (q) => {
      await expectBlockedWrite(
        q(
          `insert into public.enrolments (org_id, course_id, user_id, granted_by, status)
           values ($1, $2, $3, $3, 'active')`,
          [f.a.orgId, f.a.courseId, f.a.studentId],
        ),
      );
    });
  });
});

describe("answer key never reaches students (invariant #4)", () => {
  test("an enrolled student can read questions but NOT options", async () => {
    await asUser(client, f.a.studentId, async (q) => {
      // Enrolled → can see the assessment and its questions...
      expect(
        await visibleCount(q, "public.assessments", "id", f.a.assessmentId),
      ).toBe(1);
      expect(
        await visibleCount(q, "public.assessment_questions", "id", f.a.questionId),
      ).toBe(1);
      // ...but the options table (which carries is_correct) is staff-only.
      expect(
        await visibleCount(q, "public.assessment_options", "id", f.a.optionId),
      ).toBe(0);
    });
  });

  test("staff CAN read options (proves the deny is scoped, not blanket)", async () => {
    await asUser(client, f.a.ownerId, async (q) => {
      expect(
        await visibleCount(q, "public.assessment_options", "id", f.a.optionId),
      ).toBe(1);
    });
  });
});

describe("legitimate same-org access still works (not deny-all)", () => {
  test("enrolled student reads their course, enrolment, and certificate", async () => {
    await asUser(client, f.a.studentId, async (q) => {
      expect(await visibleCount(q, "public.courses", "id", f.a.courseId)).toBe(1);
      expect(await visibleCount(q, "public.enrolments", "id", f.a.enrolmentId)).toBe(1);
      expect(
        await visibleCount(q, "public.certificates", "id", f.a.certificateId),
      ).toBe(1);
    });
  });

  test("org owner manages their own course (read + update)", async () => {
    await asUser(client, f.a.ownerId, async (q) => {
      expect(await visibleCount(q, "public.courses", "id", f.a.courseId)).toBe(1);
      const { rowCount } = await q(
        "update public.courses set title = 'renamed' where id = $1",
        [f.a.courseId],
      );
      expect(rowCount).toBe(1);
    });
  });

  test("staff can read a student's certificate in their own org", async () => {
    await asUser(client, f.a.ownerId, async (q) => {
      expect(
        await visibleCount(q, "public.certificates", "id", f.a.certificateId),
      ).toBe(1);
    });
  });
});

describe("anonymous access", () => {
  test("anon sees no org and no certificate rows", async () => {
    await asUser(client, null, async (q) => {
      expect(await visibleCount(q, "public.orgs", "id", f.a.orgId)).toBe(0);
      expect(
        await visibleCount(q, "public.certificates", "id", f.a.certificateId),
      ).toBe(0);
    });
  });

  test("but the public verify RPC resolves a real code (the one deliberate bypass)", async () => {
    await asUser(client, null, async (q: QueryFn) => {
      const { rows } = await q<{ valid: boolean; org_name: string }>(
        "select valid, org_name from public.verify_certificate($1)",
        [f.a.certificateCode],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].valid).toBe(true);
      expect(rows[0].org_name).toBe("Test Org A");
    });
  });

  test("the verify RPC returns nothing for an unknown code", async () => {
    await asUser(client, null, async (q) => {
      const { rows } = await q(
        "select valid from public.verify_certificate($1)",
        ["CP-DOES-NOTEXIST"],
      );
      expect(rows).toHaveLength(0);
    });
  });
});
