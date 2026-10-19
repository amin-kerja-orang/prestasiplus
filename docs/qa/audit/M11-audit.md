# M11 — Teacher Portal: Analytics & Reports — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M11-teacher-analytics.md` v1.0, `docs/requirements/srs/M11-teacher-analytics.md` v1.0 |
| Evidence | discovery `M11-teacher-analytics.md`, `inventory/M11/*.json` (+ `_summary.md`, `_crawl.json`), `img/M11/`; live re-walk on 2026-09-25 (browser lane 2, admin account, read-only, filters by URL only, GETs throttled to 350 ms or more; no export, print, submit or quiz URL opened; every screenshot masked with `tools/jobs/M11.js` M11MASK + `tools/sanitize.js`) |
| Cross-module docs | M01 v1.8, M02 v1.7 (§6.15 dataset spec and users id policy), M05 v1.4, M08 v1.4, M10 v1.0, `docs/design/shells.md` |
| Auditor | independent audit agent (not an author) |
| Screenshots | `docs/qa/audit/img/M11/` (all masked): `weekly-equal-week-blue.png`, `s3-aktif-pill-header.png`, `s3-aktif-pill-includes-ditapis.png` |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 1 |
| Major | 9 |
| Minor | 4 |
| Info | 3 |

What is good:
- The coverage matrix is complete. 819/819 content elements and 1,445/1,445 elements with the shells are mapped, with no duplicates or unknown IDs. All 31 sampled mappings are correct, and the 6 exclusions are all tournament-banner elements.
- Traceability is clean when checked by script: 84 FN, 85 FR, 95 AC and 50 E2E, with no FN without an FR, no AC without an E2E and no FR without an E2E. Exactly 16 E2E are marked provisional.
- Most copy, S1, S4, S6, S7, S8, the 404 page, the filter scopes, the export targets and the attention/suggestion rules match live exactly.

Why it fails:
- **DV-M11-11 rests on false facts (Critical).** Flagged and excluded accounts exist at 6 schools, not only 8080. The 9 excluded accounts of 8080 answered as late as 19/09/2026. The approved KPI values (1,453 / 34.9% / 325) are therefore not what the rule itself produces. The fix also creates a new visible contradiction on S5.
- **The admin-mirror seeds do not mirror observation.** Every school id was visible in the links but was replaced by invented ones. Per-school answer totals are round filler values. Teacher counts sit on the wrong schools. The weekly cells were visible but are marked `observed:false`.
- **Observable rules were written as INFERRED, and wrongly:**
  - the weekly blue colour;
  - the S3 pill membership;
  - the "Belum login" counts.
- **Two S3 live states are missing:**
  - the "Cancelled" and "Expired" subscription pills;
  - the warning box without its second sentence.
- **Cross-module mismatches:**
  - the teacher seed uses M08 v1.0 classes that M08 v1.4 removed;
  - the XR-M11-02 id blocks lie outside the M02 users id policy.

---

## Findings

