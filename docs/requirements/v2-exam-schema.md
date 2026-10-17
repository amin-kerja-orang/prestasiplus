# v2 Exam and question schema (derived proposal)

- **Slug:** `v2-exam-schema`
- **Status:** PROPOSED for user approval (G2 decision pack). Nothing here is built.
- **Date:** 2026-10-17
- **Owner:** solution-architect
- **Resolves:** TRACKER D46 (we derive the schema; the user does not supply one), and the "waiting for the schema" items of D28(e), D39, D40, Q1 / Q-B1 in `v2-question-bank.md`. Answers `v2-question-bank.md` section 8.1, items D1 to D12.
- **Decisions respected:** D32 (Kontrak Blueprint drives "Jana Kertas"), D40(b) (SPM Tingkatan 4-5 core subjects first), D41 (stimulus groups, maths input, structured mark scheme K/N/P, equivalence marking), D44 (Bijak SPM is built now; this schema is an adjustment, not a prerequisite), D45 (PoC data stays small; the schema is the long-term contract).
- **No personal data, no question text.** Only aggregate counts and paraphrased structural examples appear below. Raw query output and OCR text live outside the repo (scratchpad). Real person names seen in the sources are not reproduced.

## 0. Summary (what the user is asked to approve)

| # | Proposal | Why (one line) |
|---|---|---|
| 1 | **Question = ordered tree of Parts; only leaf Parts carry marks and an answer mode.** Max depth 3 (a), (i), (A). A single MCQ is a question with one leaf Part. | .cloud already works this way (6,052 parts, 97.8% of questions have one part); real papers need (a)(i) (Matematik K2). |
| 2 | **Eight leaf answer modes:** `mcq` (3 to 8 options), `match_letter`, `short_text`, `numeric`, `working`, `essay`, `drawing`, `table_fill`. | Union of what .cloud actually stores (6 modes in use) and what the sample papers need (matching letters, drawing/graph, table completion). The other 8 .cloud modes have 0 rows and are dropped. |
| 3 | **Five answer-key kinds:** `option`, `accepted`, `mapping`, `points`, `rubric`. | .cloud uses 3 of 6 kinds; the papers add letter mapping (BI Part 4) and band rubrics (BM essays). `model_answer` is folded into `points`/`rubric`. |
| 4 | **One structured mark-scheme model** for `points`: marking points with a code letter (K, N, P, B, M, F, C), explicit marks, accepted equivalents, "any N of M" groups, alternative methods, conditions, ECF, tolerance, unit, significant figures, deductions. | The real schemes use K/N/P (Matematik Tambahan), M1..M3 (Fizik), F1..Fn with "mana-mana n x m" (Sejarah), C1..Cn (BI writing), score bands (BM). .cloud stores free text only (0 genuine K/N/P codes in 547 schemes). |
| 5 | **Paper = ordered Sections; Section = rule (`all` or `choose N`) + marks budget + question range + allowed modes.** Same model for every subject (Bahagian A/B/C, Part 1 to 5, Objektif). | 362 sections in .cloud use exactly this; 5 real papers confirm "choose 1 of 2/3/4" and "choose 3 of 5". |
| 6 | **Stimulus = reusable object; a Stimulus Group = stimulus + ordered question range, kept together everywhere.** Stimulus can also attach to a single Part (Sejarah sources). | 135 .cloud stimuli are shared by 2 to 76 questions, only 53% contiguous; no group entity exists (D41-1). |
| 7 | **Blueprints for 12 launch subject-kertas pairs derived** (BM K1/K2, BI P1/P2, Matematik K1/K2, Matematik Tambahan K1/K2, Sejarah K1/K2, Fizik K1/K2, plus Sains/Kimia/Biologi from DB only), each tagged DATA / PAPER / DSKP / INFERRED with confidence. Pendidikan Islam and Moral: not derivable yet. | Section 7. |
| 8 | **Curriculum tag = a node in a generic tree** (subject, level, grouping, unit, SK, SP) plus a separate cognitive level TP1-6. **At Terbit a question must carry subject, level, unit, SP and TP.** Difficulty is derived from TP and later recalibrated from student results. | 0% of canonical questions and 0% of legacy questions carry a chapter; legacy difficulty is a 1-5 integer unrelated to DSKP. |
| 9 | **Duplicate = same normalised stem + normalised option set + same numbers/figure hash.** Same stem with different numbers is a variant, not a duplicate. The same question may sit in many papers. | 183 duplicate-stem groups (982 rows, 17.2%) found in 5,704 canonical questions. |
| 10 | **Lifecycle: Draf, Semakan, Lulus, Terbit, Diarkib** as already drafted in `v2-question-bank.md` 4.1 (no change). Papers: Draf, Semakan, Terbit, Diarkib. | .cloud has 4 states and a paper-level bypass incident (E9). |
| 11 | **Real sample papers are available** (Drive, see section 9). The same files are the OCR test set for intake. | D46 / coordinator brief. |

Blocking open questions: none that stop G2 (section 12 lists 6 non-blocking items with defaults).

## 1. Sources, method and confidence tags

| Tag | Source | Used for |
|---|---|---|
| **DATA** | Read-only SELECTs on the .cloud production DB (`exam_*`, `question_parts`, `part_*`, `stimuli`, `paper_*`, `blueprint_*`, `source_papers`, legacy `questions`, `structured_*`, `pksk_questions`, lookup tables). Aggregates and small samples only; no user, attempt, answer, report, payment or chat tables were touched. | Types in use, frequencies, key shapes, section patterns, tagging coverage |
| **DSKP** | `docs/reference/dskp/*.json` (13 subjects, T4 and T5; audited 2026-10-16) | Curriculum tree, TP descriptors, cognitive ladders, tagging targets |
| **PAPER** | Real SPM trial papers and their official marking schemes (Peraturan Pemarkahan), user-shared Drive folder: Matematik (Johor 2025 Set 1), and Selangor PINTAS 2025 Set 1 for Matematik Tambahan, Fizik, Sejarah, Bahasa Melayu, Bahasa Inggeris. 20 more files; 24 PDFs read (4 per subject). The Matematik set and 9 of the other schemes have a text layer; the 13 question papers and scanned schemes (all Selangor question papers, BM schemes, BI P1/P2 papers) were OCR-read with Tesseract. | Real paper structure, marking-scheme notation, answer modes, stimulus use, topic spread |
| **INFERRED** | Reasoned from the above, or from general SPM practice where the data is silent | Marked per item; always lower confidence |

Confidence: **High** = DATA and PAPER agree; **Medium** = one source, or two sources with a small conflict; **Low** = inferred, needs LPM / user confirmation.

Limits of the evidence (stated so nobody over-trusts it):
- One paper per subject-kertas. A blueprint derived from one paper is a **structure** (sections, counts, marks), not a statistically proven topic weighting.
- Only trial papers (Johor, Selangor). The official LPM format may differ in small details (duration, option counts).
- DSKP extracts cover Tingkatan 4-5 only. SPM Matematik K1 also tests Tingkatan 1-3 content (section 8).
- OCR text was used for classification only; per-question topic labels from scans are **Medium** at best.

## 2. Data evidence summary (aggregate numbers only)

### 2.1 Two banks in .cloud

| Bank | Rows | Notes |
|---|---|---|
| Canonical `exam_questions` | **5,704** questions (667 approved, 5,037 draft); 6,052 parts; 21,953 options; 5,670 answer keys; 1,931 stimuli; 1,694 paper placements; 175 papers (69 published, 104 draft, 2 archived) | Almost all content came from 82 `source_papers` (70 of them year 2025; boards: 16 states, SBP, SABK, SMKA, MRSM). |
| Legacy `questions` | **451,518** rows: 449,503 MCQ + 2,015 subjective; 408,197 `diluluskan`, 41,150 `diarkib`, 155 `draf`, 1 `ditolak`; 99.6% from one ripped databank | Chapter and topic are **never** set (0 of 451,518); difficulty 1-5 is set on 100% (43,923 / 180,041 / 166,857 / 60,527 / 170); `dskp_tagged` on 90 rows (0.02%). |
| Legacy `structured_questions` | 4,061 questions, 10,296 sub-questions; 7,033 sub-questions (68.3%) have **no scheme text**; `structured_rubric_points` has 0 rows | KBAT field values: LOTS 1 (18), LOTS 2 (535), MOTS 3 (1,872), HOTS 4 (1,148), HOTS 5 (483), HOTS 6 (5). |
| `paper_documents` | 254 scanned papers (mostly Kertas 2/3/4 as page images with self-marking) | These are not parsed into questions at all. Evidence that structured papers are the intake gap. |
| `pksk_questions` | 748 rows (Bahagian A 147, B 561, C 30 by domain) | Separate bank; v2 treats PKSK as tags on the one bank (v2-question-bank A6). |

Launch-scope legacy MCQ stock, Tingkatan 4-5, status `diluluskan` (diarkib in brackets), for reference: Matematik T4 3,898 (920) and T5 1,060 (527); Matematik Tambahan T4 3,936 (297) and T5 3,080 (291); Fizik T4 1,328 (20) and T5 1,288 (352); Sejarah T4 978 (63) and T5 916 (59); Bahasa Melayu T4 400 (7) and T5 412 (144); Bahasa Inggeris T4 624 (0) and T5 888 (16); Kimia T4 3,925 (167) and T5 2,354 (777); Biologi T4 4,230 (3,061) and T5 4,038 (2,277); Sains T4 4,485 (1,827) and T5 2,608 (608). The canonical bank by subject (T4-5 mixed, level is not stored): Matematik 307, Bahasa Inggeris 1,076, Sejarah 507, Bahasa Melayu 120, Sains 253, Fizik 400, Kimia 440, Biologi 40.

### 2.2 Canonical part and key statistics

| Item | Value |
|---|---|
| Leaf answer modes in use | `mcq` 5,335 (88.2%); `extended_essay` 532 (8.8%); `short_text` 136 (2.2%); `essay_choice` 39; `numeric` 7; `working_shown` 3 |
| Modes defined but **0 rows** | `numbered_list`, `graph_plot`, `draw_on_diagram`, `table_fill`, `sequence_order`, `code`, `gapped_text_match`, `cloze` |
| Part nesting | 5,935 top-level parts, 117 parts at depth 1, **0 at depth 2**; 5,579 questions (97.8%) have one part, 125 have 2 to 10 |
| Part labels | "a" 3,545; empty 2,141; "b" 107; "i" 67; "ii" 67; "c" 59; "d" 21 |
| Marks | Every MCQ part = 1 mark. Question totals: 1 mark = 5,431 questions; others 3 to 32; essays 20 / 30 / 70 (56 / 18 / 44 questions) |
| MCQ option counts | 4 options: 4,859 parts (4,537 with one correct, 322 with none); **3 options 215; 6 options 104; 8 options 156** (these are BI matching/gap parts stored as MCQ); labels A..H |
| Answer keys by kind | `single_key` 5,012 (all MCQ); `mark_scheme_points` 547 (505 essay, 39 essay-choice, 3 working); `accepted_values` 111 (104 short text, 7 numeric); **`band_rubric`, `model_answer`, `mapping`: 0 rows** |
| Parts without a key | 382 of 6,052 (6.3%): 323 MCQ (all in Draf), 27 essay, 32 short text. The publish gate holds (none in an approved question). |
| `single_key` JSON | `{"option_id": n}` |
| `accepted_values` JSON | `{"values": [...]}`; numeric rows add `{"tolerance": "0"}` (string, always 0); the unit lives in part `config` (`{"unit":"cm"}`) and is display only |
| `mark_scheme_points` JSON | `{"points": [...]}` with **543 plain strings and 7 objects `{point, marks}` (marks always null)**; 10.6 points on average per essay, max 157 (a scheme pasted as lines) |
| Genuine K/N/P/B/M/A codes in schemes | **None.** Regex hits (K 5, P 40, A 4, B 4) are false positives inside BM prose (for example the heading "PANDUAN PEMARKAHAN ... 2 MARKAH"). Legacy schemes: 20 hits for "N1/N2" are list numbering. |
| Word limits | 31 essay parts: 120 words (6), 200 (5), 500 (20) |
| Question text | 52 stems and 158 options hold MathML/KaTeX markup; 42 options hold an image; stems average 203 characters (max 3,576) |
| Language | Stems are a BM/EN mix (1,294 contain BM cue words, 1,048 contain EN cue words): bilingual papers are stored as one mixed text field |

