# RFC-001 — Video Pipeline

> **Status:** Accepted — D1–D8 locked 2026-06-16
> **Author:** Fawwaz
> **Date:** 2026-06-16
> **Related:** PRD §3, §6, §8, §9 (`01_DOCS/PRD.md`)
> **Decision owner:** Eng (Fawwaz)

---

## 1. Summary

How a studio's raw video becomes a secured, streamable lesson with tracked progress — without leaking content and without a managed video service. Covers upload, storage layout, transcoding to HLS, the job queue, authorised playback, and progress tracking.

This is the highest-risk part of the build: it owns the work a managed service (Mux) would otherwise hide.

---

## 2. Goals / Non-goals

**Goals**
- Upload large source files reliably, including on flaky connections.
- Transcode to adaptive HLS so playback starts fast and adapts to bandwidth.
- Serve video only to enrolled students, via short-lived signed access — no permanent public links.
- Track per-lesson progress accurately enough to drive completion.
- Keep cost low (self-hosted storage; zero-egress where possible).

**Non-goals (this RFC)**
- DRM and forensic watermarking (PRD Phase 2).
- Live streaming.
- Multi-audio-track / advanced subtitle authoring (basic WebVTT only).
- Storyboard/scrub-preview sprites (nice-to-have, Phase 2).

---

## 3. Requirements

**Functional**
- Resumable upload of files up to ~5 GB.
- Transcode to an adaptive ladder + poster thumbnail; probe duration.
- Live status: `uploading → processing → ready | failed`.
- Re-process a failed video.
- Playback authorised per active enrolment; tokens expire and refresh transparently.
- Progress saved during playback; lesson auto-completes at threshold.

**Non-functional**
- Time-to-first-frame < 3s on a typical connection (PRD goal).
- Transcode throughput tunable via worker concurrency; heavy work off the request path.
- No source or segment object reachable without a valid signed request.

---

## 4. Architecture Overview

```
[Browser]
   │  1. request upload          ┌────────────────────────┐
   ├────────────────────────────▶│ Next.js Route Handlers │
   │  2. PUT parts (presigned)    └───────────┬────────────┘
   ▼                                          │ create Video, enqueue job
[R2 / MinIO  (private)] ◀──────────────────────┤
   ▲   ▲                                       ▼
   │   │ 4. read source                 [ Job Queue (pg-boss) ]
   │   │                                       │
   │   │                                       ▼
   │   └───────────────── 5. write HLS ─ [ Transcode Worker (ffmpeg) ]
   │                                           │ 6. callback → status ready
   │                                           ▼
   │  8. signed segment reads          [ Next.js Route Handlers ]
[Playback proxy / CDN] ◀──── 7. issue playback token ──── [Browser player (hls.js)]
```

1. Client asks for an upload; server creates a `Video` (`uploading`) and returns presigned part URLs.
2. Client uploads parts directly to storage (no bytes through our server).
3. Client calls `complete`; server finalises the multipart upload and enqueues a transcode job.
4–6. Worker pulls the job, transcodes to HLS, writes renditions back to storage, and calls the callback to mark the video `ready`.
7–8. On play, the client gets a short-lived token; the proxy validates it and streams segments from private storage.

---

## 5. Upload

**Approach:** direct-to-storage via S3 multipart presigned URLs. R2 and MinIO are both S3-compatible, so one code path covers either. Multipart gives resumability (retry a failed part, not the whole file).

**Client:** Uppy with the `AwsS3` (multipart) plugin handles chunking, parallelism, and retries. (Decision D5.)

**Flow**
1. `POST /api/uploads/sign` → server validates role (owner/admin), creates `Video` (`uploading`), calls `CreateMultipartUpload`, returns `{ videoId, uploadId, partUrls[], key }`.
2. Client `PUT`s each part to its presigned URL.
3. `POST /api/videos/:id/complete` → server calls `CompleteMultipartUpload`, sets `Video.sizeBytes`, sets status `processing`, and enqueues the transcode job. (Status stays in the PRD enum: `uploading → processing → ready | failed`; "queued" is collapsed into `processing`.)

