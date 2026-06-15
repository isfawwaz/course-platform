# Course Platform — Design System

> Build-ready design system for the platform. Tokens map to Tailwind + shadcn/ui (PRD §11).
> **Direction:** clean & minimal · neutral slate base · light-only (MVP) · per-org accent + logo.
> **Last updated:** 2026-06-16

---

## 1. Principles

- **Neutral by default, branded by org.** The base is slate-neutral; each studio's accent + logo theme it. Build everything against tokens — never hardcode a hex.
- **Content first.** Admin console is dense and efficient; student area is calm with the video as hero. Chrome recedes.
- **Borders over shadows.** Minimal elevation; 1px hairlines define structure.
- **Accessible baseline.** WCAG 2.1 AA: visible focus, AA contrast, never colour alone.
- **One component layer.** shadcn/ui (Radix primitives) shared across admin + student + public.

---

## 2. Theming Model

The platform ships a **default theme** (slate). Each org overrides a single brand colour and logo:

- `Org.themeAccent` (hex) → drives `--primary` and its derived states.
- `Org.logoKey` → logo in nav + certificate.

> **PRD patch:** add `themeAccent?: string` to the `Org` interface (§8). Defaults to slate-900 when unset.

**How override works:** the `[orgSlug]` layout reads `themeAccent` and sets CSS variables on a root wrapper. Derivations (computed once when set, or at runtime):

- `--primary` = brand hex
- `--primary-foreground` = white or slate-900, whichever hits AA on the brand colour
- `--primary-hover` = brand darkened ~8%
- `--primary-active` = brand darkened ~16%
- `--ring` = brand at 45% alpha

Public pages (login, verify) use the default theme unless an org context applies.

---

## 3. Design Tokens (light)

shadcn-aligned CSS variables. **Note the naming trap:** shadcn's `--primary` is the main action colour (our brand accent); shadcn's `--accent` is a *subtle hover surface*, not the brand. Don't conflate them.

```css
:root {
  /* Surfaces & neutrals (slate) */
  --background: #FFFFFF;
  --foreground: #0F172A;          /* slate-900 — primary text */
  --surface:    #F8FAFC;          /* slate-50  — page / app bg */
  --card:       #FFFFFF;
  --card-foreground: #0F172A;
  --popover:    #FFFFFF;
  --popover-foreground: #0F172A;
  --muted:      #F1F5F9;          /* slate-100 — muted surface */
  --muted-foreground: #64748B;    /* slate-500 — secondary text */
  --border:     #E2E8F0;          /* slate-200 */
  --input:      #E2E8F0;

  /* Brand / primary (default slate-900; per-org overrides) */
  --primary: #0F172A;
  --primary-foreground: #F8FAFC;
  --primary-hover:  #1E293B;      /* slate-800 */
  --primary-active: #334155;      /* slate-700 */
  --ring: #0F172A;

  /* shadcn accent = subtle hover surface (NOT the brand) */
  --accent: #F1F5F9;
  --accent-foreground: #0F172A;
  --secondary: #F1F5F9;
  --secondary-foreground: #0F172A;

  /* Semantic */
  --success: #047857; --success-foreground: #FFFFFF; --success-subtle: #ECFDF5;  /* AA white text */
  --warning: #B45309; --warning-foreground: #FFFFFF; --warning-subtle: #FFFBEB;
  --danger:  #DC2626; --danger-foreground:  #FFFFFF; --danger-subtle:  #FEF2F2;
  --info:    #0369A1; --info-foreground:    #FFFFFF; --info-subtle:    #F0F9FF;  /* AA white text */

  --radius: 8px;
}
```

**Neutral ramp (slate):** 50 `#F8FAFC` · 100 `#F1F5F9` · 200 `#E2E8F0` · 300 `#CBD5E1` · 400 `#94A3B8` · 500 `#64748B` · 600 `#475569` · 700 `#334155` · 800 `#1E293B` · 900 `#0F172A`.

---

## 4. Status Colours

Tinted background + dark text (all AA on white). Used by `Badge` and the live status surfaces.

| Meaning | States it covers | Background | Text |
|---------|------------------|-----------|------|
| Neutral / in-progress | `uploading`, `in_progress` | `#F1F5F9` | `#475569` |
| Working / review | `processing`, `pending_review` | `#FEF3C7` | `#92400E` |
| Success / done | `ready`, `confirmed` | `#D1FAE5` | `#065F46` |
| Error / rejected | `failed`, `rejected` | `#FEE2E2` | `#991B1B` |

---