### 2.3 Stimuli

| Item | Value |
|---|---|
| Kinds in use | passage 797; image 667; diagram 410; table 45; map 9; infographic 2; graph 1 (15 kinds defined; 8 unused: box, cartoon, code, pseudocode, sql, math, audio, video) |
| Link tables | `question_stimulus` 1,727 links; 81 parts point to a stimulus directly (essay 91 parts, short text 19 per mode counts) |
| Orphans | **946 of 1,931 stimuli (49%) are linked to nothing** (leftovers of one-stimulus-per-question imports) |
| Sharing | Of 904 linked stimuli: 769 used by 1 question; **135 shared** by 2 to 76 questions (2:33, 3:9, 4:29, 5:1, 6:20, 8:17, 10:16, 12:2, 16:2, 20:1, 32:2, 48:1, 64:1, 76:1). All large groups are passages (max 76, probably cloze/reading sets); images are shared by up to 6. |
| Contiguity | Only **72 of 135 shared stimuli (53%)** cover a contiguous run of question positions: nothing enforces "Q5 to Q8 stay together" (D41-1) |
| Per question | 1 stimulus: 1,675 questions; 2: 14; 3: 8 |
| Assets | `media_assets` 1,139 images; alt text present on 760 (66.7%) |

### 2.4 Sections, papers, blueprints

| Item | Value |
|---|---|
| Selection rules | `answer_all`, `choose_n` only. `choose_n` observed: BM Bahagian B (1 of 4), BI Part 3 of Paper 2 (1), Matematik K2 Bahagian C (1), Sains K2 Bahagian C (1 of 2), Sejarah K2 Bahagian B (3). |
| Labels | "Bahagian A/B/C" (also "Bahagian A : Sistem dan Aplikasi Bahasa", "Bahagian C: Rumusan"), "Part 1" to "Part 5", "Part 5 (Questions 37-40)", "Objektif", "Bahagian C - Soalan 12 atau 13 (pilih satu)" |
| Section columns | `select_count` is set on 28 of 362 sections (every choose-N), `mark_budget` on 1 of 362 |
| Papers | 175; duration set on 26 of 175 (BM K1 120, BM K2 150, BI 90 / 90, Sains K1 75, Sains K2 150, Sejarah K2 90, others NULL); `instructions` JSON on 7, `reference_assets` (formula sheets) on 7 |
| Paper title | free text ("PERNIAGAAN K1 PERLIS-2025", "Tracking A 2026 - ... Set 5"); `cover_code` set on 5 of 175 (1449/1, 1449/2) |
| Blueprints | **36** (`paper_blueprints`), **23 sections**; source: derived 11, spec 6, draft 19 (19 are empty skeletons with a note "sahkan struktur, markah dan tempoh dengan LPM"). Only 17 blueprints have any section. |
| Paper placement | 1,694 placements; 1,653 pin a snapshot (`question_snapshots` 8,092 rows); 41 questions appear in 2 papers; `question_revisions` has 0 rows |
| Import issues | 96 of 175 papers carry an `import_issues` record (repaired option letters, missing source tags) |

### 2.5 Taxonomy fill (canonical bank)

| Field | Filled |
|---|---|
| `chapter_id` | 0 of 5,704 |
| `topic` (free text) | 68 of 5,704 (1.2%; 17 of 137 approved Matematik, 51 of 170 draft Matematik) |
| `difficulty` (free string) | 0 of 5,704 |
| education level | not stored on `exam_questions`; reachable only through `chapter_id` (so unknown for all) |
| `source_paper_id` / `exam_paper_id` | 4,536 / 4,104 (a question can have either or both) |
| `number_label` | "12" style on 5,702; "7.1" on 2 |

The `chapters` table (686 rows) is **Tingkatan 5 only, 14 subjects**. Despite its name every row is an SP-level row (`dskp_code` like 1.1.3, `strand` = unit title, `title` = learning-standard text). Row counts versus DSKP T5 SP counts: Matematik 52 vs 57; Matematik Tambahan 63 vs 77; Fizik 97 vs 97; Sains 81 vs 85; Sejarah 51 vs 96; Pendidikan Moral 72 vs 72 (details in section 8.3).

## 3. Decisions D1 to D4: question types, fields, answer keys, mark scheme

### D1 Question types (exact names, BM labels)

A **question** is always a tree of parts. The "type" a teacher or student sees is derived from the root and its leaves. To keep the form simple the authoring UI offers these **eight question types** (each a template that fixes the tree shape and leaf mode):

| Type slug | BM label | Tree shape | Leaf mode | Evidence |
|---|---|---|---|---|
| `mcq` | Aneka Pilihan | root with one leaf; 3 to 8 options A..H; exactly one correct | `mcq` | DATA 5,335 parts; PAPER every K1 / P1 (Matematik, Fizik, Sejarah, BI Parts 1-3) |
| `match` | Padanan / Lengkapkan Petikan | N leaf parts sharing one lettered option bank (each gap or item picks a letter) | `match_letter` | PAPER BI P1 Part 4 (6 gaps, bank A to H) and Part 5 (4 items, bank A to F); DATA stored these as `mcq` with 8 and 6 duplicated options per part (156 and 104 parts) |
| `short` | Jawapan Pendek | one leaf; text or number | `short_text` or `numeric` | DATA 136 + 7; PAPER Matematik K2, Fizik K2, BI Part 5 Q37-40 (one-word fill), Sejarah (a) parts |
| `structured` | Berstruktur | root with 2 to 10 leaf parts or nested parts (a), (i) | any leaf mode below | DATA 125 multi-part questions; PAPER every Kertas 2 |
| `working` | Pengiraan dengan Langkah Kerja | leaf with a working area plus a final answer and unit | `working` | DATA 3 rows; PAPER Matematik, Matematik Tambahan, Fizik K2 calculations ("M1 gantian, M2 jawapan dengan unit"); D41-2 |
| `essay` | Karangan / Respons Terbuka | one leaf, long text, optional word range, optional alternative prompts | `essay` | DATA 532 + 39; PAPER BM K1 A/B, BM K2 Rumusan, BI P2 Parts 1-3, Sejarah K2 Bahagian B, Fizik K2 Bahagian B/C |
| `drawing` | Lukisan / Graf | leaf where the student draws on a given diagram, plots a graph or sketches | `drawing` | PAPER Matematik K2 (draw a diagonal, plot a quadratic, sketch a graph), Fizik K2 (draw diodes, normal line, capacitor), Matematik Tambahan K2 (shade a region, draw a line); DATA 0 rows (the mode existed but no widget) |
| `table` | Isi Jadual | leaf grid with blank cells | `table_fill` | PAPER Matematik/Fizik answer-space tables; DATA 0 rows. **Included at P2 priority** (see D2). |

Dropped from the .cloud list (0 rows and no evidence in the papers): `numbered_list`, `sequence_order`, `code`, `cloze`, `gapped_text_match` (replaced by `match`), `essay_choice` (replaced by section rule `choose N`, see D5). **Not added** although listed in `v2-question-bank.md` D1 ("MCQ multiple, true/false, fill-in-blank, practical"): none occurs in the data or in the papers. A true/false statement is a `short` with accepted values ("Benar", seen in Matematik K2 Q4(b)); multi-select MCQ is deferred until a paper needs it. Reason: D45 (speed) and "design only what the requirements need".

**Comprehension** (passage plus questions) is not a type: it is a **stimulus group** (D6) of ordinary questions. **Bilingual** (BM and EN stacked) is a text property, not a type (D8).

### D2 Fields per type

Common fields (every question; "R" = required at Terbit, "O" = optional):

| Field | Type | Req | Notes |
|---|---|---|---|
| `id`, `version` | uuid, int | R | version n+1 on edit of a Terbit question (v2-question-bank 4.6) |
| `type` | enum D1 | R | |
| `stem` | rich text `{ms, en}` | R | MathML/LaTeX allowed; `en` optional; max 1 language for BM/BI/Arab papers |
| `number_label` | string | O | as printed ("12", "5(a)"); position inside a paper is stored on the placement, not here |
| `parts[]` | tree, depth <= 3 | R | MCQ has exactly 1 leaf |
| `stimulus_refs[]` | ordered stimulus ids | O | question-level stimuli (D6) |
| `group_id` | uuid | O | stimulus group membership (D6) |
| `total_marks` | int | derived | sum of leaf marks; never stored independently (NFR-08) |
| `curriculum` | {subject, level, unit, sk, sp[], tp, textbook_ref?} | R subject, level, unit, sp, tp at Terbit | D9 |
| `cognitive_level` | int 1..6 | R at Terbit | TP-aligned, D8 |
| `difficulty_tp` | int 1..6 | R at Terbit | initially equals cognitive level; recalibrated later |
| `language` | `ms` / `en` / `ms+en` / `ar` / `jawi` | R | D8 |
| `meta` | see D10 | | |
| `status`, audit, provenance | | | v2-question-bank sections 4.1, 5 US-15/16 |

Leaf Part fields (R = required for that mode):

| Field | Applies to | Type | Notes |
|---|---|---|---|
| `label` | all | string | "(a)", "(i)", "" for a lone leaf; any printed label kept |
| `prompt` | all | rich text `{ms, en}` | |
| `marks` | leaf only | int >= 1 (0 allowed for an unmarked example) | parents have no marks; parent sum is derived. A parent with its own marks is a validation error (the .cloud rule `marks_sum`) |
| `mode` | leaf | enum | `mcq`, `match_letter`, `short_text`, `numeric`, `working`, `essay`, `drawing`, `table_fill` |
| `options[]` | mcq | `{label A..H, body rich text, image?}` | 3 to 8; DATA 3:215, 4:4,859, 6:104, 8:156; option text may hold MathML or an image |
| `option_bank_id` | match_letter | ref | shared lettered bank owned by the stimulus group; items reuse it (no duplication) |
| `unit`, `decimals`, `sig_figs` | numeric, working | | unit is **checked** in v2 (it is display only in .cloud) |
| `blank_count` | short_text (cloze-like) | int | for "one word per blank" |
| `word_range` | essay | `{min, max}` | PAPER BM 150-200 and 350-500; BI 80, 125-150, 200-250; DATA 120 / 200 / 500 limits |
| `alternatives[]` | essay | prompt refs | "answer one of two e-mails" inside one compulsory question (PAPER BM K1 Bahagian A) |
| `drawing.kind` | drawing | `graph` / `diagram` / `sketch` | v2.0 capture = photo of the answer plus checklist marking points; canvas capture later |
| `table.grid` | table_fill | rows x cols, blank cells marked | gate: at least one blank cell (.cloud rule `table_no_blank`) |
| `stimulus_ref` | any | stimulus id | part-level stimulus (DATA 81 parts; PAPER Sejarah (c) parts each carry their own source) |
| `reveal` | all | `after_submit` / `never` | scheme reveal rule (kept from .cloud) |

Priority: P1 modes for the PoC and launch: `mcq`, `short_text`, `numeric`, `working`, `essay`, `match_letter`; **P2**: `drawing` (photo + checklist), `table_fill`. Reason: P1 modes cover every K1/P1 and the calculation and essay parts of K2; drawing and table parts exist in every sciences/maths Kertas 2 but v2.0 can mark them by checklist.

