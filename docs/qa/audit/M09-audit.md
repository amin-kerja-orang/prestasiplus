# M09 — Content (Articles, Notes, Banners, Audio KBAT, Video, Perutusan, Panduan) — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6, step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 3 (`playwright3`). This agent did not write the URS or the SRS. |
| Documents audited | `docs/requirements/urs/M09-content.md` v1.0 and `docs/requirements/srs/M09-content.md` v1.0 |
| Evidence | <ul><li>Live https://prestasiplus.my: an admin session on lane 3 (read-only) and one cookie-less context for the guest checks.</li><li>`docs/discovery/M09-content.md`, `inventory/M09/*`, `_raw/M09/*`, `_crawl.json`, `_summary.md`.</li><li>Page markup read in place with same-origin GETs (throttled ≥ 400 ms).</li><li>Cross-checks against the M01 SRS canonical seed (§6.8, TRACKER "Canonical seed accounts").</li><li>Masked screenshots in `docs/qa/audit/img/M09/`.</li></ul> |
| Safety | <ul><li>**Read-only.** Nothing was submitted, uploaded, liked, reacted to, commented on or deleted. No toggle was changed.</li><li>**View counters.** `/artikel/{slug}`, `/video/{id}` and `/perutusan/{id}` were **not** opened. The saved inventory was used instead (S16 "596", S18 "120 tontonan", S23 "3 baca"). One cookie-less `GET /perutusan/awam/4` was sent with `maxRedirects: 0`, reading the status code only (200). Afterwards the list still showed "3 baca", so that GET did not count a read.</li><li>**Tools.** The shared tools were not modified. `run-state.js` and `inventory.js` were re-run on 9 states with `jobs/M09.js`. The output was compared and then deleted. The scratch scripts are in `<scratchpad>/m09-audit/`.</li><li>**Personal data.** No person name, e-mail or real school name was written to a file. The admin's live school is described only as "an SK in Johor, district PPD KLUANG". The screenshots were masked with `M09MASK` + `sanitize.js`, and the school card with a manual mask (leak check: 0).</li></ul> |

## Verdict: **FAIL**

There are **0 Critical, 4 Major and 8 Minor** findings.

**What holds up:**
- **Completeness proof.** All 1,983 inventory IDs appear exactly once in URS §6.1, with 0 missing, 0 extra and 0 duplicates, checked by script.
  - The 74 exclusions are exactly 33 M16 rows and 41 M01 `/login` rows.
  - The 5 S27 panduan emoji (064 🏆, 121 🎯, 141 ✏️, 186 📚, 194 💡) are mapped to FN-8.1.4/8.1.5/8.1.6.
- **Re-inventory.** The 9 re-run states give identical totals (241, 206, 221, 226, 223, 408, 418, 465, 318). The only differences are the M23 server-status widget values (load, memory, uptime).
- **Traceability.** 164 AC and 129 FR each reach ≥ 1 E2E. There are 72 E2E, all on 375/768/1280. The only parse break is FR-29 (AUD-M09-07).
- **Behaviour.** The following match live exactly:
  - the random hot section and its absence while filtering;
  - pager rules (admin drops the filters; `/artikel` and `/video` keep them);
  - the video facet counts;
  - the banner edit failure;
  - the note-type filter failure;
  - the audio hero classes;
  - the guest redirects;
  - the panduan `replaceState`;
  - the CSS upper case;
  - no sticky cells;
  - the 50/40-character truncation.
- **Deviations.** Every one of the 10 applied fixes corresponds to a live defect that was reproduced. The 6 rejected candidates are correctly rejected.

