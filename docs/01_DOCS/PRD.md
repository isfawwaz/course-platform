# Course Platform — Product Requirements Document

> **Status:** Draft v1 — complete, ready for review
> **Owner:** Fawwaz
> **Audience:** Build reference (technical)
> **First client / use case:** Nail art studio
> **Last updated:** 2026-06-16

---

## Locked Decisions

> Cross-cutting choices confirmed up front. These constrain every section below.

| Decision | Choice | Notes |
|----------|--------|-------|
| Stack | **Next.js (App Router) + Refine.js + Supabase** | Refine powers the admin + platform consoles (CRUD-heavy) via its Supabase data provider; the student learning area stays custom Next.js (video-led). Supabase Postgres, Auth, RLS. Supabase Storage only for light assets (thumbnails, certs). |
| Video hosting | **Self-hosted object storage — Cloudflare R2** (locked 2026-06-16; MinIO = self-host fallback) | We own transcoding (HLS) + signed-URL playback + progress tracking. R2 picked for zero egress fees. See RFC-001. |
| Access model | **Admin grants access** | Org owner/admin enrols registered users per course. No paid self-serve in MVP. |
| Tenancy | **Multi-tenant from day one** | Each studio = an org. Per-org isolation via `org_id` + RLS. |
| Platform billing (studios) | **Phase 2** | Onboard the nail studio manually first. Revisit subscription billing later. |

---

## 1. Overview

**Feature / Project Name:** Course Platform

**Problem Statement:**
Studios that want to teach skills by video have no controlled way to deliver gated training. Generic tools (YouTube, Google Drive, WhatsApp) leak content, can't restrict access to specific students, don't track who finished, and issue no proof of completion. The first client — a nail art studio — needs a branded space where the owner curates video courses, grants named students access, and hands out a verifiable certificate when they're done.

**Proposed Solution:**
A multi-tenant web LMS. Each studio is an org; its owner uploads videos, assembles them into structured courses, and grants registered students access. Students watch via secure streaming, progress is tracked per lesson, and finishing a course auto-issues a verifiable certificate.

**AI Build Summary:**
> Build a multi-tenant Next.js (App Router) web app using Refine.js for the admin + platform consoles (Supabase data provider) and custom Next.js for the student learning area, on Supabase (Postgres, Auth, RLS). Studios (orgs) own courses; each course has modules and video lessons. Video files live in self-hosted object storage (Cloudflare R2 or MinIO), transcoded to HLS and served via short-lived signed URLs — never permanent public links. Org owners/admins upload videos, build courses, and grant per-user course access. Students watch lessons, per-lesson progress is tracked, and completing all required lessons auto-issues a verifiable PDF certificate with a unique ID and public verification page. Enforce per-org isolation with `org_id` + Supabase RLS. No paid self-serve enrolment and no studio billing in MVP.

---

## 2. Goals & Success Metrics

**Primary Goal:**
Let a studio deliver gated video courses and issue verifiable completion certificates, end to end, without leaking content.

**Success Metrics:**
- A studio owner can go from raw video files to a published, access-granted course in under 30 minutes, without engineering help.
- Zero unauthorised video access — playback URLs are short-lived and signed; there are no permanent shareable links.
- Once an admin confirms a student's completion, the certificate generates and delivers automatically — no manual cert step (target ≥ 99% success).
- Lesson video starts playing in under 3 seconds on a typical connection (adaptive HLS).

**Anti-goals:**
- Not building a public course marketplace or discovery in MVP.
- Not handling student payments or studio subscription billing in MVP.
- Not a live-streaming or webinar tool — pre-recorded video only.
- Not an authoring suite — no in-app video editing.

---

## 3. Scope & Constraints