### D3 Answer-key shapes per leaf mode

| Mode | Key kind | Shape (JSON) | Auto-marked? |
|---|---|---|---|
| `mcq` | `option` | `{"correct": "B"}` (a label; option ids are internal) | yes |
| `match_letter` | `mapping` | `{"map": {"27":"E","28":"B", ...}, "bank_unique": true}` | yes (all-or-nothing per item) |
| `short_text` | `accepted` | `{"values": [..."normalised accepted strings"], "case": false, "any_order": false, "blanks": [["a","b"],...]}` | yes, with equivalence normalisation (D41-4) |
| `numeric` | `accepted` | `{"values":[{"v": 5.3, "tol": 0.01, "tol_kind": "abs"|"rel", "unit": "cm", "unit_alt": ["cm"], "sig_figs": 3, "decimals": null}]}` | yes |
| `working` | `points` | marking points (D4) plus `final` | final auto, points by equivalence, ambiguous to review queue |
| `essay` | `rubric` or `points` | band rubric (D4.5) or content points (BI C1..Cn, Sejarah F1..Fn) | suggestion only; a person confirms (D41-4 "failure never awards 0") |
| `drawing` | `points` | checklist points (for example "straight line drawn", "curve passes the given points") | self/teacher marked in v2.0 |
| `table_fill` | `mapping` | `{"cells": {"r1c2": ["A","a"], ...}}` | yes |

Evidence: DATA uses `single_key` (5,012), `accepted_values` (111) and `mark_scheme_points` (547) only; PAPER schemes show all five kinds (answer letter tables for K1; mapped letters in BI Part 4; scheme points in K2; content points C1..C4 in BI writing; score bands in BM). The v2 shapes are supersets of the .cloud JSON, so the reload mapping (section 5) is mechanical.

Gate (unchanged intent from `v2-question-bank.md` 4.8): a question cannot reach Terbit unless **every leaf part has a key of the right kind and non-empty**, marks of a part equal the sum of its scheme points, and an MCQ has exactly one correct option. In DATA 322 draft MCQ parts have no correct option and are all in Draf: the gate works at question level.

### D4 Mark-scheme model

#### D4.1 What the real schemes look like (PAPER evidence)

| Source scheme | Notation actually printed |
|---|---|
| Matematik Tambahan K1/K2 (Selangor) | Right-hand column of **K1 / N1 / P1** codes per line, one mark each; total per question at the bottom; `@` = alternative accepted line; `&` = and (both needed); `//` = equivalent form; `OR` and the labels **Alternatif A / Alternatif B** = whole alternative solution paths; `dilihat` = "seen" (mark awarded if the value appears anywhere); `boleh tersirat` = may be implied; `Nota:` = condition or accepted variant (for example "accept dashed and solid line"); a marking line can say "Mesti tunjuk operasi +/-" (must show the operation). Counts in 2 schemes: K1 106, N1 102, P1 14. No B1, no ECF/OW notation seen. |
| Matematik K2 (Johor) | Plain mark values (1/2/3) in the right-hand column, no letter codes (one stray K1/P1); `atau setara` = "or equivalent" (5); `ATAU` + a second block = alternative method (26); `Mana-mana ...` = any (2); `Nota` (3). |
| Fizik K2 (Selangor) | **M1, M2, M3** labels per marking point (each 1 mark, labels are sequence numbers); phrases "Gantian yang betul" (correct substitution), "Jawapan dengan unit yang betul" (answer with correct unit); bilingual BM/EN lines; "JUMLAH n" per question; "/ sebaliknya" (or vice versa); "terima sebarang bahan" (accept any material). |
| Sejarah K2 (Selangor) | **F1..Fn** = facts (1 mark each), **C1..Cn** = examples; the rule line `[ mana-mana 2 x 1 m ]` = "any 2 of the facts at 1 mark each" (23 in one scheme); `(Mana-mana jawapan berkaitan)`. No level rubric printed for the 20-mark questions beyond a facts list. |
| Sejarah K1, Fizik K1, Matematik K1, BI Parts 1-5 | Answer letter tables; Sejarah also prints a textbook reference per answer (Bab / Tingkatan / Muka surat, for example "B3T4 M56"). BI Part 4 and 5 add letters and one-word answers. |
| BM K1 (Selangor) | Score-band tables (Peringkat, Markah range with 3 sub-bands such as 28-30, 26-27) against criteria Tema/Tugasan, Idea, Bahasa, Pengolahan (Bahagian A, 30 marks) and Bahasa / Idea / Pengolahan / Gaya Bahasa (Bahagian B, 70 marks); one band "tidak mencapai tahap minimum" (1-9). Instruction lines such as "terima seperti biasa" (accept as usual). |
| BM K2 (Selangor) | Global rules before each question: 1 mark per correct item; **"Tolak 1 markah bagi kesalahan ejaan / jalan bahasa / tanda baca"** (deduct 1 per error across the whole answer); **"salin teks petikan = 0 markah"** (copying earns zero); item lists with accepted alternatives (`1. berangkat 2. pergi 3. menuju`). |
| BI P2 (Selangor) | Content points **C1..C4** per task with conditions ("if not related, no C2"; accepted vs not accepted values, for example a clock time accepted but "before midnight" not accepted; "if only one is mentioned, consider minor omission"). Language marks use a separate generic band (not in the file). |

Observation: the code letters are **subject-family conventions**, not a universal K/N/P system. D41 assumed K/N/P everywhere; the data shows K/N/P for maths, M for sciences, F/C for Sejarah and BI, bands for languages. The model below keeps one structure and a **closed list of code letters**.

#### D4.2 Marking point (the unit of a `points` key)

```
point {
  id            string        // stable inside the part: "p1"
  code          enum          // K | N | P | B | M | F | C   (see table below), display label e.g. "K1", "M2", "F3"
  label         string        // printed label, may repeat the code with sequence
  marks         number >= 0   // explicit, never inferred from the code digit (Fizik M1/M2/M3 are sequence numbers)
  text          rich text     // the model line (what a marker sees)
  accept[]      string/LaTeX  // "@" alternatives; each is a full equivalent of the line
  all_of[]      string        // "&" : every item must appear
  seen          bool          // "dilihat": awarded if the value appears anywhere in the working
  implied_ok    bool          // "boleh tersirat"
  requires      point id      // conditional on another point (K before N; "no C2 if not related to C1")
  ecf           {from_part, rule}  // own-figure-carried-forward: optional; 0 occurrences in the sample schemes
  unit          {value, alt[], mandatory bool}
  tolerance     {abs | rel}   // numeric points
  sig_figs      int | null    // answer to n significant figures
  decimals      int | null
  note          text          // "Nota": accepted variants / conditions shown to the marker
}
```

| Code | Meaning (BM label) | Used by (PAPER) | Auto-marking behaviour |
|---|---|---|---|
| `K` | Kaedah (method) | Matematik, Matematik Tambahan | step equivalence on the working lines |
| `N` | Ketepatan (accuracy, answer) | Matematik, Matematik Tambahan | final value / form check; usually `requires` the K above |
| `P` | Penaakulan / persembahan (reasoning, presentation, graph shape) | Matematik Tambahan (14 in 2 schemes) | manual or checklist |
| `B` | Bebas (independent mark) | none seen in the samples; standard SPM convention, kept for imports | final-value check, no dependency |
| `M` | Mata markah sains (explanation or calculation point) | Fizik K2 | keyword/equivalence set |
| `F` | Fakta (fact) | Sejarah K2 | keyword set + "any N of M" group |
| `C` | Kandungan / contoh (content point or example) | BI writing, Sejarah examples | manual with AI suggestion |

Confidence: K, N, P, M, F, C = **High** (printed in the samples). B = **Low** (convention, not seen). A and "ECF/OW/ikut": **not adopted** (0 occurrences in the 9 schemes read), kept only as the optional `ecf` field.

#### D4.3 Part-level scheme wrapper

```
scheme {
  kind       "points"
  marks      number               // equals the part's marks (checked at save)
  groups[]   { id, rule: "all" | {any_n: n, of: m, each_marks: k}, point_ids[] }   // "[mana-mana 2 x 1 m]"
  paths[]    [ { id: "A", points[] }, { id: "B", points[] } ]   // Alternatif A/B, "ATAU kaedah penggantian": mark the best path, never add paths
  final      { display, accept[], tolerance?, unit?, must_contain? }   // the final answer, for the D41 final-answer box
  deductions[] { code: "spelling" | "unit" | "sf" | "dp" | "copy", amount, cap }   // "tolak 1 markah ..."
  zero_rules[] text               // "calon menyalin ... 0 markah"
  model_text rich text            // optional human model answer
}
```

#### D4.4 Marks total and partial credit

- Marks exist only on leaf parts; part, question, section and paper totals are computed (matches the .cloud accessor model and NFR-08).
- Partial credit comes only from `points`; `mcq`, `match_letter`, `accepted` are all-or-nothing per item.
- Choose-N sections: the scorer counts the best N attempted questions (kept from .cloud `ExamBestNScorer`), denominators use the same reduction.

#### D4.5 Rubric kind (languages)

```
rubric {
  kind "rubric"
  criteria[] { id, name: "Tema/Tugasan" | "Idea" | "Bahasa" | "Pengolahan" | "Gaya Bahasa" | ..., weight? }
  bands[]    { name: "Cemerlang" | ..., range: [lo, hi], sub_bands: [[28,30],[26,27]]?, descriptors: { <criterion id>: text } }
  floor_band { name: "Tidak mencapai tahap minimum", range: [1, 9] }
  notes[]    text                  // "terima seperti biasa"
  content_points[] point          // BI C1..Cn alongside a language band
}
```

Evidence: `band_rubric` kind exists in .cloud with **0 rows**, so no historical shape to preserve; the BM K1 scheme shows the real shape (4 criteria, 5 bands, 2 to 3 sub-bands each). Essays are **never auto-marked**: the AI proposes a band and per-criterion note, a person confirms (D41-4).

#### D4.6 What does not change from D41 and the old-system findings

Server-trust grading, working/final split, per-point hit/miss explanation, auto marks are suggestions confirmed by a person, scheme revealed only after submit (all kept; see `v2-question-bank-oldsystem-findings.md` "What v2 keeps").

## 4. Decisions D5 to D8: sections, stimuli, blueprints, vocabularies

### D5 Paper sections model

A **Paper** has: `subject`, `level_scope` (T4, T5, or T4+T5), `kertas` (K1, K2, K3, P1, P2 ...; label printed), `paper_code` (1449/1), `duration_min`, `total_marks`, `language_mode`, `instructions[]`, `reference_sheets[]`, and ordered **Sections**.

| Section field | Type | Notes |
|---|---|---|
| `label` | string | printed label ("Bahagian A", "Part 3", "Objektif"); optional `title` ("Sistem dan Aplikasi Bahasa") |
| `instruction` | rich text | free text, plus the derived line from the rule |
| `rule` | `all` or `choose` | `{type: "choose", n: 3}` |
| `question_count` | int | number of questions **on the paper** (not the number to answer) |
| `mark_budget` | int | marks the section is worth **after** choose-N (this is what DATA left empty) |
| `marks_per_question` | int or list | for sections where all questions are equal (Sejarah K2: 10 each in A, 20 each in B) |
| `allowed_modes[]` | modes | from the blueprint (MCQ-only sections, writing-only sections) |
| `compulsory` | bool | "Soalan ini mesti dijawab" (Fizik K2 Bahagian C: 1 compulsory question; BM K1 Bahagian A) |
| `answer_medium` | `on_paper` / `separate_book` / `omr` | the real papers distinguish answer space, answer book and objective answer sheet; informational |
| `stimulus_policy` | `none` / `group` / `per_part` | how stimuli are used; informs the authoring UI |

Rules observed in the PAPER sample (all expressible):

