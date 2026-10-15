# DSKP extraction notes - batch 2

Feature slug: v2-question-bank (requirements section 8 item D9, TRACKER D40(e)).
Source PDFs are read-only in `D:\prestasiplus` and are not copied into the repo.
All JSON files in this folder follow the agreed shape, with these documented extensions:

- `tahapPenguasaan` (TP1-TP6) is stored **inside each standard** (per SK) for Sejarah, Pendidikan Islam and Tasawwur Islam, because those DSKPs print one 6-level Standard Prestasi table per Standard Kandungan. For Bahasa Inggeris it is stored at unit (skill) level, because the DSKP prints one Performance Standards Guide per skill.
- Each subject has one file with `levels: ["T4","T5"]`; every unit carries its own `level`. Codes repeat across T4 and T5 in BI and Tasawwur, so always qualify by level.
- Extra fields: `structureNote`, `generalTP`, `focus` (BI), `citizenship:true` (Sejarah K-items), `themes`/`grammarT4`/`grammarT5` (BI).

## Summary table

| Subject file | Units T4 / T5 | SK T4 / T5 | SP T4 / T5 | TP descriptors | Source edition |
|---|---|---|---|---|---|
| `bahasa-inggeris.json` | 5 / 5 (one per skill) | 14 / 14 (content standards) | 35 / 34 (learning standards) | Yes, 6 levels per skill (Listening, Speaking, Reading, Writing); none for Literature in Action | T4 cover says "DRAF 1/2018", April 2018; T5 is Terbitan November 2020 |
| `sejarah.json` | 3 / 4 (tajuk 9-11 / 12-15) | 12 / 11 | 102 / 96 | Yes, 6 levels per SK (all 23 SK complete) | September 2018 |
| `pendidikan-islam.json` | 6 / 6 (bidang) | 25 / 21 | 133 / 106 | Yes, 6 levels per SK (all 46 SK complete) | September 2018 |
| `tasawwur-islam.json` | 3 / 3 (tema) | 13 / 6 | 64 / 31 | Yes, 6 levels per SK (all 19 SK complete) | September 2018 |

Notes on counts: BI SP counts exclude the printed placeholders "No learning standard" (1.1.4 in both forms, 1.1.5 in T5, 2.3.2 in both); those are kept in the JSON as printed so the numbering is faithful. Sejarah SP count includes 92 K-items (Elemen Kewarganegaraan dan Nilai Sivik, code prefix K, flagged `citizenship:true`).

## Bahasa Inggeris (T4 + T5)

- Hierarchy: Skill (1.0 Listening, 2.0 Speaking, 3.0 Reading, 4.0 Writing, 5.0 Literature in Action) > Content Standard (1.1, 1.2 ...) > Learning Standard (1.1.1 ...). The FOCUS column lists focus statements per skill; they are not mapped 1:1 to codes in print, so they are stored as a `focus` list per unit.
- No per-topic unit hierarchy exists in the printed DSKP. Themes (People and Culture; Health and Environment; Science and Technology; Consumerism and Financial Awareness) are named only at syllabus level; topics live in the Scheme of Work, which is not in these PDFs.
- Form 4 and Form 5 learning standards share codes but differ in text (progression, e.g. T4 "extended texts on a wide range of familiar topics" vs T5 "... and some unfamiliar topics"; T4 reading 3.2.1 "national issues" vs T5 "global issues"; T4 literature "Explain briefly" vs T5 "Explain in detail"; T5 speaking and writing standards are largely reworded).
- Performance levels: six levels per skill with 3 (receptive) or 3-4 descriptor sentences each. The last (level 6) descriptor adds "guide others in a given task" / "exemplary model of language use".
- Cognitive / KBAT information: syllabus section 3 states HOTS (thinking, applying, reflecting, problem-solving, decision-making, innovating, creating) is developed mainly through Literature in Action. No Bloom level is attached to codes. The verbs in the learning standards give a usable tag: Understand / Recognise / Guess (lower), Explain / Ask about / Summarise / Organise (middle), Evaluate / Compare and contrast / Justify / Respond imaginatively (higher).
- Target CEFR: B1 Mid at end of Form 4 (printed in the T4 syllabus section). The T5 PDF does not restate the target in the pages read.
- Also captured: grammar and language functions lists per form (`grammarT4`, `grammarT5`) and suggested text types. NOT captured: the Form 4 core vocabulary wordlists (by category and alphabetical, plus Form 3 appendices) and the T5 vocabulary lists. They are large and are not curriculum standards.
- Assessment format: the DSKP only defines classroom assessment (formative, performance levels 1-6, "Literature in Action is assessed through the four skills"). It contains no SPM paper format.
- Quality: Form 4 PDF is a draft (cover "DRAF 1/2018"); T4 text may differ from the final Form 4 edition. Layout text extraction was clean; standards tables were checked against the extracted layout. Speaking 2.1.4/2.1.5/2.2.1/2.3.1 in T5 had stacked code labels in the extraction; they were paired in the printed order.

