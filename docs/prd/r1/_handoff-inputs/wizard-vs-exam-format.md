# Wizard vs real exam-paper format (R1 PRD) - read-only verification

Date 2026-11-04. PRD read: 30-admin-pusat (0, 4.0 QE-01..08, Q-04/07/15/16/17/18/23, 4.G), 50-data-model-erd (2.3, 2.4, 4.1-4.3), 60-api-contract 4.1/4.2, 10-murid 4.6/4.8, plan S8; plus docs/requirements/v2-exam-schema.md (D1-D10), which the PRD adopts by reference.
Ground truth: the 24 PDFs in D:\prestasiplus-dskp\sampel-percubaan, rendered to images with pdf.js (scratchpad\fields\tmp\img) and viewed. Most are scans. Text layer exists for Matematik K1/K2 + skema, Mat Tambahan skema, Fizik K2 skema, BI P1 skema.
Method limit: I viewed the key pages of each paper (covers, every Bahagian type, stimulus pages, skema notation), not every page. Support scale: S = Supported, P = Partial, N = Not supported.

## 0. Headline

Data model and entry standard cover most STRUCTURE (sections, choose-N, stimulus groups of 1-3 stimuli, part trees, MCQ, option bank, essay with word range, working). The PRD does NOT specify the entry UI for what makes a real paper faithful: the per-mode leaf form, the marking-scheme editor, part-level stimulus picking, BM+EN bilingual text, rich-text formatting needed by BM/BI. Drawing and table-fill are P2 and not served to pupils at release. Objective papers (K1/P1) are close to faithful; structured papers are not.

## 1. Real structure per paper (extracted, viewed)

