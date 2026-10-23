# PrestasiPlus Rebuild — Software Requirements Specification (SRS)

Structured in the spirit of IEEE 29148, trimmed to what a front-end-prototype project needs.

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — Master |
| Version | 0.1 |
| Date | 2026-09-25 |
| Status | Draft |
| Author | product-analyst (agent) |
| Owner | Project owner (owner@example.test) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-25 | Initial master SRS: product perspective, global FR/NFR, data/interface conventions, module index, ID convention, module template, traceability convention. Includes global responsive-design NFR (NFR-RESP) per explicit stakeholder request. |

## 1. Purpose

This document specifies **how the system must behave** to satisfy the URS (`docs/requirements/URS.md`), at a level precise enough to design and test against, for a front-end prototype backed by a mock data/service layer. It is the master index and shared reference for 26 per-module SRS files (`docs/requirements/srs/Mxx-<slug>.md`).

## 2. Scope

Same scope as URS §2 (see `docs/requirements/URS.md`): a Vue 3 + Vite + Tailwind + Lucide front-end prototype of all 26 modules, dummy data, Playwright E2E tests, no real backend (decisions D1–D5). This SRS additionally documents inferred server-side behaviour (validation rules, business rules, permissions) per D5, so it can seed the later backend phase, even though nothing here is actually implemented server-side yet.

## 3. Definitions

See `docs/requirements/URS.md` §8 (Glossary) for domain terms (SPM, PKSK, Darjah, Tingkatan, etc.). Technical terms used in this SRS:

| Term | Meaning |
|---|---|
| Mock service layer | A JS/TS module (or set of modules) in the FE codebase that returns Promise-based, REST-shaped responses from in-memory/fixture dummy data, standing in for a future real API. |
| Envelope | The standard wrapper object returned by every mock "list" endpoint (see §7.2). |
| FR / NFR / DATA | Functional requirement / non-functional requirement / data-entity requirement (see ID convention, §9). |
| E2E scenario | A Playwright test case exercising a user-visible flow end to end against the prototype. |

## 4. Overall description

### 4.1 Product perspective

The product is a **front-end prototype**: a Vue 3 SPA (Vite build, Tailwind CSS styling, Lucide icons) that reproduces every screen and flow of `prestasiplus.my` (minus its public landing page) using dummy data, with no live backend. It talks only to a **mock service layer** inside the same codebase, shaped like a future REST API (resource paths, list envelopes, error format — see §7) so that a real backend can later be substituted behind the same interface without UI rework (decision D2). AI features and payments are simulated with canned/fake responses (decision D4); no external network services are called at runtime.

### 4.2 User classes

See `docs/requirements/URS.md` §6 for the full role table (Admin, Student, Teacher, Parent, PPD, JPN, Duta, Seller, Sponsor, Tuition centre) and its verification status.

### 4.3 Operating environment

| Aspect | Requirement |
|---|---|
| Browsers | Latest two versions of Chrome, Edge, Safari, and Firefox (desktop and mobile). |
| Devices | Phones, tablets, and desktop/laptop screens — see NFR-RESP (§6.2) for concrete breakpoints. |
| Rendering | Client-side SPA; no SSR requirement for the prototype. |
| Connectivity | Assume typical school/home broadband or 4G mobile; no offline-mode requirement in this phase. |
| Locale | `ms-MY`; timezone `Asia/Kuala_Lumpur` (see §7.4). |

### 4.4 Design constraints

| Constraint | Detail |
|---|---|
| Stack | Vue 3 + Vite + Tailwind CSS + Lucide icons (fixed by project decision, not open for this SRS to change). |
| UI language | Bahasa Melayu throughout (per UR-G-01). |
| Data | Dummy/fixture data only; no PII from the real production system may be copied in (per discovery rules in `docs/TRACKER.md` §6). |
| External services | None — AI and payments are simulated (D4); no real analytics/tracking, no real email/SMS sending. Exception (D22, 2026-10-02): media is taken from the source, so video thumbnails and players load from the real hosts (`img.youtube.com`, `www.youtube.com`, `player.vimeo.com`, `www.dailymotion.com`; M09 NFR-M09-06) and need network access. |
| Backend | None in this phase; all "server" behaviour is the mock service layer (D2). |

### 4.5 Assumptions and dependencies