**Key layout (private bucket, e.g. `cp-media`)**
```
org/{orgId}/videos/{videoId}/source.{ext}
org/{orgId}/videos/{videoId}/hls/master.m3u8
org/{orgId}/videos/{videoId}/hls/{rendition}/index.m3u8 + segment_*.ts
org/{orgId}/videos/{videoId}/thumbnails/poster.jpg
org/{orgId}/videos/{videoId}/captions/{lang}.vtt
```

**Orphan cleanup:** a storage lifecycle rule aborts incomplete multipart uploads after 7 days; a reconciler (see §9) removes `Video` rows stuck `uploading`.

---

## 6. Transcode Worker

A long-running Node container (not serverless — ffmpeg is too heavy and slow for a request). Consumes the queue, shells out to ffmpeg/ffprobe.

**Steps per job**
1. Download source from storage to local scratch.
2. `ffprobe` → duration, resolution, codecs. Persist `durationSec`.
3. `ffmpeg` → adaptive HLS ladder (only renditions at or below source resolution):

   | Rendition | Resolution | Video bitrate | Audio |
   |-----------|-----------|---------------|-------|
   | 1080p | 1920×1080 | ~5 Mbps | AAC 128k |
   | 720p | 1280×720 | ~3 Mbps | AAC 128k |
   | 480p | 854×480 | ~1.4 Mbps | AAC 96k |
   | 360p | 640×360 | ~0.8 Mbps | AAC 96k |

   H.264 (broad device support), 4–6s segments, generate `master.m3u8`. (Decision D4.)
4. Poster thumbnail via `ffmpeg -ss`.
5. Upload the HLS tree + poster to storage under the keys above.
6. `POST /api/internal/transcode-callback` (service token) → set `ready`, `hlsManifestKey`, `durationSec`, `thumbnailKey`; or `failed` + `error`.
7. Clean scratch.

**Controls:** worker concurrency cap (e.g. 2–4 jobs), per-job timeout, N automatic retries on transient failure. Codec choice H.264-only for MVP; HEVC/AV1 deferred (encode cost vs marginal savings).

---

## 7. Job Queue

**Recommendation: pg-boss** (Postgres-backed) for MVP. It runs on the database we already have via Supabase — no Redis to provision, transactional enqueue, built-in retries, visibility timeout, and scheduled jobs (useful for the reconciler). BullMQ (Redis) is faster at very high throughput but adds infra we don't need yet. (Decision D1.)

**Job:** `transcode` with payload `{ videoId, orgId, key }`. Worker connects to the same Postgres. If throughput ever outgrows pg-boss, swapping to BullMQ is contained to the queue adapter.

---

## 8. Playback (the crux)

HLS is a master playlist + per-rendition playlists + many segment objects, each fetched directly by the player. Presigning every segment URL is impractical (hundreds of URLs, expiry skew). So **authorise at the edge, not per object.**

**Recommended design (Decision D2):** a **playback proxy** sits in front of private storage.
1. Player calls `GET /api/lessons/:id/playback`. Server checks the caller has an `active` Enrolment for the lesson's course, then issues a short-lived signed token (JWT, ~10–15 min TTL) scoped to that `videoId`.
2. Player loads `…/playback-proxy/{videoId}/master.m3u8?t={token}`. The proxy (a Cloudflare Worker in front of R2, or a Next.js/edge handler for MinIO) validates the token and streams/redirects the manifest and each segment from private storage.
3. Manifests are rewritten so segment URLs carry the token. On expiry, hls.js re-requests; the player refreshes the token via step 1.

**Why not per-segment presigned:** works, but every segment URL expires independently and the playlist must be rewritten on each refresh — fragile and chatty. The proxy keeps one auth check per request with a single token lifecycle.

**R2 vs MinIO:** R2 pairs naturally with a Cloudflare Worker proxy (and R2 has **zero egress fees** — a real cost win). MinIO self-host uses an equivalent Node/edge proxy or signed reverse proxy. Same token model either way.

---

## 9. Progress Tracking

- Player (hls.js + Vidstack) emits `timeupdate`; client throttles to one write per ~10–15s and on pause/seek/unmount.
- `POST /api/progress` with `{ lessonId, lastPositionSec, watchedDeltaSec }`. Server upserts `LessonProgress`, recomputes `percent` against `durationSec`, flips `completed` at ≥ threshold (**95%**, Decision D6).
- When all **required** lessons in a course are `completed`, set `CourseCompletion.lessonsCompletedAt` and move status to `pending_review`.