**In scope (MVP):**
- Multi-tenant orgs with strict per-org isolation.
- Roles: platform super-admin, org owner/admin, student. (Instructor folded into org admin for MVP — see Open Questions.)
- Video pipeline: upload → async transcode to HLS → store in R2/MinIO → signed-URL playback.
- Course structure: course → modules (sections) → lessons (video + optional text/resource attachments).
- Admin grants and revokes per-user course access; student sees only granted courses.
- Student dashboard, video player with resume, per-lesson progress tracking.
- Course assessment (quiz): students take it; results recorded and visible to the admin to inform sign-off (does not hard-gate completion in MVP).
- Completion flow: all required lessons watched → admin confirms → verifiable PDF certificate auto-issued (unique ID + public verification page).

**Out of scope (MVP):**
- Paid self-serve enrolment; studio subscription billing.
- Public catalogue / marketplace, ratings, reviews.
- Live sessions, comments, discussion forums.
- Native mobile apps (responsive web only).
- Advanced analytics dashboards (basic completion stats only).

**Technical constraints:**
- **Platform:** responsive web (desktop + mobile browser). No native app in MVP.
- **Auth:** Supabase Auth (email/password + magic link). RLS enforces org isolation and access grants.
- **Video:** self-hosted object storage (R2 or MinIO); adaptive HLS; signed URLs with short TTL; no permanent public URLs.
- **Transcoding:** async ffmpeg worker — heavy compute, kept out of the serverless request path.
- **Accessibility:** target WCAG 2.1 AA — keyboard navigation, caption/subtitle support, contrast.
- **Performance:** adaptive HLS for fast start; certificate generation runs async.
- **Locale:** Bahasa Indonesia primary, English fallback; i18n-ready from the start.
- **Data residency:** pick the Supabase region deliberately if studio data must stay in-region.

---

## 4. Jobs to Be Done (JTBD)

| ID | Priority | Job Statement |
|----|----------|---------------|
| J1 | 1 | **(Owner)** When I've recorded training videos, I want to publish them as a structured course and control exactly who can watch, so I can teach my method without it leaking. |
| J2 | 2 | **(Student)** When I've been granted a course, I want to watch lessons at my own pace and resume where I left off, so I can learn the skill on my own schedule. |
| J3 | 3 | **(Owner)** When a student finishes the lessons, I want to review their progress and sign off, so I can issue a certificate I stand behind. |
| J4 | 4 | **(Student)** When I complete a course, I want a verifiable certificate, so I can prove my skill to clients or employers. |
| J5 | 5 | **(Owner)** When I onboard a new student, I want to grant course access in a few clicks, so I can start teaching without admin friction. |

---

## 5. User Stories

| ID | Role | Action | Benefit | JTBD |
|----|------|--------|---------|------|
| US1 | Owner/Admin | Upload a video to my library | so I have source content to build lessons from | J1 |
| US2 | Owner/Admin | See transcode status of an uploaded video | so I know when it's ready to use | J1 |
| US3 | Owner/Admin | Build a course of modules and lessons, attaching videos and resources | so students follow a structured path | J1 |
| US4 | Owner/Admin | Add a course assessment (quiz) | so I can gauge whether a student learned the material | J3 |
| US5 | Owner/Admin | Grant or revoke a student's access to a course | so only paying/approved students can watch | J5 |
| US6 | Owner/Admin | See each student's lesson progress and assessment result | so I can decide whether to sign off | J3 |
| US7 | Owner/Admin | Confirm completion and issue a certificate | so the student gets recognised proof | J3 |
| US8 | Student | Register / accept an invite | so I can access my granted courses | J5 |
| US9 | Student | See the courses I've been granted | so I know what I can study | J2 |
| US10 | Student | Watch a lesson and resume where I left off | so I can learn at my own pace | J2 |
| US11 | Student | Take the course assessment | so I can demonstrate what I've learned | J3 |
| US12 | Student | Download my certificate once issued | so I can share proof of completion | J4 |
| US13 | Anyone | Verify a certificate via a public page | so a certificate's authenticity can be checked | J4 |
| US14 | Super-admin | Create an org and assign its owner | so a new studio can be onboarded | — (platform) |

---

## 6. Proposed Experience

**Design Direction:**
Two distinct surfaces sharing one design system: a focused **admin console** for studio owners (content-management mental model — library, builder, roster) and a calm, distraction-light **student learning area** (the video is the hero; chrome gets out of the way). A thin **platform console** for the super-admin. Mobile-responsive throughout; the student player must work well on a phone.