| Paper | Code / time | Sections and rules | Item types / stimulus | Marks / scheme |
|---|---|---|---|---|
| BM K1 | 1103/1, 2 jam (p.1) | A [30] "Soalan ini mesti dijawab" (p.2); B [70] 4 questions "Jawab satu soalan" (p.3) | A: two e-mails as stimuli, answer ONE of the two inside the single compulsory question, 150-200 words. B: 4 passage boxes with "Sumber:", 350-500 words | Score-band table: Peringkat / Markah with sub-bands (26-30, 28-30, 26-27) x criteria Tema, Idea, Bahasa, Pengolahan (skema p.3) |
| BM K2 | 1103/2 (p.2-11) | A Sistem dan Aplikasi Bahasa [35]; B Pemahaman [35]; Q9 rumusan | Q1 passage, two tasks in one 8-mark prompt; Q2 passage with underlined sentences; Q3 infographic "Bahan 1" + text; Q4 passage with a struck-out word; Q6/Q7 "Bahan 1, 2, 3" (prose, two-column poem, extract) with sub-parts (i)-(iv) citing "Bahan 2" or "semua bahan"; Q9 max 120 words | Per-question "Perhatian" list (10 rules: copying = 0, minus 1 per spelling/punctuation error over the whole answer); lists of accepted alternatives; Peristiwa/Huraian pairs; "Peristiwa lain boleh diterima sekiranya sesuai" (skema p.2, p.10) |
| BI P1 | 1119/1 (p.2-13) | Parts 1-5 | Part 1 MCQ with 3 options, each with its own stimulus. Part 2 cloze, 10 gaps, per-gap 4 options in a grid, worked example "0". Part 3 one passage, 8 MCQ. Part 4 article with 6 gaps, bank A-H of full sentences, 2 distractors. Part 5 texts A-F with pictures as the bank, statements 33-36 matched to a letter; Q37-40 summary text with inline gaps, "no more than one word" | Key table; one-word answers; skema numbering typo (32 twice) |
| BI P2 | 1119/2 (p.2-6) | Part 1 [20] compulsory; Part 2 [20] compulsory; Part 3 [20] three questions "answer one" separated by OR | E-mail with pre-printed To/Subject frame, 80 words; story/article/review 200-250 words; question numbers continue across Parts | Content points C1..C4 with conditions (not related -> no C2; accepted "10.00 pm", NOT accepted "before midnight"; "minor omission"); answer sheet grid C/CA/O/L each /5 = 20 |
| Fizik K1 | 4531/1 (p.6) | 40 MCQ | Multi-panel composite Rajah; every stem and option bilingual BM+EN | Key table (skema image) |
| Fizik K2 | 4531/2, 29 pp (p.2,3,5,9,22,26) | A all; B answer one of two; C one question; 20 marks per B/C question | Formula pages; Rajah as nuclear-equation box; "Diberi:" data block in a part; part-level Rajah 10 / Jadual 10 with bilingual headers; every prompt and "[n markah]" bilingual | M1..Mn per point, "Gantian yang betul", "Jawapan dengan unit yang betul", "JUMLAH n"; 10-mark parts as Ciri/Sebab pairs + "S" + "[Semua ciri dinyatakan betul]"; "Maks 4", "Maks 10" caps; "* terima sebarang bahan" |
| Sejarah K1 | 1249/1 (p.4) | 40 MCQ | Item-level source box with "Sumber:"; Roman-numeral statement-combination item (Q8) | Key + textbook ref per answer "B3T4 M56", ranges "M44-45" (skema p.2) |
| Sejarah K2 | 1249/2 (p.2,4,8,9) | A [40] semua; B [60] "Jawab tiga soalan sahaja" (5 of 20) | Q2 photograph with "Sumber:"; (a) with two answer lines i/ii for [2 markah]; B(c) quoted source with URL and date as part-level stimulus | F1..Fn facts "mana-mana N x 1 m"; Aras 1-4 bands (1-2, 3-4, 5-6, 7-8) with descriptors + content bank (Maklumat, Kebaikan) + Panduan Penandaan caps ("kebaikan sahaja - maksimum 4") (skema p.9) |
| Matematik K1 (Johor) | 1449/1, 90 min | 40 MCQ, "Jawab semua soalan" | Bilingual stems; Rajah per item; options as figures (Q12); maths in options; formula pages | Key table. Pattern doc 10.2: another body's Q1 accepts two options |
| Matematik K2 (Johor) | 1449/2 | A [40] semua; B semua; C "dua soalan. Jawab satu soalan" | Draw a diagonal on a printed Rajah (Q1), draw a line on a printed graph (Q2), sketch graph (Q3a), Venn drawing (Q11), shade region (Q12), complete Jadual 4.2 (Q14), fill blank with "sebilangan/semua" (Q4a), Benar/Salah (Q4b); Rajah 5 and 6 in different sub-parts (Q9); two tables (Q13) | Plain marks per line, "Mana-mana", "atau setara", "ATAU", "Nota"; scheme holds model drawings as images |
| Mat Tambahan K1/K2 | 3472/1, 3472/2 (p.3,11,13,15) | K2: A semua [50], B jawab tiga, C jawab dua | Bilingual; bilingual table headers; Q10: Jadual 1.1 given, fill Jadual 1.2, plot xy vs x^2 at stated scale, draw best-fit line, then read values from the pupil's OWN graph | K1/N1/P1, "@", "&", "//", "OR", "Alternatif A/B", "dilihat", "Mesti tunjuk operasi", "P2,1,0" (text layer) |

## 2. Feature matrices per subject (PRD refs: QE = 4.0, Q = screen, G = 4.G, DM/ERD = 50, API = 60, MUR = 10, ES = exam schema)

### 2.1 Bahasa Melayu

