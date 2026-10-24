# System audit, screen by screen — FIXLOG (cloud)

Fixes for findings in `docs/qa/audit-sistem/BIJAK-SPM-AUDIT-REPORT.md` (branch `audit/sistem-2026-10-23`, commit `30aceaa`), admin scope only. `STUDENT-SCOPE-NOTES.md` is not acted on yet (student audit in progress).

- Fix branch: `claude/determined-dijkstra-ju5q60`, base `3e192a7`.
- Verify: in `../pp-audit-verify`, `git pull`, dev server on port 5199, then record in `VERIFY.md`.
- Status: **Fixed** (verify on screen), **In progress** (being fixed now), **Need-info** (answer the Question), **Declined** (reason in What changed), **Planned** (Full track; proposal below, not built until the user answers).
- Priority order (user, 2026-10-24): DSKP (§13) and shared stimulus (§13.9) first, then visual/responsive defects.

## FB table

| FB | Sumber | Track | Status | Commit | What changed | Question |
|---|---|---|---|---|---|---|
| FB-001 | §13.9.3 a2/a4, §3 #24 | Standard | Fixed | 858a347f, db405fe4 | Attach/detach renumber question labels in paper order only when every label is a plain unique number; the same set of numbers is dealt out again, so a gap is kept (18, 19, 21 stays 18, 19, 21). Typed labels such as "1(a)" or "7A" are never touched. Notes: "Soalan dipindahkan supaya kumpulan kekal berturutan dan dinomborkan semula." / "Soalan dinomborkan semula mengikut susunan kertas." Header names the real members and the kind (rajah / petikan / jadual). |  |
| FB-002 | §13.9.3 c3, §13.9.4 (notice) | Standard | Fixed | 06e6b155, c97a3e27 | Edit page and revision review item show "Rajah 1 dikongsi oleh 4 soalan: Soalan 1, 2 (soalan ini), 3, 4. Perubahan di sini terpakai untuk semua soalan tersebut."; the wrong "semua 1 soalan" line now shows only for new-batch units. Fork-on-edit remains FB-027 (Planned). |  |
| FB-003 | §13.9.3 c1/c2, §13.9.4 (bank list) | Standard | Fixed | 41ceac09, 839e03c8 | Bank chip "Kumpulan N soalan" on every member of a group of 2 or more (size from the group's members); drawer lists siblings "Soalan N · id". The audit's missing chip was not reproduced at 1280: it was the 375 card view, which shows no chips (FB-010). |  |
| FB-004 | §13.4 (T1-T3 contradiction) | Standard | Fixed | 19222871, 8b6ca547 | Publish gate accepts a Tingkatan 1-3 (di luar DSKP) question without a unit, same rule as intake; T4/T5 still need the unit. Empty topic falls back to "Tingkatan 1-3 (di luar DSKP)" in bank, review and student views. |  |
| FB-005 | §10.2 V1 | Fast | Fixed | be456f48 | Raw select/input/textarea on the extract review and sunting editor replaced with DsNativeSelect / UInput / UTextarea (same filled field style as the rest of the admin). Ids, labels, data-testids unchanged; global border tokens untouched. |  |
| FB-006 | §10.2 V2 | Fast | Fixed | f22adce2 | Staff dark --ui-bg-inverted #262d40 → #ebeef5: selected pager/segment/tab now 16.17:1 (was 1.37:1); light unchanged. Also repairs tooltips, kbd and the Mod Pelajar banner in staff dark. |  |
| FB-007 | §10.2 V3 | Fast | Fixed | 73ab2bbc, bd3edad7, 7d9fb169 | Disabled primary = flat fill with a readable label: staff 5.28:1 dark / 4.66:1 light (was ~1.9 / ~1.6), learner light 6:1. A loading button keeps its normal look. Design doc §3.5 updated. |  |
| FB-008 | §10.2 V4 | Fast | Fixed | db3b5c28, ffe22134 | "Tambah dari bank" picker question text uses the DS body colour: 16.17:1 dark (was 1.81:1), 11.8:1 light; no longer dimmer than the marks line. |  |
| FB-009 | §10.2 V5 | Fast | Fixed | 75f5b15c | Bank and review-queue tables wrap their text column and fit the card from 1280 (1262 → 1184 px and 1479 → 1184 px at 1488); Tindakan, Status and Semak visible. At 768-1024 they scroll inside the card, never the page. |  |
| FB-010 | §10.2 V6 | Fast | Fixed | 5569b11b, 3dd3b8f9 | Phone table cards (DsDataTable card-title slot + cell fields): soalan and semakan titles render KaTeX; cards show Status and the row action (soalan: Pratonton; semakan: Semak; kertas: Buka, Padam; ekstrak: Fail, Soalan, Status, Dikemas kini, Semak). |  |
| FB-011 | §10.2 V7 | Fast | Fixed | a6c1e595 | The source-pages aside is no longer sticky with its own scroll, and the page text <pre> no longer has max-h-96: one page scroll at 1280, nothing clipped. Side effect: the source page scrolls away while editing a later question. | Diputuskan 2026-10-24 (pengguna serah kepada cloud): kekal ikut skrol halaman, kerana panel melekat dengan skrol sendiri ialah kecacatan asal (V7). |
| FB-012 | §10.5 F1 | Fast | Fixed | 1ff39c43 | Option rows get min-w-0 and the remove button shrink-0: 0 px overflow at 320/375 (was +102 / +47 px). |  |
| FB-013 | §10.5 F2, §10.4 | Fast | Fixed | 1c6b35f8 | Editor is a container; top fields and Tag DSKP switch 1 / 2 / 4 columns on card width; labels no longer clipped. 0 px overflow at 320/375 (was up to +103 px). |  |
| FB-014 | §10.5 F3 | Fast | Fixed | 2fe1bf60 | Structured part row: Label / Teks / Markah in 3 columns from container lg, Mod jawapan + Buang bahagian on their own row: 0 px overflow at 768/1024/1280 (was +10 / +324 / +175 px). The question-4 offset is the deliberate group indent (ml-3 sm:ml-6) and was kept. | Pengguna 2026-10-24: "Kekal inden". |
| FB-015 | §10.5 F4, F5 | Fast | Fixed | faf8a8bc | Fixed-layout tables take an opt-in min-width and scroll inside their card: PKSK list and access at 768/1024 now reach Tindakan (row menu works), question text no longer overlaps Bahagian. Known limit: other fixed tables (m09 lists, m27 SchoolUserList, m08 Leaderboard/Ranking) not yet given a min-width. |  |
| FB-016 | §10.5 F6 | Fast | Fixed | 98636033 | At 1280 PKSK and access cell content stays inside its cell (+48 / +64 px → 0); /admin/questions id, stars and status 0 px overflow; the source-file name stays truncated with an ellipsis. |  |
| FB-017 | §10.5 F7 | Fast | Fixed | dfbac4d6 | Pentadbiran top bar: menu, search, theme toggle, drawer close 44x44, brand link 74x44 (were 28-32 px); bar fits at 320. |  |
| FB-018 | §10.5 F8 | Fast | Fixed | 7e6b12af, 043df9d7 | Slide-over/modal close 44x44; row actions "Tarik", "Lihat" 40 px (44 on touch); "Sisip matematik" 167x44; checkboxes keep their existing 44 px hit area (the visible box stays 24 px). |  |
| FB-019 | §10.5 F9 | Fast | Fixed | 5d794e3b, 6ae921a4 | Sticky form bar reserves scroll-padding so a focused last field ends above the bar (was 35 px behind at 375, now 11 px clear); works for page-scrolling and panel-scrolling shells. |  |
| FB-020 | §10.5 F10, §10.3 #15 | Fast | Fixed | 93c65c06 | Stat tile labels wrap to 2 lines (no "Jumlah ke…"); "14,462" fits at 320 (tiles stack chip above value below 640, app-wide). Not changed: a long value in a single-line title input still scrolls inside the input; the "9 perkara…" pill shape when it wraps. |  |
| FB-021 | §10.3 #8 | Fast | Fixed | ed49bc5d, 85de6500, ffe22134 | Review decision bar is a raised sticky layer with a background on phones (2 rows at 320/375 instead of 3 floating rows), "Minta Pembetulan" wraps instead of being cut; no empty bar on published items. |  |
| FB-022 | §6 P9, AC-22.4 / R26 | Fast | Fixed | fabef0bd | Admin Bijak routes (11, routes/admin-papers.ts and admin-intake.ts) carry onForbidden '403': a student/teacher/parent typing the URL gets the in-place 403; a guest goes to /login. Security review: Pass. Known for the real backend: the mock admin API has no role check (route guard only). |  |
| FB-023 | §9 #14, §12 #12 | Fast | Fixed | 8428de2f, 4c987afb | Cause: the total counted every status (72 Terbit + 7 menunggu semakan = 79). Total is now the Terbit count. Reopen fixed: the compact DsStatTile now renders the sub line (muted caption, up to 3 lines), so the tiles show "72 Terbit · 7 menunggu semakan" at 320-1280; other compact tiles unaffected (none passes a sub). |  |
| FB-024 | §10.3 #9-14, #16 | Fast | In progress |  | Judgement calls (form intro alignment, stat row 24 px short, ghost buttons in light, drop zone border, ekstrak filter bar, Tag DSKP indent, sidebar footer/ring). Not defects by the report. | Pengguna 2026-10-24: "Baiki sekarang" (7 item). Sedang dibina. |
| FB-025 | §10.3 #17 | Fast | In progress |  | "Download Template" / "Template CSV" in English on `/admin/questions/import` (legacy .my replica, M04). | Pengguna 2026-10-24: "Tukar semua ke BM" (ganti fideliti .my; dicatat sebagai sisihan). Semua teks Inggeris di skrin v2 ditukar. Sedang dibina. |
| FB-026 | §13 (all), §3 #19-22 | Full | Planned |  | See proposal P-026. | Dijawab 2026-10-24 (ANSWERS.md): M03 pemilik; semua 13 subjek (tambah Landskap dan Nurseri, Katering dan Penyajian); TP wajib tanpa lalai, cadangan AI mesti disahkan; KBAT medan berasingan, pilihan (tidak wajib) — bentuk ikut cadangan P-026 KBAT; Pendidikan Islam guna teks Jawi dari repo, tanda "perlu semakan ejaan"; tag semua seed, yang tiada padanan SP ditanda untuk semakan. Menunggu kelulusan LEAD (#280) untuk G1/G2. |
| FB-027 | §13.9.4 fork row, AC-24.4 | Full | Planned |  | See proposal P-027. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-028 | §13.9.4 (1-3 stimuli; part-level `stimulus_ref`), §11 A10 | Full | Planned |  | See proposal P-028. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-029 | §13.9.4 kinds, §3 #13, §13.7, §13.9.3 b | Full | Planned |  | See proposal P-029. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-030 | §13.9.4 (attach on a Terbit question) | Full | Planned |  | See proposal P-030. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-031 | §6 A1/P1, §7.1 (KS-01) | Full | Planned |  | See proposal P-031. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-032 | §6 P4, §7.5, §9 #4 (KS-08) | Full | Planned |  | See proposal P-032. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-033 | §6 P8, §7.8 (KS-10) | Full | Planned |  | See proposal P-033. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-034 | §4 "Jana set", §6 A10 (US-29) | Full | Planned |  | See proposal P-034. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-035 | §4 "Salin untuk sunting", §9 #12, §6 P2/P3 | Full | Planned |  | See proposal P-035. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-036 | §6 A2, A3, A4, A9; §9 #6, #11; §13.6 duplicates | Full | Planned |  | See proposal P-036 (other Partial gaps, bundled). | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-037 | §11.6 #1, §3 #14 | Doc | Fixed |  | `v2-exam-schema.md` D1 drops numbered_list, sequence_order, code, cloze, gapped_text_match, essay_choice; `v2-bijak-spm.md` US-08 / AC-08.1 / AC-08.3 / R16 still require gaps, ordering, code and numbered list. D47 (2026-10-17) approved the exam schema one day after the Bijak doc. | Pengguna 2026-10-24: "(a) Gugurkan (ikut D1)". numbered_list, sequence_order, code, cloze, gapped_text_match, essay_choice dropped; US-08 / AC-08.1 / AC-08.3 / R16 being updated. |
| FB-038 | §11.6 #2, §9 #10, §3 #14 | Doc | Planned |  | Kertas Subjektif is Won't for v2.0 (`v2-bijak-spm.md` §6, R24, Q-B6) but F-76 / F-139 and menu item KS-07 still carry a treatment. | Pengguna 2026-10-24 (peraturan umum): bina semula seperti sistem lama (kertas imej halaman untuk admin, tingkah laku bendera sama). Menunggu jadual LEAD (#280). |
| FB-039 | §11.6 #3 | Doc | Fixed |  | KS-02 label: "Databank Soalan" in the backlog, "Bank Soalan SPM" in the menu. | Diputuskan 2026-10-24 (pengguna serah kepada cloud): "Bank Soalan SPM" (KS-02 ialah bank kanonik gabungan, bukan hanya lorong Databank). Backlog dikemas kini. |
| FB-040 | §11.6 #4 | Doc | Need-info |  | Mapping table in P-040 (end of this file): proposed canonical paper types = Sebenar, Percubaan, Modul (old .cloud list = the recognised exam paper kinds); Soalan Umum, Buku Teks, Buku Latihan, Soalan DSKP, Topikal, Latihan, Lain-lain are not paper types (dropped or recorded as source kind). | Sahkan senarai: Sebenar, Percubaan, Modul sebagai jenis kertas? (lihat P-040) |
| FB-041 | §11.6 #5, §6 A4 | Doc | Planned |  | QB §4.1 keeps Lulus and Terbit separate and adds Diarkib; the code folds Lulus into Terbit and has no Diarkib. | Pengguna 2026-10-24: "Satu langkah + Arkib". Kekal "Lulus & Terbit" satu langkah; TAMBAH "Arkib / Tarik balik" untuk soalan Terbit (status Diarkib, boleh dipulihkan). QB §4.1 dikemas kini. Status baharu menyentuh kontrak dan backend (PC-2/PC-5): perlu keputusan LEAD (#280). |
| FB-042 | §11.6 #6 | Doc | Planned |  | F-71 / F-142 say Tracking A is "Merge-duplicate" but no doc says what replaces its set editor. | Diputuskan 2026-10-24 (pengguna serah kepada cloud, tiada skrin bertindih): tiada skrin/modul Tracking A berasingan. Set Tracking A = kertas objektif penuh dari bank dalam Pembina Kertas (KS-09), dijawab dalam Bijak SPM, ditanda label koleksi "Tracking A" (bukan jenis kertas baharu). Murid: penapis "Ramalan SPM / Tracking A" dalam hab Bijak SPM. Jadual pemetaan data lama → label akan dipaparkan (Need-info) sebelum migrasi. |

### Student scope (from `BIJAK-SPM-STUDENT-AUDIT-REPORT.md` and `STUDENT-SCOPE-NOTES.md`, commit on `audit/sistem-2026-10-23` fetched 2026-10-23)

Priority (user): 1) FB-043, FB-044 critical; 2) keypad FB-045 to FB-047; 3) other §7-§8 items; 4) Full items Planned.