- Discovery was performed with a **single admin account**, which sees every menu. Per-role behaviour for all other roles (what they can/cannot see or do) is **inferred**, not observed, and is marked as such throughout module SRS files until verified.
- The live site's exact validation rules, error copy, and business logic are only as accurate as what discovery could observe (read-only walkthrough — no destructive/save actions taken). Where discovery could not observe a rule, this SRS marks it "(inferred)" and proposes a reasonable default.
- Question bank scale (~128,989 questions, 31 subjects, 11 levels) informs dummy-data volume expectations (module SRS files should generate representative, not exhaustive, fixture sets) and pagination/performance requirements (§6.1).

## 5. Global functional requirements (FR-G)

| ID | Requirement |
|---|---|
| FR-G-01 | The app SHALL maintain a mock authenticated session (token/flag in browser storage) after login and restore it on reload, until logout or expiry. |
| FR-G-02 | The app SHALL route each authenticated user to a role-appropriate landing page after login (e.g. admin → `/admin`, others → `/dashboard`), per the pattern observed in M01. |
| FR-G-03 | The app SHALL render two layout shells: an **admin panel shell** (sidebar + header, used by `/admin/*`, `/guru/*`, `/ppd/*`, `/jpn/*`) and a **user portal shell** (top nav, used by student-facing routes), consistent across all modules that use them. |
| FR-G-04 | The app SHALL show role-appropriate navigation only (menus/links for modules or actions the current role cannot access SHALL be hidden, not just disabled), per UR-G-04. |
| FR-G-05 | The app SHALL provide a persistent notification bell in the header, showing unread count and a dropdown/list of recent notifications, sourced from the mock notifications endpoint (shared by M01 and M22). |
| FR-G-06 | The app SHALL provide a global or per-section search input on list/table screens where discovery observed one, filtering the mock-data list client-side or via the mock service layer. |
| FR-G-07 | Every list/table screen SHALL support pagination, using the envelope in §7.2, with a consistent page-size control and page navigation UI. |
| FR-G-08 | Every list/table screen with more than one plausible sort/filter dimension SHALL expose filter controls and column sorting, preserving filter/sort state in the URL query string where practical. |
| FR-G-09 | Every form SHALL validate input client-side before submit and display field-level error messages in Bahasa Melayu directly beneath the offending field, per UR-G-07. |
| FR-G-10 | Every data-fetching view SHALL render a distinct **loading state** (skeleton/spinner), **empty state** (friendly BM message + relevant call-to-action where applicable), and **error state** (BM message + retry action) instead of a blank screen, per UR-G-06. |
| FR-G-11 | Logout SHALL be reachable from every authenticated screen (header/sidebar user menu) and SHALL clear the mock session and redirect to `/login`. |
| FR-G-12 | The mock service layer SHALL expose every module's data through REST-shaped resource endpoints per §7, regardless of module, so all modules are consistent for a future backend swap. |

## 6. Global non-functional requirements (NFR)

### 6.1 Performance, usability, accessibility, security, compliance, browser support, maintainability

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Initial route SHALL render interactive content within ~2s on a typical broadband connection in dev/preview builds; list views with large dummy datasets (e.g. question bank) SHALL paginate rather than render all rows at once. |
| NFR-02 | Accessibility | **Replicate live accessibility behaviour (D7/D10).** Labels, `aria-*`, alt text, focus behaviour, keyboard operability and motion handling (incl. `prefers-reduced-motion`) SHALL match the live site — no enhancements beyond it. Only defects that are "broken" under D9 are fixed: unreadable text (low contrast, text < 12px), controls unusable on touch, layout/responsive breakage. WCAG 2.2 AA is a reference for judging "unreadable", not a compliance target for the prototype. |
| NFR-03 | Usability | Interaction patterns (search/filter/sort/pagination, form validation, loading/empty/error states) SHALL be consistent across all 26 modules per FR-G-06..FR-G-10. |
| NFR-04 | Security (future backend) | Although not implemented in the prototype, SRS-documented business rules SHALL note where real authorization/input-validation/rate-limiting will be required server-side, so the backend phase has a checklist. |
| NFR-05 | PDPA / privacy | No real personal data (names, IC numbers, contact details) from the live system SHALL appear in dummy data, docs, or screenshots; dummy data SHALL use clearly fictitious Malaysian-style names/IC formats. Any future real backend handling personal data must comply with Malaysia's Personal Data Protection Act 2010. |
| NFR-06 | Browser support | See §4.3 (latest two versions of major browsers, desktop and mobile). |
| NFR-07 | Maintainability | Mock service layer functions SHALL be organised one module per resource (mirroring §7.1 naming), so a future backend integration can replace them file-by-file. |
| NFR-08 | Localisation | Dates, numbers, and currency SHALL be formatted per `ms-MY` / `Asia/Kuala_Lumpur` conventions (§7.4) even though all copy is static BM text (no i18n framework required for this phase). |

