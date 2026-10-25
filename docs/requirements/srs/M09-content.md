# M09 — Content: Articles, Notes, Banners, Audio KBAT, Video, Perutusan, Panduan — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M09 Content |
| Version | 1.9 |
| Date | 2026-10-24 |
| Status | **Approved (G1)**; v1.8 = doc-only: M09 reader-screen build decisions (Session 3: L03 Panduan, L12 Video, L25 Artikel, L32 Audio KBAT) and D22 (videos are live data); v1.7 = doc-only: server security rules (NFR-M09-08) and admin handler as-built notes (§7); v1.6 = doc-only: privacy name replacement, M09-T1 PROPOSED COPY (§8.2) and INFERRED notes |
| Authors | product-analyst (functional: §1–5, 8–10, 12–13) and solution-architect (data entities §6, mock API §7, NFR/SEC §11) — agent |
| Source URS | [urs/M09-content.md](../urs/M09-content.md) v1.8 |
| Evidence | [discovery/M09-content.md](../../discovery/M09-content.md), inventory `docs/discovery/inventory/M09/` (incl. `_live-articles.json`, the de-personalised live article list and page orders, and `_live-videos.json`, the 2,260-row live video capture of 2026-10-02), screenshots `docs/discovery/img/M09/` |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.9 | 2026-10-24 | **UAT A-SY05 (D9 fix, Fast track; doc-only for ids).** New DV-M09-23: FR-M09-119 amended (S14 file tiles show the uploaded image as a thumbnail, glyph fallback). Mock `POST /api/admin/screenshots` (§7 #42) keeps a session object URL per saved row, returned in `url` by #41/#42 (bound to its row; dropped once the row is gone, e.g. after a mock reset); no FR, AC or E2E added, removed or renumbered. |
| 1.8 | 2026-10-02 | **M09 reader-screen build decisions (doc-only; no FR, AC or E2E added, removed or renumbered).** (1) **D22: videos are live data.** §6.9 video seed and §6.11 `videos` row: the generated rows, id-range table, five-series round-robin and the generated title / views / `SEED…` external-id rules are replaced by the 2,260 captured live rows (titles real, 4 privacy-masked to "Cikgu Demo", YouTube ids real, views as shown, uploader = canonical admin); the store is a materialised table, runtime ids from 2,261; "30 observed anchors" becomes "every row observed". (2) BR-M09-19: list order = captured live order via the display key `listKey`; `createdAt` reproduces each row's live age text (ids 1–20 "7 bulan yang lepas", others "6 bulan yang lepas"); old `createdAt` formula and tail stamp dropped. (3) New DV-M09-20 (D9, video subjects: live `?subject=` pagination repeats ids, 329 videos never listed; rebuild assigns each video exactly one subject, 1,931 observed + 326 assigned by rule + 3 with none); the old §6.9 id-range table disagreed with 65 observed rows and is dropped. (4) §7 #28 gains `?for=edit` (no view count; used by S19). (5) NFR-M09-06 superseded by D22 (real `img.youtube.com` thumbnails, real iframes with a host allow-list, text link for other platforms); E2E-47/51 reworded. (6) Video decisions: guest S18 (L-7 decided), "Semua (0)" and zero-count pills non-link, S19 refusal route, S19 hides the visibility sub-lines, `search` appended last in pill links, stored `school` visibility without a form school resets to `global`. (7) Audio KBAT player (L-3, OQ-M09-11): PROPOSED COPY for "Kembali", "Skor anda n / total", "Audio tidak tersedia.", "Ralat memuatkan data. Sila cuba semula."; titles, submit and 404 rules. (8) Panduan: new DV-M09-21 (footer logo, D9); step-number colours for three roles INFERRED; help-box defaults; hash read once. (9) Artikel: AC-09.3 / E2E-20 assert the 5 list items in order (EL-M09-S16-032…036) without naming the parent `ol`/`ul` (not recorded; SQ-M09-05 closed); SQ-M09-04 deferred to M09-T4b and SQ-M09-02 decided; E2E-18 changes the seed in-app; share icons are Font Awesome brand glyphs; client-side allow-list sanitiser in the prototype and the backend sanitising rules (NFR-M09-08). (10) Remaining "generated" / "placeholder thumbnail" wording removed. Observed view counts of the capture replace the older anchor values in E2E-47/51 (see §6.9). Trace not re-run (no script available; §12.1). |
| 1.7 | 2026-10-02 | **Server security rules and admin handler as-built notes (doc-only).** (1) New NFR-M09-08: backend server rules from the M09 admin security review, each labelled "Server rule (real backend)": SEC-M09-01/02 allow-list sanitiser on save and render with strict CSP (S16 reader to use the same sanitiser or render text, re-check when built); SEC-M09-04 uploads (magic bytes, storage outside the web root, generated names, nosniff, attachment, 20 MB audio / 10 MB screenshot, per-request caps, malware scan, EXIF, non-listable folder); SEC-M09-10 https only, no credentials, 2048 length, `rel="noopener noreferrer" target="_blank"`, no redirect endpoint (known prototype difference: http kept as live); SEC-M09-13 server-side role checks, session-owned `authorId` / `uploadedById`, server-owned fields, DTO allow-lists, CSRF, rate limits; SEC-M09-08/12 soft delete, audit, "Pending Review" recommended; SEC-M09-14 enum plus legacy codes; new SEC-M09-15 templates as genuine files with a fixed content type. (2) §7 as-built note: the admin endpoints are implemented, not deferred; #21 paginates (`pageSize` up to 100) and S12 requests `pageSize=100` (FR-M09-65); #42 returns 422 when every file is rejected; `NOTE_SORT` is id ascending (FR-M09-42). No FR, AC or E2E change. |
| 1.6 | 2026-09-30 | **Revision history — v1.6, M09-T1 alignment and privacy (doc-only).** (1) Privacy: the fictitious example name in FR-M09-67, §6.9 (Audio KBAT fixture) and E2E-M09-43 is now "Cikgu Demo 02" (3 replacements). (2) §8.2: PROPOSED COPY (INFERRED, not observed on live) for the messages the M09-T1 mock uses (comment length, school-admin without school, no school to share, generic invalid field, file refusal reused for perutusan attachments, video/article/perutusan permission refusals, audio set shape, image and attachment limits, NOT_FOUND). (3) INFERRED notes from M09-T1: `scheduledAt` read as MYT (BR-M09-24); pin limit counts published and scheduled, not drafts (BR-M09-28); "Sekolah Saya" visibility uses the viewer's video-form school (BR-M09-19, BR-M09-21); school_admin compose-context label (BR-M09-22); list endpoints #7, #9, #20, #24, #33, #34 return the list envelope with `meta` (§7). No observed copy or behaviour changed; no FR or E2E count changes. |
| 1.5 | 2026-09-27 | **Revision history — v1.5, XL batch 3 round 3 (R3-03, Minor).** Canonical account 4 `pelajarmaju@demo.test` is now at fixture school 900004 "SK Demo Bestari" (M02 v1.16); only the admin remains at 900002. §6.9 user row 4 and E2E-M09-57 are re-scoped to what pelajarmaju sees at 900004 (no school post). Observed perutusan data unchanged (post #3 stays scoped to 900002). Trace 0 errors. |
| 1.4 | 2026-09-26 | **Revision history — v1.4, cross-module logic review batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`). XL2-19 (Major): DATA-M09-01 gains `youtubeUrl`; new DATA-M09-14 `ArticleAttachment {id, articleId, fileName, label, mime, size}` (runtime ids); §6.11 repository methods `articles.createFromTeacher`, `articles.updateFromTeacher`, `articles.deleteAttachment`, `articles.listByAuthor`, `articles.statsByAuthor` behind the M10 endpoints #66–#70; BR-M09-34; FR-M09-41 re-specified; the admin contract #3/#4 leaves both fields unchanged. XL2-26: E2E-27 = M10 create (unpublished) → admin S3 publish → first on `/artikel`. XL2-31: status Approved (G1). XL2-33: default clock `2026-09-25T15:40:00+08:00` (§6.9, §12; ages re-checked). Trace 0 errors. |
| 1.3 | 2026-09-25 | **Revision history — v1.3, discovery top-up S28** (URS v1.3). FR-M09-102 now OBSERVED; new FR-M09-130…135 (S28 layout, hero with Malay date and count chips, body and video, "Kongsi Perutusan" / "Salin Pautan" → "Disalin!", CTA and footer with DV-M09-18/19, guest restrictions); BR-M09-10 adds the S28 Malay date format; §2 route, §8.1 states, §10 responsive row for S28; new E2E-M09-73/74. Round-2 minors: AUD-M09-R2-01 — §6.9 video order is now a five-series round-robin (`seed_videos3.js`) reproducing also `?page=2` and `?subject=5&page=2` (ids 21–31 moved to Sejarah, 2175–2185 to Kimia; counts unchanged), BR-19, E2E-49; AUD-M09-R2-02 — 900003 and 3101–3109 marked recorded (M02 v1.6). DV-M09-18: `/daftar` → `/register`; DV-M09-19: "Hubungi" → `/panduan`, "Tentang" 404 replicated. Additive only. Coverage 2,054/2,054; trace 0 errors. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, privacy correction.** Every person in the seed is fictitious: the platform account label "Admin PRESTASI+" is the canonical admin (id 1, "Admin Demo"); every article author masked on live is the single fictitious author "Cikgu Demo 01" (id 3101) — the live structure is kept (36 platform-account articles, 36 masked-author articles; the live list does not show how many distinct persons the masked authors are); perutusan principals (3102–3104), reactors (3105–3109) and video uploaders (admin) are fictitious; no commenter exists. The non-personal live facts (ids, titles, categories, levels, featured, views, created dates, page orders, perutusan read observations) are now repo evidence at `docs/discovery/inventory/M09/_live-articles.json`, with authors as `platform` / `<author-1>` tokens only. The TRACKER id note (3101–3109) and the M02 requests (school 900003, user block 3101–3109) stay pending requests for the Delivery Lead. No requirement changed; coverage 1,983/1,983, trace 0 errors. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit round 1 fixes** (`docs/qa/audit/M09-audit.md`, FAIL 0/4/8) with the Delivery Lead decisions, D11/D12, canonical seeds 1–11 and the users id policy. AUD-01: §6.9 article seed rebuilt from the live admin list (72 live ids, full titles, categories, levels, featured, authors, views) and reader pages 1/2/4 — builder `seed_articles2.js` passes every observed order; BR-03 reader ties id ascending. AUD-02: video order key (BR-19, §6.9) reproduces page 1, `?subject=5`, `?category=motivasi` and page 95 (`seed_videos2.js`); E2E-49 asserts `?subject=5`. AUD-03: BR-07/FR-98 read rule consistent with the two non-counting observations; E2E-59 fixed. AUD-04: guru (id 5) at SMK DEMO 900001; E2E-52/57, AC-27.3/29.5. AUD-05: video-form school = M09 table `videoSchools` (INFERRED separate source; BR-21, FR-88, DATA-M09-13). AUD-06: `/perutusan/awam/{id}` 200 and guest `/video/{id}/edit` → `/login` OBSERVED (FR-102, FR-124, BR-31, §2). AUD-07: FR-29 `\|` escaped. AUD-08: E2E-18/23 provisional (30 provisional). AUD-09: unknown hash (FR-113, E2E-66). AUD-10: FR-61/72 DV-08 via DV-SH-03, S21 without subtitle; DV-09 from the container `text-white`. AUD-11: seed users 3101–3109 (anchors) and fictitious school 900003 (§6.9, NFR-03). AUD-12: FR-77/78 link building, subject pills ignore the active subject. New §6.11 Dataset spec (D11/D12; named count queries). Trace 0 errors. |
| 1.0 | 2026-09-25 | First issue. 129 FRs, 33 business rules, 12 data entities + seed (seed builders `seed_articles.js` / `seed_videos.js` check every observed live constraint), 43 mock endpoints (all M09-owned; M03 lookups reused), 72 E2E scenarios on 3 viewports (28 provisional in whole or in part), 14 SEC items. Traceability checked by script (§12.1). |

Conventions as in the URS §0: OBSERVED / SOURCE-DERIVED / INFERRED / UNVERIFIED COPY / PROPOSED COPY / DV-M09-nn / SEC-M09-nn / L-n; D10 (accessibility replicates live). Exact live copy is quoted; displayed casing is given where CSS changes it.

### 0.1 Fidelity deviations referenced here

Fixes: DV-M09-01 notes create/edit form (PROPOSED COPY) · DV-M09-03 admin article pager keeps filters · DV-M09-05 escaped body wraps (no page scroll) · DV-M09-06 note-type filter mapping (Delivery Lead choice) · DV-M09-07 banner edit selects show the stored values · DV-M09-08 Audio KBAT titles · DV-M09-09 student Audio KBAT hero and "Tapis" readable · DV-M09-10 0-count video pills (including "Semua (0)") do not navigate · DV-M09-12 article card meta wraps by item · DV-M09-17 404 "Mula Latihan" → `/practice` (= M01 DV-02) · DV-M09-18 S28 "Daftar Percuma" links → `/register` · DV-M09-19 S28 footer "Hubungi" → `/panduan` ("Tentang" 404 replicated) · DV-M09-20 every video belongs to exactly one subject (live subject lists repeat ids and hide 329 videos) · DV-M09-21 panduan footer logo centred with the text · DV-M09-22 (D54) notes and articles are Tingkatan 4 / 5 only, no Darjah (supersedes the Darjah list of BR-M09-11). PROPOSED pending the owner: DV-M09-14 WhatsApp number from configuration. Replicated (not changed): DV-M09-02 plain "Kandungan" textarea, DV-M09-04 escaped admin previews, DV-M09-11 raw codes in admin tables, DV-M09-13 link types without target, DV-M09-15 `/pusat-tuisyen/panduan` login gate, DV-M09-16 in-card table scroll. Full table: URS §7. · DV-M09-23 S14 file tiles show the uploaded image (glyph fallback). PROPOSED pending the owner: DV-M09-14 WhatsApp number from configuration. Replicated (not changed): DV-M09-02 plain "Kandungan" textarea, DV-M09-04 escaped admin previews, DV-M09-11 raw codes in admin tables, DV-M09-13 link types without target, DV-M09-15 `/pusat-tuisyen/panduan` login gate, DV-M09-16 in-card table scroll. Full table: URS §7.

## 1. Scope

The mock implementation covers S1–S27 plus the DV-M09-01 notes form and the provisional pages/states of L-3 (Audio KBAT rows, list items, player), L-4 (perutusan public page, own-post list) and L-5 (screenshot list), with dummy data behind a REST-shaped mock service layer (D1, D2):
- admin: articles (list, filters, pager, create, edit, preview, delete), notes (list, filters, create, edit, preview, delete), banners (list, create, edit, delete), Audio KBAT (list, stats, filters, templates, create), screenshot upload;
- user portal: articles (hot section, pills, search, grid, detail, share, related, latest), videos (pills with counts, subject pills, grid, detail, add, edit, delete), Audio KBAT (approved list, provisional player), perutusan (list, detail, reactions, comments, public link, write, my posts);
- public: guest layouts of `/artikel` and `/video`, `/panduan`, the provisional `/perutusan/awam/{id}`;
- the M09 entries of both shells, layouts, guest redirects, the data feeds used by M05.

Out of scope: URS §8 (M10 teacher article pages, M05 dashboard behaviour, comment moderation screen, final Audio KBAT player, real storage and external media).

## 2. Screens & routes

| Route | Screen | Primary actor | Shell | Notes |
|---|---|---|---|---|
| `/admin/articles` | S1 article list | Admin | admin | query `search, category, published, page` |
| `/admin/articles/create` | S2 create | Admin | admin | |
| `/admin/articles/:id/edit` | S3 edit | Admin | admin | unknown id → `/admin/articles` + flash |
| `/admin/articles/:id` | S4 preview | Admin | admin | unknown id → `/admin/articles` + flash (also `categories`) |
| `/admin/notes` | S5 note list | Admin | admin | query `search, subject, note_type, page` |
| `/admin/notes/create` | S6 create note (DV-M09-01) | Admin | admin | live HTTP 500 |
| `/admin/notes/:id/edit` | S7 edit note (DV-M09-01) | Admin | admin | live HTTP 500; unknown id → list, no flash |
| `/admin/notes/:id` | S8 note preview | Admin | admin | unknown id → list, no flash |
| `/admin/banners` | S9 banner list | Admin | admin | no query |
| `/admin/banners/create` | S10 create | Admin | admin | |
| `/admin/banners/:id/edit` | S11 edit | Admin | admin | unknown id → list + flash |
| `/admin/audio-kbat` | S12 set list | Admin | admin | query `education_level_id, subject_id, status, search` |
| `/admin/audio-kbat/create` | S13 create | Admin | admin | |
| `/admin/audio-kbat/template`, `/admin/audio-kbat/template-word` | file downloads | Admin | — | placeholder files (OQ-M09-03) |
| `/admin/tools/screenshots` | S14 upload | Admin | admin | |
| `/artikel` | S15 list | All; guest | user shell; guest public layout | query `search, category, page` |
| `/artikel/:slug` | S16 detail | All; guest (INFERRED) | user shell; guest public layout (provisional) | unknown slug → 404 |
| `/video` | S17 list | All; guest | user shell; guest public layout | query `search, category, subject, page` |
| `/video/:id` | S18 detail | All (guest INFERRED, L-7 decided) | user shell; guest public layout without section label or CTA, no Edit/Padam (INFERRED) | unknown → 404 |
| `/video/:id/edit` | S19 edit | Uploader, Admin | user shell | unknown → 404; other users → session landing page (in-place 403 if the landing is a video route, §9); guest → `/login` (OBSERVED) |
| `/video/tambah` | S20 add | Logged-in | user shell | guest → `/login` |
| `/audio-kbat` | S21 student list | Logged-in | user shell | query `education_level_id, subject_id` |
| `/audio-kbat/:id` | player — provisional (L-3) | Logged-in | user shell | route INFERRED; tab title "Audio KBAT" (as the list); unknown or non-approved set → standalone 404 page |
| `/perutusan` | S22 list | Logged-in | user shell | |
| `/perutusan/:id` | S23 detail | Logged-in | user shell | unknown / not visible → 404 |
| `/perutusan/tulis` | S24 write | Writers (§9) | user shell | |
| `/perutusan/saya` | S25 my posts | Logged-in | user shell | |
| `/perutusan/awam/:id` | S28 public perutusan page (OBSERVED, top-up) | Guest and all | standalone public layout | only public + published; other ids → 404 (INFERRED) |
| `/panduan` | S26 guide | All; guest | standalone | hash `#pelajar`, `#guru`, `#ibubapa`, `#admin`, `#ppd` |
| `/pusat-tuisyen/panduan` | S27 guide | Logged-in | standalone | guest → `/login` |

Tab titles (exact): URS §1 table. The SPA sets `document.title` per route. Probed and absent on live, not added: `/admin/tools`, `/nota`, `/admin/audio-kbat/:id` (→ SPA 404 page).

## 3. Functional requirements

"FN" cites URS Functions (prefix FN-M09-); "Traces" cites URS stories and acceptance criteria (US-M09-nn; AC-M09-nn.m).

| ID | Requirement | FN | Traces |
|---|---|---|---|
| FR-M09-01 | S1 SHALL use the admin shell with header "Pengurusan Artikel" / "Urus artikel dan konten pendidikan", tab title "Pengurusan Artikel - Admin PRESTASIPLUS", and the sidebar item "Artikel" of the open "Kandungan" group marked active. | 1.1.1, 10.2.1 | US-01; AC-01.1 |
| FR-M09-02 | S1 SHALL render the filter card as a GET form (no auto-submit): `search` ("Cari artikel..."), `category` (`all` "Semua Kategori" + BR-M09-01 codes/labels), `published` ('' "Semua Status", `1` "Diterbitkan", `0` "Draf"), `fa-search` "Cari", link "Reset" (slate-100) → `/admin/articles`; controls are initialised from the URL. | 1.1.2 | US-01; AC-01.3 |
| FR-M09-03 | S1 SHALL show h2 "Senarai Artikel", "Jumlah: {totalItems} artikel" and `fa-plus` "Tambah" → `/admin/articles/create`. | 1.1.3 | US-01; AC-01.1 |
| FR-M09-04 | S1 SHALL render the table of URS FN-M09-1.1.4 from `GET /api/admin/articles` (§7 #1): headers upper case by CSS; Tajuk = featured star (`fa-star` amber, `title="Featured"`) + title cut to 50 characters + "..." when longer + "Oleh: {author.name}"; Kategori pill (blue-100/blue-700) with the category label; Tahap = the stored `gradeLevel` code; Status `fa-check-circle` "Diterbitkan" (emerald-100/emerald-700) or, for drafts, the UNVERIFIED placeholder of §8.2; Views = integer; Tarikh = `createdAt` dd/mm/yyyy. | 1.1.4 | US-01; AC-01.1, 01.2 |
| FR-M09-05 | S1 SHALL list 20 rows per page ordered by BR-M09-03 and filter per BR-M09-02 (search = case-insensitive substring of the title; category = code; published = flag; AND). | 1.1.8, 1.1.11 | US-01; AC-01.2, 01.3 |
| FR-M09-06 | S1 SHALL render the Laravel pager (§8.1 "Pager"): from 640px "Showing {from} to {to} of {total} results", numbered links with window rule BR-M09-32 and chevrons; below 640px "« Previous" / "Next »" (plain text when unavailable). Every pager link SHALL carry the active `search`, `category` and `published` values (DV-M09-03). | 1.1.7 | US-01; AC-01.4, 01.6 |
| FR-M09-07 | With no matching article S1 SHALL show one full-width row `fa-inbox` "Tiada artikel dijumpai.", "Jumlah: 0 artikel" and no pager. | 1.1.9 | US-01; AC-01.5 |
| FR-M09-08 | Each S1 row SHALL have `fa-eye` (`title="Lihat"`, blue-600) → `/admin/articles/{id}` and `fa-edit` (`title="Edit"`) → `/admin/articles/{id}/edit`. | 1.1.5 | US-02; AC-02.1 |
| FR-M09-09 | Each S1 row SHALL have `fa-trash` (`title="Padam"`) that calls `window.confirm("Adakah anda pasti mahu padam artikel ini?")`; on cancel nothing happens; on OK `DELETE /api/admin/articles/:id` (§7 #5) and the list reloads at the same URL with the success flash (UNVERIFIED COPY, §8.2). | 1.1.6 | US-02; AC-02.2, 02.3 |
| FR-M09-10 | An unknown article id on S3 or S4 (API 404, also the id `categories`) SHALL navigate to `/admin/articles` and show once the red flash `fa-exclamation-circle` "Artikel tidak dijumpai." (red-50 / red-700 / red-200) above the list. | 1.1.10, 1.3.5 | US-02; AC-02.4 |
| FR-M09-11 | S2 SHALL render header "Tambah Artikel Baru" / "Cipta artikel pendidikan baharu", tab "Tambah Artikel - Admin PRESTASIPLUS", "Kembali ke Senarai" → S1 and the fields of URS FN-M09-1.2.3…1.2.5 with their labels, placeholders, defaults and `required` flags; "Kandungan" SHALL be a plain `<textarea rows="15">` (no rich editor, DV-M09-02 rejected). | 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5 | US-03; AC-03.1 |
| FR-M09-12 | S2 and S3 SHALL use native HTML validation only (no `novalidate`): the submit is blocked by the browser bubble while any `required` field is empty; no request is sent. | 1.2.7 | US-03; AC-03.2 |
| FR-M09-13 | The S2 footer SHALL hold, on one right-aligned row at every width, the link "Batal" → `/admin/articles` (no confirm, input discarded) and the submit `fa-save` "Simpan Artikel". | 1.2.6 | US-03; AC-03.3, 03.6 |
| FR-M09-14 | (INFERRED, L-1) A valid S2 submit SHALL `POST /api/admin/articles` (§7 #3); on 201 the client navigates to `/admin/articles` with the success flash (UNVERIFIED COPY); on 422 the field errors show under the fields (UNVERIFIED COPY) and the input is kept. The server sets author, slug (BR-M09-08), `publishedAt` (BR-M09-02) and views 0. | 1.2.8 | US-03; AC-03.4 |
| FR-M09-15 | The stored `content` SHALL be the HTML typed by the admin, rendered as HTML on S16 (SEC-M09-01) and shown as escaped text on S4 (FR-M09-20). | 1.2.3, 2.3.5 | US-03; AC-03.5 |
| FR-M09-16 | S3 SHALL render header "Edit Artikel" / "Kemaskini artikel", tab "Edit Artikel - Admin PRESTASIPLUS", "Kembali ke Senarai" and the S2 fields preloaded from `GET /api/admin/articles/:id` (§7 #2); the category select SHALL have no placeholder option; the checkboxes reflect `isPublished` / `isFeatured`. | 1.3.1, 1.3.2, 1.3.3 | US-04; AC-04.1, 04.2 |
| FR-M09-17 | The S3 footer SHALL hold "Batal" → `/admin/articles` (discards) and `fa-save` "Kemaskini Artikel", on one row. | 1.3.4 | US-04; AC-04.3 |
| FR-M09-18 | (INFERRED, L-1) A valid S3 submit SHALL `PUT /api/admin/articles/:id` (§7 #4) and navigate to `/admin/articles` with the success flash (UNVERIFIED COPY). | 1.3.6 | US-04; AC-04.4 |
| FR-M09-19 | S4 SHALL render the admin shell header = title / "Paparan artikel", tab "Lihat Artikel - Admin PRESTASIPLUS", "Kembali ke Senarai", and the card of URS FN-M09-1.4.3 (h1; `fa-user` author; `fa-calendar` `createdAt` "dd Mon yyyy"; `fa-eye` "{views} tontonan"; "Diterbitkan"; "Featured" amber pill when featured; excerpt) and `fa-edit` "Edit Artikel" (indigo-600) → S3. | 1.4.1, 1.4.2, 1.4.3, 1.4.5 | US-05; AC-05.1, 05.4 |
| FR-M09-20 | S4 and S8 SHALL print the stored body as text (HTML-escaped, never rendered) inside the card with `overflow-wrap: anywhere` so it wraps at any width and the page has no horizontal scroll (DV-M09-04 rejected, DV-M09-05). | 1.4.4, 3.3.4 | US-05, US-15; AC-05.2, 05.3, 15.2 |
| FR-M09-21 | View counters SHALL follow BR-M09-07: `GET /api/admin/articles/:id` never changes `views`; `GET /api/articles/:slug` increments `views` by 1 before returning the article (the detail shows the new value). | 1.4.6, 2.3.10 | US-05, US-09; AC-05.5, 09.7 |
| FR-M09-22 | `/artikel` for a logged-in user SHALL render inside the user shell (every role, including the admin) with header "Artikel" / "Tips belajar, berita pendidikan, motivasi dan panduan" and tab "PRESTASIPLUS - Platform Latih Tubi Nasional". | 2.1.1, 10.3.1 | US-06; AC-06.1 |
| FR-M09-23 | The S15 grid SHALL show 18 cards per page from `GET /api/articles` (§7 #6) in 1 / 2 (`sm`) / 3 (`lg`) / 6 (`xl`) columns; card = link → `/artikel/{slug}` with gradient 📰 panel, category chip (blue-500 → purple-500), `fa-star` "HOT" chip (amber-400 → orange-500) when featured, title, excerpt, author initial (BR-M09-29) + name, "👁️ {views}", relative date (BR-M09-09). Each meta item SHALL be `white-space: nowrap` so the row wraps only between items (DV-M09-12). | 2.1.5 | US-06; AC-06.2, 06.7 |
| FR-M09-24 | S15 SHALL render the search form (GET `/artikel`, `search` "Cari artikel...", hidden `category` while a category is active) and the category pills of URS FN-M09-2.1.4 with their active/inactive styles; pill links keep `search`; "Semua" → `/artikel` or `/artikel?search={q}`. | 2.1.3, 2.1.4 | US-06; AC-06.3, 06.4 |
| FR-M09-25 | The S15 pager SHALL follow FR-M09-06 with page size 18 and keep `category` and `search`. | 2.1.6 | US-06; AC-06.5 |
| FR-M09-26 | With no result S15 SHALL show 🔍 "Tiada Artikel Dijumpai", "Cuba ubah carian atau pilih kategori lain." and `fa-arrow-left` "Lihat Semua Artikel" → `/artikel` instead of the grid and pager. | 2.1.7 | US-06; AC-06.6 |
| FR-M09-27 | `GET /api/articles` SHALL return only published articles (BR-M09-02), ordered by BR-M09-03, filtered by `search` (title substring, case-insensitive) and `category` (code). | 2.1.8 | US-06; AC-06.2, 06.3, 06.4 |
| FR-M09-28 | When neither `search` nor `category` is set (any page), S15 SHALL show "Artikel Paling Hangat" with the 6 cards of `GET /api/articles/hot` (§7 #7, BR-M09-05): gradient panel purple-400 → pink-400 → orange-400, 📰, badge `fa-star` "PILIHAN" (featured) or `fa-fire` "POPULAR", category chip, 2-line title, 2-line excerpt, author initial + name, relative date; the guest page uses the same rule under a 🔥 heading. With `search` or `category` the section SHALL NOT render. | 2.1.2, 2.2.3 | US-07; AC-07.1, 07.2, 07.3 |
| FR-M09-29 | Without a session `/artikel` SHALL render the public layout (tab "Artikel — PRESTASIPLUS"): top bar logo → `/`, "\|", "📰" "Artikel", "Log Masuk" → `/login`, "Daftar Percuma" → `/register`; hero decorations, chip "Terkini & Menarik", h1 "Artikel Pilihan", "Tips belajar, berita pendidikan, motivasi dan panduan untuk pelajar Malaysia!" with the four topics bold. | 2.2.1, 2.2.2 | US-08; AC-08.1 |
| FR-M09-30 | The guest page SHALL render the search (🔍, "Cari artikel menarik..."), "Pilih Kategori:" with "Semua" and "✨ {label}" pills, and the grid of FR-M09-23 with a `fa-clock` before each relative date, with the FR-M09-25 pager. | 2.2.4, 2.2.5 | US-08; AC-08.2 |
| FR-M09-31 | The guest page SHALL end with the CTA and footer of URS FN-M09-2.2.6 (exact copy). | 2.2.6 | US-08; AC-08.3 |
| FR-M09-32 | S16 SHALL render the shell header title / "Artikel", the breadcrumb (title cut to 40 characters + "..."), the chips (category, level label BR-M09-01, `fa-star` "Pilihan" when featured), h1 and excerpt from `GET /api/articles/:slug` (§7 #8). | 2.3.1, 2.3.2, 2.3.3 | US-09; AC-09.1 |
| FR-M09-33 | S16 SHALL render the author card: initial, name, `fa-calendar` `publishedAt` "dd Mon yyyy", "•", `fa-clock` relative date, "👁️" {views} "Pembaca", "❤️" {likes} "Suka"; there SHALL be no like control. | 2.3.4 | US-09; AC-09.2 |
| FR-M09-34 | S16 SHALL render `content` as HTML (as live): the prototype passes the stored HTML through a client-side allow-list sanitiser before rendering (SEC-M09-01); the backend phase sanitises server-side (NFR-M09-08). | 2.3.5 | US-09; AC-09.3 |
| FR-M09-35 | S16 SHALL render the share card of URS FN-M09-2.3.6: WhatsApp `https://wa.me/?text={urlencode(title + " " + url)}`, Facebook `https://www.facebook.com/sharer/sharer.php?u={url}`, Twitter `https://twitter.com/intent/tweet?text={title}&url={url}` (new tab), each with the live Font Awesome brand glyph (`fa-whatsapp`, `fa-facebook-f`, `fa-twitter` bird) drawn as inline SVG from Font Awesome Free (CC BY 4.0 attribution kept); the `fa-link` button writes `location.href` to the clipboard and shows "Link Disalin!" for 2000 ms. | 2.3.6 | US-09; AC-09.4 |
| FR-M09-36 | S16 SHALL render "📚" "Artikel Berkaitan" with `related` (BR-M09-06): 📰, title, `fa-clock` relative date, "👁️ {views}", each → its detail. | 2.3.7 | US-09; AC-09.5 |
| FR-M09-37 | From `lg` S16 SHALL render the aside "Artikel Terkini" with `GET /api/articles/latest?limit=5` (§7 #9) and "Lihat Semua Artikel" → `/artikel`; below `lg` it SHALL NOT render. | 2.3.8 | US-09; AC-09.6 |
| FR-M09-38 | An unknown article slug, video id, video edit id or perutusan id (API 404) SHALL render the standalone global 404 page of M01 with "Mula Latihan" → `/practice` (DV-M09-17 = M01 DV-02). | 2.3.9, 6.3.7, 6.5.5, 7.2.9 | US-10, US-26, US-30; AC-10.1, 26.3, 30.3 |
| FR-M09-39 | (INFERRED, L-7; provisional) Without a session `/artikel/:slug` SHALL render the S16 content (without breadcrumb and aside) inside the guest public layout of FR-M09-29/31 and count the view. | 2.3.11 | US-10; AC-10.2 |
| FR-M09-40 | `GET /api/articles/latest?limit=5` SHALL be the source of the M05 dashboard strip and aside and of the S16 aside (same 5 newest published, same order); M05 `GET /api/dashboard` SHALL embed the same list (cross-module, OQ-M09-13a). | 2.4.1 | US-11; AC-11.1 |
| FR-M09-41 | (INFERRED) Articles created or edited by M10 `/guru/artikel` SHALL be written only through the M09 repository (§6.11) into DATA-M09-01 with the teacher as author, `isPublished = false` on create (M10 BR-M10-29), the optional `youtubeUrl` and up to 5 DATA-M09-14 attachments (BR-M09-34); they appear on the S1 list as drafts, are published by the admin on S3, and then follow BR-M09-02/03. No M09 screen renders `youtubeUrl` or attachments. | 2.4.2 | US-11; AC-11.2 |
| FR-M09-42 | S5 SHALL render header "Pengurusan Nota" / "Urus nota pembelajaran dan sumber belajar", tab "Pengurusan Nota - Admin PRESTASIPLUS", "Senarai Nota", "Jumlah: {n} nota", `fa-plus` "Tambah Nota" → `/admin/notes/create`, and the table of URS FN-M09-3.1.4 from `GET /api/admin/notes` (§7 #10), 20 per page, ordered by id ascending, no pager at ≤20 rows. | 3.1.1, 3.1.3, 3.1.4, 3.1.9 | US-12; AC-12.1 |
| FR-M09-43 | S5 SHALL render the filter card of URS FN-M09-3.1.2 (GET, values kept) and filter per BR-M09-11 (note-type mapping, DV-M09-06); no match → "Tiada nota dijumpai." and "Jumlah: 0 nota". | 3.1.2, 3.1.7, 3.1.8 | US-12; AC-12.2, 12.3 |
| FR-M09-44 | An unknown note id on S7 or S8 SHALL navigate to `/admin/notes` without any flash. | 3.1.10 | US-12; AC-12.4 |
| FR-M09-45 | Each S5 row SHALL have `fa-eye` → `/admin/notes/{id}`, `fa-edit` → `/admin/notes/{id}/edit` and `fa-trash` with `confirm("Adakah anda pasti mahu padam nota ini?")` → `DELETE /api/admin/notes/:id` (§7 #14) and reload with the flash (UNVERIFIED COPY). | 3.1.5, 3.1.6 | US-13; AC-13.1, 13.2 |
| FR-M09-46 | `/admin/notes/create` SHALL render the DV-M09-01 create form of URS FN-M09-3.2.3 (never the 500 page): header "Tambah Nota" / "Cipta nota baharu", tab "Tambah Nota - Admin PRESTASIPLUS" (PROPOSED COPY), "Kembali ke Senarai", fields per §5 with native `required`, footer "Batal" → `/admin/notes` and `fa-save` "Simpan Nota" on one right-aligned row. | 3.2.1, 3.2.3 | US-14; AC-14.1, 14.2 |
| FR-M09-47 | `/admin/notes/:id/edit` SHALL render the same form preloaded from `GET /api/admin/notes/:id` (§7 #11), header "Edit Nota" / "Kemaskini nota", tab "Edit Nota - Admin PRESTASIPLUS", submit `fa-save` "Kemaskini Nota" (PROPOSED COPY). | 3.2.2, 3.2.4 | US-14; AC-14.4 |
| FR-M09-48 | (INFERRED, L-2) A valid note submit SHALL `POST /api/admin/notes` or `PUT /api/admin/notes/:id` (§7 #12, #13) and navigate to `/admin/notes` with the success flash (UNVERIFIED COPY). | 3.2.5 | US-14; AC-14.3 |
| FR-M09-49 | S8 SHALL render header = title / "Paparan nota", tab "Lihat Nota - Admin PRESTASIPLUS", "Kembali ke Senarai", the card of URS FN-M09-3.3.3 and `fa-edit` "Edit Nota" → `/admin/notes/{id}/edit`. | 3.3.1, 3.3.2, 3.3.3, 3.3.5 | US-15; AC-15.1 |
| FR-M09-50 | The prototype SHALL provide no notes reader route; `/nota` is the SPA 404 page. | 3.3.6 | US-15; AC-15.3 |
| FR-M09-51 | S9 SHALL render header "Pengurusan Banner" / "Urus banner promosi dan pengumuman", tab "Pengurusan Banner - Admin PRESTASIPLUS", "Senarai Banner", "Jumlah: {n} banner", `fa-plus` "Tambah" → create, and the table of URS FN-M09-4.1.3 from `GET /api/admin/banners` (§7 #15) ordered by BR-M09-12, with `fa-edit` (`title="Edit"`, indigo-600) → `/admin/banners/{id}/edit` per row; no filter, search, pager or view action. | 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.7 | US-16; AC-16.1, 16.2 |
| FR-M09-52 | Each S9 row SHALL have `fa-trash` with `confirm("Adakah anda pasti mahu padam banner ini?")` → `DELETE /api/admin/banners/:id` (§7 #19), reload and flash (UNVERIFIED COPY). | 4.1.5 | US-16; AC-16.3 |
| FR-M09-53 | An unknown banner id on S11 SHALL navigate to `/admin/banners` and show the red flash `fa-exclamation-circle` "Banner tidak dijumpai." (fade-in). | 4.1.6, 4.3.5 | US-16; AC-16.4 |
| FR-M09-54 | S10 SHALL render header "Tambah Banner Baru" / "Cipta banner promosi atau pengumuman", tab "Tambah Banner - Admin PRESTASIPLUS", "Kembali ke Senarai" and the fields of URS FN-M09-4.2.3, 4.2.4, 4.2.6, 4.2.7 with labels, placeholders, hints and defaults. | 4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.6, 4.2.7 | US-17; AC-17.1 |
| FR-M09-55 | "Jenis Pautan" SHALL drive a `linkType` state: only `external` shows the unlabelled `external_url` url input (placeholder "https://example.com"); hiding it keeps its value; `subject`, `quiz`, `article` show nothing (DV-M09-13 rejected). The `external_url` value SHALL be sent only when `linkType` is `external`. | 4.2.5 | US-17; AC-17.2 |
| FR-M09-56 | S10 SHALL validate natively (`title`, `banner_type`) and hold "Batal" → `/admin/banners` and `fa-save` "Simpan Banner" on one row at every width. | 4.2.8, 4.2.9 | US-17; AC-17.3 |
| FR-M09-57 | (INFERRED, L-1) A valid S10 submit SHALL `POST /api/admin/banners` (§7 #17) with the codes upper-cased by the server (BR-M09-12) and navigate to `/admin/banners` with the success flash (UNVERIFIED COPY). | 4.2.10 | US-17; AC-17.4 |
| FR-M09-58 | S11 SHALL render header "Edit Banner" / "Kemaskini maklumat banner", tab "Edit Banner - Admin PRESTASIPLUS", "Kembali ke Senarai" and the S10 fields preloaded from `GET /api/admin/banners/:id` (§7 #16); the three selects SHALL preselect the stored value per BR-M09-13 (DV-M09-07), so `checkValidity()` is true on load and saving unchanged sends the stored codes. | 4.3.1, 4.3.2, 4.3.3 | US-18; AC-18.1, 18.2, 18.3 |
| FR-M09-59 | S11 SHALL hold "Batal" → `/admin/banners` and `fa-save` "Kemaskini Banner"; a valid submit SHALL `PUT /api/admin/banners/:id` (§7 #18) and navigate to the list with the flash (INFERRED, UNVERIFIED COPY). | 4.3.4, 4.3.6 | US-18; AC-18.3, 18.4 |
| FR-M09-60 | `GET /api/banners/active` (§7 #20) SHALL return the banners that pass BR-M09-14 for the current user, ordered by BR-M09-12, as `{type, title, description}`; M05 renders them (FR-M05-04). | 4.4.1 | US-19; AC-19.1, 19.2, 19.3 |
| FR-M09-61 | S12 and S13 SHALL show the admin-shell header title from the route, "Set Audio KBAT" / "Cipta Set Audio KBAT", with no subtitle (DV-M09-08, shell rule DV-SH-03), tab titles "Set Audio KBAT" / "Cipta Set Audio KBAT". | 5.1.1 | US-20, US-21; AC-20.1, 21.1 |
| FR-M09-62 | S12 SHALL render the intro, the links "Template XLSX" / "Template Word" (downloads of §7 #22) and "Cipta Set" → create, and the guide box of URS FN-M09-5.1.2…5.1.4 (exact copy). | 5.1.2, 5.1.3, 5.1.4 | US-20; AC-20.2 |
| FR-M09-63 | S12 SHALL render the four stat cards "Set", "Approved", "Draft/Pending", "Soalan" from `meta.stats` of `GET /api/admin/audio-kbat-sets` (§7 #21), computed per BR-M09-15 over all sets (never filtered). | 5.1.5 | US-20; AC-20.2, 20.4 |
| FR-M09-64 | S12 SHALL render the filter (level, subject A–Z, status, search "Cari tajuk/sumber...", `fa-search` "Tapis"; GET; values kept) and, with no matching set, `fa-headphones` "Belum ada set Audio KBAT.". | 5.1.6, 5.1.7 | US-20; AC-20.3 |
| FR-M09-65 | (provisional, L-3) With matching sets S12 SHALL list one neutral row per set: title, level name, subject name, status label (BR-M09-15) and "30" questions; no row action, layout detail or pager is asserted. | 5.1.8 | US-20; AC-20.4 |
| FR-M09-66 | S13 SHALL render "Kembali" → S12, h1 "Cipta Set Audio KBAT", the subtitle and the box "Apa yang cikgu perlu sediakan?" with its paragraphs and template links. | 5.2.1, 5.2.2 | US-21; AC-21.1 |
| FR-M09-67 | S13 SHALL render card "Maklumat Set" per URS FN-M09-5.2.3, with "Status" defaulting to "Approved" (`approved`) and the "Sumber / Penyumbang" placeholder "Contoh: Cikgu Demo 02" (fictitious name in place of the masked live example). | 5.2.3 | US-21; AC-21.1 |
| FR-M09-68 | S13 SHALL render the 4 section cards of BR-M09-15 (titles "Bahagian n · Soalan a-b", note, "Tajuk Audio" prefilled "Audio n", "Fail Audio" not required with the live `accept`, "Transkrip Audio Untuk Audit"). | 5.2.4 | US-21; AC-21.2 |
| FR-M09-69 | S13 SHALL render 30 question blocks after their section, each per URS FN-M09-5.2.5 (defaults A / 1 / 3; `min`/`max`; required fields); options 1 column below `md`, 2 from `md`. | 5.2.5 | US-21; AC-21.3 |
| FR-M09-70 | S13 SHALL have one sticky bottom-right submit `fa-save` "Simpan Set Audio KBAT" and no "Batal"; native validation blocks the submit while any of the 153 required fields is empty. | 5.2.6, 5.2.7 | US-21; AC-21.4, 21.5 |
| FR-M09-71 | (INFERRED, L-1/L-3) A valid S13 submit SHALL `POST /api/admin/audio-kbat-sets` (§7 #23, multipart) and navigate to S12 with the success flash (UNVERIFIED COPY); stats update per BR-M09-15. | 5.2.8 | US-21; AC-21.6 |
| FR-M09-72 | S21 SHALL render in the user shell with the header title from the route, "Audio KBAT", and no subtitle (DV-M09-08, DV-SH-03), tab "Audio KBAT", and the hero container `rounded-3xl bg-gradient-to-br from-slate-950 via-amber-900 to-orange-700 text-white` with pill `fa-headphones` "Ujian Mendengar", h1 "Audio KBAT" inheriting the container's white and the amber-100 paragraph (DV-M09-09, SOURCE-DERIVED classes). | 5.3.1, 5.3.2 | US-22; AC-22.1, 22.2 |
| FR-M09-73 | S21 SHALL render the filter (level, subject A–Z, `fa-search` "Tapis" on slate-900 with white text — DV-M09-09; GET; values kept) and, with no approved set, `fa-headphones` "Belum ada set Audio KBAT yang approved.". | 5.3.3, 5.3.4 | US-22; AC-22.3 |
| FR-M09-74 | `GET /api/audio-kbat-sets` (§7 #24) SHALL return only `approved` sets, filtered by level and subject (AND); (provisional) each is shown as an item (title, level, subject) → `/audio-kbat/{id}`. | 5.3.5 | US-22; AC-22.4 |
| FR-M09-75 | (provisional, L-3) `/audio-kbat/:id` SHALL show the set title and its 4 sections, each with an `<audio controls>` element for its file and its questions (radio A–D) shown together, and one "Hantar" button (PROPOSED COPY); submitting posts §7 #26 and stores the score (BR-M09-16). No timer, result layout or review is asserted. Decided with the M09 reader build (L-3, PROPOSED COPY of §8.2): tab title "Audio KBAT" (as the list) and h1 = the set title; a "Kembali" back link (→ `/audio-kbat`); a section without an audio file shows "Audio tidak tersedia." in place of the player; the submit sends only the answered questions; after a score the form is locked and shows "Skor anda {n} / {total}"; a failed load shows "Ralat memuatkan data. Sila cuba semula."; an unknown or non-approved set renders the standalone 404 page. | 5.3.6 | US-23; AC-23.1, 23.2 |
| FR-M09-76 | S17 (logged in) SHALL render header "Video Pembelajaran" / "Tonton video motivasi, tutorial dan tips peperiksaan", tab "Video Pembelajaran - PRESTASIPLUS", the search form ("Cari video...") and `fa-plus` "Tambah Video" → `/video/tambah`. | 6.1.1, 6.1.2, 6.1.5 | US-24; AC-24.1 |
| FR-M09-77 | S17 SHALL render the category pills from `meta.facets.categories` of `GET /api/videos` (§7 #27, BR-M09-18) as "{label} ({count})"; a pill with count > 0 links to `/video?category={code}`, or with an active subject `/video?subject={id}&category={code}` (subject first, OBSERVED); "Semua ({total})" → `/video` or `/video?subject={id}`; with an active search, `search={q}` is appended last to every pill link (INFERRED: live showed no active-search case with a link); a pill with count 0 — every category pill and "Semua (0)" — SHALL render as a non-link element with the same look (no `href`; live has `href="#"`; click does nothing; DV-M09-10); active pill gradient 135° rgb(239,68,68) → rgb(249,115,22), white text. | 6.1.3 | US-24; AC-24.1, 24.3, 24.5, 24.6 |
| FR-M09-78 | S17 SHALL render the subject pills from `meta.facets.subjects` (only counts > 0, subject id order; counts over `search` and `category` only — the active subject is ignored, so all pills stay with full counts and no active style, OBSERVED) as "{name} ({count})" → `/video?subject={id}`, or with an active category `/video?category={code}&subject={id}` (category first, OBSERVED), and with an active subject `fa-times` "Reset Subjek" → `/video`; an active search is appended last (INFERRED, as FR-M09-77). Subject counts are computed from the one-subject-per-video store of DV-M09-20 and equal the live pill counts. | 6.1.4 | US-24; AC-24.4, 24.5 |
| FR-M09-79 | S17 SHALL render 24 cards per page ordered by BR-M09-19 (card per URS FN-M09-6.1.6: real `https://img.youtube.com/vi/{id}/hqdefault.jpg` thumbnail, an empty frame when it fails to load and no drawn placeholder (D22, NFR-M09-06), hover `fa-play` overlay, platform chip, title, uploader initial + name + role label, "{views} tontonan", relative date). | 6.1.6, 6.1.9 | US-24; AC-24.2, 24.4 |
| FR-M09-80 | The S17 pager SHALL follow FR-M09-06 with page size 24 and keep `subject`, `category` and `search`. | 6.1.7 | US-24; AC-24.2, 24.7 |
| FR-M09-81 | With no result S17 SHALL show 🎬 "Tiada Video Dijumpai", "Cuba ubah carian atau pilih kategori lain." and `fa-arrow-left` "Lihat Semua Video" → `/video`. | 6.1.8 | US-24; AC-24.3, 24.6 |
| FR-M09-82 | Without a session `/video` SHALL render the public layout of URS FN-M09-6.2.1…6.2.4 (tab "Video Pembelajaran — PRESTASIPLUS", top bar, hero "Tonton & Fahami", the same pills, grid and pager, CTA and footer) with no "Tambah Video". | 6.2.1, 6.2.2, 6.2.3, 6.2.4 | US-25; AC-25.1, 25.2 |
| FR-M09-83 | S18 SHALL render header "Video" / {title}, tab "{title} - Video PRESTASIPLUS", "Semua Video" → `/video`, the player (URS FN-M09-6.3.3; real iframe under the host allow-list of NFR-M09-06), h1, "{views} tontonan" · `createdAt` "dd Mon yyyy", the chips, uploader and description from `GET /api/videos/:id` (§7 #28). Without a session (L-7 decided, INFERRED; API #28 is public, BR-M09-31) S18 opens in the guest public layout of FR-M09-82 without the section label or the CTA, and never renders "Edit" / "Padam". | 6.3.1, 6.3.2, 6.3.3, 6.3.5 | US-26; AC-26.1 |
| FR-M09-84 | S18 SHALL render "Video Berkaitan" with `related` (BR-M09-20). | 6.3.6 | US-26; AC-26.2 |
| FR-M09-85 | `GET /api/videos/:id` SHALL return the video with its current `views` and then increment `views` by 1 (BR-M09-07: the page shows the count before this open). `GET /api/videos/:id?for=edit` returns the same body without incrementing `views` (live does not count edit-page opens; §7 #28). | 6.3.8 | US-26; AC-26.1 |
| FR-M09-86 | S18 SHALL show `fa-pen` "Edit" → `/video/{id}/edit` and `fa-trash` "Padam" (`confirm("Padam video ini?")` → `DELETE /api/videos/:id`) only when `canManage` (BR-M09-21); otherwise neither is rendered and the edit API answers 403. A user who is neither the uploader nor the admin opening `/video/{id}/edit` is redirected to their session landing page; when that landing page is itself a video route the client shows an in-place 403 instead (§9; no redirect loop). | 6.3.4, 6.6.2 | US-28; AC-28.1, 28.5 |
| FR-M09-87 | S20 SHALL render header "Tambah Video" / "Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain", tab "Tambah Video", back arrow → `/video`, h1 "Tambah Video Baru", "Paste sahaja link video — kami akan buat selebihnya" and the URL field with hint; 500 ms after the last input the client SHALL parse the URL per BR-M09-17 and show `fa-check-circle` "Platform dikesan: {label}" and the thumbnail when known, or nothing for an unsupported URL. | 6.4.1, 6.4.2, 6.4.3 | US-27; AC-27.1, 27.2 |
| FR-M09-88 | S20 SHALL render title, description (maxlength 1000), category (required, placeholder option), subject ("Tiada subjek khusus" + 31 in id order), the visibility radio cards (BR-M09-21: "Sekolah Saya" disabled with "Tiada sekolah" when `GET /api/videos/form-context` (§7 #32) returns no video-form school — the case of the seed admin, as live) and the uploader strip. | 6.4.4, 6.4.5, 6.4.6, 6.4.7 | US-27; AC-27.1, 27.3 |
| FR-M09-89 | S20 SHALL hold `fa-upload` "Terbitkan Video" (left) and "Batal" → `/video` on one row at every width, with native validation of `video_url`, `title`, `category`. | 6.4.8, 6.4.9 | US-27; AC-27.1, 27.4 |
| FR-M09-90 | (INFERRED, L-1) Any logged-in user SHALL be able to `POST /api/videos` (§7 #29); on 201 navigate to `/video` with the success flash (UNVERIFIED COPY); the server derives `platform`, `externalId`, `thumbnailUrl` (BR-M09-17). | 6.4.10, 6.6.1 | US-27; AC-27.5 |
| FR-M09-91 | S19 SHALL render header "Edit Video" / {title}, tab "Edit Video - {title}", back arrow → `/video/{id}`, h1 "Edit Video", "Kemaskini maklumat video" and the S20 fields preloaded (labels "Penerangan", "Subjek"; category without placeholder; preview "Platform dikesan: {stored platform spelling}"), footer `fa-save` "Simpan Perubahan" (left) and "Batal" → `/video/{id}`. S19 loads the video through `GET /api/videos/:id?for=edit` (no view counted). The visibility cards on S19 SHALL NOT show their sub-lines ("Boleh dilihat oleh semua" / the school name), as in the observed `video-edit.png`; S20 shows them (FR-M09-88). A stored `school` visibility with no form-context school (the editor has no video-form school) is reset to `global` on the form. | 6.5.1, 6.5.2, 6.5.3, 6.5.4 | US-28; AC-28.2 |
| FR-M09-92 | (INFERRED, L-1) `PUT /api/videos/:id` (§7 #30) SHALL navigate to `/video/{id}` with the flash; `DELETE /api/videos/:id` (§7 #31) SHALL navigate to `/video` with the flash (UNVERIFIED COPY). | 6.5.6, 6.6.3 | US-28; AC-28.3, 28.4 |
| FR-M09-93 | S22 SHALL render header "Perutusan" / "Kata-kata aluan dan maklumat penting dari pihak pengurusan", tab "Perutusan", and the dark hero with "Perutusan Rasmi", "Maklumat & berita dari pihak pengurusan", `fa-pen-fancy` "Tulis Perutusan" (amber) → `/perutusan/tulis` and `fa-folder-open` "Perutusan Saya" → `/perutusan/saya`. | 7.1.1, 7.1.2 | US-29; AC-29.1 |
| FR-M09-94 | S22 SHALL render one card per post of `GET /api/perutusan` (§7 #33) per URS FN-M09-7.1.3…7.1.7: pinned border and `fa-thumbtack` "Disematkan" (text hidden below `sm`), initials (BR-M09-29), name, role pill upper case (BR-M09-22), `fa-school` scope label, relative date, title, excerpt (BR-M09-27), "Video disertakan", top reaction (BR-M09-25), "{n} komen", "{n} baca", "Baca selanjutnya". | 7.1.3, 7.1.4, 7.1.5, 7.1.6, 7.1.7 | US-29; AC-29.2, 29.3, 29.4 |
| FR-M09-95 | `GET /api/perutusan` SHALL return the posts visible to the user (BR-M09-23) ordered by BR-M09-24. | 7.1.8 | US-29; AC-29.2, 29.5 |
| FR-M09-96 | S23 SHALL render header "Perutusan" / {scope label}, tab = title, "Kembali ke senarai" → `/perutusan` and the dark author header of URS FN-M09-7.2.3 (date format BR-M09-10). | 7.2.1, 7.2.2, 7.2.3 | US-30; AC-30.1 |
| FR-M09-97 | S23 SHALL render the h1, the stored HTML body (rendered), the YouTube player when `youtubeUrl` is set (NFR-M09-06), attachments (images inline, PDFs as links; layout UNVERIFIED), "{reads} baca" and "{approvedComments} komen". | 7.2.4, 7.2.6 | US-30; AC-30.2 |
| FR-M09-98 | Opening S23 SHALL apply BR-M09-07: an admin open and a public-page open do not change "baca" (OBSERVED); a logged-in user who is neither the admin nor the author adds one read per post (INFERRED); the list and detail show the stored count. | 7.2.12 | US-30; AC-30.4 |
| FR-M09-99 | S23 SHALL render three reaction buttons "👍 Suka{ n}", "❤️ Cinta{ n}", "🙏 Terima Kasih{ n}" (count shown when > 0); a click SHALL `POST /api/perutusan/:id/reactions` (§7 #38) and re-render with the returned counts (toggle per BR-M09-25, INFERRED, L-4). | 7.2.5, 7.2.10 | US-31; AC-31.1, 31.2 |
| FR-M09-100 | S23 SHALL render the comment card of URS FN-M09-7.2.8 (textarea required, maxlength 1000; note; "Hantar"; "Belum ada komen" while no approved comment); a valid submit SHALL `POST /api/perutusan/:id/comments` (§7 #39), keep the comment pending (not displayed, not counted, BR-M09-26) and show the flash (UNVERIFIED COPY). | 7.2.8, 7.2.11 | US-32; AC-32.1, 32.2 |
| FR-M09-101 | For a public post S23 SHALL render "Pautan Awam (boleh kongsi tanpa login)", a read-only input with `{origin}/perutusan/awam/{id}` that selects and copies itself on click, and `fa-whatsapp` "Kongsi ke WhatsApp" → `https://wa.me/?text={urlencode(title + " — Baca di PrestasiPlus: " + publicUrl)}`; for a non-public post none of these render. | 7.2.7 | US-33; AC-33.1, 33.2 |
| FR-M09-102 | `/perutusan/awam/:id` SHALL open without a session for a public published post and count no read (OBSERVED), rendering S28 per FR-M09-130…135 from `GET /api/public/perutusan/:id` (§7 #40); otherwise the 404 page (INFERRED). | 7.5.1 | US-33; AC-33.3 |
| FR-M09-103 | S24 SHALL render header "Tulis Perutusan" / "Sampaikan kata-kata aluan atau maklumat penting", tab "Tulis Perutusan", "Skop Perutusan" with the read-only scope label of `GET /api/perutusan/compose-context` (§7 #36, BR-M09-22), and "Tajuk Perutusan" (required, placeholder). | 7.3.1, 7.3.2, 7.3.3 | US-34; AC-34.1 |
| FR-M09-104 | S24 SHALL embed Quill 2 (snow theme, bundled locally — NFR-M09-06) with placeholder "Tulis perutusan anda di sini..." and the toolbar of URS FN-M09-7.3.4 (header H2/H3/Normal, bold, italic, underline, 35-colour picker, ordered list, bullet list, align left/center/right/justify, link with tooltip, clean). | 7.3.4 | US-34; AC-34.1, 34.2 |
| FR-M09-105 | The `fa-code` "HTML" toggle SHALL swap the editor for a textarea holding the editor HTML and back (loading the textarea HTML into Quill); on submit the current HTML is copied into `body` ('' when the editor holds only `<p></p>`); `body` is not required. | 7.3.5 | US-34; AC-34.3 |
| FR-M09-106 | S24 SHALL render the image and PDF inputs (hidden inputs behind their labels, `multiple`, accept `image/*` / `.pdf`, texts of URS FN-M09-7.3.6), "Pautan Video YouTube (Pilihan)" (url) and the unchecked "Sematkan di atas (maks 2)" and "Jadikan Awam (boleh dibaca tanpa login)". | 7.3.6, 7.3.7, 7.3.8 | US-34; AC-34.4 |
| FR-M09-107 | S24 SHALL render the three status radio cards (default `published`); `scheduled` shows "Tarikh & Masa Penerbitan" (`datetime-local`, not required), other values hide it. | 7.3.9 | US-34; AC-34.5 |
| FR-M09-108 | S24 SHALL hold "Batal" → `/perutusan` and `fa-paper-plane` "Hantar Perutusan" on one row at 375/768/1280, with native validation of `title` only. | 7.3.10, 7.3.11 | US-34; AC-34.6 |
| FR-M09-109 | (INFERRED, L-4) A valid S24 submit SHALL `POST /api/perutusan` (§7 #37, multipart) and follow BR-M09-24 (published / scheduled / draft), BR-M09-28 (pin limit 2 per scope, 422 with UNVERIFIED COPY) and the file limits of §5; success → `/perutusan` (draft → `/perutusan/saya`) with the flash (UNVERIFIED COPY). | 7.3.12 | US-34; AC-34.7, 34.8, 34.9 |
| FR-M09-110 | S25 SHALL render header "Perutusan Saya" / "Urus semua perutusan yang anda telah tulis", tab "Perutusan Saya", `fa-arrow-left` "Kembali" → `/perutusan`, `fa-pen-fancy` "Tulis Baru" → `/perutusan/tulis` and, with no own post, the card "Anda belum menulis perutusan". | 7.4.1, 7.4.2, 7.4.3 | US-35; AC-35.1 |
| FR-M09-111 | (provisional, L-4) With own posts S25 SHALL list them from `GET /api/perutusan/mine` (§7 #34): title → detail, status label (UNVERIFIED COPY) and date; no edit or delete control. | 7.4.4 | US-35; AC-35.2 |
| FR-M09-112 | `/panduan` SHALL render the standalone layout (no shell) with tab "Panduan Pengguna — PRESTASIPLUS" and the top bar of URS FN-M09-8.1.1 (logged-in vs guest links; `fa-bars` menu toggling `mobileOpen` below `lg`). | 8.1.1 | US-36; AC-36.1, 36.4 |
| FR-M09-113 | `/panduan` SHALL render the hero and the 5 role tabs; the initial role = `location.hash` without "#" (read once on load, as live — a later hash change by the browser does not switch the panel) or `pelajar` when empty (source: `activeRole` = the hash, or 'pelajar' when it is empty; SOURCE-DERIVED): `#pelajar`, `#guru`, `#ibubapa`, `#admin`, `#ppd` open that panel; an unknown hash leaves no tab active and no role panel shown, as live; a tab click SHALL show that panel, call `history.replaceState` with the new hash and smooth-scroll to the top; the active tab has border rgb(99,102,241) and shadow rgba(99,102,241,0.25) 0 8px 20px. | 8.1.2, 8.1.3 | US-36; AC-36.1, 36.2 |
| FR-M09-114 | Each role panel SHALL render its steps and feature cards with the exact copy of discovery Appendix B (S26 inventory), and the footer "© 2026 🇲🇾", logo, "Platform Latih Tubi Nasional" with the logo centred between the two texts (DV-M09-21). Step-number colours: Pelajar blue and Guru green are OBSERVED; Ibu Bapa purple, Admin Sekolah amber and PPD/JPN teal are INFERRED. Heading icons exist only for the Pelajar and Guru panels (OBSERVED). | 8.1.4, 8.1.5, 8.1.6, 8.1.7, 8.1.8, 8.1.11 | US-36; AC-36.1, 36.2 |
| FR-M09-115 | Each FAQ item SHALL toggle its own answer (`open`, `fa-chevron-down`) independently of the others. | 8.1.9 | US-36; AC-36.3 |
| FR-M09-116 | The help box SHALL render "💬", "Perlukan Bantuan Lanjut?", "Hubungi pasukan sokongan kami untuk sebarang pertanyaan.", `fa-envelope` "E-mel Kami" → `mailto:{support.email}` and `fa-whatsapp` "WhatsApp" (`target="_blank"`) → `https://wa.me/{support.whatsappNumber}` from `GET /api/config/support` (§7 #43; DV-M09-14 PROPOSED; default `60123456789` as live). Until that call answers (or if it fails) the box uses the live defaults `support@prestasiplus.my` / `60123456789`. | 8.1.10 | US-37; AC-37.1 |
| FR-M09-117 | For a guest `/panduan` SHALL render `fa-rocket` "Daftar Percuma Sekarang" → `/register` below the help box. | 8.1.12 | US-37; AC-37.2 |
| FR-M09-118 | `/pusat-tuisyen/panduan` SHALL render the same page for a logged-in user and redirect a guest to `/login` (DV-M09-15 rejected). | 8.2.1, 8.2.2 | US-38; AC-38.1, 38.2 |
| FR-M09-119 | S14 SHALL render header "Upload Screenshot" / "Tool admin untuk upload & urus gambar (private)", tab "Upload Screenshot - Admin PRESTASIPLUS", the "Upload Gambar" card (format text, drop zone with click-to-pick, drag-over classes, drop-to-submit, hidden `files[]` input `accept="image/*" multiple` whose change submits at once, tip) and "Fail Sedia Ada" with "Jumlah: {n} fail" / "Tiada fail lagi." from `GET /api/admin/screenshots` (§7 #41); each file tile SHALL show its image (`url`) as a 16:9 thumbnail above the sanitised name and an image glyph when the `url` is the mock placeholder `blob:mock/...` or the image fails to load (DV-M09-23). | 9.1.1, 9.1.2, 9.1.3 | US-39; AC-39.1, 39.2 |
| FR-M09-120 | (provisional, L-5) A chosen or dropped file set SHALL `POST /api/admin/screenshots` (§7 #42) at once; accepted files (BR-M09-30) are listed by sanitised name and counted; refused files show the error (UNVERIFIED COPY). | 9.1.4 | US-39; AC-39.3 |
| FR-M09-121 | The user shell SHALL carry the M09 entries of URS FN-M09-10.1.1 (desktop sidebar) and 10.1.2 (drawer; the `/pusat-tuisyen/panduan` item shown for the tuition-centre role only, INFERRED). | 10.1.1, 10.1.2 | US-40; AC-40.1, 40.2 |
| FR-M09-122 | The admin shell SHALL carry "Audio KBAT" and the "Kandungan" group (Banner, Artikel, Nota, Upload Screenshot) in the desktop sidebar and the "Kandungan" section of the "Lagi" sheet. | 10.2.1, 10.2.2 | US-41; AC-41.1, 41.2 |
| FR-M09-123 | Route layouts SHALL follow URS FN-M09-10.3.1: admin shell for `/admin/*`; user shell for `/artikel*`, `/video*`, `/audio-kbat*`, `/perutusan*` for every logged-in role including the admin; standalone for the guide. | 10.3.1 | US-42; AC-42.1 |
| FR-M09-124 | Guest routing SHALL follow URS FN-M09-10.3.2 (OBSERVED): public layouts on `/artikel` and `/video`; `/panduan` and `/perutusan/awam/*` public; redirect to `/login` from `/audio-kbat`, `/perutusan`, `/perutusan/*` (except `/perutusan/awam/*`), `/video/tambah`, `/video/*/edit`, `/pusat-tuisyen/panduan` and `/admin/*`. | 10.3.2 | US-42, US-08; AC-42.2, 08.1 |
| FR-M09-125 | (INFERRED) Non-admin roles opening `/admin/*` M09 routes SHALL be redirected to their landing page and the `/api/admin/*` endpoints SHALL answer 403 (M02 pattern). | 10.3.3 | US-42; AC-42.3 |
| FR-M09-130 | S28 SHALL use a standalone public layout (no shell; not the `/artikel` guest layout), background rgb(248,250,252), tab "{title} — PRESTASIPLUS", and the sticky dark top bar (rgba(15,23,42,0.97)) with logo → `/`, outline-gold "Daftar Percuma" (hidden below `sm`) → `/register` (DV-M09-18) and gold `fa-sign-in-alt` "Log Masuk" → `/login`. | 7.5.1 | US-44; AC-44.1 |
| FR-M09-131 | S28 SHALL render the hero of URS FN-M09-7.5.2 (breadcrumb, author row with role pill upper case, date line in the BR-M09-10 Malay format, white h1) and the chips "{reactionTotal} Suka", `fa-eye` "{reads} baca", `fa-comment` "{approvedComments} komen" (display only). | 7.5.2, 7.5.3 | US-44; AC-44.2 |
| FR-M09-132 | S28 SHALL render the rendered HTML body card and, when `youtubeUrl` is set, the "Video" block with the player (NFR-M09-06), and SHALL NOT render reaction buttons, a comment form or list, a public-link input or "Kembali ke senarai". | 7.5.4, 7.5.5, 7.5.9 | US-44; AC-44.3 |
| FR-M09-133 | S28 SHALL render "Kongsi Perutusan" with WhatsApp `https://wa.me/?text={urlencode(title + " — Baca di PrestasiPlus: " + url)}`, Telegram `https://t.me/share/url?url={url}&text={title}`, Facebook `https://www.facebook.com/sharer/sharer.php?u={url}` and the "Salin Pautan" button that copies `location.href` and changes to `fa-check` "Disalin!". | 7.5.6 | US-44; AC-44.4 |
| FR-M09-134 | S28 SHALL render the CTA ("Jom Sertai PrestasiPlus!", text, "Daftar Percuma Sekarang" → `/register`, "Log Masuk" → `/login`) and the footer (logo, "Platform Latih Tubi Interaktif Malaysia", "Utama" → `/`, "Tentang" → `/tentang` = the SPA's global 404 page as live, "Hubungi" → `/panduan`, "Log Masuk" → `/login`, "© 2026 PRESTASIPLUS. Hak Cipta Terpelihara.") (DV-M09-18, DV-M09-19). | 7.5.7, 7.5.8 | US-44; AC-44.5 |
| FR-M09-135 | S28 SHALL follow §10 at 375/768/1280: no page scroll, player 267×150 / 636×358 / 635×357, share buttons wrapping to 2 rows and CTA buttons stacked full width at 375. | 7.5.1, 7.5.5, 7.5.6, 7.5.7 | US-44; AC-44.6 |
| FR-M09-126 | Every M09 screen SHALL have no horizontal page scroll at 320–1920px (NFR-RESP-01), including S4/S8 (DV-M09-05). | all screen FNs | US-43; AC-43.1 |
| FR-M09-127 | The S1, S5 and S9 tables SHALL scroll inside their card (`overflow-x: auto`) below the width they need, with no sticky column (NFR-RESP-05 b; DV-M09-16). | 1.1.4, 3.1.4, 4.1.3 | US-43; AC-43.2 |
| FR-M09-128 | Grids SHALL follow §10 per screen and breakpoint. | 2.1.5, 6.1.6, 8.1.3, 5.2.5 | US-43; AC-43.3 |
| FR-M09-129 | Form footers SHALL keep their live one-row layout at 375/768/1280 (§10). | 1.2.6, 1.3.4, 4.2.8, 4.3.4, 6.4.8, 6.5.4, 7.3.10 | US-43; AC-43.4 |

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M09-01 | Article categories (code → label): `TIPS_BELAJAR` Tips Belajar, `BERITA` Berita, `MOTIVASI` Motivasi, `PANDUAN_IBU_BAPA` Panduan Ibu Bapa, `PANDUAN_GURU` Panduan Guru, `KEJAYAAN` Kejayaan, `UMUM` Umum (filter default `all` "Semua Kategori"). Levels: `SEMUA` Semua, `DARJAH_1`…`DARJAH_6` Darjah 1…Darjah 6; the S16 level chip shows the label ("Darjah 4"; "Semua" for `SEMUA`, INFERRED); S1 shows the code. | OBSERVED / INFERRED (`SEMUA` chip) |
| BR-M09-02 | An article is shown to readers (S15, S16, hot, latest, related, M05) only when `isPublished`; the admin list shows all. `publishedAt` is set on first publish (INFERRED); unpublishing hides it. A draft slug on `/artikel/{slug}` → 404 (INFERRED). | OBSERVED (admin all) / INFERRED |
| BR-M09-03 | Order: admin list `createdAt` desc, then id asc (OBSERVED); reader list, latest and related `publishedAt` desc, then id asc (reproduces the live reader order #9, #1…#8, #72…#10 with the §6.9 publish dates; the key is INFERRED). | OBSERVED (orders) / INFERRED (key) |
| BR-M09-04 | Featured (`isFeatured`) shows as the amber star (S1), "Featured" (S4), "HOT" (S15 cards), "PILIHAN" (hot section), "Pilihan" (S16). | OBSERVED (13/13) |
| BR-M09-05 | Hot section = 6 articles drawn at random (uniform, without repetition) on every request from the pool = all featured published articles ∪ the 10 most-viewed non-featured published articles; badge "PILIHAN" if featured else "POPULAR"; returned in draw order. The mock RNG is seedable (`mock.setRandomSeed(n)`) for tests. | OBSERVED (random, badges) / INFERRED (pool of 10, OQ-M09-14) |
| BR-M09-06 | Related = up to 3 other published articles of the same category, by BR-M09-03 reader order. Latest = the 5 newest published articles. | OBSERVED (#10) |
| BR-M09-07 | View counting: `GET /api/articles/:slug` increments before responding (shown value includes the open); `GET /api/videos/:id` responds then increments (shown value excludes the open); admin previews never count; perutusan: the admin's open of #4 and a guest GET of `/perutusan/awam/4` left "3 baca" unchanged (OBSERVED), so neither the admin nor the public page counts; a logged-in user who is neither the admin nor the author counts once per post (INFERRED, OQ-M09-06). No deduplication for articles and videos (INFERRED, SEC-M09-07; only single opens were observed). | OBSERVED (articles, videos, previews, the two non-counting perutusan opens) / INFERRED (rest) |
| BR-M09-08 | Slug of a new article = Laravel `Str::slug(title)` (lower case, accents stripped, non-alphanumerics → "-", trimmed of "-"); a taken slug gets "-2", "-3"…; slugs are not changed on edit. The live seed slugs are hand-written (`5-tips-belajar-matematik`, `selamat-datang-ke-prestasi`, `panduan-guru-menggunakan-jombelajar`, one cut at 61 characters) and are kept as seeded; no length rule is observable, so the prototype does not cut. | INFERRED |
| BR-M09-09 | Relative dates = Laravel `diffForHumans` in Malay against the mock clock: "{n} saat / minit / jam / hari / minggu / bulan / tahun yang lepas" (whole units, floor), e.g. 2025-12-24 → "9 bulan yang lepas" at 2026-09-25 (M05 BR-03, M04 BR-M04-16). | OBSERVED (format) |
| BR-M09-10 | Date formats: S1, S9 `dd/mm/yyyy`; S4, S8, S16, S18 `dd Mon yyyy` with English month abbreviations ("22 Feb 2026"); S23 `dd Mon yyyy, h:mmAM`/`PM` ("17 Mar 2026, 11:23PM"); S28 `d MMM yyyy` with **Malay** month abbreviations (Jan, Feb, Mac, Apr, Mei, Jun, Jul, Ogo, Sep, Okt, Nov, Dis — "Mac" OBSERVED, the others INFERRED from the Malay locale) and the time `h:mm AM` ("17 Mac 2026" · "11:23 PM"). All Asia/Kuala_Lumpur. | OBSERVED |
| BR-M09-11 | Notes: subject codes `matematik`, `matematik_tambahan`, `sains`, `fizik`, `kimia`, `biologi`, `bahasa_melayu`, `bahasa_inggeris`, `sejarah` (the 9 SPM subjects with Tingkatan 4/5 chapters in M03; `NoteSubject` in `mock/types.ts`; DV-M09-22, D54), displayed as the label in upper case ("MATEMATIK", "MATEMATIK TAMBAHAN", "BAHASA MELAYU"); stored types `FORMULA`, `RINGKASAN`, `LENGKAP`, `TIPS_TRICKS` shown as stored; grade stored `TINGKATAN_4` / `TINGKATAN_5`, shown "TINGKATAN 4" / "TINGKATAN 5"; `DARJAH_n` is rejected with 422. History: live carried five subjects (`matematik`, `sains`, `bahasa_melayu`, `bahasa_inggeris`, `sejarah`) and the grade `DARJAH_n`; both lists are superseded by DV-M09-22 (D54, 2026-10-24). Filter `note_type` mapping (DV-M09-06): `summary` → RINGKASAN, `full_notes` → LENGKAP, `mind_map` → MIND_MAP, `flashcard` → FLASHCARD, `cheat_sheet` → CHEAT_SHEET (no such notes), `all` → any; `subject` = code; `search` = title substring (case-insensitive). | OBSERVED (display, matematik, sifir) / DV-M09-06 |
| BR-M09-12 | Banner codes are stored upper case (type `HERO`, `FEATURE`, `PROMOTIONAL`, `ANNOUNCEMENT`, and from the form `PROMO`, `EVENT`; audience `ALL`, `STUDENT`, `TEACHER`, `ADMIN`; link `NONE`, `SUBJECT`, `QUIZ`, `ARTICLE`, `EXTERNAL`); the server upper-cases the submitted form values (INFERRED). Order: `displayOrder` asc, then id asc. The S9 "Tajuk" cell shows the description cut to 50 characters + "...". | OBSERVED (stored values, order) / INFERRED |
| BR-M09-13 | Banner edit preselection (DV-M09-07): for each of `bannerType`, `linkType`, `targetAudience`, the option whose value equals the stored code ignoring case is selected; if none, an extra option `{value: storedCode, label: storedCode}` is inserted first and selected (only on that form). A save posts the selected values unchanged. | DV-M09-07 |
| BR-M09-14 | Banner delivery: `isActive` and (`startDate` empty or ≤ today) and (`endDate` empty or ≥ today) and (`targetAudience` = `ALL`, or equals the user's role mapped `student` → STUDENT, `teacher` → TEACHER, `admin` → ADMIN; the admin receives every audience). | OBSERVED (admin: all 5) / INFERRED |
| BR-M09-15 | Audio KBAT set = 4 sections (1: Q1–8, 2: Q9–16, 3: Q17–24, 4: Q25–30) and exactly 30 questions in fixed order; status `draft` "Draft", `pending_review` "Pending Review", `approved` "Approved", `archived` "Archived" (filter only; no create option). Stats: Set = all sets; Approved = `approved`; Draft/Pending = `draft` + `pending_review`; Soalan = Σ question counts of all sets. Filters: level, subject, status, search (title or source label, case-insensitive), AND. | OBSERVED (copy, enums) / INFERRED (counting) |
| BR-M09-16 | (provisional) Audio KBAT score = Σ marks of correctly answered questions; total = Σ marks; one attempt stored per submit. | INFERRED |
| BR-M09-17 | Video URL parsing (client and server): YouTube if the URL matches `youtube.com/watch?v={id}`, `youtube.com/embed/{id}`, `youtube.com/shorts/{id}` or `youtu.be/{id}` (id = 11 chars `[A-Za-z0-9_-]`) → label "YouTube", thumbnail `https://img.youtube.com/vi/{id}/hqdefault.jpg`, embed `https://www.youtube.com/embed/{id}`; Vimeo `vimeo.com/{digits}` → "Vimeo", no thumbnail; Dailymotion `dailymotion.com/video/{id}` or `dai.ly/{id}` → "Dailymotion", thumbnail `https://www.dailymotion.com/thumbnail/video/{id}`; TikTok `tiktok.com` → "TikTok"; Facebook `facebook.com` + `video` → "Facebook"; else nothing (still accepted). The stored platform spelling is "Youtube" (shown on S19) and the chip label "YouTube". | OBSERVED (platforms, messages, YouTube/Vimeo states) / INFERRED (exact patterns) |
| BR-M09-18 | Video facets: category counts = videos visible to the user matching `search` and `subject` (all categories listed, incl. 0); subject counts = videos matching `search` and `category`, only subjects with count > 0, in subject id order; total "Semua" = videos matching `search` and `subject`. | OBSERVED |
| BR-M09-19 | Video order = the captured live list order (D22), kept as a display key `listKey` = 2260 − captured position (position 0 = first card of `/video` page 1, so the first card has the highest key); the list sorts by `listKey` desc. A runtime-created video has no `listKey` and sorts before every seeded row, newest `createdAt` first. `createdAt` is **not** the order key: it is seeded so that each row shows its live age text at the default clock `2026-09-25T15:40:00+08:00` (ids 1–20 "7 bulan yang lepas", all others "6 bulan yang lepas"; #2224 "03 Mar 2026" OBSERVED). The live order is not monotone in age, and both observations (the order and the age texts) are replicated. The unfiltered captured pages (page 1, page 2, page 95 = 2220–2223) are this order by construction; `?category=motivasi` (18, 17, 16) and the subject lists follow by filtering it (E2E-M09-49 asserts them; verified against the capture by the Delivery Lead on 2026-10-02 — all five lists match). Visibility: `global` for everyone (guests included); `school` only for users whose **video-form school** (BR-M09-21, not their profile school) equals the uploader's video-form school, the uploader and the admin (INFERRED, from M09-T1). | OBSERVED (order) / INFERRED |
| BR-M09-20 | Related videos = up to 6 other visible videos with the same `subjectId`, id desc; a video with no subject has no related list (section hidden, INFERRED). | OBSERVED (#2224) / INFERRED |
| BR-M09-21 | Video permissions: any logged-in user may add; `canManage` = current user is the uploader or has role `admin`. "Sekolah Saya" is enabled only when the user has a **video-form school** (label = that school's name), else disabled with "Tiada sekolah". The video-form school is a source **separate from the profile school** (live admin: `/profile/edit` has a selected school, `/video/tambah` shows "Tiada sekolah" — OBSERVED); its origin is INFERRED (e.g. a class or staff membership) and is modelled as the M09 table `videoSchools` (DATA-M09-13): seed admin none (as live), `guru@demo.test` → 900001 SMK DEMO (provisional). No role rule. | OBSERVED (admin) / INFERRED (source) |
| BR-M09-22 | Perutusan scope and writers: `admin` → scope `national` "Seluruh Malaysia (Kebangsaan)" (OBSERVED); `school_admin` → scope `school` "Sekolah" with the author's `schoolId` (INFERRED from the live posts); other roles cannot write: "Tulis Perutusan" still shows (as live for the admin; UNVERIFIED for others), and `/perutusan/tulis` / `POST /api/perutusan` refuse them with 403 (INFERRED, OQ-M09-05). Role pill label: `school_admin` → "Pengetua" (OBSERVED on posts), `admin` → "Admin" (UNVERIFIED COPY). The `compose-context` `scopeLabel` for `school_admin` is the school's name, falling back to "Sekolah" when the name is unavailable (INFERRED, M09-T1). | OBSERVED / INFERRED |
| BR-M09-23 | Perutusan visibility: status `published`, or `scheduled` with `scheduledAt` ≤ now (an empty `scheduledAt` counts as now); and scope `national`, or scope `school` with the viewer's `schoolId` equal to the post's, or the viewer is the author or the admin. Drafts are visible only to their author (S25) and the admin via direct id (INFERRED). | OBSERVED (admin sees 3) / INFERRED |
| BR-M09-24 | Perutusan order: `isPinned` desc, then effective publish time (`scheduledAt` or `createdAt`) desc. A `datetime-local` `scheduledAt` (no zone) is read and stored as MYT (+08:00) (INFERRED, M09-T1). After submit: `published` → publish time = now; `scheduled` → visible from `scheduledAt`; `draft` → S25 only. | OBSERVED (order) / INFERRED |
| BR-M09-25 | Reactions: one reaction row per (user, post, type); clicking a type the user already chose removes it, otherwise adds it (INFERRED toggle); counts per type; the list shows only the type with the highest count ("👍 n" / "❤️ n" / "🙏 n"; ties like > love > thanks) and nothing when all are 0. | OBSERVED (display) / INFERRED |
| BR-M09-26 | Comments: `body` 1–1000 characters; stored `pending`; only `approved` comments are displayed and counted; no approval UI in M09. | OBSERVED (copy) / INFERRED |
| BR-M09-27 | Perutusan excerpt = body with HTML removed and whitespace collapsed, cut to 250 characters + "..." (only when longer). | OBSERVED (~250) / INFERRED (exact) |
| BR-M09-28 | Pin limit: at most 2 pinned **published and scheduled** posts per scope (national, or per school; drafts are not counted, INFERRED, M09-T1); a third pin in the same scope is refused with 422 (UNVERIFIED COPY) — no automatic unpinning. Public link only for `isPublic` published posts. | OBSERVED (copy "maks 2") / INFERRED |
| BR-M09-29 | Initials: article/video cards use the first letter of the author name ("A", "C"); perutusan uses the first letters of the first two words of the name, upper case ("AD"). | OBSERVED / INFERRED (rule) |
| BR-M09-30 | Screenshot upload: types JPG, PNG, GIF, WebP, BMP, each ≤ 10 MB; stored under a sanitised name (lower case, spaces → "-", characters other than `a-z 0-9 . _ -` removed, a taken name gets "-1", "-2"…); private (not listed anywhere else). | OBSERVED (copy) / INFERRED (sanitising) |
| BR-M09-31 | Access: `/admin/*` admin only; `/artikel`, `/video`, `/panduan` and `/perutusan/awam/{id}` public, and the guest redirects of FR-M09-124 (incl. `/video/{id}/edit`) — OBSERVED; `/artikel/{slug}` and `/video/{id}` public (INFERRED, L-7). | OBSERVED / INFERRED (details) |
| BR-M09-32 | Laravel pager window: with ≤ 13 pages show all; else pages 1–10 then "..." then the last 2 when the current page ≤ 7 (live "1 … 10 … 94 95"); symmetric windows otherwise (Laravel `onEachSide(3)` default). | OBSERVED (page 1) / INFERRED (other pages) |
| BR-M09-34 | Teacher article fields (XL2-19; names and limits from M10 SRS #67–#70, FN-M10-9.2.4/9.2.5/9.3.5 — OBSERVED on the live M10 form): `youtubeUrl` optional, `type=url`, a YouTube link (hint "Contoh: https://www.youtube.com/watch?v=abc123 atau https://youtu.be/abc123"); attachments ≤ 5 per article, each ≤ 20 MB, extensions `.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx` (no video), optional label; the teacher's featured image is an uploaded file (JPEG/PNG/WebP ≤ 2 MB) whose stored URL fills `featuredImage` (INFERRED). Server-side: the same limits, only the author (or the admin) may delete an attachment, deleting an article deletes its attachments, editing keeps `isPublished` (INFERRED). The admin form S2/S3 does not show or change these fields (a PUT without them leaves them as they are). | OBSERVED (M10 form) / INFERRED (storage, server rules) |
| BR-M09-33 | Notes: `views` and `downloads` are counters with no increment path in the prototype (no reader page, OQ-M09-01). | OBSERVED (0 / 0) |

## 5. Validation rules

All forms rely on native HTML validation (browser bubble, no custom client message, no `novalidate`), as live. Server-side rules below are INFERRED; their messages are UNVERIFIED COPY (§8.2) and are shown under the field on 422.

| Form | Field | Client (OBSERVED) | Server (INFERRED) |
|---|---|---|---|
| S2/S3 article | `title` | required | ≤255 |
| | `excerpt` | — | ≤500 |
| | `content` | required | HTML stored as typed (SEC-M09-01) |
| | `featured_image` | `type=url` | valid URL, ≤2048 |
| | `category` | required | ∈ BR-M09-01 |
| | `grade_level` | — | ∈ BR-M09-01 (default `SEMUA`) |
| S6/S7 note (DV-01) | `title` | required | ≤255 |
| | `content` | required | — |
| | `subject`, `note_type`, `grade` | required | ∈ BR-M09-11 |
| S10/S11 banner | `title` | required | ≤255 |
| | `banner_type` | required | ∈ form values or the stored code (BR-M09-13) |
| | `image_url`, `external_url` | `type=url` | valid URL; `external_url` required when `link_type=external` (INFERRED) |
| | `display_order` | number, min 0 | integer ≥ 0 |
| | `start_date`, `end_date` | date | `end_date` ≥ `start_date` when both set |
| S13 audio set | `title`, `education_level_id`, `subject_id` | required | exist (M03) |
| | `sections[n][audio]` | accept `.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*`, optional | audio MIME, ≤ 20 MB (INFERRED, SEC-M09-04) |
| | `questions[n][question_text]`, `option_a…d`, `correct_answer` | required | answer ∈ A–D |
| | `marks`, `kbat_level`, `dskp_sp_id` | number; 1–20; 1–5; — | integers in range |
| S19/S20 video | `video_url` | required, `type=url` | valid URL |
| | `title` | required | ≤255 |
| | `description` | maxlength 1000 | ≤1000 |
| | `category` | required | ∈ `motivasi`, `tutorial`, `tips-spm`, `ceramah`, `lain-lain` |
| | `visibility` | required radio | `school` only when the user has a school (BR-M09-21) |
| S23 comment | `body` | required, maxlength 1000 | 1–1000 |
| S24 perutusan | `title` | required | ≤255 |
| | `images[]` | accept `image/*` | JPG/PNG/GIF, ≤ 2 MB each |
| | `documents[]` | accept `.pdf` | PDF, ≤ 5 MB each |
| | `youtube_url` | `type=url` | YouTube URL (BR-M09-17) |
| | `scheduled_at` | datetime-local, optional | future datetime when `status=scheduled` (INFERRED) |
| | `is_pinned` | — | BR-M09-28 |
| S14 upload | `files[]` | accept `image/*` | BR-M09-30 |

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase. IDs: SRS.md §7.4 exception applies — M09 exposes numeric ids in URLs (`/admin/articles/10`, `/video/2224`, `/perutusan/4`, `/admin/banners/1/edit`, `/admin/notes/1`), so articles, notes, banners, audio sets, videos and perutusan use integer ids with the live values where observed. Users, subjects, levels and schools are the M01/M02/M03 entities (integer ids per M03 v1.3 and M07 OQ-M07-09b). Dates ISO 8601 with +08:00; "now" from the mock clock. All data lives in the in-memory store seeded from fixtures and reset per E2E test (`mock.reset()`).

### 6.1 DATA-M09-01 — Article (owned by M09)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | the 72 live ids 1–72 (all observed on the admin list) |
| title | string ≤255 | yes | |
| slug | string | yes | unique; BR-M09-08 |
| excerpt | string \| null | no | "Ringkasan" |
| content | string (HTML) | yes | stored as typed (SEC-M09-01) |
| featuredImage | string (URL) \| null | no | not displayed by any observed screen; for a teacher article the URL of the uploaded image (BR-M09-34, INFERRED) |
| youtubeUrl | string (URL) \| null | no | written only by the M10 teacher form (`youtube_url`, BR-M09-34); not shown on any M09 screen (XL2-19) |
| category | enum BR-M09-01 | yes | |
| gradeLevel | enum `SEMUA`, `TINGKATAN_4`, `TINGKATAN_5` (DV-M09-22, D54; live `DARJAH_1`…`DARJAH_6` removed) | yes | default `SEMUA` |
| isPublished | boolean | yes | |
| isFeatured | boolean | yes | |
| views | int ≥0 | yes | BR-M09-07 |
| likes | int ≥0 | yes | "Suka"; no increment path (OQ-M09-14) |
| authorId | int → User | yes | M10 teacher or admin |
| attachments | → DATA-M09-14 (0–5) | — | teacher articles only (BR-M09-34) |
| publishedAt | datetime \| null | no | S16 date, reader order |
| createdAt, updatedAt | datetime | yes | S1 "Tarikh", admin order |

API shapes: `AdminArticleItem` = `{id, title, category, categoryLabel, gradeLevel, isPublished, isFeatured, views, createdAt, author: {id, name}}`; `ArticleCard` = `{id, slug, title, excerpt, category, categoryLabel, isFeatured, views, publishedAt, author: {name, initial}}`; `HotCard` = `ArticleCard + {badge: 'PILIHAN'|'POPULAR'}`; `ArticleDetail` = `ArticleCard + {content, gradeLevel, gradeLabel, likes, related: ArticleCard[]}`; `AdminArticleDetail` = all fields.

### 6.2 DATA-M09-02 — Note (owned by M09)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | live 1–10 |
| title | string ≤255 | yes | |
| summary | string \| null | no | S8 summary line |
| content | string (HTML) | yes | |
| subject | enum `matematik`, `matematik_tambahan`, `sains`, `fizik`, `kimia`, `biologi`, `bahasa_melayu`, `bahasa_inggeris`, `sejarah` (DV-M09-22, D54; live had the 5 without `matematik_tambahan`, `fizik`, `kimia`, `biologi`) | yes | display BR-M09-11 |
| noteType | enum `FORMULA`, `RINGKASAN`, `LENGKAP`, `TIPS_TRICKS` (+ `MIND_MAP`, `FLASHCARD`, `CHEAT_SHEET` accepted by the filter only) | yes | |
| grade | enum `TINGKATAN_4`, `TINGKATAN_5` (DV-M09-22, D54; live `DARJAH_1`…`DARJAH_6` removed) | yes | display "TINGKATAN n" |
| isPublished | boolean | yes | "Diterbitkan" / draft label UNVERIFIED |
| views, downloads | int ≥0 | yes | BR-M09-33 |
| authorId | int → User | yes | |
| createdAt, updatedAt | datetime | yes | |

### 6.3 DATA-M09-03 — Banner (owned by M09)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | live 1–5 |
| title | string ≤255 | yes | |
| description | string \| null | no | |
| imageUrl | string \| null | no | Unsplash URLs on live; not displayed |
| bannerType | string upper case | yes | BR-M09-12 |
| linkType | string upper case | yes | default `NONE` |
| externalUrl | string \| null | no | only when `EXTERNAL` |
| targetAudience | string upper case | yes | default `ALL` |
| displayOrder | int ≥0 | yes | default 0 |
| startDate, endDate | date \| null | no | |
| isActive | boolean | yes | default true |
| createdAt, updatedAt | datetime | yes | |

API shape `ActiveBanner` = `{type: bannerType, title, description}` (M05 carousel).

### 6.4 DATA-M09-04 — AudioKbatSet (owned by M09) with AudioKbatSection and AudioKbatQuestion

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | none on live |
| title | string ≤255 | yes | |
| educationLevelId | int → M03 level (1–11) | yes | |
| subjectId | int → M03 subject (1–31) | yes | |
| status | enum `draft`, `pending_review`, `approved`, `archived` | yes | create default `approved` |
| sourceLabel | string \| null | no | "Sumber / Penyumbang" |
| instructions | string \| null | no | |
| sections | `{no: 1–4, title, audioFileName: string \| null, transcript: string \| null, questionFrom, questionTo}`[4] | yes | ranges BR-M09-15 |
| questions | `{no: 1–30, questionText, optionA, optionB, optionC, optionD, correctAnswer: 'A'…'D', marks: 1–20, kbatLevel: 1–5, dskpSpId: int \| null, explanation: string \| null}`[30] | yes | |
| createdById | int → User | yes | |
| createdAt, updatedAt | datetime | yes | |

`AudioKbatAttempt` (provisional, L-3): `{id, setId, userId, answers: {no, choice}[], score, totalMarks, submittedAt}`.

### 6.5 DATA-M09-05 — Video (owned by M09)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | live 1–2260 (contiguous: count 2260 = highest observed id 2260, INFERRED); runtime-created rows from 2,261 |
| videoUrl | string (URL) | yes | |
| platform | enum `Youtube`, `Vimeo`, `Dailymotion`, `TikTok`, `Facebook`, `Other` | yes | stored spelling "Youtube"; chip "YouTube" (BR-M09-17) |
| externalId | string \| null | no | seeded rows: the real YouTube id of the live capture |
| thumbnailUrl | string \| null | no | seeded rows: `https://img.youtube.com/vi/{externalId}/hqdefault.jpg` |
| title | string ≤255 | yes | seeded rows: the live title (4 privacy-masked) |
| description | string ≤1000 \| null | no | plain text, line breaks kept |
| category | enum `motivasi`, `tutorial`, `tips-spm`, `ceramah`, `lain-lain` | yes | labels "Motivasi", "Tutorial", "Tips SPM", "Ceramah", "Lain-lain" |
| subjectId | int → M03 subject \| null | no | exactly one subject or none per video (DV-M09-20); seeded: 3 rows with none (ids 16, 17, 19) |
| visibility | enum `global`, `school` | yes | |
| schoolId | int → M02 school \| null | no | the uploader's school when `school` |
| uploaderId | int → User | yes | seeded rows: the canonical admin (id 1) |
| views | int ≥0 | yes | BR-M09-07; seeded rows: as shown on the live list |
| listKey | int \| null | no | display key of BR-M09-19 (2260 − captured position); null for runtime-created rows |
| createdAt, updatedAt | datetime | yes | seeded rows reproduce the live age text (BR-M09-19); not the order key |

API shapes: `VideoCard` = `{id, title, platformLabel, thumbnailUrl, views, createdAt, uploader: {name, initial, roleLabel}}`; `VideoDetail` = `VideoCard + {videoUrl, embedUrl, description, category, categoryLabel, subject: {id, name} | null, visibility, canManage, related: VideoCard[]}`.

### 6.6 DATA-M09-06 — Perutusan (owned by M09) with attachments

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | live 2, 3, 4 |
| title | string ≤255 | yes | |
| body | string (HTML) | no | Quill output or raw HTML (SEC-M09-02) |
| images | `{fileName, size}`[] | no | ≤2 MB each |
| documents | `{fileName, size}`[] | no | PDF ≤5 MB each |
| youtubeUrl | string \| null | no | |
| isPinned | boolean | yes | BR-M09-28 |
| isPublic | boolean | yes | |
| status | enum `published`, `scheduled`, `draft` | yes | |
| scheduledAt | datetime \| null | no | |
| scope | enum `national`, `school` (others UNVERIFIED) | yes | BR-M09-22 |
| schoolId | int \| null | no | when `school` |
| authorId | int → User | yes | role pill from the author's role |
| reads | int ≥0 | yes | seeded counter (BR-M09-07) |
| createdAt, updatedAt | datetime | yes | |

### 6.7 DATA-M09-07 — PerutusanReaction · DATA-M09-08 — PerutusanComment · DATA-M09-09 — PerutusanRead

`PerutusanReaction` = `{id, perutusanId, userId, type: 'like'|'love'|'thanks', createdAt}` (unique per user, post, type). `PerutusanComment` = `{id, perutusanId, userId, body ≤1000, status: 'pending'|'approved'|'rejected', createdAt}`. `PerutusanRead` = `{perutusanId, userId, readAt}` (unique; increments `reads` once).

API shapes: `PerutusanCard` = `{id, title, excerpt, isPinned, hasVideo, scopeLabel, createdAt, author: {name, initials, roleLabel}, topReaction: {type, emoji, count} | null, commentCount, reads}`; `PerutusanDetail` = card + `{body, youtubeEmbedUrl, images, documents, isPublic, publicUrl, reactions: {like, love, thanks}, myReactions: string[], canWrite}`.

### 6.8 DATA-M09-10 — ScreenshotFile · DATA-M09-11 — SupportConfig · DATA-M09-12 — Users, schools, subjects, levels used

`ScreenshotFile` = `{id, fileName (sanitised), originalName, size, mimeType, uploadedById, createdAt}` (private). `SupportConfig` = `{email: 'support@prestasiplus.my', whatsappNumber: '60123456789'}` (DV-M09-14: the owner replaces the number; OQ-M09-10). Users (M01 DATA-M01-01 / M02 DATA-M02-01: `id`, `name`, `role`, `schoolId`), schools (M02), subjects and levels (M03 `GET /api/subjects`, `GET /api/education-levels`): M09 reads them and writes none.

### 6.8b DATA-M09-14 — ArticleAttachment (owned by M09; XL2-19)

`{id: int (runtime, from 1), articleId: int → Article, fileName: string (original name), label: string \| null (≤ 255, "Label (opsional)"), mime: string, size: int (bytes ≤ 20,971,520), storedPath: string, createdAt: datetime}`. Written only through `articles.createFromTeacher` / `updateFromTeacher`, deleted through `articles.deleteAttachment` (M10 #70 `DELETE /api/guru/articles/attachments/:id`, `confirm('Padam lampiran ini?')`). Seed: none (no live article with attachments was observed). Field names follow M10 SRS #67 (`attachments[] {file, label?}`); `mime`, `size` and `storedPath` are INFERRED storage fields.

### 6.8a DATA-M09-13 — VideoSchool (owned by M09; INFERRED source, AUD-M09-05)

`{userId: int → User, schoolId: int → M02 school}` (unique per user). The school the video form offers as "Sekolah Saya" and the scope of `visibility = school` videos. It is **not** the profile `school_id` (M01/M02): on live the admin's `/profile/edit` has a selected school while `/video/tambah` shows "Tiada sekolah" (OBSERVED), so the form reads another relation, whose real origin is unknown (INFERRED, e.g. a class or staff membership; OQ-M09-07). Seed: one row, user 5 → 900001 (provisional, for the enabled case); no row for the admin (as live). M01/M02 are unchanged.

### 6.9 Seed data (fictitious people only; public content titles as live)

**Clock:** `mock.setNow('2026-09-25T15:40:00+08:00')` — the project default shared with M05/M08/M10/M11 (XL2-33); every observed relative age ("7 / 8 / 9 bulan", "6 bulan") holds at it (`seed_articles2.js` re-run). **Random:** `mock.setRandomSeed(1)` by default (hot section, BR-M09-05).

**Users** — the canonical seed accounts 1–11 (M01 SRS, TRACKER; ids fixed) plus M09 fixture users that are **anchors inside the users dataset** (D11, users id policy: generated ids 1–6,000; M09 anchors use the free block **3101–3109**, clear of M08 3001–3012 and M02 5001–5999; runtime-created users start at 9,000,001). Each anchor claims a slot of its own role cell, so no user count changes.

| id | E-mail | Name | Role | School (profile) | Video-form school (`videoSchools`) | M09 use |
|---|---|---|---|---|---|---|
| 1 | admin@demo.test | Admin Demo | admin | 900002 SK Demo (canonical) | none (as live) | author "A" of 36 articles and all notes; uploader of every seeded video (all 2,260 live rows) |
| 2 | pelajar@demo.test | Pelajar Demo | student | 900001 SMK DEMO | — | provisional scope/read/reaction scenarios |
| 4 | pelajarmaju@demo.test | Pelajar Maju Demo | student | 900004 SK Demo Bestari (M02 v1.16) | — | sees no school post (#2, #3), only national posts (provisional) |
| 5 | guru@demo.test | Guru Demo | teacher | 900001 SMK DEMO | 900001 SMK DEMO (INFERRED, provisional) | "Sekolah Saya" enabled case; like on #4 |
| 3101 | cikgudemo01@demo.test | Cikgu Demo 01 | teacher | — | — | author "C" of the 36 articles shown with a masked author on live (one fictitious author; the number of live authors is unknown) |
| 3102 | azlan@demo.test | Azlan Demo | school_admin | 900003 SMK Demo Seri Putra (fictitious; M02 v1.6 anchor) | — | author of perutusan #4 ("AD") |
| 3103 | salina@demo.test | Salina Aziz Demo | school_admin | 900001 SMK DEMO | — | author of perutusan #2 ("SA") |
| 3104 | suhaimi@demo.test | Suhaimi Mat Demo | school_admin | 900002 SK Demo | — | author of perutusan #3 ("SM") |
| 3105–3109 | reaksi1…5@demo.test | Pelajar Reaksi 1 … 5 | student | — | — | the 5 "love" reactions on perutusan #3 |

Cross-module anchors — **recorded (M02 v1.6)** and in the TRACKER canonical note (AUD-M09-R2-02; OQ-M09-13c closed): the fictitious school anchor 900003 "SMK Demo Seri Putra" (the live post title's school name stays only as title text) and the M09 user anchor block 3101–3109 in the users id policy.

**Articles — the 72 live articles, all published, 13 featured** (AUD-M09-01). Source: the live admin list `/admin/articles?page=1…4`, read in full on 2026-09-25 (id, star, title ≤ 50 characters, author = platform account or masked person, category, level, views, created date), kept as repo evidence without names in `docs/discovery/inventory/M09/_live-articles.json`, full titles of the 12 truncated rows from the `/artikel` cards (¹), and the reader order of `/artikel` pages 1, 2 and 4 plus `?category=BERITA`, TIPS page 2 and `?search=sifir`. Everything in the table is OBSERVED except: the publish dates (seed-assigned, chosen only to reproduce the observed reader order and the observed "7 / 8 / 9 bulan" ages — #10 "24 Dec 2025" is OBSERVED); the slugs marked "(seed)" (`Str::slug` of the title; the others are live hrefs); authors, which are fictitious: the platform account → account 1 "Admin Demo" ("A", 36 articles); every masked private author → the one fictitious author 3101 "Cikgu Demo 01" ("C", 36 articles; the number of distinct live persons is not observable); views of #10 = 596 (discovery; the audit read 597 after later visits, ²). Builder `seed_articles2.js` asserts: admin order = the live list order (page 1 = ids 10–29, page 4 = 70, 71, 72, 9, 1…8); MOTIVASI 14 (ids 5, 25–37, first row #25); TIPS_BELAJAR 21 with admin page 2 = #8; BERITA 7 in reader order 65…59; admin "sifir" = #17, #6; reader pages 1, 2, 4 = the live titles in live order; TIPS reader page 2 = #12, #11, #10; related of #10 = #9, #1, #2; the observed "POPULAR" cards (#23 526, #28 532, #43 514, #57 574, #64 549) all lie in the top-10 non-featured by views (#11, 57, 64, 67, 28, 23, 43, 63, 42, 26); every observed relative age holds at the clock. Created: ids 10–72 22/02/2026, id 9 10/02/2026, ids 1–8 06/02/2026 (OBSERVED; time of day seed 10:00). Likes: #10 = 6 (OBSERVED), others 0 (seed). Excerpts: live for the 32 articles whose cards were captured, otherwise "Ringkasan contoh untuk {title}." (seed). Content: #10 = the live body (discovery Appendix B S16); #11 = the live start "<h2>Apa Itu Mind Map?</h2><p>Mind map atau peta minda ialah …" completed with seed text; others `<h2>{title}</h2><p>{excerpt}</p>` (seed).

**D54 (DV-M09-22, 2026-10-24): the "Level" column below is the live value as observed. The rebuild seeds `TINGKATAN_4` for the live DARJAH_1…DARJAH_4 rows (26) and `TINGKATAN_5` for DARJAH_5 / DARJAH_6 (16); `SEMUA` stays (30). Reworded for D54: #6 title ("Cara Mudah Hafal Sifir dan Formula Matematik"), #52 "Pelajar Tingkatan 5 …", #54 "Pelajar Tingkatan 4 …", #57 "… Sekolah Menengah …" (slug follows), #64 and #69 excerpts ("sekolah menengah").**

| id | Title | Category | Level | Feat. | Author | Views | Created | Published (+08:00, seed) | Slug |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5 Tips Belajar Matematik yang Menyeronokkan | TIPS_BELAJAR | SEMUA | yes | Admin Demo (id 1) | 543 | 2026-02-06 | 2026-02-20 09:00 | `5-tips-belajar-matematik` |
| 2 | Cara Baca Buku Cerita dalam Bahasa Inggeris | TIPS_BELAJAR | SEMUA | yes | Admin Demo (id 1) | 351 | 2026-02-06 | 2026-02-20 09:00 | `cara-baca-buku-cerita-bahasa-inggeris` |
| 3 | Sains Menyeronokkan: Eksperimen Mudah di Rumah | TIPS_BELAJAR | SEMUA | — | Admin Demo (id 1) | 273 | 2026-02-06 | 2026-02-20 09:00 | `sains-menyeronokkan-eksperimen-di-rumah` |
| 4 | Panduan Ibu Bapa: Jadual Belajar untuk Anak | PANDUAN_IBU_BAPA | SEMUA | yes | Admin Demo (id 1) | 288 | 2026-02-06 | 2026-02-20 09:00 | `panduan-ibu-bapa-jadual-belajar` |
| 5 | Motivasi: Cerita Kejayaan Pelajar Cemerlang | MOTIVASI | SEMUA | — | Admin Demo (id 1) | 187 | 2026-02-06 | 2026-02-20 09:00 | `motivasi-cerita-kejayaan-pelajar-cemerlang` |
| 6 | Cara Mudah Hafal Sifir untuk Darjah 2 dan 3 | TIPS_BELAJAR | DARJAH_3 | — | Admin Demo (id 1) | 213 | 2026-02-06 | 2026-02-20 09:00 | `cara-mudah-hafal-sifir` |
| 7 | Panduan Guru: Menggunakan PRESTASIPLUS dalam Kelas | PANDUAN_GURU | SEMUA | — | Admin Demo (id 1) | 158 | 2026-02-06 | 2026-02-20 09:00 | `panduan-guru-menggunakan-jombelajar` |
| 8 | Apa Itu Kombo dan Kenapa Ia Penting? | TIPS_BELAJAR | SEMUA | — | Admin Demo (id 1) | 152 | 2026-02-06 | 2026-02-20 09:00 | `apa-itu-kombo` |
| 9 | AI Ini Apa Sebenarnya? Jom Fahami Bersama! | TIPS_BELAJAR | DARJAH_5 | — | Cikgu Demo 01 (id 3101) | 310 | 2026-02-10 | 2026-02-21 09:00 | `ai-ini-apa-sebenarnya-jom-fahami-bersama` |
| 10 | Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit | TIPS_BELAJAR | DARJAH_4 | yes | Admin Demo (id 1) | 596 ² | 2026-02-22 | 2025-12-24 09:00 | `teknik-pomodoro-belajar-25-minit-rehat-5-minit` |
| 11 | Cara Buat Nota Bergambar (Mind Map) yang Berkesan | TIPS_BELAJAR | DARJAH_5 | — | Cikgu Demo 01 (id 3101) | 605 | 2026-02-22 | 2025-12-25 09:00 | `cara-buat-nota-bergambar-mind-map-yang-berkesan` |
| 12 | Rahsia Pelajar Cemerlang: Ulangkaji Sebelum Tidur | TIPS_BELAJAR | DARJAH_6 | — | Cikgu Demo 01 (id 3101) | 290 | 2026-02-22 | 2025-12-30 03:00 | `rahsia-pelajar-cemerlang-ulangkaji-sebelum-tidur` |
| 13 | Belajar Bahasa Melayu: Teknik KWLH untuk Pemahaman | TIPS_BELAJAR | DARJAH_3 | yes | Admin Demo (id 1) | 448 | 2026-02-22 | 2025-12-30 17:00 | `belajar-bahasa-melayu-teknik-kwlh-untuk-pemahaman` |
| 14 | Tips Jawab Soalan Matematik Bercerita | TIPS_BELAJAR | DARJAH_2 | — | Cikgu Demo 01 (id 3101) | 180 | 2026-02-22 | 2025-12-31 07:00 | `tips-jawab-soalan-matematik-bercerita` (seed) |
| 15 | Cara Hafal Ejaan Bahasa Inggeris dengan Mudah | TIPS_BELAJAR | DARJAH_1 | — | Cikgu Demo 01 (id 3101) | 178 | 2026-02-22 | 2025-12-31 21:00 | `cara-hafal-ejaan-bahasa-inggeris-dengan-mudah` (seed) |
| 16 | Teknik SQ3R: Cara Baca Buku Teks dengan Berkesan | TIPS_BELAJAR | DARJAH_6 | — | Cikgu Demo 01 (id 3101) | 429 | 2026-02-22 | 2026-01-01 11:00 | `teknik-sq3r-cara-baca-buku-teks-dengan-berkesan` (seed) |
| 17 | Cara Mudah Belajar Sifir Darab 6 hingga 9 | TIPS_BELAJAR | DARJAH_3 | yes | Cikgu Demo 01 (id 3101) | 648 | 2026-02-22 | 2026-01-02 01:00 | `cara-mudah-belajar-sifir-darab-6-hingga-9` |
| 18 | Cara Tulis Karangan yang Mendapat Markah Tinggi | TIPS_BELAJAR | DARJAH_5 | — | Cikgu Demo 01 (id 3101) | 328 | 2026-02-22 | 2026-01-02 15:00 | `cara-tulis-karangan-yang-mendapat-markah-tinggi` (seed) |
| 19 | Belajar Sains: Cara Ingat Nama Saintifik dengan Mudah ¹ | TIPS_BELAJAR | DARJAH_4 | — | Cikgu Demo 01 (id 3101) | 289 | 2026-02-22 | 2026-01-03 05:00 | `belajar-sains-cara-ingat-nama-saintifik-dengan-mudah` (seed) |
| 20 | Teknik Feynman: Belajar dengan Mengajar Orang Lain | TIPS_BELAJAR | SEMUA | — | Cikgu Demo 01 (id 3101) | 454 | 2026-02-22 | 2026-01-03 19:00 | `teknik-feynman-belajar-dengan-mengajar-orang-lain` (seed) |
| 21 | Cara Buat Jadual Belajar yang Realistik | TIPS_BELAJAR | SEMUA | — | Admin Demo (id 1) | 430 | 2026-02-22 | 2026-01-04 09:00 | `cara-buat-jadual-belajar-yang-realistik` (seed) |
| 22 | Tips Belajar Sejarah Tanpa Menghafal | TIPS_BELAJAR | DARJAH_4 | — | Admin Demo (id 1) | 96 | 2026-02-22 | 2026-01-04 23:00 | `tips-belajar-sejarah-tanpa-menghafal` (seed) |
| 23 | Cara Buat Revision Berkesan Seminggu Sebelum Peperiksaan ¹ | TIPS_BELAJAR | DARJAH_6 | — | Admin Demo (id 1) | 526 | 2026-02-22 | 2026-01-05 13:00 | `cara-buat-revision-berkesan-seminggu-sebelum-peperiksaan` |
| 24 | Belajar Sambil Bermain: Permainan Pendidikan di Rumah ¹ | TIPS_BELAJAR | DARJAH_1 | yes | Admin Demo (id 1) | 394 | 2026-02-22 | 2026-01-06 03:00 | `belajar-sambil-bermain-permainan-pendidikan-di-rumah` |
| 25 | Kegagalan Bukan Pengakhiran, Tapi Permulaan | MOTIVASI | SEMUA | — | Admin Demo (id 1) | 172 | 2026-02-22 | 2026-01-06 17:00 | `kegagalan-bukan-pengakhiran-tapi-permulaan` (seed) |
| 26 | Kisah Pelajar Kampung yang Berjaya ke Universiti | MOTIVASI | DARJAH_6 | — | Admin Demo (id 1) | 480 | 2026-02-22 | 2026-01-07 07:00 | `kisah-pelajar-kampung-yang-berjaya-ke-universiti` |
| 27 | Kenapa Kamu Patut Bangun Awal Setiap Pagi | MOTIVASI | SEMUA | — | Admin Demo (id 1) | 331 | 2026-02-22 | 2026-01-07 21:00 | `kenapa-kamu-patut-bangun-awal-setiap-pagi` |
| 28 | Jangan Bandingkan Diri dengan Orang Lain | MOTIVASI | SEMUA | — | Admin Demo (id 1) | 532 | 2026-02-22 | 2026-01-08 11:00 | `jangan-bandingkan-diri-dengan-orang-lain` (seed) |
| 29 | Kuasa Kata-Kata Positif dalam Pembelajaran | MOTIVASI | DARJAH_4 | — | Admin Demo (id 1) | 258 | 2026-02-22 | 2026-01-09 01:00 | `kuasa-kata-kata-positif-dalam-pembelajaran` (seed) |
| 30 | Tokoh Saintis Muslim yang Mengubah Dunia | MOTIVASI | DARJAH_5 | — | Admin Demo (id 1) | 381 | 2026-02-22 | 2026-01-09 15:00 | `tokoh-saintis-muslim-yang-mengubah-dunia` (seed) |
| 31 | Cara Atasi Rasa Malas Belajar | MOTIVASI | SEMUA | yes | Admin Demo (id 1) | 483 | 2026-02-22 | 2026-01-10 05:00 | `cara-atasi-rasa-malas-belajar` (seed) |
| 32 | Impian Besar Bermula dari Langkah Kecil | MOTIVASI | DARJAH_3 | — | Cikgu Demo 01 (id 3101) | 79 | 2026-02-22 | 2026-01-10 19:00 | `impian-besar-bermula-dari-langkah-kecil` (seed) |
| 33 | Kenapa Membaca Buku Itu Penting | MOTIVASI | DARJAH_2 | — | Admin Demo (id 1) | 114 | 2026-02-22 | 2026-01-11 09:00 | `kenapa-membaca-buku-itu-penting` (seed) |
| 34 | Disiplin Lebih Penting dari Motivasi | MOTIVASI | DARJAH_6 | — | Cikgu Demo 01 (id 3101) | 463 | 2026-02-22 | 2026-01-11 23:00 | `disiplin-lebih-penting-dari-motivasi` (seed) |
| 35 | Bersyukur dengan Peluang Belajar | MOTIVASI | SEMUA | — | Admin Demo (id 1) | 228 | 2026-02-22 | 2026-01-12 13:00 | `bersyukur-dengan-peluang-belajar` (seed) |
| 36 | Cara Hadapi Tekanan Peperiksaan | MOTIVASI | DARJAH_5 | — | Admin Demo (id 1) | 262 | 2026-02-22 | 2026-01-13 03:00 | `cara-hadapi-tekanan-peperiksaan` (seed) |
| 37 | Kamu Lebih Hebat dari Apa yang Kamu Fikir | MOTIVASI | DARJAH_4 | — | Cikgu Demo 01 (id 3101) | 426 | 2026-02-22 | 2026-01-13 17:00 | `kamu-lebih-hebat-dari-apa-yang-kamu-fikir` (seed) |
| 38 | Cara Bantu Anak Buat Kerja Rumah Tanpa Drama | PANDUAN_IBU_BAPA | SEMUA | yes | Cikgu Demo 01 (id 3101) | 481 | 2026-02-22 | 2026-01-14 07:00 | `cara-bantu-anak-buat-kerja-rumah-tanpa-drama` |
| 39 | Tanda-Tanda Anak Menghadapi Tekanan Belajar | PANDUAN_IBU_BAPA | SEMUA | — | Cikgu Demo 01 (id 3101) | 215 | 2026-02-22 | 2026-01-14 21:00 | `tanda-tanda-anak-menghadapi-tekanan-belajar` (seed) |
| 40 | Cara Hadkan Masa Skrin Anak dengan Bijak | PANDUAN_IBU_BAPA | DARJAH_1 | — | Cikgu Demo 01 (id 3101) | 369 | 2026-02-22 | 2026-01-15 11:00 | `cara-hadkan-masa-skrin-anak-dengan-bijak` (seed) |
| 41 | Kepentingan Sarapan Pagi untuk Prestasi Sekolah | PANDUAN_IBU_BAPA | DARJAH_2 | — | Cikgu Demo 01 (id 3101) | 359 | 2026-02-22 | 2026-01-16 01:00 | `kepentingan-sarapan-pagi-untuk-prestasi-sekolah` (seed) |
| 42 | Cara Galakkan Anak Membaca Tanpa Paksaan | PANDUAN_IBU_BAPA | DARJAH_3 | — | Cikgu Demo 01 (id 3101) | 492 | 2026-02-22 | 2026-01-16 15:00 | `cara-galakkan-anak-membaca-tanpa-paksaan` (seed) |
| 43 | Memilih Tuisyen yang Tepat untuk Anak | PANDUAN_IBU_BAPA | DARJAH_4 | — | Admin Demo (id 1) | 514 | 2026-02-22 | 2026-01-17 05:00 | `memilih-tuisyen-yang-tepat-untuk-anak` |
| 44 | Ruang Belajar Ideal untuk Anak di Rumah | PANDUAN_IBU_BAPA | DARJAH_1 | — | Cikgu Demo 01 (id 3101) | 214 | 2026-02-22 | 2026-01-17 19:00 | `ruang-belajar-ideal-untuk-anak-di-rumah` (seed) |
| 45 | Peranan Ibu Bapa dalam Kejayaan Anak di Sekolah | PANDUAN_IBU_BAPA | SEMUA | yes | Cikgu Demo 01 (id 3101) | 407 | 2026-02-22 | 2026-01-18 09:00 | `peranan-ibu-bapa-dalam-kejayaan-anak-di-sekolah` (seed) |
| 46 | Cara Ajar Anak Mengurus Masa | PANDUAN_IBU_BAPA | DARJAH_5 | — | Cikgu Demo 01 (id 3101) | 154 | 2026-02-22 | 2026-01-18 23:00 | `cara-ajar-anak-mengurus-masa` (seed) |
| 47 | Teknik Pengajaran Aktif untuk Kelas Matematik | PANDUAN_GURU | SEMUA | — | Admin Demo (id 1) | 359 | 2026-02-22 | 2026-01-19 13:00 | `teknik-pengajaran-aktif-untuk-kelas-matematik` (seed) |
| 48 | Menangani Pelajar yang Berbeza Tahap Kemahiran | PANDUAN_GURU | SEMUA | — | Cikgu Demo 01 (id 3101) | 277 | 2026-02-22 | 2026-01-20 03:00 | `menangani-pelajar-yang-berbeza-tahap-kemahiran` (seed) |
| 49 | Cara Gunakan Teknologi dalam Pengajaran Harian | PANDUAN_GURU | SEMUA | — | Admin Demo (id 1) | 135 | 2026-02-22 | 2026-01-20 17:00 | `cara-gunakan-teknologi-dalam-pengajaran-harian` (seed) |
| 50 | Teknik Soalan Aras Tinggi (KBAT) dalam Kelas | PANDUAN_GURU | DARJAH_5 | — | Cikgu Demo 01 (id 3101) | 276 | 2026-02-22 | 2026-01-21 07:00 | `teknik-soalan-aras-tinggi-kbat-dalam-kelas` (seed) |
| 51 | Cara Bina Hubungan Positif dengan Pelajar | PANDUAN_GURU | SEMUA | — | Cikgu Demo 01 (id 3101) | 378 | 2026-02-22 | 2026-01-21 21:00 | `cara-bina-hubungan-positif-dengan-pelajar` (seed) |
| 52 | Pelajar Darjah 6 Menang Pertandingan Inovasi Kebangsaan ¹ | KEJAYAAN | DARJAH_6 | yes | Cikgu Demo 01 (id 3101) | 620 | 2026-02-22 | 2026-01-22 11:00 | `pelajar-darjah-6-menang-pertandingan-inovasi-kebangsaan` (seed) |
| 53 | Dari Sekolah Luar Bandar ke Universiti Luar Negara | KEJAYAAN | SEMUA | — | Cikgu Demo 01 (id 3101) | 480 | 2026-02-22 | 2026-01-23 01:00 | `dari-sekolah-luar-bandar-ke-universiti-luar-negara` (seed) |
| 54 | Pelajar Darjah 4 Cipta Aplikasi Belajar untuk Adiknya ¹ | KEJAYAAN | DARJAH_4 | — | Admin Demo (id 1) | 168 | 2026-02-22 | 2026-01-23 15:00 | `pelajar-darjah-4-cipta-aplikasi-belajar-untuk-adiknya` (seed) |
| 55 | Sekolah di Pedalaman Sarawak Raih Keputusan Cemerlang ¹ | KEJAYAAN | SEMUA | — | Admin Demo (id 1) | 397 | 2026-02-22 | 2026-01-24 05:00 | `sekolah-di-pedalaman-sarawak-raih-keputusan-cemerlang` (seed) |
| 56 | Guru Muda Ubah Cara Pelajar Belajar Sains | KEJAYAAN | DARJAH_3 | — | Admin Demo (id 1) | 464 | 2026-02-22 | 2026-01-24 19:00 | `guru-muda-ubah-cara-pelajar-belajar-sains` (seed) |
| 57 | Pasukan Robotik Sekolah Rendah Menang di Peringkat Antarabangsa ¹ | KEJAYAAN | DARJAH_5 | — | Cikgu Demo 01 (id 3101) | 574 | 2026-02-22 | 2026-01-25 09:00 | `pasukan-robotik-sekolah-rendah-menang-di-peringkat-antarabang` |
| 58 | Pelajar Autisme Menjadi Juara Pertandingan Matematik ¹ | KEJAYAAN | DARJAH_4 | — | Admin Demo (id 1) | 349 | 2026-02-22 | 2026-02-05 09:00 | `pelajar-autisme-menjadi-juara-pertandingan-matematik` (seed) |
| 59 | KPM Umum Penambahbaikan Kurikulum KSSR 2026 | BERITA | SEMUA | yes | Cikgu Demo 01 (id 3101) | 417 | 2026-02-22 | 2026-02-06 09:00 | `kpm-umum-penambahbaikan-kurikulum-kssr-2026` (seed) |
| 60 | Program Tuisyen Percuma oleh Universiti untuk Pelajar B40 ¹ | BERITA | SEMUA | — | Cikgu Demo 01 (id 3101) | 161 | 2026-02-22 | 2026-02-07 09:00 | `program-tuisyen-percuma-oleh-universiti-untuk-pelajar-b40` (seed) |
| 61 | Malaysia Naik 10 Anak Tangga dalam Ranking PISA | BERITA | SEMUA | — | Admin Demo (id 1) | 271 | 2026-02-22 | 2026-02-08 09:00 | `malaysia-naik-10-anak-tangga-dalam-ranking-pisa` (seed) |
| 62 | Sekolah-Sekolah Mula Guna Platform Digital untuk Latih Tubi ¹ | BERITA | SEMUA | — | Cikgu Demo 01 (id 3101) | 240 | 2026-02-22 | 2026-02-09 09:00 | `sekolah-sekolah-mula-guna-platform-digital-untuk-latih-tubi` (seed) |
| 63 | Kempen "Sifar Buli" Dilancarkan di Sekolah Seluruh Negara ¹ | BERITA | SEMUA | — | Cikgu Demo 01 (id 3101) | 503 | 2026-02-22 | 2026-02-10 09:00 | `kempen-sifar-buli-dilancarkan-di-sekolah-seluruh-negara` (seed) |
| 64 | Pertandingan Menulis Karangan Kreatif Kebangsaan 2026 ¹ | BERITA | DARJAH_4 | — | Admin Demo (id 1) | 549 | 2026-02-22 | 2026-02-11 09:00 | `pertandingan-menulis-karangan-kreatif-kebangsaan-2026` |
| 65 | Perpustakaan Bergerak Sampai ke Pedalaman Sabah | BERITA | DARJAH_2 | — | Cikgu Demo 01 (id 3101) | 205 | 2026-02-22 | 2026-02-12 09:00 | `perpustakaan-bergerak-sampai-ke-pedalaman-sabah` |
| 66 | Selamat Datang ke PRESTASIPLUS | UMUM | SEMUA | yes | Admin Demo (id 1) | 490 | 2026-02-22 | 2026-02-13 09:00 | `selamat-datang-ke-prestasi` |
| 67 | Panduan Keselamatan Internet untuk Pelajar | UMUM | DARJAH_4 | — | Cikgu Demo 01 (id 3101) | 539 | 2026-02-22 | 2026-02-14 09:00 | `panduan-keselamatan-internet-untuk-pelajar` |
| 68 | Aktiviti Menyeronokkan untuk Cuti Sekolah | UMUM | DARJAH_3 | — | Cikgu Demo 01 (id 3101) | 400 | 2026-02-22 | 2026-02-15 09:00 | `aktiviti-menyeronokkan-untuk-cuti-sekolah` |
| 69 | Apa Itu STEM dan Kenapa Ia Penting? | UMUM | DARJAH_5 | — | Admin Demo (id 1) | 421 | 2026-02-22 | 2026-02-16 09:00 | `apa-itu-stem-dan-kenapa-ia-penting` |
| 70 | Kepentingan Tidur Cukup untuk Pelajar | UMUM | SEMUA | — | Cikgu Demo 01 (id 3101) | 432 | 2026-02-22 | 2026-02-17 09:00 | `kepentingan-tidur-cukup-untuk-pelajar` |
| 71 | Cara Jaga Kesihatan Mata Semasa Belajar | UMUM | DARJAH_6 | — | Cikgu Demo 01 (id 3101) | 172 | 2026-02-22 | 2026-02-18 09:00 | `cara-jaga-kesihatan-mata-semasa-belajar` |
| 72 | Tabiat Makan Sihat untuk Pelajar Pintar | UMUM | DARJAH_2 | — | Admin Demo (id 1) | 257 | 2026-02-22 | 2026-02-19 09:00 | `tabiat-makan-sihat-untuk-pelajar-pintar` |

**Notes — D54 PoC seed (DV-M09-22, 2026-10-24; supersedes the 10 live Darjah 1–4 notes, the live list stays in discovery A.3).** 10 notes by Admin Demo, published, 0 tontonan, 0 muat turun, created 2026-02-06 10:00; titles follow public KSSM chapter names in M03 `curriculum.json`; the note types keep the live split (RINGKASAN 5, FORMULA 2, LENGKAP 2, TIPS_TRICKS 1); body is the neutral `<h2>{title}</h2><p>Nota contoh.</p>`:

| id | Title | Subject | Type | Grade |
|---|---|---|---|---|
| 1 | Fungsi dan Persamaan Kuadratik — Formula Ringkas | matematik | FORMULA | TINGKATAN_4 |
| 2 | Pembezaan — Formula Asas | matematik_tambahan | FORMULA | TINGKATAN_5 |
| 3 | Ikatan Kimia — Nota Ringkas | kimia | RINGKASAN | TINGKATAN_4 |
| 4 | Biologi Sel dan Organisasi Sel — Nota Ringkas | biologi | RINGKASAN | TINGKATAN_4 |
| 5 | Kemahiran Bahasa Tingkatan 5 — Nota Lengkap | bahasa_melayu | LENGKAP | TINGKATAN_5 |
| 6 | Sejarah Tingkatan 4 — Nota Ringkas | sejarah | RINGKASAN | TINGKATAN_4 |
| 7 | English Form 5 — Quick Guide | bahasa_inggeris | RINGKASAN | TINGKATAN_5 |
| 8 | English Form 4 — Exam Tips | bahasa_inggeris | TIPS_TRICKS | TINGKATAN_4 |
| 9 | Daun dan Fotosintesis — Nota Ringkas | biologi | RINGKASAN | TINGKATAN_5 |
| 10 | Termokimia — Nota dan Contoh | kimia | LENGKAP | TINGKATAN_5 |

Checks: `subject=matematik` → 3 (OBSERVED); `search=sifir` → 1 (OBSERVED); RINGKASAN 5 (OBSERVED count), LENGKAP 2.

**Banners — the 5 live banners** (all active, 2026-01-01 → 2026-12-31, link `NONE`, image the live Unsplash URL kept as data only):

| id | Order | Type | Audience | Title | Description |
|---|---|---|---|---|---|
| 1 | 1 | HERO | ALL | Selamat Datang ke PRESTASIPLUS | Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar hari ini! |
| 2 | 2 | FEATURE | STUDENT | 2,000+ Soalan Latihan Tersedia! | Latih diri dengan ribuan soalan Matematik, Sains, BM dan BI. Kumpul coins dan naik ranking! |
| 3 | 3 | PROMOTIONAL | STUDENT | Cabaran Mingguan: Siapa Paling Rajin? | Sertai cabaran mingguan dan lihat nama kamu di papan pendahulu. Streak 7 hari = bonus coins! |
| 4 | 4 | ANNOUNCEMENT | ALL | Tips untuk Ibu Bapa: Bimbing Anak Belajar | Panduan untuk ibu bapa membantu anak-anak cemerlang dalam pelajaran. Klik untuk baca lebih lanjut. |
| 5 | 5 | FEATURE | STUDENT | Kumpul Badge & Tunjukkan Kehebatan! | 15 badge istimewa menanti! Jawab soalan, kekalkan streak, dan jadi juara kelas. |

These are the same 5 records M05 §6.12 seeds (OQ-M09-13a: one store).

**Audio KBAT sets — 0** (as live). Provisional fixture `seedAudioKbatSet()` (never in the default seed; E2E-42/46 only): set 1 "BM T4 Ujian Mendengar Set 1" (level 10 Tingkatan 4, subject 1 Bahasa Melayu, `approved`, source "Cikgu Demo 02", 4 sections "Audio 1"…"Audio 4" with file names `audio1.mp3`…, 30 questions "Soalan contoh {n}" with options "Pilihan A {n}"…, answer A, marks 1, KBAT 3) and set 2 same shape `draft`, title "BI T5 Ujian Mendengar Set 1" (level 11, subject 2).

**Videos — 2,260 live rows (D22, 2026-10-02).** The video seed is **all live data** — no generated, placeholder or fabricated rows. Source: the guest `/video` list pages walked on 2026-10-02, kept as repo evidence in `docs/discovery/inventory/M09/_live-videos.json` (total 2,260; pill counts: category motivasi 3 / tutorial 12 / tips-spm 3 / ceramah 2,242 / lain-lain 0; subject 3 Matematik 865, 5 Sejarah 97, 8 Matematik Tambahan 420, 9 Fizik 779, 10 Kimia 96, no subject 3). Per row: **title** real (4 titles that named a real person are privacy-masked to "Cikgu Demo", CLAUDE.md §6); **YouTube id** real (thumbnail `img.youtube.com/vi/{id}/hqdefault.jpg`, embed `https://www.youtube.com/embed/{id}`); **views** as shown on the live list ("{n} tontonan", captured 2026-10-02); **category** as observed or derived (ceramah = all minus the other categories; totals reconcile 3 + 12 + 3 + 2,242 = 2,260); **subject** per DV-M09-20; platform Youtube, visibility `global`, **uploader = the canonical admin** (id 1 "Admin Demo"); list position per BR-M09-19. The store is a **materialised table of 2,260 rows** (runtime-created rows get ids from 2,261); every count on S17 is computed from it (§6.11). Every row is an observed record; there are no seed-assigned rows (the subject of 326 rows is rule-assigned, DV-M09-20).

*Superseded (v1.8):* the earlier "Generated rows" rule (title "Video {subject or category} {id}", views `30 + (id mod 71)`, external ids `SEED{id}`), the §6.9 id-range table (it disagreed with 65 observed rows and is dropped), the five-series round-robin order and the 30-row anchor table. The earlier anchor view counts (e.g. #2224 = 121) were read in discovery; the 2026-10-02 capture supersedes them (#2224 = 134).

**Seeded detail of #2224** (the one video whose description was captured): created "03 Mar 2026" (OBSERVED), description "Kredit penuh kepada Cikgu Demo — seorang pendidik Sejarah yang luar biasa dan berdedikasi. Terima kasih Cikgu kerana berkongsi ilmu dengan begitu jelas dan mudah difahami. Semoga usaha Cikgu diberkati! Sumber asal: https://www.youtube.com/@cikgudemo Video ini dikongsi untuk tujuan pendidikan …" (live text with the masked name and channel replaced by fictitious ones). The YouTube id of every row, #2224 included, is the real live id.

**Order and age (BR-M09-19).** `listKey` = 2260 − captured position. `createdAt` reproduces the age text shown on live at the default clock: ids 1–20 "7 bulan yang lepas", all other ids "6 bulan yang lepas" (the capture's `ageText` per row); the timestamps are seed-assigned (INFERRED) and chosen only to give those texts and the observed "03 Mar 2026" of #2224. Live order is not monotone in age; the order (list position) and the age (text) are both replicated and neither is derived from the other.

**DV-M09-20 — subject assignment (D9).** Live `?subject={id}` pagination repeats ids across pages, so 329 videos never appear in any subject list (Matematik 143, Matematik Tambahan 69, Fizik 114, plus 3 with no subject) while the pills (865 / 97 / 420 / 779 / 96) include them. Rebuild: every video is under exactly one subject; the subject of the 1,931 rows seen in a subject list is the live subject; the 3 no-subject rows are ids 16, 17 and 19; the other 326 are assigned by, in order: (1) **id-run neighbours** agreeing on both sides (159 rows: ids 256–311 Matematik, 512–563 and 768–818 Fizik); (2) **title keyword** (166 rows; abbreviated "Mat" / "Mate" = Matematik, Kimia / Chemistry, Matematik Tambahan / Add Maths, Fizik / Physics, then Matematik / Mathematics); (3) the one row no rule decides, **id 1052**, takes the subject short of its pill count (Matematik, 1 row). Rule counts: observed 1,931 + no subject 3 + 159 + 166 + 1 = 2,260. Computed subject counts equal the pills, and all category and joint counts of §6.11 hold.

**Perutusan — the 3 live posts** (titles and opening text public content; authors fictitious):

| id | Title | Author (initials) | School / scope | Pinned | Public | Video | Reactions | Reads | Comments | createdAt |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | Video Ucapan Selamat Hari Raya Dari Pihak Pengurusan SMK Bandar Seri Putra (title as live, public content) | Azlan Demo (AD), id 3102 | 900003 SMK Demo Seri Putra (fictitious) / school | yes | yes (OBSERVED) | `https://www.youtube.com/watch?v=SEEDPRT0004` | like 1 (by `guru@demo.test`, id 5) | 3 | 0 | 2026-03-17 23:23 (OBSERVED) |
| 2 | Ucapan Penghargaan & Ramadan – Menyambut Syawal dengan Hikmah | Salina Aziz Demo (SA), id 3103 | 900001 SMK DEMO / school | yes | no (seed-assigned) | — | — | 4 | 0 | 2026-03-16 20:00 (seed) |
| 3 | Video Ucapan Selamat Hari Raya 2026 | Suhaimi Mat Demo (SM), id 3104 | 900002 SK Demo / school | no | no (seed-assigned) | `https://www.youtube.com/watch?v=SEEDPRT0003` | love 5 (by ids 3105–3109) | 55 | 0 | 2026-03-18 08:00 (seed) |

Bodies: #4 = the live HTML of discovery Appendix B S23 (centred header lines "✦ ✦ ✦", basmalah, "Selamat Hari Raya Aidilfitri", …, "Takbir Bergema, Hati Bersatu"); #2 = the live opening "Assalamualaikum warahmatullahi wabarakatuh. Yang dihormati para ibu bapa, para guru yang berdedikasi, dan anak-anak murid yang saya kasihi sekalian. Pertama sekali, saya ingin merakamkan setinggi-tinggi penghargaan dan terima kasih kepada …" completed with seed text; #3 = the live opening shared with #4 ("✦ ✦ ✦ بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ Dengan Nama Allah Yang Maha Pemurah Lagi Maha Penyayang Selamat Hari Raya Aidilfitri 1 Syawal 1447H / 2026M ✦ ✦ ✦ Ucapan Perutusan Hari Raya Aidilfitri 2026 Daripada Pihak Pengurusan Sekolah Kepada …") completed with seed text. No read rows are seeded (the counters hold the live values 3 / 4 / 55; BR-M09-07: the admin's opens and public-page opens never add to them). No comment rows.

**Screenshot files — 0** (as live).

### 6.10 Fixture functions

`mock.reset()`, `mock.setNow(iso)`, `mock.setRandomSeed(n)`, `mock.lastRequest(path)` (shared); `seedAudioKbatSet()` (provisional scenarios only); `seedPerutusanDraft(authorEmail)` (one draft post for E2E-65 only); `seedVideoSchool(userId, schoolId)` (provisional DATA-M09-13 rows beyond the default guru row); `mock.config('supportWhatsappNumber', value)` (DV-M09-14).

### 6.11 Dataset spec (D11, D12; architecture overview §6.6–§6.7, ADR-0013/0014)

*(solution-architect)* M09 owns six stores, all materialised tables seeded from observed records (the 2,260-row **videos** store included since v1.8, D22: no generated rows). Every count shown on an M09 screen, and the M05 dashboard feeds, is a **named query** on the owner's repository (`src/modules/m09-content/mock/repository`); no screen stores a number. Other modules use only these repository methods (ESLint boundary, ADR-0014): M05 `articles.latest(5)`, `banners.activeFor(user)`; M10 (behind its endpoints #66–#70, XL2-19) `articles.listByAuthor(userId, page)` and `articles.statsByAuthor(userId)` (S29 list and stats: total, published, pending, Σ views), `articles.getOwn(id, userId)` (with attachments), `articles.createFromTeacher(userId, {title, content, youtubeUrl?, category, gradeLevel, excerpt?, featuredImageFile?, attachments[] {file, label?}})` → `isPublished = false`, `articles.updateFromTeacher(id, userId, same)` (keeps `isPublished`), `articles.deleteAttachment(attachmentId, userId)`; M24 read-only `articles.get`, `videos.get`. Users and schools are read through the M01/M02 repositories (D12); M09 never copies them.

| Store | Owner / primitive | Total and facets (observed) | Named count queries (screen) | Id range / anchors | Evidence |
|---|---|---|---|---|---|
| articles | M09 · materialised (72 rows) | 72; `category` TIPS_BELAJAR 21, MOTIVASI 14, PANDUAN_IBU_BAPA 10, PANDUAN_GURU 6, KEJAYAAN 7, BERITA 7, UMUM 7; `gradeLevel` SEMUA 30, TINGKATAN_4 26, TINGKATAN_5 16 (D54 remap of the live DARJAH_1 4, DARJAH_2 5, DARJAH_3 7, DARJAH_4 10, DARJAH_5 9, DARJAH_6 7); `isFeatured` 13; `isPublished` 72 | Q-ART-ADMIN(search, category, published) → S1 "Jumlah"/pager; Q-ART-READER(search, category) → S15 pager; Q-ART-HOT-POOL (featured ∪ top-10 non-featured by views) → S15 hot; Q-ART-LATEST(5) → S16 aside, M05; Q-ART-RELATED(id, 3) → S16 | live ids 1–72 (all 72 are observed records); runtime ids from 73 (`maxPlusOne`) | §6.9 table; admin list pages 1–4 |
| notes | M09 · materialised (10) | 10; `subject` (D54 re-seed; live was matematik 3, sains 3, bahasa_melayu 2, bahasa_inggeris 2) matematik 1, matematik_tambahan 1, kimia 2, biologi 2, bahasa_melayu 1, bahasa_inggeris 2, sejarah 1, sains 0, fizik 0; `grade` TINGKATAN_4 5, TINGKATAN_5 5; `noteType` RINGKASAN 5, FORMULA 2, LENGKAP 2, TIPS_TRICKS 1 | Q-NOTE-ADMIN(search, subject, noteType mapped per BR-11) → S5 "Jumlah" | live ids 1–10; runtime from 11 | discovery A.3, S5 states |
| banners | M09 · materialised (5) | 5; all active; HERO 1, FEATURE 2, PROMOTIONAL 1, ANNOUNCEMENT 1; ALL 2, STUDENT 3 | Q-BANNER-ALL → S9 "Jumlah"; Q-BANNER-ACTIVE(user, today) → M05 carousel "n / N" | live ids 1–5; runtime from 6 | S9, M05 S1 |
| audioKbatSets | M09 · materialised (0) | 0 | Q-AUDIO-STATS → S12 cards (Set, Approved, Draft/Pending, Soalan = 30 × sets); Q-AUDIO-ADMIN(level, subject, status, search); Q-AUDIO-APPROVED(level, subject) → S21 | none on live; runtime from 1; provisional fixture only in E2E | S12 "0/0/0/0" |
| videos | M09 · **materialised table** (2,260 rows; D22 supersedes the virtual dataset of D11 for this store) | **2,260**; `category` motivasi 3, tutorial 12, tips-spm 3, ceramah 2,242, lain-lain 0; `subjectId` 3→865, 5→97, 8→420, 9→779, 10→96, null→3 (DV-M09-20); joint Sejarah × category = 1 / 12 / 3 / 81 / 0; `visibility` global 2,260; `platform` Youtube 2,260 | Q-VID-TOTAL(search, subject) → "Semua (n)"; Q-VID-CAT(search, subject) → category pills; Q-VID-SUBJ(search, category) → subject pills; Q-VID-LIST(search, category, subject, page) → grid/pager; Q-VID-RELATED(id, 6) | ids 1–2,260 are all observed live rows (title, YouTube id, views, category, subject per §6.9 / DV-M09-20); runtime ids from 2,261 (`maxPlusOne`); list order = `listKey` desc, runtime rows first by `createdAt` desc (BR-M09-19); `createdAt` carries only the live age text | `_live-videos.json` (capture 2026-10-02); S17 pills and pager, ?subject=5, ?category=motivasi, page 95 |
| perutusan (+ reactions, comments, reads) | M09 · materialised (3 posts) | 3; pinned 2; public 1; reads 3 / 4 / 55; reactions like 1, love 5; comments 0 | Q-PER-VISIBLE(user) → S22 list; Q-PER-READS(id), Q-PER-REACTIONS(id), Q-PER-COMMENTS-APPROVED(id) → S22/S23 counts | live ids 2, 3, 4; runtime from 5 | S22, S23 |
| screenshots, videoSchools, supportConfig | M09 · materialised | 0 files; 1 video-school row (provisional); support e-mail and WhatsApp number | Q-SHOT-COUNT → S14 "Jumlah" | runtime from 1 | S14 |

D9 values: the video subject assignment (DV-M09-20) is the only D9 data fix; every observed M09 count is otherwise consistent (72 = 21+14+10+6+7+7+7; 2,260 = 3+12+3+2,242+0 = 865+97+420+779+96+3).

## 7. Mock API endpoints

*(solution-architect)* Envelope and errors per SRS.md §7.2/§7.3 (`meta` adds `from`, `to` as M01/M02). Auth: **G** = public, **U** = logged-in user, **A** = admin. "Mut." = mutating. Query names mirror the live URLs in camelCase. `404 NOT_FOUND` on unknown ids; `403 FORBIDDEN` for other roles; `401 UNAUTHORIZED` without a session (client → `/login`).

| # | Method | Path | Auth | Mut. | Request | Response (200 unless stated) | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/admin/articles` | A | no | `?search&category&published&page` | `{data: AdminArticleItem[], meta: {page, pageSize: 20, totalItems, totalPages, from, to}}` | 401, 403 | `GET /admin/articles` |
| 2 | GET | `/api/admin/articles/:id` | A | no | — | `{data: AdminArticleDetail}` (never counts a view) | 404 | S3, S4 |
| 3 | POST | `/api/admin/articles` | A | yes | `{title, excerpt?, content, featuredImage?, category, gradeLevel, isPublished, isFeatured}` (no `youtubeUrl` or attachments: not on the admin form; created as null / none) | 201 `{data: AdminArticleDetail, status}` | 422 `fields` | `POST /admin/articles` |
| 4 | PUT | `/api/admin/articles/:id` | A | yes | same (fields absent from the request, incl. `youtubeUrl` and attachments of a teacher article, are left unchanged) | `{data, status}` | 422, 404 | `PUT /admin/articles/{id}` |
| 5 | DELETE | `/api/admin/articles/:id` | A | yes | — | `{data: {deleted: 1}, status}` | 404 | `DELETE /admin/articles/{id}` |
| 6 | GET | `/api/articles` | G | no | `?search&category&page` | `{data: ArticleCard[], meta: {page, pageSize: 18, totalItems, totalPages, from, to}}` (published only) | — | `GET /artikel` |
| 7 | GET | `/api/articles/hot` | G | no | — | `{data: HotCard[6]}` (BR-M09-05; new draw per call) | — | S15 hot section |
| 8 | GET | `/api/articles/:slug` | G | yes (views) | — | `{data: ArticleDetail}` (views +1 before reply) | 404 (unknown or unpublished) | `GET /artikel/{slug}` |
| 9 | GET | `/api/articles/latest` | G | no | `?limit=5` | `{data: ArticleCard[]}` | — | S16 aside, M05 dashboard |
| 10 | GET | `/api/admin/notes` | A | no | `?search&subject&noteType&page` | `{data: NoteItem[], meta}` (pageSize 20) | 401, 403 | `GET /admin/notes` |
| 11 | GET | `/api/admin/notes/:id` | A | no | — | `{data: NoteDetail}` | 404 | S7, S8 |
| 12 | POST | `/api/admin/notes` | A | yes | `{title, summary?, content, subject, noteType, grade, isPublished}` | 201 `{data, status}` | 422 | live 500 (DV-M09-01) |
| 13 | PUT | `/api/admin/notes/:id` | A | yes | same | `{data, status}` | 422, 404 | live 500 (DV-M09-01) |
| 14 | DELETE | `/api/admin/notes/:id` | A | yes | — | `{data: {deleted: 1}, status}` | 404 | `DELETE /admin/notes/{id}` |
| 15 | GET | `/api/admin/banners` | A | no | — | `{data: Banner[]}` (not paginated, BR-M09-12 order) | 401, 403 | `GET /admin/banners` |
| 16 | GET | `/api/admin/banners/:id` | A | no | — | `{data: Banner}` | 404 | S11 |
| 17 | POST | `/api/admin/banners` | A | yes | `{title, description?, imageUrl?, bannerType, linkType, externalUrl?, targetAudience, displayOrder, startDate?, endDate?, isActive}` | 201 `{data, status}` (codes upper-cased) | 422 | `POST /admin/banners` |
| 18 | PUT | `/api/admin/banners/:id` | A | yes | same | `{data, status}` | 422, 404 | `PUT /admin/banners/{id}` |
| 19 | DELETE | `/api/admin/banners/:id` | A | yes | — | `{data: {deleted: 1}, status}` | 404 | `DELETE /admin/banners/{id}` |
| 20 | GET | `/api/banners/active` | U | no | — | `{data: ActiveBanner[]}` (BR-M09-14) | 401 | M05 `bannerCarousel(5)` (M05 `/api/dashboard` embeds it) |
| 21 | GET | `/api/admin/audio-kbat-sets` | A | no | `?educationLevelId&subjectId&status&search&page` | `{data: [{id, title, educationLevel: {id, name}, subject: {id, name}, status, statusLabel, questionCount}], meta: {…, stats: {sets, approved, draftPending, questions}}}` | 401, 403 | `GET /admin/audio-kbat` |
| 22 | GET | `/api/admin/audio-kbat-sets/template` | A | no | `?format=xlsx\|docx` | file (placeholder content, OQ-M09-03) | 401, 403 | `/admin/audio-kbat/template`, `/template-word` |
| 23 | POST | `/api/admin/audio-kbat-sets` | A | yes | multipart: `title, educationLevelId, subjectId, status, sourceLabel?, instructions?, sections[1..4][title, audio?, transcript?], questions[1..30][…]` | 201 `{data, status}` | 422 | `POST /admin/audio-kbat` |
| 24 | GET | `/api/audio-kbat-sets` | U | no | `?educationLevelId&subjectId` | `{data: [{id, title, educationLevel, subject}]}` (approved only) | 401 | `GET /audio-kbat` |
| 25 | GET | `/api/audio-kbat-sets/:id` | U | no | — | `{data: {id, title, instructions, sections: [{no, title, audioUrl, questions: [{no, questionText, options: {A, B, C, D}, marks}]}]}}` (no answers) — provisional | 404 (unknown or not approved; the client renders the standalone 404 page) | not observed (L-3) |
| 26 | POST | `/api/audio-kbat-sets/:id/attempts` | U | yes | `{answers: [{no, choice}]}` (only the questions the student answered; unanswered ones are omitted) | 201 `{data: {score, totalMarks}}` — provisional | 404, 422 | not observed (L-3) |
| 27 | GET | `/api/videos` | G | no | `?search&category&subject&page` | `{data: VideoCard[], meta: {page, pageSize: 24, totalItems, totalPages, from, to, facets: {total, categories: [{code, label, count}], subjects: [{id, name, count}]}}}` | — | `GET /video` |
| 28 | GET | `/api/videos/:id` | G | yes (views; not with `for=edit`) | `?for=edit` (optional) | `{data: VideoDetail}` (views +1 after reply). With `?for=edit` the body and visibility rules are identical (including `canManage`) but `views` is **not** incremented; S19 uses it because live does not count edit-page opens (without it every S19 open would add a view). | 404 | `GET /video/{id}`, `GET /video/{id}/edit` |
| 29 | POST | `/api/videos` | U | yes | `{videoUrl, title, description?, category, subjectId?, visibility}` | 201 `{data: VideoDetail, status}` | 422 (e.g. `school` without school) | `POST /video` |
| 30 | PUT | `/api/videos/:id` | U (owner/admin) | yes | same | `{data, status}` | 403, 404, 422 | `PUT /video/{id}` |
| 31 | DELETE | `/api/videos/:id` | U (owner/admin) | yes | — | `{data: {deleted: 1}, status}` | 403, 404 | `DELETE /video/{id}` |
| 32 | GET | `/api/videos/form-context` | U | no | — | `{data: {uploader: {name, initial, roleLabel}, school: {id, name} \| null}}` (school = the user's `videoSchools` row, not the profile school; BR-M09-21) | 401 | S19, S20 |
| 33 | GET | `/api/perutusan` | U | no | — | `{data: PerutusanCard[]}` (BR-M09-23/24; not paginated) | 401 | `GET /perutusan` |
| 34 | GET | `/api/perutusan/mine` | U | no | — | `{data: [{id, title, status, statusLabel, createdAt}]}` | 401 | `GET /perutusan/saya` |
| 35 | GET | `/api/perutusan/:id` | U | yes (reads) | — | `{data: PerutusanDetail}` (records the read, BR-M09-07) | 404 (unknown or not visible) | `GET /perutusan/{id}` |
| 36 | GET | `/api/perutusan/compose-context` | U | no | — | `{data: {scope, scopeLabel, canWrite}}` (BR-M09-22) | 401 | S24 |
| 37 | POST | `/api/perutusan` | U (writer) | yes | multipart: `title, body, images[], documents[], youtubeUrl?, isPinned, isPublic, status, scheduledAt?` | 201 `{data: PerutusanDetail, status}` | 403, 422 (pin limit, files) | `POST /perutusan/tulis` |
| 38 | POST | `/api/perutusan/:id/reactions` | U | yes | `{type: 'like'\|'love'\|'thanks'}` | `{data: {reactions: {like, love, thanks}, myReactions}}` (toggle, BR-M09-25) | 404, 422 | `POST /perutusan/{id}/react` |
| 39 | POST | `/api/perutusan/:id/comments` | U | yes | `{body}` | 201 `{data: {id, status: 'pending'}, status}` | 404, 422 | `POST /perutusan/{id}/comment` |
| 40 | GET | `/api/public/perutusan/:id` | G | no | — | `{data: {title, author, body, createdAt, youtubeEmbedUrl}}` — provisional | 404 (not public or not published) | `/perutusan/awam/{id}` (not opened) |
| 41 | GET | `/api/admin/screenshots` | A | no | — | `{data: ScreenshotFile[], meta: {total}}` | 401, 403 | S14 list |
| 42 | POST | `/api/admin/screenshots` | A | yes | multipart `files[]` | 201 `{data: {saved: ScreenshotFile[], rejected: [{name, reason}]}, status}` — provisional | 422 | `POST /admin/tools/screenshots` |
| 43 | GET | `/api/config/support` | G | no | — | `{data: SupportConfig}` | — | panduan help box (DV-M09-14) |

Teacher article endpoints are **M10-owned** (M10 SRS #66–#70: `GET/POST /api/guru/articles`, `GET/PUT /api/guru/articles/:id`, `DELETE /api/guru/articles/attachments/:id`); they call the M09 repository methods of §6.11, so the store has one owner (D12, XL2-19). `AdminArticleDetail` (#2) includes `youtubeUrl` and `attachments[] {id, fileName, label, size}` so the admin can review a teacher article before publishing; no admin screen renders them (as live).

M03-owned lookups used (not M09): `GET /api/subjects` (31; A–Z order on Audio KBAT, id order on video forms), `GET /api/education-levels` (11). M05 consumes #9 and #20 through `GET /api/dashboard` (M05 §7 #1).

INFERRED (M09-T1): list endpoints #7, #9, #20, #24, #33 and #34 return the list envelope with `meta` (e.g. `{data: [...], meta}`); the `{data: ...}` shapes in the table are still satisfied.

**As built (admin handler build; v1.7).** The admin endpoints (#1–#5, #10–#19, #21–#23, #41, #42) are implemented in the mock; they are no longer deferred. (1) #21 paginates: `pageSize` up to 100; S12 requests `pageSize=100`, because FR-M09-65 says there is no pager. (2) #42 returns `422` when every file is rejected. (3) The notes list sort `NOTE_SORT` is id ascending (FR-M09-42). (4) #22 serves placeholder text, not a genuine xlsx/docx file (OQ-M09-03; the real backend rule is SEC-M09-15, NFR-M09-08).

## 8. States & messages

### 8.1 Per screen (exact live copy unless marked)

| Screen | State | Copy / behaviour |
|---|---|---|
| All | Loading | Live pages are server-rendered (no loading state observed). The prototype shows the shell's global page loader while a mock call is pending (FR-G-10; as M07 SQ-M07-01). |
| All lists | Pager | ≥640px "Showing {from} to {to} of {total} results" + numbered links + chevrons (aria "&laquo; Previous" / "Next &raquo;", "Go to page {n}"); <640px "« Previous" / "Next »" (plain text when unavailable). |
| S1 | Empty | `fa-inbox` "Tiada artikel dijumpai." · "Jumlah: 0 artikel" |
| S1 | Not found | `fa-exclamation-circle` "Artikel tidak dijumpai." |
| S1 | Delete confirm | "Adakah anda pasti mahu padam artikel ini?" |
| S5 | Empty | "Tiada nota dijumpai." · "Jumlah: 0 nota" |
| S5 | Delete confirm | "Adakah anda pasti mahu padam nota ini?" |
| S6/S7 | Live 500 (replaced) | "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS" — not shown by the rebuild (DV-M09-01); the global 500 page stays a shell concern. |
| S9 | Not found | `fa-exclamation-circle` "Banner tidak dijumpai." |
| S9 | Delete confirm | "Adakah anda pasti mahu padam banner ini?" |
| S12 | Empty | `fa-headphones` "Belum ada set Audio KBAT." |
| S14 | Empty | "Jumlah: 0 fail" · "Tiada fail lagi." |
| S15 | Empty | 🔍 "Tiada Artikel Dijumpai" · "Cuba ubah carian atau pilih kategori lain." · "Lihat Semua Artikel" |
| S16 | Copied | "Link Disalin!" (2 s) |
| S17 | Empty | 🎬 "Tiada Video Dijumpai" · "Cuba ubah carian atau pilih kategori lain." · "Lihat Semua Video" |
| S18 | Delete confirm | "Padam video ini?" |
| S20 | Detected | `fa-check-circle` "Platform dikesan: {YouTube \| Vimeo \| Dailymotion \| TikTok \| Facebook}" |
| S20 | No school | "Sekolah Saya" / "Tiada sekolah" (disabled) |
| S21 | Empty | `fa-headphones` "Belum ada set Audio KBAT yang approved." |
| S23 | No comments | "Belum ada komen" · note "Komen akan disemak sebelum dipaparkan" |
| S25 | Empty | "Anda belum menulis perutusan" |
| S28 | Copied | "Salin Pautan" → `fa-check` "Disalin!" |
| S28 | Guest | no reaction buttons, no comment form, no public-link input (OBSERVED) |
| 404 | Unknown slug / id | "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan" (→ `/practice`), "PRESTASIPLUS" |
| Forms | Validation | native `required` bubble (browser text) |

### 8.2 UNVERIFIED COPY placeholders (L-1…L-5; replace when observed)

The live texts of these states exist but were not captured (UNVERIFIED COPY). The strings and pill styles below are **PROPOSED COPY placeholders** written for the prototype (listed for G1 in URS OQ-M09-11); E2E scenarios assert only that a flash / pill of the right kind appears, never these words. Flashes use the admin shell's flash component (success green, error red, one-time) on admin pages and the user shell's flash on user pages.

| Where | Placeholder text / style (PROPOSED COPY, standing in for UNVERIFIED live copy) |
|---|---|
| Article created / updated / deleted | "Artikel berjaya ditambah." / "Artikel berjaya dikemaskini." / "Artikel berjaya dipadam." |
| Note created / updated / deleted | "Nota berjaya ditambah." / "Nota berjaya dikemaskini." / "Nota berjaya dipadam." |
| Banner created / updated / deleted | "Banner berjaya ditambah." / "Banner berjaya dikemaskini." / "Banner berjaya dipadam." |
| Audio KBAT set created | "Set Audio KBAT berjaya disimpan." |
| Video published / updated / deleted | "Video berjaya diterbitkan." / "Video berjaya dikemaskini." / "Video berjaya dipadam." |
| Perutusan sent / scheduled / draft | "Perutusan berjaya dihantar." / "Perutusan dijadualkan." / "Draf perutusan disimpan." |
| Pin limit | "Maksimum 2 perutusan boleh disematkan." (error under "Sematkan di atas (maks 2)") |
| Comment sent | "Komen anda telah dihantar dan akan disemak." |
| Screenshot saved / refused | "{n} fail berjaya dimuat naik." / "{file}: format atau saiz tidak dibenarkan." |
| Server field errors | "Medan ini diperlukan." (generic, under the field) |
| Article draft status pill (S1) | "Draf", slate-100 / slate-700 pill (placeholder, OQ-M09-02) |
| Banner inactive pill (S9) | "Tidak Aktif", slate-100 / slate-700 pill (placeholder) |
| Note unpublished status (S5/S8) | "Draf" (placeholder) |
| Perutusan status labels (S25) | "Diterbitkan" / "Dijadualkan" / "Draf" (placeholder) |
| Perutusan admin role pill | "Admin" (placeholder) |

Messages used by the M09-T1 mock (PROPOSED COPY; INFERRED, not observed on live; the same rule applies: E2E asserts only the kind of message):

| Where | Placeholder text (PROPOSED COPY) |
|---|---|
| Comment length (#39) | "Komen mesti antara 1 hingga 1000 aksara." |
| School admin without a school (perutusan) | "Pentadbir sekolah mesti mempunyai sekolah." |
| Video "Sekolah Saya" without a school (#29/#30) | "Anda tiada sekolah untuk dikongsi." |
| Generic field error | "Medan ini tidak sah." |
| File refused (screenshots #42, and reused for perutusan attachments #37) | "{file}: format atau saiz tidak dibenarkan." (the same string as the "Screenshot refused" row above) |
| Video not owner: edit / delete (#30, #31) | "Anda tidak dibenarkan mengubah video ini." / "Anda tidak dibenarkan memadam video ini." |
| Article not owner: edit (M10 #67, via the M09 repository) | "Anda tidak dibenarkan mengubah artikel ini." |
| Perutusan writer refused (#37) | "Anda tidak dibenarkan menulis perutusan." |
| Audio set shape (#23) | "Set mesti mempunyai 4 bahagian dan 30 soalan." |
| Screenshot file type/size (#42) | "Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB." |
| Perutusan attachment type | "Lampiran … mesti PDF, Word, Excel atau PowerPoint." (`…` = the file name) |
| Attachment count | "Maksimum 5 lampiran." |
| Article featured image type / size | "Gambar utama mesti JPEG, PNG atau WebP." / "Gambar utama melebihi 2 MB." |
| NOT_FOUND (404) | "Video {id} tidak dijumpai." and the matching message for each other resource (article, note, banner, audio set, perutusan) with its own noun |

Audio KBAT player (L-3, OQ-M09-11; UNVERIFIED / PROPOSED COPY written for the M09 reader build; live has no set, so none of it was observed; E2E asserts only that the element appears):

| Where | Text / behaviour (PROPOSED COPY) |
|---|---|
| Back link on the player | "Kembali" (→ `/audio-kbat`) |
| Page title | "Audio KBAT" for both the list and the player (tab title); the player h1 = the set title |
| Score after submit | "Skor anda {n} / {total}" (the form is locked after a score) |
| Section without an audio file | "Audio tidak tersedia." in place of the player |
| Load failed | "Ralat memuatkan data. Sila cuba semula." |
| Submit payload | only the answered questions are sent |
| Unknown or non-approved set | standalone 404 page (§8.1 "404") |

PROPOSED COPY (owner acceptance at G1, OQ-M09-11): DV-M09-01 form labels, headers, tab titles and buttons (URS §7); provisional Audio KBAT player "Hantar" and the strings of the table above.

### 8.3 Live-session states

As URS §5.1: L-1 FR-M09-09, 14, 18, 45, 48, 52, 57, 59, 71, 90, 92, 109 (flashes §8.2); L-2 = DV-M09-01 (FR-M09-46…48); L-3 FR-M09-65, 71, 74, 75; L-4 FR-M09-98…102, 109, 111; L-5 FR-M09-120; L-6 FR-M09-60, 88, 95, 103 (BR-M09-14, 21, 22, 23); L-7 FR-M09-39, 83 (guest video detail decided in v1.8: public layout, no section label or CTA, no Edit/Padam; INFERRED).

## 9. Permissions matrix

| Role | S1–S4 articles | S5–S8 notes | S9–S11 banners | S12–S13 audio admin | S14 screenshots | S15/S16 read articles | S17/S18 videos | S20 add video | S19 / delete video | S21 audio (student) | S22/S23 perutusan read, react, comment | S24 write perutusan | S26 / S27 guide | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Guest | → `/login` | → `/login` | → `/login` | → `/login` | → `/login` | public layout (detail INFERRED) | public layout (detail INFERRED) | → `/login` | → `/login` | → `/login` | → `/login` (except `/perutusan/awam/{id}` public posts) | → `/login` | S26 public; S27 → `/login` | OBSERVED (redirects listed in FR-M09-124) |
| Admin | full | full | full | full | full | user shell | user shell | yes | any video | yes | all posts | national scope | yes | OBSERVED (screens) |
| Admin Sekolah (school_admin) | → landing, API 403 | same | same | same | same | yes | yes | yes | own videos | yes | own school + national | school scope ("Pengetua") | yes | INFERRED |
| Guru, Pelajar, Ibu Bapa, Penaja, PPD/JPN officers | → landing, API 403 | same | same | same | same | yes | yes | yes | own videos | yes | own school + national | refused 403 (UNVERIFIED, OQ-M09-05) | yes (drawer item → S27 for the tuition-centre role) | INFERRED |

Notes (v1.8, INFERRED): **S19 refusal.** A logged-in user who is neither the uploader nor the admin and opens `/video/{id}/edit` is redirected to their session landing page (the M02 landing pattern of FR-M09-125); if that landing page is itself a video route, the client shows an in-place 403 page instead of redirecting (no loop). The API answers 403 (§7 #30). **Guest S18.** A guest may open `/video/{id}` (API #28 is public, BR-M09-31); the page uses the guest public layout without the section label or CTA and never shows "Edit" / "Padam".

## 10. Responsive behaviour

Shells: user portal — sidebar ≥1024px, header + drawer + bottom nav below (global); admin — sidebar ≥1024px, drawer + bottom tab bar + "Lagi" sheet below (NFR-RESP-04, global). No horizontal page scroll at 320–1920px (live has none except S4 at 375, fixed by DV-M09-05). Breakpoints are the live Tailwind classes; no deviation changes a layout except DV-M09-05 (wrapping) and DV-M09-12 (meta items).

| Screen | Below `md` (375) | `md` (768) | `lg`+ (1024/1280) | Deviation |
|---|---|---|---|---|
| S1 | filters wrap (search full width; "Cari" + "Reset" one row); "Tambah" right; table (498px) scrolls inside its card (318px); pager "« Previous / Next »" below 640px | table (773px) scrolls inside its card (667px) | table fits at 1280 | — (DV-16 rejected) |
| S2/S3, S10/S11 | 1 column; "Batal" + submit one row, right-aligned | 2-column grids | same | — |
| S4, S8 | card; escaped body wraps | same | same | DV-05 |
| S5 | table (766px) scrolls inside the card | same (667px card) | fits | — |
| S6/S7 (DV-01) | 1 column; footer one row, right-aligned | 2-column grid for Subjek / Jenis / Tahap | same | DV-01 |
| S9 | table (610px) scrolls in card | table (948px) scrolls in card | fits | — |
| S12 | stat cards 2 columns; filters stacked, "Tapis" full width | filters 2 columns (`sm`) | filter grid 6 columns (`lg`) | DV-08 (title) |
| S13 | 1 column; option inputs stacked; sticky save bottom-right over the content | options 2 columns (`md`) | same | DV-08 |
| S14 | cards stacked | same | same | — |
| S15 | cards 1 column; pills wrap; hot cards 1 column | 2 columns (`sm`) | 3 (`lg`) → 6 (`xl`) | DV-12 (meta) |
| S16 | aside hidden | aside hidden | aside shown (`lg`) | — |
| S17 | cards 1 column; pills wrap | 2 columns | 6 columns (`xl`) | DV-10 |
| S18 | player full width; related stacked | same | same | — (guest: public layout, L-7) |
| S19/S20 | 1 column; submit + "Batal" one row | same | same | — (S19 without visibility sub-lines) |
| S21 | filters stacked, "Tapis" full width | 2 columns (`sm`) | same | DV-08, DV-09 |
| S22–S25 | "Disematkan" text hidden (icon only); S24 footer one row ("Batal" 88×50 + wide submit) | same | same | — |
| S28 | top-bar "Daftar Percuma" hidden (below `sm`); player 267×150; share buttons 2 rows; CTA buttons stacked full width | player 636×358 | player 635×357 | DV-18/19 (links only) |
| S26/S27 | top links in the `fa-bars` menu; role tabs 2 columns | role tabs 3 columns; menu until `lg` | links inline; role tabs 5 columns | DV-21 (footer logo centred at every width) |
| Audio player (provisional) | single column | same | same | — (L-3) |

Touch targets: icon-only row actions keep their live visual size; NFR-RESP-03 (44px) applies through the hit area (padding), as M04/M07.

## 11. Non-functional requirements

| ID | Category | Requirement | Traces |
|---|---|---|---|
| NFR-M09-01 | Performance | The 2,260-video fixture is paginated (24 rows) and its facets are computed from the store per request; the 72 articles paginate at 18/20. Counts are never stored separately (single source). | NFR-01 |
| NFR-M09-02 | Accessibility | Replicates live (D10): native `required` bubbles and `confirm()` dialogs, labels as live (the S10 `external_url` has none), no added ARIA. Only DV-M09-09 (unreadable hero, invisible "Tapis") and DV-M09-05 change a11y-relevant behaviour. | NFR-02 |
| NFR-M09-03 | Privacy | All people are fictitious (§6.9): live authors, posters, uploaders and the teacher credited in #2224 / #2260 are replaced (the 4 video titles that named a real person read "Cikgu Demo"); public content titles are otherwise kept; the real school named in the title of perutusan #4 appears only as title text — the post's seed school is the fictitious 900003 "SMK Demo Seri Putra", and every seed user has a fictitious name and an id (canonical 1–11, M09 anchors 3101–3109). | NFR-05 |
| NFR-M09-04 | Maintainability | Mock modules: `articles`, `notes`, `banners`, `audioKbat`, `videos`, `perutusan`, `screenshots`, `supportConfig`; one file per resource (NFR-07). | NFR-07 |
| NFR-M09-05 | Localisation | Dates and relative times per BR-M09-09/10 in Asia/Kuala_Lumpur; English month abbreviations where live uses them. | NFR-08 |
| NFR-M09-06 | Media (D22; supersedes the earlier offline-placeholder rule) | No media is generated or fabricated (D22): media comes only from live or the source. **Thumbnails** are the real `https://img.youtube.com/vi/{id}/hqdefault.jpg` (https only); when an image fails to load the frame stays empty — no drawn placeholder. **Players** are real iframes, and only these hosts are allowed: `www.youtube.com`, `player.vimeo.com`, `www.dailymotion.com`, over https; a video on any other platform (TikTok, Facebook, other) renders a text link to the video instead of an embed. Embed and thumbnail URLs are computed exactly as live (BR-M09-17). Quill stays bundled locally; Unsplash images, `ui-avatars.com`, Google Fonts and other CDNs remain unrequested (SRS.md §4.4 applies to them). | D22; SRS.md §4.4 |
| NFR-M09-07 | Security — for the backend phase (**security-engineer review required**) | The live behaviour replicated here carries these risks:<br>**SEC-M09-01** article (and note) `content` is raw HTML typed by admins — and by teachers through M10 — and is rendered unsanitised on `/artikel/{slug}`, a public page: stored XSS; the backend must sanitise on save (allow-list) or render through a sanitiser; the admin previews escape it (safe, DV-M09-04).<br>**SEC-M09-02** the perutusan Quill "HTML" toggle lets any writer (principals included) submit arbitrary HTML that is rendered to every reader of the scope and on the public page `/perutusan/awam/{id}`: sanitise server-side (Quill allow-list), strip scripts, event handlers and `javascript:` URLs.<br>**SEC-M09-03** any logged-in user (students included) can add videos visible to everyone (global) with any URL, title and description: abuse/spam and phishing links; the server must validate the URL against the supported hosts, render descriptions as text, rate-limit, and offer moderation/reporting.<br>**SEC-M09-04** file uploads — perutusan images (2 MB) and PDFs (5 MB), Audio KBAT audio (no size shown), the screenshot tool (10 MB, many files, auto-submit on select): validate type by content (magic bytes) not extension, enforce sizes, store outside the web root with random names, scan for malware, strip EXIF, serve PDFs as downloads; the "private" screenshot folder must not be publicly listable (server rules: NFR-M09-08).<br>**SEC-M09-05** public perutusan pages use sequential ids (`/perutusan/awam/2`, `/3`, `/4`): enumeration; serve only `isPublic` published posts and consider unguessable tokens.<br>**SEC-M09-06** the live site's CSP blocks the CKEditor CDN (a sign the CSP is enforced) while Quill loads from jsDelivr: keep a strict CSP, self-host editors, use Subresource Integrity for any CDN script.<br>**SEC-M09-07** view counters increment on every GET with no deduplication or bot filter (articles, videos): trivially inflated; the "POPULAR" section depends on them.<br>**SEC-M09-08** deletes of articles, notes, banners and videos are permanent after one browser `confirm()`; no soft delete or audit trail.<br>**SEC-M09-09** comments and reactions are unauthenticated-rate-limited POSTs; comments wait for a moderation step whose screen is unknown (pending comments could pile up unseen).<br>**SEC-M09-10** banner `external_url` / `image_url` and article `featured_image` accept any URL: validate scheme (https only), and open external links with `rel="noopener noreferrer"`.<br>**SEC-M09-11** perutusan scope must be enforced server-side (a principal must not post nationally or to another school by tampering `scope`/`schoolId`); the video `school` visibility must be enforced on the list, detail and related queries.<br>**SEC-M09-12** Audio KBAT sets default to "Approved" on create, so a set goes straight to students without review; restrict create to admins and consider defaulting to "Pending Review" in the backend phase (behaviour replicated in the prototype).<br>**SEC-M09-13** all state-changing requests (create/update/delete, uploads, reactions, comments) need CSRF protection and rate limiting; the admin routes need the admin role on the server (not only hidden menus).<br>**SEC-M09-14** the banner edit form posts back stored codes (DV-M09-07): the server must validate `bannerType` / `linkType` / `targetAudience` against an allow-list that includes the legacy stored codes, not free text. | NFR-04 |
| NFR-M09-08 | Security — **server rules for the real backend** (M09 admin security review; extends SEC-M09-01/04/08/10/12/13/14; none of these is prototype behaviour) | **Server rule (real backend) — SEC-M09-01 / SEC-M09-02, content XSS.** Article content, note content and perutusan HTML (including articles teachers write through M10) are rendered only through an allow-list sanitiser: strip `<script>`, `<iframe>`, `<object>`, `<svg>` and `<style>`, event handlers, and `javascript:` / `data:` URLs; add `rel="noopener noreferrer"` to links; sanitise both on save and on render; use a strict CSP. Prototype note (v1.8): the S16 reader (built) passes the article body through a client-side allow-list sanitiser before rendering; this is a prototype measure only. **Server rule (real backend), additions:** the backend phase MUST sanitise server-side (DOMPurify or an equivalent allow-list sanitiser); reject protocol-relative `//` URLs in `img[src]` and `a[href]`; restrict `img[src]` to https and the uploads origin; cap the content length; and send a CSP and a `Referrer-Policy` header.<br>**Server rule (real backend) — SEC-M09-04, uploads.** Detect the file type by magic bytes. Store outside the web root under server-generated names; never use a client name in a path; reject `.` and `..`. Serve with `X-Content-Type-Options: nosniff` and send `Content-Disposition: attachment` for anything not played inline. Size limits: 20 MB per audio file, 10 MB per screenshot. Cap the number of files and the total bytes per request. Scan for malware, strip EXIF, and make the screenshot folder non-listable.<br>**Server rule (real backend) — SEC-M09-10, URLs.** `featuredImage`, `imageUrl` and `externalUrl`: accept https only; reject URLs that contain credentials; cap the length at 2048; render external links with `rel="noopener noreferrer" target="_blank"`; add no redirect endpoint that takes a URL; banner links are rendered, never auto-followed. **Known prototype difference:** the prototype keeps http accepted, as live does.<br>**Server rule (real backend) — SEC-M09-13, authorisation.** Check the role server-side on every route. `authorId` and `uploadedById` come from the session. `views`, `likes`, `publishedAt`, `slug` and `id` are server-owned; use DTO allow-lists. Apply CSRF protection and rate limits to mutating and upload routes.<br>**Server rule (real backend) — SEC-M09-08 / SEC-M09-12.** Deletes are soft deletes with an audit trail. The default status for new Audio KBAT sets is decided by the backend; "Pending Review" is recommended (the prototype keeps "Approved" as live).<br>**Server rule (real backend) — SEC-M09-14.** Validate `bannerType`, `linkType` and `targetAudience` against the enum plus the stored legacy codes. The mock already does this.<br>**Server rule (real backend) — SEC-M09-15, templates.** The Audio KBAT templates (#22) are genuine xlsx / docx files served with a fixed content type, `nosniff` and `attachment`. The mock serves placeholder text (OQ-M09-03). | NFR-04 |

## 12. E2E test scenarios

Every scenario runs on the **mobile (375×812), tablet (768×1024) and desktop (1280×800)** Playwright projects, starts from `mock.reset()`, `mock.setNow('2026-09-25T15:40:00+08:00')` (project default, XL2-33) and `mock.setRandomSeed(1)`, logs in as `admin@demo.test` unless stated, and uses the §6.9 seed. Assertions are viewport-aware where the live layout differs by width (sidebar vs drawer, pager, aside, grids). Scenarios or steps marked **provisional** assert INFERRED or UNVERIFIED behaviour (L-1…L-7) and are re-baselined after the live session (URS OQ-M09-12); they check that a flash appears, never its words (§8.2). Provisional in whole or in part (30): E2E-06, 10, 12, 18, 23, 25, 27, 30, 32, 36, 38, 39, 40, 42, 44, 46, 52, 53, 54, 55, 57, 59, 60, 61, 62, 64, 65, 69, 70, 71 (for partly provisional scenarios only the marked steps are provisional).

| ID | Scenario | FR | AC |
|---|---|---|---|
| E2E-M09-01 | S1 default: header/subtitle/tab; sidebar "Kandungan" › "Artikel" (≥1024) or via drawer; "Jumlah: 72 artikel"; "Tambah" href; column headers computed upper case; 20 rows = ids 10–29; row #10 cells (star with title "Featured", title, "Oleh: Admin Demo", "Tips Belajar" pill classes, "DARJAH_4", "Diterbitkan", "596", "22/02/2026"); `?page=4` rows = 70, 71, 72, 9, 1…8. | 01, 03, 04, 05 | 01.1, 01.2 |
| E2E-M09-02 | S1 filters: options and placeholders; "Motivasi" + "Cari" → `?category=MOTIVASI…`, "Jumlah: 14 artikel", all rows "Motivasi", first row #25, select keeps "Motivasi"; search "sifir" → 2 rows (#17 first); `published=1` → 72; "Reset" → `/admin/articles` with default controls. | 02, 05 | 01.3 |
| E2E-M09-03 | S1 pager (DV-03): `?category=TIPS_BELAJAR` → page-2 link contains `category=TIPS_BELAJAR`; page 2 = 1 row #8; its "« Previous"/page-1 link keeps the category; ≥640px "Showing 1 to 20 of 72 results" + links 1–4; <640px "« Previous" plain text and "Next »" → `?page=2`. | 06 | 01.4, 01.6 |
| E2E-M09-04 | S1 empty: `?published=0` and `?search=zzzqqq` → `fa-inbox` "Tiada artikel dijumpai.", "Jumlah: 0 artikel", no pager. | 07 | 01.5 |
| E2E-M09-05 | Row actions: eye → `/admin/articles/10`; edit → `/admin/articles/10/edit`; trash → dialog text "Adakah anda pasti mahu padam artikel ini?", dismiss → no DELETE request (`mock.lastRequest`), row kept. | 08, 09 | 02.1, 02.2 |
| E2E-M09-06 | **Provisional** delete: accept → row #10 gone, "Jumlah: 71 artikel", a success flash is visible. | 09 | 02.3 |
| E2E-M09-07 | Not found: `/admin/articles/9999`, `/admin/articles/9999/edit`, `/admin/articles/categories` → `/admin/articles` with red flash "Artikel tidak dijumpai." (once; gone after reload). | 10 | 02.4 |
| E2E-M09-08 | S2 page: header, tab, back link, labels, placeholders, `required` on title/content/category, "Kandungan" is a `<textarea>` with `rows=15` and no editor toolbar, category options, level default "Semua", checkboxes unchecked; footer buttons on one row, right-aligned, "Batal" left of "Simpan Artikel" at every viewport; fields 1 column at 375. | 11, 13 | 03.1, 03.6 |
| E2E-M09-09 | S2 validation and Batal: empty submit → `validity.valueMissing` on title/content/category, no POST; fill title+content → only category invalid; type then "Batal" → `/admin/articles`, no dialog, count still 72. | 12, 13 | 03.2, 03.3 |
| E2E-M09-10 | **Provisional** S2 save: valid "Berita" article with "Terbitkan Sekarang" and content `<h2>Tajuk</h2><p>Isi</p>` → list flash, "Jumlah: 73 artikel"; `/artikel` first card is the new article; its detail renders an `h2` "Tajuk"; `/dashboard` strip starts with it. | 14, 15, 40 | 03.4, 03.5 |
| E2E-M09-11 | S3 edit #10: header/tab, preloaded values, category select without "Pilih kategori", "Darjah 4", both boxes ticked, `form.checkValidity()` true; #11 "Darjah 5", featured unticked; change title + "Batal" → list, reopen shows the original title. | 16, 17 | 04.1, 04.2, 04.3 |
| E2E-M09-12 | **Provisional** S3 update: tick "Artikel Featured" on #11 → list flash, star on #11; `/artikel` card of "Cara Buat Nota Bergambar (Mind Map) yang Berkesan" shows "HOT". | 18 | 04.4 |
| E2E-M09-13 | S4 #10: header title/"Paparan artikel", tab, card meta "Admin Demo", "22 Feb 2026", "596 tontonan", "Diterbitkan", "Featured", excerpt, "Edit Artikel" href; body text starts with the literal "<h2>Apa Itu Teknik Pomodoro?</h2><p>" and contains no rendered `h2`; #11 has no "Featured" and author "Cikgu Demo 01". | 19, 20 | 05.1, 05.2, 05.4 |
| E2E-M09-14 | S4 at 375: `scrollWidth ≤ innerWidth` (DV-05); open `/admin/articles/10` twice, then `/artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit` shows "597" Pembaca. | 20, 21 | 05.3, 05.5 |
| E2E-M09-15 | `/artikel` as admin and as `pelajar@demo.test`: user shell (no admin sidebar), header/subtitle/tab; 18 cards, first 5 titles in order; card 1 chip "Tips Belajar", initial "C", "Cikgu Demo 01", "👁️ 310", "7 bulan yang lepas"; card 2 "HOT"; at 1280 the grid has 6 columns and each meta item is on one line (`white-space: nowrap`; "7 bulan yang lepas" height = one line) (DV-12). | 22, 23, 27 | 06.1, 06.2, 06.7 |
| E2E-M09-16 | Pills and search: click "Berita" → `?category=BERITA`, active classes, 7 cards (first "Perpustakaan Bergerak Sampai ke Pedalaman Sabah", then "Pertandingan Menulis Karangan Kreatif Kebangsaan 2026"), hidden input `category=BERITA`, no hot section; search "sifir" → 2 cards, every pill href contains `search=sifir`, "Semua" → `/artikel?search=sifir`. | 24, 27 | 06.3, 06.4 |
| E2E-M09-17 | Pager and empty: `?category=TIPS_BELAJAR` → page 2 has 3 cards (first "Rahsia Pelajar Cemerlang: Ulangkaji Sebelum Tidur"), "« Previous" href `?category=TIPS_BELAJAR&page=1`; `?search=zzzqqq` → 🔍 "Tiada Artikel Dijumpai", copy, "Lihat Semua Artikel" → `/artikel`. | 25, 26 | 06.5, 06.6 |
| E2E-M09-18 | Hot section: `/artikel` and `/artikel?page=4` show "Artikel Paling Hangat" with 6 cards; every "PILIHAN" card is featured; **provisional** step (pool size INFERRED, BR-05): every "POPULAR" card is in the top-10 non-featured by views (from the fixture); change the seed in-app (`mock.setRandomSeed(2)`) and navigate (a reload would not keep the seed) → a different set; `?category=UMUM` and `?search=a` → no section. | 28 | 07.1, 07.2, 07.3 |
| E2E-M09-19 | Guest `/artikel`: no session → public layout, tab "Artikel — PRESTASIPLUS", top bar links, hero texts (4 bold spans), hot section, placeholder "Cari artikel menarik...", "Pilih Kategori:" and "✨" pills, 18 cards with `fa-clock`, pager, CTA texts and link, footer text and links; no user shell. | 29, 30, 31, 124 | 08.1, 08.2, 08.3 |
| E2E-M09-20 | Detail #10: header, breadcrumb (40-char title + "..."), chips "Tips Belajar" / "Darjah 4" / "Pilihan", author card "A", "Admin Demo", "24 Dec 2025", "9 bulan yang lepas", "597" Pembaca, "6" Suka, no button containing "Suka"; body has rendered `h2` headings (first "Apa Itu Teknik Pomodoro?"), paragraphs and the 5 list items in order ("Pilih satu tugasan atau subjek untuk belajar", "Set timer 25 minit — FOKUS penuh!", "Bila timer berbunyi, rehat 5 minit", "Ulang 4 kali, kemudian rehat panjang 15-30 minit", "Catat berapa "pomodoro" kamu siap hari ini"; EL-M09-S16-032…036); the list parent (`ol` or `ul`) is not asserted — the inventory does not record it. | 32, 33, 34 | 09.1, 09.2, 09.3 |
| E2E-M09-21 | Share: WhatsApp/Facebook/Twitter hrefs built from the title and URL; click `fa-link` → clipboard = page URL, "Link Disalin!" visible, hidden after 2 s (clock advanced). | 35 | 09.4 |
| E2E-M09-22 | Related and aside: 3 related cards (titles + "👁️ 310/543/351"); at 1280 the aside lists the 5 latest (same as `/api/articles/latest`) and "Lihat Semua Artikel"; at 375 and 768 no aside. | 36, 37 | 09.5, 09.6 |
| E2E-M09-23 | **Provisional** counter (only a single open was observed; "no deduplication" is INFERRED, SEC-07): open detail #9 ("AI Ini Apa…", 310) three times → "311", "312", "313". | 21 | 09.7 |
| E2E-M09-24 | 404: `/artikel/tiada-slug-zzz`, `/video/999999`, `/video/999999/edit`, `/perutusan/999` → standalone 404 texts, "Halaman Utama" → `/`, "Mula Latihan" → `/practice`. | 38 | 10.1, 26.3, 30.3 |
| E2E-M09-25 | **Provisional** guest detail: no session → click the first public card → detail content inside the public layout; Pembaca 311. | 39 | 10.2 |
| E2E-M09-26 | Dashboard feed (M05): `/dashboard` strip and aside list the 5 articles of `/api/articles/latest` in order. | 40 | 11.1 |
| E2E-M09-27 | **Provisional** M10 contribution (XL2-26): as `guru@demo.test` create an article through M10 `POST /api/guru/articles` with `youtubeUrl` and one PDF attachment → it is stored with `isPublished = false`, is absent from `/artikel` and shows on `/admin/articles` with the draft status; the admin opens S3, ticks "Terbitkan Sekarang", saves → the article is first on `/artikel` with author "Guru Demo"; `GET /api/admin/articles/:id` still returns the `youtubeUrl` and the attachment; S16 shows neither. | 41 | 11.2 |
| E2E-M09-28 | S5: header/tab, "Jumlah: 10 nota", "Tambah Nota" href, 10 rows in id order, row 1 cells, no pager. | 42 | 12.1 |
| E2E-M09-29 | S5 filters (DV-06): search "sifir" → 1; `subject=matematik` → 3; "Ringkasan" → 5 RINGKASAN rows; "Nota Penuh" → 2 LENGKAP; "Mind Map", "Flashcard", "Cheat Sheet" → "Tiada nota dijumpai.", "Jumlah: 0 nota"; selects keep values; "Reset". | 43 | 12.2, 12.3 |
| E2E-M09-30 | S5 misc: `/admin/notes/9999` → `/admin/notes` without flash; row eye/edit hrefs, edit opens the form (no "Ralat Pelayan"); trash dialog "Adakah anda pasti mahu padam nota ini?" dismiss → kept; accept (**provisional** step) → "Jumlah: 9 nota". | 44, 45 | 12.4, 13.1, 13.2 |
| E2E-M09-31 | Note create form (DV-01): `/admin/notes/create` has no "Ralat Pelayan"; header/labels/options/buttons (PROPOSED COPY); empty submit → `valueMissing` on title, content, subject, note_type, grade; no POST. | 46 | 14.1, 14.2 |
| E2E-M09-32 | **Provisional** note save: Sains / RINGKASAN / Darjah 3 / published → list flash, "Jumlah: 11 nota", new row "SAINS" "RINGKASAN" "DARJAH 3"; "Ringkasan" filter → 6. | 48 | 14.3 |
| E2E-M09-33 | Note edit: from `/admin/notes/1` "Edit Nota" → `/admin/notes/1/edit`; preloaded note 1; "Kemaskini Nota"; "Batal" → `/admin/notes`. | 47 | 14.4 |
| E2E-M09-34 | Note preview `/admin/notes/1`: header/tab, card values, detail grid, escaped body starting "<h2>Sifir 1 hingga 12</h2>" wrapping at 375 (no page scroll); `/nota` → 404. | 49, 20, 50 | 15.1, 15.2, 15.3 |
| E2E-M09-35 | S9: header/tab, "Jumlah: 5 banner", headers, 5 rows in order with type/audience/title/description (50 chars + "..."), dates, "Aktif", edit + trash icons, no eye icon, no filter/pager; `/admin/banners/99/edit` → list + red flash "Banner tidak dijumpai.". | 51, 53 | 16.1, 16.2, 16.4 |
| E2E-M09-36 | Banner delete: dialog "Adakah anda pasti mahu padam banner ini?" dismiss → kept; accept (**provisional**) → "Jumlah: 4 banner", dashboard counter "1 / 4". | 52 | 16.3 |
| E2E-M09-37 | S10: header/tab, labels, placeholders, hints, defaults; "Pautan Luar" shows the URL input, typed value kept after switching to "Tiada Pautan" and back; "Subjek"/"Kuiz"/"Artikel" show no extra input; empty submit → `valueMissing` on title and banner_type, no POST; footer one row. | 54, 55, 56 | 17.1, 17.2, 17.3 |
| E2E-M09-38 | **Provisional** banner save: "Pengumuman", "Semua", order 6, active → list flash, row 6 "ANNOUNCEMENT" "ALL" "6"; request body has no `externalUrl` when link type is not external. | 57, 55 | 17.4 |
| E2E-M09-39 | Banner edit (DV-07): #1 selects "Hero" / "Tiada Pautan" / "Semua", `checkValidity()` true; #2 shows a selected option "FEATURE" (absent on #1 and on create) and "Pelajar"; "Kemaskini Banner" unchanged on #2 → request body `bannerType: "FEATURE"`, `targetAudience: "STUDENT"`, `linkType: "NONE"`; after save (**provisional** step) the list still shows "FEATURE" "STUDENT"; "Batal" → list unchanged. | 58, 59 | 18.1, 18.2, 18.3, 18.4 |
| E2E-M09-40 | Banner delivery: admin `/dashboard` counter "1 / 5", badge order HERO, FEATURE, PROMOTIONAL, ANNOUNCEMENT, FEATURE; **provisional**: `pelajar@demo.test` 5; `guru@demo.test` "1 / 2"; banner 4 set inactive → admin "1 / 4". | 60 | 19.1, 19.2, 19.3 |
| E2E-M09-41 | S12: header "Set Audio KBAT", no "Dashboard" and no "Selamat datang, Admin", tab; intro, links and hrefs, guide texts, stat cards 0/0/0/0; filter options (subjects A–Z starting "Bahasa Arab"), placeholder; "Tapis" with values keeps them and shows "Belum ada set Audio KBAT.". | 61, 62, 63, 64 | 20.1, 20.2, 20.3 |
| E2E-M09-42 | **Provisional** `seedAudioKbatSet()`: stats 2 / 1 / 1 / 60; 2 rows with title, level, subject and status label; filter `status=approved` → 1 row. | 65, 63 | 20.4 |
| E2E-M09-43 | S13: header "Cipta Set Audio KBAT" (no subtitle), "Kembali" href, intro and box, "Status" default "Approved", placeholder "Contoh: Cikgu Demo 02"; 4 section cards with titles, prefilled "Audio n", file inputs not required with the live `accept`; 30 question blocks (8/8/8/6 per section) with defaults A/1/3 and min/max; empty submit → 153 invalid fields, no POST; no "Batal"; at 375 the save button stays visible while scrolling (sticky) and no page scroll. | 61, 66, 67, 68, 69, 70 | 21.1, 21.2, 21.3, 21.4, 21.5 |
| E2E-M09-44 | **Provisional** S13 save: complete set "Approved" → S12 flash, stats 1 / 1 / 0 / 30, one row. | 71 | 21.6 |
| E2E-M09-45 | S21 as `pelajar@demo.test` and admin: user shell header "Audio KBAT" with no subtitle (no "Dashboard", no "Selamat datang kembali"), tab; hero container has `text-white` and a computed `background-image` containing "gradient", h1 colour rgb(255, 255, 255) (inherited), paragraph amber-100; "Tapis" background = the slate-900 token (not transparent, not white) with white text; filter values kept; "Belum ada set Audio KBAT yang approved.". | 72, 73 | 22.1, 22.2, 22.3 |
| E2E-M09-46 | **Provisional** `seedAudioKbatSet()`: `/audio-kbat` lists only the approved set; open it → 4 sections, each with an `audio` element and 8/8/8/6 questions with radios A–D, "Hantar"; answer all "A" → score stored (full marks). | 74, 75 | 22.4, 23.1, 23.2 |
| E2E-M09-47 | S17 default: header/tab, search placeholder, category pills with counts, subject pills with counts and hrefs, "Tambah Video" href; 24 cards in the live id order; card 1 cells ("YouTube", title, "A", "Admin Demo", "Admin", "134 tontonan" (capture 2026-10-02), "6 bulan yang lepas"), thumbnail `src` = `https://img.youtube.com/vi/iqtUCV6AHuI/hqdefault.jpg` (https; no drawn placeholder on load error), `fa-play` overlay on hover (≥1024); pager "Showing 1 to 24 of 2260 results", 1…10 … 94 95. | 76, 77, 78, 79, 80 | 24.1, 24.2 |
| E2E-M09-48 | S17 filters: "Lain-lain (0)" has no `href` and clicking it keeps the URL (DV-10); `?category=lain-lain` → empty state; `?category=motivasi` → 3 cards (18, 17 first), active pill gradient, subject pills only "Sejarah (1)" → `?category=motivasi&subject=5`; `?subject=5` → category counts 97/1/12/3/81/0 with hrefs `?subject=5&category=…` (subject first), all five subject pills still present with full counts (865/97/420/779/96) and hrefs `?subject={id}`, no active style on "Sejarah (97)", "Reset Subjek" → `/video`; `?search=zzzqqq` → all pills (0) non-navigating, 🎬 empty state and "Lihat Semua Video". | 77, 78, 81 | 24.3, 24.4, 24.5, 24.6 |
| E2E-M09-49 | S17 orders: `?subject=5` → cards 2224, 2225, … 2247 and "Showing 1 to 24 of 97 results"; `?subject=5&page=2` → 2248…2260, 21…31; `?page=2` → 878, 1024, 2229, 69, 438, 879, 1025, 2230, 70, 439, 880, 1026, 2231, 71, 440, 881, 1027, 2232, 72, 441, 882, 1028, 2233, 73; `?category=motivasi` → 18, 17, 16; `?page=95` → 2220, 2221, 2222, 2223, "Showing 2257 to 2260 of 2260 results", "« Previous" → `?page=94`; `?subject=9&page=2` pager links keep `subject=9`. | 79, 80 | 24.5, 24.7 |
| E2E-M09-50 | Guest `/video`: public layout texts, pills and 24 cards, no "Tambah Video", CTA and footer. | 82 | 25.1, 25.2 |
| E2E-M09-51 | S18 #2224: header/tab, back link, player = a real iframe whose `src` is `https://www.youtube.com/embed/iqtUCV6AHuI` (host on the NFR-M09-06 allow-list), "134 tontonan" (the count before this open) · "03 Mar 2026", chips, uploader "admin", description; "Video Berkaitan" 6 cards = the 6 highest-id other videos of subject Sejarah (2260, 2259, 2258, 2257, 2256, 2255 — Sejarah is fully observed, 97/97, so independent of DV-M09-20; verified against the capture 2026-10-02) without 2224; back on `/video` card 1 shows "135 tontonan"; opening `/video/2224/edit` (S19, `?for=edit`) does not add a view. | 83, 84, 85 | 26.1, 26.2 |
| E2E-M09-52 | S20: header/tab/h1/subtitle, labels, placeholders, hint, option lists (subjects in id order), uploader strip "Admin Demo · Admin", footer order and one row; `https://youtu.be/abc123XYZ00` → after 500 ms "Platform dikesan: YouTube" + thumbnail src; Vimeo URL → "Vimeo", no thumbnail; `https://example.com/x` → nothing; admin: "Sekolah Saya" / "Tiada sekolah" disabled, click keeps "Semua Pengguna"; **provisional** step: as `guru@demo.test` (video-form school 900001) "Sekolah Saya" shows "SMK DEMO" and can be checked; as `pelajar2@demo.test` it stays "Tiada sekolah"; empty submit → `valueMissing` on video_url/title/category; "Batal" → `/video`. | 87, 88, 89 | 27.1, 27.2, 27.3, 27.4 |
| E2E-M09-53 | **Provisional** publish as `pelajar@demo.test`: Tutorial / Matematik / global → `/video` flash, "Semua (2261)", "Tutorial (13)", first card "Pelajar Demo", "0 tontonan". | 90 | 27.5 |
| E2E-M09-54 | Edit/delete as admin: #2224 shows "Edit" and "Padam"; "Padam" dialog "Padam video ini?" dismiss → kept; `/video/2224/edit` header/tab, h1, subtitle, preloaded fields, "Platform dikesan: Youtube", category without placeholder, footer order; **provisional** steps: save new title → detail flash + new title; delete accept → `/video` flash, "Semua (2259)". | 86, 91, 92 | 28.1, 28.2, 28.3, 28.4 |
| E2E-M09-55 | **Provisional** permissions: `pelajar@demo.test` on #2224 sees no "Edit"/"Padam"; `/video/2224/edit` redirects to the session landing page (§9; in-place 403 only if the landing is a video route); after publishing a video, both buttons show on it. | 86 | 28.5 |
| E2E-M09-56 | S22 as admin: header/tab, hero texts and button hrefs; 3 cards in order #4, #2, #3; pinned border + "Disematkan" on #4 and #2 (text hidden at 375, icon shown); initials "AD"/"SA"/"SM", names, "PENGETUA" (computed upper case), "Sekolah", "6 bulan yang lepas"; excerpts end with "..."; footers "Video disertakan", "👍 1", "❤️ 5", "0 komen", "3/4/55 baca"; "Baca selanjutnya" hrefs. | 93, 94, 95 | 29.1, 29.2, 29.3, 29.4 |
| E2E-M09-57 | **Provisional** scope: `pelajar@demo.test` and `guru@demo.test` (SMK DEMO) see only #2; `pelajarmaju@demo.test` (900004 SK Demo Bestari) sees neither #2 nor #3 (empty list); `suhaimi@demo.test` (author, 900002) sees #3; after the admin publishes a national post pelajar, guru and pelajarmaju all see it. | 95 | 29.5 |
| E2E-M09-58 | S23 #4: header "Perutusan"/"Sekolah", tab = title, back link, author header texts and "17 Mar 2026, 11:23PM", "Awam", "Disematkan"; body contains the basmalah and "Selamat Hari Raya Aidilfitri, Maaf Zahir dan Batin"; the player iframe under the NFR-M09-06 rule (its `src` is a `https://www.youtube.com/embed/…` URL; see SQ-M09-04 for the seed link); "3 baca", "0 komen". | 96, 97 | 30.1, 30.2 |
| E2E-M09-59 | Reads: the admin opens `/perutusan/4` twice and a guest opens `/perutusan/awam/4` → the list still shows "3 baca" (OBSERVED); **provisional**: `pelajar@demo.test` opens #2 twice → "5 baca"; author `salina@demo.test` opens #2 → still "5 baca". | 98 | 30.4 |
| E2E-M09-60 | Reactions: #4 buttons "👍 Suka 1", "❤️ Cinta", "🙏 Terima Kasih"; **provisional**: `pelajar@demo.test` clicks "❤️ Cinta" → "❤️ Cinta 1"; again → "❤️ Cinta". | 99 | 31.1, 31.2 |
| E2E-M09-61 | Comments: card texts, textarea `required` + `maxlength=1000`, empty submit blocked; **provisional**: send "Terima kasih cikgu" → a flash, "Belum ada komen" still shown, list "0 komen". | 100 | 32.1, 32.2 |
| E2E-M09-62 | Public link: #4 input value `…/perutusan/awam/4` read-only, click selects and copies; WhatsApp href text; #2 has no public box; guest `/perutusan/awam/4` opens without redirect and #4 stays "3 baca" (OBSERVED); **provisional**: it shows title and body, `/perutusan/awam/2` → 404. | 101, 102 | 33.1, 33.2, 33.3 |
| E2E-M09-63 | S24 as admin: header/tab, scope "Seluruh Malaysia (Kebangsaan)", title placeholder and `required`, editor placeholder, toolbar pickers (H2/H3/Normal, 35 swatches, 4 aligns) and buttons; type text → "HTML" → textarea holds `<p>…</p>`; edit it → "HTML" → editor shows the change; attachment labels/accepts; checkboxes unchecked; status default "Terbit Sekarang", "Jadualkan" shows the datetime field (not required), "Draf" hides it; title-only form valid; empty title blocked; footer one row; "Batal" → `/perutusan`. | 103, 104, 105, 106, 107, 108 | 34.1, 34.2, 34.3, 34.4, 34.5, 34.6 |
| E2E-M09-64 | **Provisional** submit: publish now → `/perutusan` flash, new post after the 2 pinned; schedule 2026-09-26 09:00 → absent until `mock.setNow('2026-09-26T09:01:00+08:00')`, then shown; draft → only on `/perutusan/saya`; as `azlan@demo.test` a third pin in school scope → 422 error under the checkbox, not stored. | 109 | 34.7, 34.8, 34.9 |
| E2E-M09-65 | S25: header/tab, "Kembali" and "Tulis Baru" hrefs, "Anda belum menulis perutusan"; **provisional**: `seedPerutusanDraft('admin@demo.test')` → the draft is listed with a status label and date, linking to its detail. | 110, 111 | 35.1, 35.2 |
| E2E-M09-66 | Panduan: guest and logged in — standalone (no shell), tab, hero, 5 tabs, Pelajar panel headings; `#guru`, `#ibubapa`, `#admin`, `#ppd` open their panels; `#xyz` → no active tab and no role panel (hero, help box, footer present); no hash → Pelajar; clicking "Ibu Bapa" sets `location.hash` `#ibubapa` without growing `history.length`; active tab border rgb(99, 102, 241); two FAQs open at once and close independently; top bar links per session state; <1024 links behind `fa-bars` (menu toggles); tabs 2/3/5 columns. | 112, 113, 114, 115 | 36.1, 36.2, 36.3, 36.4 |
| E2E-M09-67 | Help box: texts, `mailto:support@prestasiplus.my`, WhatsApp `https://wa.me/60123456789` with `target=_blank`; `mock.config('supportWhatsappNumber','60100000000')` → link follows the config (DV-14); guest sees "Daftar Percuma Sekarang" → `/register`, logged-in does not. | 116, 117 | 37.1, 37.2 |
| E2E-M09-68 | Tuition route: logged in `/pusat-tuisyen/panduan` renders the guide; guest → `/login`; guest `/panduan` opens. | 118 | 38.1, 38.2 |
| E2E-M09-69 | S14: header/tab, texts, drop zone, hidden input `accept=image/*` `multiple`, drag-over classes, "Jumlah: 0 fail", "Tiada fail lagi."; **provisional**: choose "Gambar Saya (1).PNG" → auto POST, "Jumlah: 1 fail", listed as `gambar-saya-1.png`; a 12 MB file → refused with an error flash. | 119, 120 | 39.1, 39.2, 39.3 |
| E2E-M09-70 | Navigation: user shell sidebar items and hrefs (≥1024) and drawer items (<1024; the `/pusat-tuisyen/panduan` item as the tuition-centre role — **provisional** role condition); admin sidebar "Audio KBAT" and "Kandungan" group (≥1024), "Lagi" sheet section "Kandungan" (<1024). | 121, 122, 01 | 40.1, 40.2, 41.1, 41.2 |
| E2E-M09-71 | Layouts and access: admin on `/artikel`, `/video`, `/audio-kbat`, `/perutusan` → user shell; `/admin/articles` → admin shell; guest redirects of AC-42.2 (incl. `/video/2224/edit`) → `/login` and the public routes (incl. `/perutusan/awam/4`) open; **provisional**: `pelajar@demo.test` → `/admin/articles` lands on `/dashboard`, `/api/admin/articles` 403. | 123, 124, 125 | 42.1, 42.2, 42.3 |
| E2E-M09-73 | S28 guest `/perutusan/awam/4`: no shell and not the `/artikel` guest layout; tab "{title} — PRESTASIPLUS"; top bar links (`/register`, `/login`; "Daftar Percuma" hidden at 375); hero texts incl. "17 Mac 2026", "11:23 PM", "PENGETUA", chips "1 Suka", "3 baca", "0 komen"; body text; player iframe with `src` `https://www.youtube.com/embed/…` (NFR-M09-06); no reaction button, no textarea, no public-link input; share hrefs; "Salin Pautan" → clipboard = page URL and "Disalin!"; CTA and footer texts and hrefs ("Daftar Percuma Sekarang" → `/register`, "Tentang" → `/tentang` shows the global 404 page, "Hubungi" → `/panduan`); afterwards `/perutusan` (admin) still "3 baca". | 130, 131, 132, 133, 134 | 44.1, 44.2, 44.3, 44.4, 44.5 |
| E2E-M09-74 | S28 responsive: `scrollWidth ≤ innerWidth` at 375/768/1280; player sizes 267×150 / 636×358 / 635×357 (±2px); share buttons on 2 rows and CTA buttons full width at 375. | 135 | 44.6 |
| E2E-M09-72 | Responsive: for S1–S27 (and the DV-01 form) `document.documentElement.scrollWidth ≤ innerWidth`; S1/S5/S9 at 375 and 768 the table card has `scrollWidth > clientWidth`, no `position: sticky` cell, scrolling it reveals "TINDAKAN"; grids per §10 (`/artikel` 1/2/6, `/video` 1/2/6, panduan tabs 2/3/5, S13 options 1/2/2); footers of S2, S3, S10, S11, S19, S20, S24 share one row at 375. | 126, 127, 128, 129 | 43.1, 43.2, 43.3, 43.4 |

### 12.1 Traceability (US → FR → E2E)

Checked by script (`trace.js` in the author's scratchpad `m09/`, Node) over this SRS and the URS: every FN in URS §3 is cited by ≥1 FR; every AC is cited by ≥1 FR (under its own story) and ≥1 E2E; every FR by ≥1 E2E; no reference points to a missing id. **v1.8 (2026-10-02): the script was not re-run** — `trace.js` lived in an earlier author scratchpad and is not in the repository, and this revision had no shell to run one; v1.8 adds, removes and renumbers no FN, US, AC, FR or E2E, and every reference edited was checked by hand against the tables below. **Last scripted result (v1.5, 2026-09-27): FN 235, US 44, AC 170, FR 135, E2E 74; 0 dangling references, 0 errors.** (235 FN, each cited by ≥1 FR; 170 AC, each cited by ≥1 FR and ≥1 E2E; 135 FR, each cited by ≥1 E2E.)

| US | FR | E2E |
|---|---|---|
| US-M09-01 | 01, 02, 03, 04, 05, 06, 07 | 01, 02, 03, 04 |
| US-M09-02 | 08, 09, 10 | 05, 06, 07 |
| US-M09-03 | 11, 12, 13, 14, 15 | 08, 09, 10 |
| US-M09-04 | 16, 17, 18 | 11, 12 |
| US-M09-05 | 19, 20, 21 | 13, 14 |
| US-M09-06 | 22, 23, 24, 25, 26, 27 | 15, 16, 17 |
| US-M09-07 | 28 | 18 |
| US-M09-08 | 29, 30, 31, 124 | 19 |
| US-M09-09 | 21, 32, 33, 34, 35, 36, 37 | 20, 21, 22, 23 |
| US-M09-10 | 38, 39 | 24, 25 |
| US-M09-11 | 40, 41 | 26, 27 |
| US-M09-12 | 42, 43, 44 | 28, 29, 30 |
| US-M09-13 | 45 | 30 |
| US-M09-14 | 46, 47, 48 | 31, 32, 33 |
| US-M09-15 | 20, 49, 50 | 34 |
| US-M09-16 | 51, 52, 53 | 35, 36 |
| US-M09-17 | 54, 55, 56, 57 | 37, 38 |
| US-M09-18 | 58, 59 | 39 |
| US-M09-19 | 60 | 40 |
| US-M09-20 | 61, 62, 63, 64, 65 | 41, 42 |
| US-M09-21 | 61, 66, 67, 68, 69, 70, 71 | 43, 44 |
| US-M09-22 | 72, 73, 74 | 45, 46 |
| US-M09-23 | 75 | 46 |
| US-M09-24 | 76, 77, 78, 79, 80, 81 | 47, 48, 49 |
| US-M09-25 | 82 | 50 |
| US-M09-26 | 38, 83, 84, 85 | 24, 51 |
| US-M09-27 | 87, 88, 89, 90 | 52, 53 |
| US-M09-28 | 86, 91, 92 | 54, 55 |
| US-M09-29 | 93, 94, 95 | 56, 57 |
| US-M09-30 | 38, 96, 97, 98 | 24, 58, 59 |
| US-M09-31 | 99 | 60 |
| US-M09-32 | 100 | 61 |
| US-M09-33 | 101, 102 | 62 |
| US-M09-34 | 103, 104, 105, 106, 107, 108, 109 | 63, 64 |
| US-M09-35 | 110, 111 | 65 |
| US-M09-36 | 112, 113, 114, 115 | 66 |
| US-M09-37 | 116, 117 | 67 |
| US-M09-38 | 118 | 68 |
| US-M09-39 | 119, 120 | 69 |
| US-M09-40 | 121 | 70 |
| US-M09-41 | 122 | 70 |
| US-M09-42 | 123, 124, 125 | 71 |
| US-M09-43 | 126, 127, 128, 129 | 72 |
| US-M09-44 | 130, 131, 132, 133, 134, 135 | 73, 74 |


## 13. Open questions

Carried from URS §9 (OQ-M09-01…14), plus:

1. **SQ-M09-01 Loading state.** Live pages are server-rendered with no visible loading state; the prototype uses the shell's global page loader while a mock call is pending (FR-G-10), as M07 SQ-M07-01.
2. **SQ-M09-02 Media (superseded by D22, v1.8).** NFR-M09-06 no longer uses local placeholders: real `img.youtube.com` thumbnails and real iframes under a host allow-list. The earlier question (is an offline placeholder acceptable) is closed. **DECIDED** (accepted by the lead under D22): the prototype needs network access to `img.youtube.com` and the embed hosts. SRS.md §4.4 ("no external service") needs a matching note for these hosts; SRS.md is not edited here and the lead routes that change.
3. **SQ-M09-03 M05 data source.** When M09 is built, M05 `GET /api/dashboard` must read `banners` from §7 #20 and `articles` from §7 #9 instead of its §6.12 placeholders (same records; OQ-M09-13a).
4. **SQ-M09-04 Remaining fabricated media in the seed (D22) — DECIDED, deferred to M09-T4b.** Perutusan is not part of the current build rows. Perutusan #3 and #4 still carry invented YouTube links (`watch?v=SEEDPRT0003`, `SEEDPRT0004`, §6.9): a known D22 gap until M09-T4b, when the posts' video ids are captured from live (D22); if a post's video cannot be captured, the live "no media" state is shown. Audio KBAT: live has 0 sets and no audio file is seeded; the provisional fixture's file names (`audio1.mp3`…) exist only in the E2E-only `seedAudioKbatSet()` and the uploaded test buffer is test input, not shipped media.
5. **SQ-M09-05 Article list element — CLOSED.** The S16 inventory records the 5 list items (EL-M09-S16-032…036), so AC-09.3 and E2E-20 assert the 5 items in order (exact texts); the parent (`ol` / `ul`) is not recorded, is not asserted, and is decided by the developer from the screenshot.