- "Jawab semua soalan" (all): every section of every K1/P1 and Matematik K2 A and B.
- "Jawab satu soalan" (choose 1 of M): Matematik K2 C (1 of 2), Fizik K2 B (1 of 2), BM K1 B (1 of 4), BI P2 Part 3 (1 of 3), Sains K2 12/13.
- "Jawab tiga soalan" (choose 3 of 5): Sejarah K2 Bahagian B.
- "Soalan ini mesti dijawab" (single compulsory question): Fizik K2 C, BI P2 Parts 1 and 2, BM K1 A (with a choice of e-mail inside the question).
- Compound "Bahagian C - Soalan 11 (wajib) / Soalan 12 atau 13 (pilih satu)" (Sains K2 in DATA) is modelled as two sections (one `all` with 1 question, one `choose 1 of 2`).
- Sections of unequal size inside one paper: Matematik Tambahan K2 A 7 questions answer all / B 4 questions answer 3 / C 4 questions answer 2 (confirmed from the printed section headings).

### D6 Stimulus model including groups (D41)

| Entity | Fields |
|---|---|
| `stimulus` | `id`, `kind` (`passage`, `image`, `diagram`, `table`, `graph`, `map`, `infographic`, `audio`), `body` rich text `{ms,en}`, `asset_id`, `caption`, `label` ("Rajah 3", "Teks 2", "Bahan 1"), `alt_text` (required for image-like kinds), `source_citation`, `reusable` bool |
| `stimulus_group` | `id`, `stimulus_ids[]` (1 to 3), `question_ids[]` in published order, `label` ("Soalan 5 hingga 8"), `scope`: `section` or `paper`, `keep_together` = true (always) |
| `part.stimulus_ref` | a stimulus used by one part only (Sejarah (c) sources, BM Komsas texts) |
| `option_bank` | lettered options shared by the items of a group (BI Part 4 and 5) |

Rules:
1. A stimulus is stored once; questions, parts and groups reference it. Re-import of the same figure reuses the existing row (hash of asset or normalised text). DATA: 946 of 1,931 stimuli (49%) are orphans created by per-question import.
2. A group is a unit for **every** assembly: Kertas Pilihan, Jana Kertas, Latih Tubi, class sets. A draw takes the whole group or none, keeps its order, and a section target can only be met by whole groups. (m28 already implements this; the contract is now explicit.)
3. A group may span sub-ranges inside a section ("Q5 to Q8 of 40"); pinning is per group, not per section (fixes old finding A.1 and A.4).
4. Display: pinned while any member is shown (sticky at the 42vh pattern on phones); a missing asset blocks serving (AC-24.4).
5. Kinds used by the sample papers: image/diagram/graph (all sciences and maths), table (Fizik, Matematik, Sains), passage (BM, BI, Sejarah), per-part sources of mixed kind (Sejarah: text extract, news headline, photograph, song lyric, notice, map), **audio** (BI listening is a separate paper: the Drive folder holds an mp3 for BI K3/Listening; deferred with Listening and Speaking, see D7).
6. Sizes seen in PAPER: BI P1 Part 2 has 1 passage with 10 blanks (cloze), Part 3 1 passage with 8 questions, Part 4 1 article with 6 gaps, Part 5 1 text set with 8 items; Matematik K1 figures belong to 1 question each; Fizik K2 each question has its own figures and tables (each question is a stimulus group of one); BM K2 B uses 3 materials for Q6 and poem + text for Q7. DATA: passages are shared by up to 76 questions.

### D7 Paper blueprint per subject x kertas (launch scope)

Format: `Blueprint { subject, kertas, paper_code, duration_min, total_marks, language_mode, auto_markable, sections[ {label, rule, question_count, marks, modes, topic_weights?} ], status (Draf/Disahkan), provenance, confidence }`. A blueprint is a **validator and a generator recipe** (D32 requires generation to use it; in .cloud it is a validator only and `BlueprintConformance` ignores generation).

Marks are the paper's printed marks; "q" = questions on the paper; "(n of m)" = candidate answers n of m. **Provenance tags per row.**

| Subject | Kertas / code | Duration | Total | Sections (label: rule, q, marks, modes) | Source | Confidence |
|---|---|---|---|---|---|---|
| **Matematik** | K1 1449/1 | 75 min (official, INFERRED); printed "1 jam 30 min" on the Johor scheme cover; DB empty | 40 | single section "Objektif": all, 40 q, 40, `mcq` (4 options A-D); bilingual; 1 mark each | PAPER (Johor) + DATA (DB blueprint 40/40, `derived`) + m28 | High (structure) / Low (duration) |
| | K2 1449/2 | 150 min (INFERRED; not printed in the text layer) | 100 | A: all, 10 q (Q1-10), 40 marks, short/working/drawing; B: all, 5 q (Q11-15), 45 marks (9 each); C: choose 1 of 2 (Q16-17), 15 marks; bilingual | PAPER (Johor, printed "[40 markah]", "[45 markah]", "[15 markah]") | High (structure) |
| **Matematik Tambahan** | K1 3472/1 | 120 min (INFERRED; cover not read) | 80 (printed section marks 64 + 16) | A: all, 12 q (Q1-12), 64 marks, `short`/`working`; B: choose 2 of 3 (Q13-15), 8 marks each, 16 marks; bilingual; K/N/P scheme | PAPER (OCR of the scanned paper: "[64 markah] Jawab semua soalan", "Jawab dua soalan"; scheme headings and question numbers 1-15) | Medium-High (structure), Low (duration) |
| | K2 3472/2 | 150 min (INFERRED; cover not read) | 100 | A: all, 7 q (Q1-7), 50 marks; B: choose 3 of 4 (Q8-11), 10 marks each, 30 marks; C: choose 2 of 4 (Q12-15), 10 marks each, 20 marks; Bahagian C holds the four elective-package topics; bilingual | PAPER (OCR: "[50 markah] Jawab semua soalan", "[30 markah] ... empat soalan. Jawab tiga soalan", "[20 markah] Jawab dua soalan"; scheme totals of 10 for Q8-15) | High (structure), Low (duration) |
| **Fizik** | K1 4531/1 | 75 min (printed "1 jam 15 minit") | 40 | single section: all, 40 q, `mcq` with 3 or 4 options | PAPER | High |
| | K2 4531/2 | 150 min (printed) | 100 | A: all, 8 q (marks 4,5,6,9,9,9,9,9 = 60), short/structured/drawing/calculation; B: choose 1 of 2 (Q9-10), 20 marks; C: compulsory, 1 q (Q11), 20 marks; bilingual | PAPER (cover table, scan) | High |
| **Sejarah** | K1 1249/1 | 90 min (printed "1 jam 30 minit") | 40 | single section: all, 40 q (20 on Tingkatan 4 and 20 on Tingkatan 5; 2 per Bab, 10 Bab per form), `mcq` | PAPER; DATA blueprint exists (40/40, `derived`) | High |
| | K2 1249/2 | 90 min (printed) | 100 | A: all, 4 q (10 marks each, parts (a)(b)(c)), 40 marks; B: choose 3 of 5 (Q5-9), 20 marks each, 60 marks; each part may carry its own source | PAPER (cover table); DATA draft SEJ K2 B: choose 3 | High |
| **Bahasa Melayu** | K1 1103/1 | 120 min (printed "2 jam"; DATA 120) | 100 | A: compulsory question with a choice of 2 e-mail prompts, 30 marks, `essay`, 150-200 words; B: choose 1 of 4, 70 marks, `essay`, 350-500 words | PAPER + DATA (BM K1: A 30 `answer_all`, B 70 `choose_n 1`, `spec`) | High |
| | K2 1103/2 | 150 min (printed "2 jam 30 minit"; DATA 150) | 100 | A "Sistem dan Aplikasi Bahasa": all, 5 q (8/6/10/5/6 = 35), `structured`/`short`; B "Pemahaman": all, 3 q (Q6-8), 35 marks, stimulus per question; C "Rumusan": all, 1 q, 30 marks, `essay` (summary, word-limited) | PAPER + DATA (A 34.5-35, B 35, C 30) | High |
| **Bahasa Inggeris** | P1 1119/1 | 90 min (DATA); not printed in the text we have | 40 | Part 1: all, Q1-8, 8 q, `mcq` A-C on short stimuli; Part 2: all, Q9-18, 10 q, `mcq` A-D (cloze gaps of one passage); Part 3: all, Q19-26, 8 q, `mcq` A-D (reading); Part 4: all, Q27-32, 6 q, `match` A-H (gapped text); Part 5: all, Q33-40, 8 q (Q33-36 `match` A-F, Q37-40 `short` one word) | PAPER + DATA (Part 1: 8; Part 2: 10; Part 3: 8; Part 4: 6; Part 5: 4 + 4) | High |
| | P2 1119/2 | 90 min (DATA; INFERRED 105) | 60 | Part 1: compulsory, 20 marks, `essay` (about 80 words e-mail); Part 2: compulsory, 20 marks, `essay` (125-150 words, three content points); Part 3: choose 1 of 3 (Q3 story / Q4 article / Q5 review), 20 marks, `essay` (200-250 words) | PAPER + DATA (Part 3 `choose_n 1`; 20 marks each) | High (structure) |
| **Sains** (DB only, no DSKP-aligned paper in the sample) | K1 | 75 min (DB) | 40 | single section `mcq` | DATA | Medium |
| | K2 | 150 min (DB) | 92 or 104 (DB conflict, see below) | A all 4 q (29); B all 6 q (41); C: Q11 compulsory (10), Q12 or Q13 choose 1 (12 each) | DATA (published paper) | Low |
| **Kimia, Biologi** (DB only) | K1 | not set | 40 (DB) vs 50 (format note in DB) | single `mcq` | DATA (`derived`) | Low |
| | K2 | not set | 100 (DB `spec`) | A all; B choose 1 (20 marks) | DATA (`spec`, "draft; confirm against LPM") | Low |
| **Pendidikan Islam, Pendidikan Moral** | | | | not derivable: no paper, no DB paper rows; DSKP gives curriculum only | none | none |

Notes on the table:
- **DB blueprints are weak:** 36 blueprints, 19 empty skeletons, 11 "derived" (single MCQ section with 40 marks), 6 "spec". They agree with the papers where both exist (Sejarah K1, BM, BI Part counts, Matematik K1). They carry **no duration at all (0 of 36)** and no topic weighting.
- The Sains K2 conflict: DB totals 104 if both Q12 and Q13 are counted and 92 if only the best one counts; neither is 100. This is a defect of the DB paper, not a real format. Do not copy it.
- **Duration conflicts** to resolve (non-blocking, Q-S1): Matematik K1 (Johor printed 90, convention 75), BI (DB 90 for both papers), Matematik K2 (not visible). Proposal: each Paper stores its own printed duration; the Blueprint carries a default marked Low until LPM confirms.
- **Not in launch scope but in the papers:** BM Kertas 3 and 4 and BI Paper 3/4 (listening, speaking) exist on the Drive and as `paper_documents` (BM 2 + 4, kertas 3/4). They need audio and oral marking. Deferred.
- **Topic weighting (JSU)** is only approximated from one paper per subject (section 8.2). Blueprints store `topic_weights` per section as `{unit_code: target_count}` but mark them INFERRED until a JSU is shared (D40(e) offered KPM documents).
- Blueprint v2 additions over .cloud: `mark_budget` and `question_count` are mandatory, `expected_modes` becomes `allowed_modes`, a new `topic_weights` and `cognitive_mix` (share of TP1-2 / TP3-4 / TP5-6) are optional, and **generation reads the blueprint** (D32).

### D8 Controlled vocabularies