**Key Screens / States:**

*Platform (super-admin)*
- Orgs list + create org / assign owner.

*Admin console (owner/admin)*
- **Dashboard** — courses, students, pending completions at a glance.
- **Video library** — uploads with transcode status (processing / ready / failed), thumbnails.
- **Course builder** — course → modules → lessons; attach a video + resources per lesson; mark lessons required/optional; build the assessment.
- **Students** — roster, invite by email, grant/revoke per-course access.
- **Completions queue** — students who've finished required lessons, with progress + assessment result; confirm to issue certificate.

*Student area*
- **My courses** — granted courses with progress rings.
- **Course player** — lesson sidebar, video player with resume, resources, captions, assessment at the end.
- **My certificates** — earned certificates, download PDF.

*Public*
- **Certificate verification** — enter/scan a cert ID → valid/invalid + course, student, date.

*Cross-cutting states*
- **Empty:** no courses / no students / no pending completions — each with a clear first action.
- **Loading:** skeletons; video tiles show a "processing" state until transcode completes.
- **Error:** upload failed (retry), transcode failed (re-process), playback failed / signed URL expired (auto-refresh token then retry).

**Interaction Model — primary flows:**

1. **Owner publishes a course:** upload video(s) → wait for transcode → create course → add modules → add lessons (pick video, attach resources, set required) → optionally build assessment → publish → grant students.
2. **Student learns:** accept invite / log in → open course → play lesson (progress saved continuously) → finish required lessons (completion moves to *pending review*) → optionally take the assessment → await sign-off.
3. **Completion → certificate:** student appears in the owner's completions queue → owner reviews progress + assessment result → confirm (or reject/send back) → on confirm, certificate generated async → student notified, cert appears in My certificates.

**Accessibility Notes:**
- Full keyboard navigation; visible focus; focus trapping in modals.
- Player supports uploaded captions/subtitles (WebVTT) and keyboard controls; offer a transcript where available.
- WCAG 2.1 AA contrast; don't rely on colour alone for progress/status.

**Figma / Design Link:** [placeholder — add when design starts]

---

## 7. Component Inventory

| Component | Type | Description | Linked Stories |
|-----------|------|-------------|----------------|
| AppShell + SidebarNav | Navigation | Console layout; org-scoped nav, role-aware items | — |
| VideoUploader | Form / Action | Resumable upload to R2/MinIO via presigned URL | US1 |
| VideoLibraryGrid | Display | Uploaded videos with thumbnails + status | US1, US2 |
| TranscodeStatusBadge | Display | processing / ready / failed (live via Realtime) | US2 |
| CourseBuilder | Layout | Drag-order modules + lessons for a course | US3 |
| ModuleEditor | Form | Create/rename/reorder a module | US3 |
| LessonEditor | Form | Attach video + resources, set required, reorder | US3 |
| ResourceUploader | Form | Attach downloadable files to a lesson | US3 |
| AssessmentBuilder | Form | Questions, options, mark correct, pass score | US4 |
| StudentRoster | Display | Org's students, status, course access | US5, US6 |
| InviteStudentModal | Modal / Form | Invite by email; create membership | US8 |
| AccessGrantToggle | Action | Grant/revoke a student's access to a course | US5 |
| StudentProgressDrawer | Display | Per-student lesson progress + assessment result | US6 |
| CompletionsQueue | Display | Students pending sign-off | US7 |
| ConfirmCompletionModal | Modal / Action | Review + confirm → issue certificate | US7 |
| CourseCard | Display | Granted course with progress ring | US9 |
| CoursePlayerLayout | Layout | Lesson sidebar + player + resources | US10 |
| VideoPlayer | Display / Action | HLS playback, resume, captions, keyboard controls | US10 |
| LessonSidebar | Navigation | Lesson list with completion ticks | US10 |
| ResourceList | Display | Downloadable lesson resources | US10 |
| AssessmentRunner | Form | Take the assessment, submit answers | US11 |
| CertificateCard + DownloadButton | Display / Action | Earned cert, download PDF | US12 |
| CertificateVerification | Form / Display | Public: enter cert code → valid/invalid + details | US13 |
| AuthForms | Form | Login, accept invite, magic link | US8 |
| OrgCreateForm | Form | Super-admin: create org + assign owner | US14 |
| EmptyState / Skeleton / ErrorState / Toast | Display | Cross-cutting states | — |