| ID | Severity | Doc / section | Issue | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M11-01 | **Critical** | URS §7 DV-M11-11, FN-3.3.1, 3.8.2, 4.3.2; AC-13.1, 13.4, 14.1, 25.1; SRS BR-09, BR-24, §6.7 ("19 students of 8080 … none elsewhere"; "the 9 excluded accounts … have no answers after 25/06/2026") | DV-11 was approved on false facts. **(1)** Flagged accounts are not confined to 8080. **(2)** The excluded accounts of 8080 are active recently, so the claim "period states unchanged" is false; under BR-09, the observed 7-day, 30-day and 3-month figures would all change. **(3)** Applying the rule as written does not give 1,453 / 34.9% / 325; it gives about 1,427 or fewer, with changes to the rows, tahap counts, Perhatian and Cadangan. **(4)** The fix creates a new contradiction on S5: "Pelajar Aktif 165" + "Perlu Perhatian 10" ≠ 184, while the same page says "174 pelajar telah mula menjawab soalan". **(5)** It was not shown to be minimal. S3 states its own rule ("Angka penglibatan di atas ialah nilai tulen selepas tapis"), so S2 and S3 use two declared definitions, not an undeclared contradiction. | **Warning boxes on S3:** 8078 "18 akaun … 4", 8082 "20 … 14", 8090 "10 … 5", 8106 "16 … 3", 8087 "3 akaun" and 10220 "1 akaun". **S2 vs S3 Aktif:** 8078 345 vs 341, 8082 393 vs 379, 8090 134 vs 129, 8106 306 vs 303. **Last activity of the 9 "ditapis" rows at 8080:** 15/07, 19/09, 16/06, 20/06, 16/06, 18/09, 20/09, 10/09 and 18/09/2026 (4 fall in the last 7 days). These 9 accounts answered 26,507 of the school's 53,494 answers. See `s3-aktif-pill-includes-ditapis.png`. | Withdraw DV-11 and replicate live: S2/S5 unfiltered, S3 filtered with its note. This is the minimal choice and creates no new contradiction. If a fix is still wanted, redo it with the real flag distribution: flags at all 6 schools, their dates and answers, every changed row, tahap, list and AC value, and the S5 wording. Either way, seed the flags as observed (DATA-M11-01 for 6 schools). |
| AUD-M11-02 | Major | SRS §6.7 school table (ids marked "A"), "Other schools with users" note, XR-M11-03; URS AC-14.x | **School ids and teacher counts do not mirror live.** Every school id is visible in the S2 links (`/admin/monitoring/sekolah/{id}`) and is not personal data, yet 25 rows use invented ids (2105, 3318, 8095, 8010, 8040, 8060, …). The SRS also sends to M02 as "other schools with users (not monitoring)" — 987, 995, 8078, 8090, 8300, 1014 and 8106 — which are **monitoring schools on live**. XR-03 says "8106 is not a monitoring school", but it is (560 T4/T5, row 10). Teacher counts sit on the wrong schools: 8087 (labelled "O" = observed) is seeded 60/18, but live 8087 has 44/12, and that value is given to 900001 SMK DEMO instead. The 83/42 teacher row belongs to the 385-student school on live, not to the 560-student school. The observed row 8284 (1/1, 5 answers in M32) is replaced by the fixture 900001. | **Live student-table order (default):** 940, 987, 995, 8098, 8284, 8080, 8078, 8082, 8880, 8106, 8298, 10220, 1014, 8765, 8090, 8087, 8102, 8107, then 7780, 8030, 8198, 8228, 8277, 8300, 8302, 8308, 8767, 8772, 8965, 9167, 9681, 9801, 9806. **Teacher table:** 5183 1/1, 8080 34/34, 8300 1/1, 10220 2/2, 8078 60/53, 8082 68/51, 8277 29/16, 8090 83/42, 8880 2/1, 8102 118/42, 8106 60/18, 8087 44/12, 8107 20/4. The tie rule "ties by school id ascending" holds with these real ids in the default, 7-day and 3-month views. | Seed the 33 and 13 rows with their live ids, and pin their per-school values to them. Drop the invented ids and the SMK DEMO substitution (or show that 900001 is an additional school without changing any observed row). Rewrite the "other schools" list and XR-M11-03, including the subscription-12 note, from live membership. |
| AUD-M11-03 | Major | SRS §6.7 (answers per school, weekly note "Cell values are `observed:false`"), URS AC-15.3 (provisional) | **Filler values where live data was observable.** Per-school "Soalan Dijawab" is on every S3 page, but the seed uses rounded or invented totals. The weekly table (all cells, Trend and Best) was fully visible in the discovery screenshot and on live, but the generator fills it and E2E-27 treats it as provisional. This breaks "seeds mirror observation" (CLAUDE.md §6). | **Live S3 "Soalan Dijawab":** 8090 119,806 (seed 38,000); 8106 59,201 (seed 111,428); 8078 88,968 (seed 121,000); 8082 130,233 (seed 131,000); 8087 6,779 (seed 3,900); 8880 10,196 (seed 9,870); 10220 1,095 (seed 83); 8765 209 (seed 1,560); 1014 110 (seed 60); 987 51 (seed 12); 8284 5 (seed 94 at 900001). **Weekly Best on live:** M16 29,604; M16 37,911; M14 21,286; M14 10,554; M18 37,748; M4 2,538; M9 2,798; … M32 5. | Seed the per-school totals and the weekly cells from observation. The weekly row sums reproduce the S3 totals (the 8080 row sums to 53,494). Make E2E-27 non-provisional with observed values. Note live drift: at audit time the total was 472,371 instead of 472,261, which is expected. Fix the snapshot at the discovery values. |
| AUD-M11-04 | Major | SRS BR-M11-15 ("equal and > 0 → green (INFERRED)"); URS FN-3.6.1, AC-15.3; URS §7 "Discovery notes corrected by evidence (1)" ("blue appears only in the first week column M1") | **The weekly blue rule is wrong.** On live, a non-zero week **equal** to the previous week is blue (`bg-blue-50 text-blue-700`), as is a non-zero M1. The URS note that corrects discovery is itself wrong, and the rule is labelled INFERRED although it was observable. | Row of 8080: M28 "150" green, then M29 "150" **blue** (`weekly-equal-week-blue.png`, highlighted row). M1 non-zero cells are blue in 3 rows (B268, B8, B38). A first week after zeros is green, not blue (e.g. M9 "2,798"). | Rule: 0 → "-"; M1 > 0 → blue; > previous → green; < previous → red; **= previous (> 0) → blue**. Mark it OBSERVED and correct the §7 note and AC-15.3. |
| AUD-M11-05 | Major | URS FN-4.1.3 ("INFERRED membership: 'ditapis' rows appear under 'Semua' only"), AC-19.3; SRS BR-M11-18 / FR-55 | **The S3 pill filters are misdescribed.** The row `x-show` is in the DOM, so this was observable. On live, "Aktif" shows **every** row with ≥ 1 answer, including the 9 "ditapis" rows: **174 rows under the label "Aktif (165)"**. "Belum login" = `!hasLogin`, which also shows Aktif students who never logged in. The docs silently change both rules, and the live label/row mismatch (a possible D9 contradiction) is not listed as a defect or DV. | Row `x-show` for a ditapis row: `(studentFilter === 'active' && true)`. After clicking the pills at 8080: Aktif 174 rows (155 plain + 10 "Perlu Semak" + 9 "ditapis"); "Login sahaja" 4 status rows (+ 1 apostrophe row that errors); "Belum login" 6 "Belum login" + 2 Aktif rows without a login (+ the error row). See `s3-aktif-pill-header.png` and `s3-aktif-pill-includes-ditapis.png`. | Specify the live filters as OBSERVED. Either replicate them (Aktif = answered, never = no login), or add a DV for the 165-vs-174 label mismatch with a minimal fix. Correct AC-19.3 and E2E-32. |
| AUD-M11-06 | Major | SRS §6.7 ("2 'Login sahaja', 8 'Belum login'"), BR-M11-24 (red box 1 n = "Belum login"), URS AC-19.3 | **Status counts are seeded from a misreading.** S5 "8 pelajar belum pernah login" counts students **without a login** (6 "Belum login" + 2 Aktif who never logged in). It is not the "Belum login" status. Live status counts at 8080 are **4 "Login sahaja" and 6 "Belum login"**. With BR-24 as written, the rebuild would print "6 pelajar belum pernah login", not the observed 8. | S3 8080 status pills: Aktif 174, Login sahaja 4, Belum login 6. S5 for the same school: "8 pelajar belum pernah login…", "3 pelajar aktif mempunyai ketepatan bawah 50%…", "174 pelajar telah mula menjawab soalan…"; cards 184 / 174 / 94.6% / 10. | Seed 4 / 6 (+2 answered without a login). BR-24 red box 1: n = students with `lastLoginAt = null`. Fix AC-19.3, AC-25.x, E2E-32 and E2E-42. |
| AUD-M11-07 | Major | URS FN-4.1.1, FN-4.1.5; SRS FR-53, FR-57, BR-17, §8.1; inventory | **Two S3 live states are missing.** (a) Subscription pill "**Cancelled** — sehingga {d MMM yyyy}" and "**Expired** — sehingga {d MMM yyyy}", both `bg-slate-100 text-slate-500`. The docs know only "Active — sehingga" and "Tiada langganan". (b) The warning box **without** the second sentence when no account is excluded: "⚠ {n} akaun menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak). Angka penglibatan di atas ialah nilai tulen selepas tapis." | School 8102 → "Cancelled — sehingga …"; 8107 → "Expired — sehingga …"; 8087 → "⚠ 3 akaun … perlu semak). Angka penglibatan …" (no "daripadanya dikecualikan"); 10220 → "⚠ 1 akaun …" (same variant). | Discovery top-up for these states: an inventory of S3 at 8102, 8107 and 8087. Add them as OBSERVED to FN/FR/BR/§8.1, and map them to M02 subscription statuses (cancelled, expired). Seed 8102 and 8107 accordingly. |
| AUD-M11-08 | Major | SRS §6.8, XR-M11-06, SQ-M11-02; URS §4 preamble, AC-04.3, 05.2–05.4, 06.4, 07.2, 08.2, 26.3 | **Cross-module: M08.** The teacher seed uses M08 v1.0 data that **M08 v1.4** has changed. In M08 v1.4: class 2002 is "5 MARIKH - **Sejarah**" (members 3001–3008), not "Bahasa Melayu"; **class 2003 was removed**; students 3009–3012 are not designed; the Sejarah session is 09-18 (3001 4, 3002 3, 3003 2 correct), not 09-20 for 3009–3011; and 3001–3008 are at **SMK DEMO (900001), level 11**. XR-06 asks M08 to confirm that 3001–3012 "carry no `schoolId`", which contradicts M08. With M08's data, 3001–3008 are T5 students with a school, so the SMK DEMO monitoring row would have 9 T4/T5 students, not 1. SQ-02 ("M08 v1.0 still uses 1001–1007") is stale. | M08 SRS v1.4 §6.10 "Designed data" table and change log v1.1 ("class 2003 removed"). | Rebuild §6.8 on M08 v1.4 (2001 Kimia, 2002 Sejarah, 3001–3008). Recompute every provisional teacher anchor. Reconcile the SMK DEMO monitoring row with M08's school assignment. Drop XR-06 and SQ-02 as written. |
| AUD-M11-09 | Major | SRS XR-M11-02, §6.7 anchors (100001–100011, 105001) | **Cross-module: M02 id policy.** The requested blocks 100001–104999 (students) and 105001–105999 (teachers) are counted inside the 5,159-user dataset but lie **outside M02 §6.15's id range** (generated ids 1–6,000, anchors inside). There is no numeric collision with 1–11, 3001–3008, 3101–3109, 3201–3215, 5001–5990 or ≥ 9,000,001, but the blocks contradict the owner's policy. Live ids are observable and fall inside that range. | Live 8080 student ids 1459–5572, Student A = 2008, teachers 2065–2363 (all ≤ 6,000). | Use ids inside 1–6,000 that avoid the fixture blocks, ideally the observed ids. Otherwise M02 must first amend §6.15. Restate XR-02. |
| AUD-M11-10 | Major | URS §7 DV-M11-08, FN-4.2.8; SRS FR-69, §8.2 | **DV-08 changes working copy on flawed reasoning.** The gap threshold (≤ 50%) is INFERRED. The rejected alternative — gap = < 60%, with "Perlu Perhatian" as the 50–< 60 band — keeps the live copy "melebihi 60%" and fits every observation (the 50.0% group stays "Perlu Perhatian"). The rejection text claims 50.0% "would no longer be the top band", which is not true. Rule D9: when unsure, follow live. | Hidden gap DOM: Kritikal 0.0%; Lemah 33.3% and 38.9%; Perlu Perhatian 50.0%; empty state "…melebihi 60%." No observed group lies between 50 and 60%. | Keep the live copy and make BR-19 "gap = p < 60" (bands inferred from the observed points), or give real evidence for ≤ 50. Remove DV-08 and its PROPOSED COPY entry. |
| AUD-M11-11 | Minor | URS §7 (DV-11 rationale), discovery D-M11-11 | **More S2↔S3 differences that flags do not explain are not recorded.** 8765: S2 "16 / 6 / 37.5%" vs S3 "Pernah Aktif 1" with no warning box (1 Aktif status, 15 Belum login). Teacher logins also differ between S2 and S3 (8087 12 vs 13, 8106 18 vs 16, 8078 53 vs 52, 8102 42 vs 43). | Live S2 teacher table and S3 cards. | Record these as live defects. Handle them in the DV-11 rework (AUD-01). |
| AUD-M11-12 | Minor | SRS SQ-M11-04, BR-19; URS DV-M11-02 ("No new content") | **Making the Gap panel visible changes its content.** The rebuild's Gap Analysis differs from the source-derived DOM. Live Student C gaps: 4 Matematik groups (0/1, 0/2, 0/1, 1/3) + 2 Sejarah groups; the seed puts them in Sejarah and Sains. Live "Subjek Belum Dicuba" lists subjects the student **has** answered (Student A: all 20, including BM, BI and Sejarah). BR-19 derives new values. This is a D9 choice, but it is recorded only as an SQ. | Hidden panel text on live for Students A, B and C (quoted in the audit notes). | List it in §7 as part of DV-02 (or a separate DV). Note that the gap values and the untried list are recomputed and do not replicate live. |
| AUD-M11-13 | Minor | SRS §6.7 Student A topics ("the remaining 6 BM answers generated at 100%") | **Observed topic rows are generated.** Student A's BM Tajuk rows are observable: "WASPADA SELALU!" Bab 4, "Dunia Baharu Tani" Bab 5, "INDAH SENI, ENDAH BUDAYA" Bab 9, "SAINS DAN TEKNOLOGI PEMACU" Bab 10, "Cergas Aktif" Bab 13 … (each 1/1). | S4 Student A "Mengikut Tajuk". | Seed the observed rows. |
| AUD-M11-14 | Minor | SRS §6.7 (no 30d column), URS AC-13.x / 16.x | **The live filter `period=30d` has no seeded figures.** The prototype's 30-day values are therefore unconstrained. | Live 30d: 57 · 4,158 · 89 · 2.1% · 22,207 · 249.5 · 522 · 277 · 53.1%; Terbaik 1 / Perhatian 32 / Cadangan 31; first row 8284 100%, then 8080 18/184 9.8%. | Add a 30d column to the seed (engaged, answers) and one AC/E2E check. |
| AUD-M11-I1 | Info | URS §7 notes (2), (3) | These discovery corrections are **right**: default Cadangan = 17 tiles, not 20 (2 motivasi, 13 hubungi, 2 hands-on); Rendah gets no tile (default 1 Rendah / 2 motivasi; 3m 3 Rendah / 2 motivasi); S5 rows are ordered by name. | Live lists: default 3 / 18 / 17; 7d 1 / 32 / 31; 3m 2 / 29 / 26; Selangor+Kritikal 3 / 9 / 8. | — |
| AUD-M11-I2 | Info | DV-01, 06, 12, 13, 16, 17, 18, 19; rejected DV-04, 05, 09, 10, 14, 15 | **These deviations are accepted.** DV-01 is the smaller of the two candidate fixes (only the login card and the list change for the admin; the reused copy is already shown by the live latihan panel). DV-06 shows the cards already present in the DOM (`x-show="i < wrongShow"`, no control changes `wrongShow`). DV-13 and DV-19 are provisional, with their PROPOSED copy listed in OQ-06. DV-16 (scrollWidth 450 at 375), DV-17 (selects 18px) and DV-12 (no active item on `/guru`) are confirmed. The rejected items are correct: the targets work, the difference is deliberate, or the item is a security note only. | Live re-measurement. | Re-check DV-01 wording if AUD-01 changes the population logic. |
| AUD-M11-I3 | Info | — | No real names are in the URS, SRS or discovery (grep for the names seen during the audit: none). Pipes in table cells are escaped. The weekly school column is sticky, as live (not a new sticky column). | — | — |

