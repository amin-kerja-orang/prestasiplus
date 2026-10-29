# L45 — Jemput Ibu Bapa — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — roles-matrix row L45 "Jemput Ibu Bapa" (feature slug `L45-jemput-ibu-bapa`) |
| Version | 0.4 |
| Date | 2026-10-02 |
| Status | **Draft for G1** (v0.4: as-built update from the L45-T1/T2 builds and G4/code reviews) |
| Author | product-analyst (agent) |
| Source URS | [urs/L45-jemput-ibu-bapa.md](../urs/L45-jemput-ibu-bapa.md) (v0.3: 25 active Functions, 12 stories, 52 ACs, coverage 63/63 elements) |
| Source discovery | [L45-jemput-ibu-bapa.md](../../discovery/L45-jemput-ibu-bapa.md) (PARTIAL, §8 update), screenshots `docs/discovery/img/L45/` |
| Secondary reference (NOT live truth) | `D:\Dev Projects\prestasiplus-reference`: `backend/resources/views/pelajar/jemput-ibu-bapa.blade.php`, `backend/resources/views/ibu-bapa/terima.blade.php`, `StudentExtrasController` (`jemputIbuBapa`, `jemputIbuBapaGenerate`, `terimaJemputan`), `routes/web.php` (lines 1239–1240, 1429). The local `ripped/clone/pelajar-missing/jemput-ibu-bapa.html` was not found; only the blade view was used. |
| Owner modules (user decision D23b) | **M02**: the student screen `/jemput-ibu-bapa`, invite tokens, the parent↔student link (reuses M02 DATA-M02-02 `ParentStudentLink`; no second link store, D12). **M01**: the acceptance page `/ibu-bapa/terima/:token` and the parent login/register hand-off. |

**Change log**

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-02 | First draft. Observed items (403 guard and copy, `POST /jemput-ibu-bapa/generate` exists, `/ibu-bapa/terima/{token}` and its "Link Tidak Sah" copy) are replicated exactly; everything else is PROPOSED from the reference rebuild (user decision D23a). |
| 0.2 | 2026-10-02 | **Audit round 1 fixes** (`docs/qa/audit/L45-audit.md`). AUD-L45-01: live `/ibu-bapa/terima/zzzz` also shows "Link Tidak Sah" (HTTP 404), so the hex-only route rule, the S2-404 row and FR-L45-21 / FN-L45-2.1.2 are withdrawn (IDs kept, not reused); S2 matches any token; AC-L45-08.4 is OBSERVED; E2E-L45-17 asserts the invalid page. AUD-L45-02: student 3 has no school (§6.4, E2E-L45-18 now covers a student with and a student without a school). AUD-L45-03: error code `NOT_FOUND` only. AUD-L45-04: the invalid page is OBSERVED for admin only, INFERRED for guest and parent. AUD-L45-05: AC-08.2 mapped (E2E-L45-07). AUD-L45-07: deviation types clarified in URS §7. Counts: 25 active Functions, 32 active FRs, 24 E2E, 52 ACs. |
| 0.3 | 2026-10-02 | **As-built update (doc-only; L45-T1/T2 builds, G4 reviews; no AC, FR or E2E id added or removed; URS unchanged, no AC needed to change).** §7 #3: the 404 cell now reads "token held by a non-student / inactive student" (a valid token viewed by a non-parent returns 200 `viewer: 'other'`, FR-L45-26, §9). BR-L45-02: the e2e counter is "highest held + 1" (BigInt, 64 hex); hook-set tokens are any non-empty string, lower-cased. §6.1: store row id = `studentId`, repository contract as built, cascade on student delete. §8: INFERRED additions (S2 preview error, S1 hero gradient as-built). §12: E2E-L45-13 POST generate 403 is unit-tested only. §13: XR-L45-01..03 Applied in M02 v1.31; note on session revocation (M01/M02 BR-05/BR-23). §14: real-backend security additions SEC-L45-09..19 and the two D23 accepted risks marked. |
| 0.4 | 2026-10-02 | **L45-T2 code review (doc-only).** New DV-L45-06 (§0.1, URS v0.3 §7): S1 hero gradient and WhatsApp button darkened for contrast; FR-L45-05, FR-L45-09 and the v0.3 S1 hero as-built note updated. §8 S2 table confirmed to list the preview server-error state. §13: follow-up for the designer on the duplicated WhatsAppIcon (XR-L45-10). |

**Tags** (same vocabulary as M01):
- **OBSERVED**: seen on the live site (admin session, GET only).
- **PROPOSED (reference rebuild) — Perlu pengesahan**: taken from the reference rebuild, never seen on live. Specified as the behaviour to build (D23a); to be verified when a murid account exists.
- **INFERRED**: not seen and not in the reference; the most likely behaviour (Laravel default or an app convention), stated as an assumption.
- **DV-L45-nn**: fidelity deviation (URS §7).

### 0.1 Fidelity deviations referenced here (D9; full table in URS §7)

- DV-L45-01 guest register note replaces the "school provides accounts" note (FR-L45-25);
- DV-L45-02 no relationship chip on linked parents (FR-L45-15);
- DV-L45-03 WhatsApp click does not navigate in the prototype (FR-L45-09);
- DV-L45-04 "Salin" label changes only after a successful clipboard write (FR-L45-08);
- DV-L45-05 preview (GET) and accept (POST) are split (FR-L45-27);
- DV-L45-06 (v0.4, unreadable text, Delivery Lead) S1 hero gradient darkened from the reference rose-500 to pink-500 to **rose-600 to pink-600**, and the WhatsApp button from emerald-500 to **emerald-600**, because white text on the 500 shades has low contrast. Deviates from the PROPOSED reference, not from live (live unobserved, D23).

---

## 1. Scope

**In scope**
- S1 `/jemput-ibu-bapa`: the student's invite screen (invite link, copy, WhatsApp hand-off, regenerate, connected parents list).
- S2 `/ibu-bapa/terima/:token`: the invite acceptance landing (invalid link, guest, logged-in non-parent, logged-in parent).
- The `ParentInvite` store and the creation of `ParentStudentLink` rows from an accepted invite.
- Mock endpoints (§7), seeds (§6.4), states and messages (§8), E2E scenarios (§12).

**Out of scope** (URS §8): the parent portal (`/ibu-bapa/dashboard`, a guarded live route, not specified here), the parent's view of a child's progress beyond the link target `/pelajar/{id}` (M08), admin linking UI (M02 S2/S3, unchanged), real WhatsApp delivery, real email, the shell nav item itself (already built; see FR-L45-31), backend concerns (§14).

## 2. Screens & routes