---

## 8. Data Models

> Postgres (Supabase). Every tenant-owned row carries `orgId` and is protected by RLS (see note at end). All ids are UUIDs; timestamps ISO8601. `Json` = `jsonb`.

```typescript
interface Org {
  id: string;
  name: string;
  slug: string;                 // unique; used in URLs (/[slug]/...)
  logoKey?: string;             // storage key in Supabase Storage
  themeAccent?: string;         // hex; drives --primary (Design System §2); defaults to slate-900
  locale: 'id' | 'en';          // default UI language; default 'id'
  createdAt: string;
  updatedAt: string;
}

interface Profile {              // 1:1 with Supabase auth.users
  id: string;                    // = auth.users.id
  email: string;
  fullName: string;
  avatarKey?: string;
  isPlatformAdmin: boolean;      // platform super-admin flag (not org-scoped)
  createdAt: string;
  updatedAt: string;
}

interface Membership {           // a user's role within one org
  id: string;
  orgId: string;                 // FK Org
  userId: string;                // FK Profile
  role: 'owner' | 'admin' | 'student';  // instructor folded into admin in MVP
  status: 'invited' | 'active' | 'disabled';
  invitedAt?: string;
  createdAt: string;
  updatedAt: string;
  // UNIQUE (orgId, userId)
}

interface Course {
  id: string;
  orgId: string;
  title: string;
  slug: string;                  // unique within org
  description?: string;
  thumbnailKey?: string;
  status: 'draft' | 'published' | 'archived';
  certificateEnabled: boolean;   // does completing this course issue a cert
  createdBy: string;             // FK Profile
  createdAt: string;
  updatedAt: string;
}

interface Module {
  id: string;
  orgId: string;
  courseId: string;              // FK Course
  title: string;
  position: number;              // order within course
  createdAt: string;
  updatedAt: string;
}

interface Lesson {
  id: string;
  orgId: string;
  courseId: string;
  moduleId: string;              // FK Module
  title: string;
  videoId?: string;              // FK Video (null until attached)
  position: number;              // order within module
  required: boolean;             // counts toward completion
  durationSec?: number;          // mirrored from Video for quick reads
  createdAt: string;
  updatedAt: string;
}

interface Video {                // a source asset + its transcoded output
  id: string;
  orgId: string;
  title: string;
  originalFilename: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  storageBucket: string;         // R2/MinIO bucket
  sourceKey: string;             // original upload object key
  hlsManifestKey?: string;       // path to HLS .m3u8 after transcode
  durationSec?: number;
  thumbnailKey?: string;
  sizeBytes?: number;
  error?: string;                // transcode failure detail
  uploadedBy: string;            // FK Profile
  createdAt: string;
  updatedAt: string;
}

interface Caption {              // subtitle track for a video (WebVTT)
  id: string;
  orgId: string;
  videoId: string;
  lang: 'id' | 'en' | string;
  label: string;                 // shown in player menu
  storageKey: string;            // .vtt object key
  createdAt: string;
}

interface Resource {             // downloadable attachment on a lesson
  id: string;
  orgId: string;
  lessonId: string;
  title: string;
  storageKey: string;
  fileType: string;              // mime
  sizeBytes?: number;
  createdAt: string;
}

interface Enrolment {            // a student's access grant to a course
  id: string;
  orgId: string;
  courseId: string;
  userId: string;                // FK Profile
  status: 'active' | 'revoked';
  grantedBy: string;             // FK Profile (admin/owner)
  grantedAt: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
  // UNIQUE (courseId, userId)
}

interface LessonProgress {
  id: string;
  orgId: string;
  enrolmentId: string;           // FK Enrolment
  lessonId: string;
  userId: string;
  watchedSec: number;            // cumulative unique seconds watched
  lastPositionSec: number;       // for resume
  percent: number;               // 0–100
  completed: boolean;            // true at >= completion threshold (e.g. 95%)
  completedAt?: string;
  updatedAt: string;
  // UNIQUE (enrolmentId, lessonId)
}

interface Assessment {           // optional, one per course
  id: string;
  orgId: string;
  courseId: string;              // UNIQUE (courseId)
  title: string;
  passScore?: number;            // 0–100; informational in MVP (doesn't hard-gate)
  createdAt: string;
  updatedAt: string;
}

interface AssessmentQuestion {
  id: string;
  orgId: string;
  assessmentId: string;
  prompt: string;
  type: 'single' | 'multiple';
  position: number;
}

interface AssessmentOption {
  id: string;
  orgId: string;
  questionId: string;
  label: string;
  isCorrect: boolean;            // never sent to students; server-side scoring only
  position: number;
}

interface AssessmentAttempt {
  id: string;
  orgId: string;
  assessmentId: string;
  enrolmentId: string;
  userId: string;
  answers: Json;                 // { questionId: optionId[] }
  score: number;                 // 0–100, computed server-side
  passed: boolean;               // score >= passScore (informational)
  submittedAt: string;
}

interface CourseCompletion {     // one per enrolment
  id: string;
  orgId: string;
  enrolmentId: string;           // UNIQUE
  courseId: string;
  userId: string;
  lessonsCompletedAt?: string;   // set when all required lessons done
  status: 'in_progress' | 'pending_review' | 'confirmed' | 'rejected';
  confirmedBy?: string;          // FK Profile (admin) on sign-off
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Certificate {
  id: string;
  orgId: string;
  courseId: string;
  userId: string;
  completionId: string;          // FK CourseCompletion; UNIQUE (one cert per completion)
  code: string;                  // unique public code, Crockford Base32, e.g. "CP-7F3K-9Q2M" (RFC-003)
  studentNameSnapshot: string;   // frozen at issue — verification reads these, not live joins (RFC-003 DH)
  courseTitleSnapshot: string;   // frozen at issue
  orgNameSnapshot: string;       // frozen at issue
  pdfKey?: string;               // storage key; null until PDF generated
  issuedAt: string;
  revoked: boolean;
  revokedAt?: string;
  revokedReason?: string;        // optional (RFC-003 DJ)
  createdAt: string;
}
```