### 6.2 NFR-RESP — Responsive design (all devices)

Added per explicit stakeholder requirement: the UI must be responsive across phone, tablet, and desktop, with students mostly on phones. This is a **global, testable** NFR — every module SRS's "Responsive behaviour" section (see template, §10) must confirm it holds for that module's screens, and every module's E2E suite must verify it (§8).

| ID | Requirement |
|---|---|
| NFR-RESP-01 | The app SHALL render correctly, with no horizontal page scroll, at all viewport widths from **320px to 1920px+**. |
| NFR-RESP-02 | Layout SHALL use Tailwind's default breakpoints as the responsive contract: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. Module SRS files SHOULD state, per screen, which breakpoint(s) change the layout. |
| NFR-RESP-03 | All interactive elements (buttons, links, form controls, icon-only actions) SHALL have a touch target of at least **44×44px** on touch/mobile viewports. |
| NFR-RESP-04 | In the admin panel shell (FR-G-03), the sidebar SHALL collapse to an **off-canvas drawer** (toggled by a header control) below the `lg` (1024px) breakpoint, and SHALL render as a persistent/inline sidebar at `lg` and above. |
| NFR-RESP-05 | Data tables SHALL either (a) switch to a stacked **card layout** per row, or (b) remain a table that **scrolls horizontally within its own container** (not the page) below `md` (768px) — module SRS chooses (a) or (b) per screen and states which. |
| NFR-RESP-06 | Forms SHALL lay out in a **single column** below `md` (768px); multi-column form layout is permitted only at `md` and above. |
| NFR-RESP-07 | Modals/dialogs SHALL render **full-screen** (or full-width, edge-to-edge) below `md` (768px), and as a centered, bounded-width dialog at `md` and above. |
| NFR-RESP-08 | Body text SHALL be legible without pinch-zoom: minimum **16px** base font size on mobile viewports (no viewport meta trick that disables zoom). |
| NFR-RESP-09 | Layouts SHALL support both **portrait and landscape** orientation on phone/tablet viewports without breaking (no clipped content, no inaccessible controls). |
| NFR-RESP-10 | These rules apply to every screen in every module (M01–M26) with **no exemptions** (decision D6). Data-dense screens (analytics, heat maps, executive reports) must adapt: KPI cards stack, charts resize or scroll inside their own container, wide tables scroll horizontally inside their container, and secondary panels collapse into tabs or accordions. |

## 7. Data & interface conventions (mock API)

These conventions apply to every module's mock service layer so the whole app is consistent and a real backend can later implement the same contract.

### 7.1 Resource naming

- Base path per module resource: `/api/<resource-plural>` (kebab-case), e.g. `/api/questions`, `/api/schools`, `/api/gamification-challenges`.
- Nested/sub-resources: `/api/<resource>/:id/<sub-resource>`, e.g. `/api/classes/:id/students`.
- Actions that aren't pure CRUD use a verb suffix sparingly: `/api/users/:id/reset-password`.

### 7.2 List response envelope

```json
{
  "data": [ /* array of resource objects */ ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 128989,
    "totalPages": 6450
  }
}
```

Single-resource (get/create/update) responses return the object directly under `data`: `{ "data": { ...resource } }`.

### 7.3 Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Sila lengkapkan semua medan wajib.",
    "fields": {
      "email": "Format e-mel tidak sah."
    }
  }
}
```

`message` is always BM copy suitable for direct display (per FR-G-09/FR-G-10). `code` is a stable machine-readable string (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `SERVER_ERROR`) for future backend parity.

### 7.4 Date/time/locale/IDs

| Convention | Value |
|---|---|
| Timezone | `Asia/Kuala_Lumpur` (UTC+8) for all displayed dates/times. |
| Locale formatting | `ms-MY` (e.g. `25 September 2026`, `RM49.90` — no space, as observed live "RM3,000.00", M02 BR-33). |
| Date storage (mock fixtures) | ISO 8601 (`2026-09-25T09:00:00+08:00`). |
| IDs | String UUIDs for mock resources (`"a3f1..."`) by default. **Exception (fidelity, D7):** where the live site exposes a numeric id to users — in URLs (`/topics/{id}`, `/admin/questions/{id}`) or on screen (`#564159`) — the resource keeps a numeric `id` matching the live format, and seed data keeps the live ids where known (e.g. M03 curriculum, M04 questions). Human-facing codes (IC numbers, school codes) remain separate fields. |