| Feature | Example | PRD support | Gap |
|---|---|---|---|
| Section "mesti dijawab" | K1 A | S in data (`compulsory`, ES D5, API); Q-16 control lists only Tiada/Jawab Semua/Pilih N | G-10 |
| Choose 1 of 4 | K1 B | S: `Pilih N` (Q-14/Q-16) | none |
| Two stimuli, answer one inside ONE question | K1 A | P: ES `alternatives[]`; no wizard field, no ERD column | G-01b |
| Word range | 150-200, 350-500, 120 | P: ES `word_range`; no ERD/API/wizard field | G-02 |
| Band rubric with sub-bands per section | K1 A 30 / B 70 | P: ES D4.5; no editor spec | G-01 |
| "Sumber:" / Dipetik daripada | K1 B, K2 | P: API `sourceCitation` yes; ERD Stimulus has no column | G-12 |
| Underline, strike-through, bold, italic in passages | K2 Q1, Q2, Q4 | N: toolbar is B, I, lists, code, table, math | G-05 |
| Poem, two columns, stanzas | K2 Q7 | P: line-break/column fidelity unspecified | G-05 |
| Infographic image | K2 Q3 | S | none |
| Bahan 1-3 with sub-parts citing a specific bahan or "semua bahan" | K2 Q6, Q7 | P: group of 1-3 stimuli S; per-part reference not in wizard | G-04 |
| One 8-mark prompt, two tasks | K2 Q1 | P: one leaf; scheme groups needed | G-01 |
| Question-level rules (copy = 0, minus 1 per error over whole answer) | K2 skema | P: ES D4.3 deductions are per part | G-01 |
| Cover code, duration, instructions | 1103/1 | S: Q-15 | none |
Verdict: NO (G-01, G-02, G-05).

### 2.2 Bahasa Inggeris

| Feature | Example | PRD support | Gap |
|---|---|---|---|
| MCQ with 3 options | P1 Part 1 | S (AC-ADM-QE3.2: 3 to 8) | none |
| One stimulus per MCQ (dialogue, advert, news + photo) | Q3, Q4, Q8 | S: 1-member group (DM-03, QE2.4) | none |
| One passage, 8 questions | Part 3 | S | none |
| Cloze, 10 gaps, per-gap options, worked example 0 | Part 2 | P: 10 MCQ over one passage group; example = 0-mark leaf; ES dropped `cloze`; no inline gap widget | G-08 |
| Bank A-H of sentences + distractors | Part 4 | P: ES `option_bank`, API `optionBank {label, body}`, AC-ADM-G6.3; ERD `StimulusGroupOption` has no body column | G-09 |
| Bank = the stimulus texts A-F with pictures | Part 5 Q33-36 | P: images in bank body not stated | G-09 |
| Inline gaps in a separate summary, one word max | Q37-40 | P: `short_text`; gap-to-leaf link only by typed number; word cap not representable | G-08 |
| Compulsory; choose 1 of 3 with OR; numbering continues over Parts | P2 | P: `Pilih N` S, compulsory control missing | G-10 |
| Pre-printed To/Subject frame | P2 Q1 | N | G-11 |
| Content points with requires, accepted AND not-accepted values, "minor omission" | P2 skema | P: `requires`, `accept[]`; no `reject[]`, no partial tier | G-01 |
| Language grid C/CA/O/L each /5 | P2 sheet | P: single holistic band only | G-03 |
Verdict: P1 YES with doc fixes (G-09); P2 NO (G-03, G-01, G-11, G-02). Overall NO.

### 2.3 Fizik

| Feature | Example | PRD support | Gap |
|---|---|---|---|
| Composite figure MCQ, bilingual options | K1 Q4 | P: figure S; bilingual N | G-07 |
| Bilingual BM+EN prompts and "[1 markah] [1 mark]" | all K2 | N in R1: ERD has only `stem_ms`, `body_ms`; API `questionText: string`; ES D8 `ms+en` not carried into PRD; wizard has no EN field | G-07 |
| Formula pages | K2 p.2-3 | S: Q-15 `Bahan rujukan (kulit kertas)` | none |
| Part-level Rajah/Jadual | (c), (d) | P: `question_parts.stimulus_id` exists; no wizard control | G-04 |
| "Diberi:" block, nuclear equation | Q1, Q2 | S: rich text/LaTeX | none |
| A all / B choose 1 / C | rules | S: ES D5; blueprint 4531-2.json (C incomplete) | G-10 |
| Working with unit mark | 2(b), 9(c) | S/P: `working` + points | G-01 |
| Ciri/Sebab pair table + S + "all correct" bonus, "Maks N" | 9(d), 11(d) | P: `requires` is a single id; groups any_n OK; bonus and pair not | G-01 |
| Draw/complete on diagram | ES lists | N at release (P2, not served) | G-13 |
Verdict: K1 YES except bilingual; K2 NO. Overall NO.

