# M12 — Kirkpatrick Evaluation — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M12-kirkpatrick.md` v1.0, `docs/requirements/srs/M12-kirkpatrick.md` v1.0 |
| Evidence | discovery `M12-kirkpatrick.md`, `inventory/M12/*.json` (+ `_summary.md`, `_crawl.json`), `img/M12/`; live re-walk on 2026-09-26 13:00–13:10 MYT (browser lane 1, admin account, read-only). All ten screens were opened on the `/admin` prefix, S4 on the `/guru` prefix, and the filter states `?school_id=8080`, `?school_id=9167` and `?state=Kelantan`. The error routes 403, 404 and 405 were also opened. The only click was on the S7 panel header, which stays broken. Nothing was submitted, saved, exported or downloaded; no quiz was started and no AI prompt was sent. There were ≥ 350 ms between page loads. Names were masked in-page: schools are recorded by id, and students by rank or by a name hash. Every unmasked browser dump was deleted. |
| New evidence file | `docs/discovery/inventory/M12/_topup-2026-09-26.json` (TU-M12-01…08, masked) |
| Cross-module docs | M11 SRS v1.8 and `inventory/M11/_snapshot-2026-09-25.json`; M08 SRS v1.7 §6.8 (DATA-M08-09), BR-M08-01/02/04; M05 SRS v1.8 §6.14; M02 v1.11; M01 v1.9; M17 discovery (`M17-admin-dashboard.md`) |
| Auditor | independent audit agent (not an author) |
| Scripts | `<scratchpad>/m12-audit/check.js` (coverage and traceability), `build-topup.js` (top-up file) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 5 |
| Minor | 7 |
| Info | 4 |

What is good:
- **Coverage is complete.** The matrix was re-run by script against the inventory JSON:
  - 1,346 inventory elements and 1,346 matrix rows, with 0 missing, 0 extra and 0 duplicates;
  - every FN reference resolves (77 FNs referenced, 93 defined);
  - the per-screen counts match URS §6.0 exactly (S1 125 … S10 7; SHA 25 / 194; SHU 10 / 362);
  - the 6 content exclusions are exactly the M16 tournament-banner triplets of S9 and S10.
- **Traceability is clean.** Checked by script: 93 FN, 115 AC, 91 FR and 62 E2E. There is no FN without an FR, no AC without an FR or an E2E, and no FR without an E2E. 12 E2E are provisional (14, 26, 33, 40, 46, 50, 51, 55, 57, 59, 61, 62). No provisional AC (13) is asserted by a non-provisional E2E. There are no undefined AC references.
- **The live copy matches.** 44 claims were re-checked on live (list below): copy, titles, the 403/404/405 pages, the DV evidence, the 8080 and Kelantan states, and the S8 pages.
- **The DV-10 correction holds.** The band captions overlap only at 20 ("20-50" / "5-20"), and "<5" and "0" at 0. They do not overlap at 5.
- **The never-logged-in rule holds exactly.** "Never logged in > 50 % of the school's T4/T5 → red" reproduces all 22 red counts, in id order, from the M11 snapshot ("Belum login" + "answeredWithoutLogin"). The included schools are at ≥ 53.2 % and the excluded ones at ≤ 37.0 %.
- **No real name appears.** A grep of the URS, SRS, discovery and inventory for the names seen during the audit and for name patterns finds 0 hits. The new top-up file holds no names.
- **Responsive behaviour is specified.** SRS §10 covers 375/768/1280 for all ten screens, and the DV-M12-07 measurements were re-confirmed at 375: `scrollWidth` 487, select 466 × 18, S7 header button 20 px tall, S4 heat cells 20 px.

Why it fails (5 Major):
1. **The S4 alert rule is wrong (AUD-M12-01).** The live alerts are three independent lists in group order, and a school can appear twice. The green threshold is > 50 %, not ≥ 50 %.
2. **Two school-table definitions are unmodelled, and DV-M12-08 creates a new visible contradiction (AUD-M12-02).** The S4/S5 school tables use a second active definition (Σ 951) and a second answer count (Σ 307,049). DV-M12-08 unifies "aktif" only on the KPI cards, so a filtered S4 page would contradict itself.
3. **ALESA is scoped by `school_id` (AUD-M12-03).** The 8080 state lists 50 of the school's own students, and the tiles are computed from those rows. The docs keep the platform rows plus stored `schoolOverrides`.
4. **The S8 anchors use a second id space (AUD-M12-04).** S8 4664/4644 are the same students as the 8080 prediction rows 5571/5551, which have a different id. The seed places them wrongly and assumes one id.
5. **The capture baseline has drifted (AUD-M12-05).** Live moved between 25 and 26 September. The top-up rows cannot be combined with the 2026-09-25 totals until the Delivery Lead picks a baseline.

---

## Findings