| Vocabulary | Values | Source |
|---|---|---|
| **Cognitive level** (`cognitive_level`) | integer 1 to 6, aligned to DSKP Tahap Penguasaan TP1 to TP6 (descriptors in each subject JSON, general and per unit/SK). Derived label: `LOTS` = 1-2, `MOTS` = 3, `HOTS` = 4-6 (the legacy structured bank uses exactly this: "LOTS 2", "MOTS 3", "HOTS 4/5/6" with counts in 2.1; "KBAT" = HOTS = TP4 and above) | DSKP + DATA |
| **Difficulty** (`difficulty_tp`) | integer 1 to 6 = intended TP of the question; band `Rendah` (1-2), `Sederhana` (3-4), `Tinggi` (5-6); later `difficulty_empirical` (share correct from student attempts, not in this schema's v2.0 scope) | user brief (TP mapping) |
| **Language** (`language`) | `ms`, `en`, `ms+en` (stacked bilingual, both texts stored), `ar` (Arab), `jawi` | PAPER (Matematik, Fizik K1/K2 are `ms+en`; BM `ms`; BI `en`; Sejarah `ms`); NFR-09 |
| **Paper type / exam type** | `sebenar` (SPM), `percubaan`, `modul`, `topikal` (the Drive has a folder of topical questions "SOALAN TOPIKAL"), `latihan` | DATA (`exam_types`: percubaan, sebenar, modul) + PAPER |
| **Exam board / body** | the 22 values in .cloud `exam_boards`: 16 states (Johor ... WP Putrajaya), MRSM, SBP, SABK, SMKA, SPM(U), PPD; add `lpm` (Lembaga Peperiksaan, official) and `mpsm` (Majlis Pengetua Sekolah Malaysia, issuer of the Selangor trial papers) | DATA + PAPER |
| **Kertas label** | `K1`, `K2`, `K3`, `P1`, `P2`, `P3`, `P4`; printed code kept (1449/1) | PAPER |
| **Section rule** | `all`, `choose` | DATA |
| **Answer mode** | D1/D2 list | |
| **Stimulus kind** | D6 list | |
| **Mark-point code** | K, N, P, B, M, F, C | D4 |
| **Question status words** | Draf, Semakan, Lulus, Terbit, Diarkib (no change) | v2-question-bank 4.1 |
| **Source kind** | `lpm_official`, `state_trial`, `school`, `publisher`, `teacher_own`, `ai_variant` | NFR-05, Q4 |

## 5. Decisions D9 to D12: curriculum tag, metadata, duplicates, lifecycle

### D9 Curriculum tagging model

Generic tree (the same table for every subject; the hierarchy names differ, the depth does not):

```
Subject (code)  ->  Level (T4 | T5 | ...)  ->  Grouping  ->  Unit  ->  SK (content standard)  ->  SP (learning standard)  ->  TP descriptor per Unit (or per SK)
```

| Level in tree | Matematik / Mat Tambahan / Fizik | Sejarah | BM / BI |
|---|---|---|---|
| Grouping | Bidang / Learning Area / Theme | Tema | none (skill families) |
| Unit | Tajuk 1.0 ... | Tajuk 9-15 | skill 1.0 ... 5.0 |
| SK / SP | 1.1 / 1.1.1 | 9.1 / 9.1.1 (and K-codes for citizenship) | 3.4 / 3.4.3 |
| TP descriptors | per Unit | per SK | per skill |

What a question carries (final rule, with evidence in section 8.2):

| Tag field | Rule | Why |
|---|---|---|
| `subject`, `level` | required | the 13 DSKP extracts and .cloud both have them; **`level` is missing on every canonical question today** |
| `unit_code` | required at Terbit | topic coverage and blueprint topic weights work at unit level; this is the level the real papers distribute evenly (Fizik K1 follows unit order; Sejarah K1 has 2 questions per Bab) |
| `sk_code` | derived from `sp` | one SP belongs to one SK |
| `sp_codes[]` | required at Terbit, 1 to 3 | an SP is the finest curriculum target; a question usually targets one, and a multi-part question may target several (one per leaf part is allowed) |
| `tp` | required at Terbit | cognitive level; DSKP gives TP descriptors per unit, so it cannot be derived from the SP |
| `textbook_ref` | optional `{bab, tingkatan, muka_surat}` | Sejarah's own marking scheme tags every answer this way ("B3T4 M56"); Bab does not equal SK (10 Bab per form against 12 / 11 SK) so it is a second, optional key with a lookup Bab -> SK maintained by Admin |
| `form_origin` | `T1`..`T5` | SPM Matematik K1 mixes Tingkatan 1 to 5 content; DSKP extracts cover T4-5 only. A question outside the loaded DSKP carries `unit_code = null` and `form_origin = T1..T3` and may be tagged to a "T1-T3" holding unit (see open question Q-S2) |
| `kbat` | derived | `tp >= 4` |

Rules: free-text topic is removed (DATA: 68 of 5,704 use it); the AI suggests `unit`, `sp`, `tp` with confidence (v2-question-bank US-05); curriculum nodes are data, versioned by edition (DSKP "September 2018" and later reissues), so a corrected DSKP extract updates the tree without touching questions (they reference stable node codes).

### D10 Per-question metadata

| Field | Type | Notes |
|---|---|---|
| `year` | smallint | DATA 2021-2025 (70 of 82 source papers are 2025); PAPER 2025 |
| `exam_type` | enum | D8 |
| `exam_board` | enum | D8; folder names on the Drive map to it (JOHOR, KEDAH, ..., MRSM, SBP, SMKA, SABK) |
| `set_label` | string | "Set 1" (the trial papers print SET 1 / SET 2) |
| `paper_code` | string | 1449/1, 3472/2 ... |
| `source_paper_id` | ref | `source_papers` equivalent: file hash, natural key, page and region (US-16) |
| `number_label` | string | printed number ("12", "5(a)") |
| `source_kind`, `rights_status` | enum | `own`, `school`, `official_lpm`, `third_party` (with decision), `unclear`; trial papers from state agencies and MPSM are `third_party` until a rights decision is recorded (Q4 default) |
| `contributor_id` | ref | uploading Guru (not shown to students) |
| `import_issues[]` | list | DATA has 96 papers with import issues; keep as a structured list |
| `explanation` | rich text | optional worked explanation shown after answering |

### D11 Duplicate definition

Evidence: 183 normalised-stem groups (first 150 alphanumeric characters) cover 982 of 5,704 canonical questions (17.2%), group size up to 38; 159 of the 183 groups span more than one source paper; the old system already ran a dedupe once (`_dedup_map` 1,630 rows) and the generator dedupes by normalised stem in code; 41 questions are legitimately placed in 2 papers.

| Case | Verdict | Handling |
|---|---|---|
| Same normalised stem + same option set (order-insensitive) + same figure/asset hash + same numbers | **Duplicate (exact)** | blocked at Semakan unless linked as a version or rejected |
| Same stem and structure, **different numbers or a different figure** | **Variant, not a duplicate** | allowed; linked to a `family_id` so Jana Kertas can avoid two variants in one paper |
| Same question in two different papers | **One question, two placements** | never copied; paper placement stores `number_label`, `section` and optional `marks_override` |
| Near match >= 0.85 similarity, different wording | **Possible duplicate** | reviewer decides (US-06), threshold is [Default] |
| Same stem, different language rendering (BM and EN versions) | Same question | merged into one bilingual question |
| Bank-wide reuse of one stimulus | Not a duplicate | one stimulus, many questions (D6) |

### D12 Lifecycle

Keep `v2-question-bank.md` 4.1 exactly: question Draf -> Semakan -> Lulus -> Terbit -> Diarkib with the transitions and actors already specified; Paper Draf -> Semakan -> Terbit -> Diarkib (paper Terbit needs every question Terbit, group integrity and blueprint conformance, US-12). Mapping from .cloud for any future reload: draft -> Draf; reviewed -> Semakan; approved -> **Lulus** (not Terbit: .cloud "approved" was live; v2 requires an explicit publish after the gate); archived -> Diarkib; paper `in_review` -> Semakan, `published` -> Terbit. Additional rules from the data:
- A question placed in a published paper cannot be edited in place; edit makes version n+1 (the .cloud `pinned_snapshot_id` on 1,653 of 1,694 placements shows the same need; `question_revisions` is empty, so versions start fresh).
- Withdraw of a question inside a published paper flags the paper "Perlu semakan" (AC-14.2).
- Publish gate must include: every leaf has a key; stimulus assets resolve; group integrity; **tags complete (unit, SP, TP)**; marks sum equals blueprint marks for a paper.

## 6. Entity overview (for the architecture task that follows)

| Entity | Key fields (summary) | Relations |
|---|---|---|
| `curriculum_node` | code, subject, level, kind (grouping/unit/sk/sp), title, parent, edition, tp_descriptors (unit or sk) | tree |
| `stimulus`, `option_bank`, `stimulus_group` | D6 | `stimulus_group` -> ordered question ids |
| `question` (+ version) | D2 common fields | -> parts, -> stimulus refs, -> group, -> tags |
| `part` (tree) | label, prompt, marks, mode, options, config | parent part |
| `answer_key` | kind, content JSON (D3/D4), per leaf part | 1 per leaf |
| `paper`, `paper_section`, `paper_placement` | D5 | placement = question + section + number_label + marks_override + pinned version |
| `blueprint`, `blueprint_section` | D7; versioned | paper conforms to blueprint version |
| `source_paper` / `submission` | file, hash, page, rights | question provenance |
| `duplicate_family` | family_id, relation (exact/variant) | questions |
| `audit_event` | v2-question-bank US-15 | |

## 7. Mapping table: .cloud field -> v2 field (for future reloading)

| .cloud | v2 | Transform |
|---|---|---|
| `exam_questions.id` | `question.legacy_ref` | keep as provenance only; new uuid |
| `exam_questions.stem` | `question.stem.ms` (or `.en`) | language by cue words if mixed; bilingual pairs merged by number_label |
| `exam_questions.number_label` | `question.number_label` | copy |
| `exam_questions.position` | `paper_placement.position` | |
| `exam_questions.chapter_id`, `topic`, `difficulty` | `curriculum`, `tp` | **all empty in DATA (0, 68, 0)**; must be re-derived by AI + review; do not copy the 68 free-text topics |
| `exam_questions.status_id` | `question.status` | draft -> Draf; reviewed -> Semakan; approved -> Lulus; archived -> Diarkib |
| `exam_questions.source_paper_id`, `exam_paper_id` | `question.source_paper`, `paper_placement` | |
| `question_parts.parent_part_id`, `position`, `label`, `prompt` | `part.parent`, `order`, `label`, `prompt` | copy |
| `question_parts.answer_mode_id` | `part.mode` | mcq -> `mcq`; short_text -> `short_text`; numeric -> `numeric`; working_shown -> `working`; extended_essay -> `essay`; essay_choice -> `essay` + section `choose` (see D5); mcq with 6 or 8 options inside a BI group -> candidate `match_letter` (detect by shared option text across parts) |
| `question_parts.marks` | `part.marks` | copy; parent marks must be 0 |
| `question_parts.word_limit` | `part.word_range.max` | min unknown (null) |
| `question_parts.config` (`{"unit": ...}`) | `part.unit` | |
| `question_parts.stimulus_id` | `part.stimulus_ref` | |
| `part_options.label/body/is_correct/is_distractor` | `part.options[]`, key `option` | `is_distractor` dropped (derived); 322 MCQ parts have no correct option -> stay Draf |
| `part_answer_keys` kind `single_key` `{option_id}` | key `option` `{correct: label}` | resolve option id to label |
| kind `accepted_values` `{values, tolerance}` | key `accepted` | tolerance "0" string -> `{tol: 0, tol_kind: abs}`; unit from part config |
| kind `mark_scheme_points` `{points: [...]}` | key `points` | each string -> point with `code` unknown, `marks` null; **every point must be re-marked (marks and code) before Terbit**; the 7 object points keep their text |
| kind `band_rubric`, `model_answer`, `mapping` | `rubric`, `points`/`model_text`, `mapping` | 0 rows in DATA, nothing to convert |
| `stimuli.kind` / `body` / `asset_id` / `caption` / `source_citation` | `stimulus.kind` / `body` / `asset` / `caption` / `source_citation` | orphans (946) dropped |
| `question_stimulus` | `question.stimulus_refs` and, where several questions share a stimulus, `stimulus_group` | create a group per shared stimulus (135) **only after the contiguity check**; the 63 non-contiguous ones are flagged |
| `media_assets.alt` | `stimulus.alt_text` | 379 of 1,139 images have no alt text: author or AI must add |
| `paper_sections.label/position/instruction_text/selection_rule/select_count/mark_budget` | `paper_section.*` | selection rule `answer_all` -> `all`, `choose_n` -> `choose` |
| `exam_papers.title/kertas/duration_minutes/instructions/reference_assets/cover_code` | `paper.title/kertas/duration/instructions/reference_sheets/paper_code` | |
| `exam_paper_questions` (`number_label`, `marks_override`, `pinned_snapshot_id`) | `paper_placement` | snapshot -> pinned version |
| `paper_blueprints`, `blueprint_sections` | `blueprint`, `blueprint_section` | 19 empty skeletons skipped; `expected_answer_modes` -> `allowed_modes`; `source` derived/spec/draft -> provenance + status |
| `source_papers` (subject, kertas, year, board, exam_type, file_hash, natural_key) | `source_paper` | copy |
| legacy `questions` (type mcq, body, explanation, difficulty_level, source, image_path, status) | `question` (type `mcq`) | difficulty 1-5 is **not** TP; drop or store as `legacy_difficulty`; no chapter; explanation kept |
| legacy `question_options` | `part.options` | |
| legacy `structured_questions` (stimulus, kbat_level, total_marks) + `structured_sub_questions` (number, body, marks, scheme) | question + group of parts | `kbat_level` text -> `cognitive_level` (LOTS 1-2, MOTS 3, HOTS 4-6 -> integer after "n"); scheme free text -> `points` needing re-marking (68.3% empty) |
| legacy `pksk_questions` | question with a PKSK tag set | separate vocabulary (bahagian, domain) |

Per D29(a) questions are not migrated automatically; this table is the contract if the user later decides to reload part of the archive through the intake pipeline.

## 8. Cross-reference of the real papers with the DSKP extracts

This section answers the second coordinator brief: where each real question sits in the DSKP, how coverage looks, how tagging should work, where the DB and the DSKP disagree, and where the DSKP extract looks wrong or incomplete.

### 8.1 How the mapping was done (and how far to trust it)

- Question text was read from text layers (Matematik Johor) or from OCR of scans (all Selangor papers) and classified by topic keyword against the DSKP unit and SK titles. Where a Matematik/Fizik question names only a figure ("Rajah 6 menunjukkan graf ..."), the unit is inferred from the answer options and the scheme.
- **Confidence per row:** H = unit named by an explicit term (for example "insurans", "kebarangkalian", "pemfaktoran"); M = inferred from stem and options; L = guess from position in the paper. SP-level mapping was attempted only where one SP text matches the verb and object; elsewhere the SK is given.
- TP / cognitive level is **not inferred from the printed papers**: the papers print no TP, and an automatic guess from the verb is unreliable (a "calculate" can be TP3 or TP5). The tagging section below says what to store. Paper position is a weak hint only (Matematik K1 and Fizik K1 follow syllabus order, not difficulty).
- No question text is reproduced in the repo; the labels below are paraphrased topic names.

### 8.2 Coverage tables per subject x kertas

Legend: T4/T5 = DSKP unit; "out" = content from a Tingkatan not in the DSKP extract (T1-T3); counts are questions (K1) or questions with main-topic assignment (K2); confidence in brackets.

#### Matematik K1 (Johor, 40 q)

| Form | DSKP unit | Questions | Count |
|---|---|---|---|
| T4 | 1.0 Fungsi dan Persamaan Kuadratik | Q6 (L), Q36 (L) | 2 |
| T4 | 3.0 Penaakulan Logik | Q30, Q31 (H) | 2 |
| T4 | 4.0 Operasi Set | Q32, Q33 (H) | 2 |
| T4 | 5.0 Rangkaian dalam Teori Graf | Q28, Q29 (H) | 2 |
| T4 | 6.0 Ketaksamaan Linear dalam Dua Pemboleh Ubah | Q34 (H) | 1 |
| T4 | 7.0 Graf Gerakan | Q35 (H) | 1 |
| T4 | 9.0 Kebarangkalian Peristiwa Bergabung | Q26 (M) | 1 |
| T4 | 10.0 Matematik Pengguna: Pengurusan Kewangan | Q19 (H) | 1 |
| T5 | 1.0 Ubahan | Q37, Q38 (H) | 2 |
| T5 | 2.0 Matriks | Q39, Q40 (H) | 2 |
| T5 | 3.0 Insurans | Q20 (H) | 1 |
| T5 | 4.0 Percukaian | Q21 (H) | 1 |
| T5 | 5.0 Kekongruenan, Pembesaran dan Gabungan Transformasi | Q22 (H) | 1 |
| T5 | 6.0 Nisbah dan Graf Fungsi Trigonometri | Q23 (L; may be T3 trigonometric ratios) | 1 |
| T5 | 7.0 Sukatan Serakan Data Terkumpul | Q27 (H) | 1 |
| out (T1-T3) | not in extract | Q1-Q5, Q7-Q18, Q24, Q25 (rounding, indices, sequences, ratio/rate, linear equation, algebraic formula, gradient, angles, distance, area, orthogonal projection, simple probability, mean, standard form, simplification, volume, data collection) | **19** |

Never appear: **T4 2.0 Asas Nombor, T4 8.0 Sukatan Serakan Data Tak Terkumpul, T5 8.0 Pemodelan Matematik**. Of 40 questions, **21 fall on T4-T5 units** and 19 on earlier forms.

#### Matematik K2 (Johor, 17 q; main topic per question)

| Section | Questions and units |
|---|---|
| A (Q1-10) | Q1 polygon, exterior angle (out, T2); Q2 quadratic graph (T4 1.0, M); Q3 sketch quadratic graph, solve (T4 1.0, M); Q4 quantifiers and truth (T4 3.0, H); Q5 matrix method for simultaneous equations (T5 2.0, H); Q6 distance-time graph (T4 7.0, H); Q7 insurance (T5 3.0, H); Q8 cash flow and budget (T4 10.0, H); Q9 sinusoidal graph (T5 6.0, H); Q10 return on investment of shares (T4 10.0, M) |
| B (Q11-15) | Q11 sets (T4 4.0, H); Q12 integers comparison and a linear inequality (out + T4 6.0, L); Q13 income tax and deduction (T5 4.0, H); Q14 stem-and-leaf and dispersion (T4 8.0, M); Q15 tessellation (T5 5.0 SK 5.4, H) |
| C (Q16-17) | Q16 directed graph and shortest route (T4 5.0, H); Q17 drone routes, spanning/minimum path and modelling (T4 5.0 + T5 8.0 candidate, L) |

Unit counts: T4 1.0: 2; 3.0: 1; 4.0: 1; 5.0: 2; 6.0: 1 (part); 7.0: 1; 8.0: 1; 10.0: 2; T5 2.0: 1; 3.0: 1; 4.0: 1; 5.0: 1; 6.0: 1. **Never appear:** T4 2.0, 9.0 (probability of combined events), T5 1.0 (Ubahan), 7.0 (grouped data), 8.0 only as a candidate. Reading K1 and K2 together, **every T4-T5 unit appears at least once except T4 2.0 Asas Nombor** (and T5 8.0 only as a Low candidate): the JSU covers the whole syllabus across the two papers, K1 samples breadth, K2 samples depth.

#### Matematik Tambahan K1 and K2 (Selangor; OCR of scans, confidence mostly M or L)

| Paper | Question | DSKP unit | Conf. |
|---|---|---|---|
| K2 A | Q1 simultaneous equations | T4 3.0 Systems of Equations | H |
| K2 A | Q2 surds and logarithms | T4 4.0 Indices, Surds and Logarithms | H |
| K2 A | Q3 functions and composite functions | T4 1.0 Functions | H |
| K2 A | Q4 quadratic functions (vertex form, parabola) | T4 2.0 Quadratic Functions | H |
| K2 A | Q5 trigonometric identity and graph | T5 6.0 Trigonometric Functions | H |
| K2 A | Q6 triangle with intersecting lines (ratio of segments) | T4 8.0 Vectors | M |
| K2 A | Q7 function with a derived or integrated expression | T5 2.0 / 3.0 | L |
| K2 B | Q8 gradient function, turning point, rate of change, small change | T5 2.0 Differentiation | H |
| K2 B | Q9 parallel lines and a polygon area | T4 7.0 Coordinate Geometry | M |
| K2 B | Q10 table of x and y values, line of best fit | T4 6.0 Linear Law | H |
| K2 B | Q11 not identified | unknown | - |
| K2 C | Q12 particle on a straight line, velocity function | T5 8.0 Kinematics of Linear Motion (elective) | H |
| K2 C | Q13 price index table | T4 10.0 Index Numbers (elective) | H |
| K2 C | Q14 and Q15 scale-drawing warning and a recipe table (ingredient quantities and prices) | T5 7.0 Linear Programming and T4 9.0 Solution of Triangles (elective; order not confirmed) | M |
| K1 A | Q11 counting 10 questions with at-least conditions | T5 4.0 Permutation and Combination | H |
| K1 A | Q12 values of a random variable {0..8} | T5 5.0 Probability Distribution | M |
| K1 A | Q6 rectangle ABCD with given sides | T4 8.0 Vectors or T4 7.0 | L |
| K1 B | Q13 relation between two sets, mapping diagram | T4 1.0 Functions | H |
| K1 other | Q1-Q5, Q7-Q10, Q14-Q15 | not resolved from the OCR | - |

Reading K1 and K2 together the sample touches T4 1.0, 2.0, 3.0, 4.0, 6.0, 7.0, 8.0, 9.0, 10.0 and T5 2.0, 3.0 (L), 4.0, 5.0, 6.0, 7.0, 8.0. **Not evidenced:** T4 5.0 Progressions and T5 1.0 Circular Measure (they may sit in the unresolved K1 questions). The four elective units (T4 9.0, 10.0; T5 7.0, 8.0) all sit in Bahagian C of K2, which confirms that the extract flag electivePackage corresponds to a real paper section. The scanned question pages carry the Bahasa Melayu and English text stacked, so OCR splits some formulas; a clean pass needs the intake pipeline, not this analysis.

#### Fizik K1 (Selangor, 40 q) and K2 (11 q)

| Form | DSKP unit | K1 questions | K2 questions |
|---|---|---|---|
| T4 | 1.0 Measurement | Q1-Q2 (M) | none as main topic |
| T4 | 2.0 Force and Motion I | Q3-Q5 (M) | Q11 (M, force and acceleration, 20 marks) |
| T4 | 3.0 Gravitation | Q6 (H) | Q6 (H, satellites) |
| T4 | 4.0 Heat | Q7-Q9 (H) | Q4 (H, specific latent heat) |
| T4 | 5.0 Waves | Q10-Q14 (H) | Q5 (H, refraction in a ripple tank) |
| T4 | 6.0 Light and Optics | Q15-Q19 (H) | Q8 (M, lenses) |
| T5 | 1.0 Force and Motion II | Q20-Q22 (M) | none |
| T5 | 2.0 Pressure | Q23-Q27 (H) | Q9 (H, hydraulic system, 20 marks) |
| T5 | 3.0 Electricity | Q28-Q31 (H) | Q10 (H, resistance, 20 marks) |
| T5 | 4.0 Electromagnetism | Q32-Q33 (H) | Q7 (H, DC motor) |
| T5 | 5.0 Electronics | Q34-Q36 (L, by order) | Q3 (H, rectification, capacitor) |
| T5 | 6.0 Nuclear Physics | Q37-Q38 (H) | Q2 (H, radioactive decay, mass defect) |
| T5 | 7.0 Quantum Physics | Q39-Q40 (H) | Q1 (H, photoelectric effect) |

All 13 DSKP Fizik units appear in K1 (T4: 19 q, T5: 21 q). K2 touches 11 of 13 (no main-topic question for T4 1.0 or T5 1.0). Unit order = question order in K1: a strong hint for the intake parser (position predicts unit).

#### Sejarah K1 (Selangor, 40 q; scheme prints Bab / Tingkatan / Muka surat) and K2 (9 q)

| Observation | Value |
|---|---|
| K1 | 2 questions per Bab, 10 Bab per form (Q1-20 = Tingkatan 4, Q21-40 = Tingkatan 5); every Bab present. |
| DSKP extract | T4: Tajuk 9, 10, 11 = 3 Tajuk and **12 SK**; T5: Tajuk 12-15 = 4 Tajuk and **11 SK**. |
| Bab -> SK (INFERRED, to be confirmed with the textbook table of contents) | T4 Bab 1 Warisan Negara Bangsa (SK 9.1); Bab 2 Nasionalisme (9.2-9.3); Bab 3 Konflik Dunia and Japanese occupation (10.1-10.2); Bab 4 Era Peralihan Kuasa (10.3); Bab 5 Persekutuan Tanah Melayu 1948 (10.4); Bab 6 Ancaman Komunis (10.5); Bab 7-10 kemerdekaan, pilihan raya, perlembagaan 1957, pemasyhuran (11.1-11.4). Same pattern for T5 (12.1-15.3 = 11 SK into 10 Bab). Confidence L-M. |
| K2 Q1 | Hukum Kanun Melaka and Undang-undang Laut (T4 SK 9.1; M) |
| K2 Q2 | first cabinet of the Federation (T4 SK 11.1-11.2; M) |
| K2 Q3 | elections and fundamental liberties (T4 SK 11.2 / T5 SK 12.2; M) |
| K2 Q4 | Rukun Negara (T5 SK 14.1; L) |
| K2 Q5 | Federation of Malaya 1948 (T4 SK 10.4; H) |
| K2 Q6 | constitutional commission (T4 SK 11.3; M) |
| K2 Q7 | federal-state cooperation (T5 SK 12.4; H) |
| K2 Q8 | 13 May 1969 (T5 SK 13.2 / 14.1; L) |
| K2 Q9 | Non-Aligned Movement and ASEAN (T5 SK 15.2-15.3; H) |

Sejarah K2 uses 9 of 23 SK; K1 touches every Bab. Elements of civic education (K-codes) are not examined separately.

#### Bahasa Melayu K1 and K2 (units are skills)

| Paper | Part | DSKP unit / SK | Notes |
|---|---|---|---|
| K1 | Bahagian A (e-mel) | 3.0 Kemahiran Menulis, SK 3.4 (T5 SP 3.4.3 various essay types) and 3.5 | stimulus-based writing, 150-200 words |
| K1 | Bahagian B (4 prompts) | 3.0 Kemahiran Menulis, SK 3.4 | open-response essay, 350-500 words |
| K2 | A Q1 (verbs with prefix) | 5.0 Aspek Tatabahasa, SK 5.1 / 5.2 (T4 SP 5.2.2) | morphology |
| K2 | A Q2 (inverted sentences) | 5.0 SK 5.3 (T4 SP 5.3.3) | syntax |
| K2 | A Q3 (error correction) | 3.0 SK 3.6 Mengedit dan memurnikan teks | |
| K2 | A Q4 (classical to modern text) | 3.0 SK 3.5 / 5.0 SK 5.3 (L) | |
| K2 | A Q5 (proverbs) | 4.0 Aspek Seni Bahasa, SK 4.2 | |
| K2 | B Q6 (3 materials) | 2.0 Kemahiran Membaca, SK 2.3 (T5 SP 2.3.5) | comprehension |
| K2 | B Q7 (poem / text) | 4.0 SK 4.1 (4.1.2 poetry) | Komsas |
| K2 | B Q8 (novel) | 4.0 SK 4.1 (4.1.1 prose) | Komsas |
| K2 | C Q9 (summary) | 2.0 SK 2.3 and 3.0 SK 3.5 (L) | |

Unit 1.0 Kemahiran Mendengar dan Bertutur (listening and speaking) is **not examined on the written papers** (BM Kertas 3 / 4 are separate). The DSKP gives no TP for units 4.0 and 5.0 (noted by the extract) so TP for BM Seni Bahasa and Tatabahasa questions needs the general descriptors.

#### Bahasa Inggeris P1 and P2 (units are skills)

| Paper | Part | DSKP unit | Notes |
|---|---|---|---|
| P1 | Part 1 (8 q, short stimuli) | 3.0 Reading Skills | |
| P1 | Part 2 (10 q, cloze) | 3.0 Reading / grammar in context (DSKP lists grammar items per form, not as a unit) | |
| P1 | Part 3 (8 q) | 3.0 Reading Skills | |
| P1 | Part 4 (6 q, gapped text) | 3.0 Reading Skills | |
| P1 | Part 5 (8 q) | 3.0 Reading Skills (scanning, summary completion) | |
| P2 | Parts 1, 2, 3 | 4.0 Writing Skills | e-mail, essay, story/article/review |
| not on P1/P2 | | 1.0 Listening, 2.0 Speaking, 5.0 Literature in Action | listening and speaking sit on Paper 3 / 4 (Drive holds audio and a Paper 4 scheme); Literature appears only in some years |

#### Summary of "never appear in the sample"

| Subject | DSKP units / skills with no question in the sample papers |
|---|---|
| Matematik | T4 2.0; T5 8.0 (only as a Low candidate) |
| Fizik | none in K1; K2 main topics skip T4 1.0 and T5 1.0 |
| Sejarah | none in K1; K2 covers 9 of 23 SK |
| BM | 1.0 Mendengar dan Bertutur |
| BI | 1.0 Listening, 2.0 Speaking, 5.0 Literature in Action |
| Matematik Tambahan | T4 5.0 Progressions and T5 1.0 Circular Measure not evidenced; all four elective units appear in K2 Bahagian C |

### 8.3 How question tagging must work in v2 (based on what the real papers need)

Required curriculum fields at Terbit and the rule behind each:

| Field | Required | What the papers show | Rule |
|---|---|---|---|
| `subject`, `level` | yes | A Matematik K1 mixes forms; Selangor papers are labelled "Tingkatan 5" yet include Tingkatan 4 content (Sejarah K1 half; Fizik K1 19 of 40 on T4). | `level` is the form of the **curriculum target** (SP), not of the paper. A paper has a `level_scope`. |
| `unit_code` | yes | Papers distribute by unit/Bab (Fizik K1 in unit order; Sejarah 2 per Bab). | Required; null only with `form_origin` T1-T3 for out-of-extract content. |
| `sp_codes[]` (and derived SK) | yes (SK derived) | A K2 question often spans several SPs (calculation plus explanation). | 1 to 3 SP per question; per-leaf-part tags allowed for multi-topic questions (Matematik K2 Q12 mixes an integer comparison with an inequality). |
| `tp` (1-6) | yes | Papers print none; DSKP TP is per unit (Matematik, Fizik, BM, BI) or per SK (Sejarah, Pendidikan Islam). | Stored per question (AI suggests, reviewer confirms). The TP descriptor shown to the reviewer is the unit's (or SK's) own text. |
| `textbook_ref` | optional | Sejarah schemes print Bab/Tingkatan/Muka surat; no other subject does. | Keep as an optional second tag with a Bab -> SK lookup. |
| `form_origin` | yes if outside extract | 19 of 40 Matematik K1 questions are Tingkatan 1-3. | Needed until T1-T3 DSKP is extracted (Q-S2). |