---

## Claims verified against live (2026-09-25, lane 2)

S1 `/guru/laporan`:
1. Tab title "Laporan Statistik - Portal Guru".
2. Cards: "54% Pernah Login 1708 / 3152 pelajar 1444 belum pernah login Klik untuk lihat senarai", "0% Pernah Buat Latihan 0 / 0 pelajar", "0 Jumlah Aktiviti 30 hari lepas", "-% Skor Purata".
3. The class select holds only "Semua Kelas".
4. The pills link to `?range=7|30|90` only (no `classroom_id`); "30 Hari" is active by default.
5. `?range=999` → "30 Hari" active.
6. Lists "Trend Aktiviti", "Paling Aktif", "Belum Pernah Buat Latihan"; 10 rows, each labelled "Belum pernah login".
7. At 375, scrollWidth is 450 (DV-16 confirmed); at 1280 there is no overflow.

S2 `/guru/monitoring`:

8. KPIs 57 · 4,158 · 1,462 · 35.2% · (472,371 now; 472,261 at discovery) · 323.1 · 522 · 277 · 53.1%.
9. 7d: 44 · 1.1% · 7,651 (drift) · 173.9.
10. 3m: 298 · 7.2%.
11. Selangor+Kritikal: 28 · 4,042 · 1,424 · 35.2% · 323.6 · 517 · 273 · 52.8%.
12. Kelantan+Cemerlang: 2 · 0 · 0 · 0% · 0 · 0 · 0 · 0 · 0%.
13. "33 sekolah" / "13 sekolah"; "2 sekolah" / "10 sekolah" (Selangor+Kritikal); "0 sekolah" ×2 with empty bodies (Kelantan+Cemerlang).
14. Student rows: values, order and tahap for all 33 rows match AC-14.1's live values (row 6 live 174 / 94.6%).
15. Tahap counts 8 / 7 / 1 / 2 / 15.
16. Teacher rows: all 13 values in order match AC-14.3 (school assignment: see AUD-02).
17. The tie order is by school id ascending in the default, 7d, 3m and 30d views.
18. `tahap` filters only the student table; the teacher table and the lists ignore it (Selangor+Kritikal: Terbaik 3).
19. `period` does not change the teacher table or the weekly table.
20. The form is GET to `/admin/monitoring` with a hidden `_token`.
21. The selects are 18px tall.
22. At 375, the filter wraps as Tempoh + Negeri / Tahap + Tapis / PDF · CSV · Refresh.
23. "Reset" → `/admin/monitoring` appears only when a filter is set.
24. Export hrefs: `/admin/monitoring/export/pdf?` and `…/csv?` with no query; `?period=7d`, `?period=3m`, `?period=30d` and `?state=Selangor&tahap=Kritikal` are carried (read only, not opened).
25. Guide anchors: Kad Ringkasan → #section-ringkasan … Drill-Down → #section-pelajar (6).
26. Weekly: 35 header cells (Sekolah, M1…M32, Trend, Best); M1 title "16/02 - 22/02"; 33 rows; trend 2 up / 4 down / 27 Sama; Selangor 21 rows 2 / 4 / 15.
27. Weekly: an M1 non-zero cell is blue; an equal week is blue (AUD-04); up is green, down is red; the best week has an amber ring.
28. Weekly school column `position: sticky`.
29. No page overflow at 375.
30. Signals, default: Terbaik 3; Perhatian 18 (1 Rendah, 2 Kritikal, 13 plain Tiada + 2 with "(Nota: … guru telah login)"); Cadangan 17.
31. Signals, 7d: 1 / 32 / 31 (4 motivasi, 20 hubungi, 7 hands-on).
32. Signals, 3m: 2 / 29 / 26 (2 / 19 / 5).
33. Signal templates match FN-3.7.1–3.7.3 exactly, including "Hanya … Tahap kritikal." and "Tahap rendah.".
34. The Rendah → no Cadangan tile rule holds in all 5 states.
35. The Kelantan+Cemerlang state has no weekly rows.

