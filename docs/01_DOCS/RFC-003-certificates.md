# RFC-003 — Certificates

> **Status:** Accepted — DF–DK locked 2026-06-16 (DH patches applied to PRD §8 + RFC-002 §6.4)
> **Author:** Fawwaz
> **Date:** 2026-06-16
> **Related:** PRD §3, §8, §9 (`01_DOCS/PRD.md`); RFC-001 (queue, storage), RFC-002 (verify RPC, RLS)
> **Decision owner:** Eng (Fawwaz)

---

## 1. Summary

How a confirmed completion becomes a tamper-evident, publicly verifiable certificate. Covers the issue trigger, the certificate code, what's rendered, the async PDF pipeline, storage, public verification (QR), revocation, and idempotency.

**Principle:** the **verification page is the source of truth**, not the PDF. The PDF is a convenient artefact; trust comes from a unique code resolving against our database. A forged PDF fails verification.

---

## 2. Goals / Non-goals

**Goals**
- Issue a certificate automatically when an admin confirms completion (PRD flow).
- Each certificate has a unique, hard-to-guess, human-readable code.
- Anyone can verify a code publicly without seeing other tenant data.
- The certificate reflects what was true at issue time (name, course, date) even if records change later.
- Studio branding (name, logo) on the certificate.
- Revocable, with the verification page reflecting revoked status.

**Non-goals (this RFC)**
- Blockchain / cryptographic notarisation.
- Expiring/renewable certificates (default: no expiry).
- Multiple certificate templates per org (one branded template for MVP).
- Digital signatures embedded in the PDF (PKI) — Phase 2 if needed.

---

## 3. Trigger & Lifecycle

```
course_completion: in_progress → pending_review → confirmed ──▶ issue certificate
                                          └────────→ rejected  (no certificate)
certificate:  (none) → issued → [revoked]
```

- On `POST /api/completions/:id/confirm` (staff, RFC-002 RLS), if the completion moves to `confirmed` **and** the course has `certificateEnabled`, enqueue a `certificate.issue` job.
- If `certificateEnabled` is false, completion is confirmed with no certificate (PRD AC US7).
- Revocation is a separate staff action; it never deletes the row.

---

## 4. Certificate Code

- **Format:** `CP-XXXX-XXXX` where `X` is Crockford Base32 (no I/L/O/U — avoids ambiguity and accidental words). 8 random chars ≈ 40 bits of entropy — not guessable, not enumerable.
- Generated server-side; `UNIQUE` constraint on `code`; on the rare collision, regenerate and retry.
- Not sequential (no leaking how many certs exist).
- The code is printed on the PDF and encoded in the QR. (Decision DF.)

> Optional per-org human serial (e.g. "Nail Art Academy #0042") is display-only and **not** the verification key — kept separate so it can't be guessed into a valid code. Deferred unless wanted.

---

## 5. Snapshot Fields (PRD data-model refinement)

A certificate must show what was true when issued. If we join live `courses`/`profiles` at verification time, renaming a course or a user changing their name would silently rewrite an issued certificate.

**Proposal (Decision DH):** store display fields on the certificate at issue time:

```typescript
interface Certificate {
  // ...existing PRD fields...
  studentNameSnapshot: string;   // student's name at issue
  courseTitleSnapshot: string;   // course title at issue
  orgNameSnapshot: string;       // studio name at issue
  issuedAt: string;
  // revocation
  revoked: boolean;
  revokedAt?: string;
  revokedReason?: string;        // optional (Decision DJ)
}
```

The `verify_certificate` RPC (RFC-002 §6.4) then returns the snapshots, not live joins. **This patches PRD §8** — I'll apply it there once DH is locked.

---

## 6. Generation Pipeline

Async, reusing the RFC-001 queue (pg-boss). Issuance must never block the confirm request.