| ID | Severity | Doc & section | Issue | Live evidence | Required fix (owner) |
|---|---|---|---|---|---|
| AUD-M12-01 | **Major** | URS FN-M12-5.6.1, AC-M12-18.1; SRS BR-M12-14, FR-M12-46, E2E-36, E2E-62, read model `Behavior.alerts` | BR-M12-14 says there is one entry per school, where the first matching rule wins, in school-id order. Live renders **three independent lists in group order**: every rule-1 red item (id ascending), then every rule-2 red item, then every green item (id ascending). **9 schools appear twice**, once red and once green: 7780, 8030, 8098, 8228, 8767, 8772, 8965, 9167 and 9806. Under "first match only", the 12 green items would shrink to 3. The green rule is **strictly > 50 %**: school 8298 at 1/2 = 50 % has no green item. The docs say ≥ 50 %. The green percentage uses the S4 table's "Aktif" (951 definition, see AUD-02): 9167 shows "75%" = 6/8, where the 946 definition gives 5/8. TU-M12-03 is now resolved: the "2 guru" item is school 10220 (M11: 2 teachers logged in, 0 M12 answers). | S4 default: 35 items (22 red never-login in the order 940 … 9806, 1 red "2 guru …" 10220, 12 green 7780, 8030, 8098, 8228, 8300, 8767, 8772, 8880, 8965, 9167, 9681, 9806), no buttons. S4 `?school_id=9167`: one red and one green item. See `_topup-2026-09-26.json` › `TU-M12-03_alerts`. | Rewrite BR-M12-14 and FN-5.6.1 as three lists: (1) never-login > 50 % red; (2) teacher logged in and 0 answers red; (3) Aktif ÷ Pelajar > 50 % green. Each list is in school-id order, the lists are concatenated in that order, and a school may be in several. State which "Aktif" the green rule uses (AUD-02). Make E2E-62 non-provisional: it should assert the 35 observed items in order, with 10220 and the 12 green schools. Update AC-18.1 and the `alerts` shape. (product-analyst, solution-architect) |
| AUD-M12-02 | **Major** | URS DV-M12-08, FN-5.4.1, FN-6.5.1, FN-5.2.1; SRS BR-M12-02, BR-M12-10, BR-M12-11, §6.5 (Q-M12-ACTIVE, Q-M12-SESSION-STUDENTS "not displayed", Q-M12-ANSWERS), XR-M12-02 | **The S4 and S5 school tables use two definitions that the docs do not model:** <br>• "Aktif" sums to **951**. The +1 students sit at 9167, 8082, 8106, 8765 and 8107, compared with the 946 prediction rows. <br>• "Soalan" sums to **307,049**. The S3 table, the KPI and the prediction table all give 306,203, and 10 schools differ (e.g. 8880 71,432 vs 71,408; 8082 50,080 vs 49,813). The difference looks like Σ `questionCount` against answered questions. <br>**Visible live contradiction:** on `/admin/kirkpatrick/behavior?school_id=9167` the KPI reads "Soalan Dijawab 545" while the table row on the same screen reads "Soalan 555". The bands also sum to 7 of the 8 students there (4 / 1 / 0 / 0 / 2), a gap. DV-08 says "at school 8080 there is no gap" and does not examine 9167. <br>**DV-M12-08 is incomplete.** It changes the KPI "Pernah Aktif" to 946 but leaves the table "Aktif" (951) and the green alert percentages alone. On the 9167 filtered page the rebuild would show KPI "Pernah Aktif 5" beside table "Aktif 6", **a new visible contradiction**, which CLAUDE.md §6 forbids. <br>**Unreconciled row.** Q-M12-SESSION-STUDENTS (951 = ≥ 1 session) does not fit school 940: "Sesi 1", Aktif 0, Skor Purata 90 %. | S4/S5 table sums 951 / 307,049 / 20,998 sessions; S3 table 306,203; S4 9167 KPI 6 / 545, table 6 / 555; prediction rows per school vs table Aktif (`_topup` › `TU-M12-02`, `TU-M12-08`). | (1) Add named queries for the table columns: Q-M12-TBL-AKTIF and Q-M12-TBL-SOALAN (proposed Σ `questionCount` of the segment). Extend XR-M12-02 so M05 exposes both per school. <br>(2) Re-decide DV-08 with the whole footprint. Either extend it to the table "Aktif", "Purata/Aktif" and the green alert percentages (5 schools' rows change; 9167 green 75 % → 62.5 %), or restrict it and show that no screen then shows two values. List the alternatives and the choice. <br>(3) Take a D9 decision on the KPI vs table "Soalan" mismatch that is visible on filtered S4/S5 pages. Either replicate it as two definitions (record why it is not "broken") or fix it minimally. <br>(4) Define the 951 population so that it fits row 940. (product-analyst, solution-architect) |
| AUD-M12-03 | **Major** | URS FN-6.7.2–6.7.4, AC-M12-23.4; SRS BR-M12-22, FR-M12-55/56, §6.4 DATA-M12-04 (`schoolOverrides`), E2E-42, NFR-M12-01 | The docs say the 50 ALESA rows are platform-wide, "unchanged by `school_id`", and that the 8080 tiles 47 / 3 / 3 are stored overrides over the same 50 rows. On live, **the ALESA list is scoped by school**. <br>• With `?school_id=8080` it lists **50 of the 53 active 8080 students**. Only 4 rows overlap the default list, and the students left out are prediction ranks 19, 38 and 46. <br>• Its tiles are computed from those rows with the A+…D rule: A+ 3, A 9, A- 11, B+ 13, B 7, C+ 3, C 1, E 3 → 47 / 3 / 3. <br>• Within a grade the rows are ordered by **student id ascending** (0 violations in both states). The docs call this order "unordered … rebuild: student id". <br>• Each ALESA "Ketepatan" equals that student's prediction-row accuracy. The grade is not an accuracy band (C at 30 %, D at 28 %, E at 0 %), so it stays a stored prediction. <br>• The default 50 come from 6 schools (8090 28, 8277 11, 8080 4, 8107 4, 8228 2, 8880 1). The selection rule is not observable. | `_topup` › `TU-M12-08_alesa` (default and 8080, each row with school id, prediction rank, accuracy, grade, Keyakinan, Cadangan band); S5 8080 footer "47 pelajar dijangka lulus, 3 pelajar perlu intervensi segera." | Replace `schoolOverrides` with **per-scope stored prediction lists**: platform (the 50 observed) and 8080 (the 50 observed). Other schools get generated rows from their active students, capped at 50 (`observed:false`). Compute the tiles and the footer from the listed rows. Specify the within-grade order as observed (id ascending). Link each row to its student's accuracy (Q-M12-PRED). Update AC-23.4, FR-55/56, BR-22 and E2E-42 (8080: its own 50 rows, grade counts as above). (solution-architect, product-analyst) |
| AUD-M12-04 | **Major** | URS AC-M12-30.x/31.x (Students A/B), OQ-M12-04, TU-M12-07; SRS §6.1 (User `id`), §6.9 (Student A/B placement), XR-M12-01, XR-M12-06; cross-module M11 FR-M11-58, M02 | **S8 uses a different id space.** The S8 pages 4664 and 4644 are the same students as the S5 prediction rows linked `/admin/monitoring/sekolah/8080/pelajar/5571` (219 answers, 73.1 %, A-) and `/5551` (70, 38.6 %, E). The name hash and every figure match. Both are at **school 8080**, and both are in the 946 active set and the 8080 count of 53. On the M11 page of 8080 they are "kirkpatrick" links with M11 Soalan 0 (4664 "Login sahaja", 4644 "Belum login"). The kirkpatrick links on that page use ids 4644–4678, while the monitoring links use 1459–5572. So the S8 / M11-kirkpatrick `{id}` and the monitoring `{id}` are **two ids for one student**. The docs assume one M02 User id. The SRS §6.9 seed puts A and B in "an observed monitoring school with T5 students" as `observed:false`. Any school other than 8080 breaks the 8080 figures (53 active, 15,007 answers), and adding them to 8080 on top of the 53 double-counts them. OQ-M12-04 is now answered: they *are* M11 no-answer rows, and the M11/M12 activity sources disagree per student (DV-M12-24). | S8 name hash = S5 8080 row name hash (hash only, no name stored); M11 `/admin/monitoring/sekolah/8080` link lists; `_topup` › `TU-M12-07_S8`. | Choose one model with M02 and M11 at the XL gate. Either: <br>(a) M02 adds a second key (e.g. `studentRecordId`) used by `/…/kirkpatrick/pelajar/{id}` and the M11 kirkpatrick links, mapping 4664→5571 and 4644→5551; or <br>(b) record a DV that the rebuild uses the one User id in both links. Option (b) changes the observed URLs, so list the alternatives. <br>Then place A and B as the existing 8080 active rows 19 (5571) and 50 (5551) inside the segment, and state that their M11 answer count is 0 (DV-24). Update XR-M12-01/06 and close OQ-M12-04. (solution-architect, with M02/M11 owners) |
| AUD-M12-05 | **Major** | URS §0 conventions ("admin figures = the live snapshot of 2026-09-25"), §9.1; SRS §6.5, §6.9 | Live data moved between the discovery capture (25 September, ~19:00) and this audit (26 September, 13:00). <br>• Platform answers 306,133 → 306,203; sessions 20991 → 20998. <br>• SELEPAS "01 Sep 2026 - 26 Sep 2026" reads 60 / 86.9 % / 14,038 / 28; deltas "+58" "+53.6%" "+14035"; summary "Jumlah jawapan meningkat 467833.3%.". <br>• ROI "323.7"; "Rekod Headcount" 4378 → **4379**. <br>• Sejarah 57,695 → 57,765. <br>The 8080 figures did not change. The TU-M12-01…08 values are therefore from a later state than every total asserted in the URS/SRS. Adopting them row by row would make the seeds disagree with the totals, and scaling them would be tuning, which is forbidden. | `_topup` › `dataDrift`, `platformTotalsAtCapture`. | **Delivery Lead decision**, then the writer applies it. Either: <br>(a) keep the 2026-09-25 totals and the M05 mock clock, and use the top-up only where a row is provably unchanged (8080 and its rows, zero-activity schools, structure, order, colours, rules), generating the other rows under the 09-25 totals with `observed:false`; or <br>(b) re-baseline every M12 figure to the 2026-09-26 13:00 capture. This conflicts with the shared M05 clock (25 September 15:40) and the SELEPAS range. <br>(a) is recommended. Record the choice in URS §0. (Delivery Lead → product-analyst) |
| AUD-M12-06 | Minor | URS FN-2.4.4 ("integer: 465500%"); SRS BR-M12-08 (`round(…)`) | The answers-growth percentage is printed with **1 decimal, dropping a trailing ".0"**: live now shows "467833.3%" (14,035 ÷ 3). The observed "465500%" is simply a whole number. The docs specify an integer. | S1 default 2026-09-26. | BR-08: "{(after − before) ÷ before × 100, 1 decimal, trailing .0 dropped}%", as in BR-33. (product-analyst) |
| AUD-M12-07 | Minor | URS FN-9.4.1; SRS BR-M12-28, §8.2 (S8 thresholds), E2E-53 | TU-M12-07 is captured. Student B's bars are 60.0 % and 55.0 % **`bg-yellow-500`**, and 40.0 %, 33.3 %, 20.0 % and 0.0 % **`bg-red-400`**. Student A is 78.9 % `bg-green-500` and 39.1 % / 16.7 % `bg-red-400`. The PROPOSED rule (≥ 60 green, 40–59.9 amber-400, < 40 red) is wrong in colour and in both bounds. | S8 4644 / 4664 bar classes. | Replace with the observed classes and INFERRED bounds that fit all 9 bars: green-500 ≥ 70 (or > 60), yellow-500 ≥ 50 (or > 40), red-400 below. Remove the item from the PROPOSED list and assert the colours in E2E-53. (product-analyst) |
| AUD-M12-08 | Minor | URS FN-6.6.1, AC-M12-22.2; SRS BR-M12-21 (ties "answers desc then user id") | Across the 946 prediction rows, the order inside equal displayed accuracies is neither answers-descending nor id-ascending. Of 577 tie pairs, answers ascend in 341 and descend in 347; ids ascend in 523 and descend in 54. The live tie order cannot be derived from the displayed data, but the docs present it as a rule. | S5 prediction table (`_topup` › `TU-M12-08_predictions`). | Label the tie order "not observable; rebuild: user id ascending (PROPOSED)". Make sure no E2E asserts the order within ties. (product-analyst) |
| AUD-M12-09 | Minor | URS FN-6.3.1, FN-6.4.1, AC-M12-21.3; SRS BR-M12-19/20, XR-M12-05, §6.9 (8080 "TU-M12-06") | TU-M12-06 is captured. For 8080, "GPS Mengikut Subjek (**2025**)" shows exactly the **platform** subject rows (Matematik 2.50 … Bahasa Inggeris 3.20, 30 candidates, previous values 4.45 …). The same values are headed "(2026)" on the platform page. "Trend GPS (2022–2025)" shows the 7 platform rows without the 2026 column. There is no school-specific subject or trend data. So XR-M12-05's request for 8080 subject and trend rows asks M08 for data that does not exist. The same page shows "Taburan Gred (2026)" above "GPS Mengikut Subjek (2025)" over values labelled 2026 elsewhere, which is a D9 wrong-label candidate. | S5 `?school_id=8080` (`_topup` › `TU-M12-06_results8080`). | Specify the rule: with `school_id`, the subject and trend tables show the platform rows, with heading years as observed (INFERRED: the school's latest year − 1). Either decide the heading year as a DV candidate or replicate it with a reason. Withdraw that part of XR-M12-05. Make AC-21.3 / E2E-40 assert the values. (product-analyst) |
| AUD-M12-10 | Minor | URS §7 notes (3), OQ-M12-11; SRS §6.5 Q-M12-HEAT ("Σ 218,000"), AC-M12-17.1 / E2E-35 ("zero cells are `#f1f5f9`") | TU-M12-01 is captured: 126 default cells with max 6253 and **Σ 218,070**, not 218,000. The **default grid has no zero cell**, so E2E-35 cannot check the zero style on the default page. The 8080 grid has 43 zero cells (`rgb(241,245,249)`, empty), 83 non-zero, Σ 12,008, max 736. At 9167 the grid holds only 116 answers against the KPI's 545 (supports OQ-M12-11: the heat map covers a subset). | `_topup` › `TU-M12-01_heatmap`. | Use the observed values. Move the zero-cell assertion of AC-17.1 / E2E-35 to `?school_id=8080`. Add the 9167 evidence to OQ-M12-11. (product-analyst) |
| AUD-M12-11 | Minor | URS §1 cross-module, §8; SRS §6.10 (XR-M12-07), §6.6 feedback seed | M17 also reads T1. M17 discovery shows the S8 "Kirkpatrick Evaluation" block as "Jumlah Respon 336 · Purata Kepuasan 4.6/5 · NPS Score 8.3", and the S2 panel as T1 "★★☆☆☆ 4.7/10" with count 336 (D-M17-08). M12 names only M10's panel as a consumer, and XR-M12-07 covers only the sidebar. The designed 336-row split gives satisfaction 4.601 and NPS 8.304, so no aggregate of DATA-M12-01 yields "4.7". M17 needs a named query from M12, not a copy. | M17 discovery lines 105, 187, 288, 340, 449. | Add XR-M12-09 to M17: consume `Q-M12-T1` (responses, mean satisfaction, mean NPS) for S2/S8. Flag that "4.7" is not derivable from the M12 store, so M17 must record a DV or a display constant. List M17 in URS §1 / §8. (product-analyst) |
| AUD-M12-12 | Minor | SRS §6.7 DC-M12-02 ("4378", "unchanged by `school_id`") | "Rekod Headcount" rose from 4378 to 4379 in a day. It is a live count of headcount records, not a fixed figure. The display-constant exception still applies at the snapshot, but the "why no definition" column should state this evidence. | S1, S5 on 2026-09-26: "4379". | Record the change in DC-M12-02's rationale and raise the priority of XR-M12-05: M08 to expose a platform count of OTR headcount records. (solution-architect) |
| AUD-M12-13 | Info | URS DV-M12-10 | The corrected claim holds on live: the captions overlap only at 20 ("20-50" / "5-20"), and "<5" and "0" at 0. They do not overlap at 5. The rejection (replicate the captions) is sound. | S4 tiles. | — |
| AUD-M12-14 | Info | URS FN-5.6.1 rule 1, AC-M12-18.1 | "Never logged in > 50 % → red" matches all 22 alerts. The counts equal the M11 snapshot "Belum login" + "answeredWithoutLogin" per school. The included schools are at ≥ 53.2 % (8090 205/385) and the excluded ones at ≤ 37.0 % (8106 207/560). The school ids of the 22 in AC-18.1 are confirmed by the table link ids. | S4 alerts vs S4 table vs M11 snapshot. | — |
| AUD-M12-15 | Info | TU-M12-02 | The unidentified rows are both school **940**: "Skor Purata 90%" with 0 answers (DV-M12-15), and S5 "Engagement 2" with Aktif 0. The S4 Tahap split 8 / 7 / 2 / 4 / 3 plus 9 inactive rows, the first row 9681, the S3 colour split 16 / 7 / 10, and every threshold in BR-M12-09/10/11/12 fit all 33 rows. | `_topup` › `TU-M12-02`. | Use the observed rows as DATA-M12-03 (`observed:true`) under the AUD-05 decision. |
| AUD-M12-16 | Info | PROPOSED list (URS OQ-M12-12, SRS §8.2) | The list is complete for v1.0: the PDF, the S7 error copy and list layout, the S8 70 % threshold and bars, the S9 rows and thresholds, the S10 form and copy, and the T1 split. After AUD-07 the S8 bar colours are observed, not PROPOSED. D10 is respected: DV-05 removes a false affordance, DV-07 changes size only and DV-12 adds an active state as on the `/admin` twin. No ARIA, keyboard or focus additions were found. | — | — |