S3–S5:

36. S3 8080 header pills "Active — sehingga 12 May 2027" (green-100/700) and "Cemerlang — 89.7%".
37. S3 8080 pills "Semua (184)", "Aktif (165)", "Login sahaja", "Belum login".
38. S3 8080 warning text is exact (19 / 9).
39. S3 badge titles are exact: "Aktiviti luar biasa (kelajuan menjawab tidak munasabah) — perlu semak." (+ " Dikecualikan dari peratus penglibatan.").
40. S3 table headers are upper case by CSS, as are the teacher table headers.
41. S3 8080 Tingkatan mix: 152 "T5" + 32 "Tingkatan 5", grouped by the raw string (D-M11-7 confirmed).
42. S3 inactive rows link to `/admin/kirkpatrick/pelajar/{id}` (10 rows).
43. S3 940: 1 · 1 · 10 · 0 · 0, "Cemerlang — 100%".
44. S4 Student A: "· T5"; "Aktiviti Terakhir: 16/06/2026 14:19"; cards 71 / 53 / 18 / 74.6%; tabs "Jawapan Salah 18", "Gap Analysis 0".
45. S4 Student A subjects: BM 100.0% 31/31 green, Sejarah 64.0% 16/25 amber, BI 40.0% 6/15 red.
46. S4 Student A topics: "Umum 20.0% 2/10 Lemah", "Bab 1 Reading for main ideas 80.0% 4/5 Kuat".
47. S4 Student A: "Senarai Soalan (71 tersedia daripada 71)", "Papar lagi 20 (20/71)".
48. S4 Student A: "Jawapan Salah (18 jawapan, 18 soalan unik)"; 18 cards in the DOM; `wrongShow: 10` with no control (DV-06 basis).
49. S4 Student A Pemerhatian: both sentences exact.
50. S4 Tajuk subject label is `uppercase` by CSS; Senarai Soalan headers are not upper case.
51. S4 modal row 1: "Salah", "Sejarah · Sejarah Tingkatan 5 KSSM", "Percubaan SPM 2025 Sejarah Melaka", "Aras 2", "2026-06-16 14:19:57"; `max-w-2xl … max-h-[85vh] overflow-y-auto`.
52. S4 Gap panel sits outside the `tab` scope (D-M11-2 confirmed); empty-state copy "…melebihi 60%.".
53. S4 Students B and C: cards 195 / 150 / 45 / 76.9% and 265 / 168 / 97 / 63.4%; C header "· Tingkatan 5"; gap chips 2 and 6.
54. S5 of 8080: 184 / 174 / 94.6% / 10; rows ordered by name; headers not upper case; statuses Aktif (linked) 174, Login sahaja (faded) 4, Belum login (faded) 6; Ketepatan red-600 ×3; the three Cadangan sentences are exact.
55. The drill-down links use the `/admin/…` twin (S3 → S5 opened at `/admin/monitoring/sekolah/8080/guru/{id}`).
56. The ANALITIK › Monitoring item is not active on `/guru/…` (DV-12).