### 2.4 Matematik

| Feature | Example | PRD support | Gap |
|---|---|---|---|
| Bilingual stems | all | N | G-07 |
| Option as figure; maths in options | K1 Q12, Q7 | S (`optionImageFileIds`, math) | none |
| Key accepting two options | other body K1 Q1 | N: exactly one correct (AC-ADM-QE3.2) | G-14 |
| C jawab satu of 2 | K2 | S: AC-ADM-G6.1 | none |
| Draw on printed Rajah/graph, sketch, Venn, shade | Q1, Q2, Q3, Q11, Q12 | N at release | G-13 |
| Complete table; fill blank from two words; Benar | Q14, Q4 | table_fill P2 (G-13); short answer S | G-13 |
| Different stimuli per sub-part | Q9, Q14 | P | G-04 |
| Two tables in a question | Q13 | S: group up to 3 | none |
| Scheme "atau setara", "ATAU", "Mana-mana", Nota; model drawings | skema | P: paths/accept S; image in `model_text` not stated | G-01 |
Verdict: K1 YES except bilingual/2-key; K2 NO.

### 2.5 Matematik Tambahan

| Feature | Example | PRD support | Gap |
|---|---|---|---|
| A all / B choose 3 / C choose 2 | K2 | S: ES D5, blueprint 3472-2.json | none |
| Bilingual prompts, tables | all | N | G-07 |
| Fill table -> plot at stated scale -> best-fit line -> read from own graph | Q10 | N at release; dependent part unsupported | G-13, G-15 |
| K1/N1/P1, @, &, //, OR, Alternatif A/B, dilihat, "P2,1,0", "Mesti tunjuk operasi" | skema | P: ES D4 covers most; count-based marks and carried values not | G-01 |
| Table used by (a) and (b) | Q13 | S | none |
Verdict: NO for K2 and graph items; K1 text items YES except bilingual.

### 2.6 Sejarah

| Feature | Example | PRD support | Gap |
|---|---|---|---|
| Source box with "Sumber:" | K1 Q7, K2 Q2 | S/P: ERD column missing | G-12 |
| Statement-combination MCQ (I-IV; "I dan II") | K1 Q8 | S: rich-text list + options | none |
| Textbook ref per answer | K1 skema | P: only in 4.G.1 text; not in ERD/API/wizard | G-12 |
| A all, B choose 3 of 5 | K2 | S | none |
| (a) with two answer lines for [2 markah] | Q2(a) | S: `short_text` + `blank_count` | none |
| Part-level source with URL/date | Q5(c) | P (wizard control missing) | G-04 |
| Aras 1-4 bands + content bank + category caps | skema p.9 | P: rubric + content_points; no cap | G-01 |
Verdict: K1 YES; K2 NO.

## 3. Cross-subject checks

### 3.1 DSKP metadata per item
Tingkatan, Subjek, Tajuk DSKP (unit), SP 1-3, TP 1-6 per leaf, aras per leaf, KBAT derived, Kesukaran 1-5, Kertas, Bahagian (`section_label`, DM-07), marks, Bab (QE-03, QE-04, 4.2.1): S. Doc inconsistency: API 4.1 `kertas: '1'|'2'|'3'` while DM-08 makes it 1..4 (G-16).

### 3.2 JSU / blueprint
A blueprint (sections with rule, question_count, mark_budget, unit quota, TP profile, KBAT quota, allowed modes, evidence, verification; Q-16, ES D7, 4.G.4) is the JSU in machine form and validates a paper at Terbit (FR-ADM-Q15.1, Q16.2). Gaps: per-question marks list (`marks_per_question`, ES D5) is not in ERD BlueprintSection (G-17: Matematik K2 A has 3,3,3,5,4,... marks); only six reference blueprints exist, so BM, BI and Sejarah K1 contracts stay Spec/Draf (D95).

