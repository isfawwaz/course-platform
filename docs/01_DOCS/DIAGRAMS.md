# Course Platform — Architecture Diagrams

> Companion to the PRD and RFC-001/002/003. Mermaid source; renders in any Mermaid-aware viewer.
> **Last updated:** 2026-06-16

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph Client["Browser"]
        AC["Admin console<br/>(Refine)"]
        SA["Student area<br/>(custom Next.js)"]
        PV["Public verify page"]
    end

    subgraph Vercel["Next.js (App Router) on Vercel"]
        RH["Route Handlers<br/>uploads/playback/progress/<br/>completions/certs/orgs"]
        RF["Refine data + auth<br/>+ access-control providers"]
    end

    subgraph Supabase["Supabase"]
        PG[("Postgres + RLS")]
        AUTH["Auth"]
        RT["Realtime"]
        ST["Storage<br/>(thumbnails, certs)"]
    end

    subgraph Media["Self-hosted media"]
        R2[("Cloudflare R2<br/>source + HLS")]
        PROXY["Playback proxy<br/>(token-gated)"]
    end

    subgraph Workers["Workers (Fly.io)"]
        Q{{"pg-boss queue<br/>(in Postgres)"}}
        TW["Transcode worker<br/>(ffmpeg)"]
        CW["Certificate worker<br/>(@react-pdf)"]
    end

    EMAIL["Email<br/>(Resend/Postmark)"]

    AC -->|CRUD| RF --> PG
    SA --> RH
    PV -->|verify_certificate RPC| PG
    AC --> RH

    RH -->|presign| R2
    RH -->|enqueue| Q
    RH --> PG
    RH --> AUTH
    RH -->|issue token| PROXY

    Q --> TW
    Q --> CW
    TW -->|read source / write HLS| R2
    TW -->|callback| RH
    CW -->|render + store PDF| ST
    CW --> EMAIL

    SA -->|HLS segments + token| PROXY --> R2
    PG -->|status / queue events| RT --> AC