S6–S8 and errors:

57. S6 `?subject_id=1`: 32 options ("Semua Subjek" + 31, A→Z starting Bahasa Arab (18), Bahasa Cina (19), Bahasa Inggeris (2)); "Kelas" only "Semua Kelas"; "Reset" → `/guru/analisis-item`; form action `/guru/analisis-item`.
58. S7: 500, "500 - Ralat Pelayan | PRESTASIPLUS", exact copy.
59. S8 `?week=1`: 403, "403 - Akses Ditolak | PRESTASIPLUS", exact copy with "Log Masuk".
60. 404 on `/guru/monitoring/sekolah/99999999`: exact copy, "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi`.

Documents (checked by script):

61. Coverage 1,445 rows = the inventory IDs, with no duplicates.
62. All 30 sampled mappings are correct.
63. The 6 exclusions are all tournament-banner elements.
64. FN → FR → AC → E2E: 0 orphans.
65. 16 provisional E2E are listed.

## Notes for the round-2 re-audit

- AUD-01 and AUD-02/03 interact: once the rows carry live ids and the observed per-school values, re-derive every KPI and list value from the corrected rule set.
- Live figures drift. At audit time 8080 showed 4 "Login sahaja" / 6 "Belum login" and 472,371 answers. Pin the seed to one snapshot and say which one.

---

# Round 2 (targeted re-audit of URS/SRS v1.1 + v1.2)

| Field | Value |
|---|---|
| Documents audited | URS v1.2, SRS v1.2 (changes since v1.0: round-1 fixes, discovery top-up, OQ-M11-09 / BR-M11-34) |
| Evidence | `docs/discovery/inventory/M11/_snapshot-2026-09-25.json` (19:24–19:26 MYT; authoritative for its timestamp); extended inventory (937 content + 629 shell elements); live re-check on 2026-09-25 (browser **lane 1**, admin, read-only, URL filters only, ≥ 350 ms between GETs, no export/submit/quiz) to confirm rules; M02 SRS v1.7 §6.15, M08 SRS v1.4 §6.10 |
| Scripts | `<scratchpad>/m11-audit/r2-seed.js`: SRS §6.7 school table and weekly table compared with the snapshot. It made 401 field checks over 34 school rows plus 1,056 weekly cells (value, colour class, best ring), 33 trends, 33 Best values and the default row order. Coverage and traceability were re-run as in round 1. |

## Verdict round 2: **FAIL**

| Severity | Open from round 1 | New |
|---|---|---|
| Critical | 0 | 0 |
| Major | 0 | 1 (AUD-M11-15) |
| Minor | 0 | 3 (AUD-M11-16, 17, 18) |
| Info | — | 2 |

All 14 round-1 findings are closed.
- The admin-mirror seed now matches the snapshot exactly: the script found 0 differences in 401 field checks and 1,056 weekly cells, and the row order is identical.
- The weekly-colour and pill rules match live.
- Coverage and traceability show no regression.