**Where it fails:**
1. **The article seed is filler for data that is fully observable, and the live ids are not kept.** The admin list shows all 72 titles, categories, levels, views and dates on 4 pages. The seed nevertheless:
   - invents 30 "Artikel Contoh …" titles;
   - re-numbers the observed ones (live #1 "5 Tips…" is seed #14; live #9 "AI Ini…" is seed #13; live #13 "Teknik KWLH" is seed #39);
   - sets most levels to `SEMUA`;
   - gives 1 wrong category;
   - changes a title ("…KSSR 2027"; live "…KSSR 2026").
2. **The video seed order contradicts an observed state.** Live `?subject=5` lists 2224, 2225, …, 2247 (ascending). The seed timestamps put 2260, 2259, … right after 2228.
3. **The perutusan read rule contradicts the one observation.** The admin's open of #4 left "3 baca" unchanged, yet FN-7.2.12 and BR-07 count it, and E2E-59 asserts "4 baca".
4. **The seed contradicts the canonical seed.** `guru@demo.test` is placed at "SK Demo (Johor)", while the canonical seed has SMK DEMO (Selangor). The provisional E2E-52, E2E-57 and AC-27.3 depend on it.

## Summary counts

| Measure | Result |
|---|---|
| Content ELs in URS §6.1 (checked by script) | 1,983 / 1,983. 1,909 are mapped and 74 are excluded. 0 are missing, 0 are duplicated, 0 are unknown. |
| Exclusions | <ul><li>33 are the M16 tournament banner (3 × S15–S25).</li><li>41 are M01 `/login` (S27-319…359, guest redirect).</li><li>The 5 panduan emoji whose key collided with a `/login` emoji stay mapped (verified).</li></ul> |
| FN ↔ matrix | 227 FN are defined and 0 unknown FN references were found. The matrix cites 150 distinct FN in §6.1; the rest are cited in the §6.2 shell rows or are behaviour-only. |
| Coverage spot-check | 30 rows (every 66th row), **30 correct** (list below) |
| Live re-inventory (`run-state.js` + `inventory.js` + `sanitize.js`, `jobs/M09.js`) | <ul><li>9 states: S1 default@1280, S5 type-empty, S9 default@375, S11 feature, S12 default, S20 default, S22 default, S24 scheduled, S26 guru.</li><li>Totals and element keys are identical. The only differences are 4–5 server-status texts (M23 widget, excluded).</li><li>PII leaks: 0.</li><li>Action logs reproduce D-6 (`banner_type=""`, `target_audience="all"` on #2), D-7 (`note_type=summary` → 0) and S20 `invalid(3)=video_url,title,category`.</li></ul> |
| Traceability (script) | <ul><li>Every AC (164) has ≥ 1 E2E, and every FR (129) has ≥ 1 E2E.</li><li>All 227 FN are cited by an FR, but FN-2.2.1/2.2.2 parse as uncited because FR-29 breaks the table (AUD-M09-07).</li><li>28 E2E are marked provisional; at least 2 more assert INFERRED rules (AUD-M09-08).</li></ul> |
| Claims verified against live | **58**: 49 correct, 9 incorrect or incomplete (list below) |
| Deviations DV-M09-01…17 | <ul><li>10 fixes: all live defects reproduced; minimal; none creates a new contradiction.</li><li>DV-14 is PROPOSED; it behaves as live until configured.</li><li>6 rejections: all correct.</li><li>Wording issues on DV-08 and DV-09 (AUD-M09-10).</li></ul> |
| Findings | **Critical 0 · Major 4 · Minor 8** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M09-01 | **Major** | SRS §6.9 Articles table and preamble ("live ids 1–72", "seed placeholder (live title not captured)", "(seed)" views, "title start OBSERVED (tail … seed-assigned)"); SRS §6.1 `id` note; URS AC-01.2, AC-02.1, AC-05.4, AC-06.2; SRS E2E-02, E2E-13 (#17, #25 first-row claims) | **The article seed invents values that live shows, and it does not keep live ids.** The admin list `/admin/articles?page=1…4` shows every article's id, title (≤ 50 characters; the full title is on the `/artikel` cards), category, level, views and date. The seed is wrong in five ways:<br>(a) **30 filler titles** ("Artikel Contoh Motivasi 01"… at ids 3–9, 26–30, 48–72). Live has real titles there, for example #25 "Kegagalan Bukan Pengakhiran, Tapi Permulaan", #28 "Jangan Bandingkan Diri dengan Orang Lain" (a live "POPULAR" card) and #59 "KPM Umum Penambahbaikan Kurikulum KSSR 2026".<br>(b) **Live ids are not kept.** Live #1 = "5 Tips Belajar Matematik…" (seed #14); live #9 = "AI Ini Apa Sebenarnya?…" (seed #13, while seed #9 is filler); live #13 = "Belajar Bahasa Melayu: Teknik KWLH…" (featured, DARJAH_3, 448; seed #39). So `?page=4` rows "70, 71, 72, 9, 1…8" match only by id and not by content, and E2E-02 "#17 first" / "first row #25" assert seed-only records.<br>(c) **Invented value:** "KPM Umum Penambahbaikan Kurikulum KSSR **2027**" (live **2026**).<br>(d) **Wrong category:** "Cara Atasi Rasa Malas Belajar" is **Motivasi** on live (seed TIPS_BELAJAR).<br>(e) **Levels:** most rows are seeded `SEMUA`, while live shows DARJAH_1…6 on 40+ rows (e.g. #12 DARJAH_6, #14 DARJAH_2). Views are marked "(seed)" although they are observable (e.g. KWLH 448 vs seed 470; "Cara Atasi…" 483 vs 350).<br>This is the M07 AUD-03 / M08 AUD-05 error. | <ul><li>`/admin/articles` pages 1–4, read in full (72 rows: id, star, title, category, level, views, date).</li><li>`/artikel` pages 1, 2 and 4 (card order and relative ages).</li><li>Screenshot `img/M09/aud-admin-articles-p2-live-titles-masked.png`.</li></ul> | <ul><li>Rebuild the 72-row seed from the live admin list: live id, full title (from `/artikel`), category, level, featured, author initial (A/P) and views as observed. Created dates are already right (10–72: 22/02; 9: 10/02; 1–8: 06/02).</li><li>Keep publish dates only as needed to reproduce the observed reader order (pages 1–4 are now known).</li><li>Mark only genuinely unobserved fields (excerpts, bodies, likes ≠ #10) as seed-assigned.</li><li>Re-derive E2E-02/13/16 and AC-06.2/09.5 from the corrected seed.</li><li>Re-check BR-05 (pool of 10) against the live views: the observed POPULAR cards 574, 549, 532, 526 and 514 are all inside the top-10 non-featured.</li></ul> |
| AUD-M09-02 | **Major** | SRS §6.9 Videos "Order" paragraph, BR-M09-19; URS FN-6.1.9 | **The video seed order contradicts an observed state.** The seed gives every non-page-1 video `createdAt` = 2026-03-02 12:00 − (2260 − id) s, so under BR-19 (created desc) `?subject=5` would list 2224…2228 and then **2260, 2259, 2258…**. Live `?subject=5` (discovery state `subject`, re-read now) lists **2224, 2225, 2226, …, 2247 in ascending order**, as discovery §2.17 also states ("inside one subject ascending id"). The builder claims to reproduce only page 1 and the last page. The subject view is also observed and is contradicted. | `/video?subject=5`: ids 2224–2247 in order, "Showing 1 to 24 of 97 results". | Assign the generated `createdAt` values so that the observed states hold: page 1, page 95 **and** the observed `?subject=5` and `?category=motivasi` (18, 17, 16) orders. For example, give the Sejarah batch 2224–2258 one shared timestamp (ties id ascending). Add an E2E assertion for the `?subject=5` first ids. |
| AUD-M09-03 | **Major** | URS FN-7.2.12, OQ-M09-06; SRS BR-M09-07 (perutusan part), FR-98, E2E-59 | **The specified read rule contradicts the only observation.** Discovery opened `/perutusan/4` once as the admin, who is not the author, and "baca" stayed 3 (S23 inventory "3 baca"; list still "3 baca" now). BR-07 ("one read per (user, post), the author excluded") makes that open count, and E2E-59 asserts "the admin's opens of #4 → '4 baca'". A provisional rule may be INFERRED, but it must not contradict what was observed. | S23 inventory "3 baca"; `/perutusan` list "3 baca, 4 baca, 55 baca" (unchanged). | Choose a rule consistent with the observation and record it as INFERRED. Options: the admin is not counted, or the admin had already read #4 (then seed a read row for admin–#4). Fix E2E-59 so that the admin's open leaves #4 at 3. |
| AUD-M09-04 | **Major** | SRS §6.9 Users table and the paragraph after it; URS §4 AC preamble, AC-19.2, AC-27.3, AC-29.5; SRS E2E-40, E2E-52, E2E-57 | **Cross-module seed mismatch.** M09 places `guru@demo.test` (id 5) at "SK Demo (Johor)". The canonical seed (TRACKER; M01 SRS §6.8, XL-26) has id 5 at **SMK DEMO (Selangor, BEA4001)**. The provisional E2E-52 ("Sekolah Saya" shows "SK Demo (Johor)") and E2E-57 (`guru` sees only #3 of SK Demo) are built on the wrong school. The school names are also cased differently from M01 ("SMK Demo (Selangor)" vs "SMK DEMO"). | `docs/requirements/srs/M01-authentication.md` §6.8 rows 5 and 8, schools list (lines 382, 393–394). | <ul><li>Use the canonical seed: guru = SMK DEMO (Selangor).</li><li>Re-derive AC-27.3, AC-29.5 and E2E-52/57 (e.g. guru and pelajar both see #2; #3's SK Demo is seen by `pelajarmaju@demo.test`, id 4).</li><li>Use the M01 school names verbatim.</li></ul> |
| AUD-M09-05 | Minor | URS §7 "Explicitly not deviations" (Sekolah Saya bullet), OQ-M09-07, OQ-M09-13b; SRS BR-M09-21, FR-88, §6.9 admin row | **The admin-school rule is an invented role exception, and the evidence is misquoted.**<br>(a) The docs say "the M01 profile of the same live account shows a school chip". In fact `/profile` shows **no** school, and `/profile/edit` shows a selected-school card (Alpine `selectedSchool` = an SK in Johor, PPD KLUANG; hidden `school_id` bound to it).<br>(b) BR-21 enables "Sekolah Saya" only when "the user is **not the admin** and has a `schoolId`". Live shows only that the video form reads **another source** than the profile school. The "not admin" condition is invented. | See "Admin-school answer" below; screenshots `aud-profile-edit-school-masked.png` and `aud-video-tambah-tiada-sekolah-masked.png`. | <ul><li>Correct the evidence wording.</li><li>Model the video form's school as its own INFERRED source (e.g. a video-school/membership field that is null for the admin seed), not a role test. Alternatively, record the live cross-screen contradiction as a DV decision (replicate: keep "Tiada sekolah" for the admin) with alternatives.</li><li>Keep M01 unchanged.</li></ul> |
| AUD-M09-06 | Minor | URS FN-7.5.1, §1 route table ("not opened on live"), FN-10.3.2, §5.1 L-4; SRS FR-102, FR-124, BR-31 | **Observable states are labelled INFERRED or unobserved.**<br>(a) The guest GET of `/perutusan/awam/4` answers **200** (a public page, reachable read-only). A guest GET of `/perutusan/awam/4` did not change "baca" (still 3). So the page can be captured without side effects, yet it is specified as a provisional page with an UNVERIFIED layout.<br>(b) Guest `/video/2224/edit` → **302 `/login`** is OBSERVED, not INFERRED. | Cookie-less `request.get(maxRedirects:0)` on 17 routes (list below). | <ul><li>Relabel (b) OBSERVED.</li><li>Queue a read-only discovery top-up of `/perutusan/awam/4` (guest GET; the read counter is unaffected) and replace the provisional spec of FN-7.5.1/FR-102 with the observed layout.</li></ul> |
| AUD-M09-07 | Minor | SRS FR-M09-29 | **An unescaped `\|` breaks the table.** The quoted separator `"\|"` is written with a bare pipe, so the FN/Traces cells shift, and FN-2.2.1/2.2.2 appear uncited to a parser. (The URS escapes the same string correctly.) | Script parse of SRS §3: FR-29 has 1 extra cell. | Escape it as `"\|"`. |
| AUD-M09-08 | Minor | SRS §12 provisional list; E2E-18, E2E-23 | **The provisional marking is incomplete.**<ul><li>E2E-18 asserts "every POPULAR card is in the top-10 non-featured by views". The pool size is INFERRED (BR-05, OQ-14).</li><li>E2E-23 asserts that three consecutive opens by the same user give +1 each. Only a single open was observed; "no deduplication" is INFERRED (SEC-07).</li></ul>Neither is marked. | SRS BR-05 / BR-07 source columns | Mark those steps provisional, and update the count (28 → 30). |
| AUD-M09-09 | Minor | URS FN-8.1.3; SRS FR-113 | **The unknown-hash behaviour is misstated.** Live `activeRole: window.location.hash.replace('#','') \|\| 'pelajar'`, so an unknown hash (e.g. `#xyz`) sets `activeRole='xyz'`: no tab is active and no panel shows. The docs say "else Pelajar", which is true only for an empty hash. | `/panduan` inline `panduanApp()` source | State the live rule: empty hash → Pelajar; unknown hash → no panel (replicated, SOURCE-DERIVED). If this is treated as broken, record a DV. |
| AUD-M09-10 | Minor | URS §7 DV-M09-08, DV-M09-09; SRS FR-61, FR-72 | **Deviation wording.**<ul><li>(a) DV-08 drops the stale admin subtitle "Selamat datang, Admin" on S12/S13 but keeps the equally stale dashboard subtitle "Selamat datang kembali" on S21. The treatment is inconsistent, and the reason is not given.</li><li>(b) DV-09 says the h1's "own class was not captured". In fact the hero container carries `text-white` (`rounded-3xl bg-gradient-to-br from-slate-950 via-amber-900 to-orange-700 text-white …`), so a white h1 is SOURCE-DERIVED, not a new colour choice.</li></ul> | `/audio-kbat` markup (h1 `text-2xl sm:text-4xl font-black` inside that container); `Tapis` = `bg-slate-900 text-white` | <ul><li>(a) Either drop the S21 subtitle too, or record why it is kept (no page subtitle exists, so keep live).</li><li>(b) Cite the container class as the evidence.</li></ul> |
| AUD-M09-11 | Minor | SRS §6.9 Users (azlan, salina, suhaimi, cikgudemo01) and Perutusan #4 row; NFR-M09-03 | **New seed users and schools sit outside the canonical tables.**<ul><li>Four new users have no ids.</li><li>A real school ("SMK Bandar Seri Putra") is used as a seed **school record**, not only as title text, with no id in the M02 900001–900099 range.</li><li>The claim "the three principals belong to the M02 set of 6 school admins" is unverified: it is only a request (OQ-13c).</li></ul> | TRACKER canonical seed note ("module-designed users use their own ranges") | <ul><li>Give the four users ids in an M09 range.</li><li>Attach perutusan #4's author to a fictitious school id in the M02 range, keeping the title text as public content.</li><li>Reword the M02 claim as a pending request.</li></ul> |
| AUD-M09-12 | Minor | URS FN-6.1.3; SRS FR-77 | **The subject-pill rule is incomplete.** With `?subject=5`, live still lists **all** subject pills (Matematik 865, Sejarah 97, Matematik Tambahan 420, Fizik 779, Kimia 96), unaffected by the active subject, and the Sejarah pill shows no special state apart from "Reset Subjek". BR-18 says only "subject counts = videos matching `search` and `category`", which is consistent. However, FN-6.1.3/6.1.4 do not state that the subject pills ignore the active subject, or that the category links are built as `?subject=5&category=…` (subject first). | `/video?subject=5` pills and hrefs | Add both facts as OBSERVED (the E2E asserts the hrefs). |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9/D10 and minimal? | Note |
|---|---|---|---|
| 01 | Yes. The note create/edit pages return 500 (discovery states; not re-opened). | Yes. The fields are limited to those S5 and S8 show, and the labels are PROPOSED. The "*" (required) on Subjek, Jenis and Tahap is itself a proposal, covered by OQ-01. | Acceptable. The raw stored types as options avoid a new "summary" vs "RINGKASAN" contradiction. |
| 02 | CKEditor is blocked (discovery console). | Rejected correctly | — |
| 03 | Yes: `?category=TIPS_BELAJAR&page=2` → every page link is `/admin/articles?page=1`. | Yes | — |
| 04 | Escaped preview | Rejected correctly | — |
| 05 | Yes: S4 at 375 gives `scrollWidth` 424. | Yes | — |
| 06 | Yes: `?note_type=summary` → "Jumlah: 0 nota" (5 RINGKASAN exist). | Acceptable. The filter never works on live (broken). "Nota Penuh ↔ LENGKAP" is a documented Delivery Lead choice, adds no option, and creates no visible contradiction. | — |
| 07 | Yes: on #2, `banner_type=""`, `target_audience="all"` and Alpine `linkType: 'NONE'`; the options are lower case. | Yes. The extra "FEATURE"/"PROMOTIONAL" option shows the same code as the list's "Jenis" column, so it adds no new contradiction. | — |
| 08 | Yes ("Dashboard" / "Selamat datang, Admin"). | Yes | Subtitle inconsistency (AUD-10a) |
| 09 | Yes: the hero gradient and `bg-slate-900` are missing from the build (discovery computed colours). | Yes. The intended classes are in the live markup, including `text-white` on the container. | AUD-10b |
| 10 | Yes: "Lain-lain (0) → #" | Yes | — |
| 11 | Raw codes | Rejected correctly | — |
| 12 | Discovery screenshot (1280) | Yes | — |
| 13 | Link types without a target | Rejected correctly (D10) | — |
| 14 | Yes: `https://wa.me/60123456789` `_blank` | PROPOSED; it defaults to live | — |
| 15 | Yes: guest `/pusat-tuisyen/panduan` → 302 `/login`, while `/panduan` gives 200. | Rejected correctly | — |
| 16 | Yes: S9 at 375 scrolls inside the card (610 > 318); no sticky cells on S1, S5 or S9. | Rejected correctly | — |
| 17 | = M01 DV-02 | Yes | — |

## Admin-school answer (seed conflict)

**The live admin account does have a school, but only in the profile-edit form. The video form does not see it.**

| Page | What it shows (live, 2026-09-25) |
|---|---|
| `/profile` | Name, e-mail and "Ahli sejak 6 Februari 2026". **No school is shown** on the page. |
| `/profile/edit` | The "Maklumat Sekolah" card shows a **selected school**. Alpine `selectedSchool` = `{id: 2710, type: "SK", state: "Johor", district: "PPD KLUANG", name: <an SK, masked>}`, and the hidden `school_id` is bound to `selectedSchool.id`. The server HTML has `value=""` before Alpine runs. The search/select block is hidden because a school is selected. Screenshot `aud-profile-edit-school-masked.png`. |
| `/video/tambah` | The "Siapa boleh lihat?" radio `school` is **disabled**, with the label "Sekolah Saya" / "**Tiada sekolah**". `global` "Semua Pengguna" / "Boleh dilihat oleh semua" is the default. Screenshot `aud-video-tambah-tiada-sekolah-masked.png`. |

**Conclusion.** The M01 canonical seed (admin = "SK Demo (Johor)", PPD KLUANG, id 900002) correctly mirrors the profile-edit school, so M01 needs no change. The video form takes its school from a different source that is empty for this account (unknown field; INFERRED). M09 is right to keep "Tiada sekolah" for the admin. It should model this as a separate source, not as the invented "not the admin" rule, and it should correct the "/profile shows a school chip" wording (AUD-M09-05).

## Coverage spot-check (30 rows, all correct)

S1-007 "Senarai Artikel"→1.1.3 · S2-014 Kategori select→1.2.4 · S5-019 trash→3.1.6 · S9-015 edit #2→4.1.4 · S11-024 Tarikh Mula→4.3.3 · S13-031 Fail Audio→5.2.4 · S15-002 "MAIN"→Excluded M16 · S15-068 "\|"→2.2.1 · S15-134 badge→2.2.5 · S15-200 "C"→2.2.5 · S16-020 "9 bulan yang lepas"→2.3.4 · S17-017 "Tambah Video"→6.1.5 · S17-083 "Matematik Tambahan (420)"→6.2.3 · S17-149 guest card title→6.2.3 · S17-215 CTA image→6.2.4 · S19-009 `_method`→6.5.3 · S20-035 "Terbitkan Video"→6.4.8 · S23-007 poster→7.2.3 · S23-073 "404"→7.2.9 · S24-060 Quill button→7.3.4 · S26-026 step card→8.1.4 · S26-092 guru step "2"→8.1.5 · S26-158 ibu bapa card→8.1.6 · S26-224 "Siap!"→8.1.7 · S26-290 "📥"→8.1.8 · S27-033 "Isi Maklumat"→8.1.4 · S27-099 "Kelas Saya"→8.1.5 · S27-165 "Link Anak Anda"→8.1.6 · S27-231 admin feature text→8.1.7 · S27-297 "Kombo & Penglibatan"→8.1.8.

## Claims verified against live (58)

✓ = correct; ✗ = incorrect or incomplete (the finding is named).

1. ✓ S1 "Jumlah: 72 artikel"; headers Tajuk…Tindakan, computed `uppercase` on every `th`.
2. ✓ S1 order: page 1 = ids 10–29 (22/02/2026); page 4 = 70, 71, 72, 9 (10/02/2026), 1–8 (06/02/2026).
3. ✓ Row #10: star, "Tips Belajar", "DARJAH_4", views 597 (596 at discovery; drift), "22/02/2026".
4. ✓ Title cut to 50 characters + "..." ("Belajar Sains: Cara Ingat Nama Saintifik dengan Mu" = 50).
5. ✓ DV-03 evidence: TIPS page 2 → all page links `/admin/articles?page=1`.
6. ✓ 13 featured on S1 (ids 1, 2, 4, 10, 13, 17, 24, 31, 38, 45, 52, 59, 66).
7. ✓ MOTIVASI 14 (ids 5, 25–37); TIPS_BELAJAR 21; BERITA 7.
8. ✗ The seed titles, ids, levels, views and one category/title do not mirror the live list (AUD-01).
9. ✓ `/artikel` "Showing 1 to 18 of 72 results"; grid first 5 = AI…, 5 Tips…, Cara Baca…, Sains Menyeronokkan…, Panduan Ibu Bapa…
10. ✓ "HOT" only on featured cards; hot section badges "PILIHAN" only on featured.
11. ✓ The hot section shows on pages 1, 2 and 4 and is absent on `?category=BERITA`, `?search=sifir` and TIPS page 2.
12. ✓ The hot set differs between loads (page 1 vs page 2 vs page 4 samples; discovery).
13. ✓ The observed POPULAR cards (574, 549, 532, 526, 514 views) all lie inside the top-10 non-featured by views.
14. ✓ TIPS page 2 = "Rahsia…", "Cara Buat Nota Bergambar…", "Teknik Pomodoro…"; the pager link is `?category=TIPS_BELAJAR&page=1`.
15. ✓ Reader page 4 starts "Kenapa Kamu Patut Bangun Awal Setiap Pagi", "Kisah Pelajar Kampung…".
16. ✓ Search "sifir" → 2 cards (Hafal Sifir, Sifir Darab).
17. ✓ BERITA order: "Perpustakaan Bergerak…", "Pertandingan Menulis…".
18. ✓ Relative ages 7 / 8 / 9 bulan as the seed dates assume.
19. ✓ `/video` pills "Semua (2260)", "Motivasi (3)", "Tutorial (12)", "Tips SPM (3)", "Ceramah (2242)", "Lain-lain (0) → #".
20. ✓ Subject pills Matematik 865 (subject=3), Sejarah 97 (5), Matematik Tambahan 420 (8), Fizik 779 (9), Kimia 96 (10), in id order.
21. ✓ Page 1 ids 2224, 64, 433, 825, 1020, 19, 2225 … 437 (24, live order).
22. ✓ `?subject=5`: 97 / 1 / 12 / 3 / 81 / 0; links keep `subject=5`; "Reset Subjek" → `/video`.
23. ✗ The `?subject=5` card order 2224–2247 is contradicted by the seed (AUD-02); the "all subject pills stay" rule is not stated (AUD-12).
24. ✓ `?category=motivasi` → 18, 17, 16; only "Sejarah (1)" → `?category=motivasi&subject=5`.
25. ✓ `?page=95` → 2220–2223, "Showing 2257 to 2260 of 2260 results".
26. ✓ `?subject=9&page=2` pager links keep `subject`.
27. ✓ The #2224 list card now shows "122 tontonan" (discovery 121; drift, not opened by this audit). The S18 inventory shows "120 tontonan" on the detail, so the detail shows the count before the open (BR-07 video rule).
28. ✓ S16 inventory "596" Pembaca after 595 (the article increments before render).
29. ✓ Guest `/video`: tab "Video Pembelajaran — PRESTASIPLUS", h1 "Tonton & Fahami", no "Tambah Video".
30. ✓ Banners: 5 rows HERO/ALL, FEATURE/STUDENT, PROMOTIONAL/STUDENT, ANNOUNCEMENT/ALL, FEATURE/STUDENT; 01/01/2026–31/12/2026; "Aktif".
31. ✓ Banner description cut to 50 characters + "..." ("Platform pembelajaran interaktif untuk pelajar sek...").
32. ✓ Banner #2 edit: `banner_type` '' selected, options `hero/promo/announcement/event`; `link_type` none; `target_audience` all selected; Alpine `{ linkType: 'NONE' }` (DV-07 evidence).
33. ✓ Notes: 10 rows in id order; title cut to 40 characters ("Imbuhan Awalan dan Akhiran — Nota Lengka...").
34. ✓ `?note_type=summary` → "Jumlah: 0 nota" (DV-06 evidence).
35. ✓ S12 subjects A–Z ("Bahasa Arab", "Bahasa Cina", "Bahasa Inggeris", "Bahasa Melayu"…).
36. ✓ S21 hero container `bg-gradient-to-br from-slate-950 via-amber-900 to-orange-700 text-white`; "Tapis" `bg-slate-900 text-white`.
37. ✗ DV-09 rationale: the h1 colour is source-derived from the container (AUD-10b).
38. ✓ Perutusan order #4, #2, #3; footers "Video disertakan · 👍 1 · 0 komen · 3 baca", "0 komen · 4 baca", "Video disertakan · ❤️ 5 · 0 komen · 55 baca"; "6 bulan yang lepas" ×3.
39. ✓ The role pill "Pengetua" is upper case by CSS.
40. ✗ The perutusan read rule vs the admin's open (AUD-03).
41. ✓ S24 re-inventory: `status:scheduled` shows the datetime field; only `title` invalid (body not required).
42. ✓ Panduan WhatsApp `https://wa.me/60123456789` `target=_blank`.
43. ✓ Panduan `history.replaceState`; role ids pelajar/guru/ibubapa/admin/ppd with the listed icons/labels/descriptions.
44. ✗ Unknown-hash behaviour (AUD-09).
45. ✓ FAQ counts 5 / 5 / 3 / 3 / 4, including "Macam mana nak reset kata laluan?" and "Apa itu Kombo?"; items `x-data` `open`.
46. ✓ Guest `/panduan`: one "Daftar Percuma Sekarang", no Dashboard link.
47. ✓ Guest 302 `/login`: `/audio-kbat`, `/perutusan`, `/perutusan/4`, `/perutusan/tulis`, `/perutusan/saya`, `/video/tambah`, `/pusat-tuisyen/panduan`, `/admin/articles`, `/admin/banners`, `/admin/notes`, `/admin/audio-kbat`, `/admin/tools/screenshots`.
48. ✓ Guest 200: `/artikel`, `/video`, `/panduan`.
49. ✗ Guest `/video/2224/edit` → 302 `/login` is OBSERVED, not INFERRED (AUD-06b).
50. ✗ Guest `/perutusan/awam/4` → 200, observable (AUD-06a).
51. ✓ S4 at 375: `scrollWidth` 424 (DV-05 evidence); `/artikel` at 375 has no overflow.
52. ✓ No `position: sticky` cell on S1, S5 or S9; S9 scrolls inside the card at 375 (610 > 318).
53. ✓ S20: "Sekolah Saya" disabled "Tiada sekolah"; native invalid `video_url, title, category`; "Terbitkan Video" left of "Batal".
54. ✗ Admin school: `/profile` shows no school chip; `/profile/edit` has a selected school (AUD-05).
55. ✓ S22/S24/S26 re-inventory identical (418 / 465 / 318 elements).
56. ✗ Canonical seed: guru = SMK DEMO (AUD-04).
57. ✓ The video D11 dataset arithmetic from the §6.9 id ranges: Matematik 865, Matematik Tambahan 420, Fizik 779, Kimia 96, Sejarah 97 (1 + 12 + 3 + 81), no subject 3; total 2,260.
58. ✓ The layout by role: the admin sees `/artikel`, `/video`, `/audio-kbat` and `/perutusan` in the user shell (re-inventory SHU chrome); `/admin/*` in the admin shell.

## Seed check

| Set | Live | Seed | Verdict |
|---|---|---|---|
| Articles | 72 / 13 featured / 0 drafts | 72 / 13 / 0 | Counts ✓. Content ✗ (AUD-01). |
| Notes | 10 (A.3 values) | 10, as observed | ✓ |
| Banners | 5 (values above) | 5, as observed | ✓ |
| Audio KBAT | 0 | 0 (fixture only in provisional E2E) | ✓ |
| Videos | 2,260 (D11) | Virtual dataset with the live total; anchors keep live ids, titles and views; per-subject and per-category counts computed from the id ranges and verified. | ✓ Counts. ✗ Order of non-page-1 states (AUD-02). |
| Perutusan | 3 (#4, #2, #3; reads 3/4/55; 👍 1, ❤️ 5) | Same | ✓ (read rule AUD-03, school AUD-04 and AUD-11) |
| Screenshots | 0 | 0 | ✓ |

## Re-audit scope

- AUD-01 and AUD-02 are seed rebuilds. The live admin article list, fully read above, is the source; no new discovery is needed for it.
- AUD-06a needs a single read-only guest GET of `/perutusan/awam/4` in a discovery top-up.
- After the writer's fixes, a targeted re-audit of AUD-01…05 and a spot-check of the minors are enough.

---

## Round 2 (re-audit of URS/SRS v1.1 + v1.2)

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 2 (`playwright2`). This agent did not write the URS or the SRS. |
| Documents | <ul><li>`urs/M09-content.md` and `srs/M09-content.md` v1.2</li><li>`discovery/inventory/M09/_live-articles.json`</li><li>the discovery corrections marked "(corrected after audit)" (7 places)</li><li>M02 SRS v1.6 (anchors)</li></ul> |
| Safety | <ul><li>Read-only, list pages only: `/admin/articles` pages 1–4, `/video` (6 states), `/perutusan`, `/admin/audio-kbat/create`.</li><li>No article, video or perutusan detail page was opened.</li><li>GETs were throttled to ≥ 400 ms.</li><li>The live poster names were checked **in-page only**, returning booleans; no name left the browser.</li><li>The temporary capture `.playwright-mcp/lane2/m09r2-admin.json` (titles and category/level/views only, authors as `platform` / `<author-1>`) was deleted after the comparison.</li><li>Scratch scripts are in `<scratchpad>/m09-audit/`. `split.js` splits table cells on unescaped `\|` only, which fixes the round-1 parser.</li></ul> |

### Verdict round 2: **PASS**

There are **0 Critical, 0 Major and 2 Minor (new)** findings. All 12 round-1 findings are closed. S28 is not counted: it is pending writer v1.3 (see "Pending").

### Round-1 findings

| ID | Status | Evidence (round 2) |
|---|---|---|
| AUD-M09-01 | **Closed** | <ul><li>A fresh live read of `/admin/articles?page=1…4` (72 rows) was compared by script with `_live-articles.json` and the SRS §6.9 table: **0 differences** in id, title (live ≤ 50-character prefix), category, level, featured, author class (platform ↔ Admin Demo id 1; masked ↔ Cikgu Demo 01 id 3101), views and created date. The only exception is the documented #10: 596 in the seed, 597 live ².</li><li>The 12 truncated titles have full titles, e.g. #64 "…Kebangsaan 2026" and #59 "KSSR 2026".</li><li>Facets recomputed from the JSON match §6.11: levels SEMUA 30 / D1 4 / D2 5 / D3 7 / D4 10 / D5 9 / D6 7; authors 36 / 36; categories 21 / 14 / 10 / 6 / 7 / 7 / 7.</li><li>The seed publish dates sorted by BR-03 (publishedAt desc, id asc) reproduce the live reader pages 1, 2 and 4, BERITA and TIPS page 2 exactly.</li><li>The top-10 non-featured pool (#11, 57, 64, 67, 28, 23, 43, 63, 42, 26) contains every observed POPULAR card.</li></ul> |
| AUD-M09-02 | **Closed** | <ul><li>Live re-read (lane 2): page 1, `?subject=5` (2224…2247), `?category=motivasi` (18, 17, 16) and page 95 (2220–2223) equal the round-1 captures.</li><li>The §6.9 order rule, simulated (2,260 unique ids), reproduces all four orders and the Sejarah count of 97.</li><li>E2E-49 and AC-24.5 assert `?subject=5`.</li></ul> |
| AUD-M09-03 | **Closed** | <ul><li>FN-7.2.12, BR-07 and AC-30.4 now state the two OBSERVED non-counting opens (admin open of #4; guest `/perutusan/awam/4`), with an INFERRED rule consistent with them.</li><li>E2E-59 asserts "3 baca" after both.</li><li>`_live-articles.json` `perutusanReads` records 3 / 3 / 4 / 55.</li><li>Live list still "3, 4, 55 baca".</li></ul> |
| AUD-M09-04 | **Closed** | <ul><li>`guru@demo.test` (id 5) is at 900001 SMK DEMO, as in M01 §6.8. AC-27.3, AC-29.5 and E2E-52/57 are re-derived; #3 is seen by `pelajarmaju@demo.test` (900002).</li><li>M01 names are used verbatim ("SMK DEMO", "SK Demo").</li></ul> |
| AUD-M09-05 | **Closed** | <ul><li>FN-6.4.6, BR-21 and DATA-M09-13 `videoSchools` form a separate INFERRED source with no role rule.</li><li>The evidence wording is correct (`/profile` has no school; `/profile/edit` has a selected SK in Johor).</li></ul> |
| AUD-M09-06 | **Closed** | <ul><li>FN-7.5.1 is now "200, no read (OBSERVED)". The layout is still provisional, and the lane-3 top-up (S28) is expected to replace it.</li><li>FN-10.3.2, FR-124 and BR-31: guest `/video/{id}/edit` → `/login` is OBSERVED.</li></ul> |
| AUD-M09-07 | **Closed** | FR-29 escapes `\|`. The script parse finds 0 cell-count mismatches in every table of both docs, and FN-2.2.1/2.2.2 are now cited. |
| AUD-M09-08 | **Closed** | <ul><li>E2E-18 and E2E-23 carry the **provisional** mark.</li><li>The §12 list has 30 entries, and 30 rows are marked, matching one to one.</li></ul> |
| AUD-M09-09 | **Closed** | <ul><li>FN-8.1.3, FR-113 and AC-36.2 state: empty hash → Pelajar; unknown hash → no tab, no panel (SOURCE-DERIVED).</li><li>Discovery was corrected to match.</li></ul> |
| AUD-M09-10 | **Closed** | <ul><li>DV-08: S12, S13 and S21 all drop the stale subtitle via DV-SH-03, and the rationale is recorded as alternative (b).</li><li>DV-09 and FR-72 cite the container `text-white`, matching the live markup.</li></ul> |
| AUD-M09-11 | **Closed** | <ul><li>Users 3101–3109 have ids.</li><li>Post #4's author is at the fictitious 900003 "SMK Demo Seri Putra". The real school name remains only inside the public post title.</li><li>M02 v1.6 records 900003 and the 3101–3109 block (M02 change log and §6 anchors; TRACKER canonical note).</li></ul> |
| AUD-M09-12 | **Closed** | <ul><li>FN-6.1.3/6.1.4 and FR-77/78 state that the subject pills ignore the active subject, and the link order: subject first on category pills, category first on subject pills.</li><li>Live check: `?subject=5` shows all 5 subject pills and the category links are `?subject=5&category=…`. `?category=motivasi` gives `…&subject=5`.</li></ul> |

### Privacy check (no Critical)

- **Real names.** The URS, the SRS and `_live-articles.json` were grepped for teacher, principal and honorific patterns (Cikgu/Chekgu/Ustaz/Puan/Encik/Dr/Datuk + capitalised name, `bin`/`binti` + name). The only person names found are the fictitious "Cikgu Demo (01)", "Cikgu Demo 02" and the seed users.
- **Author tokens.** `_live-articles.json` uses only `platform` / `<author-1>`.
- **Fictitious seed names vs live.** In-page boolean checks on live, with no text exported, compared the fictitious principal names with the live posters:
  - "Azlan", "Salina", "Aziz" and "Suhaimi" do not occur anywhere on `/perutusan`;
  - no poster name contains the word "Mat";
  - "Aminah" is not the live placeholder of `/admin/audio-kbat/create`.
  
  So only the initials (AD, SA, SM) follow live.
- **Schools.**
  - The admin's real live school (an SK in Johor) is not named anywhere; only the district "PPD KLUANG", which is also the canonical fictitious SK Demo district, appears.
  - "SMK Bandar Seri Putra" appears only inside the public post title (URS S22/S23 content quotes and SRS perutusan row). The seed school record is the fictitious 900003.
  - No other real school name was found.

### Regression checks

| Check | Result |
|---|---|
| Coverage URS §6.1 | 1,983 / 1,983 elements for S1–S27, with 0 missing, 0 duplicated and 0 extra. The 74 exclusions are exactly 33 M16 + 41 M01, and the 5 S27 emoji stay mapped. Table rows parse cleanly with the escaped-pipe parser. |
| FN → FR | All 227 FN are cited by ≥ 1 FR, with 0 unknown FN references in the matrix. |
| AC / FR → E2E | 164 AC and 129 FR each have ≥ 1 E2E. There are 72 E2E, with 0 malformed rows. |
| Provisional | 30 listed and 30 marked, matching one to one. |
| Dataset spec §6.11 | Internally consistent: 72 = 21 + 14 + 10 + 6 + 7 + 7 + 7; 2,260 = 3 + 12 + 3 + 2,242 + 0 = 865 + 97 + 420 + 779 + 96 + 3. The §6.9 id-range table gives Sejarah 97, the order rule is a permutation of 1–2,260, and the virtual-dataset explicit layout matches the §6.9 table. |
| Spot-check of 12 edited passages | All consistent with live and with each other: FN-7.2.12, FN-6.4.6, FN-8.1.3, FN-6.1.3, FN-6.1.4, FN-7.5.1, FN-10.3.2, FN-6.1.9, FN-5.3.1, FN-2.1.8, DV-M09-08, DV-M09-09 (and BR-03/07/19/21, FR-61/72/113, AC-24.5/27.3/29.5/30.4/36.2). |

### New findings (round 2)

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M09-R2-01 | Minor | SRS §6.9 video id-range table and order rule; URS FN-6.1.9 | **Two more video orderings are now observed, and the seed does not reproduce them.** This audit read `?subject=5&page=2` and `/video?page=2` (list pages).<ul><li>Live `?subject=5&page=2` = 2248…2260, then **21, 22, …, 31**, so ids 21–31 are Sejarah. The seed puts ids 20–63 in Kimia, and its rule would continue with 2185, 2184 ….</li><li>Live page 2 = 878, 1024, 2229, 69, 438, 879, 1025, 2230, … (interleaved by subject). The seed rule gives 2229, 2230, … on page 2.</li></ul>The docs honestly say "only these orderings are observed". The per-subject counts are unaffected. | `/video?subject=5&page=2`, `/video?page=2` (ids only) | Either add these two orderings as anchors (move 21–31 to Sejarah and rebalance Kimia/Sejarah elsewhere, keeping 96/97; extend the interleave rule), or list them in §6.9 as observed orderings the prototype does not reproduce (D11 limitation) so that no E2E asserts pages beyond those captured. |
| AUD-M09-R2-02 | Minor | SRS §6.9 note after the Users table ("Pending cross-module requests (not yet agreed; OQ-M09-13c)…"); URS OQ-M09-13c | **Stale status.** M02 v1.6 has already added school 900003 and the 3101–3109 block, and TRACKER records them. M09 still calls this a pending, not-yet-agreed request. | M02 SRS v1.6 change log, §6 anchors; TRACKER canonical note | Mark the request as done (M02 v1.6) and close OQ-13c. |

### Pending (not counted)

- **S28 `/perutusan/awam/{id}`.** The lane-3 top-up added `inventory/M09/S28-perutusan-awam.json` (71 elements, total now 2,054) and D-16. None of these is in URS §6 yet: they are expected in writer v1.3, and FN-7.5.1 stays provisional until then.
- **Re-audit v1.3.** A short re-audit should confirm:
  - 2,054 / 2,054 coverage;
  - FN-7.5.1/FR-102 re-specified from S28;
  - any DV for D-16.

---

## Round 3 (targeted check of URS/SRS v1.3)

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 3 (`playwright3`, admin session plus one cookie-less context). This agent did not write the URS or the SRS. |
| Safety | <ul><li>List pages only: `/video` in 8 states.</li><li>Guest status-only GETs: `/daftar`, `/tentang`, `/hubungi`, `/register`.</li><li>`/perutusan/awam/4` was **not** opened again; S28 was checked against the top-up evidence only (discovery §2.27, `S28-perutusan-awam.json`, `perutusan-awam-*.png`).</li><li>No detail pages were opened. GETs were throttled to ≥ 400 ms.</li><li>Scratch scripts are in `<scratchpad>/m09-audit/` (`cov2.js`, `vid3.js`; `split.js` parses the escaped `\|`).</li></ul> |

### Verdict round 3: **PASS**

There are **0 Critical, 0 Major and 0 Minor** findings. Both round-2 minors are closed.

| Check | Result |
|---|---|
| S28 vs evidence | <ul><li>FN-7.5.1–7.5.9, FR-130–135, AC-44.1–44.6 and E2E-73/74 match discovery §2.27 and the S28 inventory: the live hrefs (`/daftar`, `/tentang`, `/hubungi`), "17 Mac 2026 11:23 PM", "Pengetua" (upper case by CSS), "1 Suka", "3 baca", "0 komen", "Disalin!", the player sizes and the guest restrictions.</li><li>At 375 the mobile screenshot shows the share buttons on 2 rows, the CTA buttons stacked, and "Daftar Percuma" hidden in the top bar.</li><li>The S28 inventory and screenshots are masked (`<person>`, `<school>`); the grep found no names.</li><li>BR-10 adds the Malay month format ("Mac" OBSERVED, the other month names marked INFERRED inline).</li></ul> |
| DV-M09-18 | Live guest `/daftar` → **404**, `/register` → 200. Pointing both "Daftar" links at `/register`, the target of every other "Daftar" on the site, is the minimal dead-link fix (D9). The label, style and position are unchanged. ✓ |
| DV-M09-19 | Live guest `/tentang` and `/hubungi` → **404**.<ul><li>"Hubungi" → `/panduan` reuses the only existing contact section ("Perlukan Bantuan Lanjut?" / "Hubungi pasukan sokongan…"). This is an allowed D9 improvisation that adds no page or content.</li><li>"Tentang" is kept as the live 404, because no fitting target exists and an about page would be invented. This is a documented Delivery Lead choice with its alternatives listed. It is acceptable, but it is a dead link kept on purpose, so it is worth naming to the user at G1.</li></ul> ✓ |
| Video orders (live list pages vs the §6.9 v1.3 rule, simulated) | All 6 claimed orderings match live: page 1, page 2 (878, 1024, 2229, 69, 438 …), `?subject=5`, `?subject=5&page=2` (2248…2260, 21…31), `?category=motivasi` (18, 17, 16) and page 95 (2220–2223). The rule is a permutation of 1–2,260 (0 missing, 0 duplicates). |
| Counts | <ul><li>Live pills are unchanged: Semua 2260, Motivasi 3, Tutorial 12, Tips SPM 3, Ceramah 2242, Lain-lain 0; Matematik 865, Sejarah 97, Matematik Tambahan 420, Fizik 779, Kimia 96; `?subject=10` → Semua 96 / Ceramah 96.</li><li>The v1.3 id-range table reproduces them exactly: subjects 865 / 97 / 420 / 779 / 96 / null 3; categories 2242 / 3 / 12 / 3 / 0; Sejarah × category 1 / 12 / 3 / 81.</li></ul> |
| Coverage | **2,054 / 2,054** (S28 71 included), with 0 missing, 0 duplicated and 0 extra. The 74 exclusions are unchanged (33 M16 + 41 M01), and all S28 rows map to FN-7.5.x (12 sampled, all correct). |
| Traceability | <ul><li>235 FN, each cited by an FR.</li><li>135 FR and 170 AC, each with ≥ 1 E2E; 74 E2E.</li><li>30 provisional tests listed and marked, matching one to one.</li><li>0 cell-count mismatches in any table of either doc (escaped `\|` parsed correctly).</li></ul> |
| Round-2 minors | <ul><li>**R2-01 closed.** Both newly observed orderings are reproduced (above).</li><li>**R2-02 closed.** SRS §6.9 now reads "recorded (M02 v1.6)", and OQ-M09-13c is closed.</li></ul> |

**Informational (no finding).** This round's list reads also saw two further states: `?subject=10` page 1 (2054, 2059, 2061, …) and `?subject=5&page=5` (id 1). The v1.3 rule does not reproduce them: the seed's Kimia page 1 starts 69, 70, …, and its last Sejarah is 18. As §6.9 states, the order of uncaptured pages and the id membership beyond the observed ids are consequences of the rule, not observations (D11). No E2E asserts these states. If the Delivery Lead wants them pinned, add them as further captured orderings; the counts are unaffected.