| # | Route | Screen | Actor | Access | Layout | Tab title |
|---|---|---|---|---|---|---|
| S1 | `/jemput-ibu-bapa` | Jemput Ibu Bapa | Pelajar | `auth`, `roles: ['student']`, `onForbidden: '403'` (OBSERVED: guest → `/login`; admin → 403) | User shell | "Jemput Ibu Bapa - PRESTASIPLUS" (PROPOSED; follows the app's "X - PRESTASIPLUS" convention, the reference title is "Jemput Ibu Bapa") |
| S1-403 | `/jemput-ibu-bapa` (non-student) | Global 403 page "Akses Ditolak", rendered in place, URL unchanged | Any logged-in non-student | as above | Standalone error page (existing, F-21) | "403 - Akses Ditolak \| PRESTASIPLUS" (OBSERVED) |
| S2 | `/ibu-bapa/terima/:token` | Terima Jemputan (acceptance landing) | Guest, parent, any other role | Public (guest-reachable); no `roles`; no auth guard (OBSERVED: renders for admin; guest and parent INFERRED; the live robots.txt disallows `/ibu-bapa/`) | Standalone (no shell) | Valid: "Jemputan Ibu Bapa — PRESTASIPLUS" (PROPOSED). Invalid: "Link Tidak Sah — PRESTASIPLUS" (OBSERVED; note the em dash, unlike the app's hyphen convention) |
| — | `POST /jemput-ibu-bapa/generate` | Action (not a screen); live route exists (405 on GET, OBSERVED); the prototype calls mock endpoint #2 | Pelajar | — | — | — |

Router rule (OBSERVED, AUD-L45-01): S2 matches **any** `:token` string, with no hex-only constraint. Live `0000`, a 64-zero token and `zzzz` all show "Link Tidak Sah" (HTTP 404 there; in the SPA the URL stays and the page renders). The reference route constraint `[A-Fa-f0-9]+` is superseded by live.

## 3. Functional requirements

| ID | Requirement | FN | US | Tag |
|---|---|---|---|---|
| FR-L45-01 | A guest opening S1 SHALL be redirected to `/login` with no message and no `redirect` parameter (M01 FR-M01-14, BR-08). | 1.1.1 | 06 | OBSERVED |
| FR-L45-02 | A logged-in user whose role is not `student` (admin observed; teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer by extension) opening S1 SHALL see the existing global 403 page in place. Its copy is OBSERVED and must not be redefined here: "403", "🚫", H1 "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", links "Halaman Utama" → `/`, "Log Masuk" → `/login`, footer "PRESTASIPLUS"; tab title "403 - Akses Ditolak \| PRESTASIPLUS". (Checked: `src/pages/ForbiddenPage.vue` and `src/app/router/outcome.ts` already match this copy exactly. No cross-module item.) | 1.1.2 | 06 | OBSERVED (admin) / INFERRED (other roles) |
| FR-L45-03 | S1 SHALL set the tab title "Jemput Ibu Bapa - PRESTASIPLUS". | 1.1.3 | 01 | PROPOSED |
| FR-L45-04 | S1 SHALL render in the user shell with header title "Jemput Ibu Bapa" and subtitle "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda". | 1.2.1 | 01 | PROPOSED |
| FR-L45-05 | S1 SHALL show a hero card (rose-600→pink-600 gradient, white text; DV-L45-06) with a users icon tile, H1 "Jemput Ibu Bapa 👨‍👩‍👧" and the text "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda". The emoji is plain text (no image asset, D22). | 1.2.2 | 01 | PROPOSED |
| FR-L45-06 | S1 SHALL show the card "Link Jemputan" (link icon + H2) with the intro "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej." | 1.3.1 | 01 | PROPOSED |
| FR-L45-07 | The card SHALL contain a read-only text field (monospace, small) whose value is the invite URL `{app origin}/ibu-bapa/terima/{token}` (token = the student's current token, FR-L45-13). | 1.3.2 | 01 | PROPOSED |
| FR-L45-08 | "Salin" (copy icon; primary indigo button) SHALL select the field text and write the URL to the clipboard. On success the button SHALL read "Disalin!" (check icon, emerald background) for 2 seconds and then revert to "Salin" (indigo). If the clipboard API is unavailable or rejects, the text stays selected, the label does not change and no error is shown (INFERRED: the reference changes the label even on failure; D9 "unusable control" → fixed minimally, DV-L45-04). | 1.3.3 | 02 | PROPOSED / INFERRED (failure) |
| FR-L45-09 | "Hantar via WhatsApp" (WhatsApp brand icon, emerald-600 button, flex-1; DV-L45-06) SHALL be an anchor with `href` = `https://wa.me/?text=` + `encodeURIComponent("Salam ibu/bapa! Klik link ini untuk pantau perkembangan saya di PRESTASIPLUS: " + url)`, `target="_blank"`, `rel="noopener noreferrer"`. In the prototype build the click SHALL NOT navigate or open a tab (D14: no external platform screen); it shows no message (no copy is invented). The `href` always reflects the current token. | 1.3.4 | 03 | PROPOSED |
| FR-L45-10 | "Jana Link Baru" (sync icon; slate-100 button) SHALL call `POST /api/me/parent-invite/generate`. While pending the button is disabled (INFERRED, same loading convention as M01 forms). On success the field, the WhatsApp `href` and the stored token update without a page reload, and the success flash "Link jemputan baru telah dijana!" is shown (FR-L45-11). The previous token stops working at once (BR-L45-03). There is no confirmation dialog. | 1.3.5 | 04 | PROPOSED |
| FR-L45-11 | The success flash SHALL be the app's flash outlet in the success style (green-50 background, green-200 border, green-700 semibold text, check-circle icon) above the hero, replaced on the next navigation or the next action. Reference text: "Link jemputan baru telah dijana!". | 1.3.6 | 04 | PROPOSED |
| FR-L45-12 | On `POST generate` failure (`mock.failNext`, 5xx) S1 SHALL clear the loading state, keep the old link and show the red alert "Ralat berlaku. Sila cuba lagi." (UNVERIFIED COPY, shared with M01 §8). | 1.3.5 | 04 | INFERRED |
| FR-L45-13 | Token lifecycle: each student has at most one current token (BR-L45-01). It is created the first time `GET /api/me/parent-invite` is called for that student (lazy, like the reference `inviteToken()`), is stable across visits and sessions, and is replaced only by "Jana Link Baru". | 1.3.7 | 01, 04 | PROPOSED |
| FR-L45-14 | S1 SHALL show the card "Ibu Bapa Dihubungkan" (users icon in pink + H2). | 1.4.1 | 05 | PROPOSED |
| FR-L45-15 | The card SHALL list every `ParentStudentLink` of the student (BR-L45-08), ordered by parent name ascending (case-insensitive, `ms` collation). Each row: a round pink tile with a user icon (an icon, never an image), the parent name (semibold, truncated) and the parent email (small, truncated). No relationship chip (DV-L45-02), no remove or unlink control (BR-L45-09). Rows are separated by a thin divider except after the last. | 1.4.2 | 05 | PROPOSED |
| FR-L45-16 | When the student has no link the card SHALL show, centred: "👨‍👩‍👧" (plain emoji), "Belum ada ibu bapa dihubungkan", and below it "Hantar link jemputan di atas". | 1.4.3 | 05 | PROPOSED |
| FR-L45-17 | S1 data loads with one call (`GET /api/me/parent-invite`). While loading it SHALL show the same spinner as M01 S9; on error the same alert with "Cuba lagi" as M01 S9 (M01 SRS v1.15 §8, INFERRED). The invite card and the parents card load together (single call). | 1.4.4 | 05 | INFERRED |
| FR-L45-18 | The list SHALL reflect the current link store on every load: a link created by an accepted invite, created or removed by an M02 admin (S2/S3 "Pautkan Anak"), appears or disappears at the next load. Admin edits and invite acceptances write the same store (DATA-M02-02). | 1.4.2 | 05 | PROPOSED |
| FR-L45-19 | S2 for an unknown token SHALL render the standalone "Link Tidak Sah" page. Content, in order: header block (slate-gradient background) with the `link-slash` icon (slate-300), H1 "Link Tidak Sah", subtitle "Link jemputan ini tidak sah atau telah tamat tempoh."; a yellow info box with an info-circle icon and "Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu."; primary pink-red gradient button "Log Masuk" (sign-in icon) → `/login`; outlined button "Laman Utama" (home icon) → `/`; below the card a footer link with a graduation-cap icon "PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia" → `/`. Page background: light pink gradient. Tab title "Link Tidak Sah — PRESTASIPLUS". Same page for every viewer: admin OBSERVED (including non-hex `zzzz`); guest and parent INFERRED (same page expected). (v2: see DV-L45-08) | 2.1.1 | 08 | OBSERVED |
| FR-L45-20 | "Unknown token" means any string (hex or not, any length: `0000`, `zzzz`, 64 zeros) that does not equal the current `ParentInvite.token` of a student who is `role = student` and `isActive = true`: never issued, replaced by "Jana Link Baru", or belonging to an inactive student (BR-L45-02, BR-L45-04). | 2.1.1 | 08 | OBSERVED (rotated/unknown, per copy) / PROPOSED (inactive) |
| FR-L45-21 | **Withdrawn (v0.2, AUD-L45-01).** Live shows "Link Tidak Sah" for a non-hex token too; covered by FR-L45-19/20. ID kept, not reused. | — | — | — |
| FR-L45-22 | S2 for a valid token SHALL render the standalone page: a small back link "PRESTASIPLUS" (arrow-left icon) → `/` above a white card on a light blue→indigo gradient background. The card header (purple gradient) shows: a round initials tile (the first letter of the first two words of the student name, uppercase; "?" if the name is empty; plain text, no image), an eyebrow line, an H1 and, when the student has a school, a school line (school icon + school name). Eyebrow/H1 depend on the state (FR-L45-24, FR-L45-26). | 2.1.3 | 09, 10 | PROPOSED |
| FR-L45-23 | Below the card S2 SHALL show the caption "Pautan jemputan ini dikongsi oleh {nama pelajar} melalui PRESTASIPLUS." (small, grey, centred). | 2.2.3 | 09 | PROPOSED |
| FR-L45-24 | **Guest state** (no session). Eyebrow "Jemputan Ibu Bapa"; H1 "Anda dijemput untuk memantau kemajuan {nama pelajar}". Body: "Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan hubungan."; full-width indigo button "Log Masuk Sebagai Ibu Bapa" (sign-in icon) → `/login`; then the amber info note of FR-L45-25. No link is created. | 2.1.4 | 09 | PROPOSED |
| FR-L45-25 | Amber note in the guest state (info-circle icon, amber-50 box): "Belum mempunyai akaun Ibu Bapa? Daftar akaun Ibu Bapa terlebih dahulu, kemudian buka semula pautan jemputan ini." where "Daftar akaun Ibu Bapa" is a link → `/register`. This replaces the reference note "Belum mempunyai akaun Ibu Bapa? Akaun Ibu Bapa disediakan oleh pihak sekolah. Sila hubungi pihak sekolah anak anda untuk mendapatkan akaun." because the live register form offers "Ibu Bapa" (M01 FR-M01-19), so the reference note contradicts it (DV-L45-01). `/register` ignores query parameters (M01 FR-M01-18): the parent chooses the "Ibu Bapa" card themselves. | 2.1.4 | 09 | PROPOSED (DV-L45-01) |
| FR-L45-26 | **Logged-in non-parent state** (any session whose role is not `parent`, including the student who owns the link and the admin). Eyebrow "Jemputan Ibu Bapa"; H1 "Anda dijemput untuk memantau kemajuan {nama pelajar}". Body: "Anda kini log masuk sebagai akaun yang **bukan Ibu Bapa**. Untuk berhubung dengan pelajar ini, sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda." (the words "bukan Ibu Bapa" semibold); full-width indigo button "Log Keluar & Log Masuk Sebagai Ibu Bapa" (sign-out icon). The button runs the M01 logout (FR-M01-37: clear the session, no confirmation) and navigates to `/login`. No link is created. | 2.1.5 | 11 | PROPOSED |
| FR-L45-27 | **Linked state** (session role `parent`). On load S2 SHALL call `POST /api/parent-invites/:token/accept` once. While it runs, the card shows the M01 spinner. On success: eyebrow "Berjaya Berhubung"; H1 "Anda kini berhubung dengan {nama pelajar}"; green box (check-circle icon) "Akaun anda ({nama ibu bapa}) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka."; full-width indigo button "Lihat Profil Kemajuan" (chart-line icon) → `/pelajar/{studentId}` (M08 public profile, M08 FR-M08-05). | 2.1.6 | 10 | PROPOSED |
| FR-L45-28 | Acceptance is idempotent (BR-L45-05): opening, refreshing or re-opening the link never creates a second `ParentStudentLink` for the same pair and always ends in the linked state. | 2.2.1 | 10 | PROPOSED |
| FR-L45-29 | On accept failure (`mock.failNext`, 5xx) S2 SHALL keep the valid-link card without the linked state and show the red alert "Ralat berlaku. Sila cuba lagi." (UNVERIFIED COPY, shared with M01 §8). | 2.2.1 | 10 | INFERRED |
| FR-L45-30 | Hand-off: S2 never carries the token through login or registration. After login or registration the parent lands on the role landing page (`/dashboard`, M01 BR-07), ignoring the requested URL (M01 BR-08); the parent then opens the link again to link (the guest copy says so). No change to M01 login or register. | 2.2.2 | 09, 10 | PROPOSED (consistent with OBSERVED BR-08) |
| FR-L45-31 | The user-shell nav item "Jemput Ibu Bapa" → `/jemput-ibu-bapa` (already built: `src/shells/nav/user-nav.ts` id `jemput-ibu-bapa`, `fa-users`, `text-red-500`, roles Murid, placed after "Timeline Saya") stays as built. The label and the student-only visibility come from the murid screenshot of the roles matrix; the href is confirmed by live (guarded route); the icon and colour are unverified (the reference says `fa-user-friends`, `text-rose-500`). No change is requested. It is shown in the sidebar (≥1024px) and the drawer (<1024px) for Pelajar only. | 1.5.1 | 07 | OBSERVED (label, href) / INFERRED (icon, colour) |
| FR-L45-32 | Every L45 screen SHALL follow §10 and the master NFR-RESP: no horizontal page scroll at 320–1920px, touch targets ≥44px (v2: see DV-L45-09), no content text below 12px (DV-16 rule). | all | 12 | — |
| FR-L45-33 | Tab titles SHALL match §2 exactly, and the S2 invalid and valid titles use an em dash. | all | 01, 08, 09 | OBSERVED (invalid) / PROPOSED |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-L45-01 | 03, 04, 05, 06, 07, 13 | 01, 02, 03 |
| US-L45-02 | 08 | 04 |
| US-L45-03 | 09 | 05 |
| US-L45-04 | 10, 11, 12, 13 | 06, 07, 08 |
| US-L45-05 | 14, 15, 16, 17, 18 | 09, 10, 11 |
| US-L45-06 | 01, 02 | 12, 13 |
| US-L45-07 | 31 | 14 |
| US-L45-08 | 19, 20, 33 | 15, 16, 17 |
| US-L45-09 | 22, 23, 24, 25, 30, 33 | 18, 19 |
| US-L45-10 | 22, 27, 28, 29, 30 | 20, 21, 22 |
| US-L45-11 | 26 | 23 |
| US-L45-12 | 32 | 24 |

Every FR is verified by at least one E2E scenario (§12).

## 4. Business rules

| # | Rule | Tag |
|---|---|---|
| BR-L45-01 | One current token per student (relation 1:0..1 to the student). Created lazily at first view (FR-L45-13). | PROPOSED |
| BR-L45-02 | Token format: 64 lowercase hex characters (32 random bytes). Outside the e2e build it is cryptographically random; in the e2e build it is deterministic: **highest token held + 1** (BigInt, rendered as 64 hex digits, zero-padded; first = 63 zeros then `1`), not the "n-th issued", so it never collides with a token held in the store (as built). Tokens set through the hook `mock.setParentInviteToken` are any non-empty string, stored lower-cased (they need not be 64 hex). Matching is case-insensitive (INFERRED). Any other string is simply an unknown token. | PROPOSED (format) / INFERRED (matching) |
| BR-L45-03 | "Jana Link Baru" replaces the token: the old token is invalid immediately, the new one is stored with `createdAt` = mock-clock now. Existing `ParentStudentLink` rows are untouched. Regeneration does not notify anyone. | PROPOSED |
| BR-L45-04 | A token is valid only while its student is `role = student` and `isActive = true`. There is **no time-based expiry** (the reference has none; the live copy "tamat tempoh atau dibatalkan" is generic and one message covers every invalid cause). | PROPOSED (OQ-02) |
| BR-L45-05 | Accepting requires an authenticated user whose role is `parent`. It creates one `ParentStudentLink {parentId, studentId, createdAt}` unless the pair exists (M02 BR-10 unique pair; many parents per student, many students per parent). No other field and no role change. | PROPOSED |
| BR-L45-06 | A guest or a non-parent never creates a link, even if they open the link by mistake. | PROPOSED |
| BR-L45-07 | The invite never creates an account. Parent accounts come from `/register` (role "Ibu Bapa", "Pantau anak saya") or from an M02 admin; login and registration are unchanged (M01 BR-04, BR-05, BR-07, BR-08). | PROPOSED (DV-L45-01) |
| BR-L45-08 | The linked-parents list of student X = all `ParentStudentLink` rows with `studentId = X` joined to the parent user (`role = parent`): `{id, name, email}`. Rows whose parent is inactive still appear (the link is not changed by activation, INFERRED). | PROPOSED |
| BR-L45-09 | The student cannot remove a parent link. Only an M02 admin can (M02 S3 chips). No unlink, approval or consent step exists in the reference, so none is added (CLAUDE.md §6: no new scope). | PROPOSED (OQ-09 for the backend phase) |
| BR-L45-10 | The acceptance page shows the student's name and school to anyone who holds the token (including guests). This replicates the reference and is flagged for the backend phase (SEC-L45-03). The page never shows email, IC, grade or any other personal data. | PROPOSED |
| BR-L45-11 | The invite URL is built from the app origin at render time (`window.location.origin` + `/ibu-bapa/terima/` + token); the origin is not stored. | INFERRED |
| BR-L45-12 | All names, emails and the school shown come from the owners (M01 users, M02 users/schools); L45 copies none of them. | — |

## 5. Validation rules

| Input | Rule | Result |
|---|---|---|
| S1 fields | None: the URL field is read-only and every action is a button | — |
| `:token` path segment | No router pattern: any string is accepted (OBSERVED: `0000`, `zzzz`, 64 zeros) | unknown → "Link Tidak Sah" (FR-L45-20) |
| `POST generate` | No body; user from the session only | 403 for a non-student, 401 for a guest |
| `POST accept` | No body; parent from the session only | 401 guest, 403 non-parent, 404 unknown token |

## 6. Data entities

### 6.1 DATA-L45-01 — ParentInvite (owner **M02**; new store `parentInvites`, XR-L45-01)

| Field | Type | Required | Notes |
|---|---|---|---|
| studentId | int → User(`student`) | yes | Primary key (one current token per student, BR-L45-01). As built, the store row `id` equals `studentId` (M02 DATA-M02-15) |
| token | string, 64 lowercase hex | yes | Unique across the store (BR-L45-02) |
| createdAt | datetime (MYT, mock clock) | yes | Time the current token was generated |

No separate runtime id, so the D12/M02 runtime-id policy (ids from 1000) does not apply (the row id is the `studentId`). The prototype stores it as is; the real backend should store a hash (SEC-L45-01).

**Repository contract as built (M02 v1.31 §6.16, §6.2):** `parentInvites.get`, `getOrCreate`, `rotate`, `resolve`, `setToken`, `removeForUser`; `parentLinks.createIfAbsent`, `parentLinks.listParentsOfStudent`. Deleting a student cascades its invite (`removeForUser`).

### 6.2 Reused — DATA-M02-02 ParentStudentLink (owner M02; **unchanged**)

`{id (seed 1–2, runtime from 1000), parentId → User(parent), studentId → User(student), createdAt}`, unique pair. L45 adds no field. The reference's `relationship` column is not stored (DV-L45-02).

### 6.3 API shapes (projections, not stored)

- `ParentInviteView` = `{token: string, createdAt: datetime, parents: LinkedParent[]}`.
- `LinkedParent` = `{id: int, name: string, email: string, linkedAt: datetime}`.
- `InvitePreview` = `{valid: true, student: {name: string, initials: string, schoolName: string | null}, viewer: 'guest' | 'parent' | 'other'}`.
- `AcceptResult` = `{linked: true, created: boolean, student: {id: int, name: string, schoolName: string | null}, parent: {name: string}}`.

### 6.4 Seed data (no new records; all values already exist or are designed by M01/M02)

| Item | Value | Basis |
|---|---|---|
| Links | Parent 6 `ibubapa@demo.test` ("Ibu Bapa Demo") → students 2 `pelajar@demo.test` and 4 `pelajarmaju@demo.test` (M02 §6.15, links 1–2) | Designed (M02) |
| Student with **no** linked parent (empty state) | 3 `pelajar2@demo.test` ("Pelajar Dua Demo"), 5401 is a parent, not a student | Designed (M01 §6.8, M02 §6.15) |
| Parent with no links | 5401 `ibubapa2@demo.test` (M02 §6.15) | Designed (M02). Whether 5401 can log in with the demo password is not stated in M02/M01 (XR-L45-04); the E2E scenarios use canonical 6 only |
| Invite tokens | **None seeded.** Created at first view. E2E reads the token from the S1 field | — |
| Inactive student | 11 `tidakaktif@demo.test`: never gets a token through the UI (cannot log in). The invalid-for-inactive case is tested by deactivating student 3 after its token exists (M02 toggle) | Designed |

No real person or school name is introduced. The only school shown is the student's existing school (M01 §6.8): 900001 "SMK DEMO" for student 2, 900004 "SK Demo Bestari" for student 4 (fictitious fixtures); **student 3 has no school**, so S2 shows no school line for a link of student 3 (FR-L45-22). No school is added to student 3.

## 7. Mock API endpoints

Base `/api`, envelope, error codes and mock latency per SRS.md §7 and M01 §7. **A** = auth required (else `401 UNAUTHORIZED` → client goes to `/login`). **G** = public. Owners: #1–#2 **M02** (student side); #3–#4 **M01** (acceptance side), both use the M02 store (XR-L45-01).

| # | Method | Path | Auth | Mut. | Request | Success | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/me/parent-invite` | A (`student`) | yes (creates the token the first time) | — | 200 `{data: ParentInviteView}` | 401; 403 `FORBIDDEN` (non-student) | `GET /jemput-ibu-bapa` (server-rendered; role guard OBSERVED 403) |
| 2 | POST | `/api/me/parent-invite/generate` | A (`student`) | yes | — | 200 `{data:{token, createdAt, status: "Link jemputan baru telah dijana!"}}` | 401; 403 `FORBIDDEN` | `POST /jemput-ibu-bapa/generate` (OBSERVED: exists, 405 on GET) |
| 3 | GET | `/api/parent-invites/:token` | G | no | `:token` any string | 200 `{data: InvitePreview}`; `viewer` computed from the bearer token if present | 404 `NOT_FOUND` (unknown or replaced token; token held by a non-student / inactive student; the page is chosen by the status). A valid token viewed by a non-parent is **not** an error: 200 with `viewer: 'other'` (FR-L45-26, §9) | `GET /ibu-bapa/terima/{token}` (OBSERVED 404 + "Link Tidak Sah" for `0000` and `zzzz`, admin) |
| 4 | POST | `/api/parent-invites/:token/accept` | A (`parent`) | yes | — | 200 `{data: AcceptResult}` (`created=false` when the pair existed) | 401; 403 `FORBIDDEN` (non-parent); 404 `NOT_FOUND` | the same live GET (PROPOSED: the reference links inside the GET; split here so a GET has no side effect) |

Mock-only helpers (dev/E2E builds): `mock.setParentInviteToken(studentId, token)` (fixes a token for a student), plus the existing `mock.reset()`, `mock.failNext(path, code)`, `mock.setLatency(ms)` and `mock.expireSession()`.

## 8. States & messages

**S1 `/jemput-ibu-bapa`**

| State | Content | Tag |
|---|---|---|
| Loading | M01 S9 spinner | INFERRED |
| Load error | M01 S9 alert with "Cuba lagi" | INFERRED |
| Idle, no parents | Header "Jemput Ibu Bapa" / "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda"; hero H1 "Jemput Ibu Bapa 👨‍👩‍👧"; card "Link Jemputan" / "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej."; buttons "Salin", "Hantar via WhatsApp", "Jana Link Baru"; card "Ibu Bapa Dihubungkan" with "👨‍👩‍👧" "Belum ada ibu bapa dihubungkan" / "Hantar link jemputan di atas" | PROPOSED |
| Idle, with parents | Same, rows `{name}` / `{email}` | PROPOSED |
| Copied | "Disalin!" (check, emerald) for 2 s | PROPOSED |
| Regenerating | "Jana Link Baru" button disabled | INFERRED |
| Regenerated | Flash "Link jemputan baru telah dijana!" | PROPOSED |
| Regenerate error | Red alert "Ralat berlaku. Sila cuba lagi." | INFERRED (UNVERIFIED COPY) |
| Forbidden | Global 403 (FR-L45-02) | OBSERVED |

**S2 `/ibu-bapa/terima/:token`**

| State | Copy | Tag |
|---|---|---|
| Invalid | FR-L45-19 (exact) | OBSERVED |
| Guest | FR-L45-24, FR-L45-25 | PROPOSED (DV-L45-01 for the note) |
| Non-parent | FR-L45-26 | PROPOSED |
| Accepting | M01 spinner in the card | INFERRED |
| Linked | FR-L45-27 | PROPOSED |
| Accept error | Red alert "Ralat berlaku. Sila cuba lagi." | INFERRED (UNVERIFIED COPY) |
| Footer caption | "Pautan jemputan ini dikongsi oleh {nama pelajar} melalui PRESTASIPLUS." | PROPOSED |
| Preview error (S2 preview call fails with a server error, not 404) | Generic red alert "Ralat berlaku. Sila cuba lagi." plus a "Cuba lagi" button that repeats the call (as built) | INFERRED (UNVERIFIED COPY) |

**As-built note (S1 hero):** the hero gradient is rose-600 to pink-600 and the WhatsApp button emerald-600; white text is readable on them. This is deviation DV-L45-06 (§0.1), not an INFERRED detail.

Reference copy rejected because live shows different copy for the same state: the reference invalid page ("Pautan jemputan tidak sah atau telah tamat", "Pautan jemputan ini tidak lagi berfungsi…", button "Log Masuk" only). The OBSERVED live copy replaces it entirely. Wording note: the live copy and the S1 reference copy use "link"; the reference S2 valid copy uses "pautan". Both are kept verbatim as PROPOSED (OQ-05).

## 9. Permissions matrix

| Role | S1 `/jemput-ibu-bapa` | Generate (#2) | S2 `/ibu-bapa/terima/:token` | Accept (#4) |
|---|---|---|---|---|
| Guest | → `/login` (OBSERVED) | 401 | Renders (invalid / guest state) | 401 (page does not call it) |
| Pelajar | Own page: view, copy, share, regenerate | Own token only | Renders non-parent state | 403 (page does not call it) |
| Ibu Bapa | 403 page | 403 | Renders linked state | Creates own link only |
| Guru, Penaja, Admin Sekolah, PPD, JPN | 403 page (INFERRED) | 403 | Non-parent state | 403 |
| Admin | 403 page (OBSERVED) | 403 | Invalid page observed for `0000`; valid token → non-parent state | 403 |
| Inactive student's token | — | — | Invalid page | 404 |

A student can read only their own token and list. No role can read another student's token.

## 10. Responsive behaviour

Mandatory 375 / 768 / 1280 (CLAUDE.md §7). The reference gives structure only; the exact layout is for the designer, within these rules.

| Screen | 375 (mobile) | 768 (tablet) | 1280 (desktop) | Breakpoint |
|---|---|---|---|---|
| S1 shell | Mobile shell (compact header, drawer, bottom nav). Cards stacked full width. | Same as 375 (live shell switches at 1024). | Sidebar 256px + header; content column centred, cards full column width. | Shell switch at `lg` |
| S1 invite card | URL field and "Salin" on one row: the field is `flex-1 min-w-0`, long URL scrolls inside the field (no page scroll). "Hantar via WhatsApp" and "Jana Link Baru" stack vertically below `sm` (each full width, ≥44px high) and sit side by side from `sm` (WhatsApp flex-1). | Side by side. | Side by side. | `sm` (640px) |
| S1 parents card | Rows full width; name and email truncate with an ellipsis; the avatar tile keeps 40px. | Same. | Same. | — |
| S1 hero | Icon tile and text stay on one row; the text wraps. | Same. | Same. | — |
| S2 valid / invalid | Standalone, page padding 16px; card full width (≤512px); header block, body and buttons stack; buttons full width. At 320px the card has ≥12px margins and nothing overflows. | Card centred, max width 512px. | Same, centred vertically for the invalid page (as observed). | — |
| S2 invalid at 1280 | Matches `terima-invalid-token-desktop.png` (card ≈448px wide, centred). | — | — | — |

No horizontal page scroll at 320–1920px; every button and link tap target ≥44px (v2: see DV-L45-09); content text ≥12px.

## 11. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-L45-01 | Localisation | All copy is Bahasa Melayu, exactly as in §3/§8; dates (if shown) in `ms-MY`. The user speaks BM; no English strings are added. |
| NFR-L45-02 | Fidelity / accessibility (D10) | Accessibility replicates the source: no ARIA or keyboard enhancements beyond native `button`, `a` and `input`. The read-only URL field has no visible label (as the reference); this is accepted under D10 and noted in OQ-01. |
| NFR-L45-03 | Performance (prototype) | Mock latency default 400 ms; S1 needs one call; S2 needs one call (guest, other) or two (parent: preview then accept; the page may call accept alone when the viewer is a parent). |
| NFR-L45-04 | Privacy | Seeds are fictitious (existing demo accounts). Real names never appear in docs, seeds, tests or fixtures. The acceptance page exposes only the student's name and school (BR-L45-10). The token is never logged to the console in non-dev builds. |
| NFR-L45-05 | Motion | The "Disalin!" revert uses a 2 s timer, not an animation; any transition respects `prefers-reduced-motion`. |
| NFR-L45-06 | Testability | Deterministic tokens in e2e (BR-L45-02), `mock.setParentInviteToken`, per-test `mock.reset()`; the clipboard is stubbed in Playwright (`context.grantPermissions` or an init script). |
| NFR-L45-07 | Media | No generated media (D22): the initials tiles are CSS text, the parent tile is an icon, emoji are text, the shell avatar stays the SVG data URL (D23c). No QR code is drawn (not in the reference). |
| NFR-L45-08 | External hand-off | The WhatsApp share does not open an external screen in the prototype (D14). |

## 12. E2E test scenarios

Every scenario runs on the mobile (375×812), tablet (768×1024) and desktop (1280×800) projects, starts from `mock.reset()` and uses the M01 §6.8 / M02 §6.15 seed accounts (password `Demo1234`).

| ID | Scenario (abridged) | ACs | FRs |
|---|---|---|---|
| E2E-L45-01 | Login as `pelajar2@demo.test` (3) → open `/jemput-ibu-bapa` via the shell menu item: tab title, header, hero, card texts, three buttons, field value `{origin}/ibu-bapa/terima/{64 hex}`. | 01.1, 01.4 | 03–07 |
| E2E-L45-02 | Revisit and reload: the same token. Another student (2) has a different token. | 01.2, 01.3 | 13 |
| E2E-L45-03 | Page content when loading and when the call fails (`failNext`): spinner, then alert with "Cuba lagi". | 05.6 | 17 |
| E2E-L45-04 | "Salin" (clipboard stubbed): clipboard equals the field; label "Disalin!", emerald; after 2 s (Playwright clock) back to "Salin". Stub rejects → label unchanged. | 02.1–02.3 | 08 |
| E2E-L45-05 | WhatsApp: `href` equals `https://wa.me/?text=` + the encoded message with the URL, `target=_blank`; clicking does not open a page/popup. | 03.1, 03.2 | 09 |
| E2E-L45-06 | "Jana Link Baru": button disabled while pending; the field and WhatsApp `href` change; flash "Link jemputan baru telah dijana!" on the same URL; the WhatsApp `href` carries the new URL. | 03.3, 04.1, 04.4 | 10, 11 |
| E2E-L45-07 | After regenerating, the old URL shows "Link Tidak Sah"; the new URL shows the valid state. | 04.2, 08.2 | 10, 20 |
| E2E-L45-08 | Regenerate fails (`failNext`): alert, old link intact. Parents list unchanged after a regenerate. | 04.3, 04.5 | 12 |
| E2E-L45-09 | Student 2: one row "Ibu Bapa Demo" / `ibubapa@demo.test`, no chip, no remove control. | 05.1, 05.5 | 14, 15 |
| E2E-L45-10 | Student 3: empty state texts. | 05.2 | 16 |
| E2E-L45-11 | Parent 6 accepts student 3's link → student 3 reloads S1 and sees the parent; an admin in M02 adds and then removes a link (via M02 S3) → list follows; ordering by name with two parents. | 05.3, 05.4 | 15, 18 |
| E2E-L45-12 | Guest → `/jemput-ibu-bapa` → `/login`, no message. | 06.1 | 01 |
| E2E-L45-13 | Admin, teacher and parent → `/jemput-ibu-bapa` → the 403 page copy, links and tab title; URL unchanged; menu item absent for these roles. (The `POST generate` as non-student → 403 check is covered by unit tests only: Playwright cannot call the API directly.) | 06.2–06.4, 07.1 | 02, 31 |
| E2E-L45-14 | Menu item: sidebar (desktop) and drawer (mobile/tablet) for a Pelajar → `/jemput-ibu-bapa`; not present for the parent; on `/jemput-ibu-bapa` the item is shown as the current page. | 07.1, 07.2 | 31 |
| E2E-L45-15 | `/ibu-bapa/terima/0000` as admin (OBSERVED) and as guest (INFERRED same page): the exact "Link Tidak Sah" page (texts, icons, hrefs, footer, title with em dash). | 08.1, 08.5, 08.6 | 19, 33 |
| E2E-L45-16 | Inactive-student rule: student 3's token → admin deactivates student 3 in M02 → the link shows "Link Tidak Sah". | 08.3 | 20 |
| E2E-L45-17 | `/ibu-bapa/terima/zzzz` (non-hex) and a 64-zero token → the same "Link Tidak Sah" page as `0000` (title with em dash, copy, buttons). | 08.4 | 19, 20 |
| E2E-L45-18 | Guest with a valid token, run for student 2's link (school line "SMK DEMO") and student 3's link (no school line): card, eyebrow, H1 with the student name, body, "Log Masuk Sebagai Ibu Bapa" → `/login`, note with "Daftar akaun Ibu Bapa" → `/register`, caption; no link created (the student's list unchanged). | 09.1–09.4, 09.6, 09.7 | 22–25, 33 |
| E2E-L45-19 | Guest hand-off: login as parent 6 from the CTA → lands `/dashboard` (requested URL ignored) → reopen the link → linked state. | 09.5, 10.1 | 27, 30 |
| E2E-L45-20 | Logged-in parent 6 opens student 3's link: eyebrow "Berjaya Berhubung", H1, green box with "Ibu Bapa Demo", "Lihat Profil Kemajuan" → `/pelajar/3`; the link exists (student 3's S1 shows it). | 10.1, 10.2 | 22, 27 |
| E2E-L45-21 | Refresh/reopen and a second student: no duplicate rows; the first link kept. | 10.3, 10.4 | 28 |
| E2E-L45-22 | Accept fails (`failNext`): alert "Ralat berlaku. Sila cuba lagi.", no link. | 10.5 | 29 |
| E2E-L45-23 | Logged-in student 2 opens student 3's link: non-parent text, button "Log Keluar & Log Masuk Sebagai Ibu Bapa" → session cleared → `/login`; no link created. | 11.1, 11.2 | 26 |
| E2E-L45-24 | Responsive sweep of S1 (with and without parents) and S2 (invalid, guest, linked): no page h-scroll at 320/375/768/1280, taps ≥44px (v2: see DV-L45-09), text ≥12px, buttons stack below `sm`, long email and name truncate. | 12.1–12.5 | 32 |

**Coverage:** 52/52 URS ACs ≥1 scenario; 32/32 active FRs (FR-21 withdrawn) ≥1 scenario; 24 scenarios.

## 13. Cross-module requests (XR)

| ID | To | Request |
|---|---|---|
| XR-L45-01 | M02 SRS | **Status: Applied (M02 v1.31: §6.16 DATA-M02-15, §7 #45–#48, helpers note).** (a) Add `DATA-M02-xx ParentInvite` (§6.1 above) to §6 and the `parentInvites` store to §6.15 ("Other M02 stores", runtime, no seed). (b) Add mock endpoints #1 and #2 to §7 (M02-owned) and expose a repository contract used by M01 for #3/#4: `invites.getOrCreate(studentId)`, `invites.rotate(studentId)`, `invites.resolve(token)`, `links.createIfAbsent(parentId, studentId, at)`, `links.listParentsOfStudent(studentId)`. (c) State that deleting or deactivating a student leaves the token in place but invalid (BR-L45-04); a hard delete (if any) cascades the invite. |
| XR-L45-02 | M02 SRS BR-10 / §6.2 | **Status: Applied (M02 v1.31, BR-10, §6.2).** Amend: links are no longer created only by admins; an accepted invite also creates a link (`createdAt` from the mock clock, id ≥1000). The M02 S3 "replaces the set with the submitted chips" rule stays; the chips are loaded from the same store, so invite-made links appear and can be removed there. |
| XR-L45-03 | M02 SRS §6.15 | **Status: Applied (M02 v1.31; links 1–2 and student 3 unlinked unchanged, BR-06 cascade stated).** No new seed. Confirm links 1–2 (parent 6 → students 2, 4) stay and student 3 stays unlinked, because L45's empty state and E2E use them. |
| XR-L45-04 | M02 / M01 seeds | State whether fixture parent 5401 can log in with the M01 demo password. L45 does not depend on it. |
| XR-L45-05 | M01 SRS | Add S13 `/ibu-bapa/terima/:token` to §2 (public, standalone; spec in this SRS), include it in the public-route list of FR-M01-14, and add the hand-off sentence to Q4. A minimal cross-reference and the Q8 closure were made in M01 SRS v1.16; the §2/FR-14/§9 table edits remain for the next M01 revision. |
| XR-L45-06 | M08 SRS | `/pelajar/{id}` (public, M08 FR-M08-05) must resolve for student ids 2, 3 and 4: it is the target of "Lihat Profil Kemajuan". |
| XR-L45-07 | Router / shells (F-21, no doc change) | Register S2 as a public standalone route that matches any token (no hex pattern); S1 with `roles: ['student']` and `onForbidden: '403'`. The existing global 403 copy already matches the observed copy (verified), so no cross-module difference exists. |
| XR-L45-08 | M23 / shells | The nav item icon and colour stay unverified (FR-L45-31); no change requested. |
| XR-L45-09 | Roles matrix tracking (TRACKER, Delivery Lead) | Row L45 owner "M02 (perlu pengesahan)" → M02 (screen, tokens, link) + M01 (acceptance page), as decided in D23b. |
| XR-L45-10 | Designer (follow-up, no doc edit here) | `WhatsAppIcon` is duplicated: M02 `src/modules/m02-users-schools/components/jemput/WhatsAppIcon.vue` and M09 (Font Awesome Free 6.7.2 path, CC BY 4.0), because ADR-0009 forbids cross-module component imports. Follow-up for `ui-ux-designer`: promote one shared `WhatsAppIcon` to `src/components/icon` and record it in design-system.md (not edited here); keep the CC BY 4.0 attribution. |

**Cross-module open item (not L45):** deactivating a user does not revoke their existing sessions (M01/M02 BR-05 and M01 BR-23 refuse only new logins). A deactivated parent or student with a live session therefore keeps access until the session ends. This belongs to M01/M02 (see also SEC-L45-13) and is not an L45 requirement.

## 14. Real-backend security requirements (for the G4 security review; backend-only, the prototype replicates the reference)

The change touches auth, personal data of minors and a new guest-reachable external input, so `security-engineer` review is required at G4.

| ID | Requirement |
|---|---|
| SEC-L45-01 | Generate tokens with a CSPRNG (32 bytes). Store only a hash (SHA-256) of the token and compare in constant time; show the plain token only on the student's own page. |
| SEC-L45-02 | Rate-limit `GET /ibu-bapa/terima/{token}` (the preview) and the accept call per IP and per user, so tokens cannot be enumerated. Log accept events with the parent id and student id (audit), never the token. |
| SEC-L45-03 | The preview is public: it reveals the student's name and school to any holder of the link. Decide whether to reduce it (for example first name or initials only, no school) before accept. The prototype keeps the reference (BR-L45-10). **Accepted for the prototype (D23); must change for the real backend** (see SEC-L45-11). |
| SEC-L45-04 | Accept must be a POST with CSRF protection (the live/reference GET has a side effect: a link opened by a logged-in parent links at once, and could be triggered by an `<img>` tag). **Accepted for the prototype (D23): the S2 page auto-accepts on load for a logged-in parent; must change for the real backend** (see SEC-L45-12). |
| SEC-L45-05 | The invite proves nothing about a real parent-child relationship: anyone with the link and a parent account can monitor the student. Add at least a notification to the student on each new link and a way for the student to remove a link (new scope, needs a product decision, OQ-09). |
| SEC-L45-06 | Regenerate must be rate-limited and require the student session; the old token is invalid in the same transaction. Consider a token lifetime (OQ-02). |
| SEC-L45-07 | Send `Referrer-Policy: no-referrer` (or `strict-origin`) on `/ibu-bapa/terima/*` so the token in the URL does not leak through the referrer to external links; keep it out of server access logs and analytics. |
| SEC-L45-08 | PDPA: the student's data is shown to guardians; record the link creation time and actor; support deletion of the link on the student's or guardian's request. |
| SEC-L45-09 | Token lookup responses: preview and accept return an identical 404 for unknown, replaced, inactive and wrong-state tokens, with similar timing (no oracle). Rate-limit and lock out preview and accept per IP and per user (extends SEC-L45-02). |
| SEC-L45-10 | Never log the token (application, access, proxy and analytics logs, error reports). |
| SEC-L45-11 | **Reduced preview (replaces BR-L45-10 for the real backend).** The public preview returns reduced data to non-parent viewers (initials or first name only, no school). Full name and school are shown only after the parent is authenticated and has accepted. **Accepted for the prototype (D23); must change for the real backend:** the prototype shows the full name and school in the public preview. |
| SEC-L45-12 | **Explicit accept.** Accept requires an explicit user action (a button); opening the page never auto-accepts. Accept also checks that the parent account `isActive`. **Accepted for the prototype (D23); must change for the real backend:** the prototype auto-accepts when a logged-in parent opens the link. |
| SEC-L45-13 | **Audit and notification.** Audit-log generate, rotate and accept (actor, student id, parent id, time; no token). Notify the student on each new link and allow unlinking by both the student and the parent (PDPA, extends SEC-L45-05 and SEC-L45-08). |
| SEC-L45-14 | **Token lifetime and revocation.** Define a token lifetime (OQ-02). Rotate or revoke the token, and handle existing links, on student deactivation, role change, deletion and PDPA erasure. (Related cross-module item: deactivation does not revoke existing sessions, §13.) |
| SEC-L45-15 | **Response headers** on `/ibu-bapa/terima/*`: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex` (extends SEC-L45-07), and a strict Content-Security-Policy. |
| SEC-L45-16 | **Production build hygiene.** Remove the test hooks (`mock.setParentInviteToken` and the other `mock.*` helpers) and the deterministic token generator from production builds, and extend the bundle guard to fail the build if they are present. |

## 15. Open questions

| # | Question | Blocking | Default adopted |
|---|---|---|---|
| OQ-01 | The `/jemput-ibu-bapa` page content (heading, field, buttons, list, empty state, flash, title) and the valid-token acceptance states were never seen live (no murid account, D16). | No | PROPOSED from the reference, "Perlu pengesahan" (D23a). Verify when a murid account exists. |
| OQ-02 | Do invite links expire by time? The live copy says "tamat tempoh atau dibatalkan"; the reference has no expiry. | No | No time expiry; only replaced (regenerated) or inactive-student links are invalid (BR-L45-04). |
| OQ-03 | "Canonical pelajar account 2 with no linked parent": the M02 seed already links parent 6 to the student `pelajar@demo.test` (id 2). | No | Read as `pelajar2@demo.test` (id 3, "Pelajar Dua Demo") for the empty state, which needs no new seed. If id 2 must be unlinked, M02 links 1–2 change (XR-L45-03). |
| OQ-04 | Reference guest note says parent accounts are provided by the school; the live register offers "Ibu Bapa". | No | Replaced by a register hand-off note (DV-L45-01). |
| OQ-05 | Wording: "link" (live invalid page, S1 reference) vs "pautan" (reference valid-state copy). | No | Both kept verbatim. Product may unify later. |
| OQ-06 | After login or registration, should the token be remembered so the link is accepted automatically? | No | No: the parent reopens the link (consistent with M01 BR-08; the guest copy says so). |
| OQ-07 | Should the prototype show feedback when "Hantar via WhatsApp" is pressed (D14)? | No | No navigation, no message (nothing is invented). |
| OQ-08 | Where does a linked parent see the child's progress (parent dashboard, `/ibu-bapa/dashboard`)? | No | Out of scope; only the link target `/pelajar/{id}` exists (M08). |
| OQ-09 | Student consent or a way to remove a parent link, and a notification to the student on a new link. | No (backend phase) | None in the prototype (BR-L45-09, SEC-L45-05). |
| OQ-10 | Icon and colour of the menu item; and S1 for roles other than admin (only admin was seen as 403). | No | As built; 403 for all non-students (INFERRED). |

**No question blocks the next phase (G2 design).** The seed reading in OQ-03 is the only one that changes another module's seed if answered the other way.