---

## Top-up captures (TU-M12-01…08) and their effect on the docs

All captures are in `docs/discovery/inventory/M12/_topup-2026-09-26.json`, masked (schools by id, students by rank; only the two S8 anchors carry ids). They are subject to the baseline decision of AUD-M12-05.

| TU | Outcome | Effect on the docs |
|---|---|---|
| TU-M12-01 heat map | **Captured.** Default 7 × 18 cells: max 6253 (Isnin–Ahad values), Σ 218,070, no zero cell; the first cell (Isnin 06) is 944 at α 0.15. 8080: max 736, Σ 12,008, 43 zero cells. | Q-M12-HEAT uses the observed grid and drops "Σ 218,000"; E2E-35 checks the zero style on 8080 (AUD-10). |
| TU-M12-02 school tables | **Captured.** All 33 rows of S3, S4 (with a dash flag for the code line) and S5, with every cell and colour. The "Skor Purata 90 %" and "Engagement 2" row is school 940. | DATA-M12-03 scores become observed (the designed split is confirmed row by row). BR-10/11 hold. The S4/S5 "Aktif" and "Soalan" columns need their own queries (AUD-02). |
| TU-M12-03 alerts | **Captured.** 35 items: 22 + 1 red, **12 green** (the narrative's 13 is wrong). The "2 guru" item is school 10220. The items are three lists, and 9 schools appear twice. | BR-14 is rewritten (AUD-01); E2E-62 becomes observed. |
| TU-M12-04 subjects | **Captured.** 26 platform rows (15 Mastered / 11 Developing; Σ 306,203 at capture) and 24 rows for 8080 (11 / 10 / 3, unchanged). | Q-M12-SUBJECTS per-row values; the 8080 rows can be adopted directly (unchanged); the platform rows follow the AUD-05 decision. |
| TU-M12-05 8080 comparison | **Captured.** SEBELUM "01 Apr 2026 - 30 Apr 2026" 12 / 71.6 % / 511 / 3; SELEPAS 1 / 55 % / 60 / 1 (01–26 Sep); deltas as documented. | FN-2.4.2 and Q-M12-MONTH for 8080: fill in the values (12, 511, 3; 1, 60, 1). The SELEPAS range at the mock clock stays "- 25 Sep" (AUD-05). |
| TU-M12-06 8080 results | **Captured.** The subject-GPS and trend tables are the platform rows relabelled "(2025)" / "(2022–2025)". | AUD-09: no 8080 history rows are needed from M08; specify the relabel rule. |
| TU-M12-07 S8 | **Captured.** Bar colours: 60 and 55 yellow-500; 40 and below red-400. Both students are at **8080**. Both are M11 "kirkpatrick" links. They are ids 5571 and 5551 in the monitoring id space. | AUD-07 (colours) and AUD-04 (id space, placement); OQ-M12-04 is answered. |
| TU-M12-08 predictions / ALESA | **Captured.** 946 default and 53 8080 prediction rows (school, answers, accuracy, grade); 50 + 50 ALESA rows (school, prediction rank, accuracy, grade, Keyakinan, Cadangan band). | AUD-03 (ALESA per scope, id order), AUD-08 (tie order); Q-M12-PRED grade split 512 / 206 / 104 / 95 / 29 is confirmed; ALESA default counts are confirmed (6/16/9/9/3/1/2/2/2; 38/10/2). |

---

## Claims verified against live (44)

| # | Claim (doc) | Result |
|---|---|---|
| 1 | Tab titles of S1–S10 (§1) | ✅ |
| 2 | S1–S5 and S7 header title/subtitle; S6 header "Dashboard" / "Selamat datang, Admin" (DV-03 evidence); S9/S10 "Dashboard" | ✅ |
| 3 | `/guru/kirkpatrick/behavior` renders the same content (951, 306,203 …) in the admin shell | ✅ |
| 4 | S1 selects: 58 and 11 options; states Johor … Terengganu in order; 466 × 18 px; `scrollWidth` 487 at 375 (DV-07) | ✅ |
| 5 | S1 default: T3 "951/4158" (DV-08 evidence), bands 513 / 259 / 169 / 5 / 3207 77.1 % | ✅ |
| 6 | S1 T1 "4.6/5" "336 respon"; S2 8.4 / 6.5 / 9.6 / 4.6, unchanged under `?school_id=8080` | ✅ |
| 7 | S1 8080: T4 "4" (DV-09), "53/184", "1002 sesi", 75.6 %, 15,007, 34/34, bands 36 / 8 / 9 / 0 / 131 and percentages, "Reset" | ✅ |
| 8 | S1 8080 comparison: "April 2026 vs September 2026", 71.6 % → 55 %, red deltas −11 / −16.6 % / −451 / −2, summary text | ✅ |
| 9 | S1 Kelantan: zero state, "Tiada Data vs Tiada Data", ranges "-", "Data tidak mencukupi untuk perbandingan.", T4 4.30 | ✅ |
| 10 | S1 platform SEBELUM "01 Jan 2026 - 31 Jan 2026" 2 / 33.3 % / 3 / 0 | ✅ |
| 11 | Answers-growth sentence format | ❌ 1 decimal (AUD-06) |
| 12 | S1 info card text | ✅ |
| 13 | S3 KPI labels, "Learning Gain" "-", "Perlu pre/post test", Hake sentence and formula | ✅ |
| 14 | S3 subject rows: `cursor-pointer` + `title="Klik untuk lihat detail"` (DV-05 evidence); 26 rows; 15 Mastered / 11 Developing; observed rows (Muzik 100.0 % 20, RBT 99.3 % 461, Ekonomi 79.1 % 2333) | ✅ |
| 15 | S3 8080: 24 rows 11 / 10 / 3, Bahasa Arab 45.0 %, Matematik Tambahan 40.0 % 10, Biologi 33.3 % 30, Bahasa Melayu 80.6 %, Matematik 51.5 % | ✅ |
| 16 | S3 school table: 33 rows, colours green-600 ≥ 70 / amber-600 ≥ 50 / red-600, split 16 / 7 / 10, ties by id | ✅ |
| 17 | S3 row with 0 answers and Skor Purata 90 % (DV-15 evidence; school 940) | ✅ |
| 18 | S4 KPIs 4,158 / 951 / 53.1 % 277/522; captions ">50 soalan" … "0 soalan" (DV-10 correction) | ✅ |
| 19 | S4 school table: 33 rows, first 9681, Tahap split 8 / 7 / 2 / 4 / 3 + 9 inactive, pill colours, Skor thresholds | ✅ |
| 20 | Heat map: 7 × 18, titles "{Hari} {HH}:00 — {n} soalan", max 6253 α 1, 944 α 0.15, zero cells `#f1f5f9` (8080) | ✅ |
| 21 | 22 red never-login counts and order; the > 50 % rule | ✅ |
| 22 | One red "2 guru …" item; green "83.3%", "87.5%"; no buttons | ✅ |
| 23 | Alert structure "one entry per school" | ❌ (AUD-01) |
| 24 | Alerts card absent for 8080; mood card copy | ✅ |
| 25 | S5 KPIs: 4.30 "41 rekod · 2025", "90.6%" "163/180 calon" (DV-16 evidence), 52 "28.9% daripada 180", 946 "22.8% daripada 4,158" | ✅ |
| 26 | Grade distribution titles "A+: 10 pelajar (5.6%)" … "G: 1 pelajar (0.6%)"; 8080 "B+: 1 pelajar (100%)" | ✅ |
| 27 | Subject GPS rows and grades; subject cells `cursor-pointer` + `title="Lihat detail {subjek}"` (DV-05) | ✅ |
| 28 | Trend GPS values; "-" of Keseluruhan green-600 and of Pendidikan Islam amber-600 (DV-14 evidence); ≤ 4.00 green | ✅ |
| 29 | S5 school table: 33 rows, 9 faded, "-" slate-300, Ketepatan green ≥ 60, "2" at 940 | ✅ |
| 30 | Predictions: 946 rows, first at 8090, band split 512 / 206 / 104 / 95 / 29, grade bounds (A+ 90–100 … G 0–29.4) | ✅ |
| 31 | Prediction tie order | ❌ not derivable (AUD-08) |
| 32 | ALESA default: 48 / 2 / 4, grade counts, Keyakinan 38 / 10 / 2, pill colours, Cadangan texts, footer | ✅ |
| 33 | ALESA 8080 state = same 50 rows | ❌ scoped (AUD-03) |
| 34 | ROI and insight "(946)" duplication (DV-13 evidence); 8080 "(53)", "(tahun 2026): 4" | ✅ |
| 35 | S6: header, "951/4158 (22.9%)", "20,991"-style separator, English band labels, duplicated "1-20 soalan" row (DV-02 evidence), r 0.1298 "Lemah", both conclusion texts | ✅ |
| 36 | S7: KPIs 0, `x-data="{ open:  }"`, panel stays 0 px tall after a click (DV-01), header button 20 px (DV-07), "Ambil Tindakan" sentence | ✅ |
| 37 | GET `/interventions/1` and `/create` → 405 framework page (DV-11); `/1/edit` and `/pelajar` → 404 copy | ✅ |
| 38 | S8 unknown id → 403 copy and links | ✅ |
| 39 | S8 4664: paragraph, 219 / 73.1 % / 22.5 / 1d, Terkuat/Perlu perhatian, Head Count rows, platform rows | ✅ |
| 40 | S8 4644: paragraph without the accuracy sentence, 70 / 38.6 % / 21.1 / 1d, TOV rows, platform rows | ✅ |
| 41 | S8 PROPOSED bar colours | ❌ observed differently (AUD-07) |
| 42 | S9: headings, empty Head Count text, 30 gray squares "28/08: 0 soalan" … "26/09: 0 soalan" (clock-relative), legend, conclusion | ✅ |
| 43 | S10 thank-you state copy and button | ✅ |
| 44 | M11 cross-check: 57 schools, 33 table schools, 4,158, 277/522, S8 reached from M11 no-answer rows | ✅ |

## Checks with no finding

- **D9 minimality.** Two DVs have gaps:
  - DV-08: its footprint is incomplete (AUD-02).
  - DV-16: it changes one KPI and was verified against the ALESA rule. AUD-03 confirms that the 8080 ALESA values follow A+…D from the rows.
  <br>DV-01, 02, 03, 05, 06, 07, 09, 11, 12, 13, 14 and 15 are each minimal and create no visible contradiction. The rejections DV-04, 10, 17–24 are sound.
- **D11/D12.** Every figure is a Q-M12 named query on M02, M05 or M08, or a DC-M12-01…03 display constant, with these exceptions:
  - the two table columns of AUD-02;
  - the per-scope ALESA lists of AUD-03.
  <br>Each DC sits on its own card. M12 owns only DATA-M12-01…06. The new M05 segment is correctly raised as XR-M12-02 / SQ-M12-01 for the XL gate. M05 §6.14 has `questionCount`, which likely supports the 307,049 column.
- **Cross-module figures.** These agree:
  - M11: T4/T5 4,158, teachers 522/277, 57/33 schools, never-login counts;
  - M08 DATA-M08-09: 2025 4.30 / 180; 2022–2025 Keseluruhan 5.20 / 4.80 / 4.50 / 4.30;
  - M02 fixture exclusion.
  <br>The DV-20/21 notes to M08 are informational and correct.
- **Seeds.** The feedback split is labelled designed (`observed:false`), and only the displayed means are asserted. No record is invented beyond what the displayed counts require. No real name appears.
- **Responsive.** SRS §10 covers every screen at the three widths. E2E-60 sweeps `scrollWidth`.

---

# Round 2 (targeted re-audit of URS/SRS v1.1, 2026-09-26)

Scope: the fixes for AUD-M12-01…12, a regression check, and live checks only where a fix depends on live behaviour. Evidence came from browser lane 1 (admin, read-only). The pages opened were `/admin/kirkpatrick/pelajar/5571` and `/5551`, S4 `?school_id=10220`, `8298` and `9167`, S5 `?school_id=9167` and S1 `?school_id=9167`. Nothing was clicked or submitted, loads were ≥ 350 ms apart, no name was stored (in-page hashes only), and the browser logs were deleted. The coverage and traceability scripts were re-run: `<scratchpad>/m12-audit/check.js`.

## Verdict: **FAIL**

| Severity | Count (round 2) |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 2 |
| Info | 4 |

## Round-1 findings: status

| ID | Status | Verification (doc, line) |
|---|---|---|
| AUD-M12-01 (Major) | **Closed** | SRS BR-M12-14 (l. 214) defines three lists in fixed order, lets a school appear in several, and sets green at > 50 %. URS AC-18.1 (l. 415) lists the 35 items and their order, which match the top-up exactly. AC-18.4 (l. 418) and E2E-36/62/64 (l. 553, 579, 581) follow. The live check confirmed E2E-62: `?school_id=10220` shows only the "2 guru" item, and `?school_id=8298` shows only the red "2 pelajar" item, with no green item at exactly 50 %. |
| AUD-M12-02 (Major) | **Closed** | Q-M12-TBL-AKTIF, Q-M12-TBL-SOALAN and Q-M12-SESSION-STUDENTS are modelled (SRS l. 319–321). The 940 row is explained: a session with no served question, Aktif 0, Sesi 1. The 952 value is not displayed, so the inference is harmless. BR-02/06/10/11 (l. 202, 206, 210, 211) and DV-M12-08 (URS l. 1979) are re-decided. **DV-08 re-decision: minimal and contradiction-free.** Its footprint is now complete: KPIs S1/S4/S6 946; bands 3212; table "Aktif" −1 at 9167/8082/8106/8765/8107; table "Soalan" answered at the 10 listed schools, with their "Purata/Aktif"; the 9167 green item 62.5 %. I checked every changed value for a new visible contradiction: <br>• Filtered S4/S5 for 9167: KPI 5 = row 5 = 5 prediction rows. The bands 4/1/0/0/3 sum to 8. Live S5 already shows "Pelajar Aktif 5 62.5% daripada 8" (verified), so the alert's 62.5 % now matches the S5 card of the same school. <br>• None of the other four schools crosses the 50 % green threshold (225/549, 142/560, 4/16, 4/675), so the alert membership is unchanged. <br>• Sessions, Skor, Engagement, Tahap and order are untouched, so no ranking moves. <br>• Every screen that displays "Soalan Dijawab" was already on the answered definition. <br>The alternatives are recorded, and (a) "served everywhere" is correctly rejected: it would leave the S5 prediction list (5 rows) below a "6" and misname the "Dijawab" KPIs. This is the smallest change that removes all same-screen contradictions. |
| AUD-M12-03 (Major) | **Closed** | DATA-M12-04 now holds per-scope lists (SRS l. 301), and `schoolOverrides` is gone. BR-22 (l. 222) computes the tiles from the rows and orders within a grade by id. AC-23.4 (URS l. 443) and E2E-42 (l. 559) carry the 8080 counts A+ 3 … E 3 and "Student A absent", which match the top-up. The Student B exception (grade C with the D/E text) is recorded as observed: the top-up row 47 confirms "C" with the intervention text. |
| AUD-M12-04 (Major) | **Not closed → AUD-M12-R2-01** | The placement is fixed. Students A and B are the 8080 prediction rows 19 and 50 (Q-M12-PRED, l. 327), and OQ-M12-04 is closed. The chosen mechanism contradicts live; see R2-01. |
| AUD-M12-05 (Major) | **Closed** (one residual Minor, R2-03) | URS §9.2 records the 25-Sep baseline, every moved figure and the choice made for it. The proof rules (monotonic counts; equal totals; unchanged 8080) are valid. For example, the whole +70 is in Sejarah, so the other 25 subject rows must be unchanged. The 23 non-8080 active school rows and the platform prediction rows are kept as reference values (`observed:false`) and never asserted. |
| AUD-M12-06 | **Closed** | BR-08 (l. 208): 1 decimal with the trailing ".0" dropped; both "465500%" and "467833.3%" are cited. |
| AUD-M12-07 | **Closed** | BR-28 (l. 228): green-500 ≥ 70, yellow-500 50–< 70, red-400 < 50. This fits all 9 captured bars (78.9 green; 60 and 55 yellow; 40 and below red). |
| AUD-M12-08 | **Closed** | BR-21 (l. 221): the tie order is PROPOSED (user id) and never asserted. |
| AUD-M12-09 | **Closed** (see R2-02 for the no-history state) | DV-M12-26 (URS l. 1997) and BR-19/20 (l. 219–220): with `school_id`, the platform tables and headings are used. The fix is minimal (heading years and the 2026 column only), and the XR-05 part is withdrawn (l. 382). |
| AUD-M12-10 | **Closed** | Q-M12-HEAT (l. 326) holds the observed grid, and E2E-35 (l. 552) checks the zero style on 8080. OQ-M12-11 cites 9167 (116 vs 545). |
| AUD-M12-11 | **Closed** | XR-M12-09 to M17 (l. 386). |
| AUD-M12-12 | **Closed** | DC-M12-02 is withdrawn in favour of Q-M12-HC-RECORDS (l. 331), an M08 live count, with XR-05's priority raised. See Info R2-07. |

## New findings

| ID | Severity | Doc & section | Issue | Live evidence | Required fix (owner) |
|---|---|---|---|---|---|
| AUD-M12-R2-01 | **Major** | URS DV-M12-25 (l. 1996), AC-M12-30.5 (l. 480); SRS DATA-M12-07 (l. 303), FR-M12-78 (l. 139), E2E-63 (l. 580), XR-M12-10 | DV-25 keeps 5571 and 5551 as "S8-route aliases" that render Students A and B, and says `/admin/kirkpatrick/pelajar/5571` and `/5551` "still render the same pages". **On live they do not.** Both return **HTTP 403**, the standard "Anda tidak mempunyai kebenaran…" page, because the S8 route accepts only its own id space. AC-30.5 and E2E-63 therefore assert behaviour that live never shows, a new feature against D7/D9. The alias table has no purpose once one M02 id is chosen. | `GET /admin/kirkpatrick/pelajar/5571` → 403; `/5551` → 403 (2026-09-26, lane 1). | **Remove DATA-M12-07** and the alias clause of FR-78. With the one id 4664/4644, the ids 5571 and 5551 are unknown users, so FR-M12-17 already gives the observed 403. Rewrite AC-30.5 / E2E-63 to assert that 5571 → 403 (as live) and that the S5 8080 rows 19/50 link to `…/pelajar/4664` and `/4644` (the D9 part of DV-25). In XR-M12-10, ask M11 to confirm that `/admin/monitoring/sekolah/8080/pelajar/4664` renders its student page for a student with 0 M11 answers. (product-analyst, solution-architect) |
| AUD-M12-R2-02 | **Major** | URS FN-2.2.1, FN-2.3.2, FN-6.1.1, FN-6.2.1, FN-6.8.1, FN-6.9.1, §6 matrix; SRS BR-M12-16/17/18/23/24, §8.1 | **The "school without SPM history" state is unspecified.** Only 8080 has a history row, so this is the state of every other school filter (32 of the 33 table schools and the other options). It was never captured in discovery, and its copy is not in the inventory. Observed on `?school_id=9167`: <br>• **S1**: the T4 card shows "Belum Ada Data" (`p.text-lg … text-slate-400`) and "Import keputusan peperiksaan" (`p.text-xs text-slate-400`), and the flow pill reads "GPS -". <br>• **S5 KPIs**: "GPS Headcount" "-" with the caption "41 rekod ·" (no year); "Kadar Lulus" "0%" "0/0 calon"; "Pelajar Gred A" "0" "0% daripada 0". <br>• **S5 cards**: the "Taburan Gred" card is absent. ROI "GPS Headcount" "-". The insight drops the "GPS keseluruhan … (tahun …)" sentence. <br>The docs give only the 8080 rule ("that school's latest history row"), so a builder would invent this state. The dangling "41 rekod ·" is also a D9 candidate: a wrong or broken label. | S1 and S5 `?school_id=9167` (2026-09-26); other values: "Purata Soalan/Pelajar 109", "Hanya 5 daripada 8 … (5)". | Add the state to FN-2.2.1/2.3.2/6.1.1/6.2.1/6.8.1/6.9.1 and BR-16/17/18/23/24 with the exact copy above (OBSERVED). Add the two new strings to §8.1 and add matrix rows as audit-observed elements. Decide "41 rekod ·" (replicate, or D9: omit " ·" or the caption) and record it as a DV. Add an AC and an E2E for a school without history (e.g. 9167) at the three widths. Ask the discovery owner for an inventory top-up of this state. (product-analyst) |
| AUD-M12-R2-03 | Minor | URS §9.2 ("platform heat grid … adopted"), TU-M12-01 row; SRS Q-M12-HEAT, E2E-35 | The platform heat grid is adopted "as observed" although it does not pass the section's own proof rules. The discovery recorded the grid total as 218,000 on 25 Sep. The top-up total is 218,070, and the +70 equals the platform answer growth, so cells probably changed. E2E-35 asserts "the 126 platform values" from 26 Sep against a 25-Sep baseline. | §9.2 table; discovery l. 537 ("218,000"). | State the grid as an explicit exception (the only complete capture), or assert only the values seen on both days ("Selasa 14:00 — 6253", "Isnin 06:00 — 944", layout and zero style) and keep the other cells as `observed:false` reference values. |
| AUD-M12-R2-04 | Minor | URS DV-M12-25 alternatives, XR-M12-10 | DV-25 changes two live link targets on S5 (`/pelajar/5571` → `/4664`, `/5551` → `/4644`). They then point to an M11 student page (`/monitoring/sekolah/8080/pelajar/4664`) for a student whom M11 lists as a no-answer "kirkpatrick" row. Live never renders M11's monitoring page for that id, and M11's S4 page behaviour for a zero-answer student is not specified in M11 v1.8. | M11 8080 page: 4664 is a kirkpatrick link with Soalan 0. | Add this to XR-M12-10 for the XL batch 3 gate, so that M11 confirms or defines the zero-answer S4 state. |
| AUD-M12-R2-05 | Info | Traceability and coverage (script) | Coverage is unchanged and complete: 1,346/1,346, 0 missing, extra or duplicate, and every FN reference resolves. Traceability: 93 FN, **118 AC**, 91 FR and **64 E2E**. There is no FN without an FR, no AC without an FR or E2E, and no FR without an E2E. 10 E2E are provisional (14, 26, 33, 46, 50, 51, 55, 57, 59, 61), and none of the 12 provisional ACs is in a non-provisional E2E. There are no undefined references. | — | — |
| AUD-M12-R2-06 | Info | DV-M12-27 | The rejection is acceptable. 8080 shows "Subjek 3" in the S3 row while its filtered page lists 24 subject rows, and 940 shows 1 with 0 answers. The label does not claim "answered", and the value is stored. | Top-up TU-02 (8080: 3; 940: 1). | — |
| AUD-M12-R2-07 | Info | Q-M12-HC-RECORDS / XR-M12-05 | "Rekod Headcount" now depends on an M08 query that M08 v1.7 does not yet expose (M08 counts 744 graded entries). It must be resolved at the XL gate before build. If M08 cannot reproduce 4,378, M12 needs a fallback: restore the display constant. | — | Track as a build prerequisite. |
| AUD-M12-R2-08 | Info | Privacy | A grep of the v1.1 URS and SRS for the real names seen during the audit finds 0 hits. The top-up file is unchanged and holds no names. | — | — |

## Why it fails

1. **R2-01:** the S8 alias behaviour (5571/5551 render the student) is invented; live answers 403.
2. **R2-02:** the state for a school without SPM history is observed on live but unspecified. It covers every school filter except 8080 on S1 and S5, and it has copy that the docs do not contain.

---

# Round 3 (doc-only re-audit of URS/SRS v1.2, 2026-09-26)

Scope: the fixes for AUD-M12-R2-01…04 and the "Rekod Headcount" fallback, a regression scan, and a script re-run. **No browser was used**, as the coordinator instructed. The live references are my round-2 observations: S8 `/pelajar/5571` and `/5551` returned 403, and the `?school_id=9167` S1/S5 state was recorded in Round 2 above. The scripts are `<scratchpad>/m12-audit/check.js` and a top-up lookup.

## Verdict: **PASS**

| Severity | Count (round 3) |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 3 |

## Round-2 findings: status

| ID | Status | Verification (doc, line) |
|---|---|---|
| AUD-M12-R2-01 (Major) | **Closed** | DATA-M12-07 is withdrawn (SRS l. 306). FR-M12-78 (l. 140) now sends ids that are not users, including 5571 and 5551, to the FR-17 403 page. AC-M12-30.5 (URS l. 485) and E2E-63 (SRS l. 584) assert the 403, which matches round-2 live (both 403), and the S5 8080 links to `/4664` and `/4644`. DV-M12-25 (URS l. 2018) now changes only those two link targets. XR-M12-01 (l. 381) places 4664/4644 at 8080 and creates no 5571/5551. Its `lastLoginAt` (4664 set, 4644 null) matches the M11 rows "Login sahaja" / "Belum login". A grep finds no alias wording left outside the withdrawal note and the change log. |
| AUD-M12-R2-02 (Major) | **Closed** | Every observed item is specified exactly: <br>• FN-M12-2.2.5 (URS l. 142) and FR-M12-92 (SRS l. 154): "Belum Ada Data" `text-lg` slate-400, "Import keputusan peperiksaan" `text-xs` slate-400, flow "GPS -". These match the classes I recorded (`p.text-lg font-heading font-bold text-slate-400`, `p.text-xs text-slate-400 mt-1`). <br>• FN-M12-6.1.2 (l. 205) and FR-M12-93 (l. 155): "-", "0%" "0/0 calon", "0" "0% daripada 0", no "Taburan Gred" card, ROI GPS "-", no GPS insight sentence while the disclaimer stays. These match the round-2 KPI cells and headings exactly. <br>• BR-16/17/18/23/24 (l. 219–227), including ROI "109" = 545 ÷ 5, and §8.1 (l. 433). <br>AC-06.4 (URS l. 357), AC-19.3 (l. 427) and E2E-65 (SRS l. 586) assert only observed 9167 values; "Pelajar Aktif 5" / "62.5% daripada 8" is backed by the adopted per-school Aktif. The 10 audit-observed elements are in URS §6.3 (l. 1967–1982), mapped to FN-2.2.5/6.1.2, with TU-M12-09 raised for regular inventory ids. **DV-M12-28** (l. 2021), "41 rekod ·" → "41 rekod", is a valid D9 fix: it removes a dangling separator only, keeps the live figure, and records the alternatives. |
| AUD-M12-R2-03 | **Closed** | Q-M12-HEAT (SRS l. 329), AC-17.1 (URS l. 415) and E2E-35 (l. 556) assert only "Selasa 14:00 — 6253" and "Isnin 06:00 — 944" on the platform grid. The top-up lookup confirms those two cell positions. The other 124 cells are `observed:false` reference values, and the unchanged 8080 grid is asserted in full. |
| AUD-M12-R2-04 | **Closed** | XR-M12-10 (SRS l. 390) asks M11 to confirm its student page for a zero-answer student reached by the DV-25 links. |
| Fallback (R2-07) | **Closed** | Q-M12-HC-RECORDS (l. 334) is primary. DC-M12-02 (l. 350) is kept as a fallback display constant used only if M08 cannot reproduce 4,378. It sits on its own caption and card, and no screen shows a second headcount-record figure there. This is valid under D11. |

## Script re-run

- **Coverage:** 1,346/1,346 inventory elements, with 0 missing, extra or duplicate. Every FN reference resolves. The 10 §6.3 audit-observed rows reference only defined FNs (2.2.5, 6.1.2).
- **Traceability:**
  - Counts: 95 FN, 120 AC, 93 FR and 65 E2E.
  - There is no FN without an FR, no AC without an FR or E2E, and no FR without an E2E.
  - 10 E2E are provisional. None of the 12 provisional ACs is in a non-provisional E2E.
  - There are no undefined references.
  - US-06 and US-19 trace to the new FRs 92/93 and E2E-65 (SRS l. 166, 179).
- **Regression scan:** no issues found.
  - The approved-DV list (SRS l. 26) includes 25, 26 and 28.
  - Rejected DV-27 is unchanged.
  - The AUD-01…12 and R2 closures from round 2 are intact: BR-14, DV-08 footprint, per-scope ALESA, §9.2 baseline.
  - No real name appears in the v1.2 URS or SRS.

## New findings

| ID | Severity | Doc & section | Issue | Required fix (owner) |
|---|---|---|---|---|
| AUD-M12-R3-01 | Minor | URS FN-2.2.5, FN-6.1.2; SRS BR-M12-16 ("only 8080 has one"), FR-92/93 | The docs state that every `school_id` except 8080 is a no-history school. Only 9167 was observed. M17 discovery (l. 342) reports that school 8880 has SPM data (GPS 2.880, 150 candidates) from its own source. Whether M12 S5 `?school_id=8880` shows a history row is unobserved, so "only 8080" is written as fact without evidence. The rule text (a school without a history row) is generic and correct; only the enumeration is unproven. | Reword the list as "observed: 8080 has a row, 9167 has none; other schools per the M08 history data". Add 8880 (and one more school) to TU-M12-09. Raise the question with M08 in XR-M12-05 at the XL gate. (product-analyst) |
| AUD-M12-R3-02 | Minor | URS §6.0 summary, §6 "Result" line (l. 1984) | The summary table, the "Functions referenced by the matrix: 77" line and the Result line do not count the 10 §6.3 audit-observed elements, which make 79 FNs referenced. A reader of §6.0 cannot see that 10 elements sit outside the inventory totals. | Add a §6.0 row "Audit-observed (§6.3) 10 / 10 mapped" and update the FN count and the Result line. (product-analyst) |
| AUD-M12-R3-03 | Info | Build prerequisites | These remain open for the XL batch 3 gate before G3: <br>• XR-M12-02: M05 session segment with served and answered counts (SQ-M12-01); <br>• XR-M12-05: M08 HC-RECORDS or the DC fallback, and the history rows; <br>• XR-M12-10: M02/M11 ids and the M11 zero-answer page; <br>• XR-M12-09: M17 T1. <br>None blocks G1. | Track in TRACKER. |
| AUD-M12-R3-04 | Info | TU-M12-09 | The no-history elements carry temporary ids (S1-A01…A03, S5-A01…A07) until discovery captures the state. The docs mark them accordingly. | — |
| AUD-M12-R3-05 | Info | Privacy / safety | This round was doc-only, with no browser. The top-up file and report hold no names. | — |

Round 3 has no Critical or Major findings. **M12 passes AUD.** The two Minor items can be fixed in the next revision without re-audit.