## 5. Typography

- **Family:** Inter (UI, all weights). `ui-monospace`/JetBrains Mono for certificate codes and IDs.
- **Weights:** 400 body · 500 labels/UI · 600 headings · 700 display.

| Token | Size | Line height | Use |
|-------|------|-------------|-----|
| display | 36 / 2.25rem | 40 | Page hero (rare) |
| h1 | 30 / 1.875rem | 36 | Page title |
| h2 | 24 / 1.5rem | 32 | Section |
| h3 | 20 / 1.25rem | 28 | Card/subsection |
| lg | 18 | 28 | Lead text |
| base | 16 | 24 | Body (default) |
| sm | 14 | 20 | Secondary, table cells |
| xs | 12 | 16 | Captions, meta |

---

## 6. Spacing, Radius, Shadow, Motion

**Spacing** (4px base): 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Card padding 24; compact rows 12–16; section gaps 32.

**Radius:** sm 6 · **md 8 (default — buttons, inputs, cards)** · lg 12 (modals, large cards) · xl 16 · full 9999 (avatars, pills, progress).

**Shadow (restrained):**

| Token | Value | Use |
|-------|-------|-----|
| xs | `0 1px 2px rgba(15,23,42,.05)` | Buttons, inputs |
| sm | `0 1px 3px rgba(15,23,42,.08)` | Cards |
| md | `0 4px 12px rgba(15,23,42,.10)` | Dropdowns, popovers |
| lg | `0 12px 32px rgba(15,23,42,.14)` | Modals |

**Motion:** fast 120ms (hover/press) · base 180ms (most) · slow 240ms (overlays). Easing `cubic-bezier(0.2, 0, 0, 1)`. Respect `prefers-reduced-motion`.

**Z-index:** dropdown 1000 · sticky 1100 · overlay 1200 · modal 1300 · toast 1400.

**Breakpoints:** sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536.

---

## 7. Core Components

Documented per the design-system format: variants · states · accessibility. All states include `:focus-visible` with a 2px `--ring` outline at 2px offset.

### Button
| Variant | Use | Visual |
|---------|-----|--------|
| primary | Main action | `--primary` bg, `--primary-foreground` text |
| secondary | Supporting | `--secondary` bg, border |
| outline | Low emphasis | transparent, `--border`, text `--foreground` |
| ghost | Toolbars/icon | transparent, hover `--accent` |
| destructive | Delete/revoke | `--danger` bg |
| link | Inline | text `--primary`, underline on hover |

Sizes sm (32h) · md (40h) · lg (44h). States: hover (`--primary-hover`), active (`--primary-active`), disabled (50% + not-allowed), loading (spinner + label, disabled). A11y: real `<button>`, Space/Enter, `aria-busy` when loading.

### Input / TextField · Select · Textarea
40h, `--input` border, radius md, `--muted-foreground` placeholder. States: focus (ring), error (`--danger` border + helper text + `aria-invalid`), disabled (`--muted`). Always paired with a `<label>`; helper/error text `sm`. Select = Radix listbox; full keyboard.

### Checkbox · Switch · Radio
Radix primitives. Checked uses `--primary`. 2px focus ring. Hit target ≥ 24px; label clickable.

### Card
`--card` bg, `--border`, radius lg, shadow sm, padding 24. Slots: header (title h3 + actions), body, footer. Used for dashboard tiles, course cards, settings.

### Badge / StatusBadge
Pill (radius full), `xs`/`sm`, 500 weight. StatusBadge maps the §4 table; pairs an icon with the label (never colour alone). Live-updates via Realtime in the video library.

### Table / DataTable
`sm` text, 12–16 row padding, hairline row borders, sticky header `--surface`. Sortable headers, row hover `--muted`, selection, pagination. Refine-driven in the admin console. Empty + loading states required.

### Tabs · Breadcrumbs
Tabs: underline-active (`--primary`), `sm`. Breadcrumbs for course builder depth. Roving-tabindex keyboard.

### Dialog / Modal · Sheet/Drawer
Radix Dialog. Overlay `rgba(15,23,42,.45)`, panel `--popover`, radius lg, shadow lg, focus trap, Esc to close, return focus on close. Drawer (right) for StudentProgress. Confirm dialogs for revoke/reject/confirm-completion.

### Toast
Bottom-right, `--popover`, left status accent bar, auto-dismiss 5s, pause on hover, `aria-live=polite` (assertive for errors). Used for upload done, cert issued, errors.

