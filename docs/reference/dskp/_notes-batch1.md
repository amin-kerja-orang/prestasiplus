# DSKP extraction notes - batch 1

Feature: `v2-question-bank` (requirements section 8 item D9, TRACKER D40(e)).
Source PDFs (read-only, not copied into the repo), all in `D:\prestasiplus\`:
`DSKP KSSM MATHS.pdf`, `Add Maths T4 n T5.pdf`, `DSKP KSSM Physics Form 4 and 5.pdf`, `DSKP KSSM Science Form 4 and 5.pdf`, `DSKP BAHASA.MELAYU.pdf`.
All five are KSSM DSKP for Tingkatan 4 and 5 and all have a real text layer (no OCR needed). Text was extracted with `pdftotext` (layout mode for the standards tables, reading-order mode for the front-matter assessment tables), parsed by script, then checked and hand-corrected.

Output files (one per subject): `matematik.json`, `matematik-tambahan.json`, `fizik.json`, `sains.json`, `bahasa-melayu.json`. All five follow the requested shape: `subject`, `subjectCode` (always `null`: no subject code is printed on any cover), `levels`, `source`, `edition`, `units[]` (`level`, `code`, `title`, `titlePrinted`, area field, `standards[]` = `{sk, skTitle, sp[{code,text}]}`, `tahapPenguasaan[]`). Extra fields: `language`, `structureNote`, `generalPerformanceLevels` (the subject's general 1-6 scale from the front matter), `manualCorrections` (every SP/SK that was hand-fixed after extraction).

The Catatan / Notes / Cadangan aktiviti / Suggested activity column is intentionally not extracted (not a curriculum standard). Mathematical symbols and formulae are images or special-font glyphs in these PDFs and are dropped from the text (for example Maths T4 SP 1.1.3 reads "... kesan perubahan nilai dan ke atas graf ..." because the symbols a, b, c are missing). A few Greek letters were restored by hand in Physics (wavelength). Wording, numbering and printed typos are kept as printed.

## Counts (from the final JSON)

| Subject | Level | Units | SK | SP | TP descriptors |
|---|---|---|---|---|---|
| Matematik | T4 | 10 | 19 | 70 | 60 (6 per unit) |
| Matematik | T5 | 8 | 16 | 57 | 48 |
| Matematik Tambahan (English edition) | T4 | 10 | 30 | 94 | 60 |
| Matematik Tambahan | T5 | 8 | 29 | 77 | 48 |
| Fizik (English edition) | T4 | 6 | 30 | 108 | 36 |
| Fizik | T5 | 7 | 25 | 97 | 42 |
| Sains (English edition) | T4 | 12 | 44 | 121 | 72 |
| Sains | T5 | 9 | 27 | 85 | 54 |
| Bahasa Melayu | T4 | 5 | 25 | 54 | 18 (units 1.0-3.0 only) |
| Bahasa Melayu | T5 | 5 | 25 | 48 | 18 (units 1.0-3.0 only) |

Totals across the five files: 80 units, 270 SK, 811 SP.

Per-unit SP counts (code:count):
- Matematik T4: 1:8 2:4 3:12 4:9 5:5 6:7 7:7 8:8 9:8 10:2. T5: 1:9 2:10 3:3 4:4 5:14 6:7 7:8 8:2.
- Matematik Tambahan T4: 1:11 2:11 3:5 4:13 5:9 6:6 7:12 8:10 9:12 10:5. T5: 1:8 2:16 3:11 4:6 5:14 6:12 7:2 8:8.
- Fizik T4: 1:7 2:21 3:13 4:17 5:28 6:22 (includes 3 SP re-added by hand, see below). T5: 1:13 2:21 3:20 4:14 5:7 6:9 7:13 (includes 1 re-added SP).
- Sains T4: 1:9 2:5 3:9 4:13 5:14 6:15 7:5 8:10 9:10 10:12 11:12 12:7. T5: 1:9 2:11 3:10 4:5 5:24 6:6 7:6 8:5 9:9.
- Bahasa Melayu T4: 1:15 2:9 3:11 4:8 5:11. T5: 1:14 2:9 3:9 4:8 5:8.

## Per subject

### Matematik (`matematik.json`, BM, Terbitan 2018 / September 2018)
- Hierarchy: Bidang Pembelajaran (Nombor dan Operasi; Sukatan dan Geometri; Perkaitan dan Algebra; Statistik dan Kebarangkalian; Matematik Diskret) > Tajuk (unit, `N.0`) > Standard Kandungan (SK, `N.M`) > Standard Pembelajaran (SP, `N.M.K`). Codes restart at 1.0 in T5, so always key by (level, code). The `bidang` field is stored on each unit.
- Standard Prestasi / Tahap Penguasaan: yes, 6 descriptors for every Tajuk (TP 1-2 "Mempamerkan pengetahuan asas / kefahaman", TP 3 "Mengaplikasikan kefahaman ... tugasan mudah", TP 4 rutin mudah, TP 5 rutin kompleks, TP 6 "bukan rutin secara kreatif"). This gives a ready difficulty/cognitive tag for every unit.
- General levels (Jadual 4 "Tahap Penguasaan Umum", also stored in `generalPerformanceLevels`) and Jadual 6 "Tahap Penguasaan Keseluruhan" (overall level, 6 levels, up to modelling and non-routine problems).
- KBAT: explicit. Jadual 3 "Tahap Pemikiran dalam KBAT" = Mengaplikasi, Menganalisis, Menilai, Mencipta. Five mathematical processes (Penyelesaian masalah, Penaakulan, Komunikasi, Perwakilan, Perkaitan) with a "Standard Proses Matematik" table (Jadual 1). Problems are classified routine (mudah/kompleks) vs non-routine in the TP wording.
- Assessment format: school-based (PBD) only, no written-exam paper format.
- Tagging notes: Tajuk 10.0 (T4) and 3.0/4.0 (T5) are Matematik Pengguna topics (kewangan, insurans, percukaian); T5 8.0 Pemodelan Matematik has only 2 SP and its 6-level TP is specific to modelling.

### Matematik Tambahan (`matematik-tambahan.json`, English edition, Mei 2019)
- Printed text is English (title kept in BM as `subject`). Hierarchy: Learning Area (Algebra, Geometry, Calculus, Statistics, Trigonometry; stored as `learningArea`) > Topic (`N.0`) > Content Standard (SK) > Learning Standard (SP). Codes restart in T5.
- Note: the PDF labels T5 topic 7 Linear Programming and topic 8 Kinematics of Linear Motion under the "Trigonometry" learning-area divider page (as printed; the `learningArea` field copies the last divider seen).
- Performance Standard: yes, 6 levels per Topic (Demonstrate/Apply ... non-routine problem solving in a creative manner), same ladder as Matematik. General levels in Table 4; Values internalisation table 5.
- KBAT: same four thinking levels. No exam-format information.
- T4 has 10 topics, T5 8 (Circular Measure, Differentiation, Integration, Permutation and Combination, Probability Distribution, Trigonometric Functions, Linear Programming, Kinematics of Linear Motion).

### Fizik (`fizik.json`, English edition, Mei 2019)
- Hierarchy: Theme (Elementary Physics; Newtonian Mechanics; Heat; Waves, Light and Optics; Electricity and Electromagnetism; Applied Physics; Modern Physics) > Learning Area (unit, `N.0`) > Content Standard (SK) > Learning Standard (SP). Stored as `theme` on each unit. Unit titles come from the table headings; SK titles come from the learning-area overview lists (they sometimes differ in wording from the table heading, e.g. T4 6.4 overview "Image Formation by Lens" vs table heading "Thin Lens Formula").
- Performance Standard: yes, one 6-level table per Learning Area, with the verb ladder Recall / Understand / Apply / Analyse / Evaluate / Invent. A separate "scientific skills" rubric (Table 11), "scientific attitudes and values" rubric (Table 12) and an overall performance level (Table 13, stored in `generalPerformanceLevels`) exist in the front matter.
- Experiment list (Table 10, front matter): the DSKP lists the SP that must be taught through a mandatory scientific investigation (for example 4.4.2-4.4.4 gas laws, 6.1.4 refractive index, 1.4.2 Hooke's law). Useful for tagging practical/experiment questions; not extracted into the JSON.
- Assessment format: none (PBD plus practical skills rubric).
- Source layout caveat: in several Learning Standard tables the SP codes are stacked in a column and the texts follow below; these were repaired by hand (see `manualCorrections`; T4 5.3.4, 5.4.4, 5.6.5 and T5 4.1.6 had been swallowed into a neighbouring SP and were re-added from the raw text).

### Sains (`sains.json`, English edition, Mei 2019)
- Hierarchy: Theme (Scientific Methodology; Maintenance and Continuity of Life; Exploration of Elements in Nature; Energy and Sustainability of Life; Earth and Space Exploration) > Learning Area (unit) > Content Standard (SK) > Learning Standard (SP). T4: 12 units, T5: 9 units.
- Performance Standard: yes, a 6-level table (Recall ... Create) printed per Learning Area. Exception: the three T4 Scientific Methodology units (1.0 Safety Measures, 2.0 Emergency Help, 3.0 Techniques of Measuring Body Health) share one table titled "Scientific Methodology"; units 1.0 and 2.0 carry a copy flagged by `tpScopeNote`. Table 9 gives the general 6-level knowledge-and-skills ladder (stored in `generalPerformanceLevels`).
- Table 10a/10b list the suggested investigations/experiments per Form; science process skills (Table 4/5) and thinking strategies (Table 3) are described in the front matter. KBAT / "Higher Order Thinking Skills" section present.
- Source typos preserved or flagged: T5 Electrochemistry unit heading is printed "7.0" while its SK/SP are 6.x (stored as code `6.0`, `printedCode: "7.0"`); T4 `9.0 CHEMECAL IN INDUSTRY` is printed with the typo (see `titlePrinted`); T5 SK 4.3 title is printed "Aplication"; SP wording such as "Comunicate" (T5 6.1.4) and "Justifies"/"Describes" (3rd person) is as printed.
- Some SP wording is tentative where the layout interleaved columns: T4 SP 4.3.1 ("... the waste and waste water management sector.") was reassembled from garbled lines (the PDF text reads "...in the waste ... water waste m and waste water management"; the final wording follows the sibling SP 4.4.1 and the note column, so treat it as inferred); T5 SP 5.5.5-5.5.7 were rebuilt from stacked codes.

### Bahasa Melayu (`bahasa-melayu.json`, BM, Terbitan 2018)
- Structure differs (see `structureNote`): units are the language skills/aspects, not topics: 1.0 Kemahiran Mendengar dan Bertutur (8 SK), 2.0 Kemahiran Membaca (4 SK), 3.0 Kemahiran Menulis (6 SK), 4.0 Aspek Seni Bahasa (4 SK), 5.0 Aspek Tatabahasa (3 SK). No Tajuk / theme level in the standards tables; the Tema list in the front matter is not tied to SK/SP codes. T4 and T5 reuse the same codes, so key by (level, code).
- Standard Prestasi: 6 descriptors (Sangat Terhad, Terhad, Memuaskan, Baik, Sangat Baik, Cemerlang) only for units 1.0-3.0; the descriptors are generic per skill and vary little between levels (TP 3/4/5/6 differ only in the final phrase, "pada tahap memuaskan / kukuh / tekal dan terperinci / ... menjadi teladan"). Units 4.0 and 5.0 have no TP; they carry a CATATAN stating that these aspects are assessed through the three skills (stored as `note`). `generalPerformanceLevels` = Jadual 3 Tahap Penguasaan Keseluruhan.
- KBAT: explicit (Jadual 2, same four levels). The DSKP also has glossaries (Glosari) not extracted.
- Assessment format: none in the DSKP (school-based, 6-level Tahap Penguasaan). SPM paper structure is not described. Because literature components (komsas) and the SPM paper formats are not in this PDF, question-bank tags for BM should rely on skill + SP code (and the grammar/seni bahasa aspects), not on the exam paper.
- Tagging notes: only SK/SP of 2.0 Membaca, 3.0 Menulis, 4.0 and 5.0 map naturally to written questions; 1.0 is listening/speaking (oral) and is not testable by a standard written MCQ.

## Cognitive / KBAT / assessment-format summary (all five)
- Cognitive framework in every DSKP is the revised-Bloom KBAT (Mengaplikasi, Menganalisis, Menilai, Mencipta) described in the front matter; it is not attached to individual SP codes. The only per-unit cognitive/difficulty signal is the 6-level Tahap Penguasaan / Standard Prestasi (Maths/Add Maths: knowledge -> routine problems -> non-routine; sciences: Recall -> Create; BM: Sangat Terhad -> Cemerlang).
- No DSKP describes the SPM written-exam format (paper counts, marks, question types). Assessment is school-based (PBD). The sciences additionally prescribe practical investigations.

## Problems / data-quality
- No scanned or unreadable pages. `pdftotext` printed one warning ("Bad block header in flate stream") for the BM PDF, but every standards table and TP table extracted completely (SP numbering is contiguous in every SK and a raw-text scan finds no code that the parser missed).
- Automated parse checks run on the final JSON: SK/SP numbering contiguous, every raw SP code present, every unit has exactly 6 TP descriptors (BM units 4.0/5.0 intentionally none), no leaked headers/notes/names. Raw-text code scan: zero missing SP codes in all five files after the hand fixes.
- Hand-fixed items are listed per file in `manualCorrections` (Maths 5, Add Maths 5, Fizik 16, Sains 9, BM 9). Remaining known imperfections: dropped math symbols/formulae in the text (see above), and SK titles that are wrapped across columns were reassembled by script (spot-checked, a few titles in Matematik T5 6.1 end with a trailing symbol gap).
- The independent audit step required by project rules (an audit agent comparing these JSON files against the PDFs) has not been run; treat these files as extracted and script-verified, not yet independently audited.
- Privacy: the PDFs end with a "Panel Penggubal" list of real people; that section was excluded (nothing like it is stored).

## Comparison with `.cloud` curriculum (`D:\Dev Projects\prestasiplus-reference\backend\tools\import\dskp\dskp-curriculum.json`, rows are `{sid, subject, strand, code, sp}`, no level, no SK, no TP)

General: the `.cloud` file is T5-only for every subject here (no T4), has no level field, no SK titles, no themes and no TP; codes repeat between strands so rows must be keyed by strand + code. Only a subset of SP per subject is present.

- Bahasa Melayu: 26 rows (Mendengar dan Bertutur 11, Membaca 5, Menulis 5, Aspek Seni Bahasa 5). All 26 match T5 SP text exactly (same code). Gaps: T5 has 48 SP, so 22 T5 SP are missing (1.4.2, 1.6.1, 1.7.1 ... ; 2.1.1, 2.3.1, 2.3.3, 2.3.4; 3.4.1, 3.4.2, 3.4.3, 3.6.1; 4.1.1, 4.1.2, 4.2.1 and Aspek Tatabahasa 5.0 entirely), the whole of T4 (54 SP) is absent, and there is no Tatabahasa aspect at all. This is the only subject where `.cloud` agrees with the official wording.
- Matematik: 52 rows in 7 T5 strands (Ubahan 9, Matriks 9, Insurans 3, Percukaian 4, Kekongruenan 13, Nisbah dan Graf Fungsi Trigonometri 6, Sukatan Serakan Data Terkumpul 8). Row counts per strand are within 1 of the official SP counts (9/10/3/4/14/7/8) and the codes line up (only 2.1.1, 5.1.1 and 6.1.1 are absent in `.cloud`), but the SP wording differs from the official DSKP in 41 of 52 rows (for example `.cloud` 1.1.2 "Menentukan pemalar, k bagi ubahan langsung." vs DSKP 1.1.2 "Menentukan hubungan antara dua pemboleh ubah bagi suatu ubahan langsung."): the `.cloud` text looks like a paraphrase or a different edition, not the DSKP wording. Missing: all of T4 (10 tajuk, 70 SP) and T5 8.0 Pemodelan Matematik.
- Matematik Tambahan: 63 rows in 8 T5 strands (English names). Per-strand counts are 1-4 below the official SP counts (Circular Measure 7 vs 8, Differentiation 13 vs 16, Integration 10 vs 11, Permutation 5 vs 6, Probability Distribution 10 vs 14, Trigonometric Functions 10 vs 12, Linear Programming 2 vs 2, Kinematics 6 vs 8) and only 13 of 63 rows have the DSKP wording; the rest are paraphrases or shifted by code. T4 (10 topics, 94 SP) is absent.
- Fizik: 97 rows in 4 T5 strands that group two DSKP units each (Newtonian Mechanics 34 = Force and Motion II 13 + Pressure 21; Electricity and Electromagnetism 34 = Electricity 20 + Electromagnetism 14; Applied Physics 7 = Electronics 7; Modern Physics 22 = Nuclear Physics 9 + Quantum Physics 13). Counts match the DSKP almost exactly, but the texts and the code meaning do not: only 11 of 97 rows are close to the DSKP wording (for example `.cloud` 3.1.1 "Explain electric current and potential difference." vs DSKP T5 3.1.1 "Explain electric field"; `.cloud` Modern Physics 6.1.1 "Explain radioactive decay ..." vs DSKP 6.1.1 "Explain with examples decay equations ..."). Treat `.cloud` Fizik as not aligned with the official DSKP. T4 (6 units, 108 SP) is absent.
- Sains: 81 rows in 9 T5 strands (Mikroorganisma 9, Nutrisi dan Teknologi Makanan 11, Kelestarian Alam Sekitar 10, Kadar Tindak Balas 4, Sebatian Karbon 24, Elektrokimia 5, Cahaya dan Optik 4, Daya dan Tekanan 5, Teknologi Angkasa 9). The `.cloud` rows are in Bahasa Melayu while this DSKP file is the English edition, so a text comparison is not meaningful; strand/code structure matches the 9 DSKP T5 units. Gaps vs DSKP T5 counts (9/11/10/5/24/6/6/5/9): `.cloud` lacks T5 4.2.1, 6.1.2, 7.1.3 and 7.2.2, and has no Form 4 units at all (12 units, 121 SP). The BM wording of `.cloud` SP could be reused as the BM display text if the app needs Malay labels (DSKP Sains/Fizik/Add Maths are English-edition PDFs here; a BM edition would be needed for official Malay wording).

## Relevance to question-bank tagging (D9)
- Recommended tag key: (subject, level, unit code) for topic, plus optional (level, SP code). Use `tahapPenguasaan` only as a unit-level difficulty ladder (Maths/Add Maths: TP 1-2 recall/understand, 3-4 apply/routine, 5-6 complex/non-routine; sciences: Recall -> Create). It is not assigned to individual SP codes.
- Sciences and Add Maths/Maths topics map cleanly to written questions (SP verbs: define, explain, determine, solve problems involving). Practical SP in Fizik/Sains (verbs "Carry out an experiment", "Conduct an experiment") are practical-skill standards; written items can be tagged against them but the DSKP itself treats them as hands-on.
- Unit codes alone are ambiguous across levels (all five subjects restart numbering in T5), and Sains codes can also collide inside a level only if the T5 Electrochemistry printed code (7.0) is used; always use the stored `code` (6.0) and keep `printedCode` for display if exact fidelity to the PDF heading is required.