1. **Confirm** creates the `Certificate` row (`revoked = false`, `pdfKey` null, snapshots filled, code generated) and enqueues `certificate.issue`.
2. **Worker** renders the PDF, uploads it, sets `pdfKey`, then triggers the student notification.
3. **Render:** `@react-pdf/renderer` (PRD §11) with a single branded template component. Inputs: snapshots, issue date, code, verification URL, QR image, org logo. Embed a font that covers Latin + Indonesian diacritics (e.g. Inter/Noto). QR generated with `qrcode` and embedded as an image; it encodes `https://<app>/verify/<code>`.
4. **Storage:** private **Supabase Storage** bucket `certificates` (small PDFs, light-asset tier per PRD). Key: `org/{orgId}/certificates/{certificateId}.pdf`. (Decision DG.)
5. Download via `GET /api/certificates/:id/download` → signed URL (owner of cert or staff; RFC-002).

**Idempotency (Decision DK):** the job is keyed by `certificateId`. Re-running re-renders and overwrites the same object — safe. Confirming an already-confirmed completion does **not** mint a second certificate (guard: one certificate per `completionId`). If rendering failed (`pdfKey` still null), staff/the reconciler can re-enqueue; the **code stays the same** (re-issue regenerates the PDF, never the identity).

---

## 7. Public Verification

- `/verify/[code]` (public page) calls the `verify_certificate(code)` RPC (RFC-002): returns `valid`, `courseTitle`, `studentName`, `issuedAt`, `revoked` — from snapshots.
- Shows: valid ✓ / not found ✗ / **revoked** state, plus studio name, course, student, issue date.
- The QR on the PDF links straight here. Anyone scanning lands on a trustworthy, tenant-safe page.
- **Name display (Decision DI):** show the full name (the certificate is the holder's proof). Partial-masking is available as a per-org option later if a studio wants it.
- Rate-limit the endpoint to deter code fishing (40-bit space already makes enumeration impractical).

---

## 8. Revocation

- Staff action → set `revoked = true`, `revokedAt`, optional `revokedReason` (Decision DJ).
- The PDF isn't recalled (can't be), but verification immediately shows **revoked** — which is the point of verification-as-truth.
- Revoked certificates remain readable by the student and staff (history), clearly marked.

---

## 9. Notifications

- On successful PDF render, email the student: "Your certificate for {course} is ready" with a link to **My certificates** (download) and the verification URL.
- Email via the provider chosen in the PRD open questions (Resend/Postmark → still open).
- Failure to email never blocks issuance; the cert is already in the student's dashboard.

---

## 10. Anti-forgery & Trust

- Trust = code resolving in our DB, not PDF contents. The PDF prominently prints the code and "Verify at <url>".
- Codes are unguessable (§4) and rate-limited (§7).
- Tamper-evidence: editing the PDF doesn't change what verification returns; a fake code won't resolve.
- Phase 2 option: embed a signed token in PDF metadata / a PKI signature for offline trust — not needed while online verification exists.

---

## 11. Localisation

- Certificate text and the verification page in Bahasa Indonesia + English (PRD locale). Org `locale` picks the default; date formatted per locale (e.g. "16 Juni 2026").
- Snapshots store names/titles as entered (no translation).

---

## 12. Decisions (Locked 2026-06-16)

> All recommended options accepted. DH patches applied to PRD §8 and RFC-002 §6.4.

| # | Decision | Chosen | Alternatives (rejected) |
|---|----------|-------------|--------------|
| DF | Code format | **`CP-XXXX-XXXX` Crockford Base32, random** | UUID; sequential serial |
| DG | Cert PDF storage | **Supabase Storage private bucket** | R2 alongside video |
| DH | Snapshot display fields on cert | **Yes — store name/course/org at issue** (patches PRD §8) | Live joins at verify time |
| DI | Name on verification page | **Full name** | Partial mask; per-org option |
| DJ | Revocation reason | **Optional `revokedReason` field** | No reason captured |
| DK | Regeneration | **Idempotent re-render; one cert per completion; code never changes** | New code on re-issue |

---

## 13. Open Questions

- Certificate **template/branding design** — needs the design-system pass (fields, layout, logo placement, signature line?).
- Do any courses need an **expiry/validity period** (e.g. annual recert)? Default: no expiry.
- Email provider (shared open question with PRD/RFC-001).
- Should the studio owner's **signature image** appear on the certificate? (Design input.)