**RLS strategy (note):** policies key off the caller's `Membership` in the row's `orgId`. Owners/admins read-write all org content; students read only courses they have an `active` Enrolment for, and read-write only their own `LessonProgress` / `AssessmentAttempt`. `AssessmentOption.isCorrect` is never exposed to students (scoring runs server-side). `Certificate` verification by `code` is public but returns a minimal projection.

---

## 9. API / Integration Surface

**Two layers.** Standard CRUD goes directly to Supabase through Refine's Supabase data provider, with RLS doing authorisation — no hand-written endpoints needed. Everything that RLS can't safely do (signing storage URLs, server-side scoring, transcode orchestration, PDF issuance, public verification) is a Next.js Route Handler.

**CRUD via Supabase + RLS (Refine data provider):**
`orgs`, `memberships`, `courses`, `modules`, `lessons`, `videos`, `captions`, `resources`, `enrolments`, `assessments`, `assessment_questions`, `assessment_options`, `course_completions`, `certificates` — all org-scoped and role-gated by policy.

**Custom Next.js Route Handlers:**

| Method | Path | Description | Auth | Response |
|--------|------|-------------|------|----------|
| POST | /api/uploads/sign | Presigned PUT URL for R2/MinIO; creates `Video` (status `uploading`) | owner/admin | `{ videoId, uploadUrl, storageKey, expiresAt }` |
| POST | /api/videos/:id/complete | Mark upload done; enqueue transcode job | owner/admin | `{ video: Video }` |
| POST | /api/internal/transcode-callback | Worker reports result; sets `ready`/`failed`, `hlsManifestKey`, `durationSec` | service token | `{ ok: true }` |
| GET | /api/lessons/:id/playback | Short-TTL signed HLS URL if caller has an active enrolment | student (enrolled) | `{ url, expiresAt }` |
| POST | /api/progress | Upsert `LessonProgress` (throttled); flips lesson `completed` at threshold; may move completion to `pending_review` | student | `{ progress: LessonProgress }` |
| POST | /api/assessments/:id/submit | Score an attempt server-side; store `AssessmentAttempt` | student (enrolled) | `{ score, passed }` |
| POST | /api/completions/:id/confirm | Owner sign-off → `confirmed`; create `Certificate`; enqueue PDF | owner/admin | `{ certificate: Certificate }` |
| GET | /api/certificates/:code/verify | Public validity check by code | public | `{ valid, courseTitle, studentName, issuedAt, revoked }` |
| GET | /api/certificates/:id/download | Signed URL to cert PDF | owner of cert / admin | `{ url, expiresAt }` |
| POST | /api/orgs | Super-admin: create org + assign owner membership | platform admin | `{ org: Org }` |