The audit still fails on one new Major. The v1.2 rule BR-M11-34 is broader than the decision it implements. It excludes every school id above 10,300, which includes the schools that M02 creates at runtime (ids ≥ 10,301), not only the fixtures 900001–900099. That creates a new contradiction: a runtime school with users would appear in M02 but never in monitoring.

## Round-1 findings: status

| ID | Status | Evidence |
|---|---|---|
| AUD-M11-01 | **Closed** | DV-M11-11 withdrawn (URS §7). The S2/S5 values are replicated: AC-13.1 57 · 4,158 · 1,462 · 35.2% · 472,371 · 323.1 · 522 · 277 · 53.1% (snapshot and live lane 1, identical); AC-25.1 184 · 174 · 94.6% · 10. Flags are seeded at the 7 observed schools (8080 10/9, 8078 14/4, 8082 6/14, 8106 13/3, 8090 5/5, 8087 3/0, 10220 1/0; the snapshot `flagCount` values match). |
| AUD-M11-02 | **Closed** | §6.7 uses the live ids. The default order is identical to snapshot `s2.default.pelajarTable`, and the teacher registered/login counts per school match `guruTable` (e.g. 8087 44/12, 8090 83/42, 8106 60/18). XR-M11-03 now lists 987, 995, 1014, 8078, 8090, 8106 and 8300 as monitoring schools. |
| AUD-M11-03 | **Closed** (see new AUD-16) | Per-school answers equal the weekly row sums, and the S3 "Soalan Dijawab" values are kept as `s3Snapshot` where they differ. All 1,056 weekly cells, their colour classes, the best rings, the trends and the Best values match the snapshot (0 mismatches). E2E-27 is now observed, not provisional. |
| AUD-M11-04 | **Closed** | BR-15: "= previous and > 0 → blue", OBSERVED. The URS §7 note is corrected. AC-15.3 asserts 8080 M28 150 green / M29 150 blue, as live. |
| AUD-M11-05 | **Closed** | FN-4.1.3 and BR-18 describe the live row expressions as OBSERVED: active includes ditapis; never = no login. These match `s3.8080.pillShows` (active 174, login 5, never 9 including the apostrophe error row). The rebuild change is carried by DV-M11-21 (assessed below). |
| AUD-M11-06 | **Closed** | 8080 status 174 · 4 · 6 (+2 answered without a login) = the snapshot. BR-24: red box 1 n = `lastLoginAt` null → 8 (AC-25.3), as live. |
| AUD-M11-07 | **Closed** | BR-33, FR-53, FR-57 and AC-18.4/18.5 specify the Cancelled/Expired pills (`bg-slate-100 text-slate-500`) and the one-sentence warning. The snapshot confirms them: 8102 "Cancelled — sehingga 12 May 2027", 8228 "Cancelled — sehingga 20 Feb 2027", 8107 "Expired — sehingga 22 May 2026"; 8087 and 10220 have the one-sentence box. "Tiada langganan" is plain text, not a pill (noted in the snapshot, reflected in BR-33). |
| AUD-M11-08 | **Closed** | §6.8 uses M08 v1.4 classes 2001 Kimia and 2002 Sejarah (3001–3008). I recomputed the anchors from the M08 answer strings, and they are correct: 14 activities; 38/83 = 46%; trend 15/09 4, 18/09 3, 22/09 4, 24/09 3; 7-day total 7; Paling Aktif 3001/3002 (3 each). XR-06 and SQ-02 are updated. |
| AUD-M11-09 | **Closed** | The v1.0 id blocks are withdrawn. XR-02 places the monitoring rows inside the M02 dataset (1–6,000), asserts only Student A = 2008 (observed), and leaves the other anchor ids to M02, clear of the fixture blocks. The live overlap (8080 ids 1459–5572 vs M02 fixtures 5001–5990) is disclosed and left to the owner. This is coherent, because no M11 E2E asserts an id other than 2008. M02's 5001–5210 fixtures fit 8102 (755 "Belum login" of 776 in the snapshot). |
| AUD-M11-10 | **Closed** | DV-08 withdrawn. The live copy "melebihi 60%" is kept, and BR-19 uses gap < 60 (Perlu Perhatian 50–< 60), which fits every observed point. |
| AUD-M11-11 | **Closed** | FN-3.8.5, BR-32 and DV-22 record 8765 (S2 6 / S3 1), the teacher-login pairs (8078 53/52, 8106 18/16, 8087 12/13, 8102 42/43, 8277 16/17) and the weekly-vs-S3 answer sums. The snapshot `notes` and `s3` cards confirm each value. |
| AUD-M11-12 | **Closed** (see new AUD-18) | DV-M11-20 lists the recomputed gap content in §7. |
| AUD-M11-13 | **Closed** | Student A's 18 topic rows in §6.7 equal snapshot `s4.topics` (order, Bab, %, counts, badge). |
| AUD-M11-14 | **Closed** | The seed has a 30d column. AC-13.6 (89 · 2.1% · 22,207 · 249.5; the table starts 8284, then 8080 18/184 9.8%) and the 30d lists 1 / 32 / 31 (AC-16.4) match the snapshot. New E2E-51. |

## New deviations and decisions: assessment

**DV-M11-21 is accepted as a D9 fix and is minimal.** It changes the "Aktif (n)" pill so it shows only the n rows its label counts.
- The contradiction is on one screen and one control. On live, the pill reads "Aktif (165)" and clicking it shows 174 rows (confirmed on live in round 1 and in `pillShows.active` = 174).
- The fix keeps every observed number (165, the 174 status pills, the card and the note). It changes only which rows the filter returns, and it matches the page's own declared rule ("nilai tulen selepas tapis").
- The rejected alternative, relabelling the pill to 174, is equally small. But it would put a count next to the card "Pernah Aktif 165" that contradicts that card, so the choice is justified.
- One consequence is documented and tested: the 9 ditapis rows show the status "Aktif" but appear only under "Semua" (AC-19.3).

