// Builds two independent orgs (A and B), each a self-contained tenant: an owner +
// a student, a published course (module → lesson → video), an active enrolment, a
// confirmed completion, an issued certificate, and an assessment with an answer key.
//
// Inserted as the superuser `postgres` (RLS bypassed) so the fixture spans both orgs.
// The isolation matrix then proves that, AS an end user, one org's rows are invisible
// to the other. A random suffix keeps slugs/codes unique across re-runs on a
// persistent local DB; `teardownTwoOrgs` removes everything afterward.
import { randomUUID } from "node:crypto";
import type { Client } from "pg";

export interface OrgFixture {
  orgId: string;
  ownerId: string;
  studentId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  videoId: string;
  enrolmentId: string;
  completionId: string;
  certificateId: string;
  certificateCode: string;
  assessmentId: string;
  questionId: string;
  optionId: string;
}

export interface TwoOrgs {
  suffix: string;
  a: OrgFixture;
  b: OrgFixture;
  userIds: string[];
  orgIds: string[];
}

async function createUser(
  client: Client,
  email: string,
  fullName: string,
): Promise<string> {
  const id = randomUUID();
  // Minimal auth.users row; the on_auth_user_created trigger creates the profile
  // (reading email + raw_user_meta_data.full_name).
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data,
        email_confirmed_at, created_at, updated_at)
     values
       ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        $2, $3, '{}'::jsonb, now(), now(), now())`,
    [id, email, JSON.stringify({ full_name: fullName })],
  );
  return id;
}

async function seedOrg(
  client: Client,
  suffix: string,
  tag: "a" | "b",
): Promise<OrgFixture> {
  const label = tag.toUpperCase();
  const ownerId = await createUser(
    client,
    `owner-${tag}-${suffix}@example.com`,
    `Owner ${label}`,
  );
  const studentId = await createUser(
    client,
    `student-${tag}-${suffix}@example.com`,
    `Student ${label}`,
  );

  const orgId = randomUUID();
  await client.query(
    `insert into public.orgs (id, name, slug, locale)
     values ($1, $2, $3, 'en')`,
    [orgId, `Test Org ${label}`, `test-org-${tag}-${suffix}`],
  );

  await client.query(
    `insert into public.memberships (org_id, user_id, role, status) values
       ($1, $2, 'owner', 'active'),
       ($1, $3, 'student', 'active')`,
    [orgId, ownerId, studentId],
  );

  const videoId = randomUUID();
  await client.query(
    `insert into public.videos
       (id, org_id, title, original_filename, status, storage_bucket, source_key, uploaded_by)
     values ($1, $2, 'Vid', 'v.mp4', 'ready', 'thumbnails', $3, $4)`,
    [videoId, orgId, `org/${orgId}/videos/${videoId}/source.mp4`, ownerId],
  );

  const courseId = randomUUID();
  await client.query(
    `insert into public.courses (id, org_id, title, slug, status, created_by)
     values ($1, $2, 'Course', 'course', 'published', $3)`,
    [courseId, orgId, ownerId],
  );

  const moduleId = randomUUID();
  await client.query(
    `insert into public.modules (id, org_id, course_id, title, position)
     values ($1, $2, $3, 'Module', 0)`,
    [moduleId, orgId, courseId],
  );

  const lessonId = randomUUID();
  await client.query(
    `insert into public.lessons
       (id, org_id, course_id, module_id, title, video_id, position, required)
     values ($1, $2, $3, $4, 'Lesson', $5, 0, true)`,
    [lessonId, orgId, courseId, moduleId, videoId],
  );

  // Inserting the enrolment fires trg_create_completion → a course_completion row.
  const enrolmentId = randomUUID();
  await client.query(
    `insert into public.enrolments (id, org_id, course_id, user_id, granted_by, status)
     values ($1, $2, $3, $4, $5, 'active')`,
    [enrolmentId, orgId, courseId, studentId, ownerId],
  );
  const { rows: comp } = await client.query<{ id: string }>(
    `select id from public.course_completions where enrolment_id = $1`,
    [enrolmentId],
  );
  const completionId = comp[0].id;
  await client.query(
    `update public.course_completions
       set status = 'confirmed', confirmed_by = $2, confirmed_at = now(),
           lessons_completed_at = now()
     where id = $1`,
    [completionId, ownerId],
  );

  const certificateId = randomUUID();
  const certificateCode = `CP-${tag.toUpperCase()}${suffix.slice(0, 3).toUpperCase()}-TEST`;
  await client.query(
    `insert into public.certificates
       (id, org_id, course_id, user_id, completion_id, code,
        student_name_snapshot, course_title_snapshot, org_name_snapshot)
     values ($1, $2, $3, $4, $5, $6, $7, 'Course', $8)`,
    [
      certificateId,
      orgId,
      courseId,
      studentId,
      completionId,
      certificateCode,
      `Student ${label}`,
      `Test Org ${label}`,
    ],
  );

  const assessmentId = randomUUID();
  await client.query(
    `insert into public.assessments (id, org_id, course_id, title, pass_score)
     values ($1, $2, $3, 'Quiz', 70)`,
    [assessmentId, orgId, courseId],
  );
  const questionId = randomUUID();
  await client.query(
    `insert into public.assessment_questions (id, org_id, assessment_id, prompt, type, position)
     values ($1, $2, $3, 'Q1', 'single', 0)`,
    [questionId, orgId, assessmentId],
  );
  const optionId = randomUUID();
  await client.query(
    `insert into public.assessment_options (id, org_id, question_id, label, is_correct, position)
     values ($1, $2, $3, 'Right answer', true, 0)`,
    [optionId, orgId, questionId],
  );

  return {
    orgId,
    ownerId,
    studentId,
    courseId,
    moduleId,
    lessonId,
    videoId,
    enrolmentId,
    completionId,
    certificateId,
    certificateCode,
    assessmentId,
    questionId,
    optionId,
  };
}

export async function seedTwoOrgs(client: Client): Promise<TwoOrgs> {
  const suffix = randomUUID().slice(0, 8);
  const a = await seedOrg(client, suffix, "a");
  const b = await seedOrg(client, suffix, "b");
  return {
    suffix,
    a,
    b,
    userIds: [a.ownerId, a.studentId, b.ownerId, b.studentId],
    orgIds: [a.orgId, b.orgId],
  };
}

export async function teardownTwoOrgs(client: Client, f: TwoOrgs): Promise<void> {
  // orgs cascade to all org-scoped rows; deleting auth.users cascades to profiles
  // (and anything keyed on the user). Both run as superuser.
  await client.query("delete from public.orgs where id = any($1::uuid[])", [f.orgIds]);
  await client.query("delete from auth.users where id = any($1::uuid[])", [f.userIds]);
}