## Sejarah (T4 + T5)

- Hierarchy: Tema (T4 Pembinaan Negara; T5 Malaysia dan Masa Hadapan) > Tajuk (9 to 15, continuing the T1-T3 numbering) > SK (e.g. 9.1) > SP (9.1.1) plus Standard Prestasi (TP1-TP6 per SK).
- Tajuk: 9 Nasionalisme di Malaysia sebelum Perang Dunia Kedua; 10 Perjuangan Rakyat ke arah Kemerdekaan Tanah Air; 11 Kemerdekaan Persekutuan Tanah Melayu; 12 Pengukuhan Kedaulatan Negara; 13 Pembentukan Malaysia; 14 Kemakmuran Negara; 15 Malaysia di Persada Dunia. SK titles come from the Jadual 7/8 content organisation tables (the SK column titles in the tables wrap and were not reliably extractable).
- K-items (K9.1.5 etc.) are the citizenship/civic-values items attached to each SK; the DSKP says they must not be taught separately from the SP.
- Cognitive / KBAT: strong, explicit. TP verbs follow a fixed ladder per SK: TP1 menyatakan / memerihalkan; TP2 menerangkan / menjelaskan (with examples); TP3 membina urutan / mengklasifikasi / membuat kronologi; TP4 mencerakinkan / menganalisis; TP5 menilai / menjustifikasi / membuat rasionalisasi; TP6 menjana idea / mencadangkan / mencipta. Document also lists Kemahiran Pemikiran Sejarah (KPS) and the general TP statements (Jadual 5, stored in `generalTP`). Jadual 6 groups verbs per TP band (list/describe; explain/relate; show/classify/chronology; analyse/compare; judge/justify; create/predict/propose).
- Assessment format: classroom assessment only (PBD, TP1-TP6); no SPM paper format. Minimum 64 hours per year.
- Quality: all 23 SK have exactly 6 TP sentences and the SP label count matches the extracted sentence count per SK. The Pengenalan/Fokus/Empati box per tajuk and the contoh activities are not captured.

## Pendidikan Islam (T4 + T5)

- Hierarchy: Bidang 1 Al-Quran, 2 Hadis, 3 Akidah, 4 Fiqah, 5 Sirah dan Tamadun Islam, 6 Akhlak Islamiah > SK (numbered continuously across Tingkatan 1-5 within a bidang: T4 Al-Quran 1.26-1.32, T5 1.33-1.38; T4 Hadis 2.8-2.9, T5 2.10-2.11; T4 Akidah 3.9-3.11, T5 3.12-3.13; T4 Fiqah 4.20-4.24, T5 4.25-4.29; T4 Sirah 5.10-5.13, T5 5.14-5.15; T4 Akhlak 6.15-6.18, T5 6.19-6.22) > SP (1.26.1 ...) and a Standard Prestasi (TP1-TP6 per SK; each descriptor may contain several statements separated by newline).
- The whole standards table is printed in **Jawi** (Malay in Arabic script) with Arabic Quran/Hadith lines. There is no Rumi version in the PDF.
- Extraction method: `pdftotext` cannot decode these pages (empty/garbled), and page rendering tools (pdftoppm) are not installed. The text layer was read with pdfjs (positions per word), which decodes the Jawi; right-to-left words were re-ordered by x position. Part of the Arabic/Jawi content is embedded as small bitmap images (surah names, Hadith lines, word fragments, 308 distinct images). All of them were extracted, rendered to contact sheets and transcribed by reading the images. Residual risk: minor diacritic or spelling differences; some Jawi words are printed with unusual spelling (kept: e.g. final ه for ة, "اهلل", "إسالم"). Symbol-font glyphs that extract as Latin letters were normalised (H/U after "رسول الله" = SAW symbol, W = RA).
- Cross-check: the 33 Pendidikan Islam T5 rows in the .cloud JSON are Rumi renderings of the same standards; all 33 codes exist in my T5 data and the meanings agree line by line (e.g. 1.37.7 "ayat 19-20 surah al-Taubah", 6.19.2 "sifat tawaduk"). This independently validates the Jawi transcription for those 33 SP. The other 73 T5 SP and all 133 T4 SP have no independent check.
- Transliteration is not done here: a Rumi layer would help tagging but must be reviewed; the .cloud file already has 33 Rumi SP.
- Cognitive / KBAT: the document states the four KBAT levels (mengaplikasi, menganalisis, menilai, mencipta) and a general TP ladder (TP1 Tahu ... TP6 "boleh buat dengan beradab mithali"), stored in `generalTP`. Typical SP verbs: menyatakan/menjelaskan (low), menerangkan/mengamalkan/menggunakan, merumuskan hikmah/pengajaran (high), and attitude items ending "secara beradab dan istiqamah" (value/practice outcomes). Al-Quran SK are recitation/memorisation based (bacaan, hafazan, tajwid), so question tagging for that bidang will be about surah and ayat references, not cognitive verbs.
- Assessment format: none (classroom assessment only, minimum 96 hours per year).
- Names of historical Islamic figures appear inside standards (e.g. SP 5.15.1) as printed. They are public curriculum content, not live-site personal names, but the caller should decide whether the privacy rule needs them replaced.