**External integrations:**
- **Object storage** — Cloudflare R2 (S3-compatible) or MinIO: presigned uploads, HLS + asset storage, signed reads.
- **Transcoding worker** — ffmpeg-based container consuming a job queue; writes HLS renditions back to storage and calls `transcode-callback`. Queue mechanism (pg-boss on Supabase vs Redis/BullMQ) → RFC.
- **PDF generation** — server-side cert rendering (e.g. `@react-pdf/renderer` or headless Chromium), runs async on confirm.
- **Email** — transactional (invite, completion ready, certificate issued) via Resend/Postmark → RFC.
- **Realtime** — Supabase Realtime to live-update transcode status and the completions queue.

---

## 10. State Management Map

| State | Location | Persistence | Notes |
|-------|----------|-------------|-------|
| Server data (courses, lessons, enrolments, completions, certs) | Server (Supabase) via Refine + React Query cache | Persistent | Single source of truth; RLS-enforced |
| Auth session + current user | Supabase Auth (cookie) + auth context | Session / Persistent | Drives RLS and route guards |
| Active org | URL (`/[orgSlug]/...`) + auth context | Session | Scopes every query; resolved from membership |
| Video upload progress | Local UI (uploader) | None | Transient; resumable via storage |
| Transcode status | Server (`Video.status`) + Supabase Realtime sub | Persistent | Live-updates the library without polling |
| Player position / resume | Local UI (optimistic) + debounced sync to `LessonProgress` | Persistent (server) | Resume across devices |
| Course builder edits | Refine form state (optimistic) → Supabase | Session until saved | Mutations via data provider |
| Assessment answers (in progress) | Local UI | Session | Submitted server-side for scoring |
| Signed playback URL | Local UI (in memory) | None (short TTL) | Re-fetched from `/playback` on expiry |
| Completions queue | Server + Realtime sub | Persistent | New `pending_review` rows appear live |
| Toasts / modals / nav UI | Local UI | None | Ephemeral |

---

## 11. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | Type safety end to end; shared types from data models |
| Framework | Next.js (App Router) | RSC, routing, and Route Handlers in one app; Vercel-native |
| Admin/platform UI | Refine.js (headless) | CRUD scaffolding, auth + access-control providers, Supabase data provider — fits the console surfaces |
| Styling / components | Tailwind CSS + shadcn/ui | One component layer shared by admin and student areas |
| Video player | hls.js + Vidstack (or Plyr) | Adaptive HLS, resume, WebVTT captions, keyboard controls |
| Backend / BaaS | Supabase | Postgres, Auth, RLS, Realtime; Storage for light assets (thumbnails, certs) |
| Object storage | Cloudflare R2 (or MinIO self-host) | Cheap, S3-compatible; holds source video + HLS renditions |
| Transcoding | ffmpeg worker (Node container) + queue | Heavy compute off the request path; pg-boss or BullMQ (→ RFC) |
| PDF certificates | @react-pdf/renderer (or headless Chromium) | Server-side, async on confirm |
| Email | Resend (or Postmark) | Transactional invites + notifications (→ RFC) |
| Data/state | React Query (via Refine); Zustand for local UI | Server cache + minimal client state |
| i18n | next-intl (or i18next) | Bahasa Indonesia + English |
| Hosting | Vercel (web); Fly.io/Railway/VPS (worker); Supabase (managed); R2 (managed) | Managed where possible; worker needs a long-running container |