| FB | Sumber | Track | Status | Commit | What changed | Question |
|---|---|---|---|---|---|---|
| FB-043 | Student §7 #1, §3 #5 (CRITICAL) | Fast | Fixed | baa97420 | Passage and table stimuli show an icon tile with "Lihat Bahan N" in the sticky strip below 1024; full content only in the sheet. Figures keep their thumbnail. Reviewed at 320/360/375. |  |
| FB-044 | Student §7 #4, §3 #5 (CRITICAL) | Fast | Fixed | f57c3f78 | "Hantar" is in the Peta bottom sheet on phones, on every question; it opens the existing dialog ("Belum dijawab: n soalan", "Ditanda: n soalan"). |  |
| FB-045 | Student §6, STUDENT-SCOPE-NOTES (user) | Standard | Fixed | 99753c66 | Casio-style keypad. Top layer "Fungsi" (default): a/b √ x² xⁿ x⁻¹ / sin cos tan log ln / ( ) π ° [Simbol]. Layer "Simbol": x y , % ± / < > ≤ ≥ = / ( ) π ° [Fungsi]. Number block: 7 8 9 DEL AC / 4 5 6 × ÷ / 1 2 3 + − / 0 . ×10ˣ ◀ ▶. All 35 old keys kept; new: AC, x⁻¹, sin, cos, tan, log, ln, °, ×10ˣ (all accepted by the marker; trig in degrees). Not added: e, (−), Ans, execute "=", RCL/M+ (no calculation in an answer field). Screenshots: docs/qa/audit-sistem/evidence/FB-045-keypad-375-light.png, FB-045-keypad-1280-light.png. Code review in progress. | Disahkan pengguna 2026-10-24 (ANSWERS.md): lapisan Simbol, ikon petak, susunan "dah elok", tiada e/(−)/Ans/RCL. Permintaan baru (paparan jawapan sebenar) → FB-069. |
| FB-046 | Student §6 problem 7 | Fast | Fixed | 11c048c8 | Attempt scroll area reserves the sticky strip height (scroll-padding-top) so a focused field scrolls clear of "Lihat Rajah"; works with the keypad reveal (FB-047). |  |
| FB-047 | Student §6 problems 3-5, §5 new #3-4 | Fast | Fixed | 8942938e, 2eddbc2a, 905158e7, 1953b6ad, 5f2a4c44 | Below 768 the keypad is a bottom sheet with a display row (preview + "Tutup"); it covers the attempt footer while open and closes with Tutup, a tap or focus outside, Esc or the field toggle (key taps and scrolling never close it). From 768 it is sticky at the bottom of the scroll area, so no keys sit under the footer. Preview shows stacked fractions; the field is kept clear of the sticky "Lihat Rajah" chip; one keypad open at a time; spacer follows the real sheet height. Rebuilt on DS primitives (no new DS debt). Review: Approve; small follow-ups in progress (focus after Tutup, landscape phone height). | Pengguna: "Terima" (telefon). Reopen 2026-10-24 dibaiki: dari 768 px papan kekunci kini blok biasa di bawah medan dan pratonton (bukan sticky), jadi ia tidak lagi menutup medan dan tiada kekunci di bawah footer pada 1280x700, 1536x864, 1024x768, 768x700, 1280x900 (diukur, skrol atas dan bawah). |
| FB-048 | Student §8 #1-2 | Standard | In progress | 35820ba4, 35d441be | One choose-N rule (domain/choose-n.ts) for counter, Hantar count, marking, result and progress bar. Ticks are advisory and never change a score; at marking the best N attempted questions count; if fewer than N were attempted, ticked blank questions fill the remaining slots (so a chosen question is never "Tidak dikira"); typing an answer ticks the question when a slot is free; at the cap the other checkbox is disabled with "Anda sudah memilih 1 soalan. Nyahpilih soalan lain untuk menukar pilihan."; over-answering shows "Anda telah menjawab 2 soalan. Hanya 1 soalan dengan markah tertinggi akan dikira."; progress bar counts at most N per choose section. | Pengguna 2026-10-24: ikut mod. Latihan: kekal peraturan ini. Peperiksaan: tanda automatik bila menaip; bila N soalan ditanda, soalan lain dalam bahagian itu dikunci; hanya soalan bertanda dikira (tiada N terbaik); nyahtanda kekalkan jawapan tetapi tidak dikira. Sedang dibina. |
| FB-049 | Student §8 #3 | Fast | Fixed | 0bd250bf, 35d441be | "Perlu perhatian" uses one rule (counted and lost marks or pending). The audit's inconsistency did not reproduce after FB-048 in four Mat K2 scenarios (it most likely came from nothing being counted before FB-048); a test that fails on the pre-FB-048 code now locks the behaviour. Re-observe in the next audit. |  |
| FB-050 | Student §5 new #1, §8 #4 | Fast | Fixed | 3f1df8b5, 93bbd564 | Numeric final answers use inputmode decimal and flag only what the marker cannot read ("68ab", "abc", "2x+1"); lists ("3, 5", "3 dan 5"), 1.2E3, "5.", units after a space ("7 hari", "30 °C") are accepted. Hint: "Masukkan nombor sahaja, cth. 13 atau 3.5. Pecahan dan tanda tolak ada pada papan kekunci." |  |
| FB-051 | Student §7 #8, §4 S4 | Fast | Fixed | bfc1b3f4 | Learner shell reserves bottom space for the nav and the AI button (last content 24 px above the button, 104 px above the nav); the AI button tucks away while scrolling down and returns on scroll up, at top/end, on focus and route change; reduced motion respected. Under the nav at page end 18 → 0; under the AI button while scrolling 126 → 2. Cover/result double gutter removed; resume buttons stack at 320/375. Review: Approve; small follow-ups in progress (padding only when the button shows, no tuck-away on desktop). | Pengguna 2026-10-24: "Terima" (butang AI di atas halaman); butang Sambung/Mula Semula 3 baris pada 320 diterima bersama. |
| FB-052 | Student §7 #3 | Fast | Fixed | 32e1d968, 88e229a4 | Attempt footer fits 320-414 in both modes: compact 44 px buttons; in Latihan at 320 (and question 1 at 375) Seterusnya wraps to a second right-aligned row. All buttons on screen, no horizontal scroll. |  |
| FB-053 | Student §8 #5, §5 new #2 | Fast | Fixed | 94ea078f | Mat K1 cover count derived from the paper (10 soalan), Q4 distractor shown as 22/3, unit placeholder "Tulis unit" (neutral). D11: minimal, no records added; Sains K1 stays 40 (it has 40). |  |
| FB-054 | Student §7 #5 | Fast | Fixed | a165ae1f | Question title no longer touches the "Tanda soalan" flag at 320 and wraps sensibly at 1036. |  |
| FB-055 | Student §7 #6, #12 | Fast | Fixed | 68d0d49b, d861886a | Peta: current question clearly marked (light and dark), legend has colour swatches, phone sheet map on a page-coloured card. |  |
| FB-056 | Student §7 #7 | Fast | Fixed | 74651428, bb18bc9d, 1953b6ad, 21af1e0f | Attempt: choose-N checkbox row 44 px; answer fields 44 px below 768 (fully visible above the keypad sheet on 320×640) and 52 px from 768. Learner shell: search, theme toggle, account 44x44, sidebar logo 44 px tall. | Diputuskan 2026-10-24 (pengguna serah kepada cloud): 44 px bawah 768 px (medan nampak penuh di atas papan kekunci pada 320×640), 52 px dari 768 px. Sedang dibina. |
| FB-057 | Student §7 #9 | Fast | Fixed | 70fd62f8 | Cover hero text sits below the books art below 640 px (overlap 1 → 0 at 320/375/414); same fix on the Bijak hub hero. |  |
| FB-058 | Student §7 #11 | Fast | Fixed | b9448f4d | Stimulus card has a visible surface and border in dark. |  |
| FB-059 | Student §8 #7 | Fast | Fixed | 6a043612, 61a0c9c6 | Cover order: Arahan → Rumus (ringkas) → Pilih mod → "Mula" (`cover-start`, the only way to start a new attempt). The hero keeps title/meta and shows "Sambung" only while a sitting is open; the mode choice shows only when no sitting is open. Review follow-ups: mount tests for the start order and the restart dialog. | Keperluan pengguna 2026-10-24: murid mesti baca Arahan dan pilih mod sebelum Mula; tiada cara mula tanpa melalui arahan. Binaan sepadan (Mula hanya di hujung, hero hanya Sambung). |
| FB-060 | Student §8 #5 | Doc | In progress |  | Generated Sains K2 Bahagian A gives three working questions with the same stem and different numbers. | Pengguna 2026-10-24: "Elak dalam satu kertas". Penjana tidak memilih lebih daripada satu varian stem yang sama dalam satu kertas. Sedang dibina. |
| FB-061 | Student §8 #5, §4 E1 | Fast | Declined | | Hub tile "0 Tahun Tersedia": the old system shows the same 0, a deliberate live value (D9: replicate). Kept. | |
| FB-062 | Student §4 S1, §8 #6 | Full | Planned |  | Jana Kertas for Sejarah K1/K2 shows "Belum ada kontrak untuk subjek dan kertas ini": no Sejarah blueprint. Covered by FB-032 / P-032. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-063 | Student §4 S5 | Doc | Planned |  | No free MCQ drill like the old `/simulasi/kuiz`; Jana Kertas opens in Mod Peperiksaan by default, so Latihan needs a manual mode switch. | Pengguna 2026-10-24: "Skrin sendiri (macam lama)": kuiz MCQ pantas 5/10/20/40 dari kertas Bijak SPM, Semak Jawapan setiap soalan, tiada simpanan; berasingan daripada Latih Tubi SPM. Full track (G1 + reka bentuk dahulu). Menunggu jadual LEAD. |
| FB-064 | Student §5 new #5 | Fast | Need-info | 786c7e65 | Compact draft built next to the current layout (default unchanged; open an attempt with ?match=compact to try it): letter bank shown once ("Pilihan jawapan"), one row of A-E buttons (50x52) per sub-part. Sejarah Q2 column height at 375: 1364 px (current) vs 762 px (compact). Screenshots: docs/qa/audit-sistem/evidence/FB-064-current-375.png, FB-064-compact-375.png, FB-064-current-1280.png, FB-064-compact-1280.png. | Pilih versi: (a) semasa (butang penuh "A — 1946" bertindan) atau (b) padat (bank sekali, baris A-E). Versi yang tidak dipilih akan dibuang. |
| FB-065 | Student §4 E1 | Fast | Fixed | 841bb8d6 | `/spm` Bijak SPM hero overline reads "Baharu · {n} kertas" (n = papers listed by the Bijak hub, computed via m28's public `useBijakPaperCount()`; "Baharu" alone while loading or on error). | Pengguna 2026-10-24: "Tambah kiraan". Kiraan dikira daripada kertas yang diterbitkan. Sedang dibina. |
| FB-066 | Student §4 S3, §3 #6, US-16, US-19 | Full | Planned |  | See proposal P-066. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-067 | Student §4 H1, §3 #7, AC-18.x, R22, Q-B5 | Full | Planned |  | See proposal P-067. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-068 | STUDENT-SCOPE-NOTES carried over; Student §5 drawing/table_fill | Full | Planned |  | See proposal P-068. | Diluluskan pengguna 2026-10-24 (peraturan umum ANSWERS.md): masuk v2.0, tiru fungsi sistem lama dan baiki kecacatan, tanpa skrin bertindih (FB-042). Menunggu jadual LEAD (#280). |
| FB-069 | ANSWERS.md FB-045 (new request, user 2026-10-24) | Full | Planned | | See proposal P-069. | Sahkan pendekatan P-069 (MathLive) sebelum dibina? |
| FB-070 | VERIFY.md observation (2026-10-24) | Fast | Fixed | c2484362 | Review queue tiles show "{items} item · {questions} soalan" (e.g. "6 item · 7 soalan"); a group is one item, a revision adds no question; equals the bank's pending count. |  |
| FB-071 | VERIFY.md observation (2026-10-24, unverified) | Fast | Fixed | 4d2b60f4, 61a0c9c6 | Reproduced: "Mula Semula" restarted in Mod Peperiksaan because the mode choice was hidden. Now the "Mula semula?" dialog holds the mode choice, defaulting to the open sitting's mode; the chosen mode reaches startAttempt (tested). |  |
| FB-072 | VERIFY.md observation, FB-004 / FB-026 | Fast | Fixed | d5921fe3, 02586606 | T1-T3 (di luar DSKP) is exempt from unit and SP in intake and revision (publish already exempt via FB-004; tests added); the unit/SP confirmations are hidden for T1-T3 and no longer counted in "Perlu disahkan" or the queue confidence; TP stays required. |  |
| FB-073 | ANSWERS.md (user, 2026-10-24) | Standard | In progress |  | Local DS conformance audit (`DS-CONFORMANCE-AUDIT.md` on the audit branch @ f7c04b66): 155 of 256 routes have findings; root causes are mostly in the theme/DS (unthemed size xl used 141x, 3-5 recipes per role) and lint blind spots (68 .vue files outside ds-strict incl. all m28 admin and shells; lint:ds scripts broken). Phased plan P-073 below; phase 1 (theme levers + tooling) in progress. | Fasa 2-3 menyentuh semua modul kedua-dua half: jadual LEAD (#280). |
| FB-074 | ANSWERS.md FB-051 (2), user rule 2026-10-24 | Fast | Fixed | 1ae53214 | Resume block shows the short labels "Sambung" and "Mula Semula" as buttons on one line from 320 to 1280, with the rest of the existing copy as a line under each; the buttons keep the full text as their accessible name. (Code review pending with the next batch.) |  |

## Proposals for Planned items (Full track: G1 → G6, nothing built until the user answers)

### P-026 DSKP integration (FB-026) — highest priority
- **Scope:** replace the 12 prototype units (`m28/admin/intake/lib/dskp.ts`) with a controlled DSKP list built from `docs/reference/dskp/*.json` (13 subjects, T4 + T5): Tingkatan → (Bidang/Tema where printed) → unit/Tajuk → SK → SP. SP becomes a pick list (multi-select of real codes; no free text). SK is derived from the chosen SP. TP 1-6 has no default and must be chosen (and confirmed by the reviewer when the AI suggested it). KBAT derived as TP ≥ 4 (spec D9). Form is part of the key (codes repeat across T4/T5). Publish gate (`gateErrors`) requires the same tag as the submit gate: subject, tingkatan, unit, ≥1 SP, TP (T1-T3 exempt per FB-004). Bank filter by unit/SP. Tag audit (AI suggestion vs final + confidence, AC-05.5).
- **Ownership (D12):** curriculum is owned by M03. The DSKP list would be published through an M03 contract (`dskpCatalog`) that m28 reads; m28 keeps no schema of its own. M10's fixture DSKP store (Bidang/SK/SP, used by M04/M08/M27) stays as is unless you want it replaced too.
- **Files:** new `src/modules/m03-curriculum/.../dskp-catalog.ts` (+ JSON loader + tests); `m28/admin/intake/lib/dskp.ts`, `components/QuestionEditor.vue` (Tag DSKP block), `domain/validation.ts`, `ai/mock-extractor.ts`, `server/admin.ts` (`gateErrors`, revision path, `legacyTag` rule), `domain/admin-types.ts`, `data/builders.ts` (seed tags), `admin/papers/BankPage.vue` (filter); docs `v2-question-bank.md` / `v2-bijak-spm.md` / architecture note.
- **Estimate:** L — G1 note + G2 design (1 session), build 3-4 developer tasks (catalog contract; Tag DSKP editor; gates + seeds; bank filter + audit), review + QA (1 session).
- **Questions (Q-026):**
  1. Setuju senarai DSKP dimiliki M03 (kontrak `dskpCatalog`) dan m28 hanya membaca? (D12)
  2. Subjek untuk v2.0: kesemua 13 DSKP, atau mula dengan Matematik, Sains, Sejarah dahulu? Landskap dan Nurseri serta Katering dan Penyajian tiada langsung dalam sistem sekarang. Perlu ditambah?
  3. TP: wajib dipilih tanpa nilai lalai? TP ditanda pada setiap soalan (1-6) walaupun DSKP takrifkan TP pada peringkat berbeza (Tajuk/SK/kemahiran/Modul)?
  4. KBAT: terbitan automatik (TP ≥ 4), atau medan berasingan?
  5. Pendidikan Islam: teks SK/SP dalam Jawi tidak dapat diekstrak. Cukup dengan kod sahaja buat masa ini?
  6. Soalan seed yang tiada tag: dikecualikan (pintu hanya untuk terbitan baharu), atau aku isi tag untuk semua seed?

- **KBAT field proposal (Q-026.4a, user asked cloud to propose):** optional select "Aras KBAT" with the four DSKP levels Mengaplikasi / Menganalisis / Menilai / Mencipta; empty = not KBAT. Stored separately from TP (no derivation). Bank filter "KBAT: Ya/Tidak/aras". Alternative: a yes/no switch only. Recommendation: the level select (it is what the DSKP prints and costs the same). **Question:** setuju dengan pilihan aras (4 aras DSKP, pilihan, kosong = bukan KBAT)?

### P-027 Fork a shared stimulus on edit (FB-027)
- **Scope:** AC-24.4. When a revision changes a shared stimulus, the editor asks: "Ubah untuk semua N soalan" (all sharers get a new version and go to review together as one group unit) or "Salin untuk soalan ini sahaja" (fork: the question leaves the group with its own copy). No silent propagation on approval (today `applyLive` replaces the stimulus for every sibling).
- **Files:** `m28/server/admin.ts` (`reviseQuestionFull`, `applyLive`, review seeds), `admin/papers/BankEditPage.vue`, `admin/papers/ReviewItemPage.vue`, `domain/types.ts`, tests.
- **Estimate:** M — 1 design note, 1-2 developer tasks, review + QA.
- **Questions:** Bila stimulus dikongsi disunting, pilihan lalai mana: "ubah untuk semua" atau "salin untuk soalan ini sahaja"? Perlukah semua ahli kumpulan disemak semula sebelum terbit?

### P-028 Multiple stimuli per question and part-level stimulus (FB-028)
- **Scope:** schema D6: 1-3 stimuli per question/group; `stimulus_ref` on a part (sub-question). Editor, review, preview, paper builder and the student attempt panel all render the list.
- **Files:** `m28/domain/types.ts` (`QuestionDef`, `GroupDef`, `PartDef`), intake grouping/validation/convert, `QuestionEditor.vue`, `IntakeReviewPage.vue`, `QuestionPreview.vue`, student `AttemptPage.vue` / `AttemptShell.vue` (student side touches the student audit scope).
- **Estimate:** L — touches the student renderer; G2 design needed.
- **Questions:** Had maksimum 3 stimulus setiap soalan, setuju? Perubahan ini menyentuh paparan murid. Nak tunggu audit murid siap dulu?

### P-029 More stimulus kinds (FB-029)
- **Scope:** add the kinds intended by D6 (graph, image, infographic, audio, map) and make "jadual" addable in intake (today only rajah/petikan; the manual path offers only "Tambah petikan"). Sample papers also use e-mel, notis/iklan, sajak, tajuk akhbar: these could be passage sub-kinds (label only).
- **Files:** `m28/domain/types.ts` (`StimulusDef.kind`), `IntakeReviewPage.vue` (`addStimulus`), stimulus renderer, validation (alt text), student renderer.
- **Estimate:** M.
- **Questions:** Jenis mana yang wajib untuk v2.0? Cadangan aku: jadual, graf, gambar, peta, serta petikan dengan sub-label (e-mel, notis, sajak, tajuk akhbar). Audio dan infografik ditangguhkan. Bagi laluan manual tanpa fail sumber, bagaimana "Tambah rajah" patut berfungsi: muat naik imej?

### P-030 Attach/detach a stimulus on a published bank question (FB-030)
- **Scope:** today grouping works only inside an intake batch. Add "Kumpulkan dengan rangsangan…" on the bank edit page: picking an existing stimulus creates a new version for the joining question and the group is reviewed as one unit.
- **Files:** `server/admin.ts`, `BankEditPage.vue`, grouping domain, review seeds.
- **Estimate:** M (depends on P-027).
- **Questions:** Perlukah ciri ini untuk v2.0, atau cukup dalam kelompok intake?

### P-031 Hub "Gambaran SPM" (FB-031, KS-01, AC-22.3)
- **Scope:** `/admin/spm` group landing with lane cards (label, description, total, attention count computed, not stored) for the built lanes (Bank Soalan SPM, Pembina Kertas, Ekstrak, Semakan). `/admin/spm` is 404 today.
- **Files:** new `m28/admin/hub/HubPage.vue`, route, `menu.ts` (KS-01 `to`), `server/admin.ts` (counts), tests.
- **Estimate:** S-M.
- **Questions:** Kad laluan mana yang mesti ada? Lorong lama (Tracking A, Subjektif, Databank) tidak dibina. Paparkan kad yang sudah dibina sahaja?

### P-032 Kontrak Simulasi editor (FB-032, KS-08, US-25 / AC-25.1-25.6, R30)
- **Scope:** list/create/edit/delete blueprints (Subjek, Kertas, Sumber Draf/Spec/Disahkan, Kod Kertas, Tempoh, Jumlah Markah, "Boleh tanda auto", Nota; Bahagian rows with label, rule, pilih N, markah, arahan, mod jawapan) with the "Kontrak dikongsi" banner, versions and audit. Today 4 hard-coded rows (`data/registry.ts:182-247`); no Sejarah blueprint although a Sejarah paper exists; MAT K2 and SN K2 have no live contract.
- **Files:** new `m28/admin/contracts/*`, `server/admin.ts`, `data/registry.ts`, `PaperNewPage.vue`, tests.
- **Estimate:** L (Q-B1 exam schema still blocks the field set).
- **Questions:** Q-B1 masih terbuka. Medan kontrak ikut skema D47? Tambah kontrak Sejarah? Kekalkan seed MAT K2/SN K2 (tiada di live) atau buang?

### P-033 Tanda Karangan queue (FB-033, KS-10, US-31 Should / R13)
- **Scope:** Admin Pusat queue of AI-proposed essay marks: student (anonymised), stem, proposed marks, rationale, scheme points; confirm or adjust; resolves "Menunggu semakan" on the student result.
- **Files:** new `m28/admin/essay-marking/*`, `server/store.ts` / `server/admin.ts`, student result linkage.
- **Estimate:** M.
- **Questions:** Perlu untuk v2.0 (US-31 ialah "Should")? Guru ditangguhkan (Q-B10)?

### P-034 Admin "Jana set" / pool preview (FB-034, US-29 Should)
- **Scope:** generate a draft paper from the bank by blueprint (count, year/board filters, live "{n} soalan tersedia"), keeping stimulus groups whole; regenerate.
- **Files:** `server/admin.ts` (reuse student generator `server/store.ts:327-349`), `PaperNewPage.vue`, `PaperEditorPage.vue`.
- **Estimate:** M.
- **Questions:** Perlu untuk v2.0?

### P-035 "Salin untuk sunting" and paper versions (FB-035, AC-24.x, AC-26.3)
- **Scope:** copy a published paper to a new draft (one copy, no "(Salinan)" chains); states "Dibatalkan terbit" / "Digantikan"; republish replaces the old version for new attempts only.
- **Files:** `server/admin.ts`, `domain/admin-types.ts` (`AdminPaperStatus`), `PaperListPage.vue`, `PaperEditorPage.vue`.
- **Estimate:** M.
- **Questions:** Kertas terbit diubah melalui salinan (seperti lama) atau versi baharu pada ID yang sama? Cadangan aku: versi baharu pada ID yang sama, dengan sejarah.

### P-036 Other Partial gaps (FB-036, bundled; each becomes its own FB once approved)
- Paper list: subject filter, search, 25 per page, attention column (A2, AC-22.1).
- Bank filters: chapter/unit, year, board/source (A3, AC-23.2).
- Withdraw/archive a Terbit question (QB US-14).
- Paper metadata edit: cover code, cover instructions, duration, Bahagian label/instruction/rule, passage edit (A9, AC-24.1-24.2).
- Publish override with reason + paper/contract audit (AC-27.2, US-32).
- Mod Pelajar opens Draf papers, attempts flagged as test data (US-28).
- Per-paper analytics (US-30).
- Edit link for Draf / Menunggu Semakan / Ditolak bank rows (§9 #11).
- Duplicate detection by normalised stem + options + figure hash (spec D9; `fileHash` stored but never compared).
- **Questions:** Mana antara ini yang masuk v2.0, dan susunan keutamaannya?

### P-066 Self-mark, teacher review request and question report on the result page (FB-066, US-16 / US-19 Should)
- **Scope:** on `/spm/bijak/percubaan/:id/keputusan`, for parts that are not auto-marked: "Markah kendiri" stepper (0..max, saved, shown as provisional), "Mohon semakan guru" (creates a request a teacher resolves; status "Menunggu" / "Disahkan"), and "Lapor Soalan" (reason list + note, into the question-report loop owned by M04, QB-4.7). The old self-mark did not persist; the new one must.
- **Files:** `m28/pages/ResultPage.vue`, `components/PartResultCard.vue`, `server/store.ts`, M04 report contract, teacher-side queue (M10/M11) or Tanda Karangan (P-033).
- **Estimate:** M-L (depends on who resolves requests: P-033).
- **Questions:** Ketiga-tiga ciri ini perlu untuk v2.0? Markah kendiri mengubah jumlah markah (sementara) atau dipaparkan berasingan? Permohonan semakan pergi kepada guru kelas atau Admin Pusat (Tanda Karangan)?

### P-067 Bijak rows in the shared SPM history (FB-067, AC-18.1-18.4, R22, Q-B5)
- **Scope:** Bijak attempts appear in M06 `/spm/history` ("Sejarah Kuiz SPM") with a "Bijak SPM" filter and label (the old system labelled them "Tahun Lepas"), linking to the Semakan; hub tile "Prestasi SPM Anda" counts them.
- **Ownership (D12):** practice sessions are owned by M05; M06 history reads them. Bijak attempts live in m28's store today, so this needs a contract decision.
- **Files:** `m06-spm` history page + stats, m28 `server/store.ts` (expose attempts through the owner contract), tests.
- **Estimate:** M.
- **Questions:** Q-B5 masih terbuka. Percubaan Bijak masuk sejarah bersama `/spm/history` (melalui kontrak M05), atau kekal di `/spm/bijak/sejarah` sahaja?

### P-068 Drawing and table-fill answers (FB-068)
- **Scope:** `table_fill` is a stub ("Jenis jawapan ini akan tersedia tidak lama lagi"); `drawing` is photo upload; no seeded paper uses either. Depends on FB-037 (answer modes decision).
- **Estimate:** M per widget.
- **Questions:** Perlu untuk v2.0? (Berkait dengan keputusan FB-037.)


### P-069 Answer field shows real maths while typing (FB-069, user request 2026-10-24)
- **Request:** the student types directly into a rendered maths display (like a Casio natural display): stacked fractions, raised powers and √ shown in the field itself, not raw text such as `(7)/(3)^2+sin(30°)`. The separate preview becomes redundant.
- **Proposed approach:** replace the plain `UInput` in `MathField.vue` with a WYSIWYG maths editor, **MathLive** (`<math-field>` web component, MIT). The Casio keypad (FB-045) stays and drives the editor through its command API (insert fraction, power, √, move cursor, DEL, AC); MathLive's own virtual keyboard is turned off. The editor value is LaTeX; `domain/math-expr.ts` already has `latexToPlain`, so the stored answer and the marker stay unchanged (stored as today's plain form, or as LaTeX converted before marking).
- **Impact:** new runtime dependency (~0.7 MB, lazy-loaded only on attempt pages) → ADR + LEAD approval (half AZ owns m28 and exam-core); DS styling of the web component in light/dark; e2e selectors (`math-preview`, `data-key`) updated; accessibility via MathLive's built-in speech/ARIA; exam-core marking parity unaffected if the stored form stays plain.
- **Alternative:** a custom contenteditable renderer (no dependency) — much more work and riskier on mobile keyboards; not recommended.
- **Track / estimate:** Full (new dependency + changed input model). M: 1 design note + ADR, 2 developer tasks (editor + keypad bridge; marker/e2e), review + QA. Best after go-live unless the LEAD wants it before the 25 Oct freeze.
- **Questions:** Setuju guna MathLive (perpustakaan sumber terbuka) untuk medan jawapan? Bina sebelum atau selepas go-live 30 Okt?

## P-040 Paper type mapping (proposal)

FB-040. User answer 2026-10-24: "ikut sistem lama dan standard peperiksaan". This is a **proposal only**: the requirement lists (`v2-exam-schema.md` D8, `v2-question-bank.md` §4.2, intake `PAPER_TYPES`) are **not changed** until the user confirms.

### Sources compared

| Source | Values | Where |
|---|---|---|
| Old .cloud (Studio filter "Jenis"; DB `exam_types`) | Percubaan, Sebenar, Modul (`percubaan`, `sebenar`, `modul`) | `/studio` Jenis (audit report §8); `ProvenanceVocabSeeder.php:53-57` (audit rows C15-C17) |
| Old .cloud teacher declaration (`jenis_soalan`) | Soalan Umum, Trial Paper, Soalan DSKP, Buku Teks, Buku Latihan, Soalan Peperiksaan, Lain-lain | `TeacherController.php:1000`; QB §4.2 lists 7 (audit row C18) |
| Exam schema D8 `exam_type` | `sebenar`, `percubaan`, `modul`, `topikal`, `latihan` | `v2-exam-schema.md` D8 ("DATA: percubaan, sebenar, modul" + PAPER; `topikal`/`latihan` added from the Drive folder "SOALAN TOPIKAL") |
| QB §4.2 | Soalan Umum / Trial / DSKP / Buku Teks / Buku Latihan / Peperiksaan / Lain-lain | `v2-question-bank.md` §4.2 step 2 (7 values) |
| Intake `PAPER_TYPES` (m28) | Percubaan SPM, Soalan Umum, Peperiksaan Sebenar, Buku Latihan, Lain-lain | `src/modules/m28-bijak-spm/admin/intake/types.ts` L118-124 (5 values) |

### Mapping and proposed canonical list

Rule used: the canonical list is the old .cloud exam-type list (Studio), aligned to the exam standard (the three recognised kinds of exam paper: the official SPM paper, the state/school trial paper, and the state/PPD revision module). A value stays only if it is a recognised exam paper type; the rest are not paper types and are handled elsewhere (source or rights fields, or "tidak dikelaskan").

| Proposed canonical (slug / BM label) | Old .cloud exam type | D8 `exam_type` | QB §4.2 value | Intake value (now) | Note |
|---|---|---|---|---|---|
| `sebenar` / **Sebenar** | Sebenar | `sebenar` | Peperiksaan | Peperiksaan Sebenar | Official LPM/KPM past-year SPM paper. |
| `percubaan` / **Percubaan** | Percubaan | `percubaan` | Trial | Percubaan SPM | State, MRSM/SBP or school trial paper (source detail stays in board/source fields). |
| `modul` / **Modul** | Modul | `modul` | (none; closest Buku Latihan) | (none; closest Buku Latihan) | Revision module (intake had no exact option, audit row C17). |
| not a paper type | (none) | `topikal` | (none) | (none) | Topical question set: a way of grouping, not an exam paper. Proposed: drop from `exam_type`; topic grouping is already carried by the DSKP unit tag. |
| not a paper type | (none) | `latihan` | Buku Latihan | Buku Latihan | Exercise-book content. Proposed: drop from `exam_type`; origin recorded as source kind `publisher` (D8). |
| not a paper type | (none) | (none) | Buku Teks | (none) | Textbook content. Proposed: source kind `publisher`. |
| not a paper type | (none) | (none) | DSKP | (none) | "Soalan DSKP" describes the tagging, not the paper. Proposed: dropped (DSKP tags are mandatory on every question anyway). |
| not a paper type | (none) | (none) | Soalan Umum | Soalan Umum | General questions, no exam format. Proposed: dropped; an item that is none of the three types is saved without a paper type (see question 2). |
| not a paper type | (none) | (none) | Lain-lain | Lain-lain | Catch-all. Proposed: dropped (same as Soalan Umum). |

Result if confirmed: **3 values** (Sebenar, Percubaan, Modul) used identically by the Studio-style filter, intake declaration (3 options replace 5), QB §4.2 (7 values replaced) and D8 `exam_type` (`topikal`, `latihan` removed). Existing intake/seed values would migrate: Percubaan SPM -> percubaan; Peperiksaan Sebenar -> sebenar; Buku Latihan -> source kind publisher (+ modul only if it is a module); Soalan Umum and Lain-lain -> no paper type.

### Questions for the user

1. Sahkan senarai: **Sebenar, Percubaan, Modul** sebagai jenis kertas (ikut sistem lama dan standard peperiksaan)?
2. Soalan yang bukan kertas peperiksaan (Soalan Umum, Buku Teks, Buku Latihan, Topikal, Lain-lain): dibenarkan tanpa jenis kertas (hanya sumber / hak cipta), atau perlu satu pilihan "Lain-lain"?

### P-073 Design-system conformance on all screens (FB-073, user request 2026-10-24)
Source: `docs/qa/audit-sistem/DS-CONFORMANCE-AUDIT.md` (audit branch @ `f7c04b66`). Rule: improve, do not redesign; one implementation per role (`docs/design/v2-ds-consolidation.md`), fix at the highest lever (`docs/design/v2-ds-hardening.md` H1-H7). This plan follows the existing hardening plan instead of starting a parallel one.
- **Phase 1 — theme levers and tooling (one change fixes many screens; in progress):**
  - size `xl` themed (or mapped) for UButton / UInput / USelect / UTextarea / UBadge, and badge `lg/xl` shapes (P3, E3, E4, E5);
  - `src/ds/states.css` focus ring without `outline` (E9);
  - `scripts/lint-ds.mjs` command-line length on Windows and the brace-glob bug in `styleGlobs()` (B1, B2), so `npm run lint:ds` runs;
  - add `src/modules/m28-bijak-spm/admin/**`, the two live shells and the 12 listed module files to `config/ds-strict.json` at `page` level (P1), with their current debt recorded so the ratchet holds;
  - stale ds-debt baseline entries refreshed only where counts went down (MathField, MathKeyboard).
- **Phase 2 — role recipes (one sweep per role):** status words → `DsStatusBadge`; primary/row/toolbar button recipe per role (P4, E4); card container `DsPanel` vs `UCard` (P9, E1) and deprecated `tone` props (E8); form fields `DsFormField` + one select per context (P10, E5); copy vocabulary E7 (with FB-025); stock radius/type sizes → tokens (P6, P8); palette/hex/arbitrary in lint-blind files (P5).
- **Phase 3 — worst screens first:** the P1 list (score ≥ 30, 11 screens: RenewalInvoicePage, KadKongsiPage, IntakeReviewPage, BankEditPage, QuestionCreate/Edit + ArabicKeyboardPanel, Register, Achievements, Login…), then P2 (21), then P3.
- **Risk:** 329 e2e class selectors in 62 specs break when classes are replaced (B3) — each sweep updates the specs it touches. Phase 2-3 touch modules of both halves → schedule with the LEAD.