Further rules:
1. **Tag at question level, with optional part-level override.** K1/P1 items are single-part; K2 questions often mix 2 to 4 topics, so a part can carry its own SP while the question keeps the primary one.
2. **Coverage reports are computed from tags**, never stored counts (D11/D12 of CLAUDE.md data-model rules apply to the bank too).
3. **Blueprint topic weights** use `unit_code` targets; the per-paper evidence above is the seed (for example Fizik K1 = T4 19 / T5 21 with per-unit counts in 8.2).
4. **AI suggestion order:** `unit` first (position in paper and keywords are strong), then `sp`, then `tp`; confidence bands as v2-question-bank AC-05.3.
5. **No tag may be free text.** All values come from `curriculum_node` rows.

### 8.4 Where .cloud DB tag data disagrees with DSKP or with the papers

| # | Disagreement | Evidence |
|---|---|---|
| 1 | `chapters` is Tingkatan 5 only; no T4 rows at all, although the legacy bank has T4 questions (for example Matematik T4 4,818, Fizik T4 1,348). | DATA: 686 chapter rows, all T5 |
| 2 | `chapters` rows are **SP-level**, not chapters: `number` = unit number, `title` = SP text, `dskp_code` = SP code, `strand` = unit title. | DATA samples (Matematik 1.1.1, Fizik 1.1.1) |
| 3 | `chapters` incomplete versus DSKP T5 SP counts: Matematik 52 of 57, Matematik Tambahan 63 of 77, Sains 81 of 85, **Sejarah 51 of 96**; Fizik 97 of 97 and Pendidikan Moral 72 of 72 match. | DATA vs DSKP README |
| 4 | **No SK, no TP** anywhere in .cloud. The DSKP README already notes that Fizik, Matematik Tambahan and Tasawwur rows differ from the official text. | DSKP README; DATA |
| 5 | **No question is linked to a chapter** (0 of 5,704 canonical, 0 of 451,518 legacy). Coverage by unit cannot be computed from the DB at all. | DATA |
| 6 | Free-text `topic` is the only taxonomy on canonical questions (68 values, for example Matematik topic names such as "Ubahan", "Matriks", "Graf gerakan") and those names are the Tingkatan 4-5 unit names, consistent with DSKP, but they cover 1.2% of questions and 51 of the 68 are on **draft** questions. | DATA vs DSKP unit titles |
| 7 | Legacy `difficulty_level` 1-5 is filled on 100% but is not a TP (distribution 43,923 / 180,041 / 166,857 / 60,527 / 170 from a ripped databank); legacy `kbat_level` text values LOTS 1-2, MOTS 3, HOTS 4-6 are closer to TP but exist only on structured questions. | DATA |
| 8 | `dskp_tagged = 1` on 90 legacy rows (0.02%): the flag is effectively unused. | DATA |
| 9 | Question-level **level** is not stored on canonical questions; only legacy questions carry `education_level_id`. | DATA |
| 10 | Sejarah papers tag by Bab/Tingkatan/Muka surat; .cloud has nowhere to hold it. | PAPER |
| 11 | The Selangor papers are titled "Tingkatan 5" but the DB's level model would put each paper at one level. A paper-level level is wrong for Sejarah (50% T4), Fizik (47.5% T4) and Matematik (K1 spans T1-T5). | PAPER |
| 12 | DB blueprint durations are missing for all 36 blueprints and BI shows 90/90 against the two different BI papers; Matematik K1 duration differs between sources (75 official convention, 90 printed on one trial scheme, null in DB). | DATA vs PAPER |