## Tasawwur Islam (T4 + T5)

- Hierarchy: Tema/Bidang > SK (1.1 ...; numbering restarts per Tingkatan) > SP (1.1.1 ...) + Standard Prestasi (TP1-TP6 per SK).
  - T4: 1.0 Islam sebagai al-Din (SK 1.1-1.5), 2.0 Manusia sebagai Hamba dan Khalifah Allah SWT (2.1-2.3), 3.0 Sistem Sosial Islam (3.1-3.5).
  - T5: 1.0 Sistem Ekonomi dan Kewangan Islam (1.1-1.2), 2.0 Sistem Perundangan dan Kehakiman Islam (2.1-2.2), 3.0 Sistem Pentadbiran dan Pemerintahan Islam (3.1-3.2).
- Text layer was clean Malay (Rumi). The TP column was split by position and validated: all 19 SK have exactly 6 TP descriptors. One SK (T4 2.1) had a missing full stop between TP4 and TP5 in print; split manually.
- Cognitive / KBAT: document says KBAT action verbs are written explicitly in SK, SP and SPi, and reasoning skills are explicit. SP verbs ladder: Menyatakan (1), Menerangkan/Menjelaskan (2), Menghuraikan/Mengamalkan (3), Menilai kepentingan (4), Mencadangkan tindakan (5). TP verbs: Menyatakan, Menerangkan, Menjelaskan dan mengaplikasi, Menghuraikan, Menilai/Memberi justifikasi, Merumus kefahaman ("sehingga boleh dicontohi atau membimbing orang lain").
- Assessment format: classroom assessment only; elective subject, minimum 96 hours per year (Surat Pekeliling Ikhtisas Bil. 09/2016). The back-of-book Glosari (about 25 terms) is not captured.
- The PDF file name is "Tassawur Islam.pdf" (sic); the printed subject name is "Tasawwur Islam".

## Comparison with .cloud curriculum JSON (`dskp-curriculum.json` + `dskp-bi-backfill.json`)

Schema difference: .cloud rows are `{sid, subject, strand, code, sp}` with **no level field, no SK, no TP, no focus**, and codes collide between T4 and T5 (BI, Tasawwur). The four subjects here cover **T5 only** in .cloud: T4 is entirely missing for all four.

| Subject | .cloud rows | Verdict |
|---|---|---|
| Bahasa Inggeris | 1 row in the main file (1.1.6) + 34 rows in `dskp-bi-backfill.json` = 34 distinct T5 learning standards | All 34 match the printed Form 5 text exactly (35 rows because 1.1.6 appears in both files). Complete for T5 learning standards; missing: all 35 Form 4 standards, content-standard titles, focus lines, performance levels, "No learning standard" slots (so 1.1.4/1.1.5/2.3.2 are absent). |
| Sejarah | 51 rows | All 51 match exactly (T5 tajuk 12-15 only, strand = tajuk title; K-codes included). Coverage 51 of 96 T5 SP, 0 of 102 T4 SP; no TP; no SK titles. |
| Pendidikan Islam | 33 rows | Rumi rendering of T5 SP only; all 33 codes exist in my T5 data and agree in meaning. Coverage 33 of 106 T5 SP, 0 of 133 T4 SP. Strand names equal the bidang names. |
| Tasawwur Islam | 29 rows | **Does not match the printed DSKP.** Codes are 4.1.1 to 6.2.5, but the printed T5 codes are 1.1.1 to 3.2.5 (themes 4/5/6 in .cloud = printed T5 themes 1/2/3, strand names agree). Texts are different wording (e.g. cloud 4.1.1 "Menyatakan pengertian ekonomi Islam" vs printed 1.1.1 "Menyatakan konsep asas dalam sistem ekonomi Islam."); no cloud SP text matches a printed SP verbatim, and gaps exist (4.2.2 and 6.2.4 are absent). Recommend not reusing the .cloud Tasawwur rows. |

## Problems and limits

- No scanned/unreadable pages in BI, Sejarah and Tasawwur (full text layer). Pendidikan Islam content pages have a text layer but a large part of the Arabic/Jawi content (surah names, Hadith lines, word fragments) is bitmap images; transcribed by reading, see above.
- Rendering tools are missing on this machine (pdftoppm), so the Read tool could not show PDF pages; extraction used `pdftotext -layout` and pdfjs-dist (installed only in the scratchpad).
- BI Form 4 is a draft edition.
- Not captured by design: rationale/intro chapters, Rukun Negara etc., BI vocabulary wordlists, Sejarah Pengenalan/Fokus/Empati boxes and sample activities, Tasawwur glossary, panel/author name lists (personal names, per privacy rule).
- No PDFs copied; nothing committed; no other repo files edited. Temp files live only in the `dskp-b2` scratchpad folder.