**DV-M11-20 is accepted.** The hidden live panel contradicts the visible data (Student C: Matematik is both "Kekuatan" and a gap; answered subjects are listed as untried). Once DV-02 makes the panel visible, recomputing it from one rule is the only way to avoid showing that contradiction. The recomputed values are marked provisional (E2E-40). See AUD-18 for one gap in the seed.

**DV-M11-22 is accepted (all 3 items replicated).** Items 1 and 2 are values on different pages. Each page is internally consistent, and equalising them would change observed figures without evidence of which side is right, so this follows the same logic as the DV-11 withdrawal. Item 3 is not visible on any screen.

**BR-M11-34 is right in intent but too broad in wording (AUD-15, AUD-17).**
- Excluding the reserved fixture schools 900001–900099 is consistent with M02 §6.15. The range is reserved there, and M02 counts 900001, 900002 and 900003 among its 60 "schools with users", so 57 = 60 − 3 fits M02 (Info I5).
- No other module is affected. Fixture accounts keep their own views (M08 classes, M10 Command Center, M13, M11 S1/S6), and no other module mounts the monitoring rollups except M17.
- The problem is the wording: "count only schools in the live id range (M02 register ids 1–10,300)" also removes runtime schools.

## New findings

| ID | Severity | Doc / section | Issue | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M11-15 | **Major** | SRS BR-M11-34, §6.5 "Users", change log v1.2; URS change log v1.2 and FN-3.3.1/3.4.2/3.5.2 ("count only schools in the live id range") | **The exclusion rule is broader than the decision.** OQ-M11-09 decided to exclude the fixture schools 900001–900099. BR-34 is instead written as an inclusion range (1–10,300), so it also excludes every school created at runtime. M02 gives those schools ids ≥ 10,301. A school created in M02 whose users answer questions would appear in M02's user and school views but never in monitoring, nor in "Jumlah Sekolah". This is a new contradiction the live site does not have. | M02 SRS v1.7 School `id` row: "fictitious fixtures 900001–900099; runtime ≥10,301"; BR-M11-34 text "count only schools in the live id range (M02 register ids 1–10,300)". | Word the rule as an exclusion: "schools with ids 900001–900099 (M02 reserved fixture range) and their users are excluded; every other school, including runtime schools ≥ 10,301, is counted". Apply the same wording in the URS FNs and change log, and add one E2E step or AC with a runtime school that does appear. |
| AUD-M11-16 | Minor | SRS §6.7 note ("the 12 answers before M1 … are not attributable to a school on live and are placed on 8090"), AC-M11-13.4, E2E-23 | **The 12 answers before M1 are on the wrong school.** They can be located by the state filter, and they are in **Johor**, not Selangor. Placing them on 8090 (Selangor) makes AC-13.4 assert 460,870, but live shows 460,858. | Live lane 1 (the figures match the snapshot: default 472,371, Σ weekly 472,359): `?state=Selangor` KPI 460,858 = Σ weekly 460,858; `?state=Johor` KPI 10,418 vs Σ weekly 10,406 (+12); `?state=Kuala Lumpur` 1,095 = 1,095. | Place the 12 on a Johor school: 8880 or 8765, still `observed:false` for the exact school. Set AC-13.4 to 460,858 (Purata/Pelajar 323.6 is unchanged). Optionally assert Johor (7 · 84 · 37 · 44% · 10,418 · 281.6 · 2 · 1 · 50%). |
| AUD-M11-17 | Minor | SRS BR-M11-34, FR-07, XR-M11-08 | **Two gaps in BR-34.** (a) "S3–S5 are not linked for them" does not say what a direct URL `/…/monitoring/sekolah/900001` (and the student/teacher pages under it) renders: 404 or the page. (b) BR-34 says "M17 applies the same rule", but XR-M11-08, the request M17 will read, does not mention it. | BR-34; FR-07 ("unknown schoolId → 404"; 900001 is known); XR-08 text. | Specify the direct-URL outcome. The minimal choice is to render as any school, because the drill-down is not scoped on live (BR-29); alternatively return 404. Add BR-34 to XR-08. |
| AUD-M11-18 | Minor | SRS §6.7 anchors (Students A/B/C), BR-19 ("Tab chip = number of gaps"); E2E-35/36 (chips asserted, not provisional) | **The observed gap chips are asserted but not guaranteed.** The chips ("Gap Analysis 0 / 2 / 6") are observed and asserted in non-provisional E2E. With DV-20 they now equal the number of gaps the rule recomputes, but the seed does not pin the chapter-label groups of A/B/C's answers. v1.0 stated that B's Fizik and Matematik answers carry no chapter label ("Umum", ignored); v1.1 dropped that note. Without it, B's Fizik 5/15 and Matematik 2/10 groups are gaps under the < 60 rule, and the chip becomes 4 instead of the observed 2. The same risk applies to A (chip 0) and C (chip 6). | SRS §6.7 Student B row (v1.1) vs the v1.0 row; BR-19. | Pin each anchor's chapter-label groups so the rule reproduces 0 / 2 / 6. B: BM "Kemahiran Bahasa Tingkatan 4" 0/1 and "… Tingkatan 5" 0/4 are the only groups below 60, and the Fizik/Matematik answers have no label. A: every labelled group ≥ 60. C: exactly 6 groups below 60. |
| AUD-M11-I4 | Info | SRS E2E-M11-53 | The wording "(SMK DEMO 900001: pelajar 2, 3001–3008, guru 5, 43 generated teachers absent)" can be read as "43 generated teachers exist at 900001". That would push teachers past M02's 551 (522 monitoring + 44). §6.8 no longer seeds them. | M02 facet teacher 551. | Reword the step: "no generated teachers at 900001". |
| AUD-M11-I5 | Info | SRS BR-08 / XR-03 | "Jumlah Sekolah 57 = M02's 60 schools with users − 3 fixture schools" is coherent in the rebuild. On live, 57 (S2) and 60 (the M02 school filter) differ for an unobserved reason; the three fixtures replace three generated schools in M02. This is an INFERRED equality, correctly labelled. | M02 §6.15 facet `schoolId`. | — |

## Regression checks