### 3.3 Entry path per test type
| Test type | Path in PRD | Serves real structures? |
|---|---|---|
| Bijak SPM Simulasi paper | Studio wizard or Muat Naik Kertas -> Semak Ekstrak -> Set Builder (Q-13..15) -> Terbit under Kontrak | Structure yes; limited by G-01..G-13 |
| Simulasi Kuiz | same papers, sections and Pilih N | same |
| Databank | Q-03 list; MCQ lane; groups served (D105) | MCQ and groups only |
| Tracking A | Q-17 selects existing questions; groups as units; no entry of its own | MCQ/short only |
| Subjektif, Kertas Subjektif | Q-18 (upload -> OCR -> edit -> Terbit), Q-23 | Full structured/essay set in principle; scheme editor unspecified (G-01); OCR gate E-05 |
| Latih Tubi, Soalan by Chapter | Studio MCQ with Bab (QE4.5) | MCQ |
| Teacher Set Soalan | GUR-8b / GUR-44 tiles; teacher MCQ opens the Studio wizard (Q12.6) | MCQ; structured via tile without field-level spec |
| Permainan | draws approved MCQ (FD-MUR-27); no entry | MCQ |
| Kertas Peperiksaan (teacher) | R1-GUR-44e, P2, "no teacher page or API" | not at 1.0 |

### 3.4 Pupil display and marking (10-murid 4.6, 4.8; plan S8-T02..T05)
Supported at release: mcq, match_letter, short_text (equivalence), numeric, working, essay with self-mark (P1). Not supported: drawing, table_fill (P2); such a question is not served (4.6 item 6), so Matematik K2, Fizik K2, Mat Tambahan K2 cannot be sat in full. Not covered anywhere: bilingual stacked rendering, choose-one-prompt inside a question, per-criterion language grid, inline gap widgets, dependent-part marking (G-19).

## 4. Consolidated gaps with buildable fixes

### BLOCKER

**G-01 Marking-scheme editor is not specified (all subjects).** PRD only says "scheme (D4)". Add FR-ADM-QE9 "Editor skema" in Q-04 step `Sub-bahagian`, per leaf:
- Tabs `Jawapan` | `Skema pemarkahan`; chip "{n} markah skema / {m} markah bahagian", red when different; blocks `Hantar untuk semakan` with "Jumlah skema ({n}) mesti sama dengan markah bahagian ({m})."
- Key kind `points`: rows with `Kod` (K, N, P, B, M, F, C), `Label`, `Markah` (>= 0), `Teks pemarkahan` (rich text, bilingual per G-07), `Jawapan diterima (@)` (repeatable), `Mesti ada semua (&)` (repeatable), checkboxes `Dilihat` and `Boleh tersirat`, `Bergantung pada` (MULTI-select of points; replaces single `requires`), `Tidak diterima` (repeatable, NEW), `Unit` + `Unit wajib`, `Toleransi` (mutlak/relatif), `Angka bererti`, `Perpuluhan`, `Nota`.
- Group rules (`+ Kumpulan`): `Mana-mana N daripada M` with `Markah setiap satu`; `Markah maksimum kumpulan` (cap, NEW: "Maks 4", "kebaikan sahaja maksimum 4"); `Bonus jika semua betul` (checkbox + marks, NEW: "[Semua ciri dinyatakan betul]"); type `Pasangan (Ciri / Sebab)` where point B counts only if point A is hit.
- `+ Kaedah alternatif` (ATAU / Alternatif A, B): marker takes the best path.
- `Jawapan akhir` box (display, accepted, tolerance, unit) for working.
- `Mata mengikut bilangan betul` (NEW): `Bilangan item`, `Markah bagi n, n-1 ... 0 betul` (covers "P2,1,0").
- `Potongan` rows (spelling, unit, sf, dp, copy; amount; cap) and `Sifar markah jika` rows, allowed on part AND question level (BM K2 "Perhatian bagi Soalan 1"): store `question_versions.scheme_rules jsonb null`.
- `Jawapan model` rich text with images; `Panduan pemarkah / Kesilapan lazim` (staff only).
- Key kind `rubric`: `Mod pemarkahan` `Band keseluruhan` | `Markah setiap kriteria` (G-03); criteria (name, max marks); bands (name, range, optional sub-bands, descriptor per criterion); `Band minimum`; optional content points C1..Cn.
- Data/API: `answer_keys.content` versioned `scheme_v: 2` with the above; extend the zod `QuestionPart.key` union; `POST /api/questions/:id/parts/:partId/scheme/validate` returns issues in the `gate-check` shape. Gate: best-path reachable marks with caps = leaf marks; every `Bergantung pada` id exists; band ranges cover 0..marks.
- AC: Fizik 9(d) as 4 pairs + S + bonus totals 10; a point depending on a deleted point is refused "Mata {label} bergantung pada mata yang tiada."

