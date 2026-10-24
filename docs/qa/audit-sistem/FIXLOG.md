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
| FB-011 | §10.2 V7 | Fast | Fixed | a6c1e595 | The source-pages aside is no longer sticky with its own scroll, and the page text <pre> no longer has max-h-96: one page scroll at 1280, nothing clipped. Side effect: the source page scrolls away while editing a later question. | Panel "Halaman sumber" kini ikut skrol halaman (tidak lagi melekat). Nak ia melekat semula? Itu hanya berfungsi jika panel lebih pendek daripada skrin. |
| FB-012 | §10.5 F1 | Fast | Fixed | 1ff39c43 | Option rows get min-w-0 and the remove button shrink-0: 0 px overflow at 320/375 (was +102 / +47 px). |  |
| FB-013 | §10.5 F2, §10.4 | Fast | Fixed | 1c6b35f8 | Editor is a container; top fields and Tag DSKP switch 1 / 2 / 4 columns on card width; labels no longer clipped. 0 px overflow at 320/375 (was up to +103 px). |  |
| FB-014 | §10.5 F3 | Fast | Fixed | 2fe1bf60 | Structured part row: Label / Teks / Markah in 3 columns from container lg, Mod jawapan + Buang bahagian on their own row: 0 px overflow at 768/1024/1280 (was +10 / +324 / +175 px). The question-4 offset is the deliberate group indent (ml-3 sm:ml-6) and was kept. | Kad soalan dalam kumpulan rangsangan diinden ke dalam (disengajakan). Kekalkan? |
| FB-015 | §10.5 F4, F5 | Fast | Fixed | faf8a8bc | Fixed-layout tables take an opt-in min-width and scroll inside their card: PKSK list and access at 768/1024 now reach Tindakan (row menu works), question text no longer overlaps Bahagian. Known limit: other fixed tables (m09 lists, m27 SchoolUserList, m08 Leaderboard/Ranking) not yet given a min-width. |  |
| FB-016 | §10.5 F6 | Fast | Fixed | 98636033 | At 1280 PKSK and access cell content stays inside its cell (+48 / +64 px → 0); /admin/questions id, stars and status 0 px overflow; the source-file name stays truncated with an ellipsis. |  |
| FB-017 | §10.5 F7 | Fast | Fixed | dfbac4d6 | Pentadbiran top bar: menu, search, theme toggle, drawer close 44x44, brand link 74x44 (were 28-32 px); bar fits at 320. |  |
| FB-018 | §10.5 F8 | Fast | Fixed | 7e6b12af, 043df9d7 | Slide-over/modal close 44x44; row actions "Tarik", "Lihat" 40 px (44 on touch); "Sisip matematik" 167x44; checkboxes keep their existing 44 px hit area (the visible box stays 24 px). |  |
| FB-019 | §10.5 F9 | Fast | Fixed | 5d794e3b, 6ae921a4 | Sticky form bar reserves scroll-padding so a focused last field ends above the bar (was 35 px behind at 375, now 11 px clear); works for page-scrolling and panel-scrolling shells. |  |
| FB-020 | §10.5 F10, §10.3 #15 | Fast | Fixed | 93c65c06 | Stat tile labels wrap to 2 lines (no "Jumlah ke…"); "14,462" fits at 320 (tiles stack chip above value below 640, app-wide). Not changed: a long value in a single-line title input still scrolls inside the input; the "9 perkara…" pill shape when it wraps. |  |
| FB-021 | §10.3 #8 | Fast | Fixed | ed49bc5d, 85de6500, ffe22134 | Review decision bar is a raised sticky layer with a background on phones (2 rows at 320/375 instead of 3 floating rows), "Minta Pembetulan" wraps instead of being cut; no empty bar on published items. |  |
| FB-022 | §6 P9, AC-22.4 / R26 | Fast | Fixed | fabef0bd | Admin Bijak routes (11, routes/admin-papers.ts and admin-intake.ts) carry onForbidden '403': a student/teacher/parent typing the URL gets the in-place 403; a guest goes to /login. Security review: Pass. Known for the real backend: the mock admin API has no role check (route guard only). |  |
| FB-023 | §9 #14, §12 #12 | Fast | Fixed | 8428de2f | Cause: the total counted every status (72 Terbit + 7 menunggu semakan = 79) while subject cards count Terbit only. Total is now the Terbit count; the card sub reads "72 Terbit · 7 menunggu semakan". |  |
| FB-024 | §10.3 #9-14, #16 | Fast | Need-info | | Judgement calls (form intro alignment, stat row 24 px short, ghost buttons in light, drop zone border, ekstrak filter bar, Tag DSKP indent, sidebar footer/ring). Not defects by the report. | Nak aku baiki juga item kosmetik ini (#9-14, #16), atau biar dulu? |
| FB-025 | §10.3 #17 | Fast | Need-info | | "Download Template" / "Template CSV" in English on `/admin/questions/import` (legacy .my replica, M04). | Halaman ini tiruan .my. Kalau di .my pun tertulis bahasa Inggeris, aku kekalkan (fideliti). Nak tukar ke BM juga? |
| FB-026 | §13 (all), §3 #19-22 | Full | Planned | | See proposal P-026. | See P-026 questions. |
| FB-027 | §13.9.4 fork row, AC-24.4 | Full | Planned | | See proposal P-027. | See P-027 questions. |
| FB-028 | §13.9.4 (1-3 stimuli; part-level `stimulus_ref`), §11 A10 | Full | Planned | | See proposal P-028. | See P-028 questions. |
| FB-029 | §13.9.4 kinds, §3 #13, §13.7, §13.9.3 b | Full | Planned | | See proposal P-029. | See P-029 questions. |
| FB-030 | §13.9.4 (attach on a Terbit question) | Full | Planned | | See proposal P-030. | See P-030 questions. |
| FB-031 | §6 A1/P1, §7.1 (KS-01) | Full | Planned | | See proposal P-031. | See P-031 questions. |
| FB-032 | §6 P4, §7.5, §9 #4 (KS-08) | Full | Planned | | See proposal P-032. | See P-032 questions. |
| FB-033 | §6 P8, §7.8 (KS-10) | Full | Planned | | See proposal P-033. | See P-033 questions. |
| FB-034 | §4 "Jana set", §6 A10 (US-29) | Full | Planned | | See proposal P-034. | See P-034 questions. |
| FB-035 | §4 "Salin untuk sunting", §9 #12, §6 P2/P3 | Full | Planned | | See proposal P-035. | See P-035 questions. |
| FB-036 | §6 A2, A3, A4, A9; §9 #6, #11; §13.6 duplicates | Full | Planned | | See proposal P-036 (other Partial gaps, bundled). | See P-036 questions. |
| FB-037 | §11.6 #1, §3 #14 | Doc | Need-info | | `v2-exam-schema.md` D1 drops numbered_list, sequence_order, code, cloze, gapped_text_match, essay_choice; `v2-bijak-spm.md` US-08 / AC-08.1 / AC-08.3 / R16 still require gaps, ordering, code and numbered list. D47 (2026-10-17) approved the exam schema one day after the Bijak doc. | Pilih: (a) ikut D1/D47, aku kemas kini US-08/R16 supaya buang kawalan itu; atau (b) kekalkan US-08, D1 perlu dipinda dan kawalan itu dibina. Cadangan aku: (a). |
| FB-038 | §11.6 #2, §9 #10, §3 #14 | Doc | Need-info | | Kertas Subjektif is Won't for v2.0 (`v2-bijak-spm.md` §6, R24, Q-B6) but F-76 / F-139 and menu item KS-07 still carry a treatment. | Pilih: (a) Won't: aku buang KS-07 dari menu dan tandakan F-76/F-139 "Won't v2.0"; atau (b) masuk skop v2.0 (jadi item Full baharu). Cadangan aku: (a). |
| FB-039 | §11.6 #3 | Doc | Need-info | | KS-02 label: "Databank Soalan" in the backlog, "Bank Soalan SPM" in the menu. | Label mana yang betul? Cadangan aku: "Bank Soalan SPM" (yang sudah dibina), aku kemas kini backlog. |
| FB-040 | §11.6 #4 | Doc | Need-info | | Paper types: QB §4.2 lists 7, intake code has 5, exam schema D8 `exam_type` lists 5 different values. | Senarai mana jadi rujukan? Cadangan aku: ikut D8 (skema diluluskan D47) dan selaraskan intake + QB §4.2. |
| FB-041 | §11.6 #5, §6 A4 | Doc | Need-info | | QB §4.1 keeps Lulus and Terbit separate and adds Diarkib; the code folds Lulus into Terbit and has no Diarkib. | Pilih: (a) ikut QB §4.1 (Lulus ≠ Terbit, ada Diarkib, jadi item Full); atau (b) kekalkan model kod sekarang dan kemas kini QB §4.1. |
| FB-042 | §11.6 #6 | Doc | Need-info | | F-71 / F-142 say Tracking A is "Merge-duplicate" but no doc says what replaces its set editor. | Tracking A diganti oleh apa? (cth. Pembina Kertas KS-09 dengan jenis "Tracking A", atau gugurkan terus.) |