## 8. Module index

| ID | Module | Phase | Portal | SRS file |
|---|---|---|---|---|
| M01 | Authentication & Account | A | Public / All | [srs/M01-authentication.md](srs/M01-authentication.md) |
| M02 | Users & Schools Management | A | Admin | [srs/M02-users-schools.md](srs/M02-users-schools.md) |
| M03 | Curriculum (Subjects, Levels, Topics) | A | Admin / Student | [srs/M03-curriculum.md](srs/M03-curriculum.md) |
| M04 | Question Bank | A | Admin / Student | [srs/M04-question-bank.md](srs/M04-question-bank.md) |
| M05 | Practice & Drills (Latih Tubi) | B | Student | [srs/M05-practice.md](srs/M05-practice.md) |
| M06 | SPM | B | Admin / Student | [srs/M06-spm.md](srs/M06-spm.md) |
| M07 | Premium PKSK | B | Admin / Student | [srs/M07-pksk.md](srs/M07-pksk.md) |
| M08 | Student Performance & Analytics | B | Student | [srs/M08-student-performance.md](srs/M08-student-performance.md) |
| M09 | Content (Articles, Notes, Video, Audio) | B | Admin / All | [srs/M09-content.md](srs/M09-content.md) |
| M10 | Teacher Portal — Class & Teaching | C | Teacher | [srs/M10-teacher-class.md](srs/M10-teacher-class.md) |
| M11 | Teacher Portal — Analytics & Reports | C | Teacher | [srs/M11-teacher-analytics.md](srs/M11-teacher-analytics.md) |
| M12 | Kirkpatrick Evaluation | C | Admin / Teacher | [srs/M12-kirkpatrick.md](srs/M12-kirkpatrick.md) |
| M13 | Cikgu Alesa (AI Teacher Assistant) | C | Teacher / Student | [srs/M13-cikgu-alesa.md](srs/M13-cikgu-alesa.md) |
| M14 | Gamification (Coins, Tokens, Challenges) | D | Admin / Student / Teacher | [srs/M14-gamification.md](srs/M14-gamification.md) |
| M15 | Rewards Shop & Redemption | D | Admin / Student / Teacher | [srs/M15-rewards-shop.md](srs/M15-rewards-shop.md) |
| M16 | Battle, Games & Competitions | D | Admin / Student | [srs/M16-battle-games.md](srs/M16-battle-games.md) |
| M17 | Admin Dashboard & Analytics | E | Admin | [srs/M17-admin-dashboard.md](srs/M17-admin-dashboard.md) |
| M18 | PPD & JPN (District/State) | E | PPD / JPN | [srs/M18-ppd-jpn.md](srs/M18-ppd-jpn.md) |
| M19 | Finance & Subscriptions | E | Admin / All | [srs/M19-finance.md](srs/M19-finance.md) |
| M20 | Marketplace | E | Admin / Seller / Student | [srs/M20-marketplace.md](srs/M20-marketplace.md) |
| M21 | Sponsorship & Anak Angkat | E | Admin / Public | [srs/M21-sponsorship.md](srs/M21-sponsorship.md) |
| M22 | Notifications & Support | E | Admin / All | [srs/M22-notifications-support.md](srs/M22-notifications-support.md) |
| M23 | System Administration | E | Admin | [srs/M23-system-admin.md](srs/M23-system-admin.md) |
| M24 | Ambassador Programme (Duta) | F | Admin / Duta | [srs/M24-duta.md](srs/M24-duta.md) |
| M25 | AI Centre (Pusat AI) | F | All | [srs/M25-ai-centre.md](srs/M25-ai-centre.md) |
| M26 | Vision & Special Features | F | All | [srs/M26-special-features.md](srs/M26-special-features.md) |

## 9. Requirement ID convention

