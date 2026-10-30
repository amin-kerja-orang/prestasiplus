# Layer-2 blueprint data (quota, KBAT, marks bands)

Input of task BJS-13 (`docs/architecture/v2-bijak-spm-standards.md` section 8). One file per launch blueprint, named by paper code with `/` replaced by `-`. Shape: `{ code, sections: [{ position, quota, kbatMarks?, marksBand?, notes }], kbatMarksTotal? }`. Format and numbers only: no question text, no person names.

## Sources
- Per-question tables of the 2025 trial-paper study (kept outside the repo), summarised in `docs/discovery/SPM-paper-patterns.md` (SPP), with the skema corrections of its section 10.
- Units: exact codes of `docs/reference/dskp/*.json` (MATH, ADDMATH, PHY use codes like `4.0`; SEJ uses `Tajuk 11`). T1-T3 content outside the DSKP extract is the bucket `t1_t3`.
- Unit and cognitive-level labels are analyst readings of scanned pages. They are printed nowhere on the papers or skema (SPP 10.5).

## Rules applied
1. Two bodies agree: that value (`observed`). They differ: SBP value, Selangor value kept in `notes` (`inferred`). One body only: `single-source`. A value that needed a choice or has an ambiguous item is `inferred`.
2. Zero is not written: a unit with no line is excluded (AC-36.2). Absent units are listed in `notes`.
3. Quota lines sum exactly to the section's offered marks (or slots for `questions`). No number was adjusted to make a total agree.
4. `kbatMarks` = marks of leaves at cognitive level 3-6 on offered marks. A question-level level in the table is inherited by every leaf. If the level is a range that crosses level 2/3, is unread, or a part is unresolved, `kbatMarks` is omitted and the section is marked `INCOMPLETE` in `notes` (it stays unverifiable). `kbatMarksTotal` appears only when all sections have a value.
5. `levelShare` is arithmetic on the lines (T1-T3 bucket excluded), not a separate observation.
6. `marksBand` = observed min-max marks per question across the bodies read, on the layer-1 slot groups.
7. Sejarah: SK findings aggregated to Tajuk; the "13.2 or 14.1" item is Tajuk 13 by DSKP text (SP 13.2.5).

## Status per blueprint
| File | Sections | Status |
|---|---|---|
| 1449-1.json | A | Quota complete; KBAT omitted (Q13 unreadable). INCOMPLETE |
| 1449-2.json | A, B complete; C | C: KBAT omitted (Q16 level range). INCOMPLETE. C quota is leaf-attributed |
| 3472-1.json | A, B | Complete; single body |
| 3472-2.json | A, B, C | Complete |
| 4531-2.json | A; B, C | A: KBAT omitted (Q4 straddles). INCOMPLETE. B, C complete; C rule inferred in layer 1 |
| 1249-2.json | A; B | A complete; B: KBAT omitted (Q5 split unresolved). INCOMPLETE. B quota is leaf-attributed |

## Values per tag (quota lines + section `kbatMarks`)
| File | observed | inferred | single-source |
|---|---|---|---|
| 1449-1 | 0 | 2 | 14 |
| 1449-2 | 7 | 13 | 0 |
| 3472-1 | 0 | 3 | 14 |
| 3472-2 | 10 | 7 | 1 |
| 4531-2 | 0 | 1 | 13 |
| 1249-2 | 0 | 3 | 8 |

`kbatMarksTotal` values (87 and 130) are sums of the section values and not counted.

## Known conflict
Leaf-attributed lines (Matematik 1449/2 C, Sejarah 1249/2 B Tajuk 12 and 14) cannot be met if a question counts only for its primary unit (architecture O-1). Their sections are INCOMPLETE anyway; decide O-1 before they are used.
Also, because Mengaplikasi counts as KBAT, nearly all Matematik and Matematik Tambahan marks come out as KBAT (e.g. 130 of 130 in 3472/2): confirm the encoding (O-3).
