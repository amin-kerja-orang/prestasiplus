# Audit: DSKP KSSM T4-T5 structured extracts

Date: 2026-10-16. Auditor: independent audit agent (did not write the extracts).
Scope: `docs/reference/dskp/*.json` (13 subjects), `README.md`, `_notes-batch1..3.md`, against the 14 source PDFs in `D:\prestasiplus` (read-only, not copied).

## 1. Method

All checks were scripted (scripts and intermediates stay in the session scratchpad, not in the repo).

1. Structure: valid JSON; `level` is T4/T5; SP codes sequential within each SK; duplicates; 6 TP per group; units/SK/SP counts.
2. Completeness: every code-like token (`n.n.n`) found anywhere in the PDF text layer was compared both ways with the JSON SP codes.
3. Text fidelity, pass 1 (all SK titles, SPs, TP descriptors of all 13 subjects, about 3,900 strings): normalised substring match against `pdftotext` output (reading order and layout), reporting any unmatched characters or suspicious joins.
4. Text fidelity, pass 2 (independent re-extraction): the PDFs were re-read with pdf.js using glyph positions. For each SP the left (Standard Pembelajaran) column was rebuilt row by row (code column to Catatan/Nota column) and compared with the JSON SP text. This catches Notes-column text merged into SPs, which pass 1 cannot see. All 12 non-Jawi subjects were covered (about 1,900 SP rows; the few rows whose code is fragmented in the text layer were covered by pass 1 only).
5. Pendidikan Islam (Jawi): text-layer words were compared per page; the embedded bitmap words were extracted from the PDF, stitched into line images and read visually against the JSON.
6. Privacy: grep of all JSON/notes for personal-name patterns, and for every name-like string (about 310) extracted from the PDF panel lists.

Not done / limits: no PDF page renderer exists on this machine, so symbols and formulas that are drawn as images (maths, physics) could not be read; only what the text layer carries was verified. TP-to-SK association was checked by count (6 per group) and contiguous text, not by position.

## 2. Verdicts

| Subject | Verdict | Fixes applied | Notes |
|---|---|---|---|
| Matematik | PASS-with-fixes | 5 | 3 Notes-merged SPs, 1 corrupt char, 1 truncated SP. Image symbols still missing (see 5) |
| Matematik Tambahan | PASS-with-fixes | 24 | 11 Notes-merged SPs, 8 SPs with dropped words, 1 corrupt char, 4 wrong learning areas. Many formulas missing |
| Fizik | PASS-with-fixes | 4 | 3 dropped-text SPs, 1 symbol. Many formulas/symbols missing (see 5) |
| Sains | PASS-with-fixes | 2 | 2 Notes-merged SPs. 4.3.1 and 5.5.5-5.5.7 reconstructions judged acceptable (see 4) |
| Bahasa Melayu | PASS | 0 | no defects found |
| Bahasa Inggeris | PASS | 0 | counts differ from README only by "No learning standard" placeholders (see 3) |
| Sejarah | PASS | 0 | PDF prints `9.3.6` where JSON has `K9.3.6` (printed typo, correct in JSON) |
| Pendidikan Islam | PASS-with-fixes | 2 | 2 joined words fixed; residual risk in 124 SPs with image-derived words (see 4) |
| Tasawwur Islam | PASS | 0 | |
| Pendidikan Moral | PASS | 0 | |
| Pendidikan Seni Visual | PASS | 0 | |
| Landskap dan Nurseri | PASS-with-fixes | 1 | "estetik" vs printed "estetika". Unaligned TP rows confirmed as genuinely merged cells |
| Katering dan Penyajian | PASS | 0 | |