### Student scope (from `BIJAK-SPM-STUDENT-AUDIT-REPORT.md` and `STUDENT-SCOPE-NOTES.md`, commit on `audit/sistem-2026-10-23` fetched 2026-10-23)

Priority (user): 1) FB-043, FB-044 critical; 2) keypad FB-045 to FB-047; 3) other §7-§8 items; 4) Full items Planned.

| FB | Sumber | Track | Status | Commit | What changed | Question |
|---|---|---|---|---|---|---|
| FB-043 | Student §7 #1, §3 #5 (CRITICAL) | Fast | Fixed | baa97420 | Passage and table stimuli show an icon tile with "Lihat Bahan N" in the sticky strip below 1024; full content only in the sheet. Figures keep their thumbnail. Reviewed at 320/360/375. |  |
| FB-044 | Student §7 #4, §3 #5 (CRITICAL) | Fast | Fixed | f57c3f78 | "Hantar" is in the Peta bottom sheet on phones, on every question; it opens the existing dialog ("Belum dijawab: n soalan", "Ditanda: n soalan"). |  |
| FB-045 | Student §6, STUDENT-SCOPE-NOTES (user) | Standard | Need-info | 99753c66 | Casio-style keypad. Top layer "Fungsi" (default): a/b √ x² xⁿ x⁻¹ / sin cos tan log ln / ( ) π ° [Simbol]. Layer "Simbol": x y , % ± / < > ≤ ≥ = / ( ) π ° [Fungsi]. Number block: 7 8 9 DEL AC / 4 5 6 × ÷ / 1 2 3 + − / 0 . ×10ˣ ◀ ▶. All 35 old keys kept; new: AC, x⁻¹, sin, cos, tan, log, ln, °, ×10ˣ (all accepted by the marker; trig in degrees). Not added: e, (−), Ans, execute "=", RCL/M+ (no calculation in an answer field). Screenshots: docs/qa/audit-sistem/evidence/FB-045-keypad-375-light.png, FB-045-keypad-1280-light.png. Code review in progress. | Sahkan susunan. (1) Simbol x, y, <, >, ≤, ≥, =, %, ± diletak di lapisan "Simbol" (tekan sekali untuk tukar) supaya papan kekunci tidak terlalu tinggi di telefon. Setuju? (2) Ikon pecahan (dua petak dan garis) jelas, atau tukar kepada teks "a/b"? |
| FB-046 | Student §6 problem 7 | Fast | Fixed | 11c048c8 | Attempt scroll area reserves the sticky strip height (scroll-padding-top) so a focused field scrolls clear of "Lihat Rajah"; works with the keypad reveal (FB-047). |  |
| FB-047 | Student §6 problems 3-5, §5 new #3-4 | Fast | Fixed | 8942938e, 2eddbc2a, 905158e7 | Below 768 the keypad is a bottom sheet with a display row (preview + "Tutup"); it covers the attempt footer while open and closes with Tutup, a tap or focus outside, Esc or the field toggle (key taps and scrolling never close it). From 768 it is sticky at the bottom of the scroll area, so no keys sit under the footer. Preview shows stacked fractions; the field is kept clear of the sticky "Lihat Rajah" chip; one keypad open at a time; spacer follows the real sheet height. Rebuilt on DS primitives (no new DS debt). Review: Approve; small follow-ups in progress (focus after Tutup, landscape phone height). | Di telefon, papan kekunci menutup footer ("Peta / Seterusnya") semasa terbuka; tekan "Tutup" atau ketuk di luar untuk kembali. Boleh terima? |
| FB-048 | Student §8 #1-2 | Standard | In progress | 35820ba4 | One choose-N rule (domain/choose-n.ts) for counter, Hantar count, marking and result: typing an answer ticks the question if a slot is free; at the cap the other checkbox is disabled with "Anda sudah memilih 1 soalan. Nyahpilih soalan lain untuk menukar pilihan."; answering more than N shows "Anda telah menjawab 2 soalan. Hanya 1 soalan dengan markah tertinggi akan dikira." Review: progress bar still on the old rule (being fixed); requirement doc to be updated. |  |
| FB-049 | Student §8 #3 | Fast | In progress | 0bd250bf | Review: the new rule equals the old one, so the audit case is not proven fixed; root cause being re-checked on Mat K2. |  |
| FB-050 | Student §5 new #1, §8 #4 | Fast | In progress | 3f1df8b5 | Numeric final answers use inputmode decimal and show a hint when the marker cannot read the value. Review: the check wrongly flags lists such as "3, 5" and a few other forms the marker accepts (being fixed). |  |
| FB-051 | Student §7 #8, §4 S4 | Fast | Fixed | bfc1b3f4 | Learner shell reserves bottom space for the nav and the AI button (last content 24 px above the button, 104 px above the nav); the AI button tucks away while scrolling down and returns on scroll up, at top/end, on focus and route change; reduced motion respected. Under the nav at page end 18 → 0; under the AI button while scrolling 126 → 2. Cover/result double gutter removed; resume buttons stack at 320/375. Review: Approve; small follow-ups in progress (padding only when the button shows, no tuck-away on desktop). | (1) Bila butang AI kelihatan (atas halaman / sejurus skrol ke atas) ia masih boleh menutup sedikit kandungan pada 320-375. Terima? (2) Butang "Sambung" / "Mula Semula" masih 3 baris pada 320. Kecilkan fon? |
| FB-052 | Student §7 #3 | Fast | In progress | 32e1d968 | Exam mode footer fits at 320. Review: Latihan mode (Sebelum, Peta, Semak, Seterusnya) still pushes Seterusnya off-screen at 320-375 (being fixed). |  |
| FB-053 | Student §8 #5, §5 new #2 | Fast | Fixed | 94ea078f | Mat K1 cover count derived from the paper (10 soalan), Q4 distractor shown as 22/3, unit placeholder "Tulis unit" (neutral). D11: minimal, no records added; Sains K1 stays 40 (it has 40). |  |
| FB-054 | Student §7 #5 | Fast | Fixed | a165ae1f | Question title no longer touches the "Tanda soalan" flag at 320 and wraps sensibly at 1036. |  |
| FB-055 | Student §7 #6, #12 | Fast | Fixed | 68d0d49b, d861886a | Peta: current question clearly marked (light and dark), legend has colour swatches, phone sheet map on a page-coloured card. |  |
| FB-056 | Student §7 #7 | Fast | Fixed | 74651428, bb18bc9d | Attempt: choose-N checkbox row and inputs 44 px. Learner shell: search, theme toggle and account 44x44, sidebar logo 44 px tall. |  |
| FB-057 | Student §7 #9 | Fast | Fixed | 70fd62f8 | Cover hero text sits below the books art below 640 px (overlap 1 → 0 at 320/375/414); same fix on the Bijak hub hero. |  |
| FB-058 | Student §7 #11 | Fast | Fixed | b9448f4d | Stimulus card has a visible surface and border in dark. |  |
| FB-059 | Student §8 #7 | Fast | Need-info | | On the cover, "Mula" in the hero sits above the mode choice; the student scrolls down to choose the mode, then back up. | Nak aku pindahkan butang "Mula" ke bawah pilihan mod (atau tambah butang kedua di bawah)? |
| FB-060 | Student §8 #5 | Doc | Need-info | | Generated Sains K2 Bahagian A gives three working questions with the same stem and different numbers. | Ini disengajakan (varian nombor), atau penjana patut elak stem yang sama dalam satu kertas? |
| FB-061 | Student §8 #5, §4 E1 | Fast | Declined | | Hub tile "0 Tahun Tersedia": the old system shows the same 0, a deliberate live value (D9: replicate). Kept. | |
| FB-062 | Student §4 S1, §8 #6 | Full | Planned | | Jana Kertas for Sejarah K1/K2 shows "Belum ada kontrak untuk subjek dan kertas ini": no Sejarah blueprint. Covered by FB-032 / P-032. | See P-032. |
| FB-063 | Student §4 S5 | Doc | Need-info | | No free MCQ drill like the old `/simulasi/kuiz`; Jana Kertas opens in Mod Peperiksaan by default, so Latihan needs a manual mode switch. | Perlukah latih tubi MCQ pantas? Atau cukup Jana Kertas terus dibuka dalam Mod Latihan? |
| FB-064 | Student §5 new #5 | Fast | Need-info | | `match_letter` stacks 15 full-width buttons for three sub-parts. | Nak aku tukar kepada pilihan huruf yang padat (A-E sebaris) bagi setiap bahagian? |
| FB-065 | Student §4 E1 | Fast | Need-info | | Old Bijak card shows a set count pill ("69 set"); the new hero has none. | Tambah kiraan "{n} kertas" pada kad Bijak SPM di `/spm`? |
| FB-066 | Student §4 S3, §3 #6, US-16, US-19 | Full | Planned | | See proposal P-066. | See P-066 questions. |
| FB-067 | Student §4 H1, §3 #7, AC-18.x, R22, Q-B5 | Full | Planned | | See proposal P-067. | See P-067 questions. |
| FB-068 | STUDENT-SCOPE-NOTES carried over; Student §5 drawing/table_fill | Full | Planned | | See proposal P-068. | See P-068 questions. |

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