### 8.5 Where a DSKP extract looks wrong or incomplete (for later correction)

| # | Subject | Observation | Suggested action |
|---|---|---|---|
| 1 | Sejarah | Extract has 3 Tajuk (12 SK) for T4 and 4 Tajuk (11 SK) for T5; the trial scheme labels 10 Bab per form. This is a structural difference (Bab versus SK), not an error, but there is no Bab level in the extract. Pendidikan Moral and others may have the same textbook-level axis. | Add an optional `bab` attribute and a Bab -> SK map from the textbook contents; mark `INFERRED` until sourced. |
| 2 | Matematik | T4 10.0 "Matematik Pengguna: Pengurusan Kewangan" has only 2 SP (10.1.1-10.1.2), but the papers test **cash flow, budgeting, return on investment of shares** (Q8, Q10, Q19). Either the DSKP SK for shares/investment is missing or those items belong to an earlier form. | Verify against the printed DSKP page (SK "Pengurusan Kewangan" typically includes saving, investment, credit, debt); if SPs are missing, add them. |
| 3 | Matematik | SP texts that carry symbols are truncated (README: symbols drawn as images); example T4 1.1.3 "kesan perubahan nilai dan ke atas graf ..." lost a, b, c. Tagging must not rely on exact SP wording. | Known limit; keep codes as the key. |
| 4 | Matematik | The papers examine Tingkatan 1-3 content (19 of 40 in K1) that the extract does not hold. | Extract T1-T3 DSKP (Matematik at least), or add a "T1-T3" holding unit. |
| 5 | Fizik | Unit titles come from table headings and SK titles from overview lists (per extract note); K1 stems use terms (for example "geometrical optics sub-skills") that map cleanly, so no error seen. T4 1.0 Measurement has 7 SP but the sample K2 has no main-topic question for it (only embedded). | None. |
| 6 | BM | Units 4.0 and 5.0 carry no TP in the extract; Tatabahasa and Seni Bahasa questions therefore have no unit-level descriptor. | Use the DSKP general TP statement or ask the user for the printed table. |
| 7 | BI | The Form 4 edition is "DRAF 1/2018" with placeholder "No learning standard" slots (1.1.4, 1.1.5, 2.3.2). Writing and reading questions map to SK but not to a printed SP when a slot is empty. | Tag to SK for these; request the final edition. |
| 8 | Matematik Tambahan | The extract is the English-language edition; the Selangor papers are bilingual BM/EN, so unit titles in questions are BM or EN. The four `electivePackage` units (T4 9.0, 10.0; T5 7.0, 8.0) appear in Bahagian C of the real K2 (for example index numbers and kinematics). | Keep the English titles as the key; add BM aliases to curriculum nodes. |
| 9 | All | The DSKP README says the SPM exam format is not covered. This document now supplies it from DATA and PAPER; the README line should point here. | Update the README note after approval. |