**G-13 drawing and table_fill (P2) are needed by Matematik K2, Fizik K2, Mat Tambahan K2 and are not served at release.** Fix without a canvas, as P1: (1) wizard leaf `Lukisan / Graf`: `Jenis` (Graf | Rajah | Lakaran), `Templat jawapan` (image upload or graph-paper generator: x min/max, y min/max, step), `Senarai semak markah` (G-01 points). Leaf `Isi Jadual`: `Baris`, `Lajur`, grid editor with cell type `Tajuk` | `Diberi` | `Kosong`, key per blank (accepted, tolerance), gate "sekurang-kurangnya satu sel kosong". (2) Pupil: `Isi Jadual` renders inputs in blank cells; `Lukisan` shows the template with `Ambil gambar jawapan` / `Muat naik gambar` (<= 5 MB) and self-mark against the checklist. (3) Until built, `Terbit` is refused with "Bahagian {label} guna jenis jawapan yang belum tersedia untuk pelajar." instead of a silent drop. Data: `question_parts.answer_template jsonb null`.

**G-07 Bilingual (BM + English stacked) is absent from the R1 data model, API and wizard** (Matematik, Mat Tambahan, Fizik, Sains). Add `_en` twins: `question_versions.stem_en`, `question_parts.prompt_en`, `part_options.body_en`, `stimuli.body_en`, `stimuli.caption_en`, `stimulus_group_options.body_en`, scheme point `text_en`; `question_versions.language text not null default 'ms'` check in (ms, en, ms+en, ar, jawi) (ES D8). API: `RichTextBilingual = { ms?: RichText; en?: RichText }`; `questionText` stays for old consumers. Wizard field `Bahasa soalan` (`Bahasa Melayu`, `English`, `BM + English (dwibahasa)`); when dwibahasa every text field shows two stacked editors `BM` and `English`; validation "Teks English diperlukan untuk soalan dwibahasa." Pupil: stacked as printed, no toggle in R1.

### MAJOR

**G-02 Essay settings.** Fields for `Karangan / Respons Terbuka`: `Bilangan patah perkataan` min and max (min <= max), `Had keras` checkbox (default off), `Ruang jawapan` Pendek/Sederhana/Panjang. Data `question_parts.word_min`, `word_max smallint null`. Pupil counter "{n} / {min}-{max} patah perkataan".

**G-03 BI P2 language grid (marks per criterion).** Rubric mode `Markah setiap kriteria`: rows Content, Communicative Achievement, Organisation, Language, `Markah maksimum` 5 each, descriptors 0-5; total = leaf marks (20). Pupil: one stepper per criterion. API: `BijakAttemptSelfMarkRequest` gains `criteria?: { id: string; mark: number }[]`.