```

---

## 2. Data Model (ERD)

```mermaid
erDiagram
    ORGS ||--o{ MEMBERSHIPS : has
    PROFILES ||--o{ MEMBERSHIPS : holds
    ORGS ||--o{ COURSES : owns
    COURSES ||--o{ MODULES : contains
    MODULES ||--o{ LESSONS : contains
    VIDEOS ||--o| LESSONS : "attached to"
    VIDEOS ||--o{ CAPTIONS : has
    LESSONS ||--o{ RESOURCES : has
    COURSES ||--o{ ENROLMENTS : "granted via"
    PROFILES ||--o{ ENROLMENTS : "enrolled in"
    ENROLMENTS ||--o{ LESSON_PROGRESS : tracks
    LESSONS ||--o{ LESSON_PROGRESS : "progress for"
    COURSES ||--o| ASSESSMENTS : has
    ASSESSMENTS ||--o{ ASSESSMENT_QUESTIONS : has
    ASSESSMENT_QUESTIONS ||--o{ ASSESSMENT_OPTIONS : has
    ASSESSMENTS ||--o{ ASSESSMENT_ATTEMPTS : "attempted in"
    ENROLMENTS ||--|| COURSE_COMPLETIONS : "has one"
    COURSE_COMPLETIONS ||--o| CERTIFICATES : "issues"

    ORGS {
        uuid id PK
        string name
        string slug
        string locale
    }
    PROFILES {
        uuid id PK
        string email
        string fullName
        bool isPlatformAdmin
    }
    MEMBERSHIPS {
        uuid id PK
        uuid orgId FK
        uuid userId FK
        string role
        string status
    }
    COURSES {
        uuid id PK
        uuid orgId FK
        string title
        string status
        bool certificateEnabled
    }
    VIDEOS {
        uuid id PK
        uuid orgId FK
        string status
        string hlsManifestKey
        int durationSec
    }
    ENROLMENTS {
        uuid id PK
        uuid orgId FK
        uuid courseId FK
        uuid userId FK
        string status
    }
    LESSON_PROGRESS {
        uuid id PK
        uuid enrolmentId FK
        uuid lessonId FK
        int percent
        bool completed
    }
    COURSE_COMPLETIONS {
        uuid id PK
        uuid enrolmentId FK
        string status
        uuid confirmedBy FK
    }
    CERTIFICATES {
        uuid id PK
        uuid completionId FK
        string code
        string studentNameSnapshot
        string courseTitleSnapshot
        bool revoked
    }
```

---

## 3. Sequence — Upload & Transcode

```mermaid
sequenceDiagram
    actor Owner
    participant FE as Admin console
    participant API as Route Handlers
    participant R2 as Cloudflare R2
    participant Q as pg-boss
    participant TW as Transcode worker
    participant DB as Postgres
    participant RT as Realtime

    Owner->>FE: Select video file
    FE->>API: POST /uploads/sign
    API->>DB: create Video (uploading)
    API->>R2: CreateMultipartUpload
    API-->>FE: { videoId, partUrls }
    FE->>R2: PUT parts (resumable)
    FE->>API: POST /videos/:id/complete
    API->>R2: CompleteMultipartUpload
    API->>DB: status = processing
    API->>Q: enqueue transcode
    Q->>TW: job { videoId, key }
    TW->>R2: download source
    TW->>TW: ffmpeg → HLS ladder + poster
    TW->>R2: upload HLS + thumbnail
    TW->>API: POST /internal/transcode-callback
    API->>DB: status = ready, hlsManifestKey, durationSec
    DB-->>RT: change event
    RT-->>FE: video ready (live)
```

---

## 4. Sequence — Secured Playback & Progress

```mermaid
sequenceDiagram
    actor Student
    participant FE as Player (hls.js)
    participant API as Route Handlers
    participant DB as Postgres
    participant PX as Playback proxy
    participant R2 as Cloudflare R2

    Student->>FE: Open lesson
    FE->>API: GET /lessons/:id/playback
    API->>DB: check active enrolment (RLS)
    API-->>FE: { token, expiresAt }
    FE->>PX: GET master.m3u8?t=token
    PX->>PX: validate token (videoId-scoped)
    PX->>R2: fetch manifest + segments
    PX-->>FE: stream HLS
    loop every ~10-15s
        FE->>API: POST /progress { positionSec, delta }
        API->>DB: upsert LessonProgress (clamp)
    end
    Note over API,DB: at >=95% → lesson completed
    API->>DB: if all required done → completion pending_review
    FE->>API: refresh token on expiry
```

---

## 5. Sequence — Completion → Certificate

```mermaid
sequenceDiagram
    actor Student
    actor Admin
    participant API as Route Handlers
    participant DB as Postgres
    participant Q as pg-boss
    participant CW as Cert worker
    participant ST as Supabase Storage
    participant EM as Email
    participant Pub as Public verify

    Note over DB: completion = pending_review
    Admin->>API: POST /completions/:id/confirm
    API->>DB: status = confirmed
    alt certificateEnabled
        API->>DB: create Certificate (code, snapshots)
        API->>Q: enqueue certificate.issue
        Q->>CW: job { certificateId }
        CW->>CW: render PDF (+QR)
        CW->>ST: store PDF (pdfKey)
        CW->>EM: notify student
    else certificates disabled
        API->>DB: confirmed, no certificate
    end
    Student->>API: GET /certificates/:id/download
    API-->>Student: signed URL
    Pub->>DB: verify_certificate(code) RPC
    DB-->>Pub: valid + snapshots + revoked
```

---

## 6. State Machines

**Video status**
```mermaid
stateDiagram-v2
    [*] --> uploading
    uploading --> processing: complete upload + enqueue
    processing --> ready: transcode ok
    processing --> failed: transcode error
    failed --> processing: re-process
    ready --> [*]
```

**Course completion**
```mermaid
stateDiagram-v2
    [*] --> in_progress: enrolment granted
    in_progress --> pending_review: all required lessons done
    pending_review --> confirmed: admin sign-off
    pending_review --> rejected: admin sends back
    rejected --> pending_review: re-attempt complete
    confirmed --> [*]: certificate issued (if enabled)
```
