# Bijak SPM student audit report: old system vs v2 prototype

> **Status: audit findings only. No item here is an approved fix (FB). Do not implement anything from this report until the user approves FB items.**

Companion to `BIJAK-SPM-AUDIT-REPORT.md` (admin scope). The two reports are kept separate.

## 1. Header and method

| Field | Value |
|---|---|
| Date | 2026-10-24 |
| Base SHA (new code) | `3e192a7a46971adc07e27ac6add2036468bf2602` (branch `feature/student-prototype`) |
| Scope | Student side of Bijak SPM: S1-S6, H1, E1, E2 (parity file Table 2), answering methods, the math keypad, responsive and visual behaviour, behaviour/logic |
| Old system | `prestasiplus.cloud`, entered two ways: (1) the Blade admin account via the sidebar group "PRATONTON PELAJAR" / "Student View" (Mod Pelajar); (2) a dedicated test student account created on 2026-10-24 at the user's request (username `murid.ujianaudit`, active school; the password is not recorded here). The test account is to be deleted by the user (user id 7576). |
| New system | v2 prototype `localhost:5199`, account `pelajar@demo.test` (Pelajar Demo), mock data |
| Browser lanes | Old via admin: lane 3; old via test account: lane 1; new walk and keypad: lane 2. Fit viewport 1036x751 (outer 1051x846); 375 and 320 judged from viewport screenshots |
| Evidence | **Observed** (seen in the browser), **Code** (read in source at the base SHA), **Doc** (`docs/discovery/BIJAK-SPM-cloud.md` §3.1-3.7 and `BIJAK-SPM-PARITY.md` Table 2; static reading of old code, never live) |

**Live writes on the old system (the user should know):**
- Admin account: exam attempt 278 created on opening `/simulasi/292`; every autosave was rejected (PATCH `/simulasi/percubaan/278/jawapan` -> 302 -> PATCH `/admin` 405, label "gagal simpan"), so nothing was stored; not submitted. Typed values: one textarea ("ujian audit"), one numeric ("12"); flag toggled once; one MCQ checked in `/simulasi/kuiz` (not stored); the feedback modal was dismissed with "Nanti dulu".
- Test account: attempt 279 (Sains Kertas 2, paper 292) created and **submitted**; attempt 280 (Sains Kertas 1, paper 276) created and left unsubmitted with no answers; one self-mark input edited 0 -> 1 (client only, not persisted). Side effect: streak pill "1 hari"; history holds 1 session.
- "Mula Semula", "Cuba Lagi", profile, shop and feedback were not touched.

**New system:** the walks created local mock attempts left in the lane-2 browser storage (Mat K1 0/10, Mat K2 0/21, Sejarah 2/19, plus unsubmitted Latihan attempts for Sejarah K2 and a generated Sains K2). No code files changed.