---

## 12. Suggested File Structure

```
course-platform/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── accept-invite/page.tsx
│   ├── (platform)/
│   │   └── admin/orgs/...                 # super-admin (Refine)
│   ├── [org]/
│   │   ├── (admin)/                       # studio console (Refine)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── library/...                # video uploads + status
│   │   │   ├── courses/...                # course builder
│   │   │   ├── students/...               # roster + access grants
│   │   │   └── completions/...            # sign-off queue
│   │   └── (learn)/                       # student area (custom Next.js)
│   │       ├── page.tsx                   # my courses
│   │       ├── courses/[courseId]/...     # player
│   │       └── certificates/...
│   ├── verify/[code]/page.tsx             # public cert verification
│   └── api/
│       ├── uploads/sign/route.ts
│       ├── videos/[id]/complete/route.ts
│       ├── lessons/[id]/playback/route.ts
│       ├── progress/route.ts
│       ├── assessments/[id]/submit/route.ts
│       ├── completions/[id]/confirm/route.ts
│       ├── certificates/[code]/verify/route.ts
│       ├── certificates/[id]/download/route.ts
│       ├── orgs/route.ts
│       └── internal/transcode-callback/route.ts
├── components/
│   ├── admin/  learn/  ui/                # ui = shadcn/ui
├── lib/
│   ├── supabase/                          # browser + server clients, RLS helpers
│   ├── storage/                           # R2/MinIO client, presign + signed reads
│   ├── refine/                            # dataProvider, authProvider, accessControl
│   ├── video/                             # hls helpers, progress throttle
│   ├── certificates/                      # pdf template, code generator
│   └── i18n/
├── workers/
│   └── transcoder/                        # ffmpeg job consumer
├── supabase/
│   ├── migrations/
│   └── policies/                          # RLS policy SQL
└── ...
```

---

## 13. Acceptance Criteria

**US1/US2 — Upload video + see status**
- [ ] Owner/admin requests a presigned URL and uploads a file directly to R2/MinIO; a `Video` row is created with status `uploading`.
- [ ] On upload completion, status moves to `processing`; the worker produces HLS and status becomes `ready` (or `failed` with an error message).
- [ ] Library reflects status changes live (Realtime), no manual refresh.
- [ ] A failed transcode can be re-processed.

**US3 — Build a course**
- [ ] Owner/admin creates a course (draft), adds modules and lessons, and attaches a `ready` video to a lesson.
- [ ] Lessons and modules can be reordered; `required` can be toggled per lesson.
- [ ] A course can be published only when it has ≥1 required lesson with a `ready` video.

**US4 — Assessment**
- [ ] Owner/admin can add one assessment per course with questions, options, and correct answers.
- [ ] Correct-answer flags are never returned to student clients.

**US5 — Grant/revoke access**
- [ ] Owner/admin grants a student access; an `Enrolment` (status `active`) and a paired `CourseCompletion` (status `in_progress`) are created, and the student sees the course.
- [ ] Revoking sets status `revoked`; the student immediately loses access and playback is denied.

**US6 — View progress**
- [ ] Owner/admin sees each enrolled student's per-lesson progress and latest assessment result.

**US7 — Confirm completion + issue certificate**
- [ ] When all required lessons are `completed`, the completion moves to `pending_review` and appears in the queue.
- [ ] On confirm, if the course has `certificateEnabled`, a `Certificate` with a unique `code` is created and a PDF is generated async; the student is notified. If certificates are disabled, the completion is marked `confirmed` with no certificate.
- [ ] Owner can reject a pending completion (status `rejected`, e.g. send back for a re-attempt) instead of confirming.
- [ ] Confirm/reject are only available for `pending_review` completions.

