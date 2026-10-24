# M09 — Content: Articles, Notes, Banners, Audio KBAT, Video, Perutusan, Panduan — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M09 Content |
| Version | 1.7 |
| Date | 2026-10-02 |
| Status | **Approved (G1)**; v1.7 = doc-only M09 reader-screen build decisions and D22 (videos are live data); v1.4 = cross-module logic review batch 2 fixes (XL2-19, XL2-26, XL2-31, XL2-33). Fidelity deviations decided under user rule D9 (pre-approved) and D10. |
| Author | product-analyst (agent) |
| Source discovery | [M09-content.md](../../discovery/M09-content.md) (rules R-1…R-14, defects D-1…D-15, OQ-1…9, live-session states L-1…L-7, Appendices A–B), element inventory [`inventory/M09/`](../../discovery/inventory/M09/) (`S1…S27-*.json`, `SHU-user-shell.json`, `SHA-admin-shell.json`, `_crawl.json`, `_summary.md`), global shell [00-global-ui.md](../../discovery/00-global-ui.md), screenshots `docs/discovery/img/M09/` (49, masked) |
| Companion SRS | [srs/M09-content.md](../srs/M09-content.md) |
| Related | [M05 practice](M05-practice.md) (dashboard carousel and article strip consume M09 data), [M01](M01-authentication.md) (login redirect, 404 page, seed accounts), [M02](M02-users-schools.md) (users, schools, role labels), [M03](M03-curriculum.md) (subjects and levels), M10 (teacher article contribution `/guru/artikel`), M16 (tournament banner), M22 (push notifications), M23 (shell), M24 (Duta may reference content) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.7 | 2026-10-02 | **Revision history — v1.7, M09 reader-screen build decisions (doc-only; same US, FN and AC ids; none added, removed or renumbered).** D22: the 2,260 videos are live data (titles, YouTube ids, views, order and age texts from the 2026-10-02 capture `inventory/M09/_live-videos.json`); thumbnails are real and players are real iframes under a host allow-list, so the earlier "placeholder" wording is gone (FN-6.1.6, 6.3.3). New DV-M09-20 (D9: every video under exactly one subject — live `?subject=` pagination hides 329 videos) and DV-M09-21 (D9: panduan footer logo centred); DV-M09-10 now also covers "Semua (0)". New §7 decision notes DN-M09-01…06 (guest video detail L-7, S19 refusal, S19 visibility sub-lines, `search` appended last in pill links, school-visibility reset, edit-page opens do not count). FN-5.3.6 / AC-23.x: Audio KBAT player copy (PROPOSED COPY). FN-8.1.x: panduan step-number colours (INFERRED), help-box defaults, hash read once. AC-09.3: asserts the 5 list items of article #10 in order, without naming the parent `ol`/`ul`. AC-24.2 / AC-26.1: view counts of the capture (134 / 135). Share-icon and sanitising notes. |
| 1.6 | 2026-09-30 | **Revision history — v1.6, privacy (doc-only).** FN-M09-5.2.3: the fictitious example name in the "Sumber / Penyumbang" prototype placeholder is now "Contoh: Cikgu Demo 02". No other change. |
| 1.5 | 2026-09-27 | **Revision history — v1.5, XL batch 3 round 3 (R3-03, Minor).** Canonical account 4 `pelajarmaju@demo.test` is now at fixture school 900004 "SK Demo Bestari" (M02 v1.16); only the admin remains at 900002. AC-M09-29.5 is re-scoped: pelajarmaju sees neither school post (#2, #3) until a national post exists; #3 is seen by its author `suhaimi@demo.test` (3104, 900002) and the admin. Observed perutusan data unchanged (post #3 stays scoped to 900002). Trace 0 errors. |
| 1.4 | 2026-09-26 | **Revision history — v1.4, cross-module logic review batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`). XL2-19 (Major): the Article entity (M09 store, D12) now defines the fields the M10 teacher form `/guru/artikel` writes — `youtubeUrl` and the `ArticleAttachment` table (≤ 5 files × 20 MB, PDF/Word/Excel/PowerPoint, optional label; field names from M10 SRS #67–#70 and FN-M10-9.2.4/9.2.5/9.3.5) — plus the repository methods M10 calls; the M09 admin form and the reader pages S15/S16/S4 do not show them (as live; FN-2.4.2, AC-11.2 re-worded: teacher articles are created unpublished and published by the admin on S3). XL2-26: E2E-27 follows that flow. XL2-31: status line refreshed (Approved, G1). XL2-33: the default mock clock is `2026-09-25T15:40:00+08:00`, the same as M05/M08/M10/M11 (every observed relative age still holds; builder re-run). No other requirement changed; coverage 2,054/2,054; trace 0 errors. |
| 1.3 | 2026-09-25 | **Revision history — v1.3, discovery top-up S28** (`docs/discovery/M09-content.md` §2.27, D-16; inventory `S28-perutusan-awam.json`, `_summary.md` §5). New screen S28 `/perutusan/awam/{id}` (71 elements, EL-M09-S28-001…071): FT-M09-7.5 now OBSERVED — FN-7.5.1…7.5.9 (standalone public layout, Malay date, count chips only, YouTube embed, "Kongsi Perutusan" with "Salin Pautan" → "Disalin!", CTA, footer, guest restrictions); new US-M09-44 (AC-44.1…44.6); AC-33.3 points to it. New deviations DV-M09-18 (D-16: "Daftar Percuma" / "Daftar Percuma Sekarang" `/daftar` 404 → `/register`) and DV-M09-19 (D-16: footer "Hubungi" `/hubungi` 404 → `/panduan`; "Tentang" `/tentang` 404 replicated, no about page exists). Round-2 minors: AUD-M09-R2-01 (FN-6.1.9 lists the two newly observed video orderings, reproduced by the seed) and AUD-M09-R2-02 (OQ-M09-13c closed: recorded in M02 v1.6). Additive only; unrelated sections unchanged. Coverage re-generated **2,054/2,054** (1,980 mapped, 74 excluded), 0 unmapped; trace 0 errors. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, privacy correction.** Every person in the seed is fictitious: the platform account label "Admin PRESTASI+" is the canonical admin (id 1, "Admin Demo"); every article author masked on live is the single fictitious author "Cikgu Demo 01" (id 3101) — the live structure is kept (36 platform-account articles, 36 masked-author articles; the live list does not show how many distinct persons the masked authors are); perutusan principals (3102–3104), reactors (3105–3109) and video uploaders (admin) are fictitious; no commenter exists. The non-personal live facts (ids, titles, categories, levels, featured, views, created dates, page orders, perutusan read observations) are now repo evidence at `docs/discovery/inventory/M09/_live-articles.json`, with authors as `platform` / `<author-1>` tokens only. The TRACKER id note (3101–3109) and the M02 requests (school 900003, user block 3101–3109) stay pending requests for the Delivery Lead. No requirement changed; coverage 1,983/1,983, trace 0 errors. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit round 1 fixes** (`docs/qa/audit/M09-audit.md`, FAIL 0/4/8) with Delivery Lead decisions and the new project decisions D11 (virtual datasets, named count queries), D12 (one owner per store), canonical seeds 1–11 and the users id policy. AUD-01: the article seed is the 72 live articles (live ids, full titles, categories, levels, featured flags, authors and views from the admin list; reader order from `/artikel` pages 1, 2, 4) — SRS §6.9; reader order key = publish date, ties id ascending (FN-2.1.8). AUD-02: video order key reproduces page 1, `?subject=5` (2224…2247 ascending), `?category=motivasi` (18, 17, 16) and page 95 (FN-6.1.9; AC-24.5). AUD-03: perutusan read rule consistent with the two non-counting observations (FN-7.2.12, AC-30.4). AUD-04: `guru@demo.test` at SMK DEMO (900001) (AC-27.3, AC-29.5). AUD-05: the video form's school is its own INFERRED source, evidence corrected (FN-6.4.6, §7, OQ-07). AUD-06: guest `/perutusan/awam/4` 200 and guest `/video/{id}/edit` → `/login` OBSERVED (FN-7.5.1, 10.3.2, AC-33.3, 42.2). AUD-09: unknown `#hash` shows no panel (FN-8.1.3, AC-36.2). AUD-10: DV-08 drops the stale subtitle on S21 too (DV-SH-03); DV-09 cites the container `text-white` (FN-5.3.1/5.3.2, AC-22.1/22.2). AUD-11: seed users with ids (M09 anchors 3101–3109) and a fictitious school (SRS §6.9). AUD-12: subject pills ignore the active subject; link building (FN-6.1.3/6.1.4, AC-24.5). AUD-07/08 are SRS fixes. Discovery corrected ("corrected after audit"). Coverage re-generated 1,983/1,983, 0 unmapped; trace 0 errors. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness), D9 (deviation rule) and D10. §3 breakdown and §6 coverage matrix generated by script (`gen.js` from the Function catalogue `fns.js` and the inventory JSON): 1,983/1,983 content elements covered (1,909 mapped to a Function, 74 excluded with reason), 0 unmapped. Deviations DV-M09-01…17 (9 fixes, 1 precedent = M01 DV-M01-02, 1 PROPOSED pending the owner, 6 rejected — replicate live). Written with the lessons of the M03–M07 audits applied: seeds mirror live (72 / 13 / 10 / 5 / 0 / 2,260 / 3), no tuned observed values, minimal fixes that create no new contradiction, role-based layouts kept, in-card table scroll kept, native `required` recorded, PROPOSED vs UNVERIFIED COPY separated, provisional E2E marked. |

**Conventions** (same as M04–M07)
- Quoted UI copy is the exact live text as displayed: Bahasa Melayu, or English where the live site is English (Laravel pager "Showing … results", "« Previous" / "Next »", Audio KBAT statuses "Approved" / "Draft" / "Pending Review" / "Archived", the admin column "Views", the badge "Featured"). Where CSS upper-cases text, the displayed form is given (table headers "TAJUK" …, role pill "PENGETUA").
- **OBSERVED** = seen on the live site (walk-through, inventory state, page markup or script). **SOURCE-DERIVED** = taken from live markup, classes or copy captured read-only, for a state that was never rendered (e.g. the intended Audio KBAT hero gradient from its class names; the player layout from the copy "soalan dipaparkan serentak mengikut section"). **INFERRED** = the most likely live behaviour, not observed (every POST outcome, role-dependent views, server rules); no new UX is invented for it. **Provisional** = a prototype stand-in for a live page or state that works but was not observed (L-3, L-4, L-5, L-7); it asserts no unobserved detail and is replaced after the live session.
- **UNVERIFIED COPY** = live text that exists but could not be captured (post-submit flashes, validation messages from the server, labels of states with no live data). The prototype shows PROPOSED COPY placeholders (SRS §8.2) until verified (§9 OQ-M09-09, OQ-M09-11); E2E asserts only that the flash or pill appears, not its words.
- **PROPOSED COPY** = new BM text written for a D9 fix where live has no working original (DV-M09-01 notes form labels; the "Hantar" button of the provisional Audio KBAT player). It needs the owner's acceptance at G1 (OQ-M09-11).
- **DV-M09-nn** = fidelity deviation (§7). Anything not listed there must match live. **SEC-M09-nn** = a risk of the live behaviour, replicated with dummy data and recorded for security review (SRS §11).
- **L-n** = a live-session state from discovery §9 that needs a submit or another role (not observed). Each is mapped in §5.1.
- **D10:** accessibility (ARIA, keyboard, focus, motion) replicates live, with no enhancements. A deliberate, consistent live limitation is not "broken"; adding options to a working feature is new scope.
- Personal data: authors and posters were masked in discovery (`<person>`, `Cikgu <name>`). Article, video and perutusan titles are public content and are quoted. Every person in the seed is fictitious; the platform account "Admin PRESTASI+" is the seed admin "Admin Demo".
- `{id}` = numeric id (live ids kept where observed, SRS.md §7.4 exception); `{slug}` = article slug; `{CODE}` = article category code.

---

## 1. Overview

M09 is the platform's **content layer**. It has an admin half and a reader half.

1. **Admin panel (admin shell):** manage **articles** (list with filters, create, edit, preview, delete), **notes** (list, preview, delete; create/edit return HTTP 500 on live, fixed by DV-M09-01), **banners** (list, create, edit, delete — they feed the M05 dashboard carousel), **Audio KBAT** listening-test sets (list with stats and filters, a 4-section × 30-question create form, template downloads) and a private **screenshot upload** tool.
2. **User portal and public pages:** read **articles** (random "Artikel Paling Hangat", category pills, search, grid, detail with share, related and latest articles; a public layout for guests), browse, add, edit and delete **videos** (URL-based, platform detection, category and subject pills, global or school visibility; public layout for guests), **Audio KBAT** for students (approved sets only), **Perutusan** (official messages: pinned max 2, public share link, reactions, moderated comments, a Quill editor with an HTML toggle, attachments, publish now / schedule / draft, scope by the author's role) and the **Panduan Pengguna** guide (5 role tabs with `#hash` deep links, FAQ accordions).

**Content model (OBSERVED, live 2026-09-25).**

| Content | Live count | Key facts |
|---|---|---|
| Articles | 72 (all published, 0 drafts) | 7 categories; level `SEMUA` / `DARJAH_1`…`DARJAH_6`; 13 featured → "HOT" on cards, "Pilihan" on the detail, "PILIHAN" in the hot section, amber star in the admin list; views counted per open |
| Notes | 10 | subject, stored type (FORMULA / RINGKASAN / LENGKAP / TIPS_TRICKS), level "DARJAH n", views, downloads; no reader page |
| Banners | 5 | stored types HERO / FEATURE / PROMOTIONAL / ANNOUNCEMENT, audience ALL / STUDENT, link type NONE, order 1–5, 01/01/2026–31/12/2026, active |
| Audio KBAT sets | 0 | 4 audio sections × 30 MCQs in fixed order; statuses draft / pending_review / approved / archived; create defaults to Approved |
| Videos | 2,260 | 5 categories (Ceramah 2,242); subjects Matematik 865, Sejarah 97, Matematik Tambahan 420, Fizik 779, Kimia 96; YouTube |
| Perutusan | 3 | all by school principals ("Pengetua", scope "Sekolah"); 2 pinned; 1 public |
| Screenshot files | 0 | private folder |

**Routes covered** (`docs/TRACKER.md` §4 M09, plus crawl finds):

| # | Route | Header title / subtitle (exact live) | Tab title (exact live) | Layout |
|---|---|---|---|---|
| S1 | `/admin/articles` | "Pengurusan Artikel" / "Urus artikel dan konten pendidikan" | "Pengurusan Artikel - Admin PRESTASIPLUS" | admin |
| S2 | `/admin/articles/create` | "Tambah Artikel Baru" / "Cipta artikel pendidikan baharu" | "Tambah Artikel - Admin PRESTASIPLUS" | admin |
| S3 | `/admin/articles/{id}/edit` | "Edit Artikel" / "Kemaskini artikel" | "Edit Artikel - Admin PRESTASIPLUS" | admin |
| S4 | `/admin/articles/{id}` | {title} / "Paparan artikel" | "Lihat Artikel - Admin PRESTASIPLUS" | admin |
| S5 | `/admin/notes` | "Pengurusan Nota" / "Urus nota pembelajaran dan sumber belajar" | "Pengurusan Nota - Admin PRESTASIPLUS" | admin |
| S6 | `/admin/notes/create` | live HTTP 500 → "Tambah Nota" / "Cipta nota baharu" (DV-M09-01, PROPOSED COPY) | live "500 - Ralat Pelayan \| PRESTASIPLUS" → "Tambah Nota - Admin PRESTASIPLUS" (PROPOSED COPY) | admin |
| S7 | `/admin/notes/{id}/edit` | live HTTP 500 → "Edit Nota" / "Kemaskini nota" (DV-M09-01, PROPOSED COPY) | → "Edit Nota - Admin PRESTASIPLUS" (PROPOSED COPY) | admin |
| S8 | `/admin/notes/{id}` | {title} / "Paparan nota" | "Lihat Nota - Admin PRESTASIPLUS" | admin |
| S9 | `/admin/banners` | "Pengurusan Banner" / "Urus banner promosi dan pengumuman" | "Pengurusan Banner - Admin PRESTASIPLUS" | admin |
| S10 | `/admin/banners/create` | "Tambah Banner Baru" / "Cipta banner promosi atau pengumuman" | "Tambah Banner - Admin PRESTASIPLUS" | admin |
| S11 | `/admin/banners/{id}/edit` | "Edit Banner" / "Kemaskini maklumat banner" | "Edit Banner - Admin PRESTASIPLUS" | admin |
| S12 | `/admin/audio-kbat` | "Set Audio KBAT", no subtitle (DV-M09-08; live "Dashboard" / "Selamat datang, Admin") | "Set Audio KBAT" | admin |
| S13 | `/admin/audio-kbat/create` | "Cipta Set Audio KBAT", no subtitle (DV-M09-08) | "Cipta Set Audio KBAT" | admin |
| S14 | `/admin/tools/screenshots` | "Upload Screenshot" / "Tool admin untuk upload & urus gambar (private)" | "Upload Screenshot - Admin PRESTASIPLUS" | admin |
| S15 | `/artikel` | "Artikel" / "Tips belajar, berita pendidikan, motivasi dan panduan" | "PRESTASIPLUS - Platform Latih Tubi Nasional"; guest "Artikel — PRESTASIPLUS" | user shell; **public layout for guests** |
| S16 | `/artikel/{slug}` | {title} / "Artikel" | "PRESTASIPLUS - Platform Latih Tubi Nasional" | user shell (guest INFERRED, L-7) |
| S17 | `/video` | "Video Pembelajaran" / "Tonton video motivasi, tutorial dan tips peperiksaan" | "Video Pembelajaran - PRESTASIPLUS"; guest "Video Pembelajaran — PRESTASIPLUS" | user shell; **public layout for guests** |
| S18 | `/video/{id}` | "Video" / {title} | "{title} - Video PRESTASIPLUS" | user shell |
| S19 | `/video/{id}/edit` | "Edit Video" / {title} | "Edit Video - {title}" | user shell |
| S20 | `/video/tambah` | "Tambah Video" / "Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain" | "Tambah Video" | user shell |
| S21 | `/audio-kbat` | "Audio KBAT", no subtitle (DV-M09-08; live "Dashboard" / "Selamat datang kembali") | "Audio KBAT" | user shell |
| S22 | `/perutusan` | "Perutusan" / "Kata-kata aluan dan maklumat penting dari pihak pengurusan" | "Perutusan" | user shell |
| S23 | `/perutusan/{id}` | "Perutusan" / {scope label, e.g. "Sekolah"} | {title} | user shell |
| S24 | `/perutusan/tulis` | "Tulis Perutusan" / "Sampaikan kata-kata aluan atau maklumat penting" | "Tulis Perutusan" | user shell |
| S25 | `/perutusan/saya` | "Perutusan Saya" / "Urus semua perutusan yang anda telah tulis" | "Perutusan Saya" | user shell |
| S26 | `/panduan` | (own top bar) | "Panduan Pengguna — PRESTASIPLUS" | **standalone**, guest and logged-in |
| S27 | `/pusat-tuisyen/panduan` | same page as S26 | same | standalone; **guest → `/login`** |
| S28 | `/perutusan/awam/{id}` | (own top bar; no shell header) | "{title} — PRESTASIPLUS" | **standalone public layout** (added in top-up; different from the `/artikel` / `/video` guest layout) |
| — | Audio KBAT player | not observable (0 sets, L-3) | — | provisional (FN-M09-5.3.6) |

**Layout rule (OBSERVED; replicated, not a deviation).** The admin sees `/artikel`, `/video*`, `/audio-kbat` and `/perutusan*` in the **user shell**; the admin shell is used only for `/admin/*`. Guests get a separate public layout on `/artikel` and `/video` and are redirected to `/login` from `/audio-kbat`, `/perutusan*`, `/video/tambah`, `/pusat-tuisyen/panduan` and `/admin/*`; `/panduan` is public.

Probed and absent on live, not added: `/admin/tools` (404), `/admin/articles/categories` (matches `{id}` → list + "Artikel tidak dijumpai."), `/admin/audio-kbat/1` (404, no set), no `/nota` reader route. No M09 page calls a JSON endpoint (only the shells' XHRs).

### 1.1 Cross-module relations

| Module | Relation |
|---|---|
| M05 Practice (dashboard) | `bannerCarousel(5)` renders the M09 banners (stored type as badge, title, description; no image, no link) and "📚 Artikel Untuk Kamu" + the aside "Artikel Terkini" list the 5 newest published articles. M05 owns the dashboard behaviour (FR-M05-04, 21, 22); M09 owns the data (FN-M09-2.4.1, 4.4.1). M05 SRS §6.12 seeds placeholder banners and articles "until M09 exists": they are replaced by the M09 store (OQ-M09-13a). |
| M10 Teacher portal | "Sumbang Artikel" `/guru/artikel` (list, `/guru/artikel/cipta` "Tulis Artikel Baru", `/guru/artikel/{id}/edit`) is the teacher contribution page, owned by M10; its articles live in the M09 store (FN-M09-2.4.2). The drawer item "Sumbang Artikel" is excluded here as M10. |
| M01 / M02 | Guest redirect to `/login`; the global 404 page (with M01 DV-M01-02 "Mula Latihan" → `/practice`); seed accounts and role labels; schools. |
| M03 | The 11 education levels and 31 subjects used by the Audio KBAT and video forms (A–Z on Audio KBAT, id order on video forms, as live). |
| M16 | The hidden tournament banner on user-portal pages (3 excluded elements per screen). |
| M22 / M23 | "Push Notifikasi" and "Chatbot" in the admin "Kandungan" group (M22); shell, server-status widget (M23). |
| M24 Duta | May link to M09 content (articles, videos); no M09 change needed. |

## 2. Actors

| Role | Involvement in M09 | Verified |
|---|---|---|
| Admin | Sole user of S1–S14. Reads and writes S15–S25 in the user shell like any user; national-scope perutusan; edit/delete of any video. | Yes (admin account) |
| Pelajar (student) | Reads articles, videos, Audio KBAT, perutusan of their scope, the guide; adds videos; reacts and comments. | Inferred (the admin rendered the user pages) |
| Guru (teacher) | As Pelajar; contributes articles via M10; may write perutusan (UNVERIFIED, OQ-M09-05). | Inferred |
| Admin Sekolah (school_admin, shown as "Pengetua" on perutusan) | Writes school-scope perutusan (all 3 live posts are by principals). | Inferred from the live posts |
| Ibu Bapa, Penaja, Pegawai PPD / JPN | Readers like Pelajar; perutusan writing and scope UNVERIFIED. | Inferred |
| Tuition-centre user | Drawer "Panduan" → `/pusat-tuisyen/panduan` (role condition INFERRED). | Inferred |
| Guest | `/artikel` and `/video` in public layouts, `/panduan`, `/perutusan/awam/{id}` (200); redirected to `/login` elsewhere, including `/video/{id}/edit` (OBSERVED); article/video detail INFERRED (L-7). | Yes (except details) |

URS.md §6: no correction needed; the school_admin role gains the "Pengetua" perutusan involvement (label INFERRED).

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script (`gen.js` from the Function catalogue `fns.js` and the inventory JSON). "EL" lists inventory element IDs (prefix `EL-M09-`). Functions with EL "—" are behaviours (server rules, post-submit results, pages live does not render, access) with no element of their own. S27 elements 001–318 are the same page as S26 and map to the same Functions (listed as "S27-…" ranges).

### EP-M09-1 — Article administration (admin panel)

**FT-M09-1.1 — Article list** (S1 `/admin/articles`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-1.1.1 | Shell header "Pengurusan Artikel" / "Urus artikel dan konten pendidikan"; tab title "Pengurusan Artikel - Admin PRESTASIPLUS"; sidebar "Artikel" in the "Kandungan" group | SHA-118–119 | Admin | OBSERVED |
| FN-M09-1.1.2 | Filter card, GET form to `/admin/articles`, no auto-submit: `search` placeholder "Cari artikel..."; `category` ("Semua Kategori" `all` default, then "Tips Belajar", "Berita", "Motivasi", "Panduan Ibu Bapa", "Panduan Guru", "Kejayaan", "Umum" with codes `TIPS_BELAJAR` … `UMUM`); `published` ("Semua Status" '', "Diterbitkan" `1`, "Draf" `0`); submit `fa-search` "Cari"; link "Reset" (slate-100) → `/admin/articles`. The controls keep the submitted values after the reload | S1-001–006 | Admin | OBSERVED |
| FN-M09-1.1.3 | List card: h2 "Senarai Artikel", "Jumlah: {n} artikel" (n = all articles matching the filters, over all pages), button-link `fa-plus` "Tambah" → `/admin/articles/create` | S1-007–009 | Admin | OBSERVED |
| FN-M09-1.1.4 | Table (20 rows per page), column headers displayed upper case by CSS ("TAJUK", "KATEGORI", "TAHAP", "STATUS", "VIEWS", "TARIKH", "TINDAKAN"): Tajuk = amber `fa-star` (title "Featured") before the title when featured, the title cut to 50 characters + "..." when longer (Laravel `Str::limit`; e.g. "Belajar Sains: Cara Ingat Nama Saintifik dengan Mu..."), second line "Oleh: {author}"; Kategori = category label in a blue-100/blue-700 pill; Tahap = the raw stored value ("DARJAH_4", "SEMUA"; replicated, DV-M09-11 rejected); Status = `fa-check-circle` "Diterbitkan" emerald-100/emerald-700 pill (draft pill UNVERIFIED, OQ-M09-02); Views = integer; Tarikh = created date dd/mm/yyyy | S1-010–013, S1-020–021, S1-028–029, S1-055–057 | Admin | OBSERVED / UNVERIFIED (draft pill) |
| FN-M09-1.1.5 | Row actions `fa-eye` (title "Lihat", blue-600) → `/admin/articles/{id}` and `fa-edit` (title "Edit") → `/admin/articles/{id}/edit` | S1-014–015, S1-022–023, S1-030–031 | Admin | OBSERVED |
| FN-M09-1.1.6 | Row action `fa-trash` (title "Padam"): DELETE form with native `confirm('Adakah anda pasti mahu padam artikel ini?')`; cancel → nothing; accept → the article is removed and the list reloads with a success flash (UNVERIFIED COPY) | S1-016–019, S1-024–027, S1-032–035 | Admin | OBSERVED (UI) / INFERRED (result, L-1) |
| FN-M09-1.1.7 | Pager (Laravel, English): from 640px "Showing {from} to {to} of {total} results", numbered links and chevrons; below 640px "« Previous" / "Next »" (plain text when unavailable). Every pager link keeps the active `search`, `category` and `published` values (DV-M09-03; live drops them) | S1-036–046, S1-053–054 | Admin | OBSERVED + DV-M09-03 |
| FN-M09-1.1.8 | Filter semantics: `search` = case-insensitive part of the title (field INFERRED), `category` = code, `published` = flag; combined with AND. Live counts: all 72; `MOTIVASI` 14; `TIPS_BELAJAR` 21 (page 2 = 1 row, #8); `search=sifir` 2; `published=1` 72; `published=0` 0 | S1-047–050, S1-052, S1-059 | Admin | OBSERVED (results) / INFERRED (search field) |
| FN-M09-1.1.9 | No match (e.g. `?published=0`, `?search=zzzqqq`): one full-width row `fa-inbox` "Tiada artikel dijumpai.", "Jumlah: 0 artikel", no pager | S1-051 | Admin | OBSERVED |
| FN-M09-1.1.10 | Flash: red box (red-50 background, red-700 text, red-200 border) `fa-exclamation-circle` "Artikel tidak dijumpai." above the list after an unknown id on the preview or edit route (also `/admin/articles/categories`) | S1-058 | Admin | OBSERVED |
| FN-M09-1.1.11 | Order: created date descending, ties by id ascending (live page 1 = ids 10–29; page 4 = ids 70–72, 9, 1–8) | — | Admin | OBSERVED |

**FT-M09-1.2 — Create article** (S2 `/admin/articles/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-1.2.1 | Shell header "Tambah Artikel Baru" / "Cipta artikel pendidikan baharu"; tab title "Tambah Artikel - Admin PRESTASIPLUS" | SHA-198–199 | Admin | OBSERVED |
| FN-M09-1.2.2 | Link `fa-arrow-left` "Kembali ke Senarai" → `/admin/articles` | S2-001 | Admin | OBSERVED |
| FN-M09-1.2.3 | Form `POST /admin/articles` (no `novalidate`): "Tajuk Artikel *" `title` text, `required`, placeholder "cth: 10 Tips Belajar Matematik"; "Ringkasan" `excerpt` textarea (3 rows), placeholder "Ringkasan artikel"; "Kandungan *" `content` textarea (15 rows), `required`, placeholder "Tulis kandungan artikel di sini...". "Kandungan" is a **plain textarea** in which the admin types HTML (live: the CKEditor script is blocked by the CSP; replicated, DV-M09-02 rejected; SEC-M09-01) | S2-002–010 | Admin | OBSERVED |
| FN-M09-1.2.4 | "URL Gambar Utama" `featured_image` url, placeholder "https://example.com/image.jpg" (no upload); "Kategori *" `category` `required` ("Pilih kategori" '' + the 7 categories); "Tahap Pendidikan" `grade_level` ("Semua" `SEMUA` default, "Darjah 1" `DARJAH_1` … "Darjah 6" `DARJAH_6`) | S2-011–016 | Admin | OBSERVED |
| FN-M09-1.2.5 | Checkboxes "Terbitkan Sekarang" `is_published` (value 1, unchecked) and "Artikel Featured" `is_featured` (value 1, unchecked) | S2-017–020 | Admin | OBSERVED |
| FN-M09-1.2.6 | Footer on one row, right-aligned, at 375/768/1280: link "Batal" (78×44) → `/admin/articles` (leaves the page; input discarded, no confirm) and submit `fa-save` "Simpan Artikel" (181×44) | S2-021–022 | Admin | OBSERVED |
| FN-M09-1.2.7 | Validation = the browser's native `required` bubble only: empty form invalid on `title`, `content`, `category`; with title and content filled only `category`; no request is sent while invalid | — | Admin | OBSERVED |
| FN-M09-1.2.8 | Save result: the article is stored (author = current user; slug from the title; `published_at` = now when "Terbitkan Sekarang" is ticked) and `/admin/articles` opens with a success flash (UNVERIFIED COPY); server errors under the field (UNVERIFIED COPY) | — | Admin | INFERRED (L-1) |

**FT-M09-1.3 — Edit article** (S3 `/admin/articles/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-1.3.1 | Shell header "Edit Artikel" / "Kemaskini artikel"; tab title "Edit Artikel - Admin PRESTASIPLUS" | SHA-200–201 | Admin | OBSERVED |
| FN-M09-1.3.2 | Link `fa-arrow-left` "Kembali ke Senarai" → `/admin/articles` | S3-001 | Admin | OBSERVED |
| FN-M09-1.3.3 | Form `POST /admin/articles/{id}` with `_method=PUT`, the S2 fields preloaded with the saved values (title, excerpt, raw HTML content, image URL, category, level, both checkboxes; e.g. #10 `TIPS_BELAJAR`, `DARJAH_4`, both ticked; #11 `DARJAH_5`, not featured). The category select has **no** placeholder option on edit. Valid as loaded | S3-002–021 | Admin | OBSERVED |
| FN-M09-1.3.4 | Footer: "Batal" → `/admin/articles` (discards) and submit `fa-save` "Kemaskini Artikel" | S3-022–023 | Admin | OBSERVED |
| FN-M09-1.3.5 | Unknown id (edit or preview) → redirect to `/admin/articles` with the flash "Artikel tidak dijumpai." | — | Admin | OBSERVED |
| FN-M09-1.3.6 | Update result: stored, `/admin/articles` opens with a success flash (UNVERIFIED COPY) | — | Admin | INFERRED (L-1) |

**FT-M09-1.4 — Admin article preview** (S4 `/admin/articles/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-1.4.1 | Shell header = the article title / "Paparan artikel"; tab title "Lihat Artikel - Admin PRESTASIPLUS" | SHA-204–206 | Admin | OBSERVED |
| FN-M09-1.4.2 | Link `fa-arrow-left` "Kembali ke Senarai" → `/admin/articles` | S4-001 | Admin | OBSERVED |
| FN-M09-1.4.3 | Card: h1 title; meta `fa-user` {author}, `fa-calendar` created date "dd Mon yyyy" (English month, e.g. "22 Feb 2026"), `fa-eye` "{n} tontonan"; pills `fa-check-circle` "Diterbitkan" (emerald) and, when featured, `fa-star` "Featured" (amber-100/amber-700); the excerpt | S4-002–009, S4-012–015 | Admin | OBSERVED |
| FN-M09-1.4.4 | Body printed as **escaped HTML text** (starts "<h2>Apa Itu Teknik Pomodoro?</h2><p>…"), as live (DV-M09-04 rejected). The text wraps inside the card at every width, so the page never scrolls sideways (DV-M09-05; live 424px at 375) | S4-010, S4-016 | Admin | OBSERVED + DV-M09-05 |
| FN-M09-1.4.5 | Button-link `fa-edit` "Edit Artikel" (indigo-600, white) → `/admin/articles/{id}/edit` | S4-011 | Admin | OBSERVED |
| FN-M09-1.4.6 | Opening the preview does not change the view counter (live 595 before and after) | — | Admin | OBSERVED |

### EP-M09-2 — Article reading (user portal and public)

**FT-M09-2.1 — Article list (logged-in)** (S15 `/artikel`, user shell)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-2.1.1 | Shell header "Artikel" / "Tips belajar, berita pendidikan, motivasi dan panduan"; tab title "PRESTASIPLUS - Platform Latih Tubi Nasional"; user shell for every logged-in role including the admin | SHU-136–137 | All logged-in | OBSERVED |
| FN-M09-2.1.2 | "Artikel Paling Hangat": 6 cards picked **at random on every load** from the featured articles (badge `fa-star` "PILIHAN") and the most-viewed non-featured articles (badge `fa-fire` "POPULAR"; pool size INFERRED, SRS BR-M09-05). Card: gradient panel (purple-400 → pink-400 → orange-400) with 📰 and the badge, category chip, title (2 lines), excerpt (2 lines), author initial circle + name, relative date. Shown on every page when neither `search` nor `category` is set; hidden while searching or filtering | S15-004–009, S15-222–224, S15-244–246 | All logged-in | OBSERVED (random, hidden) / INFERRED (pool) |
| FN-M09-2.1.3 | Search form GET `/artikel`: `search` placeholder "Cari artikel..."; while a category is active a hidden `category` input keeps it | S15-010–011, S15-040 | All logged-in | OBSERVED |
| FN-M09-2.1.4 | Category pills (links): "Semua" → `/artikel` (→ `/artikel?search={q}` while searching), "Tips Belajar", "Berita", "Motivasi", "Panduan Ibu Bapa", "Panduan Guru", "Kejayaan", "Umum" → `?category={CODE}` (keeping `search`). Active: gradient 135° rgb(59,130,246) → rgb(139,92,246) → pink, white text; inactive: white, gray-600 text | S15-012–019, S15-047–054, S15-232–239 | All logged-in | OBSERVED |
| FN-M09-2.1.5 | Grid, 18 per page, 1 column → 2 (`sm`) → 3 (`lg`) → 6 (`xl`); card (link → `/artikel/{slug}`): gradient panel with 📰, category chip (blue-500 → purple-500, white), `fa-star` "HOT" chip (amber-400 → orange-500) when featured, title, excerpt, author initial circle + name, "👁️ {views}", relative date. The meta items wrap as whole items, never word by word (DV-M09-12) | S15-020–028, S15-041–046, S15-059–063, S15-225–231, S15-240–243 | All logged-in | OBSERVED + DV-M09-12 |
| FN-M09-2.1.6 | Pager (Laravel, English): from 640px "Showing {from} to {to} of {total} results" with numbered links and chevrons; below 640px "« Previous" / "Next »"; links keep `category` and `search` (e.g. `?category=TIPS_BELAJAR&page=1`) | S15-029–039, S15-064–065 | All logged-in | OBSERVED |
| FN-M09-2.1.7 | No match (e.g. `?search=zzzqqq`): 🔍 "Tiada Artikel Dijumpai" / "Cuba ubah carian atau pilih kategori lain." / `fa-arrow-left` "Lihat Semua Artikel" → `/artikel` | S15-055–058 | All logged-in | OBSERVED |
| FN-M09-2.1.8 | List rules: published articles only; order = publish date newest first, ties by id ascending (live order: #9, then #1…#8, then #72 down to #10 — reader pages 1, 2 and 4 read in full); `search` = part of the title, `category` = code; counts all 72 (4 pages), `BERITA` 7, `TIPS_BELAJAR` 21 (2 pages), "sifir" 2 | — | All logged-in | OBSERVED (order, counts) / INFERRED (published-only, search field, publish-date key) |

**FT-M09-2.2 — Article list (guest, public layout)** (S15 `/artikel`, guest)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-2.2.1 | Public layout for guests, tab title "Artikel — PRESTASIPLUS": top bar logo → `/`, "\|", "📰" "Artikel", "Log Masuk" → `/login`, "Daftar Percuma" → `/register` | S15-066–072 | Guest | OBSERVED |
| FN-M09-2.2.2 | Hero: decorative emojis (📚 ✨ 🔥 ⭐), chip "Terkini & Menarik", h1 "Artikel Pilihan", line "Tips belajar, berita pendidikan, motivasi dan panduan untuk pelajar Malaysia!" with the four topics bold | S15-073–084 | Guest | OBSERVED |
| FN-M09-2.2.3 | Guest "Artikel Paling Hangat" (🔥 heading): the same random 6-card rule as FN-M09-2.1.2 | S15-085–116 | Guest | OBSERVED |
| FN-M09-2.2.4 | Guest search (🔍, placeholder "Cari artikel menarik...") and "Pilih Kategori:" with pills "Semua" and "✨ {category}" | S15-117–128 | Guest | OBSERVED |
| FN-M09-2.2.5 | Guest grid: the FN-M09-2.1.5 cards plus a `fa-clock` before the relative date; the same pager | S15-129–204 | Guest | OBSERVED |
| FN-M09-2.2.6 | CTA "Nak Baca Lebih Banyak?" (decorative 📚 ✨ 🎯 🚀 ⭐ 🎉), "Daftar percuma dan dapat akses penuh ke semua artikel, latih tubi interaktif, ganjaran menarik dan banyak lagi!", `fa-arrow-right` "Daftar Percuma Sekarang" → `/register`, "100% Percuma • Tiada Kad Kredit Diperlukan"; footer logo, "© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd. Hak Cipta Terpelihara.", links "Utama" → `/`, "Artikel", "Video", "Log Masuk", "Daftar" | S15-205–221 | Guest | OBSERVED |

**FT-M09-2.3 — Article detail** (S16 `/artikel/{slug}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-2.3.1 | Shell header = the article title / "Artikel"; generic tab title "PRESTASIPLUS - Platform Latih Tubi Nasional" | SHU-373–374 | All logged-in | OBSERVED |
| FN-M09-2.3.2 | Breadcrumb `fa-th-large` "Dashboard" → `/dashboard` "→" `fa-newspaper` "Artikel" → `/artikel` "→" title cut to 40 characters + "..." when longer | S16-004–008 | All logged-in | OBSERVED |
| FN-M09-2.3.3 | Chips: category (gradient blue → violet → pink), level label (e.g. "Darjah 4"; lime → green), `fa-star` "Pilihan" when featured; h1 title; excerpt | S16-009–013 | All logged-in | OBSERVED |
| FN-M09-2.3.4 | Author card: initial circle, author name, `fa-calendar` publish date "dd Mon yyyy" (e.g. "24 Dec 2025"), "•", `fa-clock` relative date; counters "👁️" {views} "Pembaca" and "❤️" {likes} "Suka" (display only; no like button on the page) | S16-014–026 | All logged-in | OBSERVED |
| FN-M09-2.3.5 | Body rendered as HTML (h2 / p …) from the stored content (SEC-M09-01); the prototype sanitises it client-side with an allow-list sanitiser before rendering; article #10 shows 5 list items (EL-M09-S16-032…036); their parent (`ol` or `ul`) is not recorded in the inventory and is not asserted | S16-027–039 | All logged-in | OBSERVED |
| FN-M09-2.3.6 | Share card "Kongsi Artikel Ini 🎉" / "Kongsi dengan kawan-kawan supaya mereka pun dapat belajar!": icon links WhatsApp `https://wa.me/?text={title}+{url}`, Facebook `sharer.php?u={url}`, Twitter `intent/tweet?text={title}&url={url}` (glyphs as live: Font Awesome brand `fa-whatsapp`, `fa-facebook-f`, `fa-twitter` bird, rebuilt as inline SVG from Font Awesome Free, CC BY 4.0); `fa-link` button copies `window.location.href` and shows "Link Disalin!" for 2 s | S16-040–046 | All logged-in | OBSERVED |
| FN-M09-2.3.7 | "📚" "Artikel Berkaitan": the 3 newest other published articles of the same category (card 📰, title, `fa-clock` relative date, "👁️ {views}") → their detail pages | S16-047–054 | All logged-in | OBSERVED (#10 → 3 newest Tips Belajar) |
| FN-M09-2.3.8 | Aside from `lg` only: "Artikel Terkini" — the 5 newest published articles (`fa-newspaper`, title, relative date) and `fa-arrow-right` "Lihat Semua Artikel" → `/artikel` | S16-055–062 | All logged-in | OBSERVED |
| FN-M09-2.3.9 | Unknown slug → standalone 404 page "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice` (M01 DV-M01-02; live `/latih-tubi`), "PRESTASIPLUS" | S16-063–069 | All logged-in | OBSERVED + M01 DV-02 |
| FN-M09-2.3.10 | Every open of `/artikel/{slug}` adds 1 to the views **before** the page is built, so "Pembaca" includes this open (live 595 before, 596 shown on #10) | — | All logged-in | OBSERVED |
| FN-M09-2.3.11 | Guest opening `/artikel/{slug}` (L-7, not observed): the page opens without login (the public list links to it); prototype = the same detail content inside the guest public layout of FN-M09-2.2.1/2.2.6, provisional | — | Guest | INFERRED (L-7) |

**FT-M09-2.4 — Article feeds for other modules** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-2.4.1 | The 5 newest published articles feed the M05 dashboard strip "📚 Artikel Untuk Kamu" and aside "Artikel Terkini" and the S16 aside (same 5, same order) | — | All logged-in | OBSERVED |
| FN-M09-2.4.2 | Articles contributed by teachers on `/guru/artikel` (M10 S30/S31) are stored in the M09 article store through its repository, with the teacher as author, `isPublished = false` ("Menunggu Semakan", M10 BR-M10-29) until the admin publishes them on S3, and with two teacher-only fields the M10 form writes: the optional YouTube link (`youtube_url`) and up to 5 file attachments with an optional label (PDF, Word, Excel, PowerPoint; ≤ 20 MB each). No M09 screen shows these two fields (S2/S3 have no such input; S4/S15/S16 do not render them — the teacher-article detail view on live is unobserved). Published teacher articles follow the same list rules | — | Guru | OBSERVED (M10 form fields) / INFERRED (storage, publishing, display) |

### EP-M09-3 — Notes administration (admin panel)

**FT-M09-3.1 — Note list** (S5 `/admin/notes`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-3.1.1 | Shell header "Pengurusan Nota" / "Urus nota pembelajaran dan sumber belajar"; tab title "Pengurusan Nota - Admin PRESTASIPLUS" | SHA-208–209 | Admin | OBSERVED |
| FN-M09-3.1.2 | Filter card GET: `search` "Cari nota..."; `subject` ("Semua Subjek" `all`, "Matematik" `matematik`, "Sains" `sains`, "Bahasa Melayu" `bahasa_melayu`, "Bahasa Inggeris" `bahasa_inggeris`, "Sejarah" `sejarah`); `note_type` ("Semua Jenis" `all`, "Ringkasan" `summary`, "Mind Map" `mind_map`, "Flashcard" `flashcard`, "Cheat Sheet" `cheat_sheet`, "Nota Penuh" `full_notes`); `fa-search` "Cari"; "Reset" → `/admin/notes` | S5-001–006 | Admin | OBSERVED |
| FN-M09-3.1.3 | List card "Senarai Nota", "Jumlah: {n} nota", `fa-plus` "Tambah Nota" → `/admin/notes/create` (opens the DV-M09-01 form) | S5-007–009 | Admin | OBSERVED + DV-M09-01 |
| FN-M09-3.1.4 | Table "Tajuk", "Subjek", "Jenis", "Tahap", "Status", "Statistik", "Tindakan" (displayed upper case): title cut to 40 characters + "..." when longer (e.g. "Imbuhan Awalan dan Akhiran — Nota Lengka...") + "Oleh: {author}"; Subjek pill upper case (indigo-100/indigo-700, e.g. "MATEMATIK"); Jenis = stored type as plain text ("FORMULA", "RINGKASAN", "LENGKAP", "TIPS_TRICKS"); Tahap "DARJAH 2"; Status "Diterbitkan"; Statistik `fa-eye` "{n} tontonan" and `fa-download` "{n} muat turun" | S5-010–013, S5-020–021, S5-028–029 | Admin | OBSERVED |
| FN-M09-3.1.5 | Row actions `fa-eye` "Lihat" → `/admin/notes/{id}`; `fa-edit` "Edit" → `/admin/notes/{id}/edit` (DV-M09-01 form) | S5-014–015, S5-022–023, S5-030–031 | Admin | OBSERVED + DV-M09-01 |
| FN-M09-3.1.6 | Row `fa-trash` "Padam": DELETE form with `confirm('Adakah anda pasti mahu padam nota ini?')`; accept → removed, list reloads with a flash (UNVERIFIED COPY) | S5-016–019, S5-024–027, S5-032–035 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M09-3.1.7 | Filter semantics: `search=sifir` → 1; `subject=matematik` → 3; `note_type` matches the stored type of the same meaning — `summary` ↔ RINGKASAN (5), `full_notes` ↔ LENGKAP (2), `mind_map` / `flashcard` / `cheat_sheet` ↔ a type of that name (none exist) (DV-M09-06; live `note_type` never matches, e.g. `summary` → "Jumlah: 0 nota") | S5-036–039 | Admin | OBSERVED + DV-M09-06 |
| FN-M09-3.1.8 | No match → "Tiada nota dijumpai.", "Jumlah: 0 nota" | — | Admin | OBSERVED |
| FN-M09-3.1.9 | 10 notes on one page, order id ascending; no pager at ≤20 rows (pager above 20 INFERRED, as S1) | — | Admin | OBSERVED / INFERRED (pager) |
| FN-M09-3.1.10 | Unknown id on `/admin/notes/{id}` → redirect to `/admin/notes` with **no** flash (as live) | — | Admin | OBSERVED |

**FT-M09-3.2 — Create and edit note** (S6 `/admin/notes/create`, S7 `/admin/notes/{id}/edit` (DV-M09-01; live HTTP 500))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-3.2.1 | Live `/admin/notes/create` ("Tambah Nota") answers HTTP 500: global error page "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama" → `/`, "Cuba Semula" (reload), "PRESTASIPLUS". The rebuild opens the create form of FN-M09-3.2.3 instead (DV-M09-01) | S6-001–007 | Admin | OBSERVED (live 500) + DV-M09-01 |
| FN-M09-3.2.2 | Live `/admin/notes/{id}/edit` (row "Edit" and "Edit Nota") answers the same HTTP 500 page. The rebuild opens the edit form of FN-M09-3.2.4 instead (DV-M09-01) | S7-001–007 | Admin | OBSERVED (live 500) + DV-M09-01 |
| FN-M09-3.2.3 | Create note form (DV-M09-01; fields INFERRED from the note entity shown on S5/S8, labels PROPOSED COPY): header "Tambah Nota" / "Cipta nota baharu"; "Kembali ke Senarai"; "Tajuk *" (`title`, required); "Ringkasan" (`summary`); "Kandungan *" (`content`, required, plain textarea like S2); "Subjek *" (`subject`: the 5 subjects of the S5 filter); "Jenis *" (`note_type`: the 4 stored types shown as stored, "FORMULA", "RINGKASAN", "LENGKAP", "TIPS_TRICKS"); "Tahap *" (`grade`: "Darjah 1"…"Darjah 6"); checkbox "Terbitkan Sekarang"; footer "Batal" → `/admin/notes` and `fa-save` "Simpan Nota". Native `required` only. No file upload (none is observable) | — | Admin | DV-M09-01 (INFERRED fields; PROPOSED COPY) |
| FN-M09-3.2.4 | Edit note form: the FN-M09-3.2.3 fields preloaded; header "Edit Nota" / "Kemaskini nota" (PROPOSED COPY); submit `fa-save` "Kemaskini Nota" (PROPOSED COPY); "Batal" → `/admin/notes`; unknown id → `/admin/notes` without flash (as FN-M09-3.1.10) | — | Admin | DV-M09-01 (PROPOSED COPY) |
| FN-M09-3.2.5 | Save/update result: stored (author = current user; views and downloads 0 on create) and `/admin/notes` opens with a success flash (UNVERIFIED COPY) | — | Admin | INFERRED (L-2) |

**FT-M09-3.3 — Admin note preview** (S8 `/admin/notes/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-3.3.1 | Shell header = the note title / "Paparan nota"; tab title "Lihat Nota - Admin PRESTASIPLUS" | SHA-211–212 | Admin | OBSERVED |
| FN-M09-3.3.2 | Link `fa-arrow-left` "Kembali ke Senarai" → `/admin/notes` | S8-001 | Admin | OBSERVED |
| FN-M09-3.3.3 | Card: h1; `fa-user` author, `fa-calendar` "dd Mon yyyy" (e.g. "06 Feb 2026"), `fa-eye` "{n} tontonan", `fa-download` "{n} muat turun"; "Diterbitkan"; summary line; detail grid "Subjek" / "Tahap" / "Jenis" with the stored values ("MATEMATIK", "DARJAH 2", "FORMULA") | S8-002–015 | Admin | OBSERVED |
| FN-M09-3.3.4 | Body printed as escaped HTML text (as live, DV-M09-04 rejected), wrapping inside the card (DV-M09-05) | S8-016 | Admin | OBSERVED + DV-M09-05 |
| FN-M09-3.3.5 | Button-link `fa-edit` "Edit Nota" → `/admin/notes/{id}/edit` (DV-M09-01 form; live 500) | S8-017 | Admin | OBSERVED + DV-M09-01 |
| FN-M09-3.3.6 | Notes have no reader page: no `/nota` route and no link outside the admin panel; the view and download counters stay as stored | — | Admin | OBSERVED (no route linked) |

### EP-M09-4 — Banners (admin panel; dashboard feed)

**FT-M09-4.1 — Banner list** (S9 `/admin/banners`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-4.1.1 | Shell header "Pengurusan Banner" / "Urus banner promosi dan pengumuman"; tab title "Pengurusan Banner - Admin PRESTASIPLUS" | SHA-213–214 | Admin | OBSERVED |
| FN-M09-4.1.2 | List card "Senarai Banner", "Jumlah: {n} banner", `fa-plus` "Tambah" → `/admin/banners/create`. No filter, search or pager | S9-001–003 | Admin | OBSERVED |
| FN-M09-4.1.3 | Table "#", "Tajuk", "Jenis", "Sasaran", "Susunan", "Mula", "Tamat", "Aktif?", "Tindakan" (displayed upper case): row number; title + description cut to 50 characters + "..." when longer; Jenis = stored type in a slate-100/slate-700 pill ("HERO", "FEATURE", "PROMOTIONAL", "ANNOUNCEMENT"); Sasaran = stored audience as plain text ("ALL", "STUDENT"); Susunan = square pill (`rounded-md`); Mula / Tamat dd/mm/yyyy; Aktif? = `fa-check-circle` "Aktif" emerald pill (inactive pill UNVERIFIED). No view action | S9-004–007, S9-013–014, S9-020–021 | Admin | OBSERVED / UNVERIFIED (inactive pill) |
| FN-M09-4.1.4 | Row `fa-edit` (title "Edit", indigo-600) → `/admin/banners/{id}/edit` | S9-008, S9-015, S9-022 | Admin | OBSERVED |
| FN-M09-4.1.5 | Row `fa-trash` (title "Padam"): DELETE form with `confirm('Adakah anda pasti mahu padam banner ini?')`; accept → removed, list reloads with a flash (UNVERIFIED COPY) | S9-009–012, S9-016–019, S9-023–026 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M09-4.1.6 | Flash `fa-exclamation-circle` "Banner tidak dijumpai." (red, `animate-fade-in`) after an unknown id | S9-027 | Admin | OBSERVED |
| FN-M09-4.1.7 | Order: display order ascending (live 1…5); ties by id ascending (INFERRED) | — | Admin | OBSERVED / INFERRED (ties) |

**FT-M09-4.2 — Create banner** (S10 `/admin/banners/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-4.2.1 | Shell header "Tambah Banner Baru" / "Cipta banner promosi atau pengumuman"; tab title "Tambah Banner - Admin PRESTASIPLUS" | SHA-216–217 | Admin | OBSERVED |
| FN-M09-4.2.2 | Link `fa-arrow-left` "Kembali ke Senarai" → `/admin/banners` | S10-001 | Admin | OBSERVED |
| FN-M09-4.2.3 | Form `POST /admin/banners`: "Tajuk Banner *" `title` required, placeholder "cth: Promosi SPM 2024"; "Penerangan" `description` textarea, placeholder "Penerangan ringkas tentang banner"; "URL Gambar" `image_url` url, placeholder "https://example.com/image.jpg", hint `fa-info-circle` "Masukkan URL gambar banner" | S10-002–011 | Admin | OBSERVED |
| FN-M09-4.2.4 | "Jenis Banner *" `banner_type` required: "Pilih jenis banner" '', "Hero" `hero`, "Promo" `promo`, "Pengumuman" `announcement`, "Acara" `event` | S10-012–013 | Admin | OBSERVED |
| FN-M09-4.2.5 | "Jenis Pautan" `link_type` (Alpine `linkType`, default `none`): "Tiada Pautan" `none`, "Subjek" `subject`, "Kuiz" `quiz`, "Artikel" `article`, "Pautan Luar" `external`. Only `external` shows the unlabelled `external_url` url field (placeholder "https://example.com"); switching away hides it and keeps the typed value. Subjek / Kuiz / Artikel show no target field (as live, DV-M09-13 rejected) | S10-014–016 | Admin | OBSERVED |
| FN-M09-4.2.6 | "Sasaran Penonton *" `target_audience` required: "Semua" `all` (default), "Pelajar" `student`, "Guru" `teacher`, "Admin" `admin` | S10-017–018 | Admin | OBSERVED |
| FN-M09-4.2.7 | "Susunan Paparan" `display_order` number min 0, prefilled 0, hint `fa-sort` "Nombor lebih kecil akan dipaparkan dahulu"; "Tarikh Mula" `start_date` and "Tarikh Tamat" `end_date` (date, optional); checkbox "Banner Aktif" `is_active` (checked) with "Tandakan untuk memaparkan banner" | S10-019–028 | Admin | OBSERVED |
| FN-M09-4.2.8 | Footer on one row at every width: "Batal" → `/admin/banners` (discards) and `fa-save` "Simpan Banner" | S10-029–030 | Admin | OBSERVED |
| FN-M09-4.2.9 | Native validation: empty form invalid on `title`, `banner_type`; no request while invalid | — | Admin | OBSERVED |
| FN-M09-4.2.10 | Save result: stored with the codes in upper case (as the live records: HERO, ALL, NONE); `/admin/banners` opens with a success flash (UNVERIFIED COPY) | — | Admin | INFERRED (L-1) |

**FT-M09-4.3 — Edit banner** (S11 `/admin/banners/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-4.3.1 | Shell header "Edit Banner" / "Kemaskini maklumat banner"; tab title "Edit Banner - Admin PRESTASIPLUS" | SHA-219–220 | Admin | OBSERVED |
| FN-M09-4.3.2 | Link `fa-arrow-left` "Kembali ke Senarai" → `/admin/banners` | S11-001 | Admin | OBSERVED |
| FN-M09-4.3.3 | Form `PUT /admin/banners/{id}` with the S10 fields; title, description, image URL, order, dates and the active box preloaded (OBSERVED). The three selects show the **stored** value (DV-M09-07; live shows "Pilih jenis banner" / "Tiada Pautan" / "Semua" for every record): a stored code equal (ignoring case) to an option value selects that option (HERO → "Hero", ANNOUNCEMENT → "Pengumuman", ALL → "Semua", STUDENT → "Pelajar", NONE → "Tiada Pautan"); a stored code with no such option (FEATURE, PROMOTIONAL) is shown as one extra selected option labelled with the stored code, present only on that record's form. Saving unchanged keeps every stored value | S11-002–029 | Admin | OBSERVED + DV-M09-07 |
| FN-M09-4.3.4 | Footer: "Batal" → `/admin/banners` and `fa-save` "Kemaskini Banner" | S11-030–031 | Admin | OBSERVED |
| FN-M09-4.3.5 | Unknown id → `/admin/banners` with the flash "Banner tidak dijumpai." | — | Admin | OBSERVED |
| FN-M09-4.3.6 | Update result: stored, `/admin/banners` opens with a success flash (UNVERIFIED COPY) | — | Admin | INFERRED (L-1) |

**FT-M09-4.4 — Banner delivery** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-4.4.1 | Dashboard carousel (M05 FR-M05-04): active banners whose date range contains today (empty date = open), ordered by display order; audience `ALL` for everyone, `STUDENT` / `TEACHER` / `ADMIN` for that role, the admin sees all (OBSERVED for the admin). Link type and image are not used by the carousel (as live) | — | All logged-in | OBSERVED (admin, 5 banners) / INFERRED (audience, dates) |

### EP-M09-5 — Audio KBAT (admin panel and user portal)

**FT-M09-5.1 — Audio KBAT set list (admin)** (S12 `/admin/audio-kbat`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-5.1.1 | Page header in the admin shell = the page title from the route with no subtitle: "Set Audio KBAT" on S12 and "Cipta Set Audio KBAT" on S13 (DV-M09-08, implementing shell rule DV-SH-03; live "Dashboard" / "Selamat datang, Admin"); tab titles "Set Audio KBAT" and "Cipta Set Audio KBAT" as live | SHA-222–223 | Admin | OBSERVED + DV-M09-08 |
| FN-M09-5.1.2 | Intro: pill `fa-headphones` "Ujian Mendengar" (amber-50/amber-700), h1 "Set Audio KBAT", "Senarai set soalan audio fixed sequence, bukan rawak." | S12-001–003 | Admin | OBSERVED |
| FN-M09-5.1.3 | Links `fa-file-excel` "Template XLSX" → `/admin/audio-kbat/template` and `fa-file-word` "Template Word" → `/admin/audio-kbat/template-word` (file downloads; content not observed — prototype serves placeholder files, OQ-M09-03) and `fa-plus` "Cipta Set" → `/admin/audio-kbat/create` | S12-004–006 | Admin | OBSERVED (links) / UNVERIFIED (file content) |
| FN-M09-5.1.4 | Guide box "Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT" with the two paragraphs "Set ini bukan soalan rawak. …" and "Jika cikgu mahu bahan yang mudah ditaip, …" (discovery Appendix B) | S12-007–009 | Admin | OBSERVED |
| FN-M09-5.1.5 | Four stat cards "Set", "Approved", "Draft/Pending", "Soalan" with global counts (not filtered); live 0 / 0 / 0 / 0 | S12-010–021 | Admin | OBSERVED (zero) / INFERRED (counting) |
| FN-M09-5.1.6 | Filter GET: `education_level_id` ("Semua Tahap" + "Darjah 1"…"Darjah 6" 1–6, "Tingkatan 1"…"Tingkatan 5" 7–11); `subject_id` ("Semua Subjek" + 31 subjects sorted A–Z); `status` ("Semua Status", "Draft", "Pending Review", "Approved", "Archived"); `search` "Cari tajuk/sumber..."; `fa-search` "Tapis"; values kept after filtering | S12-022–027 | Admin | OBSERVED |
| FN-M09-5.1.7 | No set (with or without filters): `fa-headphones` "Belum ada set Audio KBAT." | S12-028 | Admin | OBSERVED |
| FN-M09-5.1.8 | Set rows when sets exist (L-3, not observable: live has 0 sets): provisional neutral row per set with title, level, subject, status label and "30" questions; row actions, layout and pager UNVERIFIED | — | Admin | INFERRED (L-3), provisional |

**FT-M09-5.2 — Create Audio KBAT set** (S13 `/admin/audio-kbat/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-5.2.1 | Link `fa-arrow-left` "Kembali" → `/admin/audio-kbat`; h1 "Cipta Set Audio KBAT"; "Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section." | S13-001–003 | Admin | OBSERVED |
| FN-M09-5.2.2 | Box "Apa yang cikgu perlu sediakan?" with two paragraphs ("Lengkapkan 30 soalan mengikut turutan asal. …", "Jika cikgu bekalkan bahan offline, …") and links "Template Word" / "Template XLSX" | S13-004–008 | Admin | OBSERVED |
| FN-M09-5.2.3 | Form `POST /admin/audio-kbat` (`multipart/form-data`). Card "Maklumat Set": "Tajuk Set" `title` required, placeholder "Contoh: BM T4 Ujian Mendengar Set 1"; "Tahap" `education_level_id` required ("Pilih Tahap" + 11); "Subjek" `subject_id` required ("Pilih Subjek" + 31 A–Z); "Status" `status` ("Approved" `approved` **default**, "Pending Review", "Draft"); "Sumber / Penyumbang" `source_label` (placeholder "Contoh: Cikgu {name}" — a teacher-name example; the prototype uses "Contoh: Cikgu Demo 02", fictitious); "Arahan Umum" `instructions` textarea, placeholder "Dengar audio bagi setiap bahagian dan jawab semua soalan." | S13-009–024 | Admin | OBSERVED |
| FN-M09-5.2.4 | Four section cards "Bahagian 1 · Soalan 1-8", "Bahagian 2 · Soalan 9-16", "Bahagian 3 · Soalan 17-24", "Bahagian 4 · Soalan 25-30", each "Audio section ini akan kekal bersama semua soalan dalam range ini.", "Tajuk Audio" `sections[n][title]` (prefilled "Audio 1"…"Audio 4"), "Fail Audio" `sections[n][audio]` file (accept `.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*`, not required), "Transkrip Audio Untuk Audit" `sections[n][transcript]` (placeholder "Wajib digalakkan untuk semakan admin.") | S13-025–033, S13-056–082 | Admin | OBSERVED |
| FN-M09-5.2.5 | 30 question blocks after their section (identical apart from the number; the inventory keeps block 1): h "Soalan {n}", pill "KBAT Audio"; "Teks Soalan" required; "Pilihan A"…"Pilihan D" required; "Jawapan" required select A/B/C/D (default A); "Markah" number 1–20 (default 1); "KBAT Level" number 1–5 (default 3); "DSKP SP ID" number, placeholder "Optional"; "Skema / Penjelasan" textarea. Options 1 column below `md`, 2 columns from `md` | S13-034–055 | Admin | OBSERVED |
| FN-M09-5.2.6 | Sticky submit `fa-save` "Simpan Set Audio KBAT" at the bottom right (floats over the content at 375). No "Batal" button (only "Kembali") | S13-083 | Admin | OBSERVED |
| FN-M09-5.2.7 | Native validation: 153 required fields invalid on the empty form (title, level, subject, 5 × 30 question fields); no request while invalid | — | Admin | OBSERVED |
| FN-M09-5.2.8 | Save result: the set (4 sections, 30 questions in fixed order) is stored with the chosen status; `/admin/audio-kbat` opens with a success flash (UNVERIFIED COPY) and the stat cards count it | — | Admin | INFERRED (L-1, L-3) |

**FT-M09-5.3 — Audio KBAT (student list)** (S21 `/audio-kbat`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-5.3.1 | Shell header = the page title from the route, "Audio KBAT", with no subtitle (DV-M09-08, same DV-SH-03 rule as S12/S13; live "Dashboard" / "Selamat datang kembali", a stale dashboard fallback); tab title "Audio KBAT" | SHU-382–383 | All logged-in | OBSERVED + DV-M09-08 |
| FN-M09-5.3.2 | Hero: pill `fa-headphones` "Ujian Mendengar", h1 "Audio KBAT", "Dengar audio mengikut bahagian dan jawab soalan yang dipaparkan serentak. Set ini tidak dirawak supaya audio kekal selari dengan nombor soalan." on the intended dark gradient of the hero container (`rounded-3xl bg-gradient-to-br from-slate-950 via-amber-900 to-orange-700 text-white …`); the h1 renders white, inherited from the container's own `text-white` (SOURCE-DERIVED from the live markup) (DV-M09-09; live: the gradient classes are missing from the CSS build, background transparent, text unreadable, and the global heading colour overrides the inherited white) | S21-004–006 | All logged-in | OBSERVED + SOURCE-DERIVED + DV-M09-09 |
| FN-M09-5.3.3 | Filter GET `/audio-kbat`: `education_level_id` ("Semua Tahap" + 11), `subject_id` ("Semua Subjek" + 31 A–Z), `fa-search` "Tapis" shown as a slate-900 button with white text (DV-M09-09; live invisible white on white); values kept | S21-007–010 | All logged-in | OBSERVED + DV-M09-09 |
| FN-M09-5.3.4 | No approved set (with or without filters): `fa-headphones` "Belum ada set Audio KBAT yang approved." | S21-011 | All logged-in | OBSERVED |
| FN-M09-5.3.5 | Only `approved` sets are listed, filtered by level and subject (AND) | — | All logged-in | INFERRED (empty-state copy) |
| FN-M09-5.3.6 | Set item and player (L-3, not observable): provisional item (title, level, subject) linking to a provisional player page with the 4 audio sections, each an audio player and its questions shown together (SOURCE-DERIVED from the copy "soalan dipaparkan serentak mengikut section"), radio answers A–D and a submit "Hantar" (PROPOSED COPY); scoring INFERRED (sum of marks of correct answers); result display UNVERIFIED. Decided with the reader build (PROPOSED COPY, SRS §8.2, OQ-M09-11): page title "Audio KBAT" for list and player, player h1 = the set title; back link "Kembali"; result "Skor anda {n} / {total}" and the form locked after a score; "Audio tidak tersedia." for a section without a file; "Ralat memuatkan data. Sila cuba semula." when loading fails; only answered questions are submitted; an unknown or non-approved set → the standalone 404 page | — | All logged-in | SOURCE-DERIVED / INFERRED (L-3), provisional |

### EP-M09-6 — Video (user portal and public)

**FT-M09-6.1 — Video list (logged-in)** (S17 `/video`, user shell)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-6.1.1 | Shell header "Video Pembelajaran" / "Tonton video motivasi, tutorial dan tips peperiksaan"; tab title "Video Pembelajaran - PRESTASIPLUS" | SHU-375–376 | All logged-in | OBSERVED |
| FN-M09-6.1.2 | Search form GET `/video`: `search` placeholder "Cari video..." | S17-004–005 | All logged-in | OBSERVED |
| FN-M09-6.1.3 | Category pills with counts: "Semua ({n})" → `/video` (with an active subject: `/video?subject={id}`), "Motivasi ({n})", "Tutorial ({n})", "Tips SPM ({n})", "Ceramah ({n})", "Lain-lain ({n})" → `?category={code}`; with an active subject the link is built subject first, `?subject={id}&category={code}` (OBSERVED `?subject=5&category=motivasi`). Counts follow the current search and subject (live 2260 / 3 / 12 / 3 / 2242 / 0; with `subject=5` 97 / 1 / 12 / 3 / 81 / 0). With an active search `search={q}` is appended last to every pill link (INFERRED; live showed no active-search case with a link). A pill whose count is 0 — every category pill and "Semua (0)" — is shown but does not navigate (DV-M09-10; live `href="#"`). Active: gradient 135° rgb(239,68,68) → rgb(249,115,22), white; inactive white / gray-600 | S17-006–011, S17-053–057, S17-228–232 | All logged-in | OBSERVED + DV-M09-10 |
| FN-M09-6.1.4 | Subject pills for the subjects that have videos under the current category and search, in subject id order: "{subject} ({n})" → `?subject={id}`, or with an active category `?category={code}&subject={id}` (category first; OBSERVED `?category=motivasi&subject=5` "Sejarah (1)"). The subject pills **ignore the active subject**: with `?subject=5` all five pills still show with their full counts (Matematik 865, Sejarah 97, Matematik Tambahan 420, Fizik 779, Kimia 96) and the active subject pill has no special style (OBSERVED); with a subject active, `fa-times` "Reset Subjek" → `/video` | S17-012–016, S17-048, S17-233 | All logged-in | OBSERVED |
| FN-M09-6.1.5 | Button-link `fa-plus` "Tambah Video" → `/video/tambah` (logged-in only) | S17-017 | All logged-in | OBSERVED |
| FN-M09-6.1.6 | Grid, 24 per page (1 → 2 → … → 6 columns at `xl`); card (link → `/video/{id}`): thumbnail (real YouTube `hqdefault` from `img.youtube.com`, https; on a load error the frame stays empty — no drawn placeholder, D22), hover overlay `fa-play`, platform chip ("YouTube"), title, uploader initial circle + name + role label (displayed "Admin"; DOM "admin", capitalised by CSS), "{n} tontonan", relative date ("6 bulan yang lepas") | S17-018–027, S17-049–052, S17-222–225, S17-234–235 | All logged-in | OBSERVED |
| FN-M09-6.1.7 | Pager (Laravel, English) keeping `subject`, `category`, `search`: "Showing 1 to 24 of 2260 results", window 1…10 … 94 95; below 640px "« Previous" / "Next »" | S17-028–047, S17-226–227 | All logged-in | OBSERVED |
| FN-M09-6.1.8 | No match (search, or `?category=lain-lain`): 🎬 "Tiada Video Dijumpai" / "Cuba ubah carian atau pilih kategori lain." / `fa-arrow-left` "Lihat Semua Video" → `/video` | S17-058–061 | All logged-in | OBSERVED |
| FN-M09-6.1.9 | Order (v1.7, D22): the captured live list order, replicated as a display key (SRS BR-M09-19); each row's age text ("7 bulan yang lepas" for ids 1–20, "6 bulan yang lepas" otherwise) is replicated separately because the live order is not monotone in age; a newly added video appears first. Captured orderings the order must reproduce: page 1 = 2224, 64, 433, 825, 1020, 19, 2225, 65, 434, 827, 1021, 2226, 66, 435, 852, 1022, 2227, 67, 436, 877, 1023, 2228, 68, 437; `?subject=5` = 2224, 2225, … 2247 (ascending); `?subject=5&page=2` = 2248…2260, then 21…31; `?page=2` = 878, 1024, 2229, 69, 438, 879, 1025, 2230, … (five upload series interleaved round-robin); `?category=motivasi` = 18, 17, 16; `?page=95` = 2220, 2221, 2222, 2223 (OBSERVED; the timestamps behind the age texts are seed-assigned, SRS §6.9). The subject lists follow DV-M09-20. Visibility: `global` videos for everyone, `school` videos only for users of the uploader's school (INFERRED, R-10) | — | All logged-in | OBSERVED (orders) / INFERRED (key, visibility) |

**FT-M09-6.2 — Video list (guest, public layout)** (S17 `/video`, guest)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-6.2.1 | Public layout for guests, tab title "Video Pembelajaran — PRESTASIPLUS": logo → `/`, "\|", "🎬" "Video", "Log Masuk" → `/login`, "Daftar Percuma" → `/register` | S17-062–068 | Guest | OBSERVED |
| FN-M09-6.2.2 | Hero: 🎬 🎯, chip "VIDEO PEMBELAJARAN", h1 "Tonton & Fahami", "Tutorial, tips SPM, motivasi dan banyak lagi — semua dalam satu platform!" | S17-069–073 | Guest | OBSERVED |
| FN-M09-6.2.3 | Guest search, category and subject pills and grid as FN-M09-6.1.2…6.1.7, without "Tambah Video" | S17-074–205 | Guest | OBSERVED |
| FN-M09-6.2.4 | CTA "Nak Tonton Lebih Banyak?" (🎬 📚 🎯 🚀 🎓), "Daftar percuma dan dapat akses penuh ke semua video, latih tubi interaktif, ganjaran menarik dan banyak lagi!", `fa-arrow-right` "Daftar Percuma Sekarang", "100% Percuma • Tiada Kad Kredit Diperlukan"; footer as the article guest page | S17-206–221 | Guest | OBSERVED |

**FT-M09-6.3 — Video detail** (S18 `/video/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-6.3.1 | Shell header "Video" / {title}; tab title "{title} - Video PRESTASIPLUS" | SHU-377–378 | All logged-in | OBSERVED |
| FN-M09-6.3.2 | Back link `fa-arrow-left` "Semua Video" → `/video`, "/", {title} | S18-004–006 | All logged-in | OBSERVED |
| FN-M09-6.3.3 | Card: embedded player (real iframe `https://www.youtube.com/embed/{videoId}` for YouTube, not auto-played; Vimeo / Dailymotion embeds on the host allow-list; any other platform shows a text link, SRS NFR-M09-06), h1 title, "{n} tontonan" · "dd Mon yyyy" | S18-007–011 | All logged-in | OBSERVED |
| FN-M09-6.3.4 | Owner/admin actions: `fa-pen` "Edit" → `/video/{id}/edit`; `fa-trash` "Padam" = DELETE form with `confirm('Padam video ini?')` | S18-012–016 | Owner, Admin | OBSERVED (admin) / INFERRED (owner) |
| FN-M09-6.3.5 | Chips `fa-youtube` "YouTube" (red-100/red-700), category label (amber-100 / orange text), `fa-book` subject (indigo-100/indigo-700); uploader initial circle, name, role code ("admin"); multi-line description | S18-017–023 | All logged-in | OBSERVED |
| FN-M09-6.3.6 | "Video Berkaitan": up to 6 other videos of the same subject, highest id first (thumbnail, title, "{uploader} · {n} tontonan") → their detail pages | S18-024–030 | All logged-in | OBSERVED (#2224 → 2260, 2259, …) |
| FN-M09-6.3.7 | Unknown id → the global 404 page (as FN-M09-2.3.9) | S18-031–037 | All logged-in | OBSERVED + M01 DV-02 |
| FN-M09-6.3.8 | Every open of `/video/{id}` adds 1 to the views **after** the page is built: the detail shows the count before this open and the list then shows +1 (discovery-time observation, 2026-09-25: detail "120 tontonan", list afterwards "121 tontonan" on #2224; the 2026-10-02 capture shows 134). The edit page `/video/{id}/edit` does not count a view (live; SRS §7 #28 `?for=edit`) | — | All logged-in | OBSERVED |

**FT-M09-6.4 — Add video** (S20 `/video/tambah`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-6.4.1 | Shell header "Tambah Video" / "Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain"; tab title "Tambah Video" | SHU-380–381 | All logged-in | OBSERVED |
| FN-M09-6.4.2 | Back arrow → `/video`; h1 "Tambah Video Baru"; "Paste sahaja link video — kami akan buat selebihnya" | S20-004–006 | All logged-in | OBSERVED |
| FN-M09-6.4.3 | Form `POST /video` (`videoForm()`): `fa-link` "URL Video *" `video_url` url required, placeholder "https://www.youtube.com/watch?v=...", hint `fa-info-circle` "Sokongan: YouTube, Vimeo, Dailymotion, TikTok, Facebook". 500 ms after typing the URL is parsed client-side: YouTube (`watch?v=`, `embed/`, `shorts/`, `youtu.be/`; thumbnail `img.youtube.com/vi/{id}/hqdefault.jpg`), Vimeo (no thumbnail), Dailymotion (thumbnail), TikTok (`tiktok.com`), Facebook (`facebook.com` + `video`) → preview `fa-check-circle` "Platform dikesan: {platform}" (+ thumbnail); an unsupported URL shows nothing and is still accepted by the browser | S20-007–014, S20-037 | All logged-in | OBSERVED |
| FN-M09-6.4.4 | "Tajuk Video *" `title` required, placeholder "Contoh: Tips Skor A+ Matematik SPM"; "Penerangan (opsional)" `description` maxlength 1000, placeholder "Terangkan secara ringkas tentang video ini..." | S20-015–019 | All logged-in | OBSERVED |
| FN-M09-6.4.5 | "Kategori *" `category` required ("Pilih kategori..." '', "Motivasi", "Tutorial", "Tips SPM", "Ceramah", "Lain-lain"); "Subjek (opsional)" `subject_id` ("Tiada subjek khusus" '' + 31 subjects in id order) | S20-020–024 | All logged-in | OBSERVED |
| FN-M09-6.4.6 | "Siapa boleh lihat? *" radio cards `visibility`: `global` "Semua Pengguna" / "Boleh dilihat oleh semua" (checked); `school` "Sekolah Saya" / {school name}, or "Tiada sekolah" and disabled (opacity 50 %, clicks ignored) when the user's **video-form school** is empty. OBSERVED for the admin account: `/profile` shows no school, `/profile/edit` has a selected school (an SK in Johor, PPD KLUANG) and yet this form shows "Tiada sekolah" disabled — so the form reads a school source other than the profile `school_id`. That source is INFERRED (e.g. a school derived from another relation such as a class or staff membership) and is modelled as its own field `videoSchoolId` (SRS BR-M09-21), empty for the seed admin; no role rule | S20-025–029 | All logged-in | OBSERVED (admin: disabled) / INFERRED (source, enabled case, L-6) |
| FN-M09-6.4.7 | Uploader strip: initial circle, {name} "·" role label (displayed "Admin" for the admin; DOM text "admin" capitalised by CSS), `fa-info-circle` "Nama anda akan dipaparkan bersama video" | S20-030–034 | All logged-in | OBSERVED |
| FN-M09-6.4.8 | Footer on one row at every width: `fa-upload` "Terbitkan Video" (left) and "Batal" → `/video` | S20-035–036 | All logged-in | OBSERVED |
| FN-M09-6.4.9 | Native validation: empty invalid on `video_url`, `title`, `category`; no request while invalid | — | All logged-in | OBSERVED |
| FN-M09-6.4.10 | Publish result: stored (platform and external id from the URL, uploader = current user, views 0) and `/video` opens with a success flash (UNVERIFIED COPY) | — | All logged-in | INFERRED (L-1) |

**FT-M09-6.5 — Edit video** (S19 `/video/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-6.5.1 | Shell header "Edit Video" / {title}; tab title "Edit Video - {title}" | SHU-379 | Owner, Admin | OBSERVED |
| FN-M09-6.5.2 | Back arrow → `/video/{id}`; h1 "Edit Video"; "Kemaskini maklumat video" | S19-004–006 | Owner, Admin | OBSERVED |
| FN-M09-6.5.3 | Form `PUT /video/{id}` with the S20 fields preloaded (labels "Penerangan" and "Subjek" without "(opsional)"; the category select has no placeholder); the preview shows "Platform dikesan: Youtube" (stored spelling) and the thumbnail; visibility as saved ("Sekolah Saya" disabled without school; the visibility cards show no sub-lines on S19 — OBSERVED in `video-edit.png` — while S20 shows them; a stored `school` visibility with no form-context school resets to `global` on the form, DN-M09-05) | S19-007–031 | Owner, Admin | OBSERVED |
| FN-M09-6.5.4 | Footer: `fa-save` "Simpan Perubahan" (left) and "Batal" → `/video/{id}` (order reversed compared with the admin forms, as live) | S19-032–033 | Owner, Admin | OBSERVED |
| FN-M09-6.5.5 | Unknown id → the global 404 page | S19-034–040 | Owner, Admin | OBSERVED + M01 DV-02 |
| FN-M09-6.5.6 | Update result: stored, `/video/{id}` opens with a success flash (UNVERIFIED COPY) | — | Owner, Admin | INFERRED (L-1) |

**FT-M09-6.6 — Video rules** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-6.6.1 | Every logged-in user can add a video ("Tambah Video" in the list and the form) | — | All logged-in | OBSERVED (admin) / INFERRED (other roles, R-13) |
| FN-M09-6.6.2 | "Edit" and "Padam" show, and the edit/delete routes work, for the uploader and the admin only; others get no buttons and 403 from the API; opening `/video/{id}/edit` as such a user redirects to the session landing page (in-place 403 when the landing page is a video route, DN-M09-02) | — | Owner, Admin | INFERRED (R-13) |
| FN-M09-6.6.3 | Delete result: the video is removed and `/video` opens with a success flash (UNVERIFIED COPY) | — | Owner, Admin | INFERRED (L-1) |

### EP-M09-7 — Perutusan (user portal)

**FT-M09-7.1 — Perutusan list** (S22 `/perutusan`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-7.1.1 | Shell header "Perutusan" / "Kata-kata aluan dan maklumat penting dari pihak pengurusan"; tab title "Perutusan" | SHU-384–385 | All logged-in | OBSERVED |
| FN-M09-7.1.2 | Dark hero (slate-900 gradient, yellow scroll icon), h1 "Perutusan Rasmi" (white), "Maklumat & berita dari pihak pengurusan"; buttons `fa-pen-fancy` "Tulis Perutusan" (amber) → `/perutusan/tulis` and `fa-folder-open` "Perutusan Saya" → `/perutusan/saya` | S22-004–007 | All logged-in | OBSERVED |
| FN-M09-7.1.3 | Pinned card: amber left border and top-right `fa-thumbtack` "Disematkan" (text hidden below `sm`, icon only) | S22-008–009, S22-022–023 | All logged-in | OBSERVED |
| FN-M09-7.1.4 | Author row: initials circle (e.g. "AD"), author name, role pill (e.g. "Pengetua", upper case, blue gradient), `fa-school` scope label ("Sekolah"), relative date | S22-010–014, S22-024–028, S22-034–039 | All logged-in | OBSERVED |
| FN-M09-7.1.5 | h3 title and plain-text excerpt (HTML stripped, ~250 characters + "...") as a link → `/perutusan/{id}` | S22-015–016, S22-029–030, S22-040–041 | All logged-in | OBSERVED |
| FN-M09-7.1.6 | Card footer: "Video disertakan" (YouTube icon) when a video link exists; the top reaction "👍 {n}" / "❤️ {n}" / "🙏 {n}" (hidden when none); `fa-comment` "{n} komen" (approved comments); `fa-eye` "{n} baca" | S22-017–020, S22-031–032, S22-042–045 | All logged-in | OBSERVED |
| FN-M09-7.1.7 | Link "Baca selanjutnya" `fa-arrow-right` → `/perutusan/{id}` | S22-021, S22-033, S22-046 | All logged-in | OBSERVED |
| FN-M09-7.1.8 | List rules: published posts (and scheduled posts whose time has come) visible to the viewer by scope — national posts for everyone, school posts for that school's users, the admin sees all; order pinned first, then newest (live #4, #2, #3). Empty state and pager not observed (UNVERIFIED) | — | All logged-in | OBSERVED (admin order) / INFERRED (scope, scheduling) |

**FT-M09-7.2 — Perutusan detail** (S23 `/perutusan/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-7.2.1 | Shell header "Perutusan" / {scope label} (e.g. "Sekolah"); tab title = the post title | SHU-386 | All logged-in | OBSERVED |
| FN-M09-7.2.2 | Link `fa-arrow-left` "Kembali ke senarai" → `/perutusan` | S23-004 | All logged-in | OBSERVED |
| FN-M09-7.2.3 | Dark author header: initials, name, role pill (blue-500/20, blue-200 text), `fa-school` scope, date "dd Mon yyyy, h:mmAM" (e.g. "17 Mar 2026, 11:23PM"), `fa-globe` "Awam" when public, `fa-thumbtack` "Disematkan" when pinned | S23-005–012 | All logged-in | OBSERVED |
| FN-M09-7.2.4 | h1 title; the rich HTML body (Quill output: centred lines, bold, Jawi/Arabic text); a YouTube embed when `youtube_url` is set; attached images and PDFs (UNVERIFIED layout, L-4) | S23-013–047 | All logged-in | OBSERVED / UNVERIFIED (attachments) |
| FN-M09-7.2.5 | Reactions: three POST forms to `/perutusan/{id}/react` with hidden `type` = `like` "👍 Suka {n}", `love` "❤️ Cinta {n}", `thanks` "🙏 Terima Kasih {n}" (count shown when > 0; `reaction-pill`) | S23-048–059 | All logged-in | OBSERVED |
| FN-M09-7.2.6 | `fa-eye` "{n} baca" and `fa-comment` "{n} komen" | S23-060–061 | All logged-in | OBSERVED |
| FN-M09-7.2.7 | Public posts only: "Pautan Awam (boleh kongsi tanpa login)", read-only input `https://prestasiplus.my/perutusan/awam/{id}` (a click selects and copies it) and `fa-whatsapp` "Kongsi ke WhatsApp" → `wa.me/?text={title} — Baca di PrestasiPlus: {public URL}` | S23-062–064 | All logged-in | OBSERVED |
| FN-M09-7.2.8 | Card "Komen": form `POST /perutusan/{id}/comment`, textarea `body` required, maxlength 1000, placeholder "Tulis komen anda..."; note "Komen akan disemak sebelum dipaparkan"; submit "Hantar" (blue-600); without approved comments "Belum ada komen" | S23-065–072 | All logged-in | OBSERVED |
| FN-M09-7.2.9 | Unknown id → the global 404 page | S23-073–079 | All logged-in | OBSERVED + M01 DV-02 |
| FN-M09-7.2.10 | Reaction result (L-4): the page reloads and the pill of that type counts the user once; clicking the same type again removes it (INFERRED toggle); visual state of the chosen reaction UNVERIFIED | — | All logged-in | INFERRED (L-4) |
| FN-M09-7.2.11 | Comment result (L-4): stored as pending, not shown and not counted until approved; the page reloads with a flash (UNVERIFIED COPY). The approval screen is not in M09 (OQ-M09-05) | — | All logged-in | INFERRED (L-4) |
| FN-M09-7.2.12 | Read count: OBSERVED — the admin's open of `/perutusan/4` (the admin is not the author) left "3 baca" unchanged, and a guest GET of `/perutusan/awam/4` also left it at 3. INFERRED rule consistent with both: a read is counted once per user when a logged-in user who is neither the admin nor the author opens `/perutusan/{id}`; admin opens, author opens and the public page are not counted (OQ-M09-06) | — | All logged-in | OBSERVED (two non-counting opens) / INFERRED (rule) |

**FT-M09-7.3 — Write perutusan** (S24 `/perutusan/tulis`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-7.3.1 | Shell header "Tulis Perutusan" / "Sampaikan kata-kata aluan atau maklumat penting"; tab title "Tulis Perutusan" | SHU-387–388 | Writers | OBSERVED |
| FN-M09-7.3.2 | Form `POST /perutusan/tulis` (multipart). "Skop Perutusan": read-only text from the author's role — admin "Seluruh Malaysia (Kebangsaan)" (OBSERVED); school_admin "Sekolah" (INFERRED from the posts); other writer roles UNVERIFIED (L-6) | S24-004–007 | Writers | OBSERVED (admin) / INFERRED |
| FN-M09-7.3.3 | "Tajuk Perutusan" `title` required, placeholder "cth: Perutusan Pengetua Semester 2 2026" | S24-008–009 | Writers | OBSERVED |
| FN-M09-7.3.4 | "Kandungan": Quill 2 editor (snow theme), placeholder "Tulis perutusan anda di sini...", toolbar: header picker (H2, H3, Normal), bold, italic, underline, colour picker (35 swatches, Quill default palette), ordered list, bullet list, align picker (left, center, right, justify), link (with the Quill link tooltip), clean | S24-010, S24-012–068 | Writers | OBSERVED |
| FN-M09-7.3.5 | `fa-code` "HTML" toggle: swaps the editor for a raw HTML textarea and back (pasting the HTML into Quill); on submit the HTML is copied into hidden `body` ('' when the editor holds only `<p></p>`). The body is **not** required (SEC-M09-02) | S24-011, S24-069–070 | Writers | OBSERVED |
| FN-M09-7.3.6 | "Gambar (maks 2MB setiap satu)": `images[]` (accept `image/*`, multiple), label "Klik untuk muat naik gambar" / "JPG, PNG, GIF - maks 2MB"; "Dokumen PDF (maks 5MB setiap satu)": `documents[]` (accept `.pdf`), "Klik untuk muat naik PDF" / "PDF sahaja - maks 5MB" (SEC-M09-04) | S24-071–076 | Writers | OBSERVED |
| FN-M09-7.3.7 | "Pautan Video YouTube (Pilihan)" `youtube_url` url, placeholder "https://www.youtube.com/watch?v=..." | S24-077–078 | Writers | OBSERVED |
| FN-M09-7.3.8 | Checkboxes `fa-thumbtack` "Sematkan di atas (maks 2)" `is_pinned` and `fa-globe` "Jadikan Awam (boleh dibaca tanpa login)" `is_public` (both unchecked) | S24-079–082 | Writers | OBSERVED |
| FN-M09-7.3.9 | "Status Penerbitan" radio cards `status` (default `published`): "Terbit Sekarang" / "Terus dipaparkan", "Jadualkan" / "Pilih tarikh & masa", "Draf" / "Simpan dahulu". "Jadualkan" shows "Tarikh & Masa Penerbitan" `scheduled_at` (datetime-local, not required) | S24-083–091 | Writers | OBSERVED |
| FN-M09-7.3.10 | Footer on one row at 375/768/1280: "Batal" (88×50) → `/perutusan` (discards) and `fa-paper-plane` "Hantar Perutusan" (wide) | S24-092–093 | Writers | OBSERVED |
| FN-M09-7.3.11 | Native validation: only `title` is required (form valid with a title alone); no request while invalid | — | Writers | OBSERVED |
| FN-M09-7.3.12 | Submit result (L-4): `published` → visible now; `scheduled` → visible from `scheduled_at` (empty date → treated as now, INFERRED); `draft` → only in "Perutusan Saya"; a third pin inside the same scope is refused with an error (UNVERIFIED COPY); files over the limits refused; redirect to `/perutusan` (draft → `/perutusan/saya`) with a flash (UNVERIFIED COPY) | — | Writers | INFERRED (L-4) |

**FT-M09-7.4 — My perutusan** (S25 `/perutusan/saya`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-7.4.1 | Shell header "Perutusan Saya" / "Urus semua perutusan yang anda telah tulis"; tab title "Perutusan Saya" | SHU-389–390 | Writers | OBSERVED |
| FN-M09-7.4.2 | Links `fa-arrow-left` "Kembali" → `/perutusan` and `fa-pen-fancy` "Tulis Baru" → `/perutusan/tulis` | S25-004–005 | Writers | OBSERVED |
| FN-M09-7.4.3 | No own post: card "Anda belum menulis perutusan" | S25-006–007 | Writers | OBSERVED |
| FN-M09-7.4.4 | Own posts (L-4, not observable): provisional list of the user's posts (title, status label, date) linking to the detail; edit and delete of own posts UNVERIFIED and not provided in the prototype until observed | — | Writers | INFERRED (L-4), provisional |

**FT-M09-7.5 — Public perutusan page** (S28 `/perutusan/awam/{id}` (added in discovery top-up))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-7.5.1 | Standalone public layout (no `<main>`, no sidebar, no user or admin shell; different from the `/artikel` and `/video` guest layout), page background rgb(248,250,252); tab title "{title} — PRESTASIPLUS". Sticky dark top bar `nav.top-nav` (rgba(15,23,42,0.97)): logo "PrestasiPlus" → `/`; outline-gold "Daftar Percuma" (hidden below `sm`) → `/register` (DV-M09-18; live `/daftar`, 404); gold `fa-sign-in-alt` "Log Masuk" → `/login`. Opens without login for a public published post (guest GET 200) and counts no read | S28-001–004 | Guest | OBSERVED + DV-M09-18 |
| FN-M09-7.5.2 | Hero: breadcrumb "Utama" → `/` › "Perutusan" (plain text); author row: amber initials tile ("AD"), author name, pill "Pengetua" (bg rgba(245,158,11,0.12), text rgb(252,211,77), upper case by CSS), `fa-school` scope label ("Sekolah"); date line `fa-calendar-alt` date in **Malay** month format, "\|", `fa-clock` time ("17 Mac 2026 11:23 PM"; S23 shows "17 Mar 2026, 11:23PM"); h1 (white) = the post title | S28-005–013 | Guest | OBSERVED |
| FN-M09-7.5.3 | Stat chips (display only): "{n} Suka" = total reactions of all three types ("1 Suka"), `fa-eye` "{n} baca", `fa-comment` "{n} komen"; a hidden inline style string in the row ("@media(min-width:640px){display:inline}") is not displayed | S28-014–017 | Guest | OBSERVED |
| FN-M09-7.5.4 | Body card with the same rendered HTML body as S23 (SEC-M09-02); attachments would follow the body (none on the observed post — layout UNVERIFIED) | S28-018–053 | Guest | OBSERVED / UNVERIFIED (attachments) |
| FN-M09-7.5.5 | Video block `fa-youtube` "Video" with the YouTube iframe `/embed/{videoId}` when `youtube_url` is set (635×357 at 1280, 636×358 at 768, 267×150 at 375; not auto-played; offline placeholder per SRS NFR-M09-06) | S28-054 | Guest | OBSERVED |
| FN-M09-7.5.6 | Share card "Kongsi Perutusan": `fa-whatsapp` "WhatsApp" → `wa.me/?text={title} — Baca di PrestasiPlus: {url}`; `fa-telegram-plane` "Telegram" → `t.me/share/url?url={url}&text={title}`; `fa-facebook-f` "Facebook" → `facebook.com/sharer/sharer.php?u={url}`; `fa-link` "Salin Pautan" button copies `location.href` and shows `fa-check` "Disalin!"; the four buttons wrap to 2 rows at 375 | S28-055–059, S28-071 | Guest | OBSERVED |
| FN-M09-7.5.7 | Login CTA (amber card): h2 "Jom Sertai PrestasiPlus!", "Platform latih tubi interaktif untuk pelajar SPM. Beri reaksi, komen, dan banyak lagi!", `fa-rocket` "Daftar Percuma Sekarang" (gradient rgb(245,158,11) → rgb(234,179,8), text rgb(15,23,42)) → `/register` (DV-M09-18; live `/daftar`, 404) and `fa-sign-in-alt` "Log Masuk" → `/login`; the two buttons stack full width at 375 | S28-060–063 | Guest | OBSERVED + DV-M09-18 |
| FN-M09-7.5.8 | Dark footer (bg rgb(15,23,42), text rgb(100,116,139)): logo, "Platform Latih Tubi Interaktif Malaysia", links "Utama" → `/`, "Tentang" → `/tentang` (live 404, replicated: the global 404 page; DV-M09-19), "Hubungi" → `/panduan` (DV-M09-19; live `/hubungi`, 404), "Log Masuk" → `/login`; "© 2026 PRESTASIPLUS. Hak Cipta Terpelihara." | S28-064–070 | Guest | OBSERVED + DV-M09-19 |
| FN-M09-7.5.9 | Guest restrictions (OBSERVED): no reaction buttons (count only), no comment form or list, no public-link input, no "Kembali ke senarai". A non-public, unpublished or unknown id → the global 404 page (INFERRED). The page layout is the same for a logged-in viewer (INFERRED; only the guest view was captured) | — | Guest | OBSERVED / INFERRED |

### EP-M09-8 — Panduan Pengguna (standalone page)

**FT-M09-8.1 — User guide page** (S26 `/panduan` (S27 renders the same page))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-8.1.1 | Standalone layout (no sidebar), tab title "Panduan Pengguna — PRESTASIPLUS". Top bar: logo → `/`; `fa-home` "Laman Utama" → `/`, `fa-newspaper` "Artikel" → `/artikel`, and `fa-th-large` "Dashboard" → `/dashboard` for a logged-in user, or "Log Masuk" → `/login` and `fa-rocket` "Daftar Percuma" → `/register` for a guest. Below `lg` the links move into a `fa-bars` menu (`mobileOpen`) | S26-001–009, S26-319–322, S27-001–009 | All, Guest | OBSERVED |
| FN-M09-8.1.2 | Hero "📖" h1 "Panduan Pengguna PRESTASIPLUS" / "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!" | S26-010–012, S27-010–012 | All, Guest | OBSERVED |
| FN-M09-8.1.3 | Role tabs (`panduanApp()`): 👨‍🎓 "Pelajar" "Darjah 1 – Tingkatan 5", 👩‍🏫 "Guru" "Guru Mata Pelajaran", 👪 "Ibu Bapa" "Pemantauan Anak", 🏫 "Admin Sekolah" "Pengetua / GPK", 📊 "PPD / JPN" "Pegawai Daerah / Negeri". Initial role = the URL hash without "#" (`#pelajar`, `#guru`, `#ibubapa`, `#admin`, `#ppd`); an empty hash → Pelajar; an unknown hash (e.g. `#xyz`) → no tab active and no role panel shown, as live (source `activeRole: location.hash.replace('#','') \|\| 'pelajar'`; SOURCE-DERIVED, replicated); a click shows that role's panel, sets the hash with `history.replaceState` and smooth-scrolls to the top; active tab border rgb(99,102,241) + shadow rgba(99,102,241,0.25) 0 8px 20px; 2 / 3 / 5 columns at 375 / 768 / 1280 | S26-013–018, S27-013–018 | All, Guest | OBSERVED |
| FN-M09-8.1.4 | Pelajar panel: "Cara Daftar Akaun Pelajar" (5 numbered steps) and "Apa Yang Boleh Anda Buat" (6 feature cards) — exact copy discovery Appendix B. Panel styling (all panels): step-number colour Pelajar blue and Guru green OBSERVED; Ibu Bapa purple, Admin Sekolah amber and PPD/JPN teal INFERRED; heading icons only for Pelajar and Guru (OBSERVED). The role is read once from `location.hash` on load, as live | S26-019–070, S27-019–070 | All, Guest | OBSERVED |
| FN-M09-8.1.5 | Guru panel: "Cara Daftar Akaun Guru" (steps) and "Alat-Alat Guru" (feature cards) | S26-083–143, S27-083–143 | All, Guest | OBSERVED |
| FN-M09-8.1.6 | Ibu Bapa panel: "Cara Daftar Akaun Ibu Bapa" (steps) and "Apa Yang Ibu Bapa Boleh Lihat" (feature cards) | S26-156–196, S27-156–196 | All, Guest | OBSERVED |
| FN-M09-8.1.7 | Admin Sekolah panel: "Cara Mula Sebagai Admin Sekolah" (steps) and "Fungsi Admin Sekolah" (feature cards) | S26-205–251, S27-205–251 | All, Guest | OBSERVED |
| FN-M09-8.1.8 | PPD / JPN panel: "Cara Mula Sebagai PPD / JPN" (steps) and "Fungsi PPD / JPN" (feature cards) | S26-260–300, S27-260–300 | All, Guest | OBSERVED |
| FN-M09-8.1.9 | FAQ accordions per role ("Soalan Lazim Pelajar" 5, "Soalan Lazim Guru" 5, "Soalan Lazim Ibu Bapa" 3, "Soalan Lazim Admin" 3, "Soalan Lazim PPD / JPN" 4): each item `{ open: false }` with `fa-chevron-down`; independent (several can be open) | S26-071–082, S26-144–155, S26-197–204, S26-252–259, S26-301–310, S27-071–082, S27-144–155, S27-197–204, S27-252–259, S27-301–310 | All, Guest | OBSERVED |
| FN-M09-8.1.10 | Help box "💬" "Perlukan Bantuan Lanjut?" / "Hubungi pasukan sokongan kami untuk sebarang pertanyaan.": `fa-envelope` "E-mel Kami" → `mailto:support@prestasiplus.my`; `fa-whatsapp` "WhatsApp" (new tab) → the configured support number (DV-M09-14, PROPOSED; live placeholder `https://wa.me/60123456789`); until `GET /api/config/support` answers the box shows the live defaults `support@prestasiplus.my` / `60123456789` | S26-311–315, S27-311–315 | All, Guest | OBSERVED + DV-M09-14 |
| FN-M09-8.1.11 | Footer "© 2026 🇲🇾", logo, "Platform Latih Tubi Nasional"; live shows the logo flush against the left edge, outside the centred text column (visual bug, `panduan-desktop.png`) — rebuilt centred between the two texts (DV-M09-21) | S26-316–318, S27-316–318 | All, Guest | OBSERVED |
| FN-M09-8.1.12 | Guest only: `fa-rocket` "Daftar Percuma Sekarang" → `/register` below the help box | S26-323 | Guest | OBSERVED |

**FT-M09-8.2 — Tuition-centre guide route** (S27 `/pusat-tuisyen/panduan`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-8.2.1 | `/pusat-tuisyen/panduan` renders the identical page (same HTML as `/panduan`) for any logged-in user; its elements are covered by the FT-M09-8.1 Functions | — | All logged-in | OBSERVED |
| FN-M09-8.2.2 | Guest on `/pusat-tuisyen/panduan` → redirect to `/login` (M01), while `/panduan` stays public (as live, DV-M09-15 rejected) | — | Guest | OBSERVED |

### EP-M09-9 — Screenshot upload tool (admin panel)

**FT-M09-9.1 — Screenshot upload tool** (S14 `/admin/tools/screenshots`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-9.1.1 | Shell header "Upload Screenshot" / "Tool admin untuk upload & urus gambar (private)"; tab title "Upload Screenshot - Admin PRESTASIPLUS" | SHA-225–226 | Admin | OBSERVED |
| FN-M09-9.1.2 | Card "Upload Gambar": "Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail."; form `POST /admin/tools/screenshots` (multipart) with a hidden `files[]` input (accept `image/*`, multiple) whose change submits the form at once; drop zone `fa-images` "Klik atau seret fail ke sini" / "Boleh pilih banyak fail" (click opens the picker; drag-over adds `border-indigo-400 bg-indigo-50`; drop submits); tip "Tip: guna nama fail yang ringkas. Sistem akan auto-sanitize nama fail." (SEC-M09-04) | S14-001–008 | Admin | OBSERVED |
| FN-M09-9.1.3 | Card "Fail Sedia Ada": "Jumlah: {n} fail"; empty "Tiada fail lagi." | S14-009–012 | Admin | OBSERVED |
| FN-M09-9.1.4 | Upload result and file list (L-5, not observable): files stored under sanitised names in a private folder, "Jumlah" counts them, a provisional list shows each file name; copy-link and delete actions UNVERIFIED and not provided until observed | — | Admin | INFERRED (L-5), provisional |

### EP-M09-10 — Navigation, layouts and access

**FT-M09-10.1 — M09 entries in the user shell** (user shell (SHU))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-10.1.1 | Desktop sidebar of the user shell: `fa-scroll` "Perutusan" → `/perutusan`; `fa-newspaper` "Artikel" → `/artikel`; `fa-play-circle` "Video" → `/video`; `fa-headphones` "Audio KBAT" → `/audio-kbat`; `fa-book` "Panduan" → `/panduan` | SHU-060, SHU-068–069, SHU-079, SHU-123 | All logged-in | OBSERVED |
| FN-M09-10.1.2 | Mobile drawer of the user shell: "Artikel" and "Video" in the learning section; "Video" again in the teacher section "LAIN-LAIN"; `fa-book` "Panduan" → `/pusat-tuisyen/panduan` (role-dependent display INFERRED) | SHU-209–210, SHU-290, SHU-316 | All logged-in | OBSERVED (links) / INFERRED (role condition) |

**FT-M09-10.2 — M09 entries in the admin shell** (admin shell (SHA))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-10.2.1 | Desktop admin sidebar: `fa-headphones` "Audio KBAT" → `/admin/audio-kbat` (separate item); collapsible group `fa-newspaper` "Kandungan" with `fa-image` "Banner", `fa-newspaper` "Artikel", `fa-sticky-note` "Nota", `fa-cloud-upload-alt` "Upload Screenshot" (the group's "Push Notifikasi" is M22) | SHA-007, SHA-071–074, SHA-076 | Admin | OBSERVED |
| FN-M09-10.2.2 | Admin "Lagi" sheet (below `lg`): section "Kandungan" with "Banner", "Artikel", "Nota", "Upload Screenshot" | SHA-173–176, SHA-179 | Admin | OBSERVED |

**FT-M09-10.3 — Layouts, guest access and error pages** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M09-10.3.1 | Layout follows the route and role, as live: `/admin/*` in the admin shell; `/artikel*`, `/video*`, `/audio-kbat`, `/perutusan*` in the user shell for every logged-in role **including the admin**; `/panduan` and `/pusat-tuisyen/panduan` standalone | — | All logged-in | OBSERVED |
| FN-M09-10.3.2 | Guests: public layouts on `/artikel` and `/video`; `/panduan` public; `/perutusan/awam/{id}` 200 (public post); redirect to `/login` from `/audio-kbat`, `/perutusan`, `/perutusan/{id}`, `/perutusan/tulis`, `/perutusan/saya`, `/video/tambah`, `/video/{id}/edit`, `/pusat-tuisyen/panduan` and `/admin/*` (all OBSERVED); `/video/{id}` and `/artikel/{slug}` public (INFERRED, L-7); a guest on `/video/{id}` gets the public layout without section label or CTA and no Edit/Padam (DN-M09-01) | — | Guest | OBSERVED / INFERRED (details) |
| FN-M09-10.3.3 | `/admin/*` M09 routes need the admin role; other roles are refused (M02 pattern: redirect to their landing page, API 403) | — | All logged-in | INFERRED |

**Totals:** 10 epics · 35 features · 235 functions (184 cover inventory elements; 51 are behaviour-only: 1.1.11, 1.2.7, 1.2.8, 1.3.5, 1.3.6, 1.4.6, 2.1.8, 2.3.10, 2.3.11, 2.4.1, 2.4.2, 3.1.8, 3.1.9, 3.1.10, 3.2.3, 3.2.4, 3.2.5, 3.3.6, 4.1.7, 4.2.9, 4.2.10, 4.3.5, 4.3.6, 4.4.1, 5.1.8, 5.2.7, 5.2.8, 5.3.5, 5.3.6, 6.1.9, 6.3.8, 6.4.9, 6.4.10, 6.5.6, 6.6.1, 6.6.2, 6.6.3, 7.1.8, 7.2.10, 7.2.11, 7.2.12, 7.3.11, 7.3.12, 7.4.4, 7.5.9, 8.2.1, 8.2.2, 9.1.4, 10.3.1, 10.3.2, 10.3.3).

---

## 4. User stories

| ID | Feature | Priority | Story | Functions |
|---|---|---|---|---|
| US-M09-01 | FT-M09-1.1 | Must | As an admin, I want a paginated list of all articles with filters by text, category and status, so that I can find any article. | FN-M09-1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.7, 1.1.8, 1.1.9, 1.1.11 |
| US-M09-02 | FT-M09-1.1 | Must | As an admin, I want to open, edit or delete an article from its row, so that single changes are quick. | FN-M09-1.1.5, 1.1.6, 1.1.10 |
| US-M09-03 | FT-M09-1.2 | Must | As an admin, I want to write a new article with category, level, image URL and publish/featured flags, so that readers get new content. | FN-M09-1.2.1 … 1.2.8 |
| US-M09-04 | FT-M09-1.3 | Must | As an admin, I want to edit an existing article with its saved values preloaded, so that I can correct it. | FN-M09-1.3.1 … 1.3.6 |
| US-M09-05 | FT-M09-1.4 | Should | As an admin, I want to preview an article with its meta data, so that I can check it before editing. | FN-M09-1.4.1 … 1.4.6 |
| US-M09-06 | FT-M09-2.1 | Must | As a logged-in user, I want to browse published articles by category and search, so that I can find useful reading. | FN-M09-2.1.1, 2.1.3 … 2.1.8 |
| US-M09-07 | FT-M09-2.1 / 2.2 | Must | As a reader, I want a changing "Artikel Paling Hangat" selection of featured and popular articles, so that good content is easy to discover. | FN-M09-2.1.2, 2.2.3 |
| US-M09-08 | FT-M09-2.2 | Must | As a visitor without an account, I want to read the article list in a public page that invites me to register, so that I can try the platform. | FN-M09-2.2.1, 2.2.2, 2.2.4, 2.2.5, 2.2.6, 10.3.2 |
| US-M09-09 | FT-M09-2.3 | Must | As a reader, I want an article page with its body, meta data, share buttons, related and latest articles, so that I can read and share it. | FN-M09-2.3.1 … 2.3.8, 2.3.10 |
| US-M09-10 | FT-M09-2.3 | Must | As a reader, I want a clear 404 page for a wrong link, and as a guest to open an article from the public list, so that links never dead-end. | FN-M09-2.3.9, 2.3.11 |
| US-M09-11 | FT-M09-2.4 | Must | As the owner, I want the newest articles to feed the dashboard and teacher contributions to join the same store, so that content stays in one place. | FN-M09-2.4.1, 2.4.2 |
| US-M09-12 | FT-M09-3.1 | Must | As an admin, I want a list of notes filterable by text, subject and type, so that I can manage notes. | FN-M09-3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.7, 3.1.8, 3.1.9, 3.1.10 |
| US-M09-13 | FT-M09-3.1 | Must | As an admin, I want to open, edit or delete a note from its row, so that I can maintain notes. | FN-M09-3.1.5, 3.1.6 |
| US-M09-14 | FT-M09-3.2 | Must | As an admin, I want to create and edit notes (live answers HTTP 500), so that notes can be maintained at all (DV-M09-01). | FN-M09-3.2.1 … 3.2.5 |
| US-M09-15 | FT-M09-3.3 | Should | As an admin, I want to preview a note with its subject, level and type, so that I can check it. | FN-M09-3.3.1 … 3.3.6 |
| US-M09-16 | FT-M09-4.1 | Must | As an admin, I want to see all banners in display order with type, audience, dates and state, so that I know what the dashboard shows. | FN-M09-4.1.1 … 4.1.7 |
| US-M09-17 | FT-M09-4.2 | Must | As an admin, I want to create a banner with type, link, audience, order, dates and active flag, so that I can announce things on the dashboard. | FN-M09-4.2.1 … 4.2.10 |
| US-M09-18 | FT-M09-4.3 | Must | As an admin, I want to edit a banner with every saved value shown, so that saving does not fail or silently change it (DV-M09-07). | FN-M09-4.3.1 … 4.3.6 |
| US-M09-19 | FT-M09-4.4 | Must | As a user, I want the dashboard carousel to show the active banners meant for me in order, so that I see current announcements. | FN-M09-4.4.1 |
| US-M09-20 | FT-M09-5.1 | Must | As an admin, I want a list of Audio KBAT sets with totals, filters and template downloads, so that I can manage listening tests. | FN-M09-5.1.1 … 5.1.8 |
| US-M09-21 | FT-M09-5.2 | Must | As an admin, I want to create a fixed-order set of 4 audio sections and 30 MCQs, so that teachers' listening tests reach students. | FN-M09-5.2.1 … 5.2.8 |
| US-M09-22 | FT-M09-5.3 | Must | As a student, I want to list approved Audio KBAT sets by level and subject on a readable page, so that I can choose a test (DV-M09-08, DV-M09-09). | FN-M09-5.3.1 … 5.3.5 |
| US-M09-23 | FT-M09-5.3 | Should | As a student, I want to listen to each section and answer its questions, so that I can practise listening (provisional, L-3). | FN-M09-5.3.6 |
| US-M09-24 | FT-M09-6.1 | Must | As a logged-in user, I want to browse videos by category, subject and search with counts, so that I can find a lesson. | FN-M09-6.1.1 … 6.1.9 |
| US-M09-25 | FT-M09-6.2 | Must | As a visitor, I want a public video list that invites me to register, so that I can see what the platform offers. | FN-M09-6.2.1 … 6.2.4 |
| US-M09-26 | FT-M09-6.3 | Must | As a user, I want to watch a video with its details and related videos, so that I can keep learning. | FN-M09-6.3.1, 6.3.2, 6.3.3, 6.3.5, 6.3.6, 6.3.7, 6.3.8 |
| US-M09-27 | FT-M09-6.4 | Must | As a logged-in user, I want to share a video by pasting its link, with its platform detected, so that others can learn from it. | FN-M09-6.4.1 … 6.4.10, 6.6.1 |
| US-M09-28 | FT-M09-6.5 / 6.6 | Must | As the uploader or an admin, I want to edit or delete a video, so that wrong entries can be fixed. | FN-M09-6.3.4, 6.5.1 … 6.5.6, 6.6.2, 6.6.3 |
| US-M09-29 | FT-M09-7.1 | Must | As a user, I want the list of official messages for my scope with pinned ones first, so that I see important news. | FN-M09-7.1.1 … 7.1.8 |
| US-M09-30 | FT-M09-7.2 | Must | As a user, I want to read a message with its author, scope, date, body and video, so that I get the full message. | FN-M09-7.2.1, 7.2.2, 7.2.3, 7.2.4, 7.2.6, 7.2.9, 7.2.12 |
| US-M09-31 | FT-M09-7.2 | Should | As a user, I want to react to a message with 👍, ❤️ or 🙏, so that I can respond quickly. | FN-M09-7.2.5, 7.2.10 |
| US-M09-32 | FT-M09-7.2 | Should | As a user, I want to comment on a message, knowing comments are reviewed first, so that I can respond with words. | FN-M09-7.2.8, 7.2.11 |
| US-M09-33 | FT-M09-7.2 / 7.5 | Should | As a user, I want to share a public message by link or WhatsApp so that people without an account can read it. | FN-M09-7.2.7, 7.5.9 |
| US-M09-34 | FT-M09-7.3 | Must | As an admin or principal, I want to write a message with a rich editor, attachments, video, pin and public flags, and publish now, later or as a draft, so that I can inform my audience. | FN-M09-7.3.1 … 7.3.12 |
| US-M09-35 | FT-M09-7.4 | Should | As a writer, I want to see my own messages, so that I can follow them up. | FN-M09-7.4.1 … 7.4.4 |
| US-M09-36 | FT-M09-8.1 | Must | As any visitor, I want a guide per role with steps, features and FAQs that I can deep-link to, so that I learn how to use the platform. | FN-M09-8.1.1 … 8.1.9, 8.1.11 |
| US-M09-37 | FT-M09-8.1 | Must | As any visitor, I want to contact support by e-mail or WhatsApp from the guide, and as a guest to register from it, so that I can get help (DV-M09-14). | FN-M09-8.1.10, 8.1.12 |
| US-M09-38 | FT-M09-8.2 | Should | As a tuition-centre user, I want the guide at my own route, so that my menu works. | FN-M09-8.2.1, 8.2.2 |
| US-M09-39 | FT-M09-9.1 | Should | As an admin, I want to upload images to a private folder by clicking or dropping, so that I can use them in content. | FN-M09-9.1.1 … 9.1.4 |
| US-M09-40 | FT-M09-10.1 | Must | As a user, I want the content pages in my sidebar and drawer, so that I can reach them anywhere. | FN-M09-10.1.1, 10.1.2 |
| US-M09-41 | FT-M09-10.2 | Must | As an admin, I want the content admin pages in my sidebar and "Lagi" sheet, so that I can reach them. | FN-M09-10.2.1, 10.2.2 |
| US-M09-42 | FT-M09-10.3 | Must | As the owner, I want each page in the layout of its route and role, guests redirected where live requires login, and admin pages closed to non-admins, so that access matches live. | FN-M09-10.3.1, 10.3.2, 10.3.3 |
| US-M09-44 | FT-M09-7.5 | Must | As a visitor without an account, I want to read a public official message on its own page, share it and be invited to register, so that messages reach parents and the public. | FN-M09-7.5.1 … 7.5.9 |
| US-M09-43 | cross-cutting | Must | As a user on a phone, tablet or desktop, I want every M09 screen to fit my screen, so that I can use it anywhere. | All screen FNs |

### Acceptance criteria

Seed data and accounts are those of SRS §6.9 (mock clock 2026-09-25 15:40 +08:00, the project default). Default seed = live counts: 72 articles (13 featured, all published), 10 notes, 5 banners, 0 Audio KBAT sets, 2,260 videos, 3 perutusan, 0 screenshot files. Provisional fixtures (never in the default seed) are named where used. Accounts (canonical seed 1–11, M01): `admin@demo.test` (id 1, Admin Demo, profile school SK Demo 900002; video-form school empty, as live), `pelajar@demo.test` (id 2, student, SMK DEMO 900001), `pelajar2@demo.test` (id 3, student, no school), `pelajarmaju@demo.test` (id 4, student, 900004 SK Demo Bestari, M02 v1.16), `guru@demo.test` (id 5, teacher, SMK DEMO 900001).

**US-M09-01 — Admin article list**
- **AC-M09-01.1** Given I am the admin, when I open `/admin/articles`, then the header reads "Pengurusan Artikel" / "Urus artikel dan konten pendidikan", the tab title is "Pengurusan Artikel - Admin PRESTASIPLUS", "Jumlah: 72 artikel" is shown with "Tambah" → `/admin/articles/create`, and the table has 20 rows with the headers displayed "TAJUK", "KATEGORI", "TAHAP", "STATUS", "VIEWS", "TARIKH", "TINDAKAN".
- **AC-M09-01.2** Given the default list, when it loads, then the first row is #10 with the amber star (title "Featured"), "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit", "Oleh: Admin Demo", pill "Tips Belajar", "DARJAH_4", "Diterbitkan", "596", "22/02/2026"; rows 1–20 are ids 10–29; `?page=4` shows ids 70, 71, 72, 9, 1…8 (12 rows).
- **AC-M09-01.3** Given the filter card, when I choose "Motivasi" and click "Cari", then the URL has `category=MOTIVASI`, "Jumlah: 14 artikel", every row shows "Motivasi", and the select still shows "Motivasi"; `search=sifir` gives 2 rows; `published=1` 72; "Reset" returns to `/admin/articles` with default controls.
- **AC-M09-01.4** Given `?category=TIPS_BELAJAR` (21), when I follow the page-2 link, then the URL keeps `category=TIPS_BELAJAR`, the page shows 1 row (#8) and the pager links on page 2 keep the category (DV-M09-03).
- **AC-M09-01.5** Given `?published=0` or `?search=zzzqqq`, when the list loads, then it shows one row `fa-inbox` "Tiada artikel dijumpai.", "Jumlah: 0 artikel" and no pager.
- **AC-M09-01.6** Given the pager, when the width is ≥640px it shows "Showing 1 to 20 of 72 results" with page links 1–4; below 640px it shows "« Previous" (plain text on page 1) and "Next »".

**US-M09-02 — Row actions**
- **AC-M09-02.1** Given row #10, when I click `fa-eye` / `fa-edit`, then `/admin/articles/10` / `/admin/articles/10/edit` opens.
- **AC-M09-02.2** Given row #10, when I click `fa-trash`, then the native dialog "Adakah anda pasti mahu padam artikel ini?" appears; dismissing keeps the row and sends no request.
- **AC-M09-02.3** (INFERRED, provisional) Given the dialog, when I accept, then #10 is gone, "Jumlah: 71 artikel" and a success flash is shown.
- **AC-M09-02.4** Given `/admin/articles/9999`, `/admin/articles/9999/edit` or `/admin/articles/categories`, when I open it, then I land on `/admin/articles` with the red flash `fa-exclamation-circle` "Artikel tidak dijumpai.".

**US-M09-03 — Create article**
- **AC-M09-03.1** Given `/admin/articles/create`, when it loads, then the header reads "Tambah Artikel Baru" / "Cipta artikel pendidikan baharu", the tab title is "Tambah Artikel - Admin PRESTASIPLUS", and the form shows "Kembali ke Senarai", "Tajuk Artikel *" (placeholder "cth: 10 Tips Belajar Matematik"), "Ringkasan", "Kandungan *" (plain textarea, 15 rows, placeholder "Tulis kandungan artikel di sini..."), "URL Gambar Utama", "Kategori *" ("Pilih kategori" + 7), "Tahap Pendidikan" ("Semua" selected + "Darjah 1"…"Darjah 6"), unchecked "Terbitkan Sekarang" and "Artikel Featured", "Batal" and "Simpan Artikel".
- **AC-M09-03.2** Given the empty form, when I click "Simpan Artikel", then `title`, `content` and `category` report `valueMissing`, the browser bubble shows and no request is sent; with title and content filled only `category` is invalid.
- **AC-M09-03.3** Given any input, when I click "Batal", then `/admin/articles` opens without a dialog and nothing is stored.
- **AC-M09-03.4** (INFERRED, provisional) Given a valid form with "Terbitkan Sekarang" ticked and category "Berita", when I save, then `/admin/articles` shows a success flash, "Jumlah: 73 artikel", and the new article is first on `/artikel` (newest) and on the dashboard strip.
- **AC-M09-03.5** Given "Kandungan" contains `<h2>Tajuk</h2><p>Isi</p>`, when the article is published and opened on `/artikel/{slug}`, then the body renders an h2 "Tajuk" and a paragraph "Isi" (raw HTML typed by hand, as live; SEC-M09-01).
- **AC-M09-03.6** Given 375, 768 and 1280px, when the form loads, then "Batal" sits left of "Simpan Artikel" on one row, right-aligned, and the fields are one column below `md`.

**US-M09-04 — Edit article**
- **AC-M09-04.1** Given `/admin/articles/10/edit`, when it loads, then the header reads "Edit Artikel" / "Kemaskini artikel", tab "Edit Artikel - Admin PRESTASIPLUS", title, excerpt and raw-HTML content are preloaded, "Kategori" shows "Tips Belajar" with no "Pilih kategori" option, "Tahap Pendidikan" shows "Darjah 4", both checkboxes are ticked, and `checkValidity()` is true.
- **AC-M09-04.2** Given `/admin/articles/11/edit`, when it loads, then "Darjah 5" is selected and "Artikel Featured" is unticked.
- **AC-M09-04.3** Given changed fields, when I click "Batal", then `/admin/articles` opens and reopening the edit page shows the original values.
- **AC-M09-04.4** (INFERRED, provisional) Given #11, when I tick "Artikel Featured" and click "Kemaskini Artikel", then the list shows a success flash and the star before #11; `/artikel` shows "HOT" on its card.

**US-M09-05 — Admin preview**
- **AC-M09-05.1** Given `/admin/articles/10`, when it loads, then the header is the title / "Paparan artikel", tab "Lihat Artikel - Admin PRESTASIPLUS", and the card shows the h1, "Admin Demo", "22 Feb 2026", "596 tontonan", "Diterbitkan", `fa-star` "Featured", the excerpt, and "Edit Artikel" → `/admin/articles/10/edit`.
- **AC-M09-05.2** Given the preview, when it loads, then the body text starts with the literal characters "<h2>Apa Itu Teknik Pomodoro?</h2><p>" (escaped, not rendered) (DV-M09-04 rejected).
- **AC-M09-05.3** Given 375px, when the preview loads, then `document.documentElement.scrollWidth` ≤ the viewport width and the escaped body wraps inside the card (DV-M09-05).
- **AC-M09-05.4** Given `/admin/articles/11`, when it loads, then no "Featured" pill is shown and the author is "Cikgu Demo 01".
- **AC-M09-05.5** Given #10 has 596 views, when I open `/admin/articles/10` twice, then `/artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit` then shows 597 "Pembaca" (the preview added nothing; the detail open added 1).

**US-M09-06 — Browse articles**
- **AC-M09-06.1** Given I am logged in (any role, incl. admin), when I open `/artikel`, then it renders in the user shell with header "Artikel" / "Tips belajar, berita pendidikan, motivasi dan panduan" and tab "PRESTASIPLUS - Platform Latih Tubi Nasional".
- **AC-M09-06.2** Given the grid, when it loads, then it has 18 cards, the first 5 in order are "AI Ini Apa Sebenarnya? Jom Fahami Bersama!", "5 Tips Belajar Matematik yang Menyeronokkan", "Cara Baca Buku Cerita dalam Bahasa Inggeris", "Sains Menyeronokkan: Eksperimen Mudah di Rumah", "Panduan Ibu Bapa: Jadual Belajar untuk Anak"; the first card shows chip "Tips Belajar", author initial "C" + "Cikgu Demo 01", "👁️ 310" and "7 bulan yang lepas"; the second shows `fa-star` "HOT".
- **AC-M09-06.3** Given the pills, when I click "Berita", then the URL is `?category=BERITA`, the pill is active (gradient, white text), 7 cards show, the first two being "Perpustakaan Bergerak Sampai ke Pedalaman Sabah" and "Pertandingan Menulis Karangan Kreatif Kebangsaan 2026", and the hot section is not shown.
- **AC-M09-06.4** Given I search "sifir", when the list loads, then 2 cards show, the hot section is hidden, and every category pill link contains `search=sifir` ("Semua" → `/artikel?search=sifir`).
- **AC-M09-06.5** Given `?category=TIPS_BELAJAR`, when I go to page 2, then the URL keeps the category, 3 cards show (first "Rahsia Pelajar Cemerlang: Ulangkaji Sebelum Tidur") and the "« Previous" link is `?category=TIPS_BELAJAR&page=1`.
- **AC-M09-06.6** Given `?search=zzzqqq`, when the list loads, then 🔍 "Tiada Artikel Dijumpai", "Cuba ubah carian atau pilih kategori lain." and "Lihat Semua Artikel" → `/artikel` are shown.
- **AC-M09-06.7** Given the grid at 1280px, when it loads, then it has 6 columns and no card meta item (author, views, relative date) breaks inside itself — "7 bulan yang lepas" stays on one line (DV-M09-12).

**US-M09-07 — Artikel Paling Hangat**
- **AC-M09-07.1** Given `/artikel` with no search or category (page 1 or 4), when it loads, then "Artikel Paling Hangat" shows 6 cards; each "PILIHAN" card is a featured article and each "POPULAR" card is one of the 10 most-viewed non-featured published articles (BR-M09-05, INFERRED pool).
- **AC-M09-07.2** Given two loads with different random seeds (`mock.setRandomSeed`), when compared, then the two sets of 6 differ (random per load, OBSERVED).
- **AC-M09-07.3** Given `?category=…` or `?search=…`, when the list loads, then the section is absent.

**US-M09-08 — Public article list (guest)**
- **AC-M09-08.1** Given no session, when I open `/artikel`, then the public layout loads (tab "Artikel — PRESTASIPLUS") with the top bar "📰" "Artikel", "Log Masuk" → `/login`, "Daftar Percuma" → `/register`, no user shell, chip "Terkini & Menarik", h1 "Artikel Pilihan" and the line "Tips belajar, berita pendidikan, motivasi dan panduan untuk pelajar Malaysia!".
- **AC-M09-08.2** Given the guest page, when it loads, then it has the hot section (6 cards), search placeholder "Cari artikel menarik...", "Pilih Kategori:" with "Semua" and "✨ Tips Belajar" … "✨ Umum", the same 18-card grid (cards with `fa-clock`) and pager.
- **AC-M09-08.3** Given the guest page, when I scroll to the end, then "Nak Baca Lebih Banyak?", the CTA text, "Daftar Percuma Sekarang" → `/register`, "100% Percuma • Tiada Kad Kredit Diperlukan", "© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd. Hak Cipta Terpelihara." and the links "Utama", "Artikel", "Video", "Log Masuk", "Daftar" are shown.

**US-M09-09 — Article detail**
- **AC-M09-09.1** Given `/artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit`, when it loads, then the header is the title / "Artikel", the breadcrumb is "Dashboard" → `/dashboard`, "Artikel" → `/artikel`, "Teknik Pomodoro: Belajar 25 Minit, Rehat..." and the chips "Tips Belajar", "Darjah 4", `fa-star` "Pilihan" are shown.
- **AC-M09-09.2** Given the author card, when it loads, then it shows "A", "Admin Demo", "24 Dec 2025", "•", "9 bulan yang lepas", "👁️" "597" "Pembaca" (596 + this open) and "❤️" "6" "Suka", and no like button exists on the page.
- **AC-M09-09.3** Given the body, when it loads, then the h2 headings (first "Apa Itu Teknik Pomodoro?"), the paragraphs and the 5 list items in order ("Pilih satu tugasan atau subjek untuk belajar", "Set timer 25 minit — FOKUS penuh!", "Bila timer berbunyi, rehat 5 minit", "Ulang 4 kali, kemudian rehat panjang 15-30 minit", "Catat berapa "pomodoro" kamu siap hari ini") are rendered as HTML; the list parent type (`ol` / `ul`) is not asserted (not recorded in the inventory; decided from the screenshot at build).
- **AC-M09-09.4** Given the share card, when it loads, then "Kongsi Artikel Ini 🎉" shows WhatsApp `https://wa.me/?text=…`, Facebook `https://www.facebook.com/sharer/sharer.php?u=…` and Twitter `https://twitter.com/intent/tweet?text=…&url=…` links; clicking `fa-link` writes the page URL to the clipboard and shows "Link Disalin!" which disappears after 2 s.
- **AC-M09-09.5** Given "Artikel Berkaitan", when it loads, then it lists "AI Ini Apa Sebenarnya? Jom Fahami Bersama!", "5 Tips Belajar Matematik yang Menyeronokkan", "Cara Baca Buku Cerita dalam Bahasa Inggeris" with "👁️ 310", "👁️ 543", "👁️ 351".
- **AC-M09-09.6** Given ≥1024px, when the page loads, then the aside "Artikel Terkini" lists the same 5 articles as the dashboard strip and "Lihat Semua Artikel" → `/artikel`; below 1024px the aside is not shown.
- **AC-M09-09.7** Given each open of a detail page, when I reload it, then "Pembaca" rises by 1 per open.

**US-M09-10 — 404 and guest detail**
- **AC-M09-10.1** Given `/artikel/tiada-slug-zzz`, when it loads, then the standalone 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/` and "Mula Latihan" → `/practice`.
- **AC-M09-10.2** (INFERRED, provisional, L-7) Given no session, when I open an article from the public list, then the detail content (title, chips, author card, body, share card) opens inside the public layout and "Pembaca" rises by 1.

**US-M09-11 — Feeds**
- **AC-M09-11.1** Given the seed, when an admin opens `/dashboard` (M05), then "📚 Artikel Untuk Kamu" and "Artikel Terkini" list the 5 articles of AC-M09-06.2 in the same order, read from the M09 store.
- **AC-M09-11.2** (INFERRED, provisional) Given `guru@demo.test` submits an article through M10 `/guru/artikel` with a YouTube link and one PDF attachment, when the admin opens `/admin/articles`, then the article is listed as unpublished (not on `/artikel`); when the admin ticks "Terbitkan Sekarang" on S3 and saves, then it appears first on `/artikel` with the teacher's name as author, and its YouTube link and attachment are kept in the store (not shown on S15/S16, as live).

**US-M09-12 — Note list**
- **AC-M09-12.1** Given `/admin/notes`, when it loads, then the header reads "Pengurusan Nota" / "Urus nota pembelajaran dan sumber belajar", "Jumlah: 10 nota", "Tambah Nota" → `/admin/notes/create`, 10 rows in id order and no pager; row 1 = "Sifir 1 hingga 12 — Carta Lengkap", "Oleh: Admin Demo", "MATEMATIK", "FORMULA", "DARJAH 2", "Diterbitkan", "0 tontonan", "0 muat turun".
- **AC-M09-12.2** Given the filter, when I search "sifir" → 1 row; `subject=matematik` → "Jumlah: 3 nota"; the selects keep their values; "Reset" → `/admin/notes`.
- **AC-M09-12.3** Given `note_type=summary` ("Ringkasan"), when I click "Cari", then the 5 RINGKASAN notes are listed ("Jumlah: 5 nota"); "Nota Penuh" → the 2 LENGKAP notes; "Mind Map", "Flashcard", "Cheat Sheet" → "Tiada nota dijumpai." and "Jumlah: 0 nota" (DV-M09-06).
- **AC-M09-12.4** Given `/admin/notes/9999`, when I open it, then `/admin/notes` loads with no flash.

**US-M09-13 — Note row actions**
- **AC-M09-13.1** Given row 1, when I click `fa-eye` / `fa-edit`, then `/admin/notes/1` / `/admin/notes/1/edit` opens (the edit form, not an error page).
- **AC-M09-13.2** Given `fa-trash`, when I click it, then "Adakah anda pasti mahu padam nota ini?" appears; dismiss → nothing; accept (INFERRED, provisional) → the row is gone and "Jumlah: 9 nota".

**US-M09-14 — Create and edit note (DV-M09-01)**
- **AC-M09-14.1** Given `/admin/notes/create`, when it loads, then no "Ralat Pelayan" page is shown; the form (PROPOSED COPY) shows "Tambah Nota" / "Cipta nota baharu", "Kembali ke Senarai", "Tajuk *", "Ringkasan", "Kandungan *", "Subjek *" (5 subjects), "Jenis *" ("FORMULA", "RINGKASAN", "LENGKAP", "TIPS_TRICKS"), "Tahap *" ("Darjah 1"…"Darjah 6"), "Terbitkan Sekarang", "Batal", "Simpan Nota".
- **AC-M09-14.2** Given the empty create form, when I click "Simpan Nota", then `title`, `content`, `subject`, `note_type`, `grade` report `valueMissing` and no request is sent.
- **AC-M09-14.3** (INFERRED, provisional) Given a valid form (Sains, RINGKASAN, Darjah 3, published), when I save, then `/admin/notes` shows a success flash, "Jumlah: 11 nota" and the new row "SAINS" "RINGKASAN" "DARJAH 3" "Diterbitkan"; `note_type=summary` now lists 6.
- **AC-M09-14.4** Given `/admin/notes/1/edit` (also via "Edit Nota" on `/admin/notes/1`), when it loads, then "Edit Nota" / "Kemaskini nota" and the preloaded values of note 1 (title, summary, content, Matematik, FORMULA, Darjah 2, published) are shown with "Kemaskini Nota"; "Batal" → `/admin/notes`.

**US-M09-15 — Note preview**
- **AC-M09-15.1** Given `/admin/notes/1`, when it loads, then the header is "Sifir 1 hingga 12 — Carta Lengkap" / "Paparan nota", tab "Lihat Nota - Admin PRESTASIPLUS", and the card shows "Admin Demo", "06 Feb 2026", "0 tontonan", "0 muat turun", "Diterbitkan", "Carta sifir lengkap dari 1 hingga 12 untuk hafalan mudah.", "Subjek" "MATEMATIK", "Tahap" "DARJAH 2", "Jenis" "FORMULA".
- **AC-M09-15.2** Given the body, when it loads, then it shows the literal escaped HTML starting "<h2>Sifir 1 hingga 12</h2>" wrapped inside the card at 375px (no page scroll).
- **AC-M09-15.3** Given the user portal, when I look for notes, then no route or link to a notes reader exists (`/nota` → 404).

**US-M09-16 — Banner list**
- **AC-M09-16.1** Given `/admin/banners`, when it loads, then the header reads "Pengurusan Banner" / "Urus banner promosi dan pengumuman", "Jumlah: 5 banner", "Tambah", no filter or pager, and headers "#", "TAJUK", "JENIS", "SASARAN", "SUSUNAN", "MULA", "TAMAT", "AKTIF?", "TINDAKAN".
- **AC-M09-16.2** Given the rows, when they load, then in order: 1 "HERO" "ALL" "Selamat Datang ke PRESTASIPLUS"; 2 "FEATURE" "STUDENT" "2,000+ Soalan Latihan Tersedia!"; 3 "PROMOTIONAL" "STUDENT" "Cabaran Mingguan: Siapa Paling Rajin?"; 4 "ANNOUNCEMENT" "ALL" "Tips untuk Ibu Bapa: Bimbing Anak Belajar"; 5 "FEATURE" "STUDENT" "Kumpul Badge & Tunjukkan Kehebatan!"; each with the description cut to 50 characters + "...", "01/01/2026", "31/12/2026", "Aktif", edit and delete icons and no view icon.
- **AC-M09-16.3** Given `fa-trash`, when I click it, then "Adakah anda pasti mahu padam banner ini?" appears; dismiss → nothing; accept (INFERRED, provisional) → "Jumlah: 4 banner" and the dashboard carousel shows "{n} / 4".
- **AC-M09-16.4** Given `/admin/banners/99/edit`, when I open it, then `/admin/banners` loads with the red flash "Banner tidak dijumpai.".

**US-M09-17 — Create banner**
- **AC-M09-17.1** Given `/admin/banners/create`, when it loads, then the header reads "Tambah Banner Baru" / "Cipta banner promosi atau pengumuman" and the fields of FN-M09-4.2.3…4.2.7 show with their placeholders, hints and defaults ("Tiada Pautan", "Semua", order 0, "Banner Aktif" ticked).
- **AC-M09-17.2** Given "Jenis Pautan", when I choose "Pautan Luar", then the URL field (placeholder "https://example.com") appears; when I type a URL and switch back to "Tiada Pautan", the field hides and, when I choose "Pautan Luar" again, the typed URL is still there; "Subjek", "Kuiz" and "Artikel" show no extra field.
- **AC-M09-17.3** Given the empty form, when I click "Simpan Banner", then `title` and `banner_type` report `valueMissing` and no request is sent.
- **AC-M09-17.4** (INFERRED, provisional) Given a valid banner (type "Pengumuman", audience "Semua", order 6, today in range, active), when I save, then `/admin/banners` shows a success flash and a sixth row "ANNOUNCEMENT" "ALL" "6".

**US-M09-18 — Edit banner (DV-M09-07)**
- **AC-M09-18.1** Given `/admin/banners/1/edit`, when it loads, then the header reads "Edit Banner" / "Kemaskini maklumat banner", the text fields, order 1, dates 2026-01-01 / 2026-12-31 and "Banner Aktif" are preloaded, "Jenis Banner" shows "Hero", "Jenis Pautan" "Tiada Pautan", "Sasaran Penonton" "Semua", and `checkValidity()` is true.
- **AC-M09-18.2** Given `/admin/banners/2/edit` (FEATURE, STUDENT), when it loads, then "Jenis Banner" shows a selected option "FEATURE" (only on this form) and "Sasaran Penonton" shows "Pelajar".
- **AC-M09-18.3** Given banner 2, when I click "Kemaskini Banner" without changes, then the request carries `bannerType: "FEATURE"` and `targetAudience: "STUDENT"`; (provisional) the list still shows "FEATURE" "STUDENT" and the dashboard badge stays "FEATURE".
- **AC-M09-18.4** Given `/admin/banners/1/edit`, when I click "Batal", then `/admin/banners` opens and nothing changes.

**US-M09-19 — Banner delivery**
- **AC-M09-19.1** Given the seed, when the admin opens `/dashboard`, then the carousel counter shows "1 / 5" and the slides follow display order 1…5 with the stored type badges.
- **AC-M09-19.2** (INFERRED, provisional) Given `pelajar@demo.test`, when the dashboard loads, then all 5 banners show (ALL and STUDENT); given `guru@demo.test`, only the 2 ALL banners show ("1 / 2").
- **AC-M09-19.3** (INFERRED, provisional) Given banner 4 set inactive or its end date before today, when the dashboard loads, then it is not shown.

**US-M09-20 — Admin Audio KBAT list**
- **AC-M09-20.1** Given `/admin/audio-kbat`, when it loads, then the shell header reads "Set Audio KBAT" with no subtitle (not "Dashboard" / "Selamat datang, Admin", DV-M09-08) and the tab title is "Set Audio KBAT".
- **AC-M09-20.2** Given the page, when it loads, then it shows "Ujian Mendengar", h1 "Set Audio KBAT", "Senarai set soalan audio fixed sequence, bukan rawak.", "Template XLSX" → `/admin/audio-kbat/template`, "Template Word" → `/admin/audio-kbat/template-word`, "Cipta Set" → create, the guide box with its two paragraphs, and the stat cards "Set" 0, "Approved" 0, "Draft/Pending" 0, "Soalan" 0.
- **AC-M09-20.3** Given the filter, when it loads, then "Semua Tahap" + 11 levels, "Semua Subjek" + 31 subjects starting "Bahasa Arab", "Bahasa Cina", "Bahasa Inggeris" (A–Z), "Semua Status" + "Draft", "Pending Review", "Approved", "Archived", placeholder "Cari tajuk/sumber...", "Tapis"; choosing values and "Tapis" keeps them and still shows "Belum ada set Audio KBAT.".
- **AC-M09-20.4** (INFERRED, provisional) Given the fixture `seedAudioKbatSet()` (one approved and one draft set), when the page loads, then "Set" 2, "Approved" 1, "Draft/Pending" 1, "Soalan" 60 and two rows with title, level, subject and status label show.

**US-M09-21 — Create Audio KBAT set**
- **AC-M09-21.1** Given `/admin/audio-kbat/create`, when it loads, then the header reads "Cipta Set Audio KBAT" (no subtitle), "Kembali" → `/admin/audio-kbat`, the intro, the box "Apa yang cikgu perlu sediakan?" and "Maklumat Set" with "Status" defaulting to "Approved".
- **AC-M09-21.2** Given the section cards, when they load, then 4 cards "Bahagian 1 · Soalan 1-8" … "Bahagian 4 · Soalan 25-30" show with "Tajuk Audio" prefilled "Audio 1"…"Audio 4" and a non-required file input accepting `.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*`.
- **AC-M09-21.3** Given the question blocks, when they load, then 30 blocks "Soalan 1"…"Soalan 30" follow their sections (8, 8, 8, 6), each with pill "KBAT Audio", "Jawapan" default "A", "Markah" 1 (min 1, max 20), "KBAT Level" 3 (min 1, max 5), "DSKP SP ID" placeholder "Optional".
- **AC-M09-21.4** Given the empty form, when I click "Simpan Set Audio KBAT", then 153 fields are invalid and no request is sent; there is no "Batal" button.
- **AC-M09-21.5** Given 375px, when I scroll, then "Simpan Set Audio KBAT" stays visible at the bottom right (sticky) and the page does not scroll sideways.
- **AC-M09-21.6** (INFERRED, provisional) Given a complete form with status "Approved", when I save, then `/admin/audio-kbat` shows a success flash, "Set" 1, "Approved" 1, "Soalan" 30 and one row.

**US-M09-22 — Student Audio KBAT list**
- **AC-M09-22.1** Given `/audio-kbat` as `pelajar@demo.test`, when it loads, then the shell header reads "Audio KBAT" with no subtitle (not "Dashboard", not "Selamat datang kembali"; DV-M09-08) and the tab title is "Audio KBAT".
- **AC-M09-22.2** Given the hero, when it loads, then its background is the dark gradient (computed `background-image` contains a gradient; not transparent), the paragraph "Dengar audio mengikut bahagian …" is amber-100 and the h1 "Audio KBAT" is white, inherited from the container's `text-white` (DV-M09-09).
- **AC-M09-22.3** Given the filter, when it loads, then "Tapis" has a slate-900 background with white text (visible) and filtering by level and subject keeps the values and shows "Belum ada set Audio KBAT yang approved.".
- **AC-M09-22.4** (INFERRED, provisional) Given `seedAudioKbatSet()`, when the page loads, then only the approved set is listed.

**US-M09-23 — Audio KBAT player (provisional, L-3)**
- **AC-M09-23.1** (provisional) Given the approved fixture set, when I open it from `/audio-kbat`, then a page shows its title and 4 sections, each with an audio player and the questions of its range (8, 8, 8, 6) shown together with options A–D, and a "Hantar" button (PROPOSED COPY); the tab title is "Audio KBAT", the h1 is the set title and "Kembali" returns to `/audio-kbat`; a section without a file shows "Audio tidak tersedia." (PROPOSED COPY); an unknown or non-approved set id shows the standalone 404 page.
- **AC-M09-23.2** (provisional) Given answers, when I click "Hantar", then only the answered questions are sent, a score (sum of marks of correct answers out of the total marks) is recorded for the user, "Skor anda {n} / {total}" is shown (PROPOSED COPY) and the form is locked; no further result layout is asserted.

**US-M09-24 — Browse videos**
- **AC-M09-24.1** Given `/video` logged in, when it loads, then the header reads "Video Pembelajaran" / "Tonton video motivasi, tutorial dan tips peperiksaan", tab "Video Pembelajaran - PRESTASIPLUS", search "Cari video...", pills "Semua (2260)", "Motivasi (3)", "Tutorial (12)", "Tips SPM (3)", "Ceramah (2242)", "Lain-lain (0)", subject pills "Matematik (865)", "Sejarah (97)", "Matematik Tambahan (420)", "Fizik (779)", "Kimia (96)" and "Tambah Video" → `/video/tambah`.
- **AC-M09-24.2** Given the grid, when it loads, then 24 cards show in the live order 2224, 64, 433, 825, 1020, 19, 2225, 65, 434, 827, 1021, 2226, 66, 435, 852, 1022, 2227, 67, 436, 877, 1023, 2228, 68, 437; card 1 = "YouTube", "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah", "A", "Admin Demo", "Admin" (displayed), "134 tontonan" (capture 2026-10-02; discovery read 121), "6 bulan yang lepas", a real `img.youtube.com` thumbnail; the pager shows "Showing 1 to 24 of 2260 results" and 1…10 … 94 95.
- **AC-M09-24.3** Given "Lain-lain (0)", when I click it, then the URL and the page do not change and the pill has no `href="#"` (DV-M09-10); `?category=lain-lain` typed directly shows "Tiada Video Dijumpai".
- **AC-M09-24.4** Given `?category=motivasi`, when it loads, then 3 cards show (first "Kenapa Sejarah Penting Untuk Masa Depan Kita", "Semangat Belajar - Kunci Kejayaan Pelajar"), the pill is active (red→orange gradient) and the only subject pill is "Sejarah (1)" → `?category=motivasi&subject=5`.
- **AC-M09-24.5** Given `?subject=5`, when it loads, then the category pills read "Semua (97)", "Motivasi (1)", "Tutorial (12)", "Tips SPM (3)", "Ceramah (81)", "Lain-lain (0)", their links are built subject first (`?subject=5&category=motivasi`, …), the five subject pills still show with their full counts (Matematik (865), Sejarah (97), Matematik Tambahan (420), Fizik (779), Kimia (96)) and no special style on Sejarah, "Reset Subjek" → `/video` is shown, and the grid lists 2224, 2225, … 2247 ("Showing 1 to 24 of 97 results").
- **AC-M09-24.6** Given `?search=zzzqqq`, when it loads, then "Semua (0)" and every category pill shows (0) without navigation (no `href`; live `href="#"`), and 🎬 "Tiada Video Dijumpai", "Cuba ubah carian atau pilih kategori lain.", "Lihat Semua Video" → `/video` are shown.
- **AC-M09-24.7** Given `?page=95`, when it loads, then 4 cards show, the first two being 2220 and 2221 (Kimia), and "« Previous" links to `?page=94`; any pager link keeps `subject`, `category` and `search`.

**US-M09-25 — Public video list**
- **AC-M09-25.1** Given no session, when I open `/video`, then the public layout loads (tab "Video Pembelajaran — PRESTASIPLUS", "🎬" "Video", "Log Masuk", "Daftar Percuma", chip "VIDEO PEMBELAJARAN", h1 "Tonton & Fahami"), with the same pills and 24 cards and **no** "Tambah Video".
- **AC-M09-25.2** Given the guest page, when I scroll to the end, then "Nak Tonton Lebih Banyak?", its CTA text, "Daftar Percuma Sekarang" → `/register` and the footer are shown.

**US-M09-26 — Watch video**
- **AC-M09-26.1** Given `/video/2224`, when it loads, then the header reads "Video" / "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah", the tab "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah - Video PRESTASIPLUS", "Semua Video" → `/video`, a YouTube embed iframe (`https://www.youtube.com/embed/iqtUCV6AHuI`), "134 tontonan" (the count before this open; capture 2026-10-02) · "03 Mar 2026", chips "YouTube", "Ceramah", "Sejarah", uploader "A" "Admin Demo" "admin" and the description; back on `/video` the card shows "135 tontonan"; opening `/video/2224/edit` adds no view. A guest opening `/video/2224` sees the same content in the public layout without section label or CTA and without "Edit" / "Padam" (INFERRED, DN-M09-01).
- **AC-M09-26.2** Given "Video Berkaitan", when it loads, then 6 Sejarah videos show with the highest ids first (2260, 2259, 2258, …), each "Admin Demo · {n} tontonan", and #2224 itself is not listed.
- **AC-M09-26.3** Given `/video/999999`, when it loads, then the 404 page of AC-M09-10.1 shows.

**US-M09-27 — Add video**
- **AC-M09-27.1** Given `/video/tambah`, when it loads, then the header reads "Tambah Video" / "Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain", h1 "Tambah Video Baru", "Paste sahaja link video — kami akan buat selebihnya", the fields of FN-M09-6.4.3…6.4.6, the uploader strip "A", "Admin Demo · Admin" (displayed), "Nama anda akan dipaparkan bersama video", and "Terbitkan Video" left of "Batal" on one row at every width.
- **AC-M09-27.2** Given I type `https://youtu.be/abc123XYZ00`, when 500 ms pass, then "Platform dikesan: YouTube" and the thumbnail `https://img.youtube.com/vi/abc123XYZ00/hqdefault.jpg` show; a `https://vimeo.com/123` URL shows "Platform dikesan: Vimeo" and no thumbnail; `https://example.com/x` shows nothing.
- **AC-M09-27.3** Given the admin (live: "Tiada sekolah"), when the form loads, then "Sekolah Saya" / "Tiada sekolah" is disabled and clicking it keeps "Semua Pengguna" checked; (INFERRED, provisional) as `guru@demo.test`, whose video-form school is seeded to SMK DEMO (900001), "Sekolah Saya" shows "SMK DEMO" and can be chosen.
- **AC-M09-27.4** Given the empty form, when I click "Terbitkan Video", then `video_url`, `title` and `category` report `valueMissing` and no request is sent; "Batal" → `/video`.
- **AC-M09-27.5** (INFERRED, provisional) Given a valid YouTube video as `pelajar@demo.test` (Tutorial, Matematik, global), when I publish, then `/video` shows a success flash, "Semua (2261)", "Tutorial (13)", and the new card is first with "Pelajar Demo" and "0 tontonan".

**US-M09-28 — Edit and delete video**
- **AC-M09-28.1** Given `/video/2224` as admin, when it loads, then "Edit" → `/video/2224/edit` and "Padam" show; "Padam" asks "Padam video ini?"; dismiss → nothing.
- **AC-M09-28.2** Given `/video/2224/edit`, when it loads, then the header reads "Edit Video" / the title, h1 "Edit Video", "Kemaskini maklumat video", the preloaded URL with "Platform dikesan: Youtube" and thumbnail, "Penerangan" and "Subjek" labels, category "Ceramah" (no placeholder option), subject "Sejarah", "Semua Pengguna" checked (the visibility cards show no sub-lines on this screen, as in `video-edit.png`), "Simpan Perubahan" left of "Batal" → `/video/2224`.
- **AC-M09-28.3** (INFERRED, provisional) Given a changed title, when I click "Simpan Perubahan", then `/video/2224` shows the new title and a success flash.
- **AC-M09-28.4** (INFERRED, provisional) Given "Padam" accepted, when the request completes, then `/video` shows a success flash and "Semua (2259)".
- **AC-M09-28.5** (INFERRED, provisional) Given `pelajar@demo.test` on `/video/2224` (uploaded by the admin), when it loads, then no "Edit" or "Padam" shows and `/video/2224/edit` redirects to the session landing page (in-place 403 only if the landing page is a video route; SRS §9, DN-M09-02) and the API answers 403; on a video they uploaded both show.

**US-M09-29 — Perutusan list**
- **AC-M09-29.1** Given `/perutusan` as admin, when it loads, then the header reads "Perutusan" / "Kata-kata aluan dan maklumat penting dari pihak pengurusan", the dark hero "Perutusan Rasmi" / "Maklumat & berita dari pihak pengurusan", "Tulis Perutusan" → `/perutusan/tulis`, "Perutusan Saya" → `/perutusan/saya`.
- **AC-M09-29.2** Given the list, when it loads, then 3 cards show in the order #4, #2, #3; #4 and #2 have the amber left border and "Disematkan"; each shows initials, name, "PENGETUA", `fa-school` "Sekolah", "6 bulan yang lepas", title, a plain-text excerpt ending "...", "Baca selanjutnya" → `/perutusan/{id}`.
- **AC-M09-29.3** Given the card footers, when they load, then #4 shows "Video disertakan", "👍 1", "0 komen", "3 baca"; #2 no reaction, "0 komen", "4 baca"; #3 "Video disertakan", "❤️ 5", "0 komen", "55 baca".
- **AC-M09-29.4** Given 375px, when the list loads, then the pinned marker shows the icon only (text "Disematkan" hidden).
- **AC-M09-29.5** (INFERRED, provisional) Given `pelajar@demo.test` or `guru@demo.test` (both SMK DEMO, 900001), when the list loads, then only #2 (their school) and national posts are shown; given `pelajarmaju@demo.test` (900004 SK Demo Bestari, a school with no post), neither #2 nor #3 is shown (only national posts); #3 (900002) is shown to its author `suhaimi@demo.test` and the admin.

**US-M09-30 — Perutusan detail**
- **AC-M09-30.1** Given `/perutusan/4`, when it loads, then the header reads "Perutusan" / "Sekolah", the tab title is the post title, "Kembali ke senarai" → `/perutusan`, and the dark author header shows "AD", the author name, "Pengetua", "Sekolah", "17 Mar 2026, 11:23PM", `fa-globe` "Awam", "Disematkan".
- **AC-M09-30.2** Given the body, when it loads, then the rich HTML (e.g. "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ", "Selamat Hari Raya Aidilfitri, Maaf Zahir dan Batin") renders and a YouTube embed follows; "3 baca" and "0 komen" are shown.
- **AC-M09-30.3** Given `/perutusan/999`, when it loads, then the 404 page shows.
- **AC-M09-30.4** Given the admin opens `/perutusan/4` (not its author) and a guest opens `/perutusan/awam/4`, when the list reloads, then #4 still shows "3 baca" (OBSERVED); (INFERRED, provisional) given `pelajar@demo.test` opens `/perutusan/2` twice, then #2 shows "5 baca" (one read per non-admin, non-author user).

**US-M09-31 — React**
- **AC-M09-31.1** Given `/perutusan/4`, when it loads, then three buttons "👍 Suka 1", "❤️ Cinta", "🙏 Terima Kasih" show.
- **AC-M09-31.2** (INFERRED, provisional) Given `pelajar@demo.test`, when I click "❤️ Cinta", then the page reloads with "❤️ Cinta 1"; clicking it again returns to "❤️ Cinta".

**US-M09-32 — Comment**
- **AC-M09-32.1** Given `/perutusan/4`, when it loads, then "Komen", the textarea (placeholder "Tulis komen anda...", required, maxlength 1000), "Komen akan disemak sebelum dipaparkan", "Hantar" and "Belum ada komen" show; an empty submit is blocked by the native bubble.
- **AC-M09-32.2** (INFERRED, provisional) Given a comment "Terima kasih cikgu", when I click "Hantar", then a flash shows, "Belum ada komen" stays and the list still shows "0 komen" (pending moderation).

**US-M09-33 — Share a public post**
- **AC-M09-33.1** Given `/perutusan/4` (public), when it loads, then "Pautan Awam (boleh kongsi tanpa login)" shows a read-only input `https://prestasiplus.my/perutusan/awam/4` (clicking selects it and copies it) and "Kongsi ke WhatsApp" → `https://wa.me/?text=` + the encoded "{title} — Baca di PrestasiPlus: {public URL}".
- **AC-M09-33.2** Given `/perutusan/2` (not public), when it loads, then no public-link box shows.
- **AC-M09-33.3** Given no session, when I open `/perutusan/awam/4`, then the S28 page of US-M09-44 opens without login (OBSERVED) and #4 still shows "3 baca"; (INFERRED) `/perutusan/awam/2` (not public) → the 404 page.

**US-M09-34 — Write perutusan**
- **AC-M09-34.1** Given `/perutusan/tulis` as admin, when it loads, then the header reads "Tulis Perutusan" / "Sampaikan kata-kata aluan atau maklumat penting", "Skop Perutusan" "Seluruh Malaysia (Kebangsaan)", "Tajuk Perutusan" (placeholder "cth: Perutusan Pengetua Semester 2 2026"), the Quill editor (placeholder "Tulis perutusan anda di sini...") and "HTML".
- **AC-M09-34.2** Given the toolbar, when I open the pickers, then the header picker offers H2, H3, Normal; the colour picker 35 swatches; the align picker left, center, right, justify; bold, italic, underline, ordered list, bullet list, link and clean buttons exist.
- **AC-M09-34.3** Given text typed in the editor, when I click "HTML", then a textarea shows the HTML; editing it and clicking "HTML" again shows the edited content in the editor.
- **AC-M09-34.4** Given the attachments, when they load, then "Gambar (maks 2MB setiap satu)" (accept `image/*`, "Klik untuk muat naik gambar", "JPG, PNG, GIF - maks 2MB"), "Dokumen PDF (maks 5MB setiap satu)" (accept `.pdf`, "Klik untuk muat naik PDF", "PDF sahaja - maks 5MB"), "Pautan Video YouTube (Pilihan)", unchecked "Sematkan di atas (maks 2)" and "Jadikan Awam (boleh dibaca tanpa login)" show.
- **AC-M09-34.5** Given "Status Penerbitan", when it loads, then "Terbit Sekarang" / "Terus dipaparkan" is selected; choosing "Jadualkan" shows "Tarikh & Masa Penerbitan" (datetime-local, not required); choosing "Draf" hides it.
- **AC-M09-34.6** Given the form with only a title, when I check validity, then it is valid; with an empty title the native bubble blocks the submit; "Batal" → `/perutusan`; "Batal" and "Hantar Perutusan" share one row at 375/768/1280.
- **AC-M09-34.7** (INFERRED, provisional) Given title "Perutusan Ujian", body text and "Terbit Sekarang", when I click "Hantar Perutusan", then `/perutusan` shows a flash and the post (scope national) after the pinned posts, first among the unpinned.
- **AC-M09-34.8** (INFERRED, provisional) Given "Jadualkan" at 2026-09-26 09:00, when submitted, then the post is absent from `/perutusan` until the mock clock passes that time; given "Draf", it shows only in "Perutusan Saya".
- **AC-M09-34.9** (INFERRED, provisional) Given two pinned posts in the same scope, when a third is submitted with "Sematkan di atas (maks 2)", then it is refused with an error (UNVERIFIED COPY) and not stored.

**US-M09-35 — My perutusan**
- **AC-M09-35.1** Given `/perutusan/saya` as admin, when it loads, then the header reads "Perutusan Saya" / "Urus semua perutusan yang anda telah tulis", "Kembali" → `/perutusan`, "Tulis Baru" → `/perutusan/tulis` and "Anda belum menulis perutusan".
- **AC-M09-35.2** (INFERRED, provisional) Given the admin wrote a draft, when the page loads, then it lists that post with its status and date, linking to its detail.

**US-M09-36 — User guide**
- **AC-M09-36.1** Given `/panduan` (guest or logged in), when it loads, then the standalone layout (no sidebar) shows tab "Panduan Pengguna — PRESTASIPLUS", h1 "Panduan Pengguna PRESTASIPLUS", "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!", 5 role tabs and the Pelajar panel ("Cara Daftar Akaun Pelajar", "Apa Yang Boleh Anda Buat", "Soalan Lazim Pelajar"); the footer shows "© 2026 🇲🇾", the logo centred between it and "Platform Latih Tubi Nasional" (DV-M09-21).
- **AC-M09-36.2** Given `/panduan#guru`, when it loads, then the Guru tab is active (border rgb(99,102,241)) and "Cara Daftar Akaun Guru" shows; clicking "Ibu Bapa" changes the URL hash to `#ibubapa` without a new history entry and shows "Cara Daftar Akaun Ibu Bapa"; `#admin` → "Cara Mula Sebagai Admin Sekolah"; `#ppd` → "Cara Mula Sebagai PPD / JPN"; no hash → Pelajar; an unknown hash `#xyz` → no tab is active and no role panel shows (hero, help box and footer still show), as live.
- **AC-M09-36.3** Given the FAQ "Macam mana nak reset kata laluan?", when I click it and then "Apa itu Kombo?", then both answers are open at once; clicking again closes each.
- **AC-M09-36.4** Given a logged-in user, when the top bar loads, then "Laman Utama", "Artikel", "Dashboard" → `/dashboard` show; as a guest "Log Masuk" and "Daftar Percuma" show instead; below 1024px the links are behind `fa-bars`.

**US-M09-37 — Help contacts**
- **AC-M09-37.1** Given the help box, when it loads, then "Perlukan Bantuan Lanjut?", "E-mel Kami" → `mailto:support@prestasiplus.my` and "WhatsApp" (new tab) → `https://wa.me/{configured number}` show (DV-M09-14, PROPOSED: the number comes from configuration; until the owner supplies it, the configured value is the live placeholder 60123456789).
- **AC-M09-37.2** Given a guest, when the page loads, then "Daftar Percuma Sekarang" → `/register` shows below the help box; logged in it does not.

**US-M09-38 — Tuition route**
- **AC-M09-38.1** Given a logged-in user, when I open `/pusat-tuisyen/panduan`, then the same page as `/panduan` renders.
- **AC-M09-38.2** Given no session, when I open `/pusat-tuisyen/panduan`, then I am redirected to `/login` (DV-M09-15 rejected), while `/panduan` opens.

**US-M09-39 — Screenshot tool**
- **AC-M09-39.1** Given `/admin/tools/screenshots`, when it loads, then the header reads "Upload Screenshot" / "Tool admin untuk upload & urus gambar (private)", the card "Upload Gambar" with "Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail.", the drop zone "Klik atau seret fail ke sini" / "Boleh pilih banyak fail", the tip, "Fail Sedia Ada", "Jumlah: 0 fail" and "Tiada fail lagi.".
- **AC-M09-39.2** Given the drop zone, when I drag a file over it, then it gets `border-indigo-400 bg-indigo-50`; clicking it opens the file picker (hidden input, accept `image/*`, multiple).
- **AC-M09-39.3** (INFERRED, provisional) Given I choose "Gambar Saya (1).PNG", when the picker closes, then the form submits at once and "Jumlah: 1 fail" shows the sanitised file name; a file over 10MB or of another type is refused (UNVERIFIED COPY).

**US-M09-40 — User navigation**
- **AC-M09-40.1** Given ≥1024px logged in, when any user-shell page loads, then the sidebar has "Perutusan" → `/perutusan`, "Artikel" → `/artikel`, "Video" → `/video`, "Audio KBAT" → `/audio-kbat`, "Panduan" → `/panduan`.
- **AC-M09-40.2** Given <1024px, when I open the drawer, then "Artikel" and "Video" show in the learning section and "Panduan" → `/pusat-tuisyen/panduan` shows (for the tuition-centre role; condition INFERRED).

**US-M09-41 — Admin navigation**
- **AC-M09-41.1** Given ≥1024px as admin, when an admin page loads, then the sidebar has "Audio KBAT" → `/admin/audio-kbat` and the group "Kandungan" with "Banner", "Artikel", "Nota", "Upload Screenshot" (+ "Push Notifikasi" of M22).
- **AC-M09-41.2** Given <1024px, when I open "Lagi", then the section "Kandungan" lists "Banner", "Artikel", "Nota", "Upload Screenshot".

**US-M09-42 — Layouts and access**
- **AC-M09-42.1** Given the admin, when `/artikel`, `/video`, `/audio-kbat` and `/perutusan` load, then they use the user shell, and `/admin/articles` uses the admin shell (as live).
- **AC-M09-42.2** Given no session, when `/audio-kbat`, `/perutusan`, `/perutusan/4`, `/perutusan/tulis`, `/perutusan/saya`, `/video/tambah`, `/video/2224/edit`, `/pusat-tuisyen/panduan`, `/admin/articles`, `/admin/banners`, `/admin/notes`, `/admin/audio-kbat`, `/admin/tools/screenshots` are opened, then each redirects to `/login`; `/artikel`, `/video`, `/panduan` and `/perutusan/awam/4` open (all OBSERVED).
- **AC-M09-42.3** (INFERRED, provisional) Given `pelajar@demo.test`, when `/admin/articles` is opened, then the user lands on `/dashboard` and `/api/admin/articles` answers 403.

**US-M09-44 — Public perutusan page (S28, added in top-up)**
- **AC-M09-44.1** Given no session, when I open `/perutusan/awam/4`, then a standalone page loads (no user or admin shell, not the `/artikel` guest layout) with tab "{title} — PRESTASIPLUS", the dark sticky top bar with the logo → `/`, "Daftar Percuma" → `/register` (DV-M09-18; hidden below 640px) and "Log Masuk" → `/login`.
- **AC-M09-44.2** Given the hero, when it loads, then it shows "Utama" › "Perutusan", initials "AD", the author name, "PENGETUA" (upper case by CSS), "Sekolah", the date "17 Mac 2026" and time "11:23 PM" (Malay month), the white h1 title and the chips "1 Suka", "3 baca", "0 komen".
- **AC-M09-44.3** Given the body, when it loads, then the rendered HTML body of #4 (basmalah, "Selamat Hari Raya Aidilfitri, Maaf Zahir dan Batin") and the "Video" block with the YouTube player follow; there is no reaction button, no comment form or list, no public-link input and no "Kembali ke senarai".
- **AC-M09-44.4** Given "Kongsi Perutusan", when it loads, then "WhatsApp", "Telegram" and "Facebook" link to their share URLs with the title and page URL; clicking "Salin Pautan" copies the page URL and the button shows `fa-check` "Disalin!".
- **AC-M09-44.5** Given the CTA and footer, when they load, then "Jom Sertai PrestasiPlus!", its text, "Daftar Percuma Sekarang" → `/register` (DV-M09-18), "Log Masuk" → `/login`, and the footer "Platform Latih Tubi Interaktif Malaysia", "Utama" → `/`, "Tentang" → `/tentang` (the global 404 page, as live; DV-M09-19), "Hubungi" → `/panduan` (DV-M09-19), "Log Masuk", "© 2026 PRESTASIPLUS. Hak Cipta Terpelihara." are shown.
- **AC-M09-44.6** Given 375 / 768 / 1280px, when the page loads, then there is no horizontal page scroll, the player is 267×150 / 636×358 / 635×357, the share buttons wrap to 2 rows and the CTA buttons stack full width at 375.

**US-M09-43 — Responsive**
- **AC-M09-43.1** Given every M09 screen at 375, 768 and 1280px, when it loads, then `document.documentElement.scrollWidth` ≤ the viewport width (including S4 at 375, DV-M09-05).
- **AC-M09-43.2** Given S1, S5 and S9 at 375 and 768px, when the table loads, then it scrolls inside its card (`scrollWidth > clientWidth` of the card), the page does not, no cell is sticky, and scrolling the card brings "TINDAKAN" into view (as live, NFR-RESP-05 b; DV-M09-16 rejected).
- **AC-M09-43.3** Given the grids, when the width changes, then they follow SRS §10 (e.g. `/artikel` 1 / 2 / 6 columns and `/video` 1 / 2 / 6 at 375 / 768 / 1280; panduan tabs 2 / 3 / 5; S13 options 1 / 2 / 2).
- **AC-M09-43.4** Given the forms S2, S3, S10, S11, S19, S20, S24 at 375px, when they load, then their footer buttons stay on one row (S2/S3/S10/S11 right-aligned "Batal" + submit; S19/S20 submit left of "Batal"; S24 "Batal" + "Hantar Perutusan").

---

## 5. UI expectations

Behaviour and content match live, including its look (design tokens in `00-global-ui.md` §6). Visual reference: the masked screenshots in `docs/discovery/img/M09/`.

| Screen | Key content and states | Screenshots |
|---|---|---|
| S1 articles | Filter card, list header, table (in-card scroll below 1280), pager (desktop / mobile), empty row, not-found flash. | `admin-articles-desktop/tablet/mobile.png`, `admin-articles-empty.png`, `admin-articles-not-found-flash.png` |
| S2/S3 article form | Fields, plain "Kandungan" textarea, footer on one row; edit preloaded. | `admin-article-create.png`, `-create-mobile.png`, `admin-article-edit.png` |
| S4 preview | Card with meta and pills, escaped body wrapping at 375 (DV-05). | `admin-article-show.png`, `-show-mobile.png` (live overflow) |
| S5/S8 notes | List + filters; preview with detail grid. | `admin-notes-desktop/mobile.png`, `admin-note-show.png` |
| S6/S7 notes form | DV-01 form (live: 500 page). | `admin-note-create-500.png` (live defect) |
| S9–S11 banners | List (in-card scroll), create (external URL reveal), edit (preselected, DV-07). | `admin-banners-*.png`, `admin-banner-create-*.png`, `admin-banner-edit.png` |
| S12/S13 Audio KBAT | Titles (DV-08), stats, filter, empty; long create form with sticky save. | `admin-audio-kbat*.png`, `admin-audio-kbat-create-*.png` |
| S14 screenshots | Upload card, empty list. | `admin-screenshots.png` |
| S15 artikel | Hot section, search, pills, grid 1/2/3/6, pager, empty; guest page. | `artikel-desktop/tablet/mobile.png`, `artikel-category.png`, `artikel-empty.png` |
| S16 detail | Breadcrumb, chips, author card, body, share, related, aside (lg). | `artikel-detail-desktop/mobile.png` |
| S17–S20 video | Pills with counts, grid, pager, empty; detail with player; edit; add with detection and disabled school card. | `video-*.png` |
| S21 audio student | Hero readable (DV-09), visible "Tapis", empty. | `audio-kbat-student.png` (live defect) |
| S22–S25 perutusan | Dark hero, pinned cards; detail with reactions, public link, comments; editor with pickers and HTML mode; my posts empty. | `perutusan-*.png` |
| S28 public perutusan | Standalone public page: dark top bar, hero with Malay date and count chips, body, video, "Kongsi Perutusan", CTA, footer; no reactions or comments for guests. | `perutusan-awam-desktop/tablet/mobile.png` |
| S26/S27 panduan | Top bar (menu below lg), role tabs, panels, FAQ, help box. | `panduan-desktop.png`, `panduan-guru.png`, `panduan-mobile.png` |

### 5.1 Live-session states (L-1 … L-7)

These states need a submit, another role or data that live does not have; the user has not yet approved a live session (discovery §9). They are specified from captured markup/copy where it exists (**SOURCE-DERIVED**), otherwise as the most likely live behaviour (**INFERRED**), with texts as **UNVERIFIED COPY**. No new UX is invented; where nothing can be derived but live works, the prototype uses a neutral provisional page that asserts no unobserved detail. All are listed in §9 OQ-M09-12.

| L | State | How it is specified | Functions |
|---|---|---|---|
| L-1 | Save / update / delete results and flashes for articles, banners, videos, audio sets, perutusan | INFERRED: redirect to the list (video update → detail; draft perutusan → "Perutusan Saya") with a success flash (UNVERIFIED COPY, SRS §8.2); server errors under the field (UNVERIFIED COPY). | FN-M09-1.1.6, 1.2.8, 1.3.6, 4.1.5, 4.2.10, 4.3.6, 5.2.8, 6.4.10, 6.5.6, 6.6.3, 7.3.12 |
| L-2 | Notes create / edit form | Live HTTP 500 → DV-M09-01 form (fields INFERRED from S5/S8, labels PROPOSED COPY). | FN-M09-3.2.1…3.2.5 |
| L-3 | Audio KBAT rows, student list items, player and scoring | Live has 0 sets. Rows and items provisional (form fields only); player SOURCE-DERIVED from copy (sections with their questions together), "Hantar" PROPOSED COPY, scoring INFERRED; stats counting INFERRED. Player strings decided with the reader build (PROPOSED COPY): "Kembali", "Skor anda n / total", "Audio tidak tersedia.", "Ralat memuatkan data. Sila cuba semula.", title "Audio KBAT". | FN-M09-5.1.5, 5.1.8, 5.2.8, 5.3.5, 5.3.6 |
| L-4 | Perutusan reactions, comments and moderation, pin limit, scheduled and draft posts, own-post list | INFERRED behaviour (toggle reaction, pending comments, refuse a third pin, schedule by clock, draft in "Perutusan Saya"); the own-post list is provisional; moderation screen out of M09 (OQ-M09-05). The public page is now OBSERVED (S28, top-up). | FN-M09-7.2.10, 7.2.11, 7.3.12, 7.4.4 |
| L-5 | Screenshot file list | Provisional list of sanitised file names; copy/delete UNVERIFIED and not provided. | FN-M09-9.1.4 |
| L-6 | Role-dependent views: perutusan scope for other roles, "Sekolah Saya" enabled, banner audience | INFERRED: school_admin scope "Sekolah"; "Sekolah Saya" enabled when the user's video-form school (its own INFERRED source) is set — empty for the admin, as observed; audience ALL + own role. | FN-M09-4.4.1, 6.4.6, 7.1.8, 7.3.2 |
| L-7 | Guest article / video detail | INFERRED public; detail content inside the guest public layout (provisional). Video detail decided (v1.7): guest public layout without section label or CTA, no Edit/Padam (DN-M09-01). | FN-M09-2.3.11, 10.3.2 |

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M09/` (generated 2026-09-25). Generated by script (`gen.js` from `fns.js` + the inventory JSON; reproducible). Every M09 content element (S1–S28; S28 added in the discovery top-up, v1.3) is listed with the Function that covers it, or with a concrete exclusion reason; each element maps to exactly one Function. S27 elements 001–318 are the identical `/panduan` page and map to the same Functions as S26 001–318; five of them (S27-064 🏆, 121 🎯, 141 ✏️, 186 📚, 194 💡) are panduan emojis whose key also matched an identical emoji of the `/login` page in the guest state, so they stay mapped to the panduan Functions. The other 41 `/login` elements (S27-319…359) are excluded as M01. Shell elements (SHU, SHA) are chrome owned by the global shell / M23 and the module each link targets; only the M09-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (ids in texts and hrefs are live sample records; `<person>` / `<name>` are discovery masks).

**Summary**

| Set | Elements | Mapped to an M09 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M09 content (S1–S28) | 2054 | 1980 | 74 (33 M16 tournament banner on S15–S25; 41 M01 `/login` page on S27) | 0 |
| User-portal shell SHU | 390 | 29 | 361 (global shell / M23, linked modules, M10 "Sumbang Artikel") | 0 |
| Admin shell SHA | 226 | 34 | 192 (global shell / M23, M22 "Push Notifikasi" / "Chatbot", linked modules) | 0 |

Per screen (content elements):

| Screen | Elements | Mapped | Excluded |
|---|---|---|---|
| S1 | 59 | 59 | 0 |
| S2 | 22 | 22 | 0 |
| S3 | 23 | 23 | 0 |
| S4 | 16 | 16 | 0 |
| S5 | 39 | 39 | 0 |
| S6 | 7 | 7 | 0 |
| S7 | 7 | 7 | 0 |
| S8 | 17 | 17 | 0 |
| S9 | 27 | 27 | 0 |
| S10 | 30 | 30 | 0 |
| S11 | 31 | 31 | 0 |
| S12 | 28 | 28 | 0 |
| S13 | 83 | 83 | 0 |
| S14 | 12 | 12 | 0 |
| S15 | 246 | 243 | 3 |
| S16 | 69 | 66 | 3 |
| S17 | 235 | 232 | 3 |
| S18 | 37 | 34 | 3 |
| S19 | 40 | 37 | 3 |
| S20 | 37 | 34 | 3 |
| S21 | 11 | 8 | 3 |
| S22 | 46 | 43 | 3 |
| S23 | 79 | 76 | 3 |
| S24 | 93 | 90 | 3 |
| S25 | 7 | 4 | 3 |
| S26 | 323 | 323 | 0 |
| S27 | 359 | 318 | 41 |
| S28 | 71 | 71 | 0 |

**2,054/2,054 M09 content elements covered (1,980 mapped, 74 excluded with reason), 0 unmapped.** Including the shells: 2,670/2,670 elements accounted for (2,043 mapped, 627 excluded with reason). 184 of the 235 Functions in §3 appear in this matrix; the other 51 are behaviour-only Functions with no element by nature.

### 6.1 M09 content elements

#### S1 — `/admin/articles` (59 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S1-001 | form | visible-default | GET /admin/articles | FN-M09-1.1.2 |
| EL-M09-S1-002 | input | visible-default | `search`, placeholder "Cari artikel..." | FN-M09-1.1.2 |
| EL-M09-S1-003 | select | visible-default | `category`, 8 options: Semua Kategori / Tips Belajar / Berita / Motivasi / Panduan Ibu Bapa / Panduan Guru / … | FN-M09-1.1.2 |
| EL-M09-S1-004 | select | visible-default | `published`, 3 options: Semua Status / Diterbitkan / Draf | FN-M09-1.1.2 |
| EL-M09-S1-005 | button | visible-default | "Cari", fa-search | FN-M09-1.1.2 |
| EL-M09-S1-006 | link | visible-default | "Reset", → /admin/articles | FN-M09-1.1.2 |
| EL-M09-S1-007 | heading | visible-default | "Senarai Artikel" | FN-M09-1.1.3 |
| EL-M09-S1-008 | text | visible-default | "Jumlah: 72 artikel" | FN-M09-1.1.3 |
| EL-M09-S1-009 | link | visible-default | "Tambah", → /admin/articles/create, fa-plus | FN-M09-1.1.3 |
| EL-M09-S1-010 | card | visible-default | "Tajuk" | FN-M09-1.1.4 |
| EL-M09-S1-011 | table | visible-default | columns: Tajuk, Kategori, Tahap, Status, Views, Tarikh, Tindakan | FN-M09-1.1.4 |
| EL-M09-S1-012 | badge | visible-default | "Tips Belajar" | FN-M09-1.1.4 |
| EL-M09-S1-013 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-1.1.4 |
| EL-M09-S1-014 | link | visible-default | → /admin/articles/10, fa-eye, title "Lihat" | FN-M09-1.1.5 |
| EL-M09-S1-015 | link | visible-default | → /admin/articles/10/edit, fa-edit, title "Edit" | FN-M09-1.1.5 |
| EL-M09-S1-016 | form | visible-default | DELETE /admin/articles/10, return confirm('Adakah anda pasti mahu padam artikel ini?') | FN-M09-1.1.6 |
| EL-M09-S1-017 | hidden-field | hidden-only | `_token`, hidden | FN-M09-1.1.6 |
| EL-M09-S1-018 | hidden-field | hidden-only | `_method`, hidden | FN-M09-1.1.6 |
| EL-M09-S1-019 | button | visible-default | fa-trash, title "Padam" | FN-M09-1.1.6 |
| EL-M09-S1-020 | badge | visible-default | "Tips Belajar" | FN-M09-1.1.4 |
| EL-M09-S1-021 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-1.1.4 |
| EL-M09-S1-022 | link | visible-default | → /admin/articles/11, fa-eye, title "Lihat" | FN-M09-1.1.5 |
| EL-M09-S1-023 | link | visible-default | → /admin/articles/11/edit, fa-edit, title "Edit" | FN-M09-1.1.5 |
| EL-M09-S1-024 | form | visible-default | DELETE /admin/articles/11, return confirm('Adakah anda pasti mahu padam artikel ini?') | FN-M09-1.1.6 |
| EL-M09-S1-025 | hidden-field | hidden-only | `_token`, hidden | FN-M09-1.1.6 |
| EL-M09-S1-026 | hidden-field | hidden-only | `_method`, hidden | FN-M09-1.1.6 |
| EL-M09-S1-027 | button | visible-default | fa-trash, title "Padam" | FN-M09-1.1.6 |
| EL-M09-S1-028 | badge | visible-default | "Tips Belajar" | FN-M09-1.1.4 |
| EL-M09-S1-029 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-1.1.4 |
| EL-M09-S1-030 | link | visible-default | → /admin/articles/12, fa-eye, title "Lihat" | FN-M09-1.1.5 |
| EL-M09-S1-031 | link | visible-default | → /admin/articles/12/edit, fa-edit, title "Edit" | FN-M09-1.1.5 |
| EL-M09-S1-032 | form | visible-default | DELETE /admin/articles/12, return confirm('Adakah anda pasti mahu padam artikel ini?') | FN-M09-1.1.6 |
| EL-M09-S1-033 | hidden-field | hidden-only | `_token`, hidden | FN-M09-1.1.6 |
| EL-M09-S1-034 | hidden-field | hidden-only | `_method`, hidden | FN-M09-1.1.6 |
| EL-M09-S1-035 | button | visible-default | fa-trash, title "Padam" | FN-M09-1.1.6 |
| EL-M09-S1-036 | text | conditional | "« Previous", mobile-only | FN-M09-1.1.7 |
| EL-M09-S1-037 | pagination | conditional | "Next »", → /admin/articles?page=2, mobile-only | FN-M09-1.1.7 |
| EL-M09-S1-038 | text | visible-default | "Showing to of results", desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-039 | text | visible-default | "1", desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-040 | text | visible-default | "20", desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-041 | text | visible-default | "72", desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-042 | text | visible-default | "1", desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-043 | pagination | visible-default | "2", → /admin/articles?page=2, desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-044 | pagination | visible-default | "3", → /admin/articles?page=3, desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-045 | pagination | visible-default | "4", → /admin/articles?page=4, desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-046 | pagination | visible-default | → /admin/articles?page=2, svg, desktop-only | FN-M09-1.1.7 |
| EL-M09-S1-047 | text | conditional | "Jumlah: 14 artikel", state captured @1280 only | FN-M09-1.1.8 |
| EL-M09-S1-048 | badge | conditional | "Motivasi", state captured @1280 only | FN-M09-1.1.8 |
| EL-M09-S1-049 | badge | conditional | "Motivasi", state captured @1280 only | FN-M09-1.1.8 |
| EL-M09-S1-050 | badge | conditional | "Motivasi", state captured @1280 only | FN-M09-1.1.8 |
| EL-M09-S1-051 | text | conditional | "Jumlah: 0 artikel", state captured @1280 only | FN-M09-1.1.9 |
| EL-M09-S1-052 | text | conditional | "Jumlah: 21 artikel", state captured @1280 only | FN-M09-1.1.8 |
| EL-M09-S1-053 | pagination | hidden-only | "« Previous", → /admin/articles?page=1 | FN-M09-1.1.7 |
| EL-M09-S1-054 | text | hidden-only | "Next »" | FN-M09-1.1.7 |
| EL-M09-S1-055 | badge | conditional | "Umum", state captured @1280 only | FN-M09-1.1.4 |
| EL-M09-S1-056 | badge | conditional | "Umum", state captured @1280 only | FN-M09-1.1.4 |
| EL-M09-S1-057 | badge | conditional | "Umum", state captured @1280 only | FN-M09-1.1.4 |
| EL-M09-S1-058 | alert | conditional | "Artikel tidak dijumpai.", fa-exclamation-circle, state captured @1280 only | FN-M09-1.1.10 |
| EL-M09-S1-059 | text | conditional | "Jumlah: 2 artikel", state captured @1280 only | FN-M09-1.1.8 |

#### S2 — `/admin/articles/create` (22 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S2-001 | link | visible-default | "Kembali ke Senarai", → /admin/articles, fa-arrow-left | FN-M09-1.2.2 |
| EL-M09-S2-002 | card | visible-default | "Tajuk Artikel *" | FN-M09-1.2.3 |
| EL-M09-S2-003 | form | visible-default | POST /admin/articles | FN-M09-1.2.3 |
| EL-M09-S2-004 | hidden-field | hidden-only | `_token`, hidden | FN-M09-1.2.3 |
| EL-M09-S2-005 | label | visible-default | "Tajuk Artikel *" | FN-M09-1.2.3 |
| EL-M09-S2-006 | input | visible-default | label "Tajuk Artikel *", `title`, placeholder "cth: 10 Tips Belajar Matematik", required | FN-M09-1.2.3 |
| EL-M09-S2-007 | label | visible-default | "Ringkasan" | FN-M09-1.2.3 |
| EL-M09-S2-008 | textarea | visible-default | label "Ringkasan", `excerpt`, placeholder "Ringkasan artikel" | FN-M09-1.2.3 |
| EL-M09-S2-009 | label | visible-default | "Kandungan *" | FN-M09-1.2.3 |
| EL-M09-S2-010 | textarea | visible-default | label "Kandungan *", `content`, placeholder "Tulis kandungan artikel di sini...", required | FN-M09-1.2.3 |
| EL-M09-S2-011 | label | visible-default | "URL Gambar Utama" | FN-M09-1.2.4 |
| EL-M09-S2-012 | input | visible-default | label "URL Gambar Utama", `featured_image`, url, placeholder "https://example.com/image.jpg" | FN-M09-1.2.4 |
| EL-M09-S2-013 | label | visible-default | "Kategori *" | FN-M09-1.2.4 |
| EL-M09-S2-014 | select | visible-default | label "Kategori *", `category`, required, 8 options: Pilih kategori / Tips Belajar / Berita / Motivasi / Panduan Ibu Bapa / Panduan Guru / … | FN-M09-1.2.4 |
| EL-M09-S2-015 | label | visible-default | "Tahap Pendidikan" | FN-M09-1.2.4 |
| EL-M09-S2-016 | select | visible-default | label "Tahap Pendidikan", `grade_level`, 7 options: Semua / Darjah 1 / Darjah 2 / Darjah 3 / Darjah 4 / Darjah 5 / … | FN-M09-1.2.4 |
| EL-M09-S2-017 | label | visible-default | "Terbitkan Sekarang" | FN-M09-1.2.5 |
| EL-M09-S2-018 | checkbox | visible-default | label "Terbitkan Sekarang", `is_published`, checkbox | FN-M09-1.2.5 |
| EL-M09-S2-019 | label | visible-default | "Artikel Featured" | FN-M09-1.2.5 |
| EL-M09-S2-020 | checkbox | visible-default | label "Artikel Featured", `is_featured`, checkbox | FN-M09-1.2.5 |
| EL-M09-S2-021 | link | visible-default | "Batal", → /admin/articles | FN-M09-1.2.6 |
| EL-M09-S2-022 | button | visible-default | "Simpan Artikel", fa-save | FN-M09-1.2.6 |

#### S3 — `/admin/articles/{id}/edit` (23 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S3-001 | link | visible-default | "Kembali ke Senarai", → /admin/articles, fa-arrow-left | FN-M09-1.3.2 |
| EL-M09-S3-002 | card | visible-default | "Tajuk Artikel *" | FN-M09-1.3.3 |
| EL-M09-S3-003 | form | visible-default | PUT /admin/articles/10 | FN-M09-1.3.3 |
| EL-M09-S3-004 | hidden-field | hidden-only | `_token`, hidden | FN-M09-1.3.3 |
| EL-M09-S3-005 | hidden-field | hidden-only | `_method`, hidden | FN-M09-1.3.3 |
| EL-M09-S3-006 | label | visible-default | "Tajuk Artikel *" | FN-M09-1.3.3 |
| EL-M09-S3-007 | input | visible-default | label "Tajuk Artikel *", `title`, required | FN-M09-1.3.3 |
| EL-M09-S3-008 | label | visible-default | "Ringkasan" | FN-M09-1.3.3 |
| EL-M09-S3-009 | textarea | visible-default | label "Ringkasan", `excerpt` | FN-M09-1.3.3 |
| EL-M09-S3-010 | label | visible-default | "Kandungan *" | FN-M09-1.3.3 |
| EL-M09-S3-011 | textarea | visible-default | label "Kandungan *", `content`, required | FN-M09-1.3.3 |
| EL-M09-S3-012 | label | visible-default | "URL Gambar Utama" | FN-M09-1.3.3 |
| EL-M09-S3-013 | input | visible-default | label "URL Gambar Utama", `featured_image`, url | FN-M09-1.3.3 |
| EL-M09-S3-014 | label | visible-default | "Kategori *" | FN-M09-1.3.3 |
| EL-M09-S3-015 | select | visible-default | label "Kategori *", `category`, required, 7 options: Tips Belajar / Berita / Motivasi / Panduan Ibu Bapa / Panduan Guru / Kejayaan / … | FN-M09-1.3.3 |
| EL-M09-S3-016 | label | visible-default | "Tahap Pendidikan" | FN-M09-1.3.3 |
| EL-M09-S3-017 | select | visible-default | label "Tahap Pendidikan", `grade_level`, 7 options: Semua / Darjah 1 / Darjah 2 / Darjah 3 / Darjah 4 / Darjah 5 / … | FN-M09-1.3.3 |
| EL-M09-S3-018 | label | visible-default | "Terbitkan Sekarang" | FN-M09-1.3.3 |
| EL-M09-S3-019 | checkbox | visible-default | label "Terbitkan Sekarang", `is_published`, checkbox | FN-M09-1.3.3 |
| EL-M09-S3-020 | label | visible-default | "Artikel Featured" | FN-M09-1.3.3 |
| EL-M09-S3-021 | checkbox | visible-default | label "Artikel Featured", `is_featured`, checkbox | FN-M09-1.3.3 |
| EL-M09-S3-022 | link | visible-default | "Batal", → /admin/articles | FN-M09-1.3.4 |
| EL-M09-S3-023 | button | visible-default | "Kemaskini Artikel", fa-save | FN-M09-1.3.4 |

#### S4 — `/admin/articles/{id}` (16 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S4-001 | link | visible-default | "Kembali ke Senarai", → /admin/articles, fa-arrow-left | FN-M09-1.4.2 |
| EL-M09-S4-002 | card | visible-default | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M09-1.4.3 |
| EL-M09-S4-003 | heading | visible-default | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M09-1.4.3 |
| EL-M09-S4-004 | text | visible-default | "Admin PRESTASI+", fa-user | FN-M09-1.4.3 |
| EL-M09-S4-005 | text | visible-default | "22 Feb 2026", fa-calendar | FN-M09-1.4.3 |
| EL-M09-S4-006 | text | visible-default | "596 tontonan", fa-eye | FN-M09-1.4.3 |
| EL-M09-S4-007 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-1.4.3 |
| EL-M09-S4-008 | badge | visible-default | "Featured", fa-star | FN-M09-1.4.3 |
| EL-M09-S4-009 | text | visible-default | "Teknik Pomodoro bantu pelajar fokus dengan pecahkan masa belajar kepada slot 25 minit." | FN-M09-1.4.3 |
| EL-M09-S4-010 | text | visible-default | "<h2>Apa Itu Teknik Pomodoro?</h2><p>Teknik Pomodoro ialah kaedah pengurusan masa yang dici…" | FN-M09-1.4.4 |
| EL-M09-S4-011 | link | visible-default | "Edit Artikel", → /admin/articles/10/edit, fa-edit | FN-M09-1.4.5 |
| EL-M09-S4-012 | card | conditional | "Cara Buat Nota Bergambar (Mind Map) yang Berkesan", state captured @1280 only | FN-M09-1.4.3 |
| EL-M09-S4-013 | heading | conditional | "Cara Buat Nota Bergambar (Mind Map) yang Berkesan", state captured @1280 only | FN-M09-1.4.3 |
| EL-M09-S4-014 | text | conditional | "<person>", fa-user, state captured @1280 only | FN-M09-1.4.3 |
| EL-M09-S4-015 | text | conditional | "Mind map bantu pelajar nampak hubungan antara topik dan ingat fakta dengan lebih mudah.", state captured @1280 only | FN-M09-1.4.3 |
| EL-M09-S4-016 | text | conditional | "<h2>Apa Itu Mind Map?</h2><p>Mind map atau peta minda ialah cara buat nota menggunakan gam…", state captured @1280 only | FN-M09-1.4.4 |

#### S5 — `/admin/notes` (39 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S5-001 | form | visible-default | GET /admin/notes | FN-M09-3.1.2 |
| EL-M09-S5-002 | input | visible-default | `search`, placeholder "Cari nota..." | FN-M09-3.1.2 |
| EL-M09-S5-003 | select | visible-default | `subject`, 6 options: Semua Subjek / Matematik / Sains / Bahasa Melayu / Bahasa Inggeris / Sejarah | FN-M09-3.1.2 |
| EL-M09-S5-004 | select | visible-default | `note_type`, 6 options: Semua Jenis / Ringkasan / Mind Map / Flashcard / Cheat Sheet / Nota Penuh | FN-M09-3.1.2 |
| EL-M09-S5-005 | button | visible-default | "Cari", fa-search | FN-M09-3.1.2 |
| EL-M09-S5-006 | link | visible-default | "Reset", → /admin/notes | FN-M09-3.1.2 |
| EL-M09-S5-007 | heading | visible-default | "Senarai Nota" | FN-M09-3.1.3 |
| EL-M09-S5-008 | text | visible-default | "Jumlah: 10 nota" | FN-M09-3.1.3 |
| EL-M09-S5-009 | link | visible-default | "Tambah Nota", → /admin/notes/create, fa-plus | FN-M09-3.1.3 |
| EL-M09-S5-010 | card | visible-default | "Tajuk" | FN-M09-3.1.4 |
| EL-M09-S5-011 | table | visible-default | columns: Tajuk, Subjek, Jenis, Tahap, Status, Statistik, Tindakan | FN-M09-3.1.4 |
| EL-M09-S5-012 | badge | visible-default | "MATEMATIK" | FN-M09-3.1.4 |
| EL-M09-S5-013 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-3.1.4 |
| EL-M09-S5-014 | link | visible-default | → /admin/notes/1, fa-eye, title "Lihat" | FN-M09-3.1.5 |
| EL-M09-S5-015 | link | visible-default | → /admin/notes/1/edit, fa-edit, title "Edit" | FN-M09-3.1.5 |
| EL-M09-S5-016 | form | visible-default | DELETE /admin/notes/1, return confirm('Adakah anda pasti mahu padam nota ini?') | FN-M09-3.1.6 |
| EL-M09-S5-017 | hidden-field | hidden-only | `_token`, hidden | FN-M09-3.1.6 |
| EL-M09-S5-018 | hidden-field | hidden-only | `_method`, hidden | FN-M09-3.1.6 |
| EL-M09-S5-019 | button | visible-default | fa-trash, title "Padam" | FN-M09-3.1.6 |
| EL-M09-S5-020 | badge | visible-default | "MATEMATIK" | FN-M09-3.1.4 |
| EL-M09-S5-021 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-3.1.4 |
| EL-M09-S5-022 | link | visible-default | → /admin/notes/2, fa-eye, title "Lihat" | FN-M09-3.1.5 |
| EL-M09-S5-023 | link | visible-default | → /admin/notes/2/edit, fa-edit, title "Edit" | FN-M09-3.1.5 |
| EL-M09-S5-024 | form | visible-default | DELETE /admin/notes/2, return confirm('Adakah anda pasti mahu padam nota ini?') | FN-M09-3.1.6 |
| EL-M09-S5-025 | hidden-field | hidden-only | `_token`, hidden | FN-M09-3.1.6 |
| EL-M09-S5-026 | hidden-field | hidden-only | `_method`, hidden | FN-M09-3.1.6 |
| EL-M09-S5-027 | button | visible-default | fa-trash, title "Padam" | FN-M09-3.1.6 |
| EL-M09-S5-028 | badge | visible-default | "SAINS" | FN-M09-3.1.4 |
| EL-M09-S5-029 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-3.1.4 |
| EL-M09-S5-030 | link | visible-default | → /admin/notes/3, fa-eye, title "Lihat" | FN-M09-3.1.5 |
| EL-M09-S5-031 | link | visible-default | → /admin/notes/3/edit, fa-edit, title "Edit" | FN-M09-3.1.5 |
| EL-M09-S5-032 | form | visible-default | DELETE /admin/notes/3, return confirm('Adakah anda pasti mahu padam nota ini?') | FN-M09-3.1.6 |
| EL-M09-S5-033 | hidden-field | hidden-only | `_token`, hidden | FN-M09-3.1.6 |
| EL-M09-S5-034 | hidden-field | hidden-only | `_method`, hidden | FN-M09-3.1.6 |
| EL-M09-S5-035 | button | visible-default | fa-trash, title "Padam" | FN-M09-3.1.6 |
| EL-M09-S5-036 | text | conditional | "Jumlah: 1 nota", state captured @1280 only | FN-M09-3.1.7 |
| EL-M09-S5-037 | text | conditional | "Jumlah: 3 nota", state captured @1280 only | FN-M09-3.1.7 |
| EL-M09-S5-038 | badge | conditional | "MATEMATIK", state captured @1280 only | FN-M09-3.1.7 |
| EL-M09-S5-039 | text | conditional | "Jumlah: 0 nota", state captured @1280 only | FN-M09-3.1.7 |

#### S6 — `/admin/notes/create` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S6-001 | text | visible-default | "500" | FN-M09-3.2.1 |
| EL-M09-S6-002 | text | visible-default | "⚙️" | FN-M09-3.2.1 |
| EL-M09-S6-003 | heading | visible-default | "Ralat Pelayan" | FN-M09-3.2.1 |
| EL-M09-S6-004 | text | visible-default | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar l…" | FN-M09-3.2.1 |
| EL-M09-S6-005 | link | visible-default | "Halaman Utama", → / | FN-M09-3.2.1 |
| EL-M09-S6-006 | link | visible-default | "Cuba Semula", → javascript:location.reload() | FN-M09-3.2.1 |
| EL-M09-S6-007 | text | visible-default | "PRESTASIPLUS" | FN-M09-3.2.1 |

#### S7 — `/admin/notes/{id}/edit` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S7-001 | text | visible-default | "500" | FN-M09-3.2.2 |
| EL-M09-S7-002 | text | visible-default | "⚙️" | FN-M09-3.2.2 |
| EL-M09-S7-003 | heading | visible-default | "Ralat Pelayan" | FN-M09-3.2.2 |
| EL-M09-S7-004 | text | visible-default | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar l…" | FN-M09-3.2.2 |
| EL-M09-S7-005 | link | visible-default | "Halaman Utama", → / | FN-M09-3.2.2 |
| EL-M09-S7-006 | link | visible-default | "Cuba Semula", → javascript:location.reload() | FN-M09-3.2.2 |
| EL-M09-S7-007 | text | visible-default | "PRESTASIPLUS" | FN-M09-3.2.2 |

#### S8 — `/admin/notes/{id}` (17 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S8-001 | link | visible-default | "Kembali ke Senarai", → /admin/notes, fa-arrow-left | FN-M09-3.3.2 |
| EL-M09-S8-002 | card | visible-default | "Sifir 1 hingga 12 — Carta Lengkap" | FN-M09-3.3.3 |
| EL-M09-S8-003 | heading | visible-default | "Sifir 1 hingga 12 — Carta Lengkap" | FN-M09-3.3.3 |
| EL-M09-S8-004 | text | visible-default | "Admin PRESTASI+", fa-user | FN-M09-3.3.3 |
| EL-M09-S8-005 | text | visible-default | "06 Feb 2026", fa-calendar | FN-M09-3.3.3 |
| EL-M09-S8-006 | text | visible-default | "0 tontonan", fa-eye | FN-M09-3.3.3 |
| EL-M09-S8-007 | text | visible-default | "0 muat turun", fa-download | FN-M09-3.3.3 |
| EL-M09-S8-008 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M09-3.3.3 |
| EL-M09-S8-009 | text | visible-default | "Carta sifir lengkap dari 1 hingga 12 untuk hafalan mudah." | FN-M09-3.3.3 |
| EL-M09-S8-010 | text | visible-default | "Subjek" | FN-M09-3.3.3 |
| EL-M09-S8-011 | text | visible-default | "MATEMATIK" | FN-M09-3.3.3 |
| EL-M09-S8-012 | text | visible-default | "Tahap" | FN-M09-3.3.3 |
| EL-M09-S8-013 | text | visible-default | "DARJAH 2" | FN-M09-3.3.3 |
| EL-M09-S8-014 | text | visible-default | "Jenis" | FN-M09-3.3.3 |
| EL-M09-S8-015 | text | visible-default | "FORMULA" | FN-M09-3.3.3 |
| EL-M09-S8-016 | text | visible-default | "<h2>Sifir 1 hingga 12</h2> <p>Sifir adalah asas kepada semua operasi Matematik. Hafal sifi…" | FN-M09-3.3.4 |
| EL-M09-S8-017 | link | visible-default | "Edit Nota", → /admin/notes/1/edit, fa-edit | FN-M09-3.3.5 |

#### S9 — `/admin/banners` (27 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S9-001 | heading | visible-default | "Senarai Banner" | FN-M09-4.1.2 |
| EL-M09-S9-002 | text | visible-default | "Jumlah: 5 banner" | FN-M09-4.1.2 |
| EL-M09-S9-003 | link | visible-default | "Tambah", → /admin/banners/create, fa-plus | FN-M09-4.1.2 |
| EL-M09-S9-004 | card | visible-default | "#" | FN-M09-4.1.3 |
| EL-M09-S9-005 | table | visible-default | columns: #, Tajuk, Jenis, Sasaran, Susunan, Mula, Tamat, Aktif?, Tindakan | FN-M09-4.1.3 |
| EL-M09-S9-006 | badge | visible-default | "HERO" | FN-M09-4.1.3 |
| EL-M09-S9-007 | badge | visible-default | "Aktif", fa-check-circle | FN-M09-4.1.3 |
| EL-M09-S9-008 | link | visible-default | → /admin/banners/1/edit, fa-edit, title "Edit" | FN-M09-4.1.4 |
| EL-M09-S9-009 | form | visible-default | DELETE /admin/banners/1, return confirm('Adakah anda pasti mahu padam banner ini?') | FN-M09-4.1.5 |
| EL-M09-S9-010 | hidden-field | hidden-only | `_token`, hidden | FN-M09-4.1.5 |
| EL-M09-S9-011 | hidden-field | hidden-only | `_method`, hidden | FN-M09-4.1.5 |
| EL-M09-S9-012 | button | visible-default | fa-trash, title "Padam" | FN-M09-4.1.5 |
| EL-M09-S9-013 | badge | visible-default | "FEATURE" | FN-M09-4.1.3 |
| EL-M09-S9-014 | badge | visible-default | "Aktif", fa-check-circle | FN-M09-4.1.3 |
| EL-M09-S9-015 | link | visible-default | → /admin/banners/2/edit, fa-edit, title "Edit" | FN-M09-4.1.4 |
| EL-M09-S9-016 | form | visible-default | DELETE /admin/banners/2, return confirm('Adakah anda pasti mahu padam banner ini?') | FN-M09-4.1.5 |
| EL-M09-S9-017 | hidden-field | hidden-only | `_token`, hidden | FN-M09-4.1.5 |
| EL-M09-S9-018 | hidden-field | hidden-only | `_method`, hidden | FN-M09-4.1.5 |
| EL-M09-S9-019 | button | visible-default | fa-trash, title "Padam" | FN-M09-4.1.5 |
| EL-M09-S9-020 | badge | visible-default | "PROMOTIONAL" | FN-M09-4.1.3 |
| EL-M09-S9-021 | badge | visible-default | "Aktif", fa-check-circle | FN-M09-4.1.3 |
| EL-M09-S9-022 | link | visible-default | → /admin/banners/3/edit, fa-edit, title "Edit" | FN-M09-4.1.4 |
| EL-M09-S9-023 | form | visible-default | DELETE /admin/banners/3, return confirm('Adakah anda pasti mahu padam banner ini?') | FN-M09-4.1.5 |
| EL-M09-S9-024 | hidden-field | hidden-only | `_token`, hidden | FN-M09-4.1.5 |
| EL-M09-S9-025 | hidden-field | hidden-only | `_method`, hidden | FN-M09-4.1.5 |
| EL-M09-S9-026 | button | visible-default | fa-trash, title "Padam" | FN-M09-4.1.5 |
| EL-M09-S9-027 | alert | conditional | "Banner tidak dijumpai.", fa-exclamation-circle, state captured @1280 only | FN-M09-4.1.6 |

#### S10 — `/admin/banners/create` (30 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S10-001 | link | visible-default | "Kembali ke Senarai", → /admin/banners, fa-arrow-left | FN-M09-4.2.2 |
| EL-M09-S10-002 | card | visible-default | "Tajuk Banner *" | FN-M09-4.2.3 |
| EL-M09-S10-003 | form | visible-default | POST /admin/banners | FN-M09-4.2.3 |
| EL-M09-S10-004 | hidden-field | hidden-only | `_token`, hidden | FN-M09-4.2.3 |
| EL-M09-S10-005 | label | visible-default | "Tajuk Banner *" | FN-M09-4.2.3 |
| EL-M09-S10-006 | input | visible-default | label "Tajuk Banner *", `title`, placeholder "cth: Promosi SPM 2024", required | FN-M09-4.2.3 |
| EL-M09-S10-007 | label | visible-default | "Penerangan" | FN-M09-4.2.3 |
| EL-M09-S10-008 | textarea | visible-default | label "Penerangan", `description`, placeholder "Penerangan ringkas tentang banner" | FN-M09-4.2.3 |
| EL-M09-S10-009 | label | visible-default | "URL Gambar" | FN-M09-4.2.3 |
| EL-M09-S10-010 | input | visible-default | label "URL Gambar", `image_url`, url, placeholder "https://example.com/image.jpg" | FN-M09-4.2.3 |
| EL-M09-S10-011 | text | visible-default | "Masukkan URL gambar banner", fa-info-circle | FN-M09-4.2.3 |
| EL-M09-S10-012 | label | visible-default | "Jenis Banner *" | FN-M09-4.2.4 |
| EL-M09-S10-013 | select | visible-default | label "Jenis Banner *", `banner_type`, required, 5 options: Pilih jenis banner / Hero / Promo / Pengumuman / Acara | FN-M09-4.2.4 |
| EL-M09-S10-014 | label | visible-default | "Jenis Pautan" | FN-M09-4.2.5 |
| EL-M09-S10-015 | select | visible-default | label "Jenis Pautan", `link_type`, 5 options: Tiada Pautan / Subjek / Kuiz / Artikel / Pautan Luar | FN-M09-4.2.5 |
| EL-M09-S10-016 | input | conditional | `external_url`, url, placeholder "https://example.com", state captured @1280 only | FN-M09-4.2.5 |
| EL-M09-S10-017 | label | visible-default | "Sasaran Penonton *" | FN-M09-4.2.6 |
| EL-M09-S10-018 | select | visible-default | label "Sasaran Penonton *", `target_audience`, required, 4 options: Semua / Pelajar / Guru / Admin | FN-M09-4.2.6 |
| EL-M09-S10-019 | label | visible-default | "Susunan Paparan" | FN-M09-4.2.7 |
| EL-M09-S10-020 | input | visible-default | label "Susunan Paparan", `display_order`, number, min 0 max - | FN-M09-4.2.7 |
| EL-M09-S10-021 | text | visible-default | "Nombor lebih kecil akan dipaparkan dahulu", fa-sort | FN-M09-4.2.7 |
| EL-M09-S10-022 | label | visible-default | "Tarikh Mula" | FN-M09-4.2.7 |
| EL-M09-S10-023 | input | visible-default | label "Tarikh Mula", `start_date`, date | FN-M09-4.2.7 |
| EL-M09-S10-024 | label | visible-default | "Tarikh Tamat" | FN-M09-4.2.7 |
| EL-M09-S10-025 | input | visible-default | label "Tarikh Tamat", `end_date`, date | FN-M09-4.2.7 |
| EL-M09-S10-026 | label | visible-default | "Banner Aktif" | FN-M09-4.2.7 |
| EL-M09-S10-027 | checkbox | visible-default | label "Banner Aktif", `is_active`, checkbox | FN-M09-4.2.7 |
| EL-M09-S10-028 | text | visible-default | "Tandakan untuk memaparkan banner" | FN-M09-4.2.7 |
| EL-M09-S10-029 | link | visible-default | "Batal", → /admin/banners | FN-M09-4.2.8 |
| EL-M09-S10-030 | button | visible-default | "Simpan Banner", fa-save | FN-M09-4.2.8 |

#### S11 — `/admin/banners/{id}/edit` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S11-001 | link | visible-default | "Kembali ke Senarai", → /admin/banners, fa-arrow-left | FN-M09-4.3.2 |
| EL-M09-S11-002 | card | visible-default | "Tajuk Banner *" | FN-M09-4.3.3 |
| EL-M09-S11-003 | form | visible-default | PUT /admin/banners/1 | FN-M09-4.3.3 |
| EL-M09-S11-004 | hidden-field | hidden-only | `_token`, hidden | FN-M09-4.3.3 |
| EL-M09-S11-005 | hidden-field | hidden-only | `_method`, hidden | FN-M09-4.3.3 |
| EL-M09-S11-006 | label | visible-default | "Tajuk Banner *" | FN-M09-4.3.3 |
| EL-M09-S11-007 | input | visible-default | label "Tajuk Banner *", `title`, placeholder "cth: Promosi SPM 2024", required | FN-M09-4.3.3 |
| EL-M09-S11-008 | label | visible-default | "Penerangan" | FN-M09-4.3.3 |
| EL-M09-S11-009 | textarea | visible-default | label "Penerangan", `description`, placeholder "Penerangan ringkas tentang banner" | FN-M09-4.3.3 |
| EL-M09-S11-010 | label | visible-default | "URL Gambar" | FN-M09-4.3.3 |
| EL-M09-S11-011 | input | visible-default | label "URL Gambar", `image_url`, url, placeholder "https://example.com/image.jpg" | FN-M09-4.3.3 |
| EL-M09-S11-012 | text | visible-default | "Masukkan URL gambar banner", fa-info-circle | FN-M09-4.3.3 |
| EL-M09-S11-013 | label | visible-default | "Jenis Banner *" | FN-M09-4.3.3 |
| EL-M09-S11-014 | select | visible-default | label "Jenis Banner *", `banner_type`, required, 5 options: Pilih jenis banner / Hero / Promo / Pengumuman / Acara | FN-M09-4.3.3 |
| EL-M09-S11-015 | label | visible-default | "Jenis Pautan" | FN-M09-4.3.3 |
| EL-M09-S11-016 | select | visible-default | label "Jenis Pautan", `link_type`, 5 options: Tiada Pautan / Subjek / Kuiz / Artikel / Pautan Luar | FN-M09-4.3.3 |
| EL-M09-S11-017 | input | conditional | `external_url`, url, placeholder "https://example.com", state captured @1280 only | FN-M09-4.3.3 |
| EL-M09-S11-018 | label | visible-default | "Sasaran Penonton *" | FN-M09-4.3.3 |
| EL-M09-S11-019 | select | visible-default | label "Sasaran Penonton *", `target_audience`, required, 4 options: Semua / Pelajar / Guru / Admin | FN-M09-4.3.3 |
| EL-M09-S11-020 | label | visible-default | "Susunan Paparan" | FN-M09-4.3.3 |
| EL-M09-S11-021 | input | visible-default | label "Susunan Paparan", `display_order`, number, min 0 max - | FN-M09-4.3.3 |
| EL-M09-S11-022 | text | visible-default | "Nombor lebih kecil akan dipaparkan dahulu", fa-sort | FN-M09-4.3.3 |
| EL-M09-S11-023 | label | visible-default | "Tarikh Mula" | FN-M09-4.3.3 |
| EL-M09-S11-024 | input | visible-default | label "Tarikh Mula", `start_date`, date | FN-M09-4.3.3 |
| EL-M09-S11-025 | label | visible-default | "Tarikh Tamat" | FN-M09-4.3.3 |
| EL-M09-S11-026 | input | visible-default | label "Tarikh Tamat", `end_date`, date | FN-M09-4.3.3 |
| EL-M09-S11-027 | label | visible-default | "Banner Aktif" | FN-M09-4.3.3 |
| EL-M09-S11-028 | checkbox | visible-default | label "Banner Aktif", `is_active`, checkbox | FN-M09-4.3.3 |
| EL-M09-S11-029 | text | visible-default | "Tandakan untuk memaparkan banner" | FN-M09-4.3.3 |
| EL-M09-S11-030 | link | visible-default | "Batal", → /admin/banners | FN-M09-4.3.4 |
| EL-M09-S11-031 | button | visible-default | "Kemaskini Banner", fa-save | FN-M09-4.3.4 |

#### S12 — `/admin/audio-kbat` (28 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S12-001 | badge | visible-default | "Ujian Mendengar", fa-headphones | FN-M09-5.1.2 |
| EL-M09-S12-002 | heading | visible-default | "Set Audio KBAT" | FN-M09-5.1.2 |
| EL-M09-S12-003 | text | visible-default | "Senarai set soalan audio fixed sequence, bukan rawak." | FN-M09-5.1.2 |
| EL-M09-S12-004 | link | visible-default | "Template XLSX", → /admin/audio-kbat/template, fa-file-excel | FN-M09-5.1.3 |
| EL-M09-S12-005 | link | visible-default | "Template Word", → /admin/audio-kbat/template-word, fa-file-word | FN-M09-5.1.3 |
| EL-M09-S12-006 | link | visible-default | "Cipta Set", → /admin/audio-kbat/create, fa-plus | FN-M09-5.1.3 |
| EL-M09-S12-007 | text | visible-default | "Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT" | FN-M09-5.1.4 |
| EL-M09-S12-008 | text | visible-default | "Set ini bukan soalan rawak. Cikgu perlu bekalkan satu set lengkap 30 soalan MCQ bersama 4 …" | FN-M09-5.1.4 |
| EL-M09-S12-009 | text | visible-default | "Jika cikgu mahu bahan yang mudah ditaip, gunakan Template Word. Jika mahu format paling se…" | FN-M09-5.1.4 |
| EL-M09-S12-010 | card | visible-default | "Set" | FN-M09-5.1.5 |
| EL-M09-S12-011 | text | visible-default | "Set" | FN-M09-5.1.5 |
| EL-M09-S12-012 | text | visible-default | "0" | FN-M09-5.1.5 |
| EL-M09-S12-013 | card | visible-default | "Approved" | FN-M09-5.1.5 |
| EL-M09-S12-014 | text | visible-default | "Approved" | FN-M09-5.1.5 |
| EL-M09-S12-015 | text | visible-default | "0" | FN-M09-5.1.5 |
| EL-M09-S12-016 | card | visible-default | "Draft/Pending" | FN-M09-5.1.5 |
| EL-M09-S12-017 | text | visible-default | "Draft/Pending" | FN-M09-5.1.5 |
| EL-M09-S12-018 | text | visible-default | "0" | FN-M09-5.1.5 |
| EL-M09-S12-019 | card | visible-default | "Soalan" | FN-M09-5.1.5 |
| EL-M09-S12-020 | text | visible-default | "Soalan" | FN-M09-5.1.5 |
| EL-M09-S12-021 | text | visible-default | "0" | FN-M09-5.1.5 |
| EL-M09-S12-022 | form | visible-default | GET /admin/audio-kbat | FN-M09-5.1.6 |
| EL-M09-S12-023 | select | visible-default | `education_level_id`, 12 options: Semua Tahap / Darjah 1 / Darjah 2 / Darjah 3 / Darjah 4 / Darjah 5 / … | FN-M09-5.1.6 |
| EL-M09-S12-024 | select | visible-default | `subject_id`, 32 options: Semua Subjek / Bahasa Arab / Bahasa Cina / Bahasa Inggeris / Bahasa Melayu / Bahasa Tamil / … | FN-M09-5.1.6 |
| EL-M09-S12-025 | select | visible-default | `status`, 5 options: Semua Status / Draft / Pending Review / Approved / Archived | FN-M09-5.1.6 |
| EL-M09-S12-026 | input | visible-default | `search`, placeholder "Cari tajuk/sumber..." | FN-M09-5.1.6 |
| EL-M09-S12-027 | button | visible-default | "Tapis", fa-search | FN-M09-5.1.6 |
| EL-M09-S12-028 | text | visible-default | "Belum ada set Audio KBAT.", fa-headphones | FN-M09-5.1.7 |

#### S13 — `/admin/audio-kbat/create` (83 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S13-001 | link | visible-default | "Kembali", → /admin/audio-kbat, fa-arrow-left | FN-M09-5.2.1 |
| EL-M09-S13-002 | heading | visible-default | "Cipta Set Audio KBAT" | FN-M09-5.2.1 |
| EL-M09-S13-003 | text | visible-default | "Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section." | FN-M09-5.2.1 |
| EL-M09-S13-004 | text | visible-default | "Apa yang cikgu perlu sediakan?" | FN-M09-5.2.2 |
| EL-M09-S13-005 | text | visible-default | "Lengkapkan 30 soalan mengikut turutan asal. Upload audio untuk setiap bahagian: soalan 1-8…" | FN-M09-5.2.2 |
| EL-M09-S13-006 | text | visible-default | "Jika cikgu bekalkan bahan offline, Word lebih mudah untuk menulis soalan dan transkrip. XL…" | FN-M09-5.2.2 |
| EL-M09-S13-007 | link | visible-default | "Template Word", → /admin/audio-kbat/template-word, fa-file-word | FN-M09-5.2.2 |
| EL-M09-S13-008 | link | visible-default | "Template XLSX", → /admin/audio-kbat/template, fa-file-excel | FN-M09-5.2.2 |
| EL-M09-S13-009 | form | visible-default | POST /admin/audio-kbat | FN-M09-5.2.3 |
| EL-M09-S13-010 | hidden-field | hidden-only | `_token`, hidden | FN-M09-5.2.3 |
| EL-M09-S13-011 | card | visible-default | "Maklumat Set" | FN-M09-5.2.3 |
| EL-M09-S13-012 | heading | visible-default | "Maklumat Set" | FN-M09-5.2.3 |
| EL-M09-S13-013 | label | visible-default | "Tajuk Set" | FN-M09-5.2.3 |
| EL-M09-S13-014 | input | visible-default | label "Tajuk Set", `title`, placeholder "Contoh: BM T4 Ujian Mendengar Set 1", required | FN-M09-5.2.3 |
| EL-M09-S13-015 | label | visible-default | "Tahap" | FN-M09-5.2.3 |
| EL-M09-S13-016 | select | visible-default | label "Tahap", `education_level_id`, required, 12 options: Pilih Tahap / Darjah 1 / Darjah 2 / Darjah 3 / Darjah 4 / Darjah 5 / … | FN-M09-5.2.3 |
| EL-M09-S13-017 | label | visible-default | "Subjek" | FN-M09-5.2.3 |
| EL-M09-S13-018 | select | visible-default | label "Subjek", `subject_id`, required, 32 options: Pilih Subjek / Bahasa Arab / Bahasa Cina / Bahasa Inggeris / Bahasa Melayu / Bahasa Tamil / … | FN-M09-5.2.3 |
| EL-M09-S13-019 | label | visible-default | "Status" | FN-M09-5.2.3 |
| EL-M09-S13-020 | select | visible-default | label "Status", `status`, 3 options: Approved / Pending Review / Draft | FN-M09-5.2.3 |
| EL-M09-S13-021 | label | visible-default | "Sumber / Penyumbang" | FN-M09-5.2.3 |
| EL-M09-S13-022 | input | visible-default | label "Sumber / Penyumbang", `source_label`, placeholder "Contoh: Cikgu <name>" | FN-M09-5.2.3 |
| EL-M09-S13-023 | label | visible-default | "Arahan Umum" | FN-M09-5.2.3 |
| EL-M09-S13-024 | textarea | visible-default | label "Arahan Umum", `instructions`, placeholder "Dengar audio bagi setiap bahagian dan jawab semua soalan." | FN-M09-5.2.3 |
| EL-M09-S13-025 | card | visible-default | "Bahagian 1 · Soalan 1-8" | FN-M09-5.2.4 |
| EL-M09-S13-026 | heading | visible-default | "Bahagian 1 · Soalan 1-8" | FN-M09-5.2.4 |
| EL-M09-S13-027 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M09-5.2.4 |
| EL-M09-S13-028 | label | visible-default | "Tajuk Audio" | FN-M09-5.2.4 |
| EL-M09-S13-029 | input | visible-default | label "Tajuk Audio", `sections[1][title]` | FN-M09-5.2.4 |
| EL-M09-S13-030 | label | visible-default | "Fail Audio" | FN-M09-5.2.4 |
| EL-M09-S13-031 | input | visible-default | label "Fail Audio", `sections[1][audio]`, file, accept .mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/* | FN-M09-5.2.4 |
| EL-M09-S13-032 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M09-5.2.4 |
| EL-M09-S13-033 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[1][transcript]`, placeholder "Wajib digalakkan untuk semakan admin." | FN-M09-5.2.4 |
| EL-M09-S13-034 | heading | visible-default | "Soalan 1" | FN-M09-5.2.5 |
| EL-M09-S13-035 | badge | visible-default | "KBAT Audio" | FN-M09-5.2.5 |
| EL-M09-S13-036 | label | visible-default | "Teks Soalan" | FN-M09-5.2.5 |
| EL-M09-S13-037 | textarea | visible-default | `questions[1][question_text]`, required | FN-M09-5.2.5 |
| EL-M09-S13-038 | label | visible-default | "Pilihan A" | FN-M09-5.2.5 |
| EL-M09-S13-039 | input | visible-default | label "Pilihan A", `questions[1][option_a]`, required | FN-M09-5.2.5 |
| EL-M09-S13-040 | label | visible-default | "Pilihan B" | FN-M09-5.2.5 |
| EL-M09-S13-041 | input | visible-default | label "Pilihan B", `questions[1][option_b]`, required | FN-M09-5.2.5 |
| EL-M09-S13-042 | label | visible-default | "Pilihan C" | FN-M09-5.2.5 |
| EL-M09-S13-043 | input | visible-default | label "Pilihan C", `questions[1][option_c]`, required | FN-M09-5.2.5 |
| EL-M09-S13-044 | label | visible-default | "Pilihan D" | FN-M09-5.2.5 |
| EL-M09-S13-045 | input | visible-default | label "Pilihan D", `questions[1][option_d]`, required | FN-M09-5.2.5 |
| EL-M09-S13-046 | label | visible-default | "Jawapan" | FN-M09-5.2.5 |
| EL-M09-S13-047 | select | visible-default | label "Jawapan", `questions[1][correct_answer]`, required, 4 options: A / B / C / D | FN-M09-5.2.5 |
| EL-M09-S13-048 | label | visible-default | "Markah" | FN-M09-5.2.5 |
| EL-M09-S13-049 | input | visible-default | label "Markah", `questions[1][marks]`, number, min 1 max 20 | FN-M09-5.2.5 |
| EL-M09-S13-050 | label | visible-default | "KBAT Level" | FN-M09-5.2.5 |
| EL-M09-S13-051 | input | visible-default | label "KBAT Level", `questions[1][kbat_level]`, number, min 1 max 5 | FN-M09-5.2.5 |
| EL-M09-S13-052 | label | visible-default | "DSKP SP ID" | FN-M09-5.2.5 |
| EL-M09-S13-053 | input | visible-default | label "DSKP SP ID", `questions[1][dskp_sp_id]`, number, placeholder "Optional" | FN-M09-5.2.5 |
| EL-M09-S13-054 | label | visible-default | "Skema / Penjelasan" | FN-M09-5.2.5 |
| EL-M09-S13-055 | textarea | visible-default | `questions[1][explanation]` | FN-M09-5.2.5 |
| EL-M09-S13-056 | card | visible-default | "Bahagian 2 · Soalan 9-16" | FN-M09-5.2.4 |
| EL-M09-S13-057 | heading | visible-default | "Bahagian 2 · Soalan 9-16" | FN-M09-5.2.4 |
| EL-M09-S13-058 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M09-5.2.4 |
| EL-M09-S13-059 | label | visible-default | "Tajuk Audio" | FN-M09-5.2.4 |
| EL-M09-S13-060 | input | visible-default | label "Tajuk Audio", `sections[2][title]` | FN-M09-5.2.4 |
| EL-M09-S13-061 | label | visible-default | "Fail Audio" | FN-M09-5.2.4 |
| EL-M09-S13-062 | input | visible-default | label "Fail Audio", `sections[2][audio]`, file, accept .mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/* | FN-M09-5.2.4 |
| EL-M09-S13-063 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M09-5.2.4 |
| EL-M09-S13-064 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[2][transcript]`, placeholder "Wajib digalakkan untuk semakan admin." | FN-M09-5.2.4 |
| EL-M09-S13-065 | card | visible-default | "Bahagian 3 · Soalan 17-24" | FN-M09-5.2.4 |
| EL-M09-S13-066 | heading | visible-default | "Bahagian 3 · Soalan 17-24" | FN-M09-5.2.4 |
| EL-M09-S13-067 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M09-5.2.4 |
| EL-M09-S13-068 | label | visible-default | "Tajuk Audio" | FN-M09-5.2.4 |
| EL-M09-S13-069 | input | visible-default | label "Tajuk Audio", `sections[3][title]` | FN-M09-5.2.4 |
| EL-M09-S13-070 | label | visible-default | "Fail Audio" | FN-M09-5.2.4 |
| EL-M09-S13-071 | input | visible-default | label "Fail Audio", `sections[3][audio]`, file, accept .mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/* | FN-M09-5.2.4 |
| EL-M09-S13-072 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M09-5.2.4 |
| EL-M09-S13-073 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[3][transcript]`, placeholder "Wajib digalakkan untuk semakan admin." | FN-M09-5.2.4 |
| EL-M09-S13-074 | card | visible-default | "Bahagian 4 · Soalan 25-30" | FN-M09-5.2.4 |
| EL-M09-S13-075 | heading | visible-default | "Bahagian 4 · Soalan 25-30" | FN-M09-5.2.4 |
| EL-M09-S13-076 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M09-5.2.4 |
| EL-M09-S13-077 | label | visible-default | "Tajuk Audio" | FN-M09-5.2.4 |
| EL-M09-S13-078 | input | visible-default | label "Tajuk Audio", `sections[4][title]` | FN-M09-5.2.4 |
| EL-M09-S13-079 | label | visible-default | "Fail Audio" | FN-M09-5.2.4 |
| EL-M09-S13-080 | input | visible-default | label "Fail Audio", `sections[4][audio]`, file, accept .mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/* | FN-M09-5.2.4 |
| EL-M09-S13-081 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M09-5.2.4 |
| EL-M09-S13-082 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[4][transcript]`, placeholder "Wajib digalakkan untuk semakan admin." | FN-M09-5.2.4 |
| EL-M09-S13-083 | button | visible-default | "Simpan Set Audio KBAT", fa-save | FN-M09-5.2.6 |

#### S14 — `/admin/tools/screenshots` (12 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S14-001 | card | visible-default | "Upload Gambar" | FN-M09-9.1.2 |
| EL-M09-S14-002 | heading | visible-default | "Upload Gambar" | FN-M09-9.1.2 |
| EL-M09-S14-003 | text | visible-default | "Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail." | FN-M09-9.1.2 |
| EL-M09-S14-004 | form | visible-default | POST /admin/tools/screenshots | FN-M09-9.1.2 |
| EL-M09-S14-005 | hidden-field | hidden-only | `_token`, hidden | FN-M09-9.1.2 |
| EL-M09-S14-006 | clickable | visible-default | "Klik atau seret fail ke sini Boleh pilih banyak fail", fa-images | FN-M09-9.1.2 |
| EL-M09-S14-007 | input | hidden-only | `files[]`, file, accept image/* | FN-M09-9.1.2 |
| EL-M09-S14-008 | text | visible-default | "Tip: guna nama fail yang ringkas. Sistem akan auto-sanitize nama fail." | FN-M09-9.1.2 |
| EL-M09-S14-009 | card | visible-default | "Fail Sedia Ada" | FN-M09-9.1.3 |
| EL-M09-S14-010 | heading | visible-default | "Fail Sedia Ada" | FN-M09-9.1.3 |
| EL-M09-S14-011 | text | visible-default | "Jumlah: 0 fail" | FN-M09-9.1.3 |
| EL-M09-S14-012 | empty-state | visible-default | "Tiada fail lagi." | FN-M09-9.1.3 |

#### S15 — `/artikel` (246 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S15-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S15-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S15-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S15-004 | heading | visible-default | "Artikel Paling Hangat" | FN-M09-2.1.2 |
| EL-M09-S15-005 | link | visible-default | "📰 POPULAR Tips Belajar Cara Buat Revision Berkesan Seminggu Sebelum Peperiksaan Strategi …", → /artikel/cara-buat-revision-berkesan-seminggu-sebelum-peperiksaan, fa-fire | FN-M09-2.1.2 |
| EL-M09-S15-006 | badge | visible-default | "POPULAR", fa-fire | FN-M09-2.1.2 |
| EL-M09-S15-007 | badge | visible-default | "Tips Belajar" | FN-M09-2.1.2 |
| EL-M09-S15-008 | heading | visible-default | "Cara Buat Revision Berkesan Seminggu Sebelum Peperiksaan" | FN-M09-2.1.2 |
| EL-M09-S15-009 | badge | visible-default | "A" | FN-M09-2.1.2 |
| EL-M09-S15-010 | form | visible-default | GET /artikel | FN-M09-2.1.3 |
| EL-M09-S15-011 | input | visible-default | `search`, placeholder "Cari artikel..." | FN-M09-2.1.3 |
| EL-M09-S15-012 | link | visible-default | "Semua", → /artikel | FN-M09-2.1.4 |
| EL-M09-S15-013 | filter | visible-default | "Tips Belajar", → /artikel?category=TIPS_BELAJAR | FN-M09-2.1.4 |
| EL-M09-S15-014 | filter | visible-default | "Berita", → /artikel?category=BERITA | FN-M09-2.1.4 |
| EL-M09-S15-015 | filter | visible-default | "Motivasi", → /artikel?category=MOTIVASI | FN-M09-2.1.4 |
| EL-M09-S15-016 | filter | visible-default | "Panduan Ibu Bapa", → /artikel?category=PANDUAN_IBU_BAPA | FN-M09-2.1.4 |
| EL-M09-S15-017 | filter | visible-default | "Panduan Guru", → /artikel?category=PANDUAN_GURU | FN-M09-2.1.4 |
| EL-M09-S15-018 | filter | visible-default | "Kejayaan", → /artikel?category=KEJAYAAN | FN-M09-2.1.4 |
| EL-M09-S15-019 | filter | visible-default | "Umum", → /artikel?category=UMUM | FN-M09-2.1.4 |
| EL-M09-S15-020 | link | visible-default | "📰 Tips Belajar AI Ini Apa Sebenarnya? Jom Fahami Bersama! Pernah dengar perkataan AI? Kec…", → /artikel/ai-ini-apa-sebenarnya-jom-fahami-bersama | FN-M09-2.1.5 |
| EL-M09-S15-021 | badge | visible-default | "Tips Belajar" | FN-M09-2.1.5 |
| EL-M09-S15-022 | heading | visible-default | "AI Ini Apa Sebenarnya? Jom Fahami Bersama!" | FN-M09-2.1.5 |
| EL-M09-S15-023 | badge | visible-default | "C" | FN-M09-2.1.5 |
| EL-M09-S15-024 | link | visible-default | "📰 Tips Belajar HOT 5 Tips Belajar Matematik yang Menyeronokkan Matematik tak susah kalau …", → /artikel/5-tips-belajar-matematik, fa-star | FN-M09-2.1.5 |
| EL-M09-S15-025 | badge | visible-default | "Tips Belajar" | FN-M09-2.1.5 |
| EL-M09-S15-026 | badge | visible-default | "HOT", fa-star | FN-M09-2.1.5 |
| EL-M09-S15-027 | heading | visible-default | "5 Tips Belajar Matematik yang Menyeronokkan" | FN-M09-2.1.5 |
| EL-M09-S15-028 | badge | visible-default | "A" | FN-M09-2.1.5 |
| EL-M09-S15-029 | text | conditional | "« Previous", mobile-only | FN-M09-2.1.6 |
| EL-M09-S15-030 | pagination | conditional | "Next »", → /artikel?page=2, mobile-only | FN-M09-2.1.6 |
| EL-M09-S15-031 | text | visible-default | "Showing to of results", desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-032 | text | visible-default | "1", desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-033 | text | visible-default | "18", desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-034 | text | visible-default | "72", desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-035 | text | visible-default | "1", desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-036 | pagination | visible-default | "2", → /artikel?page=2, desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-037 | pagination | visible-default | "3", → /artikel?page=3, desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-038 | pagination | visible-default | "4", → /artikel?page=4, desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-039 | pagination | visible-default | → /artikel?page=2, svg, desktop-only | FN-M09-2.1.6 |
| EL-M09-S15-040 | hidden-field | hidden-only | `category`, hidden | FN-M09-2.1.3 |
| EL-M09-S15-041 | link | conditional | "📰 Berita Perpustakaan Bergerak Sampai ke Pedalaman Sabah Projek perpustakaan bergerak baw…", → /artikel/perpustakaan-bergerak-sampai-ke-pedalaman-sabah, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-042 | badge | conditional | "Berita", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-043 | heading | conditional | "Perpustakaan Bergerak Sampai ke Pedalaman Sabah", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-044 | link | conditional | "📰 Berita Pertandingan Menulis Karangan Kreatif Kebangsaan 2026 Peluang untuk pelajar seko…", → /artikel/pertandingan-menulis-karangan-kreatif-kebangsaan-2026, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-045 | badge | conditional | "Berita", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-046 | heading | conditional | "Pertandingan Menulis Karangan Kreatif Kebangsaan 2026", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-047 | filter | conditional | "Semua", → /artikel?search=zzzqqq, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-048 | filter | conditional | "Tips Belajar", → /artikel?search=zzzqqq&category=TIPS_BELAJAR, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-049 | filter | conditional | "Berita", → /artikel?search=zzzqqq&category=BERITA, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-050 | filter | conditional | "Motivasi", → /artikel?search=zzzqqq&category=MOTIVASI, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-051 | filter | conditional | "Panduan Ibu Bapa", → /artikel?search=zzzqqq&category=PANDUAN_IBU_BAPA, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-052 | filter | conditional | "Panduan Guru", → /artikel?search=zzzqqq&category=PANDUAN_GURU, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-053 | filter | conditional | "Kejayaan", → /artikel?search=zzzqqq&category=KEJAYAAN, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-054 | filter | conditional | "Umum", → /artikel?search=zzzqqq&category=UMUM, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-055 | text | conditional | "🔍", state captured @1280 only | FN-M09-2.1.7 |
| EL-M09-S15-056 | heading | conditional | "Tiada Artikel Dijumpai", state captured @1280 only | FN-M09-2.1.7 |
| EL-M09-S15-057 | text | conditional | "Cuba ubah carian atau pilih kategori lain.", state captured @1280 only | FN-M09-2.1.7 |
| EL-M09-S15-058 | link | conditional | "Lihat Semua Artikel", → /artikel, fa-arrow-left, state captured @1280 only | FN-M09-2.1.7 |
| EL-M09-S15-059 | link | conditional | "📰 Tips Belajar Rahsia Pelajar Cemerlang: Ulangkaji Sebelum Tidur Kajian sains buktikan ul…", → /artikel/rahsia-pelajar-cemerlang-ulangkaji-sebelum-tidur, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-060 | heading | conditional | "Rahsia Pelajar Cemerlang: Ulangkaji Sebelum Tidur", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-061 | link | conditional | "📰 Tips Belajar Cara Buat Nota Bergambar (Mind Map) yang Berkesan Mind map bantu pelajar n…", → /artikel/cara-buat-nota-bergambar-mind-map-yang-berkesan, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-062 | heading | conditional | "Cara Buat Nota Bergambar (Mind Map) yang Berkesan", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-063 | badge | conditional | "C", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-064 | pagination | hidden-only | "« Previous", → /artikel?category=TIPS_BELAJAR&page=1 | FN-M09-2.1.6 |
| EL-M09-S15-065 | text | hidden-only | "Next »" | FN-M09-2.1.6 |
| EL-M09-S15-066 | link | conditional | → /, state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-067 | image | conditional | state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-068 | text | conditional | "\|", state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-069 | text | conditional | "📰", state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-070 | text | conditional | "Artikel", state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-071 | link | conditional | "Log Masuk", → /login, state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-072 | link | conditional | "Daftar Percuma", → /register, state captured @1280 only | FN-M09-2.2.1 |
| EL-M09-S15-073 | text | conditional | "📚", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-074 | text | conditional | "✨", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-075 | text | conditional | "🔥", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-076 | text | conditional | "⭐", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-077 | badge | conditional | "Terkini & Menarik", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-078 | heading | conditional | "Artikel Pilihan", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-079 | text | conditional | ", , dan untuk pelajar Malaysia!", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-080 | text | conditional | "Tips belajar", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-081 | text | conditional | "berita pendidikan", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-082 | text | conditional | "motivasi", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-083 | text | conditional | "panduan", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-084 | text | conditional | "⭐", state captured @1280 only | FN-M09-2.2.2 |
| EL-M09-S15-085 | heading | conditional | "Artikel Paling Hangat", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-086 | text | conditional | "🔥", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-087 | link | conditional | "📰 PILIHAN Tips Belajar Belajar Bahasa Melayu: Teknik KWLH untuk Pemahaman Teknik KWLH ban…", → /artikel/belajar-bahasa-melayu-teknik-kwlh-untuk-pemahaman, fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-088 | badge | conditional | "PILIHAN", fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-089 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-090 | heading | conditional | "Belajar Bahasa Melayu: Teknik KWLH untuk Pemahaman", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-091 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-092 | link | conditional | "📰 POPULAR Tips Belajar Cara Buat Revision Berkesan Seminggu Sebelum Peperiksaan Strategi …", → /artikel/cara-buat-revision-berkesan-seminggu-sebelum-peperiksaan, fa-fire, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-093 | badge | conditional | "POPULAR", fa-fire, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-094 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-095 | heading | conditional | "Cara Buat Revision Berkesan Seminggu Sebelum Peperiksaan", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-096 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-097 | link | conditional | "📰 PILIHAN Tips Belajar Cara Mudah Belajar Sifir Darab 6 hingga 9 Trik jari tangan untuk s…", → /artikel/cara-mudah-belajar-sifir-darab-6-hingga-9, fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-098 | badge | conditional | "PILIHAN", fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-099 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-100 | heading | conditional | "Cara Mudah Belajar Sifir Darab 6 hingga 9", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-101 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-102 | link | conditional | "📰 PILIHAN Tips Belajar 5 Tips Belajar Matematik yang Menyeronokkan Matematik tak susah ka…", → /artikel/5-tips-belajar-matematik, fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-103 | badge | conditional | "PILIHAN", fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-104 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-105 | heading | conditional | "5 Tips Belajar Matematik yang Menyeronokkan", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-106 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-107 | link | conditional | "📰 PILIHAN Tips Belajar Belajar Sambil Bermain: Permainan Pendidikan di Rumah Aktiviti mud…", → /artikel/belajar-sambil-bermain-permainan-pendidikan-di-rumah, fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-108 | badge | conditional | "PILIHAN", fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-109 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-110 | heading | conditional | "Belajar Sambil Bermain: Permainan Pendidikan di Rumah", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-111 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-112 | link | conditional | "📰 PILIHAN Panduan Ibu Bapa Cara Bantu Anak Buat Kerja Rumah Tanpa Drama Tips untuk ibu ba…", → /artikel/cara-bantu-anak-buat-kerja-rumah-tanpa-drama, fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-113 | badge | conditional | "PILIHAN", fa-star, state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-114 | badge | conditional | "Panduan Ibu Bapa", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-115 | heading | conditional | "Cara Bantu Anak Buat Kerja Rumah Tanpa Drama", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-116 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.3 |
| EL-M09-S15-117 | form | conditional | GET /artikel, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-118 | text | conditional | "🔍", state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-119 | input | conditional | `search`, placeholder "Cari artikel menarik...", state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-120 | text | conditional | "Pilih Kategori:", state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-121 | link | conditional | "Semua", → /artikel, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-122 | filter | conditional | "✨ Tips Belajar", → /artikel?category=TIPS_BELAJAR, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-123 | filter | conditional | "✨ Berita", → /artikel?category=BERITA, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-124 | filter | conditional | "✨ Motivasi", → /artikel?category=MOTIVASI, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-125 | filter | conditional | "✨ Panduan Ibu Bapa", → /artikel?category=PANDUAN_IBU_BAPA, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-126 | filter | conditional | "✨ Panduan Guru", → /artikel?category=PANDUAN_GURU, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-127 | filter | conditional | "✨ Kejayaan", → /artikel?category=KEJAYAAN, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-128 | filter | conditional | "✨ Umum", → /artikel?category=UMUM, state captured @1280 only | FN-M09-2.2.4 |
| EL-M09-S15-129 | link | conditional | "📰 Tips Belajar AI Ini Apa Sebenarnya? Jom Fahami Bersama! Pernah dengar perkataan AI? Kec…", → /artikel/ai-ini-apa-sebenarnya-jom-fahami-bersama, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-130 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-131 | heading | conditional | "AI Ini Apa Sebenarnya? Jom Fahami Bersama!", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-132 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-133 | link | conditional | "📰 Tips Belajar HOT 5 Tips Belajar Matematik yang Menyeronokkan Matematik tak susah kalau …", → /artikel/5-tips-belajar-matematik, fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-134 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-135 | badge | conditional | "HOT", fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-136 | heading | conditional | "5 Tips Belajar Matematik yang Menyeronokkan", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-137 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-138 | link | conditional | "📰 Tips Belajar HOT Cara Baca Buku Cerita dalam Bahasa Inggeris Nak pandai English? Mulaka…", → /artikel/cara-baca-buku-cerita-bahasa-inggeris, fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-139 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-140 | badge | conditional | "HOT", fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-141 | heading | conditional | "Cara Baca Buku Cerita dalam Bahasa Inggeris", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-142 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-143 | link | conditional | "📰 Tips Belajar Sains Menyeronokkan: Eksperimen Mudah di Rumah Belajar Sains tak semestiny…", → /artikel/sains-menyeronokkan-eksperimen-di-rumah, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-144 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-145 | heading | conditional | "Sains Menyeronokkan: Eksperimen Mudah di Rumah", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-146 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-147 | link | conditional | "📰 Panduan Ibu Bapa HOT Panduan Ibu Bapa: Jadual Belajar untuk Anak Anak susah nak fokus b…", → /artikel/panduan-ibu-bapa-jadual-belajar, fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-148 | badge | conditional | "Panduan Ibu Bapa", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-149 | badge | conditional | "HOT", fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-150 | heading | conditional | "Panduan Ibu Bapa: Jadual Belajar untuk Anak", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-151 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-152 | link | conditional | "📰 Motivasi Motivasi: Cerita Kejayaan Pelajar Cemerlang Semua pelajar cemerlang pernah ber…", → /artikel/motivasi-cerita-kejayaan-pelajar-cemerlang, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-153 | badge | conditional | "Motivasi", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-154 | heading | conditional | "Motivasi: Cerita Kejayaan Pelajar Cemerlang", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-155 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-156 | link | conditional | "📰 Tips Belajar Cara Mudah Hafal Sifir untuk Darjah 2 dan 3 Sifir penting untuk Matematik.…", → /artikel/cara-mudah-hafal-sifir, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-157 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-158 | heading | conditional | "Cara Mudah Hafal Sifir untuk Darjah 2 dan 3", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-159 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-160 | link | conditional | "📰 Panduan Guru Panduan Guru: Menggunakan PRESTASIPLUS dalam Kelas Cara mengintegrasikan P…", → /artikel/panduan-guru-menggunakan-jombelajar, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-161 | badge | conditional | "Panduan Guru", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-162 | heading | conditional | "Panduan Guru: Menggunakan PRESTASIPLUS dalam Kelas", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-163 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-164 | link | conditional | "📰 Tips Belajar Apa Itu Kombo dan Kenapa Ia Penting? Kombo dalam PRESTASIPLUS boleh bantu …", → /artikel/apa-itu-kombo, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-165 | badge | conditional | "Tips Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-166 | heading | conditional | "Apa Itu Kombo dan Kenapa Ia Penting?", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-167 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-168 | link | conditional | "📰 Umum Tabiat Makan Sihat untuk Pelajar Pintar Apa yang kamu makan mempengaruhi cara otak…", → /artikel/tabiat-makan-sihat-untuk-pelajar-pintar, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-169 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-170 | heading | conditional | "Tabiat Makan Sihat untuk Pelajar Pintar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-171 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-172 | link | conditional | "📰 Umum Cara Jaga Kesihatan Mata Semasa Belajar Pelajar yang banyak guna skrin perlu tahu …", → /artikel/cara-jaga-kesihatan-mata-semasa-belajar, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-173 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-174 | heading | conditional | "Cara Jaga Kesihatan Mata Semasa Belajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-175 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-176 | link | conditional | "📰 Umum Kepentingan Tidur Cukup untuk Pelajar Kurang tidur boleh menjejaskan prestasi seko…", → /artikel/kepentingan-tidur-cukup-untuk-pelajar, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-177 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-178 | heading | conditional | "Kepentingan Tidur Cukup untuk Pelajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-179 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-180 | link | conditional | "📰 Umum Apa Itu STEM dan Kenapa Ia Penting? Pengenalan kepada STEM untuk pelajar sekolah r…", → /artikel/apa-itu-stem-dan-kenapa-ia-penting, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-181 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-182 | heading | conditional | "Apa Itu STEM dan Kenapa Ia Penting?", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-183 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-184 | link | conditional | "📰 Umum Aktiviti Menyeronokkan untuk Cuti Sekolah Idea aktiviti yang produktif dan menyero…", → /artikel/aktiviti-menyeronokkan-untuk-cuti-sekolah, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-185 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-186 | heading | conditional | "Aktiviti Menyeronokkan untuk Cuti Sekolah", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-187 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-188 | link | conditional | "📰 Umum Panduan Keselamatan Internet untuk Pelajar Tips penting untuk kekal selamat semasa…", → /artikel/panduan-keselamatan-internet-untuk-pelajar, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-189 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-190 | heading | conditional | "Panduan Keselamatan Internet untuk Pelajar", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-191 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-192 | link | conditional | "📰 Umum HOT Selamat Datang ke PRESTASIPLUS Ketahui apa itu PRESTASIPLUS dan bagaimana ia b…", → /artikel/selamat-datang-ke-prestasi, fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-193 | badge | conditional | "Umum", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-194 | badge | conditional | "HOT", fa-star, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-195 | heading | conditional | "Selamat Datang ke PRESTASIPLUS", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-196 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-197 | link | conditional | "📰 Berita Perpustakaan Bergerak Sampai ke Pedalaman Sabah Projek perpustakaan bergerak baw…", → /artikel/perpustakaan-bergerak-sampai-ke-pedalaman-sabah, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-198 | badge | conditional | "Berita", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-199 | heading | conditional | "Perpustakaan Bergerak Sampai ke Pedalaman Sabah", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-200 | badge | conditional | "C", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-201 | link | conditional | "📰 Berita Pertandingan Menulis Karangan Kreatif Kebangsaan 2026 Peluang untuk pelajar seko…", → /artikel/pertandingan-menulis-karangan-kreatif-kebangsaan-2026, fa-clock, state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-202 | badge | conditional | "Berita", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-203 | heading | conditional | "Pertandingan Menulis Karangan Kreatif Kebangsaan 2026", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-204 | badge | conditional | "A", state captured @1280 only | FN-M09-2.2.5 |
| EL-M09-S15-205 | text | conditional | "📚", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-206 | text | conditional | "✨", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-207 | text | conditional | "🎯", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-208 | text | conditional | "🚀", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-209 | text | conditional | "⭐", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-210 | text | conditional | "🎉", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-211 | heading | conditional | "Nak Baca Lebih Banyak?", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-212 | text | conditional | "Daftar percuma dan dapat akses penuh ke semua artikel, latih tubi interaktif, ganjaran men…", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-213 | link | conditional | "Daftar Percuma Sekarang", → /register, fa-arrow-right, state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-214 | text | conditional | "100% Percuma • Tiada Kad Kredit Diperlukan", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-215 | image | conditional | state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-216 | text | conditional | "© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd. Hak Cipta Terpelihara.", state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-217 | link | conditional | "Utama", → /, state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-218 | link | conditional | "Artikel", → /artikel, state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-219 | link | conditional | "Video", → /video, state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-220 | link | conditional | "Log Masuk", → /login, state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-221 | link | conditional | "Daftar", → /register, state captured @1280 only | FN-M09-2.2.6 |
| EL-M09-S15-222 | link | conditional | "📰 POPULAR Panduan Ibu Bapa Memilih Tuisyen yang Tepat untuk Anak Panduan untuk ibu bapa y…", → /artikel/memilih-tuisyen-yang-tepat-untuk-anak, fa-fire, state captured @1280 only | FN-M09-2.1.2 |
| EL-M09-S15-223 | badge | conditional | "Panduan Ibu Bapa", state captured @1280 only | FN-M09-2.1.2 |
| EL-M09-S15-224 | heading | conditional | "Memilih Tuisyen yang Tepat untuk Anak", state captured @1280 only | FN-M09-2.1.2 |
| EL-M09-S15-225 | link | conditional | "📰 Motivasi Kenapa Kamu Patut Bangun Awal Setiap Pagi Tabiat bangun awal boleh ubah hidup …", → /artikel/kenapa-kamu-patut-bangun-awal-setiap-pagi, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-226 | badge | conditional | "Motivasi", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-227 | heading | conditional | "Kenapa Kamu Patut Bangun Awal Setiap Pagi", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-228 | link | conditional | "📰 Motivasi Kisah Pelajar Kampung yang Berjaya ke Universiti Cerita inspirasi pelajar dari…", → /artikel/kisah-pelajar-kampung-yang-berjaya-ke-universiti, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-229 | badge | conditional | "Motivasi", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-230 | heading | conditional | "Kisah Pelajar Kampung yang Berjaya ke Universiti", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-231 | badge | conditional | "A", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-232 | filter | conditional | "Semua", → /artikel?search=sifir, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-233 | filter | conditional | "Tips Belajar", → /artikel?search=sifir&category=TIPS_BELAJAR, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-234 | filter | conditional | "Berita", → /artikel?search=sifir&category=BERITA, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-235 | filter | conditional | "Motivasi", → /artikel?search=sifir&category=MOTIVASI, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-236 | filter | conditional | "Panduan Ibu Bapa", → /artikel?search=sifir&category=PANDUAN_IBU_BAPA, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-237 | filter | conditional | "Panduan Guru", → /artikel?search=sifir&category=PANDUAN_GURU, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-238 | filter | conditional | "Kejayaan", → /artikel?search=sifir&category=KEJAYAAN, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-239 | filter | conditional | "Umum", → /artikel?search=sifir&category=UMUM, state captured @1280 only | FN-M09-2.1.4 |
| EL-M09-S15-240 | link | conditional | "📰 Tips Belajar Cara Mudah Hafal Sifir untuk Darjah 2 dan 3 Sifir penting untuk Matematik.…", → /artikel/cara-mudah-hafal-sifir, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-241 | heading | conditional | "Cara Mudah Hafal Sifir untuk Darjah 2 dan 3", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-242 | link | conditional | "📰 Tips Belajar HOT Cara Mudah Belajar Sifir Darab 6 hingga 9 Trik jari tangan untuk sifir…", → /artikel/cara-mudah-belajar-sifir-darab-6-hingga-9, fa-star, state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-243 | heading | conditional | "Cara Mudah Belajar Sifir Darab 6 hingga 9", state captured @1280 only | FN-M09-2.1.5 |
| EL-M09-S15-244 | link | conditional | "📰 POPULAR Kejayaan Pasukan Robotik Sekolah Rendah Menang di Peringkat Antarabangsa Pelaja…", → /artikel/pasukan-robotik-sekolah-rendah-menang-di-peringkat-antarabangsa, fa-fire | FN-M09-2.1.2 |
| EL-M09-S15-245 | badge | conditional | "Kejayaan" | FN-M09-2.1.2 |
| EL-M09-S15-246 | heading | conditional | "Pasukan Robotik Sekolah Rendah Menang di Peringkat Antarabangsa" | FN-M09-2.1.2 |

#### S16 — `/artikel/{slug}` (69 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S16-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S16-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S16-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S16-004 | link | visible-default | "Dashboard", → /dashboard, fa-th-large | FN-M09-2.3.2 |
| EL-M09-S16-005 | text | visible-default | "→" | FN-M09-2.3.2 |
| EL-M09-S16-006 | link | visible-default | "Artikel", → /artikel, fa-newspaper | FN-M09-2.3.2 |
| EL-M09-S16-007 | text | visible-default | "→" | FN-M09-2.3.2 |
| EL-M09-S16-008 | text | visible-default | "Teknik Pomodoro: Belajar 25 Minit, Rehat..." | FN-M09-2.3.2 |
| EL-M09-S16-009 | badge | visible-default | "Tips Belajar" | FN-M09-2.3.3 |
| EL-M09-S16-010 | badge | visible-default | "Darjah 4" | FN-M09-2.3.3 |
| EL-M09-S16-011 | badge | visible-default | "Pilihan", fa-star | FN-M09-2.3.3 |
| EL-M09-S16-012 | heading | visible-default | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M09-2.3.3 |
| EL-M09-S16-013 | text | visible-default | "Teknik Pomodoro bantu pelajar fokus dengan pecahkan masa belajar kepada slot 25 minit." | FN-M09-2.3.3 |
| EL-M09-S16-014 | card | visible-default | "<name>" | FN-M09-2.3.4 |
| EL-M09-S16-015 | card | visible-default | "<name>" | FN-M09-2.3.4 |
| EL-M09-S16-016 | text | visible-default | "A" | FN-M09-2.3.4 |
| EL-M09-S16-017 | text | visible-default | "<name>" | FN-M09-2.3.4 |
| EL-M09-S16-018 | text | visible-default | "24 Dec 2025", fa-calendar | FN-M09-2.3.4 |
| EL-M09-S16-019 | text | visible-default | "•" | FN-M09-2.3.4 |
| EL-M09-S16-020 | text | visible-default | "9 bulan yang lepas", fa-clock | FN-M09-2.3.4 |
| EL-M09-S16-021 | text | visible-default | "👁️" | FN-M09-2.3.4 |
| EL-M09-S16-022 | text | visible-default | "596" | FN-M09-2.3.4 |
| EL-M09-S16-023 | text | visible-default | "Pembaca" | FN-M09-2.3.4 |
| EL-M09-S16-024 | text | visible-default | "❤️" | FN-M09-2.3.4 |
| EL-M09-S16-025 | text | visible-default | "6" | FN-M09-2.3.4 |
| EL-M09-S16-026 | text | visible-default | "Suka" | FN-M09-2.3.4 |
| EL-M09-S16-027 | text | visible-default | "Apa Itu Teknik Pomodoro?" | FN-M09-2.3.5 |
| EL-M09-S16-028 | text | visible-default | "Teknik Pomodoro ialah kaedah pengurusan masa yang dicipta oleh Francesco Cirillo. Caranya …" | FN-M09-2.3.5 |
| EL-M09-S16-029 | text | visible-default | "Kenapa Ia Berkesan?" | FN-M09-2.3.5 |
| EL-M09-S16-030 | text | visible-default | "Otak kita sebenarnya tak boleh fokus terlalu lama. Dengan slot 25 minit, otak kita boleh b…" | FN-M09-2.3.5 |
| EL-M09-S16-031 | text | visible-default | "Cara Guna Teknik Pomodoro" | FN-M09-2.3.5 |
| EL-M09-S16-032 | text | visible-default | "Pilih satu tugasan atau subjek untuk belajar" | FN-M09-2.3.5 |
| EL-M09-S16-033 | text | visible-default | "Set timer 25 minit — FOKUS penuh!" | FN-M09-2.3.5 |
| EL-M09-S16-034 | text | visible-default | "Bila timer berbunyi, rehat 5 minit" | FN-M09-2.3.5 |
| EL-M09-S16-035 | text | visible-default | "Ulang 4 kali, kemudian rehat panjang 15-30 minit" | FN-M09-2.3.5 |
| EL-M09-S16-036 | text | visible-default | "Catat berapa "pomodoro" kamu siap hari ini" | FN-M09-2.3.5 |
| EL-M09-S16-037 | text | visible-default | "Tips Tambahan" | FN-M09-2.3.5 |
| EL-M09-S16-038 | text | visible-default | "Semasa rehat, jangan guna telefon! Buat stretching, minum air, atau jalan-jalan sekejap. I…" | FN-M09-2.3.5 |
| EL-M09-S16-039 | text | visible-default | "Belajar bukan tentang berapa lama, tapi berapa fokus kamu semasa belajar!" | FN-M09-2.3.5 |
| EL-M09-S16-040 | heading | visible-default | "Kongsi Artikel Ini 🎉" | FN-M09-2.3.6 |
| EL-M09-S16-041 | text | visible-default | "Kongsi dengan kawan-kawan supaya mereka pun dapat belajar!" | FN-M09-2.3.6 |
| EL-M09-S16-042 | link | visible-default | → https://wa.me/?text=Teknik+Pomodoro%3A+Belajar+25+Minit%2C+Rehat+5+Minit+https%3, fa-whatsapp | FN-M09-2.3.6 |
| EL-M09-S16-043 | link | visible-default | → https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fprestasiplus.my%2Fart, fa-facebook-f | FN-M09-2.3.6 |
| EL-M09-S16-044 | link | visible-default | → https://twitter.com/intent/tweet?text=Teknik+Pomodoro%3A+Belajar+25+Minit%2C+Reh, fa-twitter | FN-M09-2.3.6 |
| EL-M09-S16-045 | button | visible-default | fa-link | FN-M09-2.3.6 |
| EL-M09-S16-046 | badge | conditional | "Link Disalin!", state captured @1280 only | FN-M09-2.3.6 |
| EL-M09-S16-047 | text | visible-default | "📚" | FN-M09-2.3.7 |
| EL-M09-S16-048 | heading | visible-default | "Artikel Berkaitan" | FN-M09-2.3.7 |
| EL-M09-S16-049 | link | visible-default | "📰 AI Ini Apa Sebenarnya? Jom Fahami Bersama! 7 bulan yang lepas 👁️ 310", → /artikel/ai-ini-apa-sebenarnya-jom-fahami-bersama, fa-clock | FN-M09-2.3.7 |
| EL-M09-S16-050 | heading | visible-default | "AI Ini Apa Sebenarnya? Jom Fahami Bersama!" | FN-M09-2.3.7 |
| EL-M09-S16-051 | link | visible-default | "📰 5 Tips Belajar Matematik yang Menyeronokkan 7 bulan yang lepas 👁️ 543", → /artikel/5-tips-belajar-matematik, fa-clock | FN-M09-2.3.7 |
| EL-M09-S16-052 | heading | visible-default | "5 Tips Belajar Matematik yang Menyeronokkan" | FN-M09-2.3.7 |
| EL-M09-S16-053 | link | visible-default | "📰 Cara Baca Buku Cerita dalam Bahasa Inggeris 7 bulan yang lepas 👁️ 351", → /artikel/cara-baca-buku-cerita-bahasa-inggeris, fa-clock | FN-M09-2.3.7 |
| EL-M09-S16-054 | heading | visible-default | "Cara Baca Buku Cerita dalam Bahasa Inggeris" | FN-M09-2.3.7 |
| EL-M09-S16-055 | card | visible-default | "Artikel Terkini", desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-056 | heading | visible-default | "Artikel Terkini", desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-057 | link | visible-default | "AI Ini Apa Sebenarnya? Jom Fahami Bersama! 7 bulan yang lepas", → /artikel/ai-ini-apa-sebenarnya-jom-fahami-bersama, fa-newspaper, desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-058 | link | visible-default | "5 Tips Belajar Matematik yang Menyeronokkan 7 bulan yang lepas", → /artikel/5-tips-belajar-matematik, fa-newspaper, desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-059 | link | visible-default | "Cara Baca Buku Cerita dalam Bahasa Inggeris 7 bulan yang lepas", → /artikel/cara-baca-buku-cerita-bahasa-inggeris, fa-newspaper, desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-060 | link | visible-default | "Sains Menyeronokkan: Eksperimen Mudah di Rumah 7 bulan yang lepas", → /artikel/sains-menyeronokkan-eksperimen-di-rumah, fa-newspaper, desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-061 | link | visible-default | "Panduan Ibu Bapa: Jadual Belajar untuk Anak 7 bulan yang lepas", → /artikel/panduan-ibu-bapa-jadual-belajar, fa-newspaper, desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-062 | link | visible-default | "Lihat Semua Artikel", → /artikel, fa-arrow-right, desktop-only | FN-M09-2.3.8 |
| EL-M09-S16-063 | text | conditional | "404", state captured @1280 only | FN-M09-2.3.9 |
| EL-M09-S16-064 | text | conditional | "🔍", state captured @1280 only | FN-M09-2.3.9 |
| EL-M09-S16-065 | heading | conditional | "Halaman Tidak Dijumpai", state captured @1280 only | FN-M09-2.3.9 |
| EL-M09-S16-066 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", state captured @1280 only | FN-M09-2.3.9 |
| EL-M09-S16-067 | link | conditional | "Halaman Utama", → /, state captured @1280 only | FN-M09-2.3.9 |
| EL-M09-S16-068 | link | conditional | "Mula Latihan", → /latih-tubi, state captured @1280 only | FN-M09-2.3.9 |
| EL-M09-S16-069 | text | conditional | "PRESTASIPLUS", state captured @1280 only | FN-M09-2.3.9 |

#### S17 — `/video` (235 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S17-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S17-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S17-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S17-004 | form | visible-default | GET /video | FN-M09-6.1.2 |
| EL-M09-S17-005 | input | visible-default | `search`, placeholder "Cari video..." | FN-M09-6.1.2 |
| EL-M09-S17-006 | link | visible-default | "Semua (2260)", → /video | FN-M09-6.1.3 |
| EL-M09-S17-007 | filter | visible-default | "Motivasi (3)", → /video?category=motivasi | FN-M09-6.1.3 |
| EL-M09-S17-008 | filter | visible-default | "Tutorial (12)", → /video?category=tutorial | FN-M09-6.1.3 |
| EL-M09-S17-009 | filter | visible-default | "Tips SPM (3)", → /video?category=tips-spm | FN-M09-6.1.3 |
| EL-M09-S17-010 | filter | visible-default | "Ceramah (2242)", → /video?category=ceramah | FN-M09-6.1.3 |
| EL-M09-S17-011 | link | visible-default | "Lain-lain (0)", → # | FN-M09-6.1.3 |
| EL-M09-S17-012 | link | visible-default | "Matematik (865)", → /video?subject=3 | FN-M09-6.1.4 |
| EL-M09-S17-013 | link | visible-default | "Sejarah (97)", → /video?subject=5 | FN-M09-6.1.4 |
| EL-M09-S17-014 | link | visible-default | "Matematik Tambahan (420)", → /video?subject=8 | FN-M09-6.1.4 |
| EL-M09-S17-015 | link | visible-default | "Fizik (779)", → /video?subject=9 | FN-M09-6.1.4 |
| EL-M09-S17-016 | link | visible-default | "Kimia (96)", → /video?subject=10 | FN-M09-6.1.4 |
| EL-M09-S17-017 | link | visible-default | "Tambah Video", → /video/tambah, fa-plus | FN-M09-6.1.5 |
| EL-M09-S17-018 | link | visible-default | "YouTube Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah A <name> admin 121 tontonan 6 bulan…", → /video/2224, fa-play | FN-M09-6.1.6 |
| EL-M09-S17-019 | image | visible-default | (image) | FN-M09-6.1.6 |
| EL-M09-S17-020 | modal | hidden-only | (modal) | FN-M09-6.1.6 |
| EL-M09-S17-021 | heading | visible-default | "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah" | FN-M09-6.1.6 |
| EL-M09-S17-022 | badge | visible-default | "A" | FN-M09-6.1.6 |
| EL-M09-S17-023 | link | visible-default | "YouTube Pengenalan Asas Nombor Bab 2 Tingkatan 4 A <name> admin 108 tontonan 6 bulan yang …", → /video/64, fa-play | FN-M09-6.1.6 |
| EL-M09-S17-024 | image | visible-default | (image) | FN-M09-6.1.6 |
| EL-M09-S17-025 | modal | hidden-only | (modal) | FN-M09-6.1.6 |
| EL-M09-S17-026 | heading | visible-default | "Pengenalan Asas Nombor Bab 2 Tingkatan 4" | FN-M09-6.1.6 |
| EL-M09-S17-027 | badge | visible-default | "A" | FN-M09-6.1.6 |
| EL-M09-S17-028 | text | conditional | "« Previous", mobile-only | FN-M09-6.1.7 |
| EL-M09-S17-029 | pagination | conditional | "Next »", → /video?page=2, mobile-only | FN-M09-6.1.7 |
| EL-M09-S17-030 | text | visible-default | "Showing to of results", desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-031 | text | visible-default | "1", desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-032 | text | visible-default | "24", desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-033 | text | visible-default | "2260", desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-034 | text | visible-default | "1", desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-035 | pagination | visible-default | "2", → /video?page=2, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-036 | pagination | visible-default | "3", → /video?page=3, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-037 | pagination | visible-default | "4", → /video?page=4, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-038 | pagination | visible-default | "5", → /video?page=5, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-039 | pagination | visible-default | "6", → /video?page=6, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-040 | pagination | visible-default | "7", → /video?page=7, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-041 | pagination | visible-default | "8", → /video?page=8, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-042 | pagination | visible-default | "9", → /video?page=9, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-043 | pagination | visible-default | "10", → /video?page=10, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-044 | text | visible-default | "...", desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-045 | pagination | visible-default | "94", → /video?page=94, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-046 | pagination | visible-default | "95", → /video?page=95, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-047 | pagination | visible-default | → /video?page=2, svg, desktop-only | FN-M09-6.1.7 |
| EL-M09-S17-048 | filter | conditional | "Sejarah (1)", → /video?category=motivasi&subject=5, state captured @1280 only | FN-M09-6.1.4 |
| EL-M09-S17-049 | link | conditional | "YouTube Kenapa Sejarah Penting Untuk Masa Depan Kita A <name> admin 254 tontonan 6 bulan y…", → /video/18, fa-play, state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-050 | heading | conditional | "Kenapa Sejarah Penting Untuk Masa Depan Kita", state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-051 | link | conditional | "YouTube Semangat Belajar - Kunci Kejayaan Pelajar A <name> admin 143 tontonan 6 bulan yang…", → /video/17, fa-play, state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-052 | heading | conditional | "Semangat Belajar - Kunci Kejayaan Pelajar", state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-053 | filter | conditional | "Semua (0)", → /video?search=zzzqqq, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-054 | link | conditional | "Motivasi (0)", → #, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-055 | link | conditional | "Tutorial (0)", → #, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-056 | link | conditional | "Tips SPM (0)", → #, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-057 | link | conditional | "Ceramah (0)", → #, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-058 | text | conditional | "🎬", state captured @1280 only | FN-M09-6.1.8 |
| EL-M09-S17-059 | heading | conditional | "Tiada Video Dijumpai", state captured @1280 only | FN-M09-6.1.8 |
| EL-M09-S17-060 | text | conditional | "Cuba ubah carian atau pilih kategori lain.", state captured @1280 only | FN-M09-6.1.8 |
| EL-M09-S17-061 | link | conditional | "Lihat Semua Video", → /video, fa-arrow-left, state captured @1280 only | FN-M09-6.1.8 |
| EL-M09-S17-062 | link | conditional | → /, state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-063 | image | conditional | state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-064 | text | conditional | "\|", state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-065 | text | conditional | "🎬", state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-066 | text | conditional | "Video", state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-067 | link | conditional | "Log Masuk", → /login, state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-068 | link | conditional | "Daftar Percuma", → /register, state captured @1280 only | FN-M09-6.2.1 |
| EL-M09-S17-069 | text | conditional | "🎬", state captured @1280 only | FN-M09-6.2.2 |
| EL-M09-S17-070 | text | conditional | "🎯", state captured @1280 only | FN-M09-6.2.2 |
| EL-M09-S17-071 | badge | conditional | "VIDEO PEMBELAJARAN", state captured @1280 only | FN-M09-6.2.2 |
| EL-M09-S17-072 | heading | conditional | "Tonton & Fahami", state captured @1280 only | FN-M09-6.2.2 |
| EL-M09-S17-073 | text | conditional | "Tutorial, tips SPM, motivasi dan banyak lagi — semua dalam satu platform!", state captured @1280 only | FN-M09-6.2.2 |
| EL-M09-S17-074 | form | conditional | GET /video, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-075 | link | conditional | "Semua (2260)", → /video, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-076 | filter | conditional | "Motivasi (3)", → /video?category=motivasi, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-077 | filter | conditional | "Tutorial (12)", → /video?category=tutorial, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-078 | filter | conditional | "Tips SPM (3)", → /video?category=tips-spm, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-079 | filter | conditional | "Ceramah (2242)", → /video?category=ceramah, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-080 | link | conditional | "Lain-lain (0)", → #, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-081 | link | conditional | "Matematik (865)", → /video?subject=3, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-082 | link | conditional | "Sejarah (97)", → /video?subject=5, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-083 | link | conditional | "Matematik Tambahan (420)", → /video?subject=8, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-084 | link | conditional | "Fizik (779)", → /video?subject=9, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-085 | link | conditional | "Kimia (96)", → /video?subject=10, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-086 | link | conditional | "YouTube Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah A Admin PRESTASI+ admin 121 tontona…", → /video/2224, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-087 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-088 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-089 | heading | conditional | "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-090 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-091 | link | conditional | "YouTube Pengenalan Asas Nombor Bab 2 Tingkatan 4 A Admin PRESTASI+ admin 108 tontonan 6 bu…", → /video/64, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-092 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-093 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-094 | heading | conditional | "Pengenalan Asas Nombor Bab 2 Tingkatan 4", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-095 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-096 | link | conditional | "YouTube F4 24/12 Pengukuran pt. 2 A Admin PRESTASI+ admin 107 tontonan 6 bulan yang lepas", → /video/433, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-097 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-098 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-099 | heading | conditional | "F4 24/12 Pengukuran pt. 2", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-100 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-101 | link | conditional | "YouTube Medan lastik - 4.1: Daya keatas konduktor pembawa arus \| Keelektromagnetan (Fizik …", → /video/825, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-102 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-103 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-104 | heading | conditional | "Medan lastik - 4.1: Daya keatas konduktor pembawa arus \| Keelektromagnetan (Fizik KSSM Tin…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-105 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-106 | link | conditional | "YouTube Fizik Tingkatan 5 KSSM Bab 2 Tekanan \| Tekanan Atmosfera \| Barometer Ringkas (Soal…", → /video/1020, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-107 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-108 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-109 | heading | conditional | "Fizik Tingkatan 5 KSSM Bab 2 Tekanan \| Tekanan Atmosfera \| Barometer Ringkas (Soalan Menca…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-110 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-111 | link | conditional | "YouTube Reinventing Education for Malaysia - TEDx A Admin PRESTASI+ admin 338 tontonan 6 b…", → /video/19, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-112 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-113 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-114 | heading | conditional | "Reinventing Education for Malaysia - TEDx", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-115 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-116 | link | conditional | "YouTube Sejarah Tingkatan 1: Bab 2 - Zaman Air Batu A Admin PRESTASI+ admin 103 tontonan 6…", → /video/2225, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-117 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-118 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-119 | heading | conditional | "Sejarah Tingkatan 1: Bab 2 - Zaman Air Batu", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-120 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-121 | link | conditional | "YouTube Apikasi Pembezaan: Menentukan kecerunan tangen dan normal A Admin PRESTASI+ admin …", → /video/65, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-122 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-123 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-124 | heading | conditional | "Apikasi Pembezaan: Menentukan kecerunan tangen dan normal", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-125 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-126 | link | conditional | "YouTube F4 23/12 Pengukuran pt. 1 A Admin PRESTASI+ admin 95 tontonan 6 bulan yang lepas", → /video/434, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-127 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-128 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-129 | heading | conditional | "F4 23/12 Pengukuran pt. 1", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-130 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-131 | link | conditional | "YouTube Faktor pengaruhi daya - 4.1: Daya keatas konduktor \| Keelektromagnetan (Fizik KSSM…", → /video/827, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-132 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-133 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-134 | heading | conditional | "Faktor pengaruhi daya - 4.1: Daya keatas konduktor \| Keelektromagnetan (Fizik KSSM Tingkat…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-135 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-136 | link | conditional | "YouTube Tenaga Keupayaan Kenyal \| Fizik Tingkatan 5 KSSM Bab 1 - Daya dan Gerakan II A Adm…", → /video/1021, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-137 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-138 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-139 | heading | conditional | "Tenaga Keupayaan Kenyal \| Fizik Tingkatan 5 KSSM Bab 1 - Daya dan Gerakan II", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-140 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-141 | link | conditional | "YouTube Sejarah Tingkatan 1: Bab 3 - Zaman Prasejarah A Admin PRESTASI+ admin 105 tontonan…", → /video/2226, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-142 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-143 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-144 | heading | conditional | "Sejarah Tingkatan 1: Bab 3 - Zaman Prasejarah", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-145 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-146 | link | conditional | "YouTube Bab 1 Matematik Tambahan Tingkatan 4: Garis mencancang untuk mengesan suatu graf i…", → /video/66, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-147 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-148 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-149 | heading | conditional | "Bab 1 Matematik Tambahan Tingkatan 4: Garis mencancang untuk mengesan suatu graf ialah fun…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-150 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-151 | link | conditional | "YouTube Latihan - 6.2: Pantulan dalam penuh \| Cahaya & optik (Fizik KSSM Tingkatan 4) A Ad…", → /video/435, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-152 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-153 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-154 | heading | conditional | "Latihan - 6.2: Pantulan dalam penuh \| Cahaya & optik (Fizik KSSM Tingkatan 4)", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-155 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-156 | link | conditional | "YouTube Corak dan kekuatan medan elektrik - 2.1: Arus dan beza keupayaan \| Elektrik (Fizik…", → /video/852, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-157 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-158 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-159 | heading | conditional | "Corak dan kekuatan medan elektrik - 2.1: Arus dan beza keupayaan \| Elektrik (Fizik KSSM Ti…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-160 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-161 | link | conditional | "YouTube Matematik Tambahan SPM 2023 Kertas 2 - Soalan 1 - 5 (Kertas Sebenar) A Admin PREST…", → /video/1022, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-162 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-163 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-164 | heading | conditional | "Matematik Tambahan SPM 2023 Kertas 2 - Soalan 1 - 5 (Kertas Sebenar)", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-165 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-166 | link | conditional | "YouTube Sejarah Tingkatan 1: Bab 4 - Mengenali Tamadun A Admin PRESTASI+ admin 118 tontona…", → /video/2227, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-167 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-168 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-169 | heading | conditional | "Sejarah Tingkatan 1: Bab 4 - Mengenali Tamadun", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-170 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-171 | link | conditional | "YouTube Jawab soalan persamaan linear dalam satu pemboleh ubah dengan kalkulator A Admin P…", → /video/67, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-172 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-173 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-174 | heading | conditional | "Jawab soalan persamaan linear dalam satu pemboleh ubah dengan kalkulator", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-175 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-176 | link | conditional | "YouTube Latihan Teleskop dan Mikroskop - 6.5: Peralatan optik \| Cahaya & optik (Fizik KSSM…", → /video/436, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-177 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-178 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-179 | heading | conditional | "Latihan Teleskop dan Mikroskop - 6.5: Peralatan optik \| Cahaya & optik (Fizik KSSM Tingkat…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-180 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-181 | link | conditional | "YouTube Sistem Lif - 1.1: Daya paduan \| Daya dan Gerakan II (Fizik KSSM Tingkatan 5) A Adm…", → /video/877, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-182 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-183 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-184 | heading | conditional | "Sistem Lif - 1.1: Daya paduan \| Daya dan Gerakan II (Fizik KSSM Tingkatan 5)", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-185 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-186 | link | conditional | "YouTube SPM Add Maths 2023 Paper 2 - Question 1 - 5 (Kertas Sebenar) A Admin PRESTASI+ adm…", → /video/1023, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-187 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-188 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-189 | heading | conditional | "SPM Add Maths 2023 Paper 2 - Question 1 - 5 (Kertas Sebenar)", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-190 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-191 | link | conditional | "YouTube Sejarah Tingkatan 1: Bab 5 - Tamadun Awal Dunia A Admin PRESTASI+ admin 102 tonton…", → /video/2228, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-192 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-193 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-194 | heading | conditional | "Sejarah Tingkatan 1: Bab 5 - Tamadun Awal Dunia", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-195 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-196 | link | conditional | "YouTube Pengiraan sukatan serakan data tak terkumpul guna kalkulator A Admin PRESTASI+ adm…", → /video/68, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-197 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-198 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-199 | heading | conditional | "Pengiraan sukatan serakan data tak terkumpul guna kalkulator", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-200 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-201 | link | conditional | "YouTube Rekabentuk Teleskop dan Mikroskop - 6.5: Peralatan optik \| Cahaya & optik (Fizik K…", → /video/437, fa-play, state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-202 | image | conditional | state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-203 | modal | hidden-only | (modal) | FN-M09-6.2.3 |
| EL-M09-S17-204 | heading | conditional | "Rekabentuk Teleskop dan Mikroskop - 6.5: Peralatan optik \| Cahaya & optik (Fizik KSSM Ting…", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-205 | badge | conditional | "A", state captured @1280 only | FN-M09-6.2.3 |
| EL-M09-S17-206 | text | conditional | "🎬", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-207 | text | conditional | "📚", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-208 | text | conditional | "🎯", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-209 | text | conditional | "🚀", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-210 | text | conditional | "🎓", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-211 | heading | conditional | "Nak Tonton Lebih Banyak?", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-212 | text | conditional | "Daftar percuma dan dapat akses penuh ke semua video, latih tubi interaktif, ganjaran menar…", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-213 | link | conditional | "Daftar Percuma Sekarang", → /register, fa-arrow-right, state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-214 | text | conditional | "100% Percuma • Tiada Kad Kredit Diperlukan", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-215 | image | conditional | state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-216 | text | conditional | "© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd. Hak Cipta Terpelihara.", state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-217 | link | conditional | "Utama", → /, state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-218 | link | conditional | "Artikel", → /artikel, state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-219 | link | conditional | "Video", → /video, state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-220 | link | conditional | "Log Masuk", → /login, state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-221 | link | conditional | "Daftar", → /register, state captured @1280 only | FN-M09-6.2.4 |
| EL-M09-S17-222 | link | conditional | "YouTube Kimia Tingkatan 4 KSSM Bab 4 Jadual Berkala Unsur \| Tindak Balas Unsur Kumpulan 17…", → /video/2220, fa-play, state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-223 | heading | conditional | "Kimia Tingkatan 4 KSSM Bab 4 Jadual Berkala Unsur \| Tindak Balas Unsur Kumpulan 17 dengan …", state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-224 | link | conditional | "YouTube Kimia Tingkatan 4 KSSM Bab 4 Jadual Berkala Unsur \| Unsur dalam Kumpulan 17 A <nam…", → /video/2221, fa-play, state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-225 | heading | conditional | "Kimia Tingkatan 4 KSSM Bab 4 Jadual Berkala Unsur \| Unsur dalam Kumpulan 17", state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-226 | pagination | hidden-only | "« Previous", → /video?page=94 | FN-M09-6.1.7 |
| EL-M09-S17-227 | text | hidden-only | "Next »" | FN-M09-6.1.7 |
| EL-M09-S17-228 | link | conditional | "Semua (97)", → /video?subject=5, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-229 | filter | conditional | "Motivasi (1)", → /video?subject=5&category=motivasi, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-230 | filter | conditional | "Tutorial (12)", → /video?subject=5&category=tutorial, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-231 | filter | conditional | "Tips SPM (3)", → /video?subject=5&category=tips-spm, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-232 | filter | conditional | "Ceramah (81)", → /video?subject=5&category=ceramah, state captured @1280 only | FN-M09-6.1.3 |
| EL-M09-S17-233 | link | conditional | "Reset Subjek", → /video, fa-times, state captured @1280 only | FN-M09-6.1.4 |
| EL-M09-S17-234 | link | conditional | "YouTube Sejarah Tingkatan 1: Bab 2 - Zaman Air Batu A <name> admin 103 tontonan 6 bulan ya…", → /video/2225, fa-play, state captured @1280 only | FN-M09-6.1.6 |
| EL-M09-S17-235 | heading | conditional | "Sejarah Tingkatan 1: Bab 2 - Zaman Air Batu", state captured @1280 only | FN-M09-6.1.6 |

#### S18 — `/video/{id}` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S18-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S18-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S18-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S18-004 | link | visible-default | "Semua Video", → /video, fa-arrow-left | FN-M09-6.3.2 |
| EL-M09-S18-005 | text | visible-default | "/" | FN-M09-6.3.2 |
| EL-M09-S18-006 | text | visible-default | "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah" | FN-M09-6.3.2 |
| EL-M09-S18-007 | card | visible-default | "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah" | FN-M09-6.3.3 |
| EL-M09-S18-008 | heading | visible-default | "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah" | FN-M09-6.3.3 |
| EL-M09-S18-009 | text | visible-default | "120 tontonan" | FN-M09-6.3.3 |
| EL-M09-S18-010 | text | visible-default | "·" | FN-M09-6.3.3 |
| EL-M09-S18-011 | text | visible-default | "03 Mar 2026" | FN-M09-6.3.3 |
| EL-M09-S18-012 | link | visible-default | "Edit", → /video/2224/edit, fa-pen | FN-M09-6.3.4 |
| EL-M09-S18-013 | form | visible-default | DELETE /video/2224, return confirm('Padam video ini?') | FN-M09-6.3.4 |
| EL-M09-S18-014 | hidden-field | hidden-only | `_token`, hidden | FN-M09-6.3.4 |
| EL-M09-S18-015 | hidden-field | hidden-only | `_method`, hidden | FN-M09-6.3.4 |
| EL-M09-S18-016 | button | visible-default | "Padam", fa-trash | FN-M09-6.3.4 |
| EL-M09-S18-017 | badge | visible-default | "YouTube", fa-youtube | FN-M09-6.3.5 |
| EL-M09-S18-018 | badge | visible-default | "Ceramah" | FN-M09-6.3.5 |
| EL-M09-S18-019 | badge | visible-default | "Sejarah", fa-book | FN-M09-6.3.5 |
| EL-M09-S18-020 | badge | visible-default | "A" | FN-M09-6.3.5 |
| EL-M09-S18-021 | text | visible-default | "<name>" | FN-M09-6.3.5 |
| EL-M09-S18-022 | text | visible-default | "admin" | FN-M09-6.3.5 |
| EL-M09-S18-023 | text | visible-default | "Kredit penuh kepada Cikgu <name> — seorang pendidik Sejarah yang luar biasa dan berdedikas…" | FN-M09-6.3.5 |
| EL-M09-S18-024 | heading | visible-default | "Video Berkaitan" | FN-M09-6.3.6 |
| EL-M09-S18-025 | link | visible-default | "Sejarah Bersama Chekgu <name>: Tamadun Awal Dunia <name> · 126 tontonan", → /video/2260, fa-play | FN-M09-6.3.6 |
| EL-M09-S18-026 | image | visible-default | (image) | FN-M09-6.3.6 |
| EL-M09-S18-027 | heading | visible-default | "Sejarah Bersama Chekgu <name>: Tamadun Awal Dunia" | FN-M09-6.3.6 |
| EL-M09-S18-028 | link | visible-default | "Format PT3 Sejarah <name> · 123 tontonan", → /video/2259, fa-play | FN-M09-6.3.6 |
| EL-M09-S18-029 | image | visible-default | (image) | FN-M09-6.3.6 |
| EL-M09-S18-030 | heading | visible-default | "Format PT3 Sejarah" | FN-M09-6.3.6 |
| EL-M09-S18-031 | text | conditional | "404", state captured @1280 only | FN-M09-6.3.7 |
| EL-M09-S18-032 | text | conditional | "🔍", state captured @1280 only | FN-M09-6.3.7 |
| EL-M09-S18-033 | heading | conditional | "Halaman Tidak Dijumpai", state captured @1280 only | FN-M09-6.3.7 |
| EL-M09-S18-034 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", state captured @1280 only | FN-M09-6.3.7 |
| EL-M09-S18-035 | link | conditional | "Halaman Utama", → /, state captured @1280 only | FN-M09-6.3.7 |
| EL-M09-S18-036 | link | conditional | "Mula Latihan", → /latih-tubi, state captured @1280 only | FN-M09-6.3.7 |
| EL-M09-S18-037 | text | conditional | "PRESTASIPLUS", state captured @1280 only | FN-M09-6.3.7 |

#### S19 — `/video/{id}/edit` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S19-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S19-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S19-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S19-004 | link | visible-default | → /video/2224, fa-arrow-left | FN-M09-6.5.2 |
| EL-M09-S19-005 | heading | visible-default | "Edit Video" | FN-M09-6.5.2 |
| EL-M09-S19-006 | text | visible-default | "Kemaskini maklumat video" | FN-M09-6.5.2 |
| EL-M09-S19-007 | form | visible-default | PUT /video/2224 | FN-M09-6.5.3 |
| EL-M09-S19-008 | hidden-field | hidden-only | `_token`, hidden | FN-M09-6.5.3 |
| EL-M09-S19-009 | hidden-field | hidden-only | `_method`, hidden | FN-M09-6.5.3 |
| EL-M09-S19-010 | card | visible-default | "URL Video *" | FN-M09-6.5.3 |
| EL-M09-S19-011 | label | visible-default | "URL Video *" | FN-M09-6.5.3 |
| EL-M09-S19-012 | input | visible-default | label "URL Video *", `video_url`, url, placeholder "https://www.youtube.com/watch?v=...", required | FN-M09-6.5.3 |
| EL-M09-S19-013 | text | visible-default | "Sokongan: YouTube, Vimeo, Dailymotion, TikTok, Facebook", fa-info-circle | FN-M09-6.5.3 |
| EL-M09-S19-014 | image | visible-default | (image) | FN-M09-6.5.3 |
| EL-M09-S19-015 | text | visible-default | "Platform dikesan:", fa-check-circle | FN-M09-6.5.3 |
| EL-M09-S19-016 | text | visible-default | "Youtube" | FN-M09-6.5.3 |
| EL-M09-S19-017 | card | visible-default | "Tajuk Video *" | FN-M09-6.5.3 |
| EL-M09-S19-018 | label | visible-default | "Tajuk Video *" | FN-M09-6.5.3 |
| EL-M09-S19-019 | input | visible-default | label "Tajuk Video *", `title`, required | FN-M09-6.5.3 |
| EL-M09-S19-020 | label | visible-default | "Penerangan" | FN-M09-6.5.3 |
| EL-M09-S19-021 | textarea | visible-default | label "Penerangan", `description`, maxlength 1000 | FN-M09-6.5.3 |
| EL-M09-S19-022 | card | visible-default | "Kategori *" | FN-M09-6.5.3 |
| EL-M09-S19-023 | label | visible-default | "Kategori *" | FN-M09-6.5.3 |
| EL-M09-S19-024 | select | visible-default | label "Kategori *", `category`, required, 5 options: Motivasi / Tutorial / Tips SPM / Ceramah / Lain-lain | FN-M09-6.5.3 |
| EL-M09-S19-025 | label | visible-default | "Subjek" | FN-M09-6.5.3 |
| EL-M09-S19-026 | select | visible-default | label "Subjek", `subject_id`, 32 options: Tiada subjek khusus / Bahasa Melayu / Bahasa Inggeris / Matematik / Sains / Sejarah / … | FN-M09-6.5.3 |
| EL-M09-S19-027 | label | visible-default | "Siapa boleh lihat? *" | FN-M09-6.5.3 |
| EL-M09-S19-028 | label | visible-default | "Semua Pengguna" | FN-M09-6.5.3 |
| EL-M09-S19-029 | radio | hidden-only | label "Semua Pengguna", `visibility`, radio | FN-M09-6.5.3 |
| EL-M09-S19-030 | label | visible-default | "Sekolah Saya" | FN-M09-6.5.3 |
| EL-M09-S19-031 | radio | hidden-only | label "Sekolah Saya", `visibility`, radio, disabled | FN-M09-6.5.3 |
| EL-M09-S19-032 | button | visible-default | "Simpan Perubahan", fa-save | FN-M09-6.5.4 |
| EL-M09-S19-033 | link | visible-default | "Batal", → /video/2224 | FN-M09-6.5.4 |
| EL-M09-S19-034 | text | conditional | "404", state captured @1280 only | FN-M09-6.5.5 |
| EL-M09-S19-035 | text | conditional | "🔍", state captured @1280 only | FN-M09-6.5.5 |
| EL-M09-S19-036 | heading | conditional | "Halaman Tidak Dijumpai", state captured @1280 only | FN-M09-6.5.5 |
| EL-M09-S19-037 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", state captured @1280 only | FN-M09-6.5.5 |
| EL-M09-S19-038 | link | conditional | "Halaman Utama", → /, state captured @1280 only | FN-M09-6.5.5 |
| EL-M09-S19-039 | link | conditional | "Mula Latihan", → /latih-tubi, state captured @1280 only | FN-M09-6.5.5 |
| EL-M09-S19-040 | text | conditional | "PRESTASIPLUS", state captured @1280 only | FN-M09-6.5.5 |

#### S20 — `/video/tambah` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S20-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S20-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S20-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S20-004 | link | visible-default | → /video, fa-arrow-left | FN-M09-6.4.2 |
| EL-M09-S20-005 | heading | visible-default | "Tambah Video Baru" | FN-M09-6.4.2 |
| EL-M09-S20-006 | text | visible-default | "Paste sahaja link video — kami akan buat selebihnya" | FN-M09-6.4.2 |
| EL-M09-S20-007 | form | visible-default | POST /video | FN-M09-6.4.3 |
| EL-M09-S20-008 | hidden-field | hidden-only | `_token`, hidden | FN-M09-6.4.3 |
| EL-M09-S20-009 | card | visible-default | "URL Video *" | FN-M09-6.4.3 |
| EL-M09-S20-010 | label | visible-default | "URL Video *" | FN-M09-6.4.3 |
| EL-M09-S20-011 | input | visible-default | label "URL Video *", `video_url`, url, placeholder "https://www.youtube.com/watch?v=...", required | FN-M09-6.4.3 |
| EL-M09-S20-012 | text | visible-default | "Sokongan: YouTube, Vimeo, Dailymotion, TikTok, Facebook", fa-info-circle | FN-M09-6.4.3 |
| EL-M09-S20-013 | image | conditional | state captured @1280 only | FN-M09-6.4.3 |
| EL-M09-S20-014 | text | conditional | "Platform dikesan:", fa-check-circle, state captured @1280 only | FN-M09-6.4.3 |
| EL-M09-S20-015 | card | visible-default | "Tajuk Video *" | FN-M09-6.4.4 |
| EL-M09-S20-016 | label | visible-default | "Tajuk Video *" | FN-M09-6.4.4 |
| EL-M09-S20-017 | input | visible-default | label "Tajuk Video *", `title`, placeholder "Contoh: Tips Skor A+ Matematik SPM", required | FN-M09-6.4.4 |
| EL-M09-S20-018 | label | visible-default | "Penerangan (opsional)" | FN-M09-6.4.4 |
| EL-M09-S20-019 | textarea | visible-default | label "Penerangan (opsional)", `description`, placeholder "Terangkan secara ringkas tentang video ini...", maxlength 1000 | FN-M09-6.4.4 |
| EL-M09-S20-020 | card | visible-default | "Kategori *" | FN-M09-6.4.5 |
| EL-M09-S20-021 | label | visible-default | "Kategori *" | FN-M09-6.4.5 |
| EL-M09-S20-022 | select | visible-default | label "Kategori *", `category`, required, 6 options: Pilih kategori... / Motivasi / Tutorial / Tips SPM / Ceramah / Lain-lain | FN-M09-6.4.5 |
| EL-M09-S20-023 | label | visible-default | "Subjek (opsional)" | FN-M09-6.4.5 |
| EL-M09-S20-024 | select | visible-default | label "Subjek (opsional)", `subject_id`, 32 options: Tiada subjek khusus / Bahasa Melayu / Bahasa Inggeris / Matematik / Sains / Sejarah / … | FN-M09-6.4.5 |
| EL-M09-S20-025 | label | visible-default | "Siapa boleh lihat? *" | FN-M09-6.4.6 |
| EL-M09-S20-026 | label | visible-default | "Semua Pengguna Boleh dilihat oleh semua" | FN-M09-6.4.6 |
| EL-M09-S20-027 | radio | hidden-only | label "Semua Pengguna Boleh dilihat oleh semua", `visibility`, radio | FN-M09-6.4.6 |
| EL-M09-S20-028 | label | visible-default | "Sekolah Saya Tiada sekolah" | FN-M09-6.4.6 |
| EL-M09-S20-029 | radio | hidden-only | label "Sekolah Saya Tiada sekolah", `visibility`, radio, disabled | FN-M09-6.4.6 |
| EL-M09-S20-030 | badge | visible-default | "A" | FN-M09-6.4.7 |
| EL-M09-S20-031 | text | visible-default | "<name>" | FN-M09-6.4.7 |
| EL-M09-S20-032 | text | visible-default | "·" | FN-M09-6.4.7 |
| EL-M09-S20-033 | text | visible-default | "admin" | FN-M09-6.4.7 |
| EL-M09-S20-034 | text | visible-default | "Nama anda akan dipaparkan bersama video", fa-info-circle | FN-M09-6.4.7 |
| EL-M09-S20-035 | button | visible-default | "Terbitkan Video", fa-upload | FN-M09-6.4.8 |
| EL-M09-S20-036 | link | visible-default | "Batal", → /video | FN-M09-6.4.8 |
| EL-M09-S20-037 | text | conditional | "Vimeo", state captured @1280 only | FN-M09-6.4.3 |

#### S21 — `/audio-kbat` (11 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S21-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S21-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S21-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S21-004 | badge | visible-default | "Ujian Mendengar", fa-headphones | FN-M09-5.3.2 |
| EL-M09-S21-005 | heading | visible-default | "Audio KBAT" | FN-M09-5.3.2 |
| EL-M09-S21-006 | text | visible-default | "Dengar audio mengikut bahagian dan jawab soalan yang dipaparkan serentak. Set ini tidak di…" | FN-M09-5.3.2 |
| EL-M09-S21-007 | form | visible-default | GET /audio-kbat | FN-M09-5.3.3 |
| EL-M09-S21-008 | select | visible-default | `education_level_id`, 12 options: Semua Tahap / Darjah 1 / Darjah 2 / Darjah 3 / Darjah 4 / Darjah 5 / … | FN-M09-5.3.3 |
| EL-M09-S21-009 | select | visible-default | `subject_id`, 32 options: Semua Subjek / Bahasa Arab / Bahasa Cina / Bahasa Inggeris / Bahasa Melayu / Bahasa Tamil / … | FN-M09-5.3.3 |
| EL-M09-S21-010 | button | visible-default | "Tapis", fa-search | FN-M09-5.3.3 |
| EL-M09-S21-011 | text | visible-default | "Belum ada set Audio KBAT yang approved.", fa-headphones | FN-M09-5.3.4 |

#### S22 — `/perutusan` (46 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S22-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S22-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S22-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S22-004 | heading | visible-default | "Perutusan Rasmi" | FN-M09-7.1.2 |
| EL-M09-S22-005 | text | visible-default | "Maklumat & berita dari pihak pengurusan" | FN-M09-7.1.2 |
| EL-M09-S22-006 | link | visible-default | "Tulis Perutusan", → /perutusan/tulis, fa-pen-fancy | FN-M09-7.1.2 |
| EL-M09-S22-007 | link | visible-default | "Perutusan Saya", → /perutusan/saya, fa-folder-open | FN-M09-7.1.2 |
| EL-M09-S22-008 | card | visible-default | "Disematkan" | FN-M09-7.1.3 |
| EL-M09-S22-009 | text | visible-default | "Disematkan", desktop-only | FN-M09-7.1.3 |
| EL-M09-S22-010 | badge | visible-default | "AD" | FN-M09-7.1.4 |
| EL-M09-S22-011 | text | visible-default | "<person>" | FN-M09-7.1.4 |
| EL-M09-S22-012 | badge | visible-default | "Pengetua" | FN-M09-7.1.4 |
| EL-M09-S22-013 | text | visible-default | "Sekolah", fa-school | FN-M09-7.1.4 |
| EL-M09-S22-014 | text | visible-default | "6 bulan yang lepas" | FN-M09-7.1.4 |
| EL-M09-S22-015 | link | visible-default | "Video Ucapan Selamat Hari Raya Dari Pihak Pengurusan SMK Bandar Seri Putra ✦ ✦ ✦ بِسْمِ ال…", → /perutusan/4 | FN-M09-7.1.5 |
| EL-M09-S22-016 | heading | visible-default | "Video Ucapan Selamat Hari Raya Dari Pihak Pengurusan SMK Bandar Seri Putra" | FN-M09-7.1.5 |
| EL-M09-S22-017 | text | visible-default | "Video disertakan" | FN-M09-7.1.6 |
| EL-M09-S22-018 | text | visible-default | "👍 1" | FN-M09-7.1.6 |
| EL-M09-S22-019 | text | visible-default | "0 komen", fa-comment | FN-M09-7.1.6 |
| EL-M09-S22-020 | text | visible-default | "3 baca", fa-eye | FN-M09-7.1.6 |
| EL-M09-S22-021 | link | visible-default | "Baca selanjutnya", → /perutusan/4, fa-arrow-right | FN-M09-7.1.7 |
| EL-M09-S22-022 | card | visible-default | "Disematkan" | FN-M09-7.1.3 |
| EL-M09-S22-023 | text | visible-default | "Disematkan", desktop-only | FN-M09-7.1.3 |
| EL-M09-S22-024 | badge | visible-default | "SA" | FN-M09-7.1.4 |
| EL-M09-S22-025 | text | visible-default | "<person>" | FN-M09-7.1.4 |
| EL-M09-S22-026 | badge | visible-default | "Pengetua" | FN-M09-7.1.4 |
| EL-M09-S22-027 | text | visible-default | "Sekolah", fa-school | FN-M09-7.1.4 |
| EL-M09-S22-028 | text | visible-default | "6 bulan yang lepas" | FN-M09-7.1.4 |
| EL-M09-S22-029 | link | visible-default | "Ucapan Penghargaan & Ramadan – Menyambut Syawal dengan Hikmah Assalamualaikum warahmatulla…", → /perutusan/2 | FN-M09-7.1.5 |
| EL-M09-S22-030 | heading | visible-default | "Ucapan Penghargaan & Ramadan – Menyambut Syawal dengan Hikmah" | FN-M09-7.1.5 |
| EL-M09-S22-031 | text | visible-default | "0 komen", fa-comment | FN-M09-7.1.6 |
| EL-M09-S22-032 | text | visible-default | "4 baca", fa-eye | FN-M09-7.1.6 |
| EL-M09-S22-033 | link | visible-default | "Baca selanjutnya", → /perutusan/2, fa-arrow-right | FN-M09-7.1.7 |
| EL-M09-S22-034 | card | visible-default | "SM" | FN-M09-7.1.4 |
| EL-M09-S22-035 | badge | visible-default | "SM" | FN-M09-7.1.4 |
| EL-M09-S22-036 | text | visible-default | "<person>" | FN-M09-7.1.4 |
| EL-M09-S22-037 | badge | visible-default | "Pengetua" | FN-M09-7.1.4 |
| EL-M09-S22-038 | text | visible-default | "Sekolah", fa-school | FN-M09-7.1.4 |
| EL-M09-S22-039 | text | visible-default | "6 bulan yang lepas" | FN-M09-7.1.4 |
| EL-M09-S22-040 | link | visible-default | "Video Ucapan Selamat Hari Raya 2026 ✦ ✦ ✦ بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ Dengan Nama…", → /perutusan/3 | FN-M09-7.1.5 |
| EL-M09-S22-041 | heading | visible-default | "Video Ucapan Selamat Hari Raya 2026" | FN-M09-7.1.5 |
| EL-M09-S22-042 | text | visible-default | "Video disertakan" | FN-M09-7.1.6 |
| EL-M09-S22-043 | text | visible-default | "❤️ 5" | FN-M09-7.1.6 |
| EL-M09-S22-044 | text | visible-default | "0 komen", fa-comment | FN-M09-7.1.6 |
| EL-M09-S22-045 | text | visible-default | "55 baca", fa-eye | FN-M09-7.1.6 |
| EL-M09-S22-046 | link | visible-default | "Baca selanjutnya", → /perutusan/3, fa-arrow-right | FN-M09-7.1.7 |

#### S23 — `/perutusan/{id}` (79 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S23-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S23-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S23-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S23-004 | link | visible-default | "Kembali ke senarai", → /perutusan, fa-arrow-left | FN-M09-7.2.2 |
| EL-M09-S23-005 | card | visible-default | "<person>" | FN-M09-7.2.3 |
| EL-M09-S23-006 | text | visible-default | "AD" | FN-M09-7.2.3 |
| EL-M09-S23-007 | text | visible-default | "<person>" | FN-M09-7.2.3 |
| EL-M09-S23-008 | badge | visible-default | "Pengetua" | FN-M09-7.2.3 |
| EL-M09-S23-009 | text | visible-default | "Sekolah", fa-school | FN-M09-7.2.3 |
| EL-M09-S23-010 | text | visible-default | "17 Mar 2026, 11:23PM" | FN-M09-7.2.3 |
| EL-M09-S23-011 | text | visible-default | "Awam", fa-globe | FN-M09-7.2.3 |
| EL-M09-S23-012 | text | visible-default | "Disematkan", fa-thumbtack | FN-M09-7.2.3 |
| EL-M09-S23-013 | heading | visible-default | "Video Ucapan Selamat Hari Raya Dari Pihak Pengurusan SMK Bandar Seri Putra" | FN-M09-7.2.4 |
| EL-M09-S23-014 | text | visible-default | "✦ ✦ ✦" | FN-M09-7.2.4 |
| EL-M09-S23-015 | text | visible-default | "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ" | FN-M09-7.2.4 |
| EL-M09-S23-016 | text | visible-default | "Dengan Nama Allah Yang Maha Pemurah Lagi Maha Penyayang" | FN-M09-7.2.4 |
| EL-M09-S23-017 | text | visible-default | "Selamat Hari Raya Aidilfitri" | FN-M09-7.2.4 |
| EL-M09-S23-018 | text | visible-default | "1 Syawal 1447H / 2026M" | FN-M09-7.2.4 |
| EL-M09-S23-019 | text | visible-default | "✦ ✦ ✦" | FN-M09-7.2.4 |
| EL-M09-S23-020 | text | visible-default | "Ucapan Perutusan Hari Raya Aidilfitri 2026" | FN-M09-7.2.4 |
| EL-M09-S23-021 | text | visible-default | "Daripada Pihak Pengurusan Sekolah" | FN-M09-7.2.4 |
| EL-M09-S23-022 | text | visible-default | "Kepada Warga Guru dan Pelajar Yang Dihormati" | FN-M09-7.2.4 |
| EL-M09-S23-023 | text | visible-default | "Assalamualaikum Warahmatullahi Wabarakatuh dan Salam Sejahtera," | FN-M09-7.2.4 |
| EL-M09-S23-024 | text | visible-default | "Alhamdulillah, segala puji bagi Allah SWT kerana dengan limpah kurnia-Nya, kita masih dibe…" | FN-M09-7.2.4 |
| EL-M09-S23-025 | text | visible-default | "Hari Raya Aidilfitri 1447H" | FN-M09-7.2.4 |
| EL-M09-S23-026 | text | visible-default | "Pihak sekolah dengan penuh rasa syukur dan kerendahan hati merakamkan ucapan kepada seluru…" | FN-M09-7.2.4 |
| EL-M09-S23-027 | text | visible-default | "Selamat Hari Raya Aidilfitri, Maaf Zahir dan Batin" | FN-M09-7.2.4 |
| EL-M09-S23-028 | text | visible-default | "Bulan Ramadan yang baru sahaja kita tempuhi adalah sebuah madrasah yang agung — mendidik k…" | FN-M09-7.2.4 |
| EL-M09-S23-029 | text | visible-default | "kesabaran, keikhlasan, dan ketaqwaan" | FN-M09-7.2.4 |
| EL-M09-S23-030 | text | visible-default | "Kepada para yang dihormati — terima kasih di atas pengorbanan, dedikasi, dan amanah yang t…" | FN-M09-7.2.4 |
| EL-M09-S23-031 | text | visible-default | "guru dan kakitangan" | FN-M09-7.2.4 |
| EL-M09-S23-032 | text | visible-default | "Kepada para yang dikasihi — jadikanlah Syawal ini sebagai titik permulaan baharu. Tingkatk…" | FN-M09-7.2.4 |
| EL-M09-S23-033 | text | visible-default | "pelajar" | FN-M09-7.2.4 |
| EL-M09-S23-034 | text | visible-default | "Marilah kita manfaatkan perayaan mulia ini sebagai peluang untuk , memohon kemaafan sesama…" | FN-M09-7.2.4 |
| EL-M09-S23-035 | text | visible-default | "mempererat silaturrahim" | FN-M09-7.2.4 |
| EL-M09-S23-036 | text | visible-default | "Sekali lagi," | FN-M09-7.2.4 |
| EL-M09-S23-037 | text | visible-default | ""Selamat Hari Raya Aidilfitri — Maaf Zahir dan Batin."" | FN-M09-7.2.4 |
| EL-M09-S23-038 | text | visible-default | ""Semoga Allah SWT menerima segala amal ibadah kita," | FN-M09-7.2.4 |
| EL-M09-S23-039 | text | visible-default | "melimpahkan rahmat dan keberkatan-Nya ke atas kita semua," | FN-M09-7.2.4 |
| EL-M09-S23-040 | text | visible-default | "dan menjadikan kita golongan yang sentiasa bersyukur."" | FN-M09-7.2.4 |
| EL-M09-S23-041 | text | visible-default | "Aamiin Ya Rabbal 'Alamin." | FN-M09-7.2.4 |
| EL-M09-S23-042 | text | visible-default | "Hormat daripada," | FN-M09-7.2.4 |
| EL-M09-S23-043 | text | visible-default | "Pihak Pengurusan Sekolah" | FN-M09-7.2.4 |
| EL-M09-S23-044 | text | visible-default | "SMK Bandar Seri Putra" | FN-M09-7.2.4 |
| EL-M09-S23-045 | text | visible-default | "Syawal 1447H / 2026M" | FN-M09-7.2.4 |
| EL-M09-S23-046 | text | visible-default | "🌙 ⭐" | FN-M09-7.2.4 |
| EL-M09-S23-047 | text | visible-default | "Takbir Bergema, Hati Bersatu" | FN-M09-7.2.4 |
| EL-M09-S23-048 | form | visible-default | POST /perutusan/4/react | FN-M09-7.2.5 |
| EL-M09-S23-049 | hidden-field | hidden-only | `_token`, hidden | FN-M09-7.2.5 |
| EL-M09-S23-050 | hidden-field | hidden-only | `type`, hidden | FN-M09-7.2.5 |
| EL-M09-S23-051 | button | visible-default | "👍 Suka 1" | FN-M09-7.2.5 |
| EL-M09-S23-052 | form | visible-default | POST /perutusan/4/react | FN-M09-7.2.5 |
| EL-M09-S23-053 | hidden-field | hidden-only | `_token`, hidden | FN-M09-7.2.5 |
| EL-M09-S23-054 | hidden-field | hidden-only | `type`, hidden | FN-M09-7.2.5 |
| EL-M09-S23-055 | button | visible-default | "❤️ Cinta" | FN-M09-7.2.5 |
| EL-M09-S23-056 | form | visible-default | POST /perutusan/4/react | FN-M09-7.2.5 |
| EL-M09-S23-057 | hidden-field | hidden-only | `_token`, hidden | FN-M09-7.2.5 |
| EL-M09-S23-058 | hidden-field | hidden-only | `type`, hidden | FN-M09-7.2.5 |
| EL-M09-S23-059 | button | visible-default | "🙏 Terima Kasih" | FN-M09-7.2.5 |
| EL-M09-S23-060 | text | visible-default | "3 baca", fa-eye | FN-M09-7.2.6 |
| EL-M09-S23-061 | text | visible-default | "0 komen", fa-comment | FN-M09-7.2.6 |
| EL-M09-S23-062 | text | visible-default | "Pautan Awam (boleh kongsi tanpa login)" | FN-M09-7.2.7 |
| EL-M09-S23-063 | input | visible-default | readonly | FN-M09-7.2.7 |
| EL-M09-S23-064 | link | visible-default | "Kongsi ke WhatsApp", → https://wa.me/?text=Video+Ucapan+Selamat+Hari+Raya+Dari+Pihak+Pengurusan+SMK+Ban, fa-whatsapp | FN-M09-7.2.7 |
| EL-M09-S23-065 | card | visible-default | "Komen" | FN-M09-7.2.8 |
| EL-M09-S23-066 | heading | visible-default | "Komen" | FN-M09-7.2.8 |
| EL-M09-S23-067 | form | visible-default | POST /perutusan/4/comment | FN-M09-7.2.8 |
| EL-M09-S23-068 | hidden-field | hidden-only | `_token`, hidden | FN-M09-7.2.8 |
| EL-M09-S23-069 | textarea | visible-default | `body`, placeholder "Tulis komen anda...", required, maxlength 1000 | FN-M09-7.2.8 |
| EL-M09-S23-070 | text | visible-default | "Komen akan disemak sebelum dipaparkan" | FN-M09-7.2.8 |
| EL-M09-S23-071 | button | visible-default | "Hantar" | FN-M09-7.2.8 |
| EL-M09-S23-072 | text | visible-default | "Belum ada komen" | FN-M09-7.2.8 |
| EL-M09-S23-073 | text | conditional | "404", state captured @1280 only | FN-M09-7.2.9 |
| EL-M09-S23-074 | text | conditional | "🔍", state captured @1280 only | FN-M09-7.2.9 |
| EL-M09-S23-075 | heading | conditional | "Halaman Tidak Dijumpai", state captured @1280 only | FN-M09-7.2.9 |
| EL-M09-S23-076 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", state captured @1280 only | FN-M09-7.2.9 |
| EL-M09-S23-077 | link | conditional | "Halaman Utama", → /, state captured @1280 only | FN-M09-7.2.9 |
| EL-M09-S23-078 | link | conditional | "Mula Latihan", → /latih-tubi, state captured @1280 only | FN-M09-7.2.9 |
| EL-M09-S23-079 | text | conditional | "PRESTASIPLUS", state captured @1280 only | FN-M09-7.2.9 |

#### S24 — `/perutusan/tulis` (93 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S24-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S24-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S24-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S24-004 | form | visible-default | POST /perutusan/tulis | FN-M09-7.3.2 |
| EL-M09-S24-005 | hidden-field | hidden-only | `_token`, hidden | FN-M09-7.3.2 |
| EL-M09-S24-006 | text | visible-default | "Skop Perutusan" | FN-M09-7.3.2 |
| EL-M09-S24-007 | text | visible-default | "Seluruh Malaysia (Kebangsaan)" | FN-M09-7.3.2 |
| EL-M09-S24-008 | label | visible-default | "Tajuk Perutusan" | FN-M09-7.3.3 |
| EL-M09-S24-009 | input | visible-default | label "Tajuk Perutusan", `title`, placeholder "cth: Perutusan Pengetua Semester 2 2026", required | FN-M09-7.3.3 |
| EL-M09-S24-010 | label | visible-default | "Kandungan" | FN-M09-7.3.4 |
| EL-M09-S24-011 | toggle | visible-default | "HTML", button, fa-code | FN-M09-7.3.5 |
| EL-M09-S24-012 | dropdown-trigger | visible-default | svg | FN-M09-7.3.4 |
| EL-M09-S24-013 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-014 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-015 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-016 | select | hidden-only | 3 options: / / | FN-M09-7.3.4 |
| EL-M09-S24-017 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-018 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-019 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-020 | dropdown-trigger | visible-default | svg | FN-M09-7.3.4 |
| EL-M09-S24-021 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-022 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-023 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-024 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-025 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-026 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-027 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-028 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-029 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-030 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-031 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-032 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-033 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-034 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-035 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-036 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-037 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-038 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-039 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-040 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-041 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-042 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-043 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-044 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-045 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-046 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-047 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-048 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-049 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-050 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-051 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-052 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-053 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-054 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-055 | button | conditional | state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-056 | select | hidden-only | 35 options: / / / / / / … | FN-M09-7.3.4 |
| EL-M09-S24-057 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-058 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-059 | dropdown-trigger | visible-default | svg | FN-M09-7.3.4 |
| EL-M09-S24-060 | button | conditional | svg, state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-061 | button | conditional | svg, state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-062 | button | conditional | svg, state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-063 | button | conditional | svg, state captured @1280 only | FN-M09-7.3.4 |
| EL-M09-S24-064 | select | hidden-only | 4 options: / / / | FN-M09-7.3.4 |
| EL-M09-S24-065 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-066 | button | visible-default | button, svg | FN-M09-7.3.4 |
| EL-M09-S24-067 | link | hidden-only | → about:blank | FN-M09-7.3.4 |
| EL-M09-S24-068 | input | hidden-only | (input) | FN-M09-7.3.4 |
| EL-M09-S24-069 | textarea | conditional | state captured @1280 only | FN-M09-7.3.5 |
| EL-M09-S24-070 | hidden-field | hidden-only | `body`, hidden | FN-M09-7.3.5 |
| EL-M09-S24-071 | label | visible-default | "Gambar (maks 2MB setiap satu)" | FN-M09-7.3.6 |
| EL-M09-S24-072 | input | hidden-only | label "Klik untuk muat naik gambar JPG, PNG, GIF - maks 2MB", `images[]`, file, accept image/* | FN-M09-7.3.6 |
| EL-M09-S24-073 | label | visible-default | "Klik untuk muat naik gambar JPG, PNG, GIF - maks 2MB" | FN-M09-7.3.6 |
| EL-M09-S24-074 | label | visible-default | "Dokumen PDF (maks 5MB setiap satu)" | FN-M09-7.3.6 |
| EL-M09-S24-075 | input | hidden-only | label "Klik untuk muat naik PDF PDF sahaja - maks 5MB", `documents[]`, file, accept .pdf | FN-M09-7.3.6 |
| EL-M09-S24-076 | label | visible-default | "Klik untuk muat naik PDF PDF sahaja - maks 5MB" | FN-M09-7.3.6 |
| EL-M09-S24-077 | label | visible-default | "Pautan Video YouTube (Pilihan)" | FN-M09-7.3.7 |
| EL-M09-S24-078 | input | visible-default | label "Pautan Video YouTube (Pilihan)", `youtube_url`, url, placeholder "https://www.youtube.com/watch?v=..." | FN-M09-7.3.7 |
| EL-M09-S24-079 | checkbox | visible-default | label "Sematkan di atas (maks 2)", `is_pinned`, checkbox | FN-M09-7.3.8 |
| EL-M09-S24-080 | label | visible-default | "Sematkan di atas (maks 2)" | FN-M09-7.3.8 |
| EL-M09-S24-081 | checkbox | visible-default | label "Jadikan Awam (boleh dibaca tanpa login)", `is_public`, checkbox | FN-M09-7.3.8 |
| EL-M09-S24-082 | label | visible-default | "Jadikan Awam (boleh dibaca tanpa login)" | FN-M09-7.3.8 |
| EL-M09-S24-083 | label | visible-default | "Status Penerbitan" | FN-M09-7.3.9 |
| EL-M09-S24-084 | label | visible-default | "Terbit Sekarang Terus dipaparkan" | FN-M09-7.3.9 |
| EL-M09-S24-085 | radio | visible-default | label "Terbit Sekarang Terus dipaparkan", `status`, radio | FN-M09-7.3.9 |
| EL-M09-S24-086 | label | visible-default | "Jadualkan Pilih tarikh & masa" | FN-M09-7.3.9 |
| EL-M09-S24-087 | radio | visible-default | label "Jadualkan Pilih tarikh & masa", `status`, radio | FN-M09-7.3.9 |
| EL-M09-S24-088 | label | visible-default | "Draf Simpan dahulu" | FN-M09-7.3.9 |
| EL-M09-S24-089 | radio | visible-default | label "Draf Simpan dahulu", `status`, radio | FN-M09-7.3.9 |
| EL-M09-S24-090 | label | conditional | "Tarikh & Masa Penerbitan", state captured @1280 only | FN-M09-7.3.9 |
| EL-M09-S24-091 | input | conditional | label "Tarikh & Masa Penerbitan", `scheduled_at`, datetime-local, state captured @1280 only | FN-M09-7.3.9 |
| EL-M09-S24-092 | link | visible-default | "Batal", → /perutusan | FN-M09-7.3.10 |
| EL-M09-S24-093 | button | visible-default | "Hantar Perutusan", fa-paper-plane | FN-M09-7.3.10 |

#### S25 — `/perutusan/saya` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S25-001 | text | hidden-only | "LIVE:", fa-circle | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S25-002 | text | hidden-only | "MAIN" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S25-003 | text | hidden-only | "DAFTAR" | Excluded: M16 tournament banner (hidden `tournamentBanner()` widget of the user shell; `x-if` templates "LIVE:", "MAIN", "DAFTAR") |
| EL-M09-S25-004 | link | visible-default | "Kembali", → /perutusan, fa-arrow-left | FN-M09-7.4.2 |
| EL-M09-S25-005 | link | visible-default | "Tulis Baru", → /perutusan/tulis, fa-pen-fancy | FN-M09-7.4.2 |
| EL-M09-S25-006 | card | visible-default | "Anda belum menulis perutusan" | FN-M09-7.4.3 |
| EL-M09-S25-007 | text | visible-default | "Anda belum menulis perutusan" | FN-M09-7.4.3 |

#### S26 — `/panduan` (323 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S26-001 | link | visible-default | → / | FN-M09-8.1.1 |
| EL-M09-S26-002 | image | visible-default | (image) | FN-M09-8.1.1 |
| EL-M09-S26-003 | link | visible-default | "Laman Utama", → /, fa-home, desktop-only | FN-M09-8.1.1 |
| EL-M09-S26-004 | link | visible-default | "Artikel", → /artikel, fa-newspaper, desktop-only | FN-M09-8.1.1 |
| EL-M09-S26-005 | link | visible-default | "Dashboard", → /dashboard, fa-th-large, desktop-only | FN-M09-8.1.1 |
| EL-M09-S26-006 | toggle | conditional | fa-bars, mobile-only | FN-M09-8.1.1 |
| EL-M09-S26-007 | link | conditional | "Laman Utama", → /, fa-home, mobile-only | FN-M09-8.1.1 |
| EL-M09-S26-008 | link | conditional | "Artikel", → /artikel, fa-newspaper, mobile-only | FN-M09-8.1.1 |
| EL-M09-S26-009 | link | conditional | "Dashboard", → /dashboard, fa-th-large, mobile-only | FN-M09-8.1.1 |
| EL-M09-S26-010 | text | visible-default | "📖" | FN-M09-8.1.2 |
| EL-M09-S26-011 | heading | visible-default | "Panduan Pengguna PRESTASIPLUS" | FN-M09-8.1.2 |
| EL-M09-S26-012 | text | visible-default | "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!" | FN-M09-8.1.2 |
| EL-M09-S26-013 | clickable | hidden-only | (clickable) | FN-M09-8.1.3 |
| EL-M09-S26-014 | clickable | visible-default | "👨‍🎓 Pelajar Darjah 1 – Tingkatan 5" | FN-M09-8.1.3 |
| EL-M09-S26-015 | clickable | visible-default | "👩‍🏫 Guru Guru Mata Pelajaran" | FN-M09-8.1.3 |
| EL-M09-S26-016 | clickable | visible-default | "👪 Ibu Bapa Pemantauan Anak" | FN-M09-8.1.3 |
| EL-M09-S26-017 | clickable | visible-default | "🏫 Admin Sekolah Pengetua / GPK" | FN-M09-8.1.3 |
| EL-M09-S26-018 | clickable | visible-default | "📊 PPD / JPN Pegawai Daerah / Negeri" | FN-M09-8.1.3 |
| EL-M09-S26-019 | card | visible-default | "Cara Daftar Akaun Pelajar" | FN-M09-8.1.4 |
| EL-M09-S26-020 | heading | visible-default | "Cara Daftar Akaun Pelajar" | FN-M09-8.1.4 |
| EL-M09-S26-021 | card | visible-default | "Buka Laman Web" | FN-M09-8.1.4 |
| EL-M09-S26-022 | text | visible-default | "1" | FN-M09-8.1.4 |
| EL-M09-S26-023 | heading | visible-default | "Buka Laman Web" | FN-M09-8.1.4 |
| EL-M09-S26-024 | text | visible-default | "Layari menggunakan pelayar web (Chrome/Safari)." | FN-M09-8.1.4 |
| EL-M09-S26-025 | text | visible-default | "prestasiplus.my" | FN-M09-8.1.4 |
| EL-M09-S26-026 | card | visible-default | "Klik "Daftar"" | FN-M09-8.1.4 |
| EL-M09-S26-027 | text | visible-default | "2" | FN-M09-8.1.4 |
| EL-M09-S26-028 | heading | visible-default | "Klik "Daftar"" | FN-M09-8.1.4 |
| EL-M09-S26-029 | text | visible-default | "Di halaman utama, klik butang atau minta guru daftarkan anda." | FN-M09-8.1.4 |
| EL-M09-S26-030 | text | visible-default | ""Daftar Percuma"" | FN-M09-8.1.4 |
| EL-M09-S26-031 | card | visible-default | "Isi Maklumat" | FN-M09-8.1.4 |
| EL-M09-S26-032 | text | visible-default | "3" | FN-M09-8.1.4 |
| EL-M09-S26-033 | heading | visible-default | "Isi Maklumat" | FN-M09-8.1.4 |
| EL-M09-S26-034 | text | visible-default | "Masukkan , dan pilih tingkatan/darjah anda." | FN-M09-8.1.4 |
| EL-M09-S26-035 | text | visible-default | "nama penuh, e-mel, kata laluan" | FN-M09-8.1.4 |
| EL-M09-S26-036 | card | visible-default | "Masuk Kelas" | FN-M09-8.1.4 |
| EL-M09-S26-037 | text | visible-default | "4" | FN-M09-8.1.4 |
| EL-M09-S26-038 | heading | visible-default | "Masuk Kelas" | FN-M09-8.1.4 |
| EL-M09-S26-039 | text | visible-default | "Minta daripada guru anda dan masukkan untuk sertai kelas." | FN-M09-8.1.4 |
| EL-M09-S26-040 | text | visible-default | "kod kelas" | FN-M09-8.1.4 |
| EL-M09-S26-041 | card | visible-default | "Siap! Mula Berlatih" | FN-M09-8.1.4 |
| EL-M09-S26-042 | text | visible-default | "✓" | FN-M09-8.1.4 |
| EL-M09-S26-043 | heading | visible-default | "Siap! Mula Berlatih" | FN-M09-8.1.4 |
| EL-M09-S26-044 | text | visible-default | "Anda kini boleh mula latih tubi, kumpul kombo, dan naik ranking!" | FN-M09-8.1.4 |
| EL-M09-S26-045 | card | visible-default | "Apa Yang Boleh Anda Buat" | FN-M09-8.1.4 |
| EL-M09-S26-046 | heading | visible-default | "Apa Yang Boleh Anda Buat" | FN-M09-8.1.4 |
| EL-M09-S26-047 | card | visible-default | "Latih Tubi" | FN-M09-8.1.4 |
| EL-M09-S26-048 | text | visible-default | "📝" | FN-M09-8.1.4 |
| EL-M09-S26-049 | heading | visible-default | "Latih Tubi" | FN-M09-8.1.4 |
| EL-M09-S26-050 | text | visible-default | "Jawab soalan mengikut subjek dan topik. Semakin banyak latihan, semakin pandai!" | FN-M09-8.1.4 |
| EL-M09-S26-051 | card | visible-default | "Kombo Harian" | FN-M09-8.1.4 |
| EL-M09-S26-052 | text | visible-default | "🔥" | FN-M09-8.1.4 |
| EL-M09-S26-053 | heading | visible-default | "Kombo Harian" | FN-M09-8.1.4 |
| EL-M09-S26-054 | text | visible-default | "Latih tubi setiap hari untuk kekalkan kombo anda. Jangan putus!" | FN-M09-8.1.4 |
| EL-M09-S26-055 | card | visible-default | "Battle" | FN-M09-8.1.4 |
| EL-M09-S26-056 | text | visible-default | "⚔️" | FN-M09-8.1.4 |
| EL-M09-S26-057 | heading | visible-default | "Battle" | FN-M09-8.1.4 |
| EL-M09-S26-058 | text | visible-default | "Cabaran masa nyata — lawan kawan atau pelajar lain secara langsung!" | FN-M09-8.1.4 |
| EL-M09-S26-059 | card | visible-default | "Prestasi 360" | FN-M09-8.1.4 |
| EL-M09-S26-060 | text | visible-default | "📊" | FN-M09-8.1.4 |
| EL-M09-S26-061 | heading | visible-default | "Prestasi 360" | FN-M09-8.1.4 |
| EL-M09-S26-062 | text | visible-default | "Lihat kemajuan anda: ketepatan, subjek kuat/lemah, dan cadangan latihan." | FN-M09-8.1.4 |
| EL-M09-S26-063 | card | visible-default | "Ranking & Lencana" | FN-M09-8.1.4 |
| EL-M09-S26-064 | text | visible-default | "🏆" | FN-M09-8.1.4 |
| EL-M09-S26-065 | heading | visible-default | "Ranking & Lencana" | FN-M09-8.1.4 |
| EL-M09-S26-066 | text | visible-default | "Naik ranking sekolah dan kumpul lencana pencapaian!" | FN-M09-8.1.4 |
| EL-M09-S26-067 | card | visible-default | "Koin & Ganjaran" | FN-M09-8.1.4 |
| EL-M09-S26-068 | text | visible-default | "🪙" | FN-M09-8.1.4 |
| EL-M09-S26-069 | heading | visible-default | "Koin & Ganjaran" | FN-M09-8.1.4 |
| EL-M09-S26-070 | text | visible-default | "Setiap latihan beri koin. Kumpul dan tukar dengan ganjaran menarik." | FN-M09-8.1.4 |
| EL-M09-S26-071 | card | visible-default | "Soalan Lazim Pelajar" | FN-M09-8.1.9 |
| EL-M09-S26-072 | heading | visible-default | "Soalan Lazim Pelajar" | FN-M09-8.1.9 |
| EL-M09-S26-073 | clickable | visible-default | "Macam mana nak reset kata laluan?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S26-074 | text | conditional | "Pergi ke halaman login, klik "Lupa Kata Laluan", masukkan e-mel anda, dan ikut arahan dala…", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-075 | clickable | visible-default | "Saya tak ada e-mel. Boleh daftar?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S26-076 | text | conditional | "Ya! Minta guru anda daftarkan akaun untuk anda melalui panel guru. Guru boleh import senar…", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-077 | clickable | visible-default | "Apa itu Kombo?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S26-078 | text | hidden-only | "Kombo bermaksud hari berturut-turut anda berlatih. Jika anda berlatih setiap hari tanpa pu…" | FN-M09-8.1.9 |
| EL-M09-S26-079 | clickable | visible-default | "Boleh tukar kelas?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S26-080 | text | hidden-only | "Minta guru baru anda tambahkan anda ke kelas baharu. Anda boleh berada dalam lebih dari sa…" | FN-M09-8.1.9 |
| EL-M09-S26-081 | clickable | visible-default | "Macam mana nak naikkan ketepatan?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S26-082 | text | hidden-only | "Fokus pada topik yang lemah (lihat di Prestasi 360), ulang latihan topik tersebut. Kualiti…" | FN-M09-8.1.9 |
| EL-M09-S26-083 | card | conditional | "Cara Daftar Akaun Guru", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-084 | heading | conditional | "Cara Daftar Akaun Guru", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-085 | card | conditional | "Daftar di prestasiplus.my", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-086 | text | conditional | "1", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-087 | heading | conditional | "Daftar di prestasiplus.my", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-088 | text | conditional | "Klik , pilih peranan , dan isi nama, e-mel, serta kata laluan.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-089 | text | conditional | ""Daftar"", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-090 | text | conditional | ""Guru"", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-091 | card | conditional | "Pilih Sekolah", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-092 | text | conditional | "2", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-093 | heading | conditional | "Pilih Sekolah", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-094 | text | conditional | "Cari dan pilih sekolah anda dari senarai. Jika tiada, hubungi admin untuk tambah.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-095 | card | conditional | "Cipta Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-096 | text | conditional | "3", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-097 | heading | conditional | "Cipta Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-098 | text | conditional | "Pergi ke , klik . Masukkan nama kelas, subjek, dan tingkatan.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-099 | text | conditional | ""Kelas Saya"", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-100 | text | conditional | ""Cipta Kelas"", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-101 | card | conditional | "Kongsi Kod Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-102 | text | conditional | "4", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-103 | heading | conditional | "Kongsi Kod Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-104 | text | conditional | "Setiap kelas ada (contoh: LZ0942). Beri kod ini kepada pelajar untuk sertai kelas.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-105 | text | conditional | "kod unik", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-106 | card | conditional | "Siap!", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-107 | text | conditional | "✓", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-108 | heading | conditional | "Siap!", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-109 | text | conditional | "Kini anda boleh mula pantau prestasi pelajar dan urus kelas anda.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-110 | card | conditional | "Alat-Alat Guru", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-111 | heading | conditional | "Alat-Alat Guru", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-112 | card | conditional | "Kelas Saya", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-113 | text | conditional | "📋", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-114 | heading | conditional | "Kelas Saya", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-115 | text | conditional | "Cipta kelas, tambah/import pelajar, tengok senarai dan status aktiviti setiap pelajar.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-116 | card | conditional | "Prestasi Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-117 | text | conditional | "📊", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-118 | heading | conditional | "Prestasi Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-119 | text | conditional | "Dashboard kelas — purata ketepatan, ranking murid, trend prestasi 30 hari.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-120 | card | conditional | "Headcount", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-121 | text | conditional | "🎯", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-122 | heading | conditional | "Headcount", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-123 | text | conditional | "Set sasaran peperiksaan (TOV, OTR, ETR), jejak kemajuan dalam format rasmi KPM.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-124 | card | conditional | "Amaran Awal", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-125 | text | conditional | "⚠️", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-126 | heading | conditional | "Amaran Awal", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-127 | text | conditional | "Kenal pasti murid berisiko berdasarkan skor risiko — ketepatan, penglibatan, penguasaan.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-128 | card | conditional | "Log Intervensi", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-129 | text | conditional | "📝", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-130 | heading | conditional | "Log Intervensi", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-131 | text | conditional | "Rekod tindakan untuk pelajar berisiko — kaunseling, kelas tambahan, hubungi ibu bapa.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-132 | card | conditional | "Kombo Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-133 | text | conditional | "🔥", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-134 | heading | conditional | "Kombo Kelas", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-135 | text | conditional | "Pantau pelajar dormant (3+ hari tak aktif) dan lihat kombo setiap murid.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-136 | card | conditional | "Analisa Item", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-137 | text | conditional | "🔬", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-138 | heading | conditional | "Analisa Item", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-139 | text | conditional | "Analisis soalan yang paling salah dijawab, topik yang perlu ditekankan.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-140 | card | conditional | "Sumbang Soalan", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-141 | text | conditional | "✏️", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-142 | heading | conditional | "Sumbang Soalan", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-143 | text | conditional | "Sumbang soalan dari Databank atau cipta soalan baharu untuk murid anda.", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S26-144 | card | conditional | "Soalan Lazim Guru", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-145 | heading | conditional | "Soalan Lazim Guru", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-146 | clickable | conditional | "Macam mana nak import pelajar secara pukal?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-147 | text | hidden-only | "Pergi ke Kelas Saya → pilih kelas → klik "Import Pelajar". Muat naik fail CSV dengan nama …" | FN-M09-8.1.9 |
| EL-M09-S26-148 | clickable | conditional | "Boleh saya ada lebih dari satu kelas?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-149 | text | hidden-only | "Ya! Anda boleh cipta berapa kelas pun — setiap kelas ada kod unik sendiri." | FN-M09-8.1.9 |
| EL-M09-S26-150 | clickable | conditional | "Apa itu Headcount?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-151 | text | hidden-only | "Headcount adalah format rasmi KPM untuk menjejak sasaran peperiksaan. Anda set TOV, OTR, d…" | FN-M09-8.1.9 |
| EL-M09-S26-152 | clickable | conditional | "Macam mana nak tengok murid yang tak aktif?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-153 | text | hidden-only | "Pergi ke Kombo → pilih kelas anda. Bahagian "Pelajar Dormant" akan tunjuk murid yang tak b…" | FN-M09-8.1.9 |
| EL-M09-S26-154 | clickable | conditional | "Bagaimana Log Intervensi berfungsi?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-155 | text | hidden-only | "Dari Amaran Awal → klik "Intervensi" di sebelah nama murid → rekod jenis tindakan, tarikh,…" | FN-M09-8.1.9 |
| EL-M09-S26-156 | card | conditional | "Cara Daftar Akaun Ibu Bapa", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-157 | heading | conditional | "Cara Daftar Akaun Ibu Bapa", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-158 | card | conditional | "Daftar Akaun", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-159 | text | conditional | "1", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-160 | heading | conditional | "Daftar Akaun", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-161 | text | conditional | "Layari , klik , dan pilih peranan .", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-162 | text | conditional | "prestasiplus.my", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-163 | text | conditional | ""Daftar"", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-164 | text | conditional | ""Ibu Bapa"", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-165 | card | conditional | "Link Anak Anda", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-166 | text | conditional | "2", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-167 | heading | conditional | "Link Anak Anda", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-168 | text | conditional | "Selepas daftar, pergi ke profil dan masukkan untuk menghubungkan akaun.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-169 | text | conditional | "e-mel anak", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-170 | card | conditional | "Anak Terima Permintaan", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-171 | text | conditional | "3", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-172 | heading | conditional | "Anak Terima Permintaan", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-173 | text | conditional | "Anak anda perlu permintaan penghubungan dari akaun mereka.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-174 | text | conditional | "menerima", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-175 | card | conditional | "Siap! Pantau Anak Anda", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-176 | text | conditional | "✓", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-177 | heading | conditional | "Siap! Pantau Anak Anda", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-178 | text | conditional | "Anda kini boleh lihat Prestasi 360 anak — ketepatan, aktiviti harian, dan cadangan.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-179 | card | conditional | "Apa Yang Ibu Bapa Boleh Lihat", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-180 | heading | conditional | "Apa Yang Ibu Bapa Boleh Lihat", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-181 | card | conditional | "Prestasi 360 Anak", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-182 | text | conditional | "📊", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-183 | heading | conditional | "Prestasi 360 Anak", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-184 | text | conditional | "Ketepatan keseluruhan, sesi latihan, koin, dan kombo harian anak anda.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-185 | card | conditional | "Penguasaan Subjek", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-186 | text | conditional | "📚", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-187 | heading | conditional | "Penguasaan Subjek", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-188 | text | conditional | "Lihat subjek kuat dan lemah, peratusan ketepatan setiap subjek.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-189 | card | conditional | "Peta Aktiviti", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-190 | text | conditional | "📅", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-191 | heading | conditional | "Peta Aktiviti", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-192 | text | conditional | "Heatmap 90 hari — hari mana anak rajin berlatih dan skip.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-193 | card | conditional | "Cadangan Pintar", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-194 | text | conditional | "💡", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-195 | heading | conditional | "Cadangan Pintar", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-196 | text | conditional | "Sistem beri cadangan subjek/topik yang anak patut fokuskan.", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S26-197 | card | conditional | "Soalan Lazim Ibu Bapa", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-198 | heading | conditional | "Soalan Lazim Ibu Bapa", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-199 | clickable | conditional | "Boleh pantau lebih dari seorang anak?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-200 | text | hidden-only | "Ya! Anda boleh link beberapa akaun anak dan pilih mana satu untuk dilihat." | FN-M09-8.1.9 |
| EL-M09-S26-201 | clickable | conditional | "Saya tak nampak data anak?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-202 | text | hidden-only | "Pastikan anak sudah menerima permintaan link dari akaun mereka." | FN-M09-8.1.9 |
| EL-M09-S26-203 | clickable | conditional | "Adakah guru boleh lihat bahawa saya pantau?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-204 | text | hidden-only | "Tidak. Data anda peribadi. Guru hanya nampak data prestasi anak sahaja." | FN-M09-8.1.9 |
| EL-M09-S26-205 | card | conditional | "Cara Mula Sebagai Admin Sekolah", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-206 | heading | conditional | "Cara Mula Sebagai Admin Sekolah", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-207 | card | conditional | "Hubungi Admin PRESTASIPLUS", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-208 | text | conditional | "1", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-209 | heading | conditional | "Hubungi Admin PRESTASIPLUS", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-210 | text | conditional | "Akaun Admin Sekolah perlu didaftarkan oleh pentadbir sistem. Hubungi kami untuk setup.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-211 | card | conditional | "Daftar Guru", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-212 | text | conditional | "2", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-213 | heading | conditional | "Daftar Guru", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-214 | text | conditional | "Dari panel admin, pergi ke → .", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-215 | text | conditional | ""Senarai Guru"", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-216 | text | conditional | ""Cipta Pengguna"", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-217 | card | conditional | "Import Pelajar", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-218 | text | conditional | "3", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-219 | heading | conditional | "Import Pelajar", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-220 | text | conditional | "Gunakan untuk muat naik senarai pelajar secara pukal menggunakan CSV.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-221 | text | conditional | ""Import Pelajar"", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-222 | card | conditional | "Siap!", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-223 | text | conditional | "✓", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-224 | heading | conditional | "Siap!", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-225 | text | conditional | "Sekolah kini aktif. Guru boleh cipta kelas dan pelajar boleh mula berlatih.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-226 | card | conditional | "Fungsi Admin Sekolah", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-227 | heading | conditional | "Fungsi Admin Sekolah", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-228 | card | conditional | "Urus Guru", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-229 | text | conditional | "👨‍🏫", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-230 | heading | conditional | "Urus Guru", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-231 | text | conditional | "Daftar guru, edit profil, aktif/nyahaktif akaun guru.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-232 | card | conditional | "Urus Pelajar", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-233 | text | conditional | "👨‍🎓", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-234 | heading | conditional | "Urus Pelajar", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-235 | text | conditional | "Import pelajar pukal, edit maklumat, pantau senarai seluruh sekolah.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-236 | card | conditional | "Prestasi Sekolah", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-237 | text | conditional | "📊", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-238 | heading | conditional | "Prestasi Sekolah", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-239 | text | conditional | "Dashboard seluruh sekolah — prestasi mengikut kelas, subjek, tingkatan.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-240 | card | conditional | "Amaran Awal", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-241 | text | conditional | "⚠️", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-242 | heading | conditional | "Amaran Awal", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-243 | text | conditional | "Ringkasan risiko seluruh sekolah, senarai pelajar berisiko.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-244 | card | conditional | "Ringkasan Eksekutif", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-245 | text | conditional | "📑", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-246 | heading | conditional | "Ringkasan Eksekutif", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-247 | text | conditional | "Laporan 1 halaman boleh dicetak — KPI, taburan risiko, pecahan subjek.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-248 | card | conditional | "Statistik Penggunaan", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-249 | text | conditional | "📊", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-250 | heading | conditional | "Statistik Penggunaan", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-251 | text | conditional | "Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement.", state captured @1280 only | FN-M09-8.1.7 |
| EL-M09-S26-252 | card | conditional | "Soalan Lazim Admin", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-253 | heading | conditional | "Soalan Lazim Admin", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-254 | clickable | conditional | "Format CSV untuk import pelajar?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-255 | text | hidden-only | "CSV perlu ada lajur: name, email, grade (T4, T5, D1-D6). Baris pertama adalah header. E-me…" | FN-M09-8.1.9 |
| EL-M09-S26-256 | clickable | conditional | "Boleh reset kata laluan guru/pelajar?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-257 | text | hidden-only | "Ya! Dari senarai guru/pelajar, klik nama pengguna, kemudian "Reset Kata Laluan"." | FN-M09-8.1.9 |
| EL-M09-S26-258 | clickable | conditional | "Macam mana nak cetak Ringkasan Eksekutif?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-259 | text | hidden-only | "Amaran Awal → Ringkasan Eksekutif → Cetak / PDF." | FN-M09-8.1.9 |
| EL-M09-S26-260 | card | conditional | "Cara Mula Sebagai PPD / JPN", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-261 | heading | conditional | "Cara Mula Sebagai PPD / JPN", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-262 | card | conditional | "Hubungi Admin PRESTASIPLUS", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-263 | text | conditional | "1", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-264 | heading | conditional | "Hubungi Admin PRESTASIPLUS", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-265 | text | conditional | "Akaun PPD/JPN didaftarkan oleh pentadbir sistem. Nyatakan daerah dan negeri anda.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-266 | card | conditional | "Login & Akses Dashboard", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-267 | text | conditional | "2", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-268 | heading | conditional | "Login & Akses Dashboard", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-269 | text | conditional | "Selepas akaun aktif, login dan akses menu untuk data daerah/negeri.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-270 | text | conditional | "Amaran Awal", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-271 | card | conditional | "Siap!", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-272 | text | conditional | "✓", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-273 | heading | conditional | "Siap!", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-274 | text | conditional | "Anda kini boleh pantau data risiko seluruh daerah atau negeri anda.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-275 | card | conditional | "Fungsi PPD / JPN", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-276 | heading | conditional | "Fungsi PPD / JPN", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-277 | card | conditional | "Dashboard Daerah (PPD)", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-278 | text | conditional | "📊", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-279 | heading | conditional | "Dashboard Daerah (PPD)", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-280 | text | conditional | "Ringkasan semua sekolah dalam daerah — taburan risiko, ranking sekolah.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-281 | card | conditional | "Dashboard Negeri (JPN)", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-282 | text | conditional | "🗺️", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-283 | heading | conditional | "Dashboard Negeri (JPN)", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-284 | text | conditional | "Gambaran seluruh negeri — perbandingan daerah dan sekolah.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-285 | card | conditional | "Ringkasan Eksekutif", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-286 | text | conditional | "📑", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-287 | heading | conditional | "Ringkasan Eksekutif", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-288 | text | conditional | "Laporan 1 halaman untuk mesyuarat — KPI, taburan risiko. Boleh cetak/PDF.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-289 | card | conditional | "Muat Turun CSV", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-290 | text | conditional | "📥", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-291 | heading | conditional | "Muat Turun CSV", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-292 | text | conditional | "Export data risiko dalam CSV untuk analisis lanjut.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-293 | card | conditional | "Direktori Sekolah", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-294 | text | conditional | "🏫", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-295 | heading | conditional | "Direktori Sekolah", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-296 | text | conditional | "Cari dan lihat data mana-mana sekolah dalam kawasan anda.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-297 | card | conditional | "Kombo & Penglibatan", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-298 | text | conditional | "🔥", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-299 | heading | conditional | "Kombo & Penglibatan", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-300 | text | conditional | "Pantau kadar penglibatan — purata kombo, pelajar aktif vs dormant.", state captured @1280 only | FN-M09-8.1.8 |
| EL-M09-S26-301 | card | conditional | "Soalan Lazim PPD / JPN", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-302 | heading | conditional | "Soalan Lazim PPD / JPN", state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-303 | clickable | conditional | "Data dari mana?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-304 | text | hidden-only | "Semua data dijana automatik dari aktiviti latih tubi pelajar. Tiada input manual diperluka…" | FN-M09-8.1.9 |
| EL-M09-S26-305 | clickable | conditional | "Berapa kerap data dikemas kini?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-306 | text | hidden-only | "Data dikemas kini secara masa nyata. Setiap kali pelajar selesai latihan, data terus dikir…" | FN-M09-8.1.9 |
| EL-M09-S26-307 | clickable | conditional | "Boleh muat turun laporan?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-308 | text | hidden-only | "Ya! Gunakan "Muat Turun CSV" atau "Ringkasan Eksekutif" untuk cetak PDF." | FN-M09-8.1.9 |
| EL-M09-S26-309 | clickable | conditional | "Saya nampak 0 pelajar. Kenapa?", fa-chevron-down, state captured @1280 only | FN-M09-8.1.9 |
| EL-M09-S26-310 | text | hidden-only | "Belum ada sekolah dalam daerah/negeri anda yang aktif menggunakan platform." | FN-M09-8.1.9 |
| EL-M09-S26-311 | text | visible-default | "💬" | FN-M09-8.1.10 |
| EL-M09-S26-312 | heading | visible-default | "Perlukan Bantuan Lanjut?" | FN-M09-8.1.10 |
| EL-M09-S26-313 | text | visible-default | "Hubungi pasukan sokongan kami untuk sebarang pertanyaan." | FN-M09-8.1.10 |
| EL-M09-S26-314 | link | visible-default | "E-mel Kami", → mailto:support@prestasiplus.my, fa-envelope | FN-M09-8.1.10 |
| EL-M09-S26-315 | link | visible-default | "WhatsApp", → https://wa.me/60123456789, fa-whatsapp | FN-M09-8.1.10 |
| EL-M09-S26-316 | text | visible-default | "© 2026 🇲🇾" | FN-M09-8.1.11 |
| EL-M09-S26-317 | image | visible-default | (image) | FN-M09-8.1.11 |
| EL-M09-S26-318 | text | visible-default | "Platform Latih Tubi Nasional" | FN-M09-8.1.11 |
| EL-M09-S26-319 | link | conditional | "Log Masuk", → /login, state captured @1280 only | FN-M09-8.1.1 |
| EL-M09-S26-320 | link | conditional | "Daftar Percuma", → /register, fa-rocket, state captured @1280 only | FN-M09-8.1.1 |
| EL-M09-S26-321 | link | hidden-only | "Log Masuk", → /login, fa-sign-in-alt | FN-M09-8.1.1 |
| EL-M09-S26-322 | link | hidden-only | "Daftar Percuma", → /register, fa-rocket | FN-M09-8.1.1 |
| EL-M09-S26-323 | link | conditional | "Daftar Percuma Sekarang", → /register, fa-rocket, state captured @1280 only | FN-M09-8.1.12 |

#### S27 — `/pusat-tuisyen/panduan` (359 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S27-001 | link | visible-default | → / | FN-M09-8.1.1 |
| EL-M09-S27-002 | image | visible-default | (image) | FN-M09-8.1.1 |
| EL-M09-S27-003 | link | visible-default | "Laman Utama", → /, fa-home, desktop-only | FN-M09-8.1.1 |
| EL-M09-S27-004 | link | visible-default | "Artikel", → /artikel, fa-newspaper, desktop-only | FN-M09-8.1.1 |
| EL-M09-S27-005 | link | visible-default | "Dashboard", → /dashboard, fa-th-large, desktop-only | FN-M09-8.1.1 |
| EL-M09-S27-006 | toggle | conditional | fa-bars, mobile-only | FN-M09-8.1.1 |
| EL-M09-S27-007 | link | hidden-only | "Laman Utama", → /, fa-home | FN-M09-8.1.1 |
| EL-M09-S27-008 | link | hidden-only | "Artikel", → /artikel, fa-newspaper | FN-M09-8.1.1 |
| EL-M09-S27-009 | link | hidden-only | "Dashboard", → /dashboard, fa-th-large | FN-M09-8.1.1 |
| EL-M09-S27-010 | text | visible-default | "📖" | FN-M09-8.1.2 |
| EL-M09-S27-011 | heading | visible-default | "Panduan Pengguna PRESTASIPLUS" | FN-M09-8.1.2 |
| EL-M09-S27-012 | text | visible-default | "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!" | FN-M09-8.1.2 |
| EL-M09-S27-013 | clickable | hidden-only | (clickable) | FN-M09-8.1.3 |
| EL-M09-S27-014 | clickable | visible-default | "👨‍🎓 Pelajar Darjah 1 – Tingkatan 5" | FN-M09-8.1.3 |
| EL-M09-S27-015 | clickable | visible-default | "👩‍🏫 Guru Guru Mata Pelajaran" | FN-M09-8.1.3 |
| EL-M09-S27-016 | clickable | visible-default | "👪 Ibu Bapa Pemantauan Anak" | FN-M09-8.1.3 |
| EL-M09-S27-017 | clickable | visible-default | "🏫 Admin Sekolah Pengetua / GPK" | FN-M09-8.1.3 |
| EL-M09-S27-018 | clickable | visible-default | "📊 PPD / JPN Pegawai Daerah / Negeri" | FN-M09-8.1.3 |
| EL-M09-S27-019 | card | visible-default | "Cara Daftar Akaun Pelajar" | FN-M09-8.1.4 |
| EL-M09-S27-020 | heading | visible-default | "Cara Daftar Akaun Pelajar" | FN-M09-8.1.4 |
| EL-M09-S27-021 | card | visible-default | "Buka Laman Web" | FN-M09-8.1.4 |
| EL-M09-S27-022 | text | visible-default | "1" | FN-M09-8.1.4 |
| EL-M09-S27-023 | heading | visible-default | "Buka Laman Web" | FN-M09-8.1.4 |
| EL-M09-S27-024 | text | visible-default | "Layari menggunakan pelayar web (Chrome/Safari)." | FN-M09-8.1.4 |
| EL-M09-S27-025 | text | visible-default | "prestasiplus.my" | FN-M09-8.1.4 |
| EL-M09-S27-026 | card | visible-default | "Klik "Daftar"" | FN-M09-8.1.4 |
| EL-M09-S27-027 | text | visible-default | "2" | FN-M09-8.1.4 |
| EL-M09-S27-028 | heading | visible-default | "Klik "Daftar"" | FN-M09-8.1.4 |
| EL-M09-S27-029 | text | visible-default | "Di halaman utama, klik butang atau minta guru daftarkan anda." | FN-M09-8.1.4 |
| EL-M09-S27-030 | text | visible-default | ""Daftar Percuma"" | FN-M09-8.1.4 |
| EL-M09-S27-031 | card | visible-default | "Isi Maklumat" | FN-M09-8.1.4 |
| EL-M09-S27-032 | text | visible-default | "3" | FN-M09-8.1.4 |
| EL-M09-S27-033 | heading | visible-default | "Isi Maklumat" | FN-M09-8.1.4 |
| EL-M09-S27-034 | text | visible-default | "Masukkan , dan pilih tingkatan/darjah anda." | FN-M09-8.1.4 |
| EL-M09-S27-035 | text | visible-default | "nama penuh, e-mel, kata laluan" | FN-M09-8.1.4 |
| EL-M09-S27-036 | card | visible-default | "Masuk Kelas" | FN-M09-8.1.4 |
| EL-M09-S27-037 | text | visible-default | "4" | FN-M09-8.1.4 |
| EL-M09-S27-038 | heading | visible-default | "Masuk Kelas" | FN-M09-8.1.4 |
| EL-M09-S27-039 | text | visible-default | "Minta daripada guru anda dan masukkan untuk sertai kelas." | FN-M09-8.1.4 |
| EL-M09-S27-040 | text | visible-default | "kod kelas" | FN-M09-8.1.4 |
| EL-M09-S27-041 | card | visible-default | "Siap! Mula Berlatih" | FN-M09-8.1.4 |
| EL-M09-S27-042 | text | visible-default | "✓" | FN-M09-8.1.4 |
| EL-M09-S27-043 | heading | visible-default | "Siap! Mula Berlatih" | FN-M09-8.1.4 |
| EL-M09-S27-044 | text | visible-default | "Anda kini boleh mula latih tubi, kumpul kombo, dan naik ranking!" | FN-M09-8.1.4 |
| EL-M09-S27-045 | card | visible-default | "Apa Yang Boleh Anda Buat" | FN-M09-8.1.4 |
| EL-M09-S27-046 | heading | visible-default | "Apa Yang Boleh Anda Buat" | FN-M09-8.1.4 |
| EL-M09-S27-047 | card | visible-default | "Latih Tubi" | FN-M09-8.1.4 |
| EL-M09-S27-048 | text | visible-default | "📝" | FN-M09-8.1.4 |
| EL-M09-S27-049 | heading | visible-default | "Latih Tubi" | FN-M09-8.1.4 |
| EL-M09-S27-050 | text | visible-default | "Jawab soalan mengikut subjek dan topik. Semakin banyak latihan, semakin pandai!" | FN-M09-8.1.4 |
| EL-M09-S27-051 | card | visible-default | "Kombo Harian" | FN-M09-8.1.4 |
| EL-M09-S27-052 | text | visible-default | "🔥" | FN-M09-8.1.4 |
| EL-M09-S27-053 | heading | visible-default | "Kombo Harian" | FN-M09-8.1.4 |
| EL-M09-S27-054 | text | visible-default | "Latih tubi setiap hari untuk kekalkan kombo anda. Jangan putus!" | FN-M09-8.1.4 |
| EL-M09-S27-055 | card | visible-default | "Battle" | FN-M09-8.1.4 |
| EL-M09-S27-056 | text | visible-default | "⚔️" | FN-M09-8.1.4 |
| EL-M09-S27-057 | heading | visible-default | "Battle" | FN-M09-8.1.4 |
| EL-M09-S27-058 | text | visible-default | "Cabaran masa nyata — lawan kawan atau pelajar lain secara langsung!" | FN-M09-8.1.4 |
| EL-M09-S27-059 | card | visible-default | "Prestasi 360" | FN-M09-8.1.4 |
| EL-M09-S27-060 | text | visible-default | "📊" | FN-M09-8.1.4 |
| EL-M09-S27-061 | heading | visible-default | "Prestasi 360" | FN-M09-8.1.4 |
| EL-M09-S27-062 | text | visible-default | "Lihat kemajuan anda: ketepatan, subjek kuat/lemah, dan cadangan latihan." | FN-M09-8.1.4 |
| EL-M09-S27-063 | card | visible-default | "Ranking & Lencana" | FN-M09-8.1.4 |
| EL-M09-S27-064 | text | visible-default | "🏆" | FN-M09-8.1.4 |
| EL-M09-S27-065 | heading | visible-default | "Ranking & Lencana" | FN-M09-8.1.4 |
| EL-M09-S27-066 | text | visible-default | "Naik ranking sekolah dan kumpul lencana pencapaian!" | FN-M09-8.1.4 |
| EL-M09-S27-067 | card | visible-default | "Koin & Ganjaran" | FN-M09-8.1.4 |
| EL-M09-S27-068 | text | visible-default | "🪙" | FN-M09-8.1.4 |
| EL-M09-S27-069 | heading | visible-default | "Koin & Ganjaran" | FN-M09-8.1.4 |
| EL-M09-S27-070 | text | visible-default | "Setiap latihan beri koin. Kumpul dan tukar dengan ganjaran menarik." | FN-M09-8.1.4 |
| EL-M09-S27-071 | card | visible-default | "Soalan Lazim Pelajar" | FN-M09-8.1.9 |
| EL-M09-S27-072 | heading | visible-default | "Soalan Lazim Pelajar" | FN-M09-8.1.9 |
| EL-M09-S27-073 | clickable | visible-default | "Macam mana nak reset kata laluan?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-074 | text | hidden-only | "Pergi ke halaman login, klik "Lupa Kata Laluan", masukkan e-mel anda, dan ikut arahan dala…" | FN-M09-8.1.9 |
| EL-M09-S27-075 | clickable | visible-default | "Saya tak ada e-mel. Boleh daftar?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-076 | text | hidden-only | "Ya! Minta guru anda daftarkan akaun untuk anda melalui panel guru. Guru boleh import senar…" | FN-M09-8.1.9 |
| EL-M09-S27-077 | clickable | visible-default | "Apa itu Kombo?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-078 | text | hidden-only | "Kombo bermaksud hari berturut-turut anda berlatih. Jika anda berlatih setiap hari tanpa pu…" | FN-M09-8.1.9 |
| EL-M09-S27-079 | clickable | visible-default | "Boleh tukar kelas?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-080 | text | hidden-only | "Minta guru baru anda tambahkan anda ke kelas baharu. Anda boleh berada dalam lebih dari sa…" | FN-M09-8.1.9 |
| EL-M09-S27-081 | clickable | visible-default | "Macam mana nak naikkan ketepatan?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-082 | text | hidden-only | "Fokus pada topik yang lemah (lihat di Prestasi 360), ulang latihan topik tersebut. Kualiti…" | FN-M09-8.1.9 |
| EL-M09-S27-083 | card | hidden-only | "Cara Daftar Akaun Guru" | FN-M09-8.1.5 |
| EL-M09-S27-084 | heading | hidden-only | "Cara Daftar Akaun Guru" | FN-M09-8.1.5 |
| EL-M09-S27-085 | card | hidden-only | "Daftar di prestasiplus.my" | FN-M09-8.1.5 |
| EL-M09-S27-086 | text | hidden-only | "1" | FN-M09-8.1.5 |
| EL-M09-S27-087 | heading | hidden-only | "Daftar di prestasiplus.my" | FN-M09-8.1.5 |
| EL-M09-S27-088 | text | hidden-only | "Klik , pilih peranan , dan isi nama, e-mel, serta kata laluan." | FN-M09-8.1.5 |
| EL-M09-S27-089 | text | hidden-only | ""Daftar"" | FN-M09-8.1.5 |
| EL-M09-S27-090 | text | hidden-only | ""Guru"" | FN-M09-8.1.5 |
| EL-M09-S27-091 | card | hidden-only | "Pilih Sekolah" | FN-M09-8.1.5 |
| EL-M09-S27-092 | text | hidden-only | "2" | FN-M09-8.1.5 |
| EL-M09-S27-093 | heading | hidden-only | "Pilih Sekolah" | FN-M09-8.1.5 |
| EL-M09-S27-094 | text | hidden-only | "Cari dan pilih sekolah anda dari senarai. Jika tiada, hubungi admin untuk tambah." | FN-M09-8.1.5 |
| EL-M09-S27-095 | card | hidden-only | "Cipta Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-096 | text | hidden-only | "3" | FN-M09-8.1.5 |
| EL-M09-S27-097 | heading | hidden-only | "Cipta Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-098 | text | hidden-only | "Pergi ke , klik . Masukkan nama kelas, subjek, dan tingkatan." | FN-M09-8.1.5 |
| EL-M09-S27-099 | text | hidden-only | ""Kelas Saya"" | FN-M09-8.1.5 |
| EL-M09-S27-100 | text | hidden-only | ""Cipta Kelas"" | FN-M09-8.1.5 |
| EL-M09-S27-101 | card | hidden-only | "Kongsi Kod Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-102 | text | hidden-only | "4" | FN-M09-8.1.5 |
| EL-M09-S27-103 | heading | hidden-only | "Kongsi Kod Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-104 | text | hidden-only | "Setiap kelas ada (contoh: LZ0942). Beri kod ini kepada pelajar untuk sertai kelas." | FN-M09-8.1.5 |
| EL-M09-S27-105 | text | hidden-only | "kod unik" | FN-M09-8.1.5 |
| EL-M09-S27-106 | card | hidden-only | "Siap!" | FN-M09-8.1.5 |
| EL-M09-S27-107 | text | hidden-only | "✓" | FN-M09-8.1.5 |
| EL-M09-S27-108 | heading | hidden-only | "Siap!" | FN-M09-8.1.5 |
| EL-M09-S27-109 | text | hidden-only | "Kini anda boleh mula pantau prestasi pelajar dan urus kelas anda." | FN-M09-8.1.5 |
| EL-M09-S27-110 | card | hidden-only | "Alat-Alat Guru" | FN-M09-8.1.5 |
| EL-M09-S27-111 | heading | hidden-only | "Alat-Alat Guru" | FN-M09-8.1.5 |
| EL-M09-S27-112 | card | hidden-only | "Kelas Saya" | FN-M09-8.1.5 |
| EL-M09-S27-113 | text | hidden-only | "📋" | FN-M09-8.1.5 |
| EL-M09-S27-114 | heading | hidden-only | "Kelas Saya" | FN-M09-8.1.5 |
| EL-M09-S27-115 | text | hidden-only | "Cipta kelas, tambah/import pelajar, tengok senarai dan status aktiviti setiap pelajar." | FN-M09-8.1.5 |
| EL-M09-S27-116 | card | hidden-only | "Prestasi Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-117 | text | hidden-only | "📊" | FN-M09-8.1.5 |
| EL-M09-S27-118 | heading | hidden-only | "Prestasi Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-119 | text | hidden-only | "Dashboard kelas — purata ketepatan, ranking murid, trend prestasi 30 hari." | FN-M09-8.1.5 |
| EL-M09-S27-120 | card | hidden-only | "Headcount" | FN-M09-8.1.5 |
| EL-M09-S27-121 | text | conditional | "🎯", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S27-122 | heading | hidden-only | "Headcount" | FN-M09-8.1.5 |
| EL-M09-S27-123 | text | hidden-only | "Set sasaran peperiksaan (TOV, OTR, ETR), jejak kemajuan dalam format rasmi KPM." | FN-M09-8.1.5 |
| EL-M09-S27-124 | card | hidden-only | "Amaran Awal" | FN-M09-8.1.5 |
| EL-M09-S27-125 | text | hidden-only | "⚠️" | FN-M09-8.1.5 |
| EL-M09-S27-126 | heading | hidden-only | "Amaran Awal" | FN-M09-8.1.5 |
| EL-M09-S27-127 | text | hidden-only | "Kenal pasti murid berisiko berdasarkan skor risiko — ketepatan, penglibatan, penguasaan." | FN-M09-8.1.5 |
| EL-M09-S27-128 | card | hidden-only | "Log Intervensi" | FN-M09-8.1.5 |
| EL-M09-S27-129 | text | hidden-only | "📝" | FN-M09-8.1.5 |
| EL-M09-S27-130 | heading | hidden-only | "Log Intervensi" | FN-M09-8.1.5 |
| EL-M09-S27-131 | text | hidden-only | "Rekod tindakan untuk pelajar berisiko — kaunseling, kelas tambahan, hubungi ibu bapa." | FN-M09-8.1.5 |
| EL-M09-S27-132 | card | hidden-only | "Kombo Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-133 | text | hidden-only | "🔥" | FN-M09-8.1.5 |
| EL-M09-S27-134 | heading | hidden-only | "Kombo Kelas" | FN-M09-8.1.5 |
| EL-M09-S27-135 | text | hidden-only | "Pantau pelajar dormant (3+ hari tak aktif) dan lihat kombo setiap murid." | FN-M09-8.1.5 |
| EL-M09-S27-136 | card | hidden-only | "Analisa Item" | FN-M09-8.1.5 |
| EL-M09-S27-137 | text | hidden-only | "🔬" | FN-M09-8.1.5 |
| EL-M09-S27-138 | heading | hidden-only | "Analisa Item" | FN-M09-8.1.5 |
| EL-M09-S27-139 | text | hidden-only | "Analisis soalan yang paling salah dijawab, topik yang perlu ditekankan." | FN-M09-8.1.5 |
| EL-M09-S27-140 | card | hidden-only | "Sumbang Soalan" | FN-M09-8.1.5 |
| EL-M09-S27-141 | text | conditional | "✏️", state captured @1280 only | FN-M09-8.1.5 |
| EL-M09-S27-142 | heading | hidden-only | "Sumbang Soalan" | FN-M09-8.1.5 |
| EL-M09-S27-143 | text | hidden-only | "Sumbang soalan dari Databank atau cipta soalan baharu untuk murid anda." | FN-M09-8.1.5 |
| EL-M09-S27-144 | card | hidden-only | "Soalan Lazim Guru" | FN-M09-8.1.9 |
| EL-M09-S27-145 | heading | hidden-only | "Soalan Lazim Guru" | FN-M09-8.1.9 |
| EL-M09-S27-146 | clickable | hidden-only | "Macam mana nak import pelajar secara pukal?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-147 | text | hidden-only | "Pergi ke Kelas Saya → pilih kelas → klik "Import Pelajar". Muat naik fail CSV dengan nama …" | FN-M09-8.1.9 |
| EL-M09-S27-148 | clickable | hidden-only | "Boleh saya ada lebih dari satu kelas?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-149 | text | hidden-only | "Ya! Anda boleh cipta berapa kelas pun — setiap kelas ada kod unik sendiri." | FN-M09-8.1.9 |
| EL-M09-S27-150 | clickable | hidden-only | "Apa itu Headcount?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-151 | text | hidden-only | "Headcount adalah format rasmi KPM untuk menjejak sasaran peperiksaan. Anda set TOV, OTR, d…" | FN-M09-8.1.9 |
| EL-M09-S27-152 | clickable | hidden-only | "Macam mana nak tengok murid yang tak aktif?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-153 | text | hidden-only | "Pergi ke Kombo → pilih kelas anda. Bahagian "Pelajar Dormant" akan tunjuk murid yang tak b…" | FN-M09-8.1.9 |
| EL-M09-S27-154 | clickable | hidden-only | "Bagaimana Log Intervensi berfungsi?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-155 | text | hidden-only | "Dari Amaran Awal → klik "Intervensi" di sebelah nama murid → rekod jenis tindakan, tarikh,…" | FN-M09-8.1.9 |
| EL-M09-S27-156 | card | hidden-only | "Cara Daftar Akaun Ibu Bapa" | FN-M09-8.1.6 |
| EL-M09-S27-157 | heading | hidden-only | "Cara Daftar Akaun Ibu Bapa" | FN-M09-8.1.6 |
| EL-M09-S27-158 | card | hidden-only | "Daftar Akaun" | FN-M09-8.1.6 |
| EL-M09-S27-159 | text | hidden-only | "1" | FN-M09-8.1.6 |
| EL-M09-S27-160 | heading | hidden-only | "Daftar Akaun" | FN-M09-8.1.6 |
| EL-M09-S27-161 | text | hidden-only | "Layari , klik , dan pilih peranan ." | FN-M09-8.1.6 |
| EL-M09-S27-162 | text | hidden-only | "prestasiplus.my" | FN-M09-8.1.6 |
| EL-M09-S27-163 | text | hidden-only | ""Daftar"" | FN-M09-8.1.6 |
| EL-M09-S27-164 | text | hidden-only | ""Ibu Bapa"" | FN-M09-8.1.6 |
| EL-M09-S27-165 | card | hidden-only | "Link Anak Anda" | FN-M09-8.1.6 |
| EL-M09-S27-166 | text | hidden-only | "2" | FN-M09-8.1.6 |
| EL-M09-S27-167 | heading | hidden-only | "Link Anak Anda" | FN-M09-8.1.6 |
| EL-M09-S27-168 | text | hidden-only | "Selepas daftar, pergi ke profil dan masukkan untuk menghubungkan akaun." | FN-M09-8.1.6 |
| EL-M09-S27-169 | text | hidden-only | "e-mel anak" | FN-M09-8.1.6 |
| EL-M09-S27-170 | card | hidden-only | "Anak Terima Permintaan" | FN-M09-8.1.6 |
| EL-M09-S27-171 | text | hidden-only | "3" | FN-M09-8.1.6 |
| EL-M09-S27-172 | heading | hidden-only | "Anak Terima Permintaan" | FN-M09-8.1.6 |
| EL-M09-S27-173 | text | hidden-only | "Anak anda perlu permintaan penghubungan dari akaun mereka." | FN-M09-8.1.6 |
| EL-M09-S27-174 | text | hidden-only | "menerima" | FN-M09-8.1.6 |
| EL-M09-S27-175 | card | hidden-only | "Siap! Pantau Anak Anda" | FN-M09-8.1.6 |
| EL-M09-S27-176 | text | hidden-only | "✓" | FN-M09-8.1.6 |
| EL-M09-S27-177 | heading | hidden-only | "Siap! Pantau Anak Anda" | FN-M09-8.1.6 |
| EL-M09-S27-178 | text | hidden-only | "Anda kini boleh lihat Prestasi 360 anak — ketepatan, aktiviti harian, dan cadangan." | FN-M09-8.1.6 |
| EL-M09-S27-179 | card | hidden-only | "Apa Yang Ibu Bapa Boleh Lihat" | FN-M09-8.1.6 |
| EL-M09-S27-180 | heading | hidden-only | "Apa Yang Ibu Bapa Boleh Lihat" | FN-M09-8.1.6 |
| EL-M09-S27-181 | card | hidden-only | "Prestasi 360 Anak" | FN-M09-8.1.6 |
| EL-M09-S27-182 | text | hidden-only | "📊" | FN-M09-8.1.6 |
| EL-M09-S27-183 | heading | hidden-only | "Prestasi 360 Anak" | FN-M09-8.1.6 |
| EL-M09-S27-184 | text | hidden-only | "Ketepatan keseluruhan, sesi latihan, koin, dan kombo harian anak anda." | FN-M09-8.1.6 |
| EL-M09-S27-185 | card | hidden-only | "Penguasaan Subjek" | FN-M09-8.1.6 |
| EL-M09-S27-186 | text | conditional | "📚", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S27-187 | heading | hidden-only | "Penguasaan Subjek" | FN-M09-8.1.6 |
| EL-M09-S27-188 | text | hidden-only | "Lihat subjek kuat dan lemah, peratusan ketepatan setiap subjek." | FN-M09-8.1.6 |
| EL-M09-S27-189 | card | hidden-only | "Peta Aktiviti" | FN-M09-8.1.6 |
| EL-M09-S27-190 | text | hidden-only | "📅" | FN-M09-8.1.6 |
| EL-M09-S27-191 | heading | hidden-only | "Peta Aktiviti" | FN-M09-8.1.6 |
| EL-M09-S27-192 | text | hidden-only | "Heatmap 90 hari — hari mana anak rajin berlatih dan skip." | FN-M09-8.1.6 |
| EL-M09-S27-193 | card | hidden-only | "Cadangan Pintar" | FN-M09-8.1.6 |
| EL-M09-S27-194 | text | conditional | "💡", state captured @1280 only | FN-M09-8.1.6 |
| EL-M09-S27-195 | heading | hidden-only | "Cadangan Pintar" | FN-M09-8.1.6 |
| EL-M09-S27-196 | text | hidden-only | "Sistem beri cadangan subjek/topik yang anak patut fokuskan." | FN-M09-8.1.6 |
| EL-M09-S27-197 | card | hidden-only | "Soalan Lazim Ibu Bapa" | FN-M09-8.1.9 |
| EL-M09-S27-198 | heading | hidden-only | "Soalan Lazim Ibu Bapa" | FN-M09-8.1.9 |
| EL-M09-S27-199 | clickable | hidden-only | "Boleh pantau lebih dari seorang anak?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-200 | text | hidden-only | "Ya! Anda boleh link beberapa akaun anak dan pilih mana satu untuk dilihat." | FN-M09-8.1.9 |
| EL-M09-S27-201 | clickable | hidden-only | "Saya tak nampak data anak?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-202 | text | hidden-only | "Pastikan anak sudah menerima permintaan link dari akaun mereka." | FN-M09-8.1.9 |
| EL-M09-S27-203 | clickable | hidden-only | "Adakah guru boleh lihat bahawa saya pantau?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-204 | text | hidden-only | "Tidak. Data anda peribadi. Guru hanya nampak data prestasi anak sahaja." | FN-M09-8.1.9 |
| EL-M09-S27-205 | card | hidden-only | "Cara Mula Sebagai Admin Sekolah" | FN-M09-8.1.7 |
| EL-M09-S27-206 | heading | hidden-only | "Cara Mula Sebagai Admin Sekolah" | FN-M09-8.1.7 |
| EL-M09-S27-207 | card | hidden-only | "Hubungi Admin PRESTASIPLUS" | FN-M09-8.1.7 |
| EL-M09-S27-208 | text | hidden-only | "1" | FN-M09-8.1.7 |
| EL-M09-S27-209 | heading | hidden-only | "Hubungi Admin PRESTASIPLUS" | FN-M09-8.1.7 |
| EL-M09-S27-210 | text | hidden-only | "Akaun Admin Sekolah perlu didaftarkan oleh pentadbir sistem. Hubungi kami untuk setup." | FN-M09-8.1.7 |
| EL-M09-S27-211 | card | hidden-only | "Daftar Guru" | FN-M09-8.1.7 |
| EL-M09-S27-212 | text | hidden-only | "2" | FN-M09-8.1.7 |
| EL-M09-S27-213 | heading | hidden-only | "Daftar Guru" | FN-M09-8.1.7 |
| EL-M09-S27-214 | text | hidden-only | "Dari panel admin, pergi ke → ." | FN-M09-8.1.7 |
| EL-M09-S27-215 | text | hidden-only | ""Senarai Guru"" | FN-M09-8.1.7 |
| EL-M09-S27-216 | text | hidden-only | ""Cipta Pengguna"" | FN-M09-8.1.7 |
| EL-M09-S27-217 | card | hidden-only | "Import Pelajar" | FN-M09-8.1.7 |
| EL-M09-S27-218 | text | hidden-only | "3" | FN-M09-8.1.7 |
| EL-M09-S27-219 | heading | hidden-only | "Import Pelajar" | FN-M09-8.1.7 |
| EL-M09-S27-220 | text | hidden-only | "Gunakan untuk muat naik senarai pelajar secara pukal menggunakan CSV." | FN-M09-8.1.7 |
| EL-M09-S27-221 | text | hidden-only | ""Import Pelajar"" | FN-M09-8.1.7 |
| EL-M09-S27-222 | card | hidden-only | "Siap!" | FN-M09-8.1.7 |
| EL-M09-S27-223 | text | hidden-only | "✓" | FN-M09-8.1.7 |
| EL-M09-S27-224 | heading | hidden-only | "Siap!" | FN-M09-8.1.7 |
| EL-M09-S27-225 | text | hidden-only | "Sekolah kini aktif. Guru boleh cipta kelas dan pelajar boleh mula berlatih." | FN-M09-8.1.7 |
| EL-M09-S27-226 | card | hidden-only | "Fungsi Admin Sekolah" | FN-M09-8.1.7 |
| EL-M09-S27-227 | heading | hidden-only | "Fungsi Admin Sekolah" | FN-M09-8.1.7 |
| EL-M09-S27-228 | card | hidden-only | "Urus Guru" | FN-M09-8.1.7 |
| EL-M09-S27-229 | text | hidden-only | "👨‍🏫" | FN-M09-8.1.7 |
| EL-M09-S27-230 | heading | hidden-only | "Urus Guru" | FN-M09-8.1.7 |
| EL-M09-S27-231 | text | hidden-only | "Daftar guru, edit profil, aktif/nyahaktif akaun guru." | FN-M09-8.1.7 |
| EL-M09-S27-232 | card | hidden-only | "Urus Pelajar" | FN-M09-8.1.7 |
| EL-M09-S27-233 | text | hidden-only | "👨‍🎓" | FN-M09-8.1.7 |
| EL-M09-S27-234 | heading | hidden-only | "Urus Pelajar" | FN-M09-8.1.7 |
| EL-M09-S27-235 | text | hidden-only | "Import pelajar pukal, edit maklumat, pantau senarai seluruh sekolah." | FN-M09-8.1.7 |
| EL-M09-S27-236 | card | hidden-only | "Prestasi Sekolah" | FN-M09-8.1.7 |
| EL-M09-S27-237 | text | hidden-only | "📊" | FN-M09-8.1.7 |
| EL-M09-S27-238 | heading | hidden-only | "Prestasi Sekolah" | FN-M09-8.1.7 |
| EL-M09-S27-239 | text | hidden-only | "Dashboard seluruh sekolah — prestasi mengikut kelas, subjek, tingkatan." | FN-M09-8.1.7 |
| EL-M09-S27-240 | card | hidden-only | "Amaran Awal" | FN-M09-8.1.7 |
| EL-M09-S27-241 | text | hidden-only | "⚠️" | FN-M09-8.1.7 |
| EL-M09-S27-242 | heading | hidden-only | "Amaran Awal" | FN-M09-8.1.7 |
| EL-M09-S27-243 | text | hidden-only | "Ringkasan risiko seluruh sekolah, senarai pelajar berisiko." | FN-M09-8.1.7 |
| EL-M09-S27-244 | card | hidden-only | "Ringkasan Eksekutif" | FN-M09-8.1.7 |
| EL-M09-S27-245 | text | hidden-only | "📑" | FN-M09-8.1.7 |
| EL-M09-S27-246 | heading | hidden-only | "Ringkasan Eksekutif" | FN-M09-8.1.7 |
| EL-M09-S27-247 | text | hidden-only | "Laporan 1 halaman boleh dicetak — KPI, taburan risiko, pecahan subjek." | FN-M09-8.1.7 |
| EL-M09-S27-248 | card | hidden-only | "Statistik Penggunaan" | FN-M09-8.1.7 |
| EL-M09-S27-249 | text | hidden-only | "📊" | FN-M09-8.1.7 |
| EL-M09-S27-250 | heading | hidden-only | "Statistik Penggunaan" | FN-M09-8.1.7 |
| EL-M09-S27-251 | text | hidden-only | "Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement." | FN-M09-8.1.7 |
| EL-M09-S27-252 | card | hidden-only | "Soalan Lazim Admin" | FN-M09-8.1.9 |
| EL-M09-S27-253 | heading | hidden-only | "Soalan Lazim Admin" | FN-M09-8.1.9 |
| EL-M09-S27-254 | clickable | hidden-only | "Format CSV untuk import pelajar?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-255 | text | hidden-only | "CSV perlu ada lajur: name, email, grade (T4, T5, D1-D6). Baris pertama adalah header. E-me…" | FN-M09-8.1.9 |
| EL-M09-S27-256 | clickable | hidden-only | "Boleh reset kata laluan guru/pelajar?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-257 | text | hidden-only | "Ya! Dari senarai guru/pelajar, klik nama pengguna, kemudian "Reset Kata Laluan"." | FN-M09-8.1.9 |
| EL-M09-S27-258 | clickable | hidden-only | "Macam mana nak cetak Ringkasan Eksekutif?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-259 | text | hidden-only | "Amaran Awal → Ringkasan Eksekutif → Cetak / PDF." | FN-M09-8.1.9 |
| EL-M09-S27-260 | card | hidden-only | "Cara Mula Sebagai PPD / JPN" | FN-M09-8.1.8 |
| EL-M09-S27-261 | heading | hidden-only | "Cara Mula Sebagai PPD / JPN" | FN-M09-8.1.8 |
| EL-M09-S27-262 | card | hidden-only | "Hubungi Admin PRESTASIPLUS" | FN-M09-8.1.8 |
| EL-M09-S27-263 | text | hidden-only | "1" | FN-M09-8.1.8 |
| EL-M09-S27-264 | heading | hidden-only | "Hubungi Admin PRESTASIPLUS" | FN-M09-8.1.8 |
| EL-M09-S27-265 | text | hidden-only | "Akaun PPD/JPN didaftarkan oleh pentadbir sistem. Nyatakan daerah dan negeri anda." | FN-M09-8.1.8 |
| EL-M09-S27-266 | card | hidden-only | "Login & Akses Dashboard" | FN-M09-8.1.8 |
| EL-M09-S27-267 | text | hidden-only | "2" | FN-M09-8.1.8 |
| EL-M09-S27-268 | heading | hidden-only | "Login & Akses Dashboard" | FN-M09-8.1.8 |
| EL-M09-S27-269 | text | hidden-only | "Selepas akaun aktif, login dan akses menu untuk data daerah/negeri." | FN-M09-8.1.8 |
| EL-M09-S27-270 | text | hidden-only | "Amaran Awal" | FN-M09-8.1.8 |
| EL-M09-S27-271 | card | hidden-only | "Siap!" | FN-M09-8.1.8 |
| EL-M09-S27-272 | text | hidden-only | "✓" | FN-M09-8.1.8 |
| EL-M09-S27-273 | heading | hidden-only | "Siap!" | FN-M09-8.1.8 |
| EL-M09-S27-274 | text | hidden-only | "Anda kini boleh pantau data risiko seluruh daerah atau negeri anda." | FN-M09-8.1.8 |
| EL-M09-S27-275 | card | hidden-only | "Fungsi PPD / JPN" | FN-M09-8.1.8 |
| EL-M09-S27-276 | heading | hidden-only | "Fungsi PPD / JPN" | FN-M09-8.1.8 |
| EL-M09-S27-277 | card | hidden-only | "Dashboard Daerah (PPD)" | FN-M09-8.1.8 |
| EL-M09-S27-278 | text | hidden-only | "📊" | FN-M09-8.1.8 |
| EL-M09-S27-279 | heading | hidden-only | "Dashboard Daerah (PPD)" | FN-M09-8.1.8 |
| EL-M09-S27-280 | text | hidden-only | "Ringkasan semua sekolah dalam daerah — taburan risiko, ranking sekolah." | FN-M09-8.1.8 |
| EL-M09-S27-281 | card | hidden-only | "Dashboard Negeri (JPN)" | FN-M09-8.1.8 |
| EL-M09-S27-282 | text | hidden-only | "🗺️" | FN-M09-8.1.8 |
| EL-M09-S27-283 | heading | hidden-only | "Dashboard Negeri (JPN)" | FN-M09-8.1.8 |
| EL-M09-S27-284 | text | hidden-only | "Gambaran seluruh negeri — perbandingan daerah dan sekolah." | FN-M09-8.1.8 |
| EL-M09-S27-285 | card | hidden-only | "Ringkasan Eksekutif" | FN-M09-8.1.8 |
| EL-M09-S27-286 | text | hidden-only | "📑" | FN-M09-8.1.8 |
| EL-M09-S27-287 | heading | hidden-only | "Ringkasan Eksekutif" | FN-M09-8.1.8 |
| EL-M09-S27-288 | text | hidden-only | "Laporan 1 halaman untuk mesyuarat — KPI, taburan risiko. Boleh cetak/PDF." | FN-M09-8.1.8 |
| EL-M09-S27-289 | card | hidden-only | "Muat Turun CSV" | FN-M09-8.1.8 |
| EL-M09-S27-290 | text | hidden-only | "📥" | FN-M09-8.1.8 |
| EL-M09-S27-291 | heading | hidden-only | "Muat Turun CSV" | FN-M09-8.1.8 |
| EL-M09-S27-292 | text | hidden-only | "Export data risiko dalam CSV untuk analisis lanjut." | FN-M09-8.1.8 |
| EL-M09-S27-293 | card | hidden-only | "Direktori Sekolah" | FN-M09-8.1.8 |
| EL-M09-S27-294 | text | hidden-only | "🏫" | FN-M09-8.1.8 |
| EL-M09-S27-295 | heading | hidden-only | "Direktori Sekolah" | FN-M09-8.1.8 |
| EL-M09-S27-296 | text | hidden-only | "Cari dan lihat data mana-mana sekolah dalam kawasan anda." | FN-M09-8.1.8 |
| EL-M09-S27-297 | card | hidden-only | "Kombo & Penglibatan" | FN-M09-8.1.8 |
| EL-M09-S27-298 | text | hidden-only | "🔥" | FN-M09-8.1.8 |
| EL-M09-S27-299 | heading | hidden-only | "Kombo & Penglibatan" | FN-M09-8.1.8 |
| EL-M09-S27-300 | text | hidden-only | "Pantau kadar penglibatan — purata kombo, pelajar aktif vs dormant." | FN-M09-8.1.8 |
| EL-M09-S27-301 | card | hidden-only | "Soalan Lazim PPD / JPN" | FN-M09-8.1.9 |
| EL-M09-S27-302 | heading | hidden-only | "Soalan Lazim PPD / JPN" | FN-M09-8.1.9 |
| EL-M09-S27-303 | clickable | hidden-only | "Data dari mana?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-304 | text | hidden-only | "Semua data dijana automatik dari aktiviti latih tubi pelajar. Tiada input manual diperluka…" | FN-M09-8.1.9 |
| EL-M09-S27-305 | clickable | hidden-only | "Berapa kerap data dikemas kini?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-306 | text | hidden-only | "Data dikemas kini secara masa nyata. Setiap kali pelajar selesai latihan, data terus dikir…" | FN-M09-8.1.9 |
| EL-M09-S27-307 | clickable | hidden-only | "Boleh muat turun laporan?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-308 | text | hidden-only | "Ya! Gunakan "Muat Turun CSV" atau "Ringkasan Eksekutif" untuk cetak PDF." | FN-M09-8.1.9 |
| EL-M09-S27-309 | clickable | hidden-only | "Saya nampak 0 pelajar. Kenapa?", fa-chevron-down | FN-M09-8.1.9 |
| EL-M09-S27-310 | text | hidden-only | "Belum ada sekolah dalam daerah/negeri anda yang aktif menggunakan platform." | FN-M09-8.1.9 |
| EL-M09-S27-311 | text | visible-default | "💬" | FN-M09-8.1.10 |
| EL-M09-S27-312 | heading | visible-default | "Perlukan Bantuan Lanjut?" | FN-M09-8.1.10 |
| EL-M09-S27-313 | text | visible-default | "Hubungi pasukan sokongan kami untuk sebarang pertanyaan." | FN-M09-8.1.10 |
| EL-M09-S27-314 | link | visible-default | "E-mel Kami", → mailto:support@prestasiplus.my, fa-envelope | FN-M09-8.1.10 |
| EL-M09-S27-315 | link | visible-default | "WhatsApp", → https://wa.me/60123456789, fa-whatsapp | FN-M09-8.1.10 |
| EL-M09-S27-316 | text | visible-default | "© 2026 🇲🇾" | FN-M09-8.1.11 |
| EL-M09-S27-317 | image | visible-default | (image) | FN-M09-8.1.11 |
| EL-M09-S27-318 | text | visible-default | "Platform Latih Tubi Nasional" | FN-M09-8.1.11 |
| EL-M09-S27-319 | text | conditional | "⭐", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-320 | text | conditional | "🎨", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-321 | text | conditional | "🚀", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-322 | text | conditional | "🎓", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-323 | card | conditional | "Selamat Kembali! 👋", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-324 | heading | conditional | "Selamat Kembali! 👋", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-325 | text | conditional | "Teruskan pembelajaran anda dengan lebih 128,989 soalan latihan dalam 31 subjek berbeza!", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-326 | text | conditional | "Pencapaian Terbuka", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-327 | text | conditional | "Kumpul lencana dan skor tertinggi", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-328 | text | conditional | "📈", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-329 | text | conditional | "Jejak Kemajuan", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-330 | text | conditional | "Lihat statistik pembelajaran anda", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-331 | text | conditional | "Latihan Tersusun", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-332 | text | conditional | "Dari mudah hingga mencabar", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-333 | card | conditional | "Alamat Email", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-334 | image | conditional | state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-335 | text | conditional | "Platform Latih Tubi Nasional 🇲🇾", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-336 | form | conditional | POST /login, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-337 | hidden-field | hidden-only | `_token`, hidden | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-338 | label | conditional | "Alamat Email", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-339 | input | conditional | label "Alamat Email", `email`, email, placeholder "nama@email.com", required, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-340 | label | conditional | "Kata Laluan", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-341 | input | conditional | label "Kata Laluan", `password`, password, placeholder "••••••••", required, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-342 | toggle | conditional | button, fa-eye, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-343 | checkbox | conditional | label "Ingat saya", `remember`, checkbox, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-344 | label | conditional | "Ingat saya", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-345 | link | conditional | "Lupa kata laluan?", → /password/reset, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-346 | link | conditional | "Reset melalui No IC", → /password/reset-ic, fa-id-card, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-347 | button | conditional | "Log Masuk", fa-sign-in-alt, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-348 | text | hidden-only | "Log Masuk", fa-sign-in-alt | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-349 | text | hidden-only | "Sedang Memasuki...", fa-circle-notch | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-350 | text | conditional | "Belum ada akaun?", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-351 | link | conditional | "Daftar Sekarang 🚀", → /register, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-352 | link | conditional | "Kembali ke Laman Utama", → /, fa-arrow-left, state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-353 | text | conditional | "❓", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-354 | text | conditional | "128,989+ Soalan", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-355 | text | conditional | "📚", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-356 | text | conditional | "31 Subjek", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-357 | text | conditional | "🎓", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-358 | text | conditional | "11 Tahap", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |
| EL-M09-S27-359 | text | conditional | "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.", state captured @1280 only | Excluded: M01 `/login` page (guest redirect state `guest__1280`; login form, hero and footer are M01 elements) |

#### S28 — `/perutusan/awam/{id}` (71 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-S28-001 | link | visible-default | → / | FN-M09-7.5.1 |
| EL-M09-S28-002 | image | visible-default | (image) | FN-M09-7.5.1 |
| EL-M09-S28-003 | link | visible-default | "Daftar Percuma", → /daftar, desktop-only | FN-M09-7.5.1 |
| EL-M09-S28-004 | link | visible-default | "Log Masuk", → /login, fa-sign-in-alt | FN-M09-7.5.1 |
| EL-M09-S28-005 | link | visible-default | "Utama", → / | FN-M09-7.5.2 |
| EL-M09-S28-006 | text | visible-default | "Perutusan" | FN-M09-7.5.2 |
| EL-M09-S28-007 | text | visible-default | "AD" | FN-M09-7.5.2 |
| EL-M09-S28-008 | text | visible-default | "<person>" | FN-M09-7.5.2 |
| EL-M09-S28-009 | badge | visible-default | "Pengetua" | FN-M09-7.5.2 |
| EL-M09-S28-010 | text | visible-default | "Sekolah", fa-school | FN-M09-7.5.2 |
| EL-M09-S28-011 | text | visible-default | "17 Mac 2026 11:23 PM", fa-calendar-alt | FN-M09-7.5.2 |
| EL-M09-S28-012 | text | visible-default | "\|" | FN-M09-7.5.2 |
| EL-M09-S28-013 | heading | visible-default | "Video Ucapan Selamat Hari Raya Dari Pihak Pengurusan <school>" | FN-M09-7.5.2 |
| EL-M09-S28-014 | text | visible-default | "1 Suka" | FN-M09-7.5.3 |
| EL-M09-S28-015 | text | hidden-only | "@media(min-width:640px){display:inline}" | FN-M09-7.5.3 |
| EL-M09-S28-016 | text | visible-default | "3 baca", fa-eye | FN-M09-7.5.3 |
| EL-M09-S28-017 | text | visible-default | "0 komen", fa-comment | FN-M09-7.5.3 |
| EL-M09-S28-018 | card | visible-default | "Hari Raya Aidilfitri 1447H" | FN-M09-7.5.4 |
| EL-M09-S28-019 | card | visible-default | "Hari Raya Aidilfitri 1447H" | FN-M09-7.5.4 |
| EL-M09-S28-020 | text | visible-default | "✦ ✦ ✦" | FN-M09-7.5.4 |
| EL-M09-S28-021 | text | visible-default | "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ" | FN-M09-7.5.4 |
| EL-M09-S28-022 | text | visible-default | "Dengan Nama Allah Yang Maha Pemurah Lagi Maha Penyayang" | FN-M09-7.5.4 |
| EL-M09-S28-023 | text | visible-default | "Selamat Hari Raya Aidilfitri" | FN-M09-7.5.4 |
| EL-M09-S28-024 | text | visible-default | "1 Syawal 1447H / 2026M" | FN-M09-7.5.4 |
| EL-M09-S28-025 | text | visible-default | "✦ ✦ ✦" | FN-M09-7.5.4 |
| EL-M09-S28-026 | text | visible-default | "Ucapan Perutusan Hari Raya Aidilfitri 2026" | FN-M09-7.5.4 |
| EL-M09-S28-027 | text | visible-default | "Daripada Pihak Pengurusan Sekolah" | FN-M09-7.5.4 |
| EL-M09-S28-028 | text | visible-default | "Kepada Warga Guru dan Pelajar Yang Dihormati" | FN-M09-7.5.4 |
| EL-M09-S28-029 | text | visible-default | "Assalamualaikum Warahmatullahi Wabarakatuh dan Salam Sejahtera," | FN-M09-7.5.4 |
| EL-M09-S28-030 | text | visible-default | "Alhamdulillah, segala puji bagi Allah SWT kerana dengan limpah kurnia-Nya, kita masih dibe…" | FN-M09-7.5.4 |
| EL-M09-S28-031 | text | visible-default | "Hari Raya Aidilfitri 1447H" | FN-M09-7.5.4 |
| EL-M09-S28-032 | text | visible-default | "Pihak sekolah dengan penuh rasa syukur dan kerendahan hati merakamkan ucapan kepada seluru…" | FN-M09-7.5.4 |
| EL-M09-S28-033 | text | visible-default | "Selamat Hari Raya Aidilfitri, Maaf Zahir dan Batin" | FN-M09-7.5.4 |
| EL-M09-S28-034 | text | visible-default | "Bulan Ramadan yang baru sahaja kita tempuhi adalah sebuah madrasah yang agung — mendidik k…" | FN-M09-7.5.4 |
| EL-M09-S28-035 | text | visible-default | "kesabaran, keikhlasan, dan ketaqwaan" | FN-M09-7.5.4 |
| EL-M09-S28-036 | text | visible-default | "Kepada para yang dihormati — terima kasih di atas pengorbanan, dedikasi, dan amanah yang t…" | FN-M09-7.5.4 |
| EL-M09-S28-037 | text | visible-default | "guru dan kakitangan" | FN-M09-7.5.4 |
| EL-M09-S28-038 | text | visible-default | "Kepada para yang dikasihi — jadikanlah Syawal ini sebagai titik permulaan baharu. Tingkatk…" | FN-M09-7.5.4 |
| EL-M09-S28-039 | text | visible-default | "pelajar" | FN-M09-7.5.4 |
| EL-M09-S28-040 | text | visible-default | "Marilah kita manfaatkan perayaan mulia ini sebagai peluang untuk , memohon kemaafan sesama…" | FN-M09-7.5.4 |
| EL-M09-S28-041 | text | visible-default | "mempererat silaturrahim" | FN-M09-7.5.4 |
| EL-M09-S28-042 | text | visible-default | "Sekali lagi," | FN-M09-7.5.4 |
| EL-M09-S28-043 | text | visible-default | ""Selamat Hari Raya Aidilfitri — Maaf Zahir dan Batin."" | FN-M09-7.5.4 |
| EL-M09-S28-044 | text | visible-default | ""Semoga Allah SWT menerima segala amal ibadah kita," | FN-M09-7.5.4 |
| EL-M09-S28-045 | text | visible-default | "melimpahkan rahmat dan keberkatan-Nya ke atas kita semua," | FN-M09-7.5.4 |
| EL-M09-S28-046 | text | visible-default | "dan menjadikan kita golongan yang sentiasa bersyukur."" | FN-M09-7.5.4 |
| EL-M09-S28-047 | text | visible-default | "Aamiin Ya Rabbal 'Alamin." | FN-M09-7.5.4 |
| EL-M09-S28-048 | text | visible-default | "Hormat daripada," | FN-M09-7.5.4 |
| EL-M09-S28-049 | text | visible-default | "Pihak Pengurusan Sekolah" | FN-M09-7.5.4 |
| EL-M09-S28-050 | text | visible-default | "<school>" | FN-M09-7.5.4 |
| EL-M09-S28-051 | text | visible-default | "Syawal 1447H / 2026M" | FN-M09-7.5.4 |
| EL-M09-S28-052 | text | visible-default | "🌙 ⭐" | FN-M09-7.5.4 |
| EL-M09-S28-053 | text | visible-default | "Takbir Bergema, Hati Bersatu" | FN-M09-7.5.4 |
| EL-M09-S28-054 | text | visible-default | "Video", fa-youtube | FN-M09-7.5.5 |
| EL-M09-S28-055 | text | visible-default | "Kongsi Perutusan" | FN-M09-7.5.6 |
| EL-M09-S28-056 | link | visible-default | "WhatsApp", → https://wa.me/?text=Video+Ucapan+Selamat+Hari+Raya+Dari+Pihak+Pengurusan+<school, fa-whatsapp | FN-M09-7.5.6 |
| EL-M09-S28-057 | link | visible-default | "Telegram", → https://t.me/share/url?url=https%3A%2F%2Fprestasiplus.my%2Fperutusan%2Fawam%2F4&, fa-telegram-plane | FN-M09-7.5.6 |
| EL-M09-S28-058 | link | visible-default | "Facebook", → https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fprestasiplus.my%2Fper, fa-facebook-f | FN-M09-7.5.6 |
| EL-M09-S28-059 | button | visible-default | "Salin Pautan", fa-link | FN-M09-7.5.6 |
| EL-M09-S28-060 | heading | visible-default | "Jom Sertai PrestasiPlus!" | FN-M09-7.5.7 |
| EL-M09-S28-061 | text | visible-default | "Platform latih tubi interaktif untuk pelajar SPM. Beri reaksi, komen, dan banyak lagi!" | FN-M09-7.5.7 |
| EL-M09-S28-062 | link | visible-default | "Daftar Percuma Sekarang", → /daftar, fa-rocket | FN-M09-7.5.7 |
| EL-M09-S28-063 | link | visible-default | "Log Masuk", → /login, fa-sign-in-alt | FN-M09-7.5.7 |
| EL-M09-S28-064 | image | visible-default | (image) | FN-M09-7.5.8 |
| EL-M09-S28-065 | text | visible-default | "Platform Latih Tubi Interaktif Malaysia" | FN-M09-7.5.8 |
| EL-M09-S28-066 | link | visible-default | "Utama", → / | FN-M09-7.5.8 |
| EL-M09-S28-067 | link | visible-default | "Tentang", → /tentang | FN-M09-7.5.8 |
| EL-M09-S28-068 | link | visible-default | "Hubungi", → /hubungi | FN-M09-7.5.8 |
| EL-M09-S28-069 | link | visible-default | "Log Masuk", → /login | FN-M09-7.5.8 |
| EL-M09-S28-070 | text | visible-default | "© 2026 PRESTASIPLUS. Hak Cipta Terpelihara." | FN-M09-7.5.8 |
| EL-M09-S28-071 | button | conditional | "Disalin!", fa-check, state captured @1280 only | FN-M09-7.5.6 |

### 6.2 Shell elements (M09-relevant only)

#### SHU — user-portal shell (chrome of S15–S25) — 390 elements, 29 M09-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-SHU-060 | link | visible-default | "Perutusan", → /perutusan, fa-scroll, desktop-only | FN-M09-10.1.1 |
| EL-M09-SHU-068 | link | visible-default | "Artikel", → /artikel, fa-newspaper, desktop-only | FN-M09-10.1.1 |
| EL-M09-SHU-069 | link | visible-default | "Video", → /video, fa-play-circle, desktop-only | FN-M09-10.1.1 |
| EL-M09-SHU-079 | link | visible-default | "Audio KBAT", → /audio-kbat, fa-headphones, desktop-only | FN-M09-10.1.1 |
| EL-M09-SHU-123 | link | visible-default | "Panduan", → /panduan, fa-book, desktop-only | FN-M09-10.1.1 |
| EL-M09-SHU-136 | heading | visible-default | "Artikel" | FN-M09-2.1.1 |
| EL-M09-SHU-137 | text | visible-default | "Tips belajar, berita pendidikan, motivasi dan panduan" | FN-M09-2.1.1 |
| EL-M09-SHU-209 | link | hidden-only | "Artikel", → /artikel, fa-newspaper | FN-M09-10.1.2 |
| EL-M09-SHU-210 | link | hidden-only | "Video", → /video, fa-play-circle | FN-M09-10.1.2 |
| EL-M09-SHU-290 | link | hidden-only | "Video", → /video, fa-play-circle | FN-M09-10.1.2 |
| EL-M09-SHU-316 | link | hidden-only | "Panduan", → /pusat-tuisyen/panduan, fa-book | FN-M09-10.1.2 |
| EL-M09-SHU-373 | heading | conditional | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M09-2.3.1 |
| EL-M09-SHU-374 | text | conditional | "Artikel" | FN-M09-2.3.1 |
| EL-M09-SHU-375 | heading | conditional | "Video Pembelajaran" | FN-M09-6.1.1 |
| EL-M09-SHU-376 | text | conditional | "Tonton video motivasi, tutorial dan tips peperiksaan" | FN-M09-6.1.1 |
| EL-M09-SHU-377 | heading | conditional | "Video" | FN-M09-6.3.1 |
| EL-M09-SHU-378 | text | conditional | "Sejarah Tingkatan 1: Bab 1 - Mengenali Sejarah" | FN-M09-6.3.1 |
| EL-M09-SHU-379 | heading | conditional | "Edit Video" | FN-M09-6.5.1 |
| EL-M09-SHU-380 | heading | conditional | "Tambah Video" | FN-M09-6.4.1 |
| EL-M09-SHU-381 | text | conditional | "Kongsi video pembelajaran dari YouTube, Vimeo dan lain-lain" | FN-M09-6.4.1 |
| EL-M09-SHU-382 | heading | conditional | "Dashboard" | FN-M09-5.3.1 |
| EL-M09-SHU-383 | text | conditional | "Selamat datang kembali" | FN-M09-5.3.1 |
| EL-M09-SHU-384 | heading | conditional | "Perutusan" | FN-M09-7.1.1 |
| EL-M09-SHU-385 | text | conditional | "Kata-kata aluan dan maklumat penting dari pihak pengurusan" | FN-M09-7.1.1 |
| EL-M09-SHU-386 | text | conditional | "Sekolah" | FN-M09-7.2.1 |
| EL-M09-SHU-387 | heading | conditional | "Tulis Perutusan" | FN-M09-7.3.1 |
| EL-M09-SHU-388 | text | conditional | "Sampaikan kata-kata aluan atau maklumat penting" | FN-M09-7.3.1 |
| EL-M09-SHU-389 | heading | conditional | "Perutusan Saya" | FN-M09-7.4.1 |
| EL-M09-SHU-390 | text | conditional | "Urus semua perutusan yang anda telah tulis" | FN-M09-7.4.1 |

Specific exclusions:

| Element | Content | Reason |
|---|---|---|
| EL-M09-SHU-001 | → /dashboard, desktop-only | Excluded: global shell brand/logo (→ `/dashboard`, "Platform Latih Tubi Nasional") |
| EL-M09-SHU-002 | desktop-only | Excluded: global shell brand/logo (→ `/dashboard`, "Platform Latih Tubi Nasional") |
| EL-M09-SHU-003 | "Platform Latih Tubi Nasional", desktop-only | Excluded: global shell brand/logo (→ `/dashboard`, "Platform Latih Tubi Nasional") |
| EL-M09-SHU-289 | "Sumbang Artikel", → /guru/artikel, fa-newspaper | Excluded: M10 — "Sumbang Artikel" → `/guru/artikel` (teacher article contribution, owned by M10) |

Other excluded SHU elements (prefix EL-M09-SHU-): 357 elements — IDs 004–059, 061–067, 070–078, 080–122, 124–135, 138–208, 211–288, 291–315, 317–372: **global shell / M23 and the module each link targets (navigation of other modules, header widgets, notification bell, avatar, logout, server-status widget, footer, chatbot, PWA/FCM, bottom tab bar, "Lagi" sheet sections of other modules; classified per URL in `_crawl.json`)**.

#### SHA — admin panel shell (chrome of S1–S14) — 226 elements, 34 M09-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M09-SHA-007 | link | visible-default | "Audio KBAT", → /admin/audio-kbat, fa-headphones, desktop-only | FN-M09-10.2.1 |
| EL-M09-SHA-071 | toggle | visible-default | "Kandungan", fa-newspaper, desktop-only | FN-M09-10.2.1 |
| EL-M09-SHA-072 | link | visible-default | "Banner", → /admin/banners, fa-image, desktop-only | FN-M09-10.2.1 |
| EL-M09-SHA-073 | link | visible-default | "Artikel", → /admin/articles, fa-newspaper, desktop-only | FN-M09-10.2.1 |
| EL-M09-SHA-074 | link | visible-default | "Nota", → /admin/notes, fa-sticky-note, desktop-only | FN-M09-10.2.1 |
| EL-M09-SHA-076 | link | visible-default | "Upload Screenshot", → /admin/tools/screenshots, fa-cloud-upload-alt, desktop-only | FN-M09-10.2.1 |
| EL-M09-SHA-118 | heading | visible-default | "Pengurusan Artikel" | FN-M09-1.1.1 |
| EL-M09-SHA-119 | text | visible-default | "Urus artikel dan konten pendidikan" | FN-M09-1.1.1 |
| EL-M09-SHA-173 | text | hidden-only | "Kandungan" | FN-M09-10.2.2 |
| EL-M09-SHA-174 | link | hidden-only | "Banner", → /admin/banners, fa-image | FN-M09-10.2.2 |
| EL-M09-SHA-175 | link | hidden-only | "Artikel", → /admin/articles, fa-newspaper | FN-M09-10.2.2 |
| EL-M09-SHA-176 | link | hidden-only | "Nota", → /admin/notes, fa-sticky-note | FN-M09-10.2.2 |
| EL-M09-SHA-179 | link | hidden-only | "Upload Screenshot", → /admin/tools/screenshots, fa-cloud-upload-alt | FN-M09-10.2.2 |
| EL-M09-SHA-198 | heading | conditional | "Tambah Artikel Baru" | FN-M09-1.2.1 |
| EL-M09-SHA-199 | text | conditional | "Cipta artikel pendidikan baharu" | FN-M09-1.2.1 |
| EL-M09-SHA-200 | heading | conditional | "Edit Artikel" | FN-M09-1.3.1 |
| EL-M09-SHA-201 | text | conditional | "Kemaskini artikel" | FN-M09-1.3.1 |
| EL-M09-SHA-204 | heading | conditional | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M09-1.4.1 |
| EL-M09-SHA-205 | text | conditional | "Paparan artikel" | FN-M09-1.4.1 |
| EL-M09-SHA-206 | heading | conditional | "Cara Buat Nota Bergambar (Mind Map) yang Berkesan", state captured @1280 only | FN-M09-1.4.1 |
| EL-M09-SHA-208 | heading | conditional | "Pengurusan Nota" | FN-M09-3.1.1 |
| EL-M09-SHA-209 | text | conditional | "Urus nota pembelajaran dan sumber belajar" | FN-M09-3.1.1 |
| EL-M09-SHA-211 | heading | conditional | "Sifir 1 hingga 12 — Carta Lengkap" | FN-M09-3.3.1 |
| EL-M09-SHA-212 | text | conditional | "Paparan nota" | FN-M09-3.3.1 |
| EL-M09-SHA-213 | heading | conditional | "Pengurusan Banner" | FN-M09-4.1.1 |
| EL-M09-SHA-214 | text | conditional | "Urus banner promosi dan pengumuman" | FN-M09-4.1.1 |
| EL-M09-SHA-216 | heading | conditional | "Tambah Banner Baru" | FN-M09-4.2.1 |
| EL-M09-SHA-217 | text | conditional | "Cipta banner promosi atau pengumuman" | FN-M09-4.2.1 |
| EL-M09-SHA-219 | heading | conditional | "Edit Banner" | FN-M09-4.3.1 |
| EL-M09-SHA-220 | text | conditional | "Kemaskini maklumat banner" | FN-M09-4.3.1 |
| EL-M09-SHA-222 | heading | conditional | "Dashboard" | FN-M09-5.1.1 |
| EL-M09-SHA-223 | text | conditional | "Selamat datang, Admin" | FN-M09-5.1.1 |
| EL-M09-SHA-225 | heading | conditional | "Upload Screenshot" | FN-M09-9.1.1 |
| EL-M09-SHA-226 | text | conditional | "Tool admin untuk upload & urus gambar (private)" | FN-M09-9.1.1 |

Specific exclusions:

| Element | Content | Reason |
|---|---|---|
| EL-M09-SHA-001 | → /admin, desktop-only | Excluded: global shell brand/logo (→ `/admin`, "Panel Pentadbir") |
| EL-M09-SHA-002 | desktop-only | Excluded: global shell brand/logo (→ `/admin`, "Panel Pentadbir") |
| EL-M09-SHA-003 | "Panel Pentadbir", desktop-only | Excluded: global shell brand/logo (→ `/admin`, "Panel Pentadbir") |
| EL-M09-SHA-075 | "Push Notifikasi", → /admin/notifications, fa-bell, desktop-only | Excluded: M22 — "Push Notifikasi" in the "Kandungan" group |
| EL-M09-SHA-177 | "Push Notifikasi", → /admin/notifications, fa-bell | Excluded: M22 — "Push Notifikasi" in the "Kandungan" group |
| EL-M09-SHA-178 | "Chatbot", → /admin/chatbot, fa-robot | Excluded: M22 — "Chatbot" in the "Kandungan" section |
| EL-M09-SHA-196 | "Load: 0.36 / 8 cores", fa-microchip, title "Load: 0.36 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-197 | "Load: 0.3 / 8 cores", fa-microchip, title "Load: 0.3 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-202 | "Load: 0.4 / 8 cores", fa-microchip, title "Load: 0.4 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-203 | "16.6GB / 31.1GB", fa-memory, title "16.6GB / 31.1GB", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-207 | "Load: 0.34 / 8 cores", fa-microchip, title "Load: 0.34 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-210 | "Load: 0.28 / 8 cores", fa-microchip, title "Load: 0.28 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-215 | "Load: 0.24 / 8 cores", fa-microchip, title "Load: 0.24 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-218 | "16.9GB / 31.1GB", fa-memory, title "16.9GB / 31.1GB", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-221 | "Load: 0.38 / 8 cores", fa-microchip, title "Load: 0.38 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |
| EL-M09-SHA-224 | "Load: 0.39 / 8 cores", fa-microchip, title "Load: 0.39 / 8 cores", state captured @1280 only | Excluded: M23 — admin server-status widget tooltip (Load / memory) captured on an M09 page |

Other excluded SHA elements (prefix EL-M09-SHA-): 176 elements — IDs 004–006, 008–070, 077–117, 120–172, 180–195: **global shell / M23 and the module each link targets (navigation of other modules, header widgets, notification bell, avatar, logout, server-status widget, footer, chatbot, PWA/FCM, bottom tab bar, "Lagi" sheet sections of other modules; classified per URL in `_crawl.json`)**.

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7, D9, D10). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it with the smallest change that creates no new visible contradiction; where it works, replicate it exactly. Rows with status "Rejected — replicate live" were candidates that turned out to work; they are recorded so the audit can see the decision and its alternatives.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) | Alternatives considered | Status |
|---|---|---|---|---|---|---|
| DV-M09-01 | D-1, L-2 | Dead link (HTTP 500) | "Tambah Nota" `/admin/notes/create`, every row "Edit" and "Edit Nota" `/admin/notes/{id}/edit` return the global 500 page "Ralat Pelayan" (states `server-error`, `server-error-2`, `server-error@375`; `admin-note-create-500.png`). Notes cannot be created or edited on live; the form fields were never rendered. | Smallest working create and edit form in the admin shell, built only from what the note entity shows on S5/S8: "Tajuk *", "Ringkasan", "Kandungan *" (plain textarea like S2), "Subjek *" (the 5 subjects of the S5 filter), "Jenis *" (the 4 stored types exactly as displayed: "FORMULA", "RINGKASAN", "LENGKAP", "TIPS_TRICKS"), "Tahap *" ("Darjah 1"…"Darjah 6"), "Terbitkan Sekarang"; "Batal" / "Simpan Nota" (create) and "Kemaskini Nota" (edit); headers "Tambah Nota" / "Cipta nota baharu" and "Edit Nota" / "Kemaskini nota". Labels reuse live words (S5 column names, S8 grid labels, S2 labels, the live buttons "Tambah Nota" / "Edit Nota"); the rest is PROPOSED COPY. No file upload, no views/downloads input, no preview (none observable). | (a) Keep the 500 page — rejected: a dead "Tambah Nota" button and dead "Edit" links are broken under D9. (b) Remove "Tambah Nota" / "Edit" — rejected: changes the working list and preview layout. (c) Copy the article form wholesale (featured, image URL, category) — rejected: notes show no such fields. (d) Offer the filter's type set (summary …) — rejected: new notes would show raw "summary" in the "Jenis" column next to "RINGKASAN" (new contradiction). | Approved (user rule D9); PROPOSED COPY for owner confirmation at G1 (OQ-M09-11) |
| DV-M09-02 | D-2 | Candidate: blocked editor | S2/S3 load CKEditor 5 (toolbar config, `language: 'ms'`) but the CSP blocks `cdn.ckeditor.com` (`ReferenceError: ClassicEditor is not defined`): "Kandungan" is a plain textarea where the admin types HTML. | **Replicated**: a plain textarea; the admin types HTML, which the reader renders (AC-M09-03.5). | (a) Add a working rich editor — rejected: its UI never rendered on live (toolbar look, output format unobserved), so it would be invented UX; the textarea works and the content renders. (b) Use Quill as on S24 — rejected for the same reason. When unsure, follow live (D9). The risk is recorded as SEC-M09-01/06. | Rejected — replicate live |
| DV-M09-03 | D-5 | Broken function | On `/admin/articles?category=TIPS_BELAJAR&page=2` the pager links are `/admin/articles?page=1` (filters dropped): following them shows the unfiltered list, contradicting "Jumlah: 21 artikel" (state `filtered-page-2`). `/artikel`, `/video` and the other admin lists (M02, M07) keep their filters. | Every S1 pager link carries the active `search`, `category` and `published` values. Nothing else changes (page size, labels, layout). | (a) Replicate — rejected: page 2 of a filter is unreachable and the pager contradicts the count. (b) Also add filters to S5/S9 — not needed (S5 and S9 have no pager on live). | Approved (user rule D9) |
| DV-M09-04 | D-3 | Candidate: escaped preview | S4 and S8 print the stored body as escaped HTML text ("<h2>Apa Itu Teknik Pomodoro?</h2><p>…") instead of rendering it. | **Replicated**: the admin preview shows the stored source as text, for articles and notes alike. | (a) Render the HTML — rejected: the preview is readable and consistent on both screens (it shows exactly what is stored, like the S3 textarea), and rendering adds an admin-side XSS surface (SEC-M09-01); when unsure, follow live. (b) Render sanitised HTML — rejected: new behaviour. | Rejected — replicate live |
| DV-M09-05 | D-4 | Layout breakage | At 375px the long unbroken escaped string of S4 makes the page scroll sideways (document 424px > 375px, the only overflowing M09 state; `admin-article-show-mobile.png`). | The escaped body text wraps anywhere inside its card (`overflow-wrap: anywhere` / `break-all`) on S4 and S8, so the page never scrolls sideways. Text, font and card unchanged. | (a) Make the card scroll horizontally — rejected: prose is not a table; (b) hide the body on small screens — rejected: removes content. | Approved (user rule D9) |
| DV-M09-06 | D-7 | Broken function | S5 "Jenis" filter values (`summary`, `mind_map`, `flashcard`, `cheat_sheet`, `full_notes`) never equal the stored types (RINGKASAN, FORMULA, LENGKAP, TIPS_TRICKS): `?note_type=summary` → "Tiada nota dijumpai." although 5 notes are RINGKASAN (state `type-empty`). | The filter keeps its live options and labels and matches by meaning: "Ringkasan" `summary` ↔ RINGKASAN (label equal to the stored type); "Nota Penuh" `full_notes` ↔ LENGKAP (live note 5 is titled "… Nota Lengkap" and typed LENGKAP); "Mind Map", "Flashcard", "Cheat Sheet" ↔ a type of the same name (none exists, so empty, as today). FORMULA and TIPS_TRICKS stay unfilterable (no option on live; adding options would be new scope, D10). **Delivery Lead choice.** | (a) Replace the options with the stored types — rejected: changes the visible filter. (b) Label-only matching (only "Ringkasan") — rejected: leaves "Nota Penuh" empty next to 2 LENGKAP notes. (c) Remove the filter — rejected. | Approved (user rule D9) — Delivery Lead choice |
| DV-M09-07 | D-6 (edit preload) | Broken function | The S11 selects are not preloaded: stored HERO/FEATURE/PROMOTIONAL/ANNOUNCEMENT, ALL/STUDENT, NONE vs options `hero/promo/announcement/event`, `all/student/teacher/admin`, `none/…`. On load "Jenis Banner" shows "Pilih jenis banner" (form invalid: saving unchanged fails), "Jenis Pautan" "Tiada Pautan" while Alpine `linkType` = "NONE", "Sasaran Penonton" "Semua" even for a STUDENT banner (choosing a type then saving silently resets the audience) (states `default`, `feature`; `admin-banner-edit.png`). | The edit selects show the stored value: match ignoring case (HERO → "Hero", ANNOUNCEMENT → "Pengumuman", ALL → "Semua", STUDENT → "Pelajar", NONE → "Tiada Pautan"); a stored code with no option (FEATURE, PROMOTIONAL) appears as one extra selected option whose label is the stored code as shown in the list (e.g. "FEATURE"), only on that record's form. Saving unchanged keeps every stored value, so the list and the M05 carousel badge do not change. Create is unchanged. | (a) Map PROMOTIONAL → "Promo" and FEATURE → "Hero" — rejected: silently changes stored data and the dashboard badge/icon (new contradiction). (b) Add FEATURE/PROMOTIONAL to every form — rejected: new options on create (new scope). (c) Leave as live — rejected: saving unchanged fails and the audience resets (broken). | Approved (user rule D9) |
| DV-M09-08 | D-9 | Wrong titles | S12 and S13 (admin shell) show the stale header "Dashboard" / "Selamat datang, Admin"; S21 (user shell) shows "Dashboard" / "Selamat datang kembali" (EL-M09-SHA-222/223, SHU-382/383) — both are the shells' dashboard fallback, not page texts. | Implemented by the shell rule **DV-SH-03** (design/shells.md: the header title comes from the current route): S12 "Set Audio KBAT", S13 "Cipta Set Audio KBAT" and S21 "Audio KBAT", each with **no subtitle** (the stale dashboard subtitles are dropped on all three, consistently; no page subtitle exists on live). Titles = the live tab titles. Layout stays role-based (the admin sees S21 in the user shell, as live). | (a) Write new subtitles — rejected: no live copy (PROPOSED COPY without need). (b) Keep "Selamat datang kembali" on S21 — rejected (AUD-M09-10a): it is the same stale fallback as "Selamat datang, Admin", so keeping one and dropping the other would be inconsistent. (c) Replicate "Dashboard" — rejected: wrong title (D9). | Approved (user rule D9; DV-SH-03) |
| DV-M09-09 | D-11 | Unreadable text / invisible control | On S21 the hero classes `from-slate-950 via-amber-900 to-orange-700` are missing from the CSS build: background transparent (`rgba(0,0,0,0)`), pill text white on white-15 %, paragraph amber-100 on the pale page (unreadable), h1 slate-800; "Tapis" has `bg-slate-900` missing → white text on white (invisible) (`audio-kbat-student.png`, computed colours). | The hero gets its intended gradient (SOURCE-DERIVED from the class names, Tailwind default palette); pill and paragraph keep their live colours (now readable); the h1 renders white, the `text-white` of the hero container (`rounded-3xl bg-gradient-to-br from-slate-950 via-amber-900 to-orange-700 text-white …`) — SOURCE-DERIVED from the live markup, not a new colour choice (live: the global heading colour overrides the inherited white). "Tapis" gets its intended `bg-slate-900 text-white`. Nothing else changes. | (a) Keep the light page and darken the texts — rejected: contradicts the evident intent in the markup and needs new colour choices. (b) Keep the h1 slate-800 — rejected: it would become unreadable on the restored dark gradient (new defect), and the markup intends white. | Approved (user rule D9) |
| DV-M09-10 | D-10 | Dead link | Video pills with a 0 count link to `#` ("Lain-lain (0)"; with a no-match search every pill, **including "Semua (0)"**), which only jumps to the top and adds "#" to the URL (`video-empty.png`). | A 0-count pill — every zero-count category pill and "Semua (0)" — keeps its look and text but is not a link: clicking it does nothing (no navigation, no URL change). Pills with counts are unchanged. | (a) Replicate `href="#"` — rejected: a dead link (D9 list); in the SPA "#" would also disturb routing. (b) Link it to its category (empty result page) — rejected: changes behaviour that live deliberately avoids. (c) Hide 0-count pills — rejected: removes visible pills. | Approved (user rule D9) |
| DV-M09-11 | D-6 (raw values) | Candidate: raw codes | Admin tables show stored codes: S1 Tahap "DARJAH_4" / "SEMUA", S5 Jenis "TIPS_TRICKS", Tahap "DARJAH 2", S9 Jenis "HERO"…, Sasaran "ALL" / "STUDENT". | **Replicated.** The codes are readable, consistent on each screen and are what the admin stores; the M05 dashboard (approved) also shows the stored banner types as badges. | Map to form labels — rejected: working, admin-only display; would create a mismatch with the M05 badges. | Rejected — replicate live |
| DV-M09-12 | D-15 | Layout breakage | At 1280px with the sidebar open, the 6-column `/artikel` cards wrap the meta line word by word ("7 / bulan / yang / lepas" stacked) (`artikel-desktop.png`). | Each meta item (author, views, relative date) does not break inside itself (`white-space: nowrap` per item); the row may wrap between items. Column count, card content and fonts unchanged. | (a) Reduce to 4 or 5 columns at `xl` — rejected: changes the working grid. (b) Truncate the date — rejected: hides text. | Approved (user rule D9) |
| DV-M09-13 | D-8 | Candidate: link types without target | "Jenis Pautan" Subjek / Kuiz / Artikel show no target field; only "Pautan Luar" has one; the carousel shows no link at all. | **Replicated**: the options are kept and stored; no target field. | Add target pickers — rejected: new UI and data never observed (new scope, D10); nothing visible is broken. | Rejected — replicate live (OQ-M09-04) |
| DV-M09-14 | D-12 | Broken link (placeholder) | Panduan "WhatsApp" → `https://wa.me/60123456789`, an obvious placeholder number. | **PROPOSED**: the WhatsApp link is built from a configuration value (support number) that the owner supplies; no number is invented. Until the owner supplies it, the configuration holds the live placeholder, so the prototype behaves as live. Button, label and position unchanged. | (a) Invent a number — rejected. (b) Hide the button until configured — rejected: removes a visible control before the owner decides. | PROPOSED — pending the owner's number (OQ-M09-10) |
| DV-M09-15 | D-14 | Candidate: contradictory access | `/pusat-tuisyen/panduan` redirects guests to `/login` while the identical `/panduan` is public. | **Replicated.** It is a route-group rule (every `/pusat-tuisyen/*` page needs login), deliberate and consistent; guests never see a link to it (it exists only in the logged-in drawer) and the same content is public at `/panduan`, so nothing a user can reach is contradictory. | Make it public — rejected: changes a deliberate route-group gate. | Rejected — replicate live |
| DV-M09-16 | D-13 | Candidate: table wider than the screen | S1 (498px in a 318px card at 375; 773px in 667px at 768), S5 (766px) and S9 (610 / 948px) tables scroll inside their cards; "Tindakan" is reached by scrolling the card; the page never scrolls. | **Replicated.** In-card scrolling is NFR-RESP-05 option (b) and the approved precedent (M02 DV-01, M03 DV-03, M04 DV-09, M07 DV-07). No sticky column. | Sticky action column or card layout — rejected: changes working behaviour (AUD-M07-02). | Rejected — replicate live |
| DV-M09-18 | D-16 (top-up) | Dead link (HTTP 404) | On S28 the top-bar "Daftar Percuma" and the CTA "Daftar Percuma Sekarang" link to `/daftar`, which answers 404 for a guest; registration lives at `/register` (M01), the target of every other "Daftar" link on the site (S15/S17 guest pages, S26). | Both links → `/register` (M01 register route). Labels, styles and positions unchanged. | (a) Replicate the 404 — rejected: dead link (D9). (b) Add a `/daftar` alias route — rejected: a new route; pointing at the existing `/register` is smaller. | Approved (user rule D9) |
| DV-M09-19 | D-16 (top-up) | Dead links (HTTP 404) | The S28 footer links "Tentang" → `/tentang` and "Hubungi" → `/hubungi` both answer 404 for a guest; no about or contact page exists anywhere on the site. | **"Hubungi" → `/panduan`**: the only existing contact section on the site is the panduan help box "Perlukan Bantuan Lanjut?" / "Hubungi pasukan sokongan kami untuk sebarang pertanyaan." (e-mail and WhatsApp), which fits the label. **"Tentang" replicated**: it keeps `/tentang` and shows the global 404 page, as live — there is no page about the platform in scope (the public landing page `/` is out of scope and "Utama" already links there), and inventing an about page is not allowed. **Delivery Lead choice.** | Tentang: (a) → `/` — rejected: duplicates "Utama" and is not an about page; (b) a new about page — rejected: invented content. Hubungi: (a) replicate 404 — rejected because a fitting page exists; (b) `mailto:support@prestasiplus.my` — rejected: changes a page link into an e-mail action; (c) a new contact page — rejected: invented. | Approved (user rule D9) — Delivery Lead choice |
| DV-M09-17 | — | Dead link (precedent) | The global 404 page (unknown article slug, video id, video edit id, perutusan id) has "Mula Latihan" → `/latih-tubi`, itself a 404. | "Mula Latihan" → `/practice`, as decided in M01 DV-M01-02. | — | = M01 DV-M01-02 |
| DV-M09-20 | — (v1.7; evidence `_live-videos.json`) | Broken function (pagination) / contradictory counts | On live, `?subject={id}` list pagination repeats ids across pages, so **329 videos never appear in any subject list**: Matematik 143 (pill 865, 722 reachable), Matematik Tambahan 69 (pill 420, 351 reachable), Fizik 114 (pill 779, 665 reachable), plus 3 videos with no subject; Sejarah (97) and Kimia (96) are complete. The pills include the hidden videos, so a pill count never equals what its list can show (`subjectListStats`). | Every video belongs to exactly one subject (or none for 3). The 1,931 rows seen in a subject list keep their live subject; the 3 no-subject rows are ids 16, 17 and 19; the other 326 are assigned by, in order: (1) id-run neighbours agreeing on both sides (159); (2) title keyword, "Mat" / "Mate" read as Matematik (166); (3) id 1052, which no rule decides, takes the subject short of its pill count (1). Pills equal the computed counts; subject lists page without repeats. The earlier SRS §6.9 id-range table disagreed with 65 observed rows and is dropped. | (a) Replicate the repeats (leave 329 videos unreachable) — rejected: broken pagination and pills that contradict their lists (D9, D11). (b) Show the unreachable rows as "no subject" — rejected: changes the five live pill counts. (c) Assign by the old id-range table — rejected: contradicted by 65 observed rows. | Approved (user rule D9, D11); assignments of the 326 rows are INFERRED |
| DV-M09-21 | — (v1.7; evidence `panduan-desktop.png`) | Visual bug | On `/panduan` (S26) and `/pusat-tuisyen/panduan` (S27) the footer logo sits flush against the left edge of the page, outside the centred text column ("© 2026 🇲🇾" · "Platform Latih Tubi Nasional"). | The logo is centred between "© 2026 🇲🇾" and "Platform Latih Tubi Nasional", inside the same column, at every width. Texts, sizes and colours unchanged. | Replicate the left-edge logo — rejected: layout bug (D9). | Approved (user rule D9) |
| DV-M09-22 | - | Language (BM copy) | Admin articles, notes, banners, audio KBAT, video and Panduan pages: "Optional", "KBAT Level", "Approved" / "Draft" / "Pending Review" / "Draft/Pending", "Featured", "Views", "Mind Map" / "Flashcard" / "Cheat Sheet", "Promo" / "Hero", "Reset Subjek", "Tips ...", "Template Word" / "Template XLSX", "Upload Screenshot", "Link" in video/article copy, Manglish guide sentences | "Pilihan", "Tahap KBAT", "Diluluskan" / "Draf" / "Menunggu Semakan" / "Draf/Menunggu" (glossary section 4), "Pilihan", "Paparan", "Peta Minda" / "Kad Imbas" / "Helaian Rujukan Pantas", "Promosi" / "Utama", "Set Semula Subjek", "Petua ...", "Templat Word" / "Templat XLSX", "Muat Naik Tangkapan Skrin", "Pautan", BM sentences. Seed article titles and banner texts observed on live are left as observed. | - | Approved: user decision 2026-10-24 (system audit FB-025) |
| DV-M09-23 | - | Language (BM copy) | Panduan (role guide), top bar and article breadcrumb: "Dashboard" (link, breadcrumb), "Dashboard Daerah (PPD)", "Dashboard Negeri (JPN)" | "Papan Pemuka", "Papan Pemuka Daerah (PPD)", "Papan Pemuka Negeri (JPN)". | - | Approved: user decision 2026-10-24 (system audit FB-025) |

**Build decision notes (v1.7; M09 reader-screen build)** — behaviours decided while building S15–S21 and S26/S27 where live gave no observation or one dead control. They are not new features; none adds or changes a live feature.

| ID | Subject | Decision | Source |
|---|---|---|---|
| DN-M09-01 | L-7 guest video detail | A guest can open `/video/{id}` (S18) in the public layout, without the section label and without the CTA, and never sees "Edit" / "Padam"; API #28 is public (BR-M09-31). | INFERRED |
| DN-M09-02 | S19 by a user who is neither the uploader nor the admin | Redirect to the session landing page; if that landing page is itself a video route, show an in-place 403 (no redirect loop). API answers 403. | INFERRED |
| DN-M09-03 | S19 visibility cards | S19 does not show the cards' sub-lines (`video-edit.png`, OBSERVED); S20 shows them. | OBSERVED (S19) |
| DN-M09-04 | Pill links with an active search | `search` is appended last to every category and subject pill link; live showed no active-search case with a link. "Semua (0)" and every zero-count pill render as a non-link (DV-M09-10; live `href="#"`). | INFERRED / DV-M09-10 |
| DN-M09-05 | S19 with stored `school` visibility but no form-context school | The visibility resets to `global` on the form (otherwise a disabled option would stay selected). | INFERRED |
| DN-M09-06 | Edit-page opens | `/video/{id}/edit` does not count a view (live does not); implemented as `GET /api/videos/:id?for=edit` (SRS §7 #28). | OBSERVED (live) / INFERRED (API form) |

**Explicitly not deviations** (replicated as live):
- The admin reads `/artikel`, `/video*`, `/audio-kbat` and `/perutusan*` in the **user shell**; guests get separate public layouts on `/artikel` and `/video`; `/panduan` is standalone.
- The random "Artikel Paling Hangat" (different on each load) and its absence while searching or filtering; it also shows on pages 2–4.
- Different subject orders: A–Z on Audio KBAT, id order on the video forms.
- English strings: "Views" column, "Featured" badge, the Laravel pager, Audio KBAT "Approved" / "Draft" / "Pending Review" / "Archived", the "Draft/Pending" card, "DSKP SP ID", "Optional".
- Audio KBAT create defaults to "Approved" (SEC-M09-12); no "Batal" on S13; audio files not required; stat cards global.
- The video edit footer order (save left, "Batal" right) differs from the admin forms; "Platform dikesan: Youtube" (stored spelling) on edit vs "YouTube" on add.
- "Sekolah Saya" disabled with "Tiada sekolah" for the admin. On live, `/profile` shows no school while `/profile/edit` has a selected school (Alpine `selectedSchool`, an SK in Johor, PPD KLUANG) for the same account, so the video form reads another school source; that source is modelled as its own INFERRED field (`videoSchoolId`, SRS BR-M09-21), empty for the seed admin, and M01 stays unchanged (OQ-M09-07).
- Comments are moderated; there is no like button on the article detail although "Suka" is displayed.
- Notes: unknown id → list **without** flash (articles and banners show a flash); no note reader page.
- The banner "Pautan Luar" URL is kept in the hidden field when switching away.
- Delete actions use the browser `confirm()`; no soft delete.
- Accessibility attributes, focus handling and motion replicate live (D10). Icon-only row actions keep their live visual size; NFR-RESP-03 (44px) applies through the hit area only.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Teacher article contribution `/guru/artikel`, `/guru/artikel/cipta`, `/guru/artikel/{id}/edit` | M10 (writes into the M09 article store). |
| Dashboard carousel and article strip behaviour (auto-advance, "Baca Selanjutnya", strip scrolling) | M05 (reads M09 data). |
| Push notifications, chatbot, tournament banner, coins/points/streak pills, notification bell, server-status widget | M22 / M16 / M14 / global shell / M23. |
| Comment moderation screen for perutusan | Not found on live (owner unknown, OQ-M09-05); comments stay pending in the prototype. |
| Final Audio KBAT player, scoring and results; Audio KBAT row actions; template file contents | Pending live session L-3 (provisional pages only); template files not opened (OQ-M09-03). |
| A notes reader page | Does not exist on live. |
| Real file storage, virus scanning, CDN editors, YouTube/Vimeo APIs | Backend phase (D1); the prototype stores file names only and uses URL parsing; risks as SEC-M09-nn. |

---

## 9. Open questions

Only questions that cannot be answered from the live site read-only. "Pending live session" items need the user's approval for a session with other roles and/or submits (as M01 OQ-1, M05 LS, M06/M07 L-states).

1. **OQ-M09-01 Notes form (DV-M09-01).** The live note create/edit forms return HTTP 500, so their fields are unknown. Confirm the minimal form (title, summary, content, subject, stored type, level, publish) and whether notes should have a student-facing page (none exists; views/downloads counters exist).
2. **OQ-M09-02 Article drafts (INFERRED).** Draft pill label/colour in S1 (0 drafts on live) and whether drafts are hidden from `/artikel` (prototype: hidden) — UNVERIFIED.
3. **OQ-M09-03 Audio KBAT (pending live session L-3).** Row layout and actions (edit / approve / archive / delete), student list item and player (audio per section, questions shown together, submission, scoring, result), template XLSX/Word contents (prototype serves placeholder files).
4. **OQ-M09-04 Banners (INFERRED).** Audience and date rules for students/teachers; what link types Subjek / Kuiz / Artikel do (no target field); whether new types `promo` / `event` show on the dashboard and with which icon (M05 maps only the 4 stored types; prototype shows the badge text with no type icon — cross-module note to M05).
5. **OQ-M09-05 Perutusan (pending live session L-4, L-6).** Who may write (prototype: admin and school_admin), scope values for PPD/JPN/teacher writers, pin-limit message, scheduled publishing, draft visibility, where comments are approved, edit/delete of own posts in "Perutusan Saya". `/perutusan/awam/{id}` was captured in the discovery top-up (S28); the logged-in view of that page and non-public ids remain unobserved (INFERRED).
6. **OQ-M09-06 Perutusan read count (INFERRED).** OBSERVED: the admin's open of #4 and a guest GET of `/perutusan/awam/4` both left "3 baca" unchanged. Prototype rule (consistent with both): one read per user per post for logged-in users who are neither the admin nor the author; the public page never counts. Confirm with another role.
7. **OQ-M09-07 Video permissions and school (INFERRED).** Who may add videos (prototype: every logged-in role), who sees "Edit"/"Padam" (uploader and admin), and which school source enables "Sekolah Saya": for the live admin `/profile` shows no school, `/profile/edit` has a selected school, and the video form shows "Tiada sekolah"; the prototype models a separate INFERRED `videoSchoolId` (empty for the admin seed; seeded for the provisional teacher case).
8. **OQ-M09-08 Screenshot tool (pending L-5).** File list columns, copy URL, delete, size/type error texts.
9. **OQ-M09-09 UNVERIFIED COPY (pending L-1).** Success and error flashes after saving/deleting articles, banners, videos, audio sets, perutusan, comments and reactions; server validation texts. Placeholders in SRS §8.2.
10. **OQ-M09-10 WhatsApp support number (DV-M09-14).** The owner supplies the real number; until then the configuration keeps the live placeholder.
11. **OQ-M09-11 PROPOSED COPY for owner acceptance at G1.** DV-M09-01: "Tambah Nota" / "Cipta nota baharu", "Edit Nota" / "Kemaskini nota", "Tajuk *", "Kandungan *", "Subjek *", "Jenis *", "Tahap *", "Simpan Nota", "Kemaskini Nota", tab titles "Tambah Nota - Admin PRESTASIPLUS" / "Edit Nota - Admin PRESTASIPLUS"; provisional Audio KBAT player: "Hantar", "Kembali", "Skor anda n / total", "Audio tidak tersedia.", "Ralat memuatkan data. Sila cuba semula.", page title "Audio KBAT" (list and player; h1 = set title). Also the SRS §8.2 placeholders that stand in for UNVERIFIED live copy (flashes after save/delete for articles, notes, banners, Audio KBAT sets, videos and perutusan; the pin-limit error; the comment-sent message; screenshot saved/refused; the generic server field error "Medan ini diperlukan."; the placeholder pills "Draf" (article, note), "Tidak Aktif" (banner), perutusan status labels "Diterbitkan" / "Dijadualkan" / "Draf" and the admin role pill "Admin"), and DV-M09-06 (note-type mapping) as a Delivery Lead choice.
12. **OQ-M09-12 Live-session states L-1…L-7 (pending the user's approval).** Save/delete results (L-1), notes form after a fix (L-2), Audio KBAT with a set (L-3), perutusan interactions (L-4), screenshot upload (L-5), other roles (L-6), guest detail pages (L-7, each adds a view). Priority: L-3 and L-4 (they replace provisional pages).
13. **OQ-M09-13 Cross-module change requests (for the Delivery Lead).** (a) **M05**: replace the §6.12 placeholder banners/articles with the M09 store (`GET /api/dashboard` reads M09); the 5 articles and 5 banners stay identical. (b) **M01**: no change — the canonical admin school SK Demo (900002) mirrors the live profile-edit school; M09 reads its own `videoSchoolId` (OQ-M09-07). (c) **M02 — recorded (M02 v1.6, closed)**: the fictitious school anchor 900003 "SMK Demo Seri Putra" for the author of perutusan #4 and the M09 user anchors 3101–3109 (SRS §6.9) in the users id policy and the TRACKER canonical note. (d) **M10**: settled in v1.4 (XL2-19) — M10 creates teacher articles with `isPublished = false` ("Menunggu Semakan", M10 BR-M10-29) through the M09 repository; the admin publishes them on S3. Whether live shows the YouTube link or attachments anywhere on `/artikel/{slug}` is unobserved (no teacher article with them exists on live).
14. **OQ-M09-14 Hot section pool and likes (INFERRED).** "POPULAR" = most-viewed non-featured articles (prototype: top 10 by views); where "Suka" likes come from (no like control on live; the prototype keeps stored values).