| Scope | Pattern | Example |
|---|---|---|
| Global functional requirement (this document) | `FR-G-nn` | `FR-G-05` |
| Global non-functional requirement (this document) | `NFR-nn` or `NFR-RESP-nn` | `NFR-RESP-04` |
| Module functional requirement | `FR-Mxx-nn` | `FR-M05-07` |
| Module non-functional requirement | `NFR-Mxx-nn` | `NFR-M04-02` |
| Module data entity requirement | `DATA-Mxx-nn` | `DATA-M04-01` |
| E2E scenario | `E2E-Mxx-nn` | `E2E-M05-03` |

IDs are stable once assigned — append, never renumber, to keep traceability links (§11) intact.

## 10. Template for a module SRS file

Every `docs/requirements/srs/Mxx-<slug>.md` uses this structure:

```markdown
# M<nn> — <Module Name> — Software Requirements Specification

## 0. Document control
Version, date, status, source URS file link.

## 1. Scope
What this module's mock implementation covers; explicit out-of-scope items.

## 2. Screens & routes
Table: route | screen name | primary actor(s) | notes.
Sourced from docs/TRACKER.md §4 and docs/discovery/Mxx-*.md.

## 3. Functional requirements
FR-Mxx-nn, each row traced to the UR-Mxx-nn / US-Mxx-nn it implements
(see traceability convention, §11).

## 4. Business rules
Numbered rules governing data/behaviour (e.g. "a question cannot be
published without a correct answer"), marked (observed) or (inferred).

## 5. Validation rules
Per form/field: rule, error message (exact BM copy), trigger (on blur /
on submit).

## 6. Data entities & fields
Table per entity: field | type | required | notes. One entity may be
reused across modules — reference the owning module (e.g. "see M04
Question entity") instead of redefining it.

## 7. Mock API endpoints
Table: method | path | request shape | response shape (using the
envelope/error conventions in SRS.md §7). Mark which endpoints are
read-only vs. mutating for the prototype.

## 8. States & messages
Exact BM copy for loading / empty / error / success states and key
confirmation dialogs, per screen.

## 9. Permissions matrix
Table: role | can view | can create | can edit | can delete | notes,
one row per actor from the module's URS Actors section. Mark inferred
cells.

## 10. Responsive behaviour
Per screen (or screen group): what changes at each Tailwind breakpoint
(sm/md/lg/xl/2xl) per NFR-RESP-01..10 in SRS.md §6.2 — e.g. "sidebar
becomes drawer below lg", "table becomes cards below md", "modal is
full-screen below md". No screen is exempt (NFR-RESP-10).

## 11. Non-functional requirements
NFR-Mxx-nn — module-specific additions to the global NFRs (e.g. a
question-bank list needing virtualised rendering for 128,989 rows).

## 12. E2E test scenarios
E2E-Mxx-nn, each traced to the FR(s) it verifies. Each scenario SHALL
run on three Playwright projects: **mobile** (375×812), **tablet**
(768×1024), **desktop** (1280×800) — per NFR-RESP. No desktop-only
scenarios.

## 13. Open questions
Numbered list, "(inferred)" tags carried from the module's URS plus any
new ones found while writing functional detail.
```

## 11. Traceability convention

- Every `FR-Mxx-nn` SHALL cite at least one `UR-Mxx-nn` or `US-Mxx-nn` it implements (module URS, per `docs/requirements/URS.md` §9 ID convention).
- Every `NFR-Mxx-nn` SHOULD cite the global `NFR-nn`/`NFR-RESP-nn` it specialises, if any.
- Every `E2E-Mxx-nn` SHALL cite the `FR-Mxx-nn`(s) it verifies, and SHALL declare which of the three Playwright projects (mobile/tablet/desktop, §10) it runs on — default is all three.
- Module SRS files SHOULD include a small traceability table (`UR/US → FR → E2E`) at the end of §3 or as an appendix once the module is far enough along; not required for the initial draft pass.
- Any requirement that cannot be traced back to a URS item, or forward to at least one E2E scenario, is flagged in that module's Open Questions (§13 of the template) rather than silently dropped.

## 12. Open questions (master-level)

Same as `docs/requirements/URS.md` §11 (UQ1–UQ3), plus:

| # | Question | Status |
|---|---|---|
| SQ1 | Confirm whether any admin screens are legitimately desktop-only (dense reports, e.g. `/admin/analytics`, PPD/JPN heat maps) and should be formally exempted from NFR-RESP in their module SRS, vs. adapted with card/scroll patterns like everything else. | Closed — no exemptions; every screen adapts (user requirement "responsive across devices", D6, NFR-RESP-10) |