**US8 — Register / accept invite**
- [ ] An invited student can set a password / use magic link and lands in their org's learn area.

**US9/US10 — See and watch courses with resume**
- [ ] Student sees only courses they have an `active` enrolment for.
- [ ] Playback requires a valid short-TTL signed URL; an expired URL is transparently refreshed.
- [ ] Reopening a lesson resumes within ~2s of the last saved position.
- [ ] Progress is saved at least every 15s of playback and on pause/exit.
- [ ] A lesson flips to `completed` at ≥95% watched.

**US11 — Take assessment**
- [ ] Student submits answers once; score is computed server-side and stored as an `AssessmentAttempt`.

**US12 — Download certificate**
- [ ] Once issued, the student can download the cert PDF via a signed URL.

**US13 — Verify certificate (public)**
- [ ] Entering a valid `code` on `/verify/[code]` returns course title, student name, issue date, and revoked status.
- [ ] An invalid or revoked code returns a clear "not valid" result.

**US14 — Create org (super-admin)**
- [ ] Platform admin creates an org and assigns an owner; the owner can log into that org's console.
- [ ] No user can read or write data outside the org(s) they belong to (RLS verified).

---

## 14. Open Questions & Risks

- **Q:** Lesson completion threshold — 95% watched, or different? — *Owner: Fawwaz*
- **Q:** Assessment confirmed as informational (doesn't hard-gate completion) — keep, or make it a hard gate for certain courses? — *Owner: Fawwaz*
- **Q:** Transcoding queue + worker hosting (pg-boss vs BullMQ; Fly.io vs Railway vs VPS) — *Owner: Eng → RFC*
- **Q:** Email provider (Resend vs Postmark) — *Owner: Eng → RFC*
- **Q:** Platform billing for studios — confirmed Phase 2; trigger to revisit? — *Owner: Fawwaz*
- **Risk:** Content piracy via screen recording. *Mitigation:* short-TTL signed URLs + no permanent links in MVP; forensic/visible watermarking and optional DRM as Phase 2.
- **Risk:** ffmpeg transcode cost/throughput at scale. *Mitigation:* job queue, concurrency caps, per-org upload limits; monitor and scale workers.
- **Risk:** Large uploads on poor connections. *Mitigation:* resumable/multipart uploads; retry.
- **Tradeoff:** Self-hosted video (R2/MinIO) gives lowest cost and full control, but we own the transcode pipeline, signed playback, and analytics — work that a managed service (Mux) would have handled.

---

## 15. Rollout & Next Steps

**MVP scope** — smallest version that validates the core jobs (publish gated course → student learns → verifiable cert):
- Includes: multi-tenant schema with one org (nail studio) provisioned manually; upload → transcode → HLS playback via signed URLs; course builder (modules/lessons + resources); admin grant/revoke access; student dashboard + player with resume + progress; completion (required lessons + admin confirm) → auto PDF certificate + public verification; basic assessment (builder + runner + recorded result).
- Excludes: paid enrolment, studio billing, marketplace/catalogue, native apps, advanced analytics, DRM/watermarking.

**Phase 2+ ideas:**
- Paid self-serve enrolment + studio subscription billing.
- Public course catalogue, ratings.
- Analytics dashboards (engagement, drop-off).
- DRM / forensic watermarking.
- Native mobile apps; discussion/comments.
- Assessment as a hard completion gate (per-course option).

**Sign-off needed from:**
- [ ] Engineering (Fawwaz)

**Next steps:**
1. Reader-test + lock this PRD.
2. RFC-001 — Video pipeline (upload, transcode, storage, signed playback, progress).
3. RFC-002 — Multi-tenancy + RLS policy model.
4. RFC-003 — Certificates (generation, codes, verification).
5. Design system + initial Supabase migrations.

---

## Appendix — Planning Set Roadmap

> This PRD is the foundation of a full planning set (PRD → RFCs → diagrams), mirroring the Blendz and Geeta projects. RFC/diagram plan to be drafted after the PRD is locked.
