// Pure unit test for the certificate-ready email template — no DB, no network.
import { describe, expect, test } from "bun:test";
import { certificateReadyEmail } from "../src/lib/email/templates/certificate-ready";

const BASE = {
  to: "student@example.com",
  studentName: "Siti",
  courseTitle: "Nail Art Basics",
  orgName: "Nail Art Academy",
  verifyUrl: "https://app.example.com/verify/CP-AAAA-BBBB",
} as const;

describe("certificateReadyEmail", () => {
  test("Indonesian copy carries course title + verify link in both parts", () => {
    const m = certificateReadyEmail({ ...BASE, locale: "id" });
    expect(m.to).toBe(BASE.to);
    expect(m.subject).toContain("Nail Art Basics");
    expect(m.subject.toLowerCase()).toContain("sertifikat");
    expect(m.html).toContain(BASE.verifyUrl);
    expect(m.text).toContain(BASE.verifyUrl);
  });

  test("English copy is distinct from Indonesian", () => {
    const en = certificateReadyEmail({ ...BASE, locale: "en" });
    const id = certificateReadyEmail({ ...BASE, locale: "id" });
    expect(en.subject).toContain("ready");
    expect(en.subject).not.toBe(id.subject);
  });

  test("escapes HTML in user-derived values (no injection into the email body)", () => {
    const m = certificateReadyEmail({
      ...BASE,
      studentName: "<script>alert(1)</script>",
      locale: "en",
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    // The plain-text part keeps the raw value (not HTML, so no escaping needed).
    expect(m.text).toContain("<script>alert(1)</script>");
  });
});