### AppShell / SidebarNav
Fixed left sidebar (collapsible), org logo + switcher at top, role-aware items, active = `--primary` text + `--muted` pill. Topbar: breadcrumb + user menu. Student area uses a lighter top nav, no dense sidebar.

### Avatar · Tooltip · DropdownMenu
Avatar: initials fallback, radius full. Tooltip: `--foreground` bg, white text, `xs`, 300ms delay. Menus = Radix, full keyboard.

### ProgressRing / ProgressBar
Ring for course cards (percent complete), bar for lesson/upload. Track `--muted`, fill `--primary`. Announce `role=progressbar` + `aria-valuenow`.

### FileDropzone (VideoUploader / ResourceUploader)
Dashed `--border`, drag-over `--primary` border + `--muted` bg. Per-file rows with progress, pause/resume/retry (Uppy multipart, RFC-001). Shows transcode status after upload.

### VideoPlayer (chrome)
hls.js + Vidstack. Controls: play/pause, scrub, volume, speed, captions toggle, quality, fullscreen. Resume toast ("Resume from 12:30"). Full keyboard (Space, ←/→, F, M, C). Captions styled for legibility; player accent = `--primary`.

### EmptyState · Skeleton
EmptyState: icon, one-line explanation, primary action (e.g. "Upload your first video"). Skeleton: `--muted` blocks, subtle shimmer (respect reduced-motion); used for tables, cards, player while loading.

---

## 8. Patterns

- **Forms:** label above field, helper below, inline validation on blur + on submit, primary action right-aligned, destructive separated. Course builder autosaves drafts (optimistic, Refine).
- **Navigation:** admin = sidebar + breadcrumbs; student = top nav + course sidebar; public = minimal centered.
- **Data display:** lists/tables for rosters + libraries; cards for courses; drawer for detail without losing context.
- **Feedback:** toasts for async results, inline for validation, confirm dialogs for irreversible/external actions (revoke, reject, issue cert), skeletons for loads.

---

## 9. Accessibility Baseline

- AA contrast (4.5:1 text / 3:1 large + UI). Per-org `--primary-foreground` auto-picked for AA.
- Visible `:focus-visible` everywhere; logical tab order; focus trap + restore in overlays.
- Player: captions support (WebVTT), keyboard controls, transcript where available.
- Status conveyed by icon + text, not colour alone.
- Hit targets ≥ 24px (≥ 44px on touch for primary actions).
- Respect `prefers-reduced-motion`.

---

## 10. Per-Surface Notes

- **Admin console (Refine):** information-dense, tables + drawers, sidebar nav, keyboard-friendly. Efficiency over flourish.
- **Student area (custom):** calm, generous spacing, video-hero player, progress rings, minimal chrome. Mobile-first — the player must shine on a phone.
- **Public (login / verify):** centered, minimal, trustworthy. Verify page leads with a clear valid/invalid/revoked state.

---

## 11. Certificate Template

The certificate is a print-grade artefact rendered server-side with `@react-pdf/renderer` (RFC-003). Verification is the source of truth; the PDF is the keepsake.

**Format & layout**
- **A4 landscape**, 297 × 210 mm, 16mm margins. PDF/A-friendly, embedded fonts.
- A thin **accent border/rule** in the org's `--primary` frames the page; otherwise white, generous whitespace (matches the system).

**Content blocks (top → bottom)**
1. **Org logo** (top-left) + studio name (`orgNameSnapshot`).
2. **Eyebrow:** "Certificate of Completion" / "Sertifikat Kelulusan" (locale).
3. **Recipient:** `studentNameSnapshot`, large (display, 600), accent underline.
4. **Course line:** "has successfully completed" + `courseTitleSnapshot` (h2).
5. **Date:** `issuedAt`, locale-formatted ("16 Juni 2026").
6. **Footer row:**
   - Left: optional **owner signature** image + name/role line (Phase 2 if no asset).
   - Right: **QR code** → `…/verify/{code}` and the **code** in monospace ("Verify: CP-7F3K-9Q2M").

**Type**
- Recipient name: Inter 600, ~40pt. Headings 600. Body 400. Code: monospace.
- Accent colour used only for the frame, the name underline, and the eyebrow — restrained.

**Rules**
- Everything comes from **snapshots** (DH) — never live joins — so an issued cert is immutable.
- Localised strings via the org `locale`; names/titles printed as stored.
- Revoked certs aren't reprinted; the verify page carries revocation truth.

**Tokens used:** `--primary` (frame, underline, eyebrow), `--foreground` (text), `--muted-foreground` (meta), Inter + mono, radius/spacing per system.
