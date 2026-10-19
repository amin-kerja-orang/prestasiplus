# M09 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 3 (`playwright3`; credentials not stored) plus a cookie-less guest context for the public pages.
- **Method:** the same pipeline as M01–M08: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M09.js`, 132 UI states over 27 screens in groups A–K; top-up `tools/jobs/M09-topup.js`, 4 guest states of S28 (group T) with its own AWAMMASK and 3 screenshots.
  - Screen map: `tools/jobs/M09.screens.json`.
  - Masked screenshots: `tools/jobs/M09.shots.js` + `tools/shoot.js`, 49 PNGs in `docs/discovery/img/M09/`, plus 3 top-up PNGs `perutusan-awam-*.png` (taken in the guest context by an inline runner that mirrors `tools/shoot.js`) = 52.
  - Appendix generator: `tools/jobs/M09-appendix.js` (copy of the M07 helper).
  - Crawl re-classification: `tools/jobs/M09-crawl.js` (see §3).
  - **No shared tool was modified.**
- **View counters:** `/artikel/{slug}`, `/video/{id}` and `/perutusan/{id}` were each requested **once** from live (article #10 "Pembaca" 595 → 596; video #2224 120 → 121; perutusan #4 "baca" stayed 3). Every later capture of those three pages (inventory states and screenshots) was served by a Playwright `context.route` cache of that single response. The counters were re-read afterwards and had not changed again.
- **Privacy:**
  - Every job runs `M09MASK` (in `tools/jobs/M09.js`) before and after its actions, then `tools/sanitize.js` with `{titleName:false}` (panduan jobs: sanitize off — no personal data; sanitize rule 1e would mask the role labels).
  - `M09MASK` collects display names next to avatar-initial circles (article cards, video uploader, perutusan poster and detail header), "Oleh: …" lines and the admin show-page `fa-user` line, keeps "Admin PRESTASI+", and replaces every occurrence (text, attributes, input values, templates, title) with `<person>`. It masks teacher names inside copy ("Cikgu X", "Chekgu X" → "Cikgu <name>"; product names Cikgu Alesa / Cikgu Suara excluded) and YouTube channel handles (`youtube.com/@<channel>`). Its in-page leak check reported **0 leaks** in all 132 states; `meta.piiLeakCheck` (sanitize) is 0 in all states.
  - The first capture pass missed the YouTube channel handle in one video description (4 files); it was replaced in the raw and merged files with `@<channel>`, the rule was added to `M09MASK`, and `video-detail.png` / `video-desktop.png` / `video-mobile.png` were re-shot.
  - `tools/sanitize.js` also replaced the logged-in account's own display name "Admin PRESTASI+" with `<name>` on user-portal pages (rule 2, Alpine user-name data). It is the platform account, not a person; the narrative quotes it where needed.
  - A grep of all raw and merged M09 files, the narrative and the job files found no personal names, no `bin`/`binti` patterns and only the e-mails `support@prestasiplus.my` (platform) and `nama@email.com` (login placeholder).
  - Exploratory files and MCP snapshots of unmasked pages under `.playwright-mcp/lane3/` (git-ignored) were deleted.
- **Files:** screen inventories `S1-admin-articles.json` … `S28-perutusan-awam.json`; chrome `SHU-user-shell.json` (S15–S25) and `SHA-admin-shell.json` (S1–S14), owned by the global doc; `_crawl.json`; raw captures `../_raw/M09/*.json` (132).
- **Status legend:** same as M01–M08. `normalizeIds` is on. Repeated items are limited via `opts.repeat` with totals in each state's `meta.repeats`: admin table rows 3; `/artikel` hot cards 1 and grid cards 2; `/video` cards 2; Audio KBAT create question blocks 1 (of 30).

## 1. Per-screen counts

M09 content totals **2,054 elements** over 28 screens and **136** captured states (S28 added in top-up) (1280 / 768 / 375, plus guest). The shells add 390 (user) and 226 (admin) chrome elements. **Only one captured state has horizontal page overflow:** S4 `default@375` (424 px > 375 px, D-4). Table overflow inside cards is described in narrative §7 (D-13).

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured (1280 unless marked) |
|---|---|---|---|---|---|---|---|---|
| S1-admin-articles `/admin/articles` | 59 | 38 | 13 | 8 | 2 | 9 | 9 | default, category, draf-empty, filtered-page-2, last-page, not-found-flash, search, default@375, default@768 |
| S2-admin-article-create `/admin/articles/create` | 22 | 21 | 0 | 1 | 0 | 0 | 4 | default, filled, default@375, default@768 |
| S3-admin-article-edit `/admin/articles/{id}/edit` | 23 | 21 | 0 | 2 | 0 | 0 | 4 | default (#10), not-featured (#11), default@375, default@768 |
| S4-admin-article-show `/admin/articles/{id}` | 16 | 11 | 5 | 0 | 0 | 0 | 4 | default, not-featured, default@375 (OVERFLOW), default@768 |
| S5-admin-notes `/admin/notes` | 39 | 29 | 4 | 6 | 0 | 0 | 7 | default, not-found, search, subject, type-empty, default@375, default@768 |
| S6-admin-note-create `/admin/notes/create` | 7 | 7 | 0 | 0 | 0 | 0 | 2 | server-error (HTTP 500), server-error@375 |
| S7-admin-note-edit `/admin/notes/{id}/edit` | 7 | 7 | 0 | 0 | 0 | 0 | 2 | server-error (#1), server-error-2 (#2) |
| S8-admin-note-show `/admin/notes/{id}` | 17 | 17 | 0 | 0 | 0 | 0 | 3 | default, default@375, default@768 |
| S9-admin-banners `/admin/banners` | 27 | 20 | 1 | 6 | 0 | 0 | 4 | default, not-found-flash, default@375, default@768 |
| S10-admin-banner-create `/admin/banners/create` | 30 | 28 | 1 | 1 | 0 | 0 | 6 | default, article, external, external-back, default@375, default@768 |
| S11-admin-banner-edit `/admin/banners/{id}/edit` | 31 | 28 | 1 | 2 | 0 | 0 | 4 | default (#1), feature (#2), external, default@375 |
| S12-admin-audio-kbat `/admin/audio-kbat` | 28 | 28 | 0 | 0 | 0 | 0 | 4 | default, filtered, default@375, default@768 |
| S13-admin-audio-kbat-create `/admin/audio-kbat/create` | 83 | 82 | 0 | 1 | 0 | 0 | 3 | default, default@375, default@768 |
| S14-admin-screenshots `/admin/tools/screenshots` | 12 | 10 | 0 | 2 | 0 | 0 | 3 | default, default@375, default@768 |
| S15-artikel `/artikel` | 246 | 34 | 206 | 6 | 2 | 9 | 9 | default, category, search, empty, filtered-page-2, last-page, guest, default@375, default@768 |
| S16-artikel-detail `/artikel/{slug}` | 69 | 58 | 8 | 3 | 0 | 8 | 5 | default (cached), link-copied, not-found, default@375, default@768 |
| S17-video `/video` | 235 | 40 | 164 | 31 | 2 | 18 | 9 | default, category, subject, empty, lain-lain, last-page, guest, default@375, default@768 |
| S18-video-detail `/video/{id}` | 37 | 25 | 7 | 5 | 0 | 0 | 4 | default (cached), not-found, default@375, default@768 |
| S19-video-edit `/video/{id}/edit` | 40 | 26 | 7 | 7 | 0 | 0 | 3 | default, not-found, default@375 |
| S20-video-tambah `/video/tambah` | 37 | 28 | 3 | 6 | 0 | 0 | 7 | default, youtube, vimeo, unknown-url, school-clicked, default@375, default@768 |
| S21-audio-kbat `/audio-kbat` | 11 | 8 | 0 | 3 | 0 | 0 | 4 | default, filtered, default@375, default@768 |
| S22-perutusan `/perutusan` | 46 | 43 | 0 | 3 | 0 | 2 | 3 | default, default@375, default@768 |
| S23-perutusan-detail `/perutusan/{id}` | 79 | 62 | 7 | 10 | 0 | 0 | 4 | default (cached), not-found, default@375, default@768 |
| S24-perutusan-tulis `/perutusan/tulis` | 93 | 36 | 45 | 12 | 0 | 0 | 10 | default, scheduled, draft, html-mode, header-picker, color-picker, align-picker, title-only, default@375, default@768 |
| S25-perutusan-saya `/perutusan/saya` | 7 | 4 | 0 | 3 | 0 | 0 | 2 | default, default@375 |
| S26-panduan `/panduan` | 323 | 80 | 222 | 21 | 4 | 3 | 10 | default (pelajar), guru, ibubapa, admin, ppd, faq-open, guest, default@375, menu-open@375, default@768 |
| S27-tuisyen-panduan `/pusat-tuisyen/panduan` | 359 | 80 | 43 | 236 | 1 | 3 | 3 | default, guest (→ /login; 46 login elements), default@375 |
| S28-perutusan-awam `/perutusan/awam/{id}` (added in top-up) | 71 | 69 | 1 | 1 | 0 | 1 | 4 | guest: default (cached single response), link-copied, default@768, default@375 |
| SHU-user-shell (chrome of S15–S25) | 390 | 152 | 33 | 205 | 15 | 148 | 54 | all user-portal states |
| SHA-admin-shell (chrome of S1–S14) | 226 | 80 | 38 | 108 | 7 | 75 | 55 | all admin states |

Why S15, S17, S26 have many conditional elements: the "Artikel Paling Hangat" set is random on every load, filtered states show different cards, the guest layout is a different page, and panduan shows one of five role panels at a time (the hidden panels are `x-show` elements, captured as hidden-only in S27 and conditional in S26).

**Empty / error / special states captured:** S1 "Tiada artikel dijumpai." + flash "Artikel tidak dijumpai."; S5 "Tiada nota dijumpai."; S9 flash "Banner tidak dijumpai."; S12 "Belum ada set Audio KBAT."; S14 "Tiada fail lagi."; S15 "Tiada Artikel Dijumpai"; S17 "Tiada Video Dijumpai"; S21 "Belum ada set Audio KBAT yang approved."; S23 "Belum ada komen"; S25 "Anda belum menulis perutusan"; S6/S7 HTTP 500; 404 pages for unknown article slug, video id, video edit id, perutusan id; guest layouts of `/artikel`, `/video`, `/panduan`; guest redirect of `/pusat-tuisyen/panduan`.

**Client-side reveals captured:** banner link type → external URL field (and value kept after switching back); video URL detection (YouTube with thumbnail, Vimeo, unsupported); disabled "Sekolah Saya" card (click has no effect); perutusan status → scheduled datetime field, HTML toggle, three Quill pickers; article copy-link toast "Link Disalin!"; panduan role tabs, FAQ accordions and mobile menu; native validity of every create/edit form (`VAL` in the action log).

**Evidence probes recorded in the raw action logs:** computed colours (`COL`), button positions and document width (`BTNS`), inner horizontal scroll (`SCR`), selected values of every select (`SELS`, edit preload check), Alpine state (`linkType`, `preview`, `vis`).

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M09 docs/discovery/M09-content.md` reports **0 candidates on all 27 screens**. The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings (generated by `tools/jobs/M09-appendix.js`), followed by emoji-normalised copies of 24 strings (the diff tool strips U+FE0F from probes, so strings with "👁️" / "❤️" only match without the variation selector). Appendix A holds the enumerations.

Items that only the scripted captures and probes surfaced (all in the narrative):
1. CKEditor 5 is blocked by the CSP; article content is a raw HTML textarea (D-2).
2. Banner edit does not preload type / link type / audience (stored upper-case values; the form is invalid as loaded) (D-6).
3. Note type filter never matches stored types (D-7); note create/edit return HTTP 500 (D-1).
4. Admin article pager drops filters (D-5), while `/artikel` and `/video` pagers keep them.
5. Admin previews print escaped HTML; S4 overflows at 375 (D-3, D-4).
6. Student Audio KBAT hero and "Tapis" button lose their backgrounds (unreadable / invisible) (D-11).
7. "HOT" on `/artikel` = featured (13/13); the hot section is random and hidden while filtering.
8. Opening a public article or video adds a view; the admin preview does not.
9. Video pills with 0 link to `#`; subject pills depend on the current category/search.
10. `/pusat-tuisyen/panduan` needs login while `/panduan` is public (D-14).

## 3. New routes found by the crawl

399 unique URLs in `_crawl.json`: 210 M09, 17 M10 (incl. `/guru/artikel`), the rest in other modules via the shells, 6 unknown (`/api/tournament/active`, `/chatbot/history|rate|send`, `/fcm/token`, `/latih-tubi` from the 404 page) and `/` (global).

**Tool note:** `merge-inventory.js` classified every URL as M08 because the TRACKER M08 line "Sub-routes found by crawl: `/prestasi/sekolah|tingkatan|tingkatan/{t4|t5}|{userId}`" becomes an un-grouped alternation regex that matches everything. `tools/jobs/M09-crawl.js` re-classified `_crawl.json` with each route wrapped in a group (the shared tool was not changed). The Delivery Lead may want to fix the shared tool or the TRACKER notation for other modules.

Not yet in the TRACKER M09 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/admin/articles/create` | screen | S1 | S2 |
| `/admin/articles/{id}` | screen + PUT/DELETE | S1, S3, S4 | S4 preview; unknown → 302 + flash |
| `/admin/articles/{id}/edit` | screen | S1, S4 | S3 |
| `/admin/notes/create` | screen | S5 | S6, **HTTP 500** |
| `/admin/notes/{id}` | screen + DELETE | S5 | S8 |
| `/admin/notes/{id}/edit` | screen | S5, S8 | S7, **HTTP 500** |
| `/admin/banners/create` | screen | S9 | S10 |
| `/admin/banners/{id}/edit` | screen | S9 | S11 |
| `/admin/banners/{id}` | PUT / DELETE | S9, S11 | no GET screen |
| `/admin/audio-kbat/create` | screen | S12 | S13 |
| `/admin/audio-kbat/template`, `/template-word` | file download | S12, S13 | **not opened** |
| `/video/{id}` | screen | S17 | S18 |
| `/video/{id}/edit` | screen + PUT/DELETE | S18 | S19 |
| `/video/tambah` | screen | S17 | S20 (POST `/video`) |
| `/perutusan/{id}` | screen | S22 | S23 |
| `/perutusan/{id}/react`, `/perutusan/{id}/comment` | POST | S23 | not submitted |
| `/perutusan/awam/{id}` | public page | S23 (read-only input / WhatsApp text) | S28 (top-up): guest 200, one request, cached |
| `/perutusan/tulis` | screen + POST | S22 | S24 |
| `/perutusan/saya` | screen | S22 | S25 |

M10-owned links recorded only: `/guru/artikel` ("Sumbang Artikel"), `/guru/artikel/cipta` ("Tulis Artikel Baru"), `/guru/artikel/{id}/edit`.

Probed and **not** routes: `/admin/tools` (404), `/admin/articles/categories` (302 → list, "Artikel tidak dijumpai."), `/admin/audio-kbat/1` (404, no sets), `/admin/audio-kbat/template-x` (500).

## 4. Read-only limits

See narrative §8 (open questions) and §9 (states requiring a live action): save/delete results and flashes, notes forms (HTTP 500), Audio KBAT rows and student player, perutusan reactions/comments/moderation/public page/scheduling, screenshot file list, and role-dependent views (student, teacher, principal) including the perutusan scope and the enabled "Sekolah Saya" video option.

## 5. Top-up (S28 `/perutusan/awam/{id}`)

- **Single request:** a fresh cookie-less browser context was created on lane 3, the old guest context was closed, and `GET /perutusan/awam/4` was requested **once** (HTTP 200). A `context.route` cache served that response to all 4 states and 3 screenshots.
- **Stable IDs:** re-merging with S28 added left every existing screen's IDs, keys and texts unchanged (verified by diffing all 27 files before and after: 0 changed). S28 has 71 elements, `EL-M09-S28-001…071`.
- **Privacy:** AWAMMASK replaced the poster display name with `<person>` and school names with `<school>`, using a generic SMK/SK/SMKA/SJK/MRSM/SBP regex that also covers `+` / `%20` encoded share URLs and the tab title. It reported 0 leaks in every state, and sanitize.js `piiLeakCheck` was 0. A grep of the S28 files found neither name.
- **Crawl:** 403 URLs. The new unknown URLs `/daftar`, `/tentang` and `/hubungi` are **404** for a guest (D-16).
- **Read count:** after the top-up the admin list page `/perutusan` still shows **"3 baca"** for #4. It was read as admin from the list only; the detail page was not opened.
- **Diff:** `diff-narrative.js` still reports **0 candidates on all 28 screens**.