## 9. Sample PDFs available (OCR / intake test set)

Source: user-shared public Google Drive folder (21 subject folders; each has state/agency folders, then sets, with a `SKEMA_` file next to each paper). Downloaded for internal analysis only to `D:\prestasiplus\sampel-percubaan\<subject>-<state>-2025-set1\` (outside the repo; **never commit these files**).

| Folder | Files | Text layer | Notes |
|---|---|---|---|
| matematik-johor-2025-set1 | K1, K2 and 2 schemes | all 4 text | clean text; bilingual |
| matematik-tambahan-selangor-2025-set1 | K1, K2, SKEMA K1, SKEMA K2 | schemes text; question papers scan | K/N/P scheme |
| fizik-selangor-2025-set1 | K1, K2, 2 schemes | K2 scheme text; papers scan; K1 scheme text (table) | M-code scheme |
| sejarah-selangor-2025-set1 | K1, K2, 2 schemes | schemes text; papers scan | F/C scheme with textbook refs |
| bahasa-melayu-selangor-2025-set1 | K1, K2, 2 schemes | all scan (camera scans) | band rubric, global rules |
| bahasa-inggeris-selangor-2025-set1 | P1, P2, 2 schemes | schemes partly text; papers scan (no cover page in P1/P2) | letter keys, content points |

Total: 24 PDFs, roughly 110 MB. Not downloaded (not cheap or no matching DSKP): Kimia, Biologi, Pendidikan Islam sets, the other 20+ states, Set 2, topical collections, listening audio.

This is the intended **OCR test set** for the intake pipeline: it contains the three scan qualities that matter (clean digital text, camera scans with scanner watermark, mixed text-and-image PDFs), bilingual text, MathML-heavy pages, tables, figures, handwritten-style marker notation, and every scheme style in section 3 / D4. Suggested ground truth: Matematik Johor (text layer), BI P1 letters (scheme), Sejarah K1 answers and references. Copyright: these are state trial papers; internal analysis only (D40(c) source-declaration rules apply when they enter the bank).

## 10. Gap list: current m28 Bijak SPM prototype versus this schema

Compared with `git show origin/feature/v2-frontend:src/modules/m28-bijak-spm/domain/types.ts` (read-only, `types.ts`, `blueprint.ts`, `data/registry.ts`):

| # | m28 today | Needed by this schema | Change |
|---|---|---|---|
| 1 | `SubjectCode = 'MAT' \| 'SN'` | open dictionary: BM, BI, MATH, ADDMATH, SEJ, PHY, plus Sains/Kimia/Biologi | make subject an id/code string from the curriculum tree |
| 2 | `kertas: 1 \| 2` | K1, K2, K3, P1, P2 (BI uses P) | `kertas: string` label plus numeric order; keep the printed `code` |
| 3 | `LeafKind = 'working' \| 'numeric' \| 'short_text'` plus a question-level `mcq` | `mcq` as a leaf mode, `match_letter`, `essay`, `drawing`, `table_fill` | extend `LeafKind`; MCQ becomes a leaf like the others (the type already says "the question is the leaf") |
| 4 | MCQ options: no stated limit, option ids | 3 to 8 options, shared option banks for match groups | `optionBank` on `GroupDef`; items reference it |
| 5 | `QuestionDef.topic: string` | `curriculum {subject, level, unit, sk, sp[], tp, textbookRef?, formOrigin}`, `cognitiveLevel`, `language` | replace the free string with a tag object |
| 6 | `StimulusDef.kind: 'diagram' \| 'passage' \| 'table'` | add `image`, `graph`, `map`, `infographic`, `audio`; part-level stimulus; `{ms,en}` text; alt text required | extend kind; add `PartDef.stimulusId` |
| 7 | No bilingual fields (`stem: string`) | `ms+en` stacked text (Matematik and Fizik papers) | `RichText {ms?, en?}` for stem, prompt, option, point text |
| 8 | `PartDef.answer = {kind, unit}` | unit **checked**, `decimals`, `sig_figs`, `word_range`, `alternatives`, `drawing.kind`, `table.grid` | extend the answer config |
| 9 | `PointDef.code: 'K1' \| 'N1' \| 'P1' \| 'B1'` | `code` letter in K, N, P, B, M, F, C; label separate from marks; explicit marks | `code: 'K'..'C'` plus `label` string |
| 10 | `PointMatch`: `step`, `final`, `unit`, `keywords` | add `all_of` (`&`), `seen`, `implied_ok`, `tolerance`, `sig_figs`, `manual` | extend the union; `step.accept` already holds `@` alternatives |
| 11 | `SchemeDef` kinds `mcq`, `points` | `option`, `accepted`, `mapping`, `points`, `rubric` | add the three missing kinds (`accepted` is the numeric/short path that today is hidden in `FinalDef`) |
| 12 | `points` scheme has `final`, `model` only | `groups` ("any N of M"), `paths` (alternative methods), `deductions`, `zero_rules` | add to `SchemeDef` points variant |
| 13 | `PointDef.requires` (one id), `ecf` with a function | `requires` list; ECF as a declarative rule (no function in data) | replace the callback with `{fromPart, rule}` data so schemes can be stored and loaded |
| 14 | `SectionDef.rule {all} \| {choose n}`, `questionIds` | add `markBudget`, `questionCount`, `compulsory`, `marksPerQuestion`, title | extend `SectionDef` |
| 15 | `PaperDef`: `subject`, `kertas`, `year`, `code`, `durationMin`, `instructions`, `reference` | add `levelScope`, `board`, `examType`, `setLabel`, `languageMode` | extend |
| 16 | `BlueprintSection {label, rule, pool, take}` | `marks`, `allowedModes`, `topicWeights`, `cognitiveMix`, `questionCount`; provenance/confidence | extend; keep group-whole drawing (already correct) |
| 17 | `Blueprint.source: 'Disahkan' \| 'Spec' \| 'Draf'` | map DB values `derived`, `spec`, `draft` | rename or add `Diturunkan` |
| 18 | `PoolEntry {questionId, pool}` | pool defined by tags (subject, level, unit/sp, tp, type, year, kertas, language) | replace the string pool with a tag filter |
| 19 | Two subjects only; Sains paper seeded | seeds for the six launch subjects and their blueprints (section 7) | seed data task (small, per D45: one paper each) |
| 20 | `StoredAnswer` per part, photos on answers | `drawing` answers use photos; `essay` rubric review queue | existing photo store is reusable |

## 11. Task breakdown (follow-up after approval)

| ID | Task | Owner | Depends on | Notes |
|---|---|---|---|---|
| T1 | Approve this proposal (user) | user | none | G2 decision |
| T2 | Convert D1 to D12 into the data model section of `v2-bijak-spm` / `v2-question-bank` architecture docs; ADRs for the three significant choices (leaf modes, mark-point codes, tag tree) | solution-architect | T1 | `docs/architecture/v2-exam-schema-model.md`, `docs/adr/` |
| T3 | Update m28 domain types and seeds per section 10 (PoC size per D45) | frontend-developer | T2 | only the types and two seeded papers |
| T4 | Extract Tingkatan 1-3 Matematik DSKP (and decide on other subjects) | product-analyst | T1 | only if the user approves Q-S2 |
| T5 | Build the curriculum-node table from the DSKP JSONs including TP descriptors and BM aliases | backend-developer | T2 | |
| T6 | Blueprint seed data for the six launch subjects with provenance tags | backend-developer | T2 | section 7 |
| T7 | Verify OCR and intake parsers on the sample set (section 9) | qa-engineer | T2 | ground truth: Matematik Johor, BI letters, Sejarah K1 |
| T8 | Confirm durations, Matematik Tambahan counts and Pendidikan Islam / Moral formats from LPM or a JSU | user / product-analyst | none | non-blocking |

## 12. Open questions (non-blocking, with defaults)

| ID | Question | Default if unanswered |
|---|---|---|
| Q-S1 | Official durations: Matematik K1 75 or 90, BI P1 / P2, Matematik Tambahan K1 / K2? | Store each paper's printed duration; blueprint default = official convention (Matematik K1 75, K2 150, Fizik K1 75, K2 150, Sejarah 90 / 90 as printed), flagged Low. |
| Q-S2 | Should the DSKP extract be widened to Tingkatan 1-3 (Matematik first)? 19 of 40 Matematik K1 questions need it. | No for the PoC; tag those questions `form_origin T1-T3` and `unit = null` until extracted. |
| Q-S3 | Is the 7-letter mark-point code list (K, N, P, B, M, F, C) acceptable, or should the UI show only K/N/P and map the rest to a neutral "mata" label per subject? | Show the subject's own letters (as printed); store the 7-letter enum. |
| Q-S4 | Drawing and graph answers in v2.0: photo plus checklist (default) or an in-browser canvas? | Photo plus checklist; canvas as a later enhancement. |
| Q-S5 | Pendidikan Islam and Pendidikan Moral blueprints: share a JSU or sample papers? | Not derived; subjects are excluded from the PoC blueprints. |
| Q-S6 | Confirm that question and part marks may be 0 (an unmarked example) and that the `total_marks` of a paper is derived, never typed. | Allowed; derived. |

## 13. Evidence index (working files, not committed)

Working output was kept outside the repo in the session scratchpad folder `exam-schema` (query output files `00` to `16`, extracted text, OCR text, rendering and download scripts). No raw rows, no credentials and no environment values were copied into the repo or into this document. All SQL was SELECT-only against the tables allowed by the brief.