- **Coverage (script):** URS §6 has 1,566 rows = 1,566 inventory IDs (937 content + 629 shell), with 0 duplicates, 0 missing and 0 unknown IDs. Every row cites a defined FN (85) or an exclusion.
- **Traceability (script):** 85 FN → 86 FR (0 FN without an FR); 100 AC, 0 without an FR and 0 without an E2E; 86 FR, 0 without an E2E; 53 E2E, of which 14 are provisional (03, 06, 08, 10, 12, 14, 16, 20, 38, 40, 44, 45, 47, 49), matching the SRS list. Provisional ACs (teacher, exports, gap values, provisional pages) map only to provisional E2E.
- **Privacy:** no real names or e-mails in the URS, SRS, discovery narrative, inventory or snapshot. I grepped for the names seen during both audit rounds, for "SEKOLAH/SMK …" patterns and for e-mail patterns in the snapshot: 0 hits.
- **Spot-checks of 14 edited passages (all correct except AC-13.4, see AUD-16):**
  - AC-13.1–13.3 and AC-13.6 match the snapshot, and AC-13.5 is unchanged.
  - AC-14.1 matches (ids, values, tahap counts 8/7/1/2/15), as does AC-14.6.
  - AC-15.3 (8080 cells and colours; 8090 M1 blue; 8284 M32) is correct.
  - AC-16.1–16.4 (lists by id, 30d/3m counts, Nota 8277 16 / 8300 1) are correct.
  - AC-18.3–18.5 are correct.
  - AC-19.3 (165 / 4 / 8 / 184 with DV-21 and DV-18) is correct.
  - AC-25.3 (8 = 6 + 2) is correct.
  - AC-05.2, AC-06.4 and AC-08.2 (M08 v1.4 recomputation) are correct.
  - BR-15, BR-17, BR-18, BR-24 and BR-33 match the snapshot rules.
  - §6.7 Student A topics are correct.
- **Live rules re-confirmed on lane 1:** the default KPIs equal the snapshot (no drift since 19:24); the S2 per-state KPI sums are listed in AUD-16. The weekly equal-week blue rule and the S3 pill membership were confirmed live in round 1 and match the snapshot's `derivedRules`. I took no new screenshots in round 2 (the round-1 masked images still apply).

To pass round 3, fix AUD-M11-15 (reword BR-34 as an exclusion of 900001–900099) and preferably AUD-16 to AUD-18. Round 3 then only needs to re-check BR-34, AC-13.4 and the anchor chapter-label groups.

---

# Round 3 (targeted check of URS/SRS v1.3; no browser)

**Verdict: PASS** — 0 Critical, 0 Major, 0 Minor, 1 Info.

All round-2 findings are closed. I checked them by script against `_snapshot-2026-09-25.json` and by recomputing the new values (script: `<scratchpad>/m11-audit/r3-seed.js`).

| ID | Status | Evidence |
|---|---|---|
| AUD-M11-15 | **Closed** | BR-M11-34 is now an exclusion of 900001–900099 only; "every other school is counted", including runtime schools ≥ 10,301. The phrases "1–10,300" and "live id range" no longer appear in either document. FN-3.3.1, 3.4.2 and 3.5.2 carry the same wording. New AC-14.7 / E2E-54: its figures are internally consistent. It adds 1 school (58), 1 student (4,159), 1 engaged student (1,463), 5 answers (472,376) and 1 teacher (523), and % Penglibatan stays 35.2%. The new row sorts after 8284 because of the id tie-break, and M32 = 5 because the answers are today's. |
| AUD-M11-16 | **Closed** | The 12 answers from before M1 are now on 8880 (`observed:false`), which gives a seed value of 10,208. The seed-vs-snapshot comparison was re-run: 0 differences over 401 field checks and 1,056 weekly cells. AC-13.4 reads Selangor 460,858, which is the live value. Johor adds up to 10,208 + 210 = 10,418 answers; the other Johor figures are 84 students, 37 engaged (44%), Purata 281.6 and teachers 2 / 1 (50%), as on live in round 2. |
| AUD-M11-17 | **Closed** | BR-34 and E2E-53 say a direct URL to a fixture school renders its S3 page (INFERRED, consistent with BR-29). XR-M11-08 now carries the rule for M17. |
| AUD-M11-18 | **Closed** | The chapter-label groups are pinned, and their sums equal the subject rows. The gap rule (< 60%, "Umum" ignored) gives the observed chip counts 0 / 2 / 6. **A:** groups 31/31, 16/25 (64%) and BI 4/5, with the 10 BI answers unlabelled → 0 gaps. **B:** BM 0/1 + 0/4 + 28/30 = 28/35, plus Biologi, Sejarah and PI groups all ≥ 80%; Fizik and Matematik unlabelled → 2 gaps. **C:** Sejarah 7/18 + 6/12 + 50/75 = 63/105; Sains 3/10 + 4/9 + 0/2 + 1/3 + 25/26 = 33/50; PI 42/50, Biologi 10/15, Matematik 5/5, BI unlabelled → 6 gaps (38.9, 50.0, 30.0, 44.4, 0.0 and 33.3%). Totals: A 71/53, B 195/150, C 265/168, all ✓. |
| AUD-M11-I4 | **Closed** | E2E-53 now reads "no generated teachers at 900001". |

**Regression (script):**
- Coverage: 1,566 / 1,566 rows = the inventory IDs, with 0 missing, 0 unknown and 0 bad cover entries.
- 85 FN → 86 FR, with no FN without an FR.
- 101 AC (no duplicates, 0 without an FR, 0 without an E2E) and 86 FR with 0 without an E2E.
- 54 E2E, of which 14 are provisional (03, 06, 08, 10, 12, 14, 16, 20, 38, 40, 44, 45, 47, 49), matching the SRS list.
- No real names in either document.

| ID | Severity | Doc | Issue | Fix |
|---|---|---|---|---|
| AUD-M11-I6 | Info | URS §0 "Status" row | The status line still reads "Draft v1.1" while the change log is at v1.3. | Update the status text; this does not block the gate. |