**G-04 Part-level stimulus and "which bahan".** Sub-bahagian row field `Rangsangan bahagian` (none | one of the group's stimuli | `Rangsangan baharu`). Validation: it must belong to the question's group or be its own. Prompts may cite "Bahan 2" by group label; the pupil panel opens the right stimulus for that leaf. AC: Sejarah 5(c) source only on (c); BM K2 Q6(ii) "semua bahan" shows all three.

**G-05 Rich-text formatting.** Toolbar adds `U` (garis bawah), `S` (garis tengah), `Baris puisi` (line-preserving block with stanza spacing), `Dua lajur`, `Kotak teks` (bordered box for "Sumber" boxes), `Penanda ruang kosong` (G-08). Sanitizer allow-list extended (u, s, box, columns). AC: BM K2 Q2 underlines and Q7 poem identical in preview and pupil view.

**G-08 Inline gaps.** Token `{{gap:N}}` in rich text; the wizard links gap N to leaf labelled N (cannot save an unlinked gap); pupil renders input or select in place (options from the leaf or group bank). Leaf flag `Maksimum perkataan` (int). Covers BI Parts 2, 4, 5 and fill-in items. Presentation only; no new mode.

**G-09 Option-bank body.** `stimulus_group_options` add `body`, `body_en`, `image_file_id`, `is_distractor`. Group screen section `Bank pilihan (A-H)` with `Huruf`, `Teks`, `Gambar`, `Pengganggu`. Gate: every key letter exists in the bank; `Padanan` leaves reference the bank, no copies.

**G-10 Section controls.** Q-15/Q-16 section row adds `Wajib dijawab` (maps `compulsory`), `Markah setiap soalan` (single or list), `Bilangan soalan dalam kertas`, free-text label (Bahagian/Part/Objektif) and a derived line "Jawab {n} daripada {m}".

**G-01b Choose-one-prompt inside a question (BM K1 A).** Essay leaf option `Pilih satu daripada {n} gesaan`: `alternatives[]` each with its own stimulus, reusing the rubric; button `+ Gesaan alternatif`; pupil picks one; marks counted once.

### MINOR
- G-11 Pre-filled answer frame (BI P2 To/Subject): leaf `Templat jawapan (pra-isi)`, not marked.
- G-12 `stimuli.source_citation text`; `question_versions.textbook_ref jsonb {bab, tingkatan, muka_surat, hingga?}`; wizard `Rujukan buku teks`; show "B3T4 M56" in the scheme panel.
- G-14 MCQ key with two accepted options: key `{correct: ["A"], accepted: ["A","D"]}` plus `Nota kunci`; AC-ADM-QE3.2 becomes "one or more ticks, more than one only with Nota kunci".
- G-15 Dependent parts (read from own graph): leaf flag `Bergantung pada jawapan bahagian` + point `ecf` (already in ES D4.2); checklist marking, no auto-mark.
- G-16 Doc consistency: API 4.1 `kertas` to '1'..'4'; ERD `StimulusGroupOption` columns.
- G-17 `blueprint_sections.marks_per_question jsonb`; JSU table export.
- G-18 Per-mode leaf form is not specified: add FR-ADM-QE3.8 listing fields per mode (mcq options 3-8, bilingual, image per option; match_letter bank; short_text accepted/any_order/blank_count/case; numeric value/tol/unit/decimals/sf; working points + final; essay G-02/G-01b/rubric; drawing/table G-13); store extras in `question_parts.mode_config jsonb`.
- G-19 Pupil side add-ons to S8-T02/T03/T05: bilingual rendering, alternatives picker, per-criterion self-mark, gap widgets.

## 5. Counts
Blocker 3 (G-01, G-07, G-13). Major 7 (G-02, G-03, G-04, G-05, G-08, G-09, G-10) + 1 (G-01b) = 8. Minor 8 (G-11 to G-19 minus none: G-11, G-12, G-14, G-15, G-16, G-17, G-18, G-19). Total 19.

## 6. Verdict per subject
| Subject | Paper 1 | Paper 2 | Overall |
|---|---|---|---|
| Bahasa Melayu | NO (G-01, G-02, G-01b) | NO (G-05, G-01) | NO |
| Bahasa Inggeris | YES with doc fixes (G-09) | NO (G-03, G-01, G-11, G-02) | NO |
| Fizik | YES except bilingual (G-07) | NO (G-01, G-07, G-13) | NO |
| Matematik | YES except bilingual and 2-key item | NO (G-13, G-07, G-04) | NO |
| Matematik Tambahan | YES except bilingual | NO (G-13, G-07, G-01) | NO |
| Sejarah | YES (G-12 minor) | NO (G-01, G-04) | NO |

## 7. Caveats
Viewed key pages only, not every sub-question. Scheme notation for Mat Tambahan and Fizik K2 is from text layers; BM and BI skema from images. No person names recorded; no paper text reproduced beyond short identifiers.