**Anti-cheat (MVP stance):** trust the client's `watchedDeltaSec` but clamp it — a write can't advance watched time faster than wall-clock since the last write, and cumulative `watchedSec` can't exceed `durationSec`. Server-side unique-segment verification is deferred (Decision D7). Good enough to gate a certificate that an admin still signs off on.

**Reconciler:** a scheduled pg-boss job re-checks videos stuck in `processing` beyond a timeout (lost callback) and clears stale `uploading` rows.

---

## 10. Security

- Buckets fully private; no public-read ACLs. Every read is signed.
- Playback tokens are short-TTL, video-scoped, and issued only after an enrolment check.
- `transcode-callback` authenticated with a service token; never callable by clients.
- Rate-limit `/playback` issuance and `/progress`.
- Uploads restricted to owner/admin by role; size and content-type validated.

---

## 11. Failure Modes

| Failure | Handling |
|---------|----------|
| Upload aborted mid-way | Multipart resumes failed parts; lifecycle rule aborts incomplete uploads after 7d |
| Transcode error (bad codec, corrupt file) | Status `failed` + `error`; owner can re-process; N auto-retries for transient errors |
| Worker crash mid-job | Queue visibility timeout returns the job; idempotent output keys make re-runs safe |
| Lost callback | Reconciler re-checks stuck `processing` videos |
| Token expiry during playback | Player refreshes token via `/playback`; seamless |
| Storage outage | Player surfaces a retryable error state; uploads queue client-side |

---

## 12. Cost Notes

- Storage ≈ source + renditions (~1.5–2× source size).
- **Egress:** R2 charges zero egress — significant for video delivery vs S3. MinIO self-host trades that for your own bandwidth/ops.
- Transcode = worker CPU time; the main lever is the rendition ladder and concurrency.
- No per-minute encoding/delivery fees (the point of self-hosting vs Mux).

---

## 13. Alternatives Considered

- **Mux / Cloudflare Stream / Bunny Stream** — managed upload, transcode, signed playback, and analytics out of the box; far less to build. Rejected per the PRD's locked decision (cost + control). **Cloudflare Stream remains the fallback** if pipeline ops become a burden — it would replace §§5–9 wholesale.
- **Per-segment presigned URLs** — no proxy, but fragile expiry and playlist rewriting (see §8).
- **BullMQ/Redis queue** — better at high throughput; deferred to avoid running Redis now (§7).
- **HEVC/AV1 renditions** — smaller files, higher encode cost and patchier support; deferred.

---

## 14. Decisions (Locked 2026-06-16)

> All recommended options accepted.

| # | Decision | Chosen | Alternatives (rejected) |
|---|----------|-------------|--------------|
| D1 | Job queue | **pg-boss** (Postgres) | BullMQ + Redis |
| D2 | Playback auth | **Token-authorising proxy/CDN** | Per-segment presigned |
| D3 | Worker hosting | **Fly.io** | Railway, bare VPS |
| D4 | Rendition ladder | **1080/720/480/360, H.264** | Add HEVC; fewer rungs |
| D5 | Upload client | **Uppy AwsS3 multipart** | Custom multipart |
| D6 | Completion threshold | **95% watched** | 90% / 100% |
| D7 | Progress anti-cheat | **Clamp client time (MVP)** | Server-side segment verification |
| D8 | Storage provider | **Cloudflare R2** (zero egress) | MinIO self-host |

---

## 15. Implementation Phases

- **P0 — End-to-end skeleton:** single-rendition (passthrough/720p) transcode + token proxy playback + basic progress. Proves the whole chain on one video.
- **P1 — Production pipeline:** full ladder, poster thumbnails, WebVTT captions, retries, reconciler, live status via Realtime.
- **P2 — Hardening (later):** storyboard scrub sprites, watermarking, DRM, HEVC.

---

## 16. Open Questions

- Final source size cap (assumed ~5 GB) — confirm against the studio's typical recordings.
- Caption sourcing — owner-uploaded VTT only, or auto-transcription later?
- CDN in front of MinIO if R2 isn't chosen — who operates it?
