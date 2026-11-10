# DSKP KSSM Tingkatan 1–5 (structured extracts)

Structured curriculum data extracted from the official KPM DSKP PDFs the user provided (kept outside the repo in `D:\prestasiplus`; the PDFs are not committed). It is used for question-bank tagging in v2 (`docs/requirements/v2-question-bank.md` §8 D9; TRACKER D40(e)).

Each `<subject>.json` holds `units` (with `level` T4/T5), and each unit holds Standard Kandungan (SK), Standard Pembelajaran (SP) and Tahap Penguasaan (TP 1–6). Printed codes and text are kept exactly as printed. `structureNote` explains where a subject's hierarchy differs.

| Subject | File | T4 SP | T5 SP | Notes |
|---|---|---|---|---|
| Matematik | matematik.json | 70 | 57 | maths symbols drawn as images are missing from SP text |
| Matematik Tambahan | matematik-tambahan.json | 94 | 77 | BI edition; four units carry `electivePackage`, and their learning area is inferred from Table 8 |
| Fizik | fizik.json | 108 | 97 | BI edition |
| Sains | sains.json | 121 | 85 | BI edition; 2 SPs reconstructed (marked) |
| Bahasa Melayu | bahasa-melayu.json | 54 | 48 | units are skills; 4.0 and 5.0 have no TP |
| Bahasa Inggeris | bahasa-inggeris.json | 35 (+2 slots) | 34 (+3 slots) | units are skills; printed "No learning standard" slots are kept as rows; Form 4 is "DRAF 1/2018" |
| Sejarah | sejarah.json | 102 | 96 | TP per SK |
| Pendidikan Islam | pendidikan-islam.json | 133 | 106 | Jawi; text inside images was transcribed by hand |
| Tasawwur Islam | tasawwur-islam.json | 64 | 31 | TP per SK |
| Pendidikan Moral | pendidikan-moral.json | 72 | 72 | SP x.y.5–6 and TP5–6 are attitude, not testable on paper |
| Pendidikan Seni Visual | pendidikan-seni-visual.json | 65 | 56 | only Persepsi and Apresiasi suit written questions |
| Landskap dan Nurseri | landskap-dan-nurseri.json | 72 | 68 | practical; some TP rows not aligned (marked) |
| Katering dan Penyajian | katering-dan-penyajian.json | 140 | 100 | practical |

**Status:** extracted, then **independently audited on 2026-10-16** ([audit report](../../qa/audit/dskp-extracts-audit.md)). No subject failed. 38 text fixes were applied and logged under `manualCorrections` ("audit 2026-10-16") where present. Known limits:
- Maths and physics formulas printed as images are missing from some Matematik, Matematik Tambahan and Fizik SPs. These SPs are kept as printed text, and tagging must not rely on exact wording for them.
- Pendidikan Islam: image-only Jawi words in about 110 SPs are not yet independently verified. Verify them before using the text as seed content.
- Sains T4 4.3.1 is a reconstruction.

**Tingkatan 1-3 (S4-T09, decisions D109/D115):** T1-T3 have no official DSKP extract here. Their structure is built from the V3 chapter data (`apps/api/prisma/seed/curriculum-data/chapters.json`, in-tree chapters of each active subject linked to that Tingkatan) as **Bab-level nodes only**: one unit per chapter with `level` T1/T2/T3, `code` `<chapterNumber>.0`, `title` the chapter name and `titlePrinted` the name in upper case. There is no Bidang grouping, no SK, no SP and no TP for T1-T3 (nothing is invented), so SP/TP stay optional for T1-T3 questions. The `edition` of these levels says so (one `edition` per level). 808 units in total:

| Subject | File | T1 | T2 | T3 | Note |
|---|---|---|---|---|---|
| Bahasa Melayu | bahasa-melayu.json | 23 | 18 | 15 | added to the T4-T5 extract |
| Bahasa Inggeris | bahasa-inggeris.json | 17 | 5 | - | added to the T4-T5 extract |
| Matematik | matematik.json | 13 | 13 | 25 | added to the T4-T5 extract |
| Sains | sains.json | 9 | 13 | 42 | added to the T4-T5 extract |
| Sejarah | sejarah.json | 8 | 10 | 8 | added to the T4-T5 extract |
| Pendidikan Islam | pendidikan-islam.json | 15 | 15 | 15 | added to the T4-T5 extract |
| Pendidikan Moral | pendidikan-moral.json | 13 | 15 | 19 | added to the T4-T5 extract |
| Pendidikan Seni Visual | pendidikan-seni-visual.json | 17 | 66 | 64 | added to the T4-T5 extract |
| Geografi | geografi.json | 13 | 11 | 12 | new file, T1-T3 only |
| Pendidikan Jasmani & Kesihatan | pendidikan-jasmani-dan-kesihatan.json | 16 | 24 | 8 | new file, T1-T3 only |
| Reka Bentuk & Teknologi | reka-bentuk-dan-teknologi.json | - | 48 | - | new file, T1-T3 only |
| Sains Komputer | sains-komputer.json | 4 | 57 | 61 | new file, T1-T3 only |
| Bahasa Arab | bahasa-arab.json | 6 | 5 | 5 | new file, T1-T3 only |
| Bahasa Cina | bahasa-cina.json | - | - | 1 | new file, T1-T3 only |
| Bahasa Tamil | bahasa-tamil.json | 29 | 29 | 21 | new file, T1-T3 only |

Counts are the V3 chapter rows, so some subjects list sub-topic style rows as chapters (for example Pendidikan Seni Visual T2/T3, Sains Komputer T2/T3 and Bahasa Tamil); they are loaded as they are in V3. Subjects with no T1-T3 chapters (Kimia, Biologi, Ekonomi and the others) stay `belum dimuatkan` for T1-T3. The seven new files have `subject` equal to the name in `subjects.json` and are mapped in `DSKP_FILES`.

**Not covered:** official T1-T3 DSKP text (SK, SP, TP and printed codes), and Darjah.

**Not covered by any DSKP:** the SPM exam paper format. DSKPs describe classroom assessment (TP1–6) only. The paper structure needs the LPM assessment formats or JSU, or the user's own exam schema.

**Compared with prestasiplus.cloud** (`backend/tools/import/dskp/dskp-curriculum.json`): .cloud covers Tingkatan 5 only, with no level, SK or TP fields. Its Fizik, Matematik Tambahan and Tasawwur Islam rows do not match the official text, and Landskap and Katering are absent. Use these extracts, not the .cloud list. Per-subject details are in `_notes-batch1.md` to `_notes-batch3.md`.