Screenshots are local only and git-ignored (the user chose no images for cloud). Names are cited as local references:
- `D:\Dev Projects\prestasiplus\.playwright-mcp\lane2\audit-keypad\` (`kp-*.png`)
- `...\lane2\audit-student-new\` (`new-<ref>-<w>-<theme>.png`)
- `...\lane3\audit-student-old\` (`old-<ref>-<w>.png`)
- `...\lane1\audit-student-old2\` (`old2-<ref>-<w>.png`)
- Naming caveat from the new walk: in a few single shots the "-dark" suffix was written while the app was light (`new-S2k2-375-dark.png`), and `new-S2sej-q1-1036-light.png` and `new-S6sej-1036-light.png` are actually dark.

## 2. User notes

| Date | Source | Note |
|---|---|---|
| 2026-10-24 | The user (BM) | "kaedah jawapan di sistem lama pun tak bagus yang subjektif. yang baru ni dah bagus terutama yang matematik tu. tapi button macam calculator atau math operations tu kena susun bagi elok la" |
| 2026-10-24 | The user | Confirmed: this is the **student** answer keypad, not the admin "Sisip matematik" button. Desired direction: "buat gaya ala2 scientific calculator. jenis casio tu... student biasa guna tu" |

Interpretation recorded in `STUDENT-SCOPE-NOTES.md`: the old subjective answering method is poor; the new one is good, especially for mathematics; the keypad should be arranged like the Casio-style scientific calculator students use.

## 3. Executive summary

| # | Fact | Evidence |
|---|---|---|
| 1 | Student rows (9): **Built 5** (S1, S4, S6, E1, E2) / **Partial 4** (S2, S3, S5, H1) / **Missing 0**. The walks changed no label. S4's 60 s rule was UNVERIFIED in the parity file and is now observed on both sides. | Observed/Code |
| 2 | The old exam answer is entered in 2-row textareas (42 of 57 fields on Sains Kertas 2), 7 numeric inputs, 8 short-text inputs and 2 choose-N checkboxes. There is no math input, keypad, working area, symbol bar, drawing, table-fill or photo upload. | Observed (both old accounts) |
| 3 | The new exam answer controls reachable in seeded papers: MCQ, working steps (math field + keypad + final answer + unit + photo), numeric, short_text, match_letter, essay. `drawing` and `table_fill` exist only in code; no seeded student paper contains them. | Observed/Code |
| 4 | Math keypad: 35 keys in a fixed 5x7 grid; the digits are scattered across rows; no AC, (−), ×10ˣ, Ans, trig, log/ln, e or degree keys. Comparison with the Casio layout is from general knowledge, not device-checked. | Observed/Code |
| 5 | New, critical: below 1024 px the sticky strip renders a text stimulus (Sejarah "Bahan 1") one syllable per line in a 48 px slot (lead-verified, `new-S2sej-375-light.png`). "Hantar" is not reachable on phones until the last question. No page-level horizontal scroll at any width. | Observed |
| 6 | Semakan: new has no self-mark, "Mohon semakan guru", "Disahkan" or "Lapor Soalan". Old Semakan has "Markah kendiri" plain number inputs that do not persist (no network request, reload resets). | Observed |
| 7 | History: the shared M06 `/spm/history` has no Bijak rows in new (4 rows unchanged after 3 submissions). In old, a Bijak attempt appears on `/spm/history` labelled "Tahun Lepas". | Observed |
| 8 | Old Hantar uses a native browser confirm "Hantar jawapan anda sekarang?" with no unanswered count; new shows a dialog with "Belum dijawab: n soalan" and "Ditanda: n soalan". | Observed |

## 4. Screen matrix

Coverage labels follow the parity file; every CONFIRMED/CORRECTED from the walks is applied. "Mod Pelajar" = old entered through the admin account (limited: role-gated routes redirect the admin).

| Ref | Old screen (Observed via test account / Mod Pelajar / Doc) | New screen | Coverage | Gaps | Intended by v2 docs? | Evidence |
|---|---|---|---|---|---|---|
| S1 | `/simulasi` (Mod Pelajar). Title "Simulasi Peperiksaan"; subheading "Duduki kertas SPM dalam format kertas sebenar — jawab, tanda automatik setiap halaman" (stale copy confirmed). Groups by subject with header "{n} set · {CODE}" (Bahasa Inggeris 11, Geografi 10, Perniagaan 10, Sejarah 6, Bahasa Melayu 5, Ekonomi 5, Kimia 5, Prinsip Perakaunan 5, Matematik 4, Sains 4, Fizik 4; 69 cards). Card: title ("Set N" for tracking sets), badge "TRACKING A" on composites, "Kertas k" (only some), "{m} markah", "{d} min" (only some), "Mula". No filter, search, status or best score. Oddities: a card "Geografi Simulasi Penuh — Hybrid Pilot (draf)" (140 markah) visible to students; two cards titled "Geografi Simulasi Penuh Set 3"; BM Kertas 1 Set 2 and 3 lack the Kertas label | `/spm/bijak`: back link "Mod SPM", button "Sejarah Bijak SPM", hero "Mula kertas" / "Sambung kertas", tabs "Kertas Pilihan" / "Jana Kertas"; filters Subjek and Kertas, count "4 kertas" (Mat K1 Set A 10 markah 75 min; Mat K2 Set A 21, 150; Sains K2 Contoh Pendek 13, 60; Sejarah K2 Contoh Pendek 19, 90); status "Belum cuba" / "Sedang dijawab" / score; "Mula" / "Sambung" | Built | Jana Kertas for Sejarah K1/K2 shows "Belum ada kontrak untuk subjek dan kertas ini" with the button disabled; hero shows one paper only; empty copy not observable | Yes: R2 (+ status/filters); N-03 dropped | Old Observed; New Observed |
| S2 | `/simulasi/{paper}` (exam, attempt 278/279). Opening creates an attempt at once (no confirm, no instruction screen). Student shell with a ~440 px paper column at 1036 and the question map as right rail (legend Dijawab / Ditanda / Belum); sticky bar with countdown timer, save-state span and "Hantar". Cover: "SULIT", code, "Sains", "SCI · Kertas 2", "150 minit"; no numbered instruction lines (present on Kertas 1: one paragraph); grid "Untuk Kegunaan Pemeriksa" (Bhg/Soalan/Penuh/Diperoleh; Jumlah 80) with the Bhg cell for Bahagian C truncated to "(wajib)" and "satu)"; a blank bordered box under the Bahagian A header above Q1. Bahagian blocks "Bahagian A [20 markah]" with "Jawab semua soalan dalam bahagian ini. / Answer all questions in this section."; choose-N "Bahagian C — Soalan 12 atau 13 (pilih satu) [12 markah]" with "0 / 1 soalan dipilih" and checkbox "Pilih soalan ini untuk dijawab" on Q12/Q13 only. Printed-sheet paging: 7 sheets, "Halaman x daripada 7", "← Sebelum" / "Seterusnya →", last sheet "Hantar Jawapan" and "KERTAS PEPERIKSAAN TAMAT". Bilingual stems. Flag button title "Tanda soalan". Question map dots grouped per Bahagian. No shared-passage pinning seen (stimuli inline). No reference panels | Cover `/spm/bijak/kertas/:paperId` then attempt `/spm/bijak/percubaan/:attemptId`: hero "SULIT · 1449/2" etc., "Arahan" numbered list, per-Bahagian lines, foldable "Rumus (ringkas)" (maths only), "Pilih mod" radio cards "Mod Peperiksaan — Bermasa, tiada markah segera. Skema pemarkahan dipaparkan selepas Hantar." and "Mod Latihan — Satu soalan pada satu masa dengan Semak dan maklum balas segera."; attempt shell with exit X, progress bar, streak flame, mode badge, "Menyimpan…" / "Disimpan", timer pill; at 1024+ three columns (pinned stimulus, question, "Peta soalan" panel), footer "Soalan 1 / 6", "Seterusnya", "Hantar" | Partial | Answer controls: see section 5 (7 kinds in code; 6 reachable). Peta is a permanent column at 1024+ and a bottom sheet below; "Hantar" hidden below 768 until the last question; T-5 warning and "Gagal simpan" not triggered (Code only). Printed-sheet paging, SULIT skin, examiner grid and document Bahagian are dropped by design | Yes: R16, R17, R21, R24 | Old Observed; New Observed + Code |
| S3 | Semakan `/simulasi/percubaan/279/semakan` (test account). Sticky bar "Dihantar", "0 / 80", "Cuba Lagi"; same cover/grid with "Diperoleh" cells empty; per sub-part "SKEMA PEMARKAHAN · {n} MARKAH"; auto-graded short/numeric parts: "Jawapan diterima: {answers}" + chip "✗ Salah (0/1)"; essay parts: scheme points, "Cadangan automatik (kata kunci): 0 / 1 — 0/4 isi dikesan. Sila semak & laraskan." then "Markah kendiri: [number input] / {max}" (42 plain native number inputs, min 0, step 1; **no network request on change, header total unchanged, value back to 0 after reload**); student answers re-rendered in editable fields (0 of 57 read-only); no band-rubric radios in this paper; no "Mohon semakan" or "Lapor"; console 404 for one skema image (`/storage/exam-media/sains-k2-2025-skema-s09d.png`); no link to the semakan from the `/simulasi` cards | `/spm/bijak/percubaan/:attemptId/keputusan`, title "Semakan Bijak SPM": hero "Teruskan, Pelajar!" + "Awak dapat 0/21 markah." ("(sementara)" when pending), score ring, "+0 Mata" / "+0 Koin", "Kongsi", "Kembali ke Home", "Cuba lagi", link "Sejarah Bijak SPM"; banner "1 bahagian belum dimarkah — perlu semakan"; "Markah mengikut bahagian"; "Soalan yang dikira"; "Topik untuk disemak" (plain text); tabs "Semua soalan" / "Perlu perhatian"; per question collapsed row with verdict chips (Betul / Salah / Separa / Tiada jawapan), "Jalan kerja anda", "Jawapan betul", points "Diperoleh:" / "Tidak diperoleh:" with codes, "Skema Pemarkahan · n markah"; essay "Belum dimarkah — perlu semakan" with band lines Cemerlang (9–10) / Baik (6–8) / Sederhana (3–5) / Lemah (1–2) and "Guru mengesahkan band; markah tidak diberi secara automatik." | Partial | Absent in new (full-text and DOM search): "Markah kendiri", self-mark stepper/radios, "Mohon semakan guru", "Disahkan", "Lapor Soalan". Old self-mark exists in the UI but does not persist and does not change the score | Yes: US-16, US-19 (Should); AC-14.x (Must, mostly met) | Old Observed; New Observed |
| S4 | Reopening the paper: title "Sambung Percubaan"; "Percubaan belum dihantar"; "Anda mempunyai percubaan SAINS Kertas 2 yang masih berjalan."; "Masa berlalu setakat ini: 02:04"; link "Sambung — teruskan jawapan & masa sedia ada" (`?sambung=1`); button "Mula Semula — kosongkan jawapan & masa"; footnote "“Sambung” mengekalkan semua jawapan anda. “Mula Semula” tidak boleh diundur." Test account: reload at ~64 s went straight back into the paper; reload at ~97 s showed the screen (threshold between 64 and 97 s); "Sambung" restored all 3 values from the server and the timer continued (148:11). Admin account: saves failed so fields were empty after Sambung while map dots still showed answered | Resume block on the cover: same copy; dialog "Mula semula?" / "Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?" with "Batal" / "Mula Semula". **60 s rule observed**: at ~25 s the hero said "Sambung" with no block and the mode chooser still showed; at ~75 s the block appeared and the mode chooser was gone | Built | At 375 the block buttons wrap to 2-3 lines, "Mula Semula" runs under the bottom nav, and the floating AI button overlaps the right edge | Yes: R20 | Old Observed; New Observed |
| S5 | `/simulasi/kuiz` (Mod Pelajar): h1 "Simulasi — Kuiz"; "Soalan 1 daripada 20"; count-up timer "Masa"; card with subject and "1 markah"; stimulus label "PETIKAN"; options A-D; "✓ Semak Jawapan" disabled until an option is picked; after a pick: correct option marked, chosen marked, "😟 Salah", "Soalan Seterusnya →"; "↻ Cuba Lagi" (`/simulasi/kuiz?count=20`) and "Kertas penuh" (`/simulasi`) present. No count/subject selector UI (count via `?count=`). Nothing stored | Jana Kertas tab -> cover of the generated paper (for example `/spm/bijak/kertas/jana-sn-k2-2`, "Kertas Jana Sains Kertas 2 (#2)", 13 markah, 5 soalan; persists across reload) -> the user must choose "Mod Latihan" (default is Peperiksaan) -> "Mula" -> per-question "Semak" | Partial | No free MCQ drill; Jana Kertas does not open directly in Latihan; "Kertas tidak dapat dijana kerana soalan tidak mencukupi." not triggered (Code only). Semak shows the full scheme and then disables the inputs | Yes: R5; AC-01.1; D32(a) | Old Observed; New Observed |
| S6 | `/simulasi/292/kuiz` (Mod Pelajar): title "Kuiz — SAINS Kertas 2"; "Sains · Kertas 2 · Bahagian A (1/4)"; 19 textareas, no MCQ or inputs; "← Sebelum" / "Seterusnya →". Not answered | Latihan on a Kertas Pilihan: attempt stored; written answers stored and marked; Semak locks the inputs (Sejarah K2: "Separa betul / Markah anda: 1 / 6."); dialog "Selesai latihan?" with unanswered count; elapsed timer counts up | Built | None beyond S5 | Yes: R5; N-05 fixed by design | Old Observed; New Observed |
| H1 | `/spm/history` (test account): h1 "Sejarah Kuiz SPM", "Kembali ke Mod SPM"; tiles Sesi Kuiz 1 / Purata Ketepatan 0% / Jumlah Syiling 0 / Soalan Dijawab 80; filters Semua / Tahun Lepas / Latih Tubi / Tracking A (no Bijak filter). The Bijak attempt shows as a card row: badge "0%" (red, no grade letter), mode label **"Tahun Lepas"**, "0/80 betul", "23 Oct 2026, 08:03 PM · 1m 56s · Sains", "+0"; not a link. "Soalan Dijawab 80" equals the marks total although 3 fields were answered | `/spm/bijak/sejarah`: tiles "2 Percubaan", "0% Purata", "0 Koin"; rows with date/time, badges "Bijak SPM", "Matematik Kertas 1", "Kertas Pilihan", "Mod Peperiksaan", "Dihantar", score "0 / 10", button "Semakan"; no grade letter. Shared `/spm/history` ("Sejarah Kuiz SPM"): 4 seeded rows unchanged after 3 Bijak submissions, no Bijak filter; the hub tile "Prestasi SPM Anda" (4 sessions) also unchanged | Partial | Shared history carries no Bijak rows; "Sambung" for in-progress attempts and statuses "Dihantar automatik" / "Ditinggalkan" not observed | Yes: AC-18.1-18.4; Q-B5; R22 | Old Observed; New Observed |
| E1 | Hub `/spm` and `/pelajar/spm` (test account; the admin account is redirected): badge "MOD SPM", h1 "Persediaan SPM", tiles 408,197 Jumlah Soalan / 31 Subjek SPM / 0 Tahun Tersedia / 1,744 Soalan Tracking A; four cards (Databank Soalan, Tracking A, Subjektif, Bijak SPM); Bijak SPM card: title, subtitle "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema.", pill "69 set", "Mula →", whole card is the link; "Prestasi SPM Anda"; link "Sejarah Kuiz SPM". The student dashboard `/pelajar` has no "Bijak SPM" text. At 1036 a floating chat bubble overlaps the Bijak card text | `/spm` "Persediaan SPM": badge "Baharu", hero "Bijak SPM" with the same subtitle, button "Buka" (to `/spm/bijak`); tiles 20,529 Jumlah Soalan / 25 Subjek SPM / "0 Tahun Tersedia" / 324 Soalan Tracking A; cards Databank Soalan / Latih Tubi SPM / Tracking A / Subjektif; "Prestasi SPM Anda" (4 Sesi Kuiz, 65.4%, 70 Syiling, 94 Soalan) | Built | No "{n} set" count in new (old pill "69 set"); "0 Tahun Tersedia" appears on both sides | Yes: AC-01.1 | Old Observed; New Observed |
| E2 | Sidebar item "Simulasi Peperiksaan" with indigo pill "BARU" at `/simulasi`; the link has **no** title/tooltip attribute (the Doc tooltip text is not present). Sidebar section "SPM" also lists Headcount, Prestasi, Analitik Adaptif, Analisa Item, Kombo, Laporan Mingguan, Soalan Aku Salah, SPM Tahun Lepas, SPM Mock Exam (badge NEW) | Sidebar item "Bijak SPM" with badge "BARU" at `/spm/bijak`, below the "SPM" item; no tooltip on hover in the expanded sidebar (collapsed rail not tested) | Built | Label renamed by design | Yes: R1 / AC-01.1 | Old Observed; New Observed |

Counts: Built 5 (S1, S4, S6, E1, E2) · Partial 4 (S2, S3, S5, H1) · Missing 0.

## 5. Answering method, old vs new

**Widget by widget**

| Kind | Old (Observed, Sains Kertas 2 paper 292 unless noted) | New (Observed) |
|---|---|---|
| MCQ | Kertas 1 (paper 276): 40 radiogroups "Pilihan jawapan" with 4 option cards A-D (BM line + EN line, concatenated without a space/line break); `/simulasi/kuiz`: option buttons | Group of 4 toggle buttons "A/B/C/D" + option text (`aria-pressed`, 52 px high, full width; not `role=radio`); selected = pale blue row + solid blue letter chip; math options render KaTeX |
| Structured / working | 42 `TEXTAREA` (aria "Jawapan esei", placeholder "Tulis jawapan anda di sini…", 2 rows about 96 px, live counter "N patah perkataan" under every one including 1-mark one-word parts) | Step input (placeholder "cth. 2x + 6") + keypad button ("Buka papan kekunci matematik", 44x52) + live KaTeX "Pratonton" + "Tambah langkah", "Jawapan akhir" input (placeholder "cth. 13") + keypad button, "Unit" input (placeholder "cth. cm"), "Ambil gambar jalan kerja" (file input, image jpeg/png, capture environment, multiple); inputs 40 px high |
| Numeric | 7 `INPUT` (inputmode decimal, aria "Jawapan berangka", placeholder "cth. 3.14…") | "Jawapan akhir" input + keypad button (+ "Unit" when the scheme has a unit); inputmode text; accepted "68ab" (stored; result "Salah") |
| Short text | 8 `INPUT` (aria "Jawapan", "Tulis jawapan…") | Textarea placeholder "Tulis jawapan…" (92 px), label "Jawapan (a)"; one per sub-part; keyword auto-marking ("Isi dikesan"); no word count |
| Choose-N | 2 checkboxes "Pilih soalan ini untuk dijawab" + counter "0 / 1 soalan dipilih" | Checkbox "Pilih soalan ini untuk dijawab" (24 px) + counter "{c} / {n} soalan dipilih"; once the cap is reached the other checkbox is disabled with no message |
| Matching | not present | `match_letter`: per sub-part a vertical list of 5 full-width buttons "A — 1946" … "E — 1963" (52 px); 15 stacked buttons for 3 sub-parts; selected = inverted dark button, no check icon |
| Essay | 2-row textarea like the others | Large textarea (212 px) "Tulis jawapan anda di sini…", hint "Jawapan anda (100 hingga 200 patah perkataan).", live counter "12 patah perkataan · sasaran 100–200. Guru akan menilai esei ini mengikut band." |
| Drawing / graph | not present in the paper (Code lists graph_plot, draw_on_diagram; not observed) | `drawing` photo flow and `table_fill` stub exist in code only (`PartInput.vue:135-148`); no seeded student paper contains them |
| Math input / keypad / working area / symbol or unit toolbar / photo upload | **None** | Working steps + math field + keypad + unit + photo (see section 6) |

**Subjective-answer problems, old (Observed)**
1. Each sub-part is a tiny 2-row textarea (about 96 px, native resize grip, no auto-grow) with no working or scratch area, no photo/handwriting upload, no symbol/unit toolbar.
2. No math symbols; no equation tool anywhere.
3. Placeholder "cth. 3.14…" shown on parts that are not decimals (table-completion, "state the number of students").
4. A word counter under 1-mark one-word fields.
5. Question text wraps into a column of about 190-200 px beside the marks chip at 1036 and 375.
6. Save label appears only after typing; no per-part saved indicator.
7. Student answers are re-rendered in editable fields on the Semakan page (0 of 57 read-only).
8. A feedback modal "Maklum Balas Anda Penting" (NPS 0-10, three star rows, suggestion box, "Hantar Maklum Balas", "Nanti dulu") popped over the exam about 1 minute in on the admin account (it did not appear in about 3 minutes on the test account).

**Subjective-answer problems, new (Observed)**
1. Numeric field accepts any text (inputmode text; "68ab" stored).
2. The "Unit" placeholder "cth. cm" is shown for RM and m/s answers.
3. The live preview keeps the raw syntax (linear fraction `(7)/(3)^2√`), not a stacked fraction.
4. The keypad appears under the input and pushes content; on short phones its bottom rows go under the footer bar.
5. `match_letter` stacks 15 full-width buttons for three sub-parts; the table of letters/years is in the pinned stimulus, which is broken below 1024 (section 7).
6. Short-text history answers are plain textareas with no formatting help.
7. After "Semak" the whole scheme is shown and the inputs are disabled (a spoiler by design in Mod Latihan).
8. Photo upload flow (file picker) was not exercised.

## 6. Math keypad (new)

**Inventory (Code, `MathKeyboard.vue:24-60`; component `MathField.vue`; used only through `PartInput.vue` at the step line and "Jawapan akhir" field).** 35 keys on one page, no tabs, no shift/alt layer; `grid grid-cols-7 gap-1`, key `min-h-11`. Opened only by the keyboard-icon toggle per field (each MathField has its own state; two can be open at once), Esc closes; `inputmode` becomes `none` while the keypad is open. Key logic: insert at caret; backspace removes an empty `()` pair in one step; right steps over `)/(`.

| Row (Observed, identical at every width) | Keys |
|---|---|
| R1 | a/b (`()/()`), xⁿ (`^()`), x² (`^2`), √ (`√()`), π, ±, 7 |
| R2 | 8, 9, ×, ÷, ⌫, 4, 5 |
| R3 | 6, +, −, ◀, 1, 2, 3 |
| R4 | (, ), ▶, 0, ., x, y |
| R5 | =, <, >, ≤, ≥, %, `,` |

Tones: math keys primary-tinted, digits and action keys neutral. Not present: AC/clear-all, execute, Ans, trig, log/ln, e, degree sign, 10ˣ, x⁻¹, abs, mixed number, letters beyond x and y. The source order looks grouped for 6 columns, so with 7 columns rows break mid-group.

**Casio comparison.** From general knowledge of the fx-570MS/991MS and ClassWiz fx-570EX/991EX; **not checked on a device**; exact key positions vary slightly by model.

| Casio position | Casio key | Current v2 keypad | Note |
|---|---|---|---|
| Number block R1 | 7 8 9 DEL AC | 7 (R1 C7), 8 9 (R2 C1-2), ⌫ (R2 C5), AC none | Digits split across rows; no clear-all |
| Number block R2 | 4 5 6 × ÷ | 4 5 (R2 C6-7), 6 (R3 C1), × ÷ (R2 C3-4) | Split across rows |
| Number block R3 | 1 2 3 + − | 1 2 3 (R3 C5-7), + − (R3 C2-3) | Digits contiguous; operators not in one column |
| Number block R4 | 0 . ×10ˣ Ans = | 0 . (R4 C4-5); ×10ˣ none; Ans none; = (R5 C1, a character not "execute") | |
| Scientific rows | a b/c or ▯/▯, x², x^, √, x⁻¹, (−), ( ), log, ln, sin cos tan, hyp, °′″, ENG, RCL, M+ | a/b, x², xⁿ, √, ( ) present; x⁻¹, (−), log, ln, trig, hyp, °′″, ENG, RCL, M+ none | Casio has a distinct (−) and − |
| Shift/alpha layer | π, e, 10ˣ, eˣ, ∛, ˣ√, Abs, nPr nCr, Pol/Rec, A-F X Y M, SHIFT, ALPHA, 4-way cursor pad, MODE/SETUP, ON | π direct; x y only; ◀ ▶ only | v2 has no second layer; no up/down |
| v2 keys with no Casio counterpart | - | ± < > ≤ ≥ % `,` x y = | Inequality keys are not calculator keys |

**Sizes (Observed, Mod Peperiksaan, Mat K2 Soalan 1(a), kind working; lane 2)**

| Viewport | Keypad box (w x h) | Key size (w x h) | Page h-scroll | Notes |
|---|---|---|---|---|
| 320 | 281 x 292 | 40 x 52 | none | Key width at the 40 px threshold; keypad and its input do not both fit one 640 px screen |
| 375 | 336 x 292 | 42 x 52 | none | Sticky footer overlays the page bottom |
| 768 | 705 x 292 | 95 x 52 | none | Keys wide and flat; input, keypad and "Tambah langkah" visible together |
| 1024 | 391 x 292 | 50 x 52 | none | Confined to the middle column of the 3-column layout |
| 1036 (fit) | 396 x 292 | 51 x 52 | none | Keypad top at y=508 of 751; rows 4-5 hidden behind the sticky footer until scrolled (`kp-open-1036-light.png`) |
| 1280 | 498 x 292 | 65 x 52 | none | Small glyphs (xⁿ, √, π, =) relative to key size |

Dark theme: keypad background rgb(11,13,18); math keys blue on a dark-blue tint, digits white on grey; legible at all sizes (the blue-on-tint pair is the lowest contrast; contrast not computed).

**Problems (facts)**
1. Digits are scattered across rows (7 alone at the end of the top math row; 4 5 / 6 split; 0 mid row 4); no column alignment of digits or of + − × ÷ (Observed).
2. No AC, (−), ×10ˣ, Ans, trig, log/ln keys; no second layer (Code).
3. The keypad is inline, not docked: it pushes content down; on a phone the answer line scrolls out of view while using the lower rows (Observed).
4. At 1036 the bottom rows are under the sticky footer until the page is scrolled (`kp-open-1036-light.png`).
5. The KaTeX preview is below the 292 px keypad, so keys and preview are not visible together on small screens; fractions preview linearly `(7)/(3)`.
6. Key gap 4 px; math and digit colour groups interleave in the same rows.
7. At 375 with a stimulus strip: the "Lihat Rajah 1" strip is sticky at the top (68 px). When the user scrolls about 100-200 px to reach the lower keypad rows, the answer input slides under the strip and is partly or fully hidden. **Lead-verified from `kp-open-375-light.png`** (input top clipped by the strip). Not seen on questions without a stimulus strip (`new-kp-375x568-i0-light.png`, `new-kpoverlap-375x*-light.png`).
8. All targets are 52 px tall; width 40 px at 320 (not below 40); toggle 44x44.

## 7. Responsive and visual

**New (widths 320 / 375 / 768 / 1024 / 1280, light and dark; hub, cover, attempt, result, history, keypad cases).** Page-level horizontal scroll: none at any width on any screen (over 100 measurements).

| # | Screen | Width | Finding | Screenshots |
|---|---|---|---|---|
| 1 | Attempt with a text/passage stimulus (Sejarah Q1 "Bahan 1") | below 1024 (checked 320, 375, 768) | **CRITICAL.** The sticky strip "Lihat Bahan 1" renders the whole passage inside its 48 px (`w-12`) thumbnail slot: the passage wraps one syllable per line down a 48 px pill, the label "Lihat Bahan 1" is pushed out of view and the question is hidden below a very long scroll. The same strip with a figure (Rajah 1) renders correctly. The table stimulus (Bahan 2, match_letter) uses the same strip and was not screenshotted below 1024. **Lead-verified from `new-S2sej-375-light.png`** | new-S2sej-375-light.png, new-S2sej-768-light.png, new-S2sej-375-dark.png |
| 2 | Attempt with keypad open | 375 | See section 6 item 7 | kp-open-375-light.png |
| 3 | Attempt | 320 | Footer: "Seterusnya" right edge at 330 px (past 320), clipped by 10 px; the "Peta" label wraps to two lines ("Peta / 1/6") | new-S2k1-320-*.png, new-S2k2-320-dark.png |
| 4 | Attempt | below 768 | "Hantar" is not visible or reachable except on the last question (0x0 in the footer at 320-414; the Peta sheet has no Hantar) | new-S2petasheet-375-light.png |
| 5 | Attempt | 320 and 1036 | Title "Soalan 1 · berdasarkan Rajah 1" touches the "Tanda soalan" flag button at 320; at 1036 it wraps to three lines in the narrow middle column | new-S2k2-320-dark.png |
| 6 | Attempt | 1024-1280 | Peta current-question state is almost invisible (ring-inset ring-accented); the legend "Dijawab / Ditanda / Belum" has no colour swatches | new-S2k1stim-1036-light.png |
| 7 | Attempt | all | Tap targets under 40 px: checkbox "Pilih soalan ini untuk dijawab" 24 px; cover radio 16x16 (the whole card is the label); step/final/unit inputs 40 px; shell icon buttons "Cari…" and theme toggle 28x40 at 768+, logo link 99x32 at 1024+ (shell) | measured rects |
| 8 | Result, history, hub, cover | 320-768 | The AI floating button (56 px) and bottom nav (68 px) overlap content: the AI button covers the right edge of score text ("0 / 1") and of the resume block; the bottom nav hides the last button of the resume block until scrolled | new-S3b-375-light.png, new-S4-375-light.png, new-H1-375-light.png |
| 9 | Cover | 375 | Hero title text runs under the stacked-books icon | new-S4-375-light.png |
| 10 | Hub | 320-375 | No clipping found | new-S1-320-light.png |
| 11 | Dark mode | all | No unreadable text found in the samples viewed; the exam-shell dark passage card (near black on near black) has low surface separation; not every one of 100 shots was inspected | new-*-dark.png |
| 12 | Peta states | 1024-1280 | Answered = solid blue; current = `aria-current` + faint ring; current+answered shows the current style | new-S2k1stim-1036-light.png |

**Old (Observed).**
1. At 375 the question map stacks above the paper and the sticky bar (timer + Hantar) sits under the shell header, so the timer and "Hantar" are visible only at scroll 0 (admin and test accounts; `old2-S2-attempt-375`, `old2-S3-bar-375`).
2. At 1036 the paper column is about 440 px and the question text wraps into a column of about 190-200 px beside the marks chip.
3. A floating chat bubble overlaps the right-most hub card text at 1036 and a field edge at 375.
4. The feedback modal "Maklum Balas Anda Penting" interrupts the exam (admin account).
5. A blank bordered box renders under the Bahagian A header above Q1.
6. The cover grid label for Bahagian C is truncated to "(wajib)" and "satu)".
7. Header h1 reads "Dashboard" even on `/simulasi/kuiz`; the attempt header shows a truncated "Sains — K..." with sub "Simulasi Peperik...".
8. `/latihan-berstruktur/3986/jawab` shows doubled brackets "((a))" on a part label.
9. No horizontal scroll at 375 on the hub, attempt or history.

## 8. Behaviour and logic findings

**New (Observed)**
1. Choose-N: once the cap is reached the other checkbox is disabled without explanation. Typing an answer in an unchosen essay still counts it in "Dijawab" and in "Soalan yang dikira" at the result (Sejarah Q3 typed without ticking: the counter stayed "0 / 1" but the result counted Q3).
2. Mat K2: Q6 was chosen (counter 1/1) and flagged but not answered; the result marks "Soalan 5 Tidak dikira" and "Soalan 6 Tidak dikira" and shows "Soalan yang dikira: tiada".
3. The "Perlu perhatian" filter on the Sejarah result showed Q1-Q3 (Q4 "Tidak dikira" hidden); on the all-wrong Mat K2 result it kept all 6 including "Tidak dikira".
4. Numeric accepts any text (inputmode text; "68ab" stored).
5. Seed/content oddities: the Mat K1 cover Arahan says "Kertas ini mengandungi 40 soalan objektif." while the paper has 10 soalan / 10 markah; Mat K1 Q4 option text "x = 7.333333333333333" (unrounded float); the generated Sains K2 Bahagian A is three working questions with the same stem and different numbers; the unit placeholder "cth. cm" appears for RM and m/s answers; the hub tile "0 Tahun Tersedia" next to 20,529 questions.
6. Jana Kertas: Sejarah K1/K2 show "Belum ada kontrak untuk subjek dan kertas ini" and the button is disabled.
7. The Hantar dialog shows "Belum dijawab: n soalan" and "Ditanda: n soalan"; Mula Semula has a confirm dialog; "Mula" in the cover hero sits above the mode choice (the user scrolls down to choose the mode, then back up).
8. Autosave "Menyimpan…" then "Disimpan" in about 2-3 s.
9. The result win screen fills the first viewport at every width; the breakdown is below the fold.
10. The shared M06 history and hub tile do not change after Bijak submissions.

**Old (Observed)**
1. A draft paper "Geografi Simulasi Penuh — Hybrid Pilot (draf)" is visible to students; two cards share the title "Geografi Simulasi Penuh Set 3"; BM Kertas 1 Set 2 and 3 lack the Kertas label.
2. Opening a paper creates an attempt immediately (no confirm, no instruction screen); the admin account's autosave fails (PATCH 302 -> PATCH `/admin` 405).
3. Hantar uses a native browser confirm "Hantar jawapan anda sekarang?" with no unanswered count.
4. Semakan: skema image 404 (`/storage/exam-media/sains-k2-2025-skema-s09d.png`); "Markah kendiri" number inputs do not persist and do not affect the total; "Diperoleh" cells stay empty; student answers remain editable; no link to the semakan from the paper cards.
5. History: the Bijak attempt is labelled "Tahun Lepas"; "Soalan Dijawab 80" equals the marks total, not the number answered; the row is not a link; there is no Bijak filter.
6. The numeric placeholder "cth. 3.14…" appears on non-decimal parts; BM and EN MCQ stems are concatenated without a break.
7. Reloading the exam after 64 s goes straight back into the paper; after 97 s it shows the resume screen.

## 9. Unverified

| # | Item | Why |
|---|---|---|
| 1 | New: T-5 warning "Amaran: masa berbaki kurang 5 minit.", "Luar talian…", "Gagal simpan", auto-close on timeout | The timer cannot be advanced; Code only (`AttemptPage.vue:318-322,390`) |
| 2 | New: Jana Kertas shortage message "Kertas tidak dapat dijana kerana soalan tidak mencukupi." | Not triggered; all generable combinations worked |
| 3 | New: `drawing` and `table_fill` widgets | No seeded paper uses them |
| 4 | New: sidebar tooltip on the collapsed rail | Not tested |
| 5 | New: table stimulus (Bahan 2) below 1024 | Inferred from the same strip component |
| 6 | New: photo upload flow, History "Sambung" and statuses "Dihantar automatik" / "Ditinggalkan"; result after Latihan "Selesai" | Not exercised |
| 7 | New: dark-mode shots | Every file produced; only a sample inspected; no contrast numbers computed |
| 8 | New: whether the app top bar/sidebar is visible in the attempt after a resize to 768-1280 | Possible measurement artefact in the walk loop |
| 9 | Keypad: numeric-only leaf and Mod Latihan | Not opened by hand; inferred from `PartInput.vue:176` |
| 10 | Keypad: real touch input, the phone soft keyboard (`inputmode none`), the physical-keyboard friendly-notation path | Not tested |
| 11 | Keypad: contrast of blue-on-tint keys; 320/375/768 shots taken at heights 640/667/800 with CSS scale | Not computed / not real device sizes |
| 12 | Keypad: whether M05 latihan, kuiz or battle have another math input | Grep only (no references) |
| 13 | Casio layout | General knowledge; no device consulted; models differ slightly |
| 14 | Old: E1 and H1 and S3 via the admin account | Role-gated routes redirect the admin to `/admin`; observed only through the test account |
| 15 | Old: band-rubric radios on Semakan, "Mohon semakan", "Lapor" | None present in the paper tested (Sains Kertas 2); other papers not tested |
| 16 | Old: other answer types (graph_plot, draw_on_diagram, code, table_fill) | Not observed (one attempt per paper) |
| 17 | Old: Kertas 1 (paper 276) beyond the cover and the 40 radiogroups; "Flag" visual change; Mula Semula | Not answered / not clicked |
| 18 | Old: DISC §3.1-3.7 itself | Compared only through the parity file and the walk notes |

## 10. Next steps (procedural only)

1. The user reviews this report.
2. The user turns chosen gaps into FB items in `docs/qa/audit-sistem/screens/S-<nnn>-*.md`.
3. Cloud acts only on FB items the user has approved.
4. The user deletes the test student account (user id 7576).