Total fixes applied: 38 (each recorded in that file's `manualCorrections` with the prefix "audit 2026-10-16"; arrays were created where absent).

## 3. Counts

SP counts match README for every subject. Bahasa Inggeris: JSON holds 37 T4 / 37 T5 SP rows, README says 35 / 34; the difference is the printed "No learning standard" placeholders (T4: 1.1.4, 2.3.2; T5: 1.1.4, 1.1.5, 2.3.2) which the notes say are kept as printed. This is consistent but should be stated in the README.

| Subject | Units | SK | T4 SP | T5 SP | PDF codes not in JSON | JSON codes not in PDF | Seq. gaps/dups |
|---|---|---|---|---|---|---|---|
| Matematik | 18 | 35 | 70 | 57 | 0 | 0 | 0 |
| Matematik Tambahan | 18 | 59 | 94 | 77 | 0 | 0 | 0 |
| Fizik | 13 | 55 | 108 | 97 | 0 | 0 | 0 |
| Sains | 21 | 71 | 121 | 85 | 0 | 0 | 0 |
| Bahasa Melayu | 10 | 50 | 54 | 48 | 0 | 0 | 0 |
| Bahasa Inggeris | 10 | 28 | 37 (35) | 37 (34) | 0 | 0 | 0 |
| Sejarah | 7 | 23 | 102 | 96 | 0 | 0 (PDF prints `9.3.6` for K9.3.6) | 0 |
| Pendidikan Islam | 12 | 46 | 133 | 106 | 0 | 0 (239 = 239) | 0 |
| Tasawwur Islam | 6 | 19 | 64 | 31 | 0 | 0 | 0 |
| Pendidikan Moral | 24 | 24 | 72 | 72 | 0 | 0 | 0 |
| Pendidikan Seni Visual | 17 | 68 | 65 | 56 | 0 | 0 | 2 printed quirks (T5 1.2.2, 2.1.2) match PDF |
| Landskap dan Nurseri | 7 | 19 | 72 | 68 | 0 | 0 | SK 1.3 uses 1.4.x and SK 7.2 uses 7.3.x as printed |
| Katering dan Penyajian | 8 | 31 | 140 | 100 | 0 | 0 (3.3.6 printed "3.3,6") | 0 |

Units were recounted fully against the PDF code listing for every subject (not only 2 units): each SP code in the PDF is present in the JSON and vice versa. TP groups: every unit/SK has exactly TP1-6 except the documented cases: BM 4.0/5.0 and BI 5.0 (no TP, confirmed in PDF), Katering Modul 1.0 (two tables, 12 rows with `appliesToSK`), Landskap Modul 1/3/4 (one merged statement list, `tp: null`) and Modul 7 (`tp: "1-4"`).

## 4. Specific risk items

- **Pendidikan Islam (Jawi).** 239/239 SP codes confirmed in the PDF. Text-layer comparison: 115 SPs have every word present in the PDF text layer; 124 contain 1-7 image-derived words (surah names, "hadith", "sifat", "khauf/raja'", names, long hadith lines). Image words were read visually for pages 33, 39, 42, 49, 66, 71 (SPs 1.28.1, 1.28.2, 2.8.1-2.8.4, 3.9.1-3.9.3, 4.23.6, 1.36.x and 2.10.1). All matched, including the full text of hadith 2.8.1 and 2.10.1 (diacritics included). Defects found: two joined words (T4 SK2.9 TP3 and TP4, "kefahaman" glued to the previous word) - fixed. Not independently verified: the remaining image words in about 110 SPs (mostly repeated stock terms such as "kefahaman", "sifat", "hadith", which are consistent across the file). Observations (no change made): "الج بار" and "المنتقم" appear with a space/kerning gap exactly as printed (a print artefact); the word "ciri" is spelled "خريي" in 4 places, taken from the text layer - letter order could not be confirmed against the glyphs. Names of historical and modern scholars appear inside SP 5.13.1 and 5.15.1 as printed.
- **Sains reconstructed SPs.** T4 4.3.1: print is garbled ("...in the waste water waste m and waste water management."). JSON reads "...in the waste and waste water management sector." The pattern of 4.2.2, 4.4.2 and 4.5.2 ends in "sector", so the reconstruction is plausible, but the word "sector" is not in the PDF; left as is, flagged as a judgement call. T5 5.5.5-5.5.7: the PDF prints the three codes stacked next to three lines (Compare and contrast..., State the chemical properties..., Explain the emulsification process...); JSON assigns them in printed order. Consistent with 5.5.4 and 5.5.8 and the Notes column; accepted.
- **Landskap TP rows "not aligned".** Layout text shows the Standard Prestasi cells for Modul 1, 3, 4 and 7 are merged across TAHAP 1-6, so per-level alignment is genuinely not printed. The note in the JSON is correct; statements were verified word for word.
- **Matematik dropped symbols.** Confirmed as a text-layer limit (see section 5). Three SPs were worse than symbol loss: whole words dropped or Notes text merged (fixed).
- **Add Maths T5 unit 7-8 learning area.** The unit pages print only the elective package (7.0 Linear Programming: Application of Social Science; 8.0 Kinematics: Application of Science and Technology; T4 9.0 Solution of Triangles: Science and Technology; T4 10.0 Index Numbers: Social Science), not a learning area. The extract had guessed Geometry/Geometry/Trigonometry/Trigonometry, which is wrong for all four. Table 8 pairs elective package with learning area (Trigonometry - S&T, Statistics - Social Science, Calculus - S&T, Algebra - Social Science). Corrected to: T4 9.0 Trigonometry, T4 10.0 Statistics, T5 7.0 Algebra, T5 8.0 Calculus, and an `electivePackage` field was added. The inference rests on Table 8's row pairing; it is consistent for all four.
- **BI Form 4 draft.** T4 text matches the draft PDF (cover "DRAF 1/2018", April 2018). No defects against that PDF; content may differ from the final Form 4 edition (already stated in the notes).
- **Privacy.** No personal names, honorifics or panel names found in any JSON or notes file (about 310 panel names tested). The only person names present are historical/religious figures inside curriculum standards (PI SK 5.13/5.15), which are public syllabus content, not live-site names.

## 5. Mismatch table

Severity: Major = wrong or missing words in an SP; Minor = corrupt char or cosmetic; Open = needs a decision.

| Subject | Code | Field | JSON text | PDF text | Severity | Status |
|---|---|---|---|---|---|---|
| Matematik | T4 6.1.1 | SP | "...ketaksamaan Situasi kehidupan sebenar perlu dilibatkan linear." | "...ketaksamaan linear." | Major | Fixed |
| Matematik | T5 5.1.1 | SP | "...kongruen dan bukan Penggunaan perisian geometri dinamik kongruen berdasarkan..." | "...kongruen dan bukan kongruen berdasarkan sisi dan sudut." | Major | Fixed |
| Matematik | T5 7.2.2 | SP | "...suatu set Ogif dan plot kotak perlu dihubungkaitkan. data terkumpul." | "...suatu set data terkumpul." | Major | Fixed |
| Matematik | T5 2.2.5 | SP | "matriks 2 [U+FFFD] 2" | "matriks 2 × 2" | Minor | Fixed |
| Matematik | T5 6.2.1 | SP | "trigonometri, membandingbezakan..." | "trigonometri, [3 equations as images] dan bagi 0 ≤ x ≤ 360 dan membandingbezakan..." | Major | Partly fixed (words restored, equations still images) |
| Matematik Tambahan | T5 2.1.1, 2.2.2, 2.2.3, 2.4.6, 2.4.9, 3.2.2, 3.3.1, 3.3.5, 4.1.1, 5.2.4, 8.1.2 | SP | Notes-column sentence inside the SP (e.g. "...composite Chain rule needs to be involved. function.") | SP text only | Major | Fixed (11) |
| Matematik Tambahan | T5 3.2.1 | SP | "Derive the inductively." | "Derive the indefinite integral formula inductively." | Major | Fixed |
| Matematik Tambahan | T5 4.2.1 | SP | "Compare and combination." | "Compare and contrast permutation and combination." | Major | Fixed |
| Matematik Tambahan | T5 3.2.3 | SP | "...form of constants, n is an integer and n" | "...form of [formula], where a and b are constants, n is an integer and n ≠ –1." | Major | Partly fixed |
| Matematik Tambahan | T4 2.3.1, 2.3.3, 2.3.4, 4.3.4; T5 2.2.1 | SP | words missing around formula remnants (e.g. "...f x ax2 bx position of the graph.") | "...f(x) = ax2 + bx + c towards the shape and position of the graph." | Major | Partly fixed (words restored, formula remnants unchanged) |
| Matematik Tambahan | T5 6.5.1 (JSON 6.5.x "A [FFFD] B") | SP | corrupt char | "sin (A ± B)" | Minor | Fixed |
| Matematik Tambahan | T4 9.0, 10.0; T5 7.0, 8.0 | learningArea | Geometry, Geometry, Trigonometry, Trigonometry | package printed: S&T, Social, Social, S&T | Major | Fixed |
| Fizik | T5 6.1.1 | SP | "decay equations: (i) (ii) (iii)" | "(i) α decay (ii) β decay (iii) γ decay" | Major | Fixed |
| Fizik | T5 1.1.3 | SP | "...constant acceleration, F" | "...F ≠ 0 N" | Major | Fixed |
| Fizik | T5 2.1.1 | SP | "...concept of pressure" | "...concept of pressure in liquids" | Major | Fixed |
| Fizik | T4 5.1.6 | SP | "wavelength, , frequency" | "wavelength, λ, frequency" | Minor | Fixed |
| Sains | T4 6.3.3 | SP | "...stability Study the support system of herbal, woody and aquatic plants. in plants." | "...stability in plants." | Major | Fixed |
| Sains | T5 7.2.1 | SP | "...microscopes. 1." | "...microscopes." | Minor | Fixed |
| Pendidikan Islam | T4 SK2.9 TP3, TP4 | TP | words joined ("...كفهمن" glued to previous word) | separate words | Minor | Fixed |
| Landskap | T4 1.1.8 | SP | "...fizikal dan estetik dalam pelandskapan." | "...estetika..." | Minor | Fixed |
| Katering, Landskap, BI, Sejarah, Tasawwur, Moral, Seni Visual, PI | - | file | no `manualCorrections` key (README says each file has one) | - | Minor | Created where audit edited; open for others |

## 6. Fix list

Applied (38 entries, all logged in each file's `manualCorrections`): matematik 5; matematik-tambahan 24 (19 SP text, 1 corrupt char, 4 learning areas); fizik 4; sains 2; pendidikan-islam 2; landskap-dan-nurseri 1. JSON re-validated after the edits (all 13 parse, no U+FFFD left).

## 7. Open recommendations (judgement calls, not changed)

1. **Maths/physics symbols (decision needed).** The text layer drops equations drawn as images (Matematik: 1.1.3, 6.2.1 equations; Matematik Tambahan: formula parts of about 15 SPs, e.g. 2.3.x, 4.2.2, 4.3.4, 5.1.2/5.2.2 ordering; Fizik: formulas in 2.1.3, 3.1.1, 4.2.2, 4.2.5, 5.x, 6.x etc., and symbols rho, epsilon, script-l in 3.2.x, 3.3.1, 4.3.2, 4.3.3; Fizik 7.3.3 "W=hfo" is in JSON but not in the PDF text layer). The pdf.js text layer carries more than `pdftotext` (for example ≤, ≠, α, β, γ, λ, Δθ), so a re-extraction by pdf.js positions would recover part of it. Options: (a) keep as is and tag these SPs `hasFormula` so question tagging ignores wording differences; (b) re-extract with pdf.js and keep unreadable ones as `[formula]`. Recommend (a) for now.
2. **Sains T4 4.3.1.** Accept the reconstruction, or revert to the printed garbled text and mark `reconstructed`. Recommend keeping.
3. **Pendidikan Islam.** Before it is used as seed text, either read the remaining image-derived words in about 110 SPs, or accept the stock-word consistency. Normalise "الج بار" to "الجبار" and verify "خريي" (probably "خيري") against the glyphs. Consider adding the Rumi layer reviewed by a teacher.
4. **README.** State that BI SP counts exclude "No learning standard" placeholders (JSON has 37/37 rows), add the Add Maths `electivePackage` field, and either add `manualCorrections` to the 7 files that lack it or remove the claim "listed in each file".
5. **Add Maths learning areas** rest on the Table 8 pairing inference; if the user has the official SK/TP list, confirm.
6. **Fizik T4 5.1.4/5.6.3 vs 5.1.6** now consistently show lambda; apply the same restoration policy to other Greek letters once recommendation 1 is decided.
7. **Printed typos kept** as designed (Tasawwur T5 1.1.3 "matlamtnya", duplicated "untuk untuk", Landskap "estatika" in 1.1.5, Katering "peranggu"); no action.

## 8. Re-test

After the fixes the pdf.js column comparison reports 0 Notes-merged SPs in Matematik, Matematik Tambahan, Sains; the remaining differences are symbol/formula residue listed in section 7.1.
