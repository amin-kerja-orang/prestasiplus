# M10 — Teacher Portal: Class & Teaching — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M10-teacher-class.md` v1.0, `docs/requirements/srs/M10-teacher-class.md` v1.0 |
| Evidence | discovery `M10-teacher-class.md`, `inventory/M10/*.json`, `_raw/M10/_scripts/*.js`, `img/M10/`; live re-walk on 2026-09-25 (browser lane 1, admin account, read-only, GETs throttled to 400 ms or more, names masked with `tools/sanitize.js`) |
| Cross-module docs | M01 v1.8, M02 v1.7, M04 v1.5, M05 v1.4, M08 v1.2, M09 v1.2, `docs/design/shells.md` |
| Auditor | independent audit agent (not an author) |
| Screenshots | `docs/qa/audit/img/M10/` (all masked): `s2-375-nav-clipped.png`, `s7-level-labels-masked.png`, `s20-padam-nested-form.png` |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 8 |
| Minor | 7 |
| Info | 3 |

The documents are thorough: 3,150/3,150 elements are covered, traceability is clean, and most copy matches live exactly. The audit still fails, for four reasons:
- **Seeds and cross-module data.** The teacher data set is built on M08 classes and students that the approved M08 v1.2 and M02 v1.7 no longer contain. The attendance population uses user ids outside the M02 id policy. The M04 counts and anchors are not bound to M04's contract.
- **Two deviations go too far or invent values.** DV-M10-02 adds `soalan_guru`, a value with no evidence. DV-M10-28 is a blanket rule over screens nobody measured.
- **A live defect was missed.** On S20, "Padam" deletes without a confirm because its form is nested inside the edit form.
- **S2 responsive behaviour is described wrongly.** The Command Center grid never reflows, and the docs specify an unlisted redesign as if it were live behaviour.

---

## Findings

| ID | Severity | Doc / section | Issue | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M10-01 | **Major** | SRS §6.11 designed data, §13 item 7; URS §4 preamble, AC-04.2, 05.4, 06.4, 08.3, 12.2, 13.1, 16.4, 18.4, 18.5, 27.2 and every teacher E2E | **Seed mismatch with approved M08 v1.2 and M02 v1.7.** M10 "adopts" the M08 classes 2001–2003 and students 3001–3012. The approved M08 SRS v1.2 differs: class 2002 is **"5 MARIKH - Sejarah"** (Sejarah 5, level 11, DMO102, members 3001–3008), not "5 MARIKH - Bahasa Melayu". Class **2003 was deliberately removed** in M08 v1.1 because it "would add a 14th T4 row" to the observed M08 S1 count of 13. M08's student anchors are **3001–3008 and 3201–3215**, and M02 v1.7 §6.15 registers only those, so 3009–3012 do not exist. As a result, every teacher anchor is built on records that do not exist: pelajar id 2 in class 2003, 13 distinct students, S2 "Soalan Dijawab 177", the S7 trend "0, 23, 0, 38, 0, 8, 8 %", S7 22/09 "Hadir 5", S34 set 7402 for class 2003, and the S4 counts 8/8/5. SRS §13 item 7 ("M10 adopts … 3001–3012 unchanged") is stale. | Documents: M08 SRS v1.2 change log and §6.10 (lines 20–21, 311, 338, 396–397); M02 SRS v1.7 §6.15 (line 523). | Re-base the teacher data on the approved M08 v1.2 records: classes 2001 Kimia and 2002 Sejarah, members 3001–3008, and their M08 sessions. If the student-side ACs (S33 join, S34 set list) need a class for pelajar id 2, add a new M10 class that does not change any M08 anchor count, in agreement with M08, or use runtime data. Recompute every anchor (S1, S2, S3, S4, S6, S7, S21, S34), fix SRS §13 and re-run the trace. |
| AUD-M10-02 | **Major** | SRS §6.11 admin mirror (S7), NFR-M10-03; D11/D12 | **The attendance population breaks the users store policy.** The 137 admin-mirror students are seeded as "fictitious students **6001–6137** ('Pelajar Kehadiran 001…137', no login)". Users belong to M01/M02 (D12). M02 §6.15 allows only generated live-range ids 1–6,000 (anchors inside them) and runtime ids from 9,000,001. Ids 6001–6137 are neither, so they either add 137 users to the 5,159 total or create a second, parallel user list. The observed level split is also not pinned: live shows T4 12 + "Tingkatan 4" 2 = **14** and T5 15 + "Tingkatan 5" 108 = **123**. The SRS only says "levels 10/11 distributed". | Live `/guru/kehadiran-digital`: 137 rows; label counts {T4: 12, T5: 15, Tingkatan 4: 2, Tingkatan 5: 108}; groups in the order T4, T5, Tingkatan 4, Tingkatan 5 (`s7-level-labels-masked.png`). | Take the 137 students as anchors inside the M02 student cell, with ids in 1–6,000 agreed with M02 as an XL request, or as a named selection over existing dataset students. Pin the split at 14 Tingkatan 4 and 123 Tingkatan 5 so that the DV-M10-13 groups have exact counts, and state that the admin's population source stays UNVERIFIED (OQ-M10-03). |
| AUD-M10-03 | **Major** | SRS BR-M10-21, BR-M10-27, §6.11 S17–S28, §13 item 4; URS FN-M10-7.1.1, 8.2.1; D11 | **Counts are not tied to M04's named queries or facets, and M10's anchors are missing from M04's contributed-anchor table.** No M10 count cites an M04 §4.1 query (no `Q-…` anywhere in the SRS). Specifically: S21 "Jumlah 16,817" needs a `createdBy` facet that M04 §6.13 does not define. S28 BM needs a 6,048 / 5,918 mcq / 105 essay / 25 "other types" split that M04 does not define (the 25 are INFERRED). S17 N should be `Q-STRUCT-ALL`. The anchors 522425–522427, 522445–522447, 525431–525433, the three BM T3 anchors and the **pending** 700301 are not in the M04 §6.13.2 table. M04 lists only approved and active cells for contributors, so a `pending_review` anchor has no cell. The StructuredQuestion `visibility` enum differs: M04 has `public \| private`, M10 has `public \| tingkatan \| class`. Listing these as requests in §13 is not enough: the counts are asserted as fact in ACs that are not provisional (AC-33.1, 35.4, 42.1–42.3, 28.2). | M04 SRS §6.13.2 and §4.1 query list (Q-ALL … Q-STRUCT-VISIBLE); M04 DATA-M04-02. | For each M10 count, name the M04 query or facet it uses (add `Q-CONTRIB-BY-USER`, `Q-SUBJECT-BANK` and similar through M04), register the M10 anchors in M04 §6.13.2 with cells that have room, and align the `visibility` enum with M04 (as an XL request). Until M04 accepts these, mark the dependent ACs as depending on the M04 change. |
| AUD-M10-04 | **Major** | SRS §6.2 DATA-M10-01; D12 | **The owner does not specify the Classroom dataset.** M10 claims ownership of Classroom and enrolment (D12), and M08 v1.2 depends on an M10 class dataset: 750 platform classes (T4 exactly 13, T5 645, 92 other levels), 551 teachers and 4,533 distinct enrolled students (M08 SRS line 338, URS OQ-M08-12). The M10 SRS mentions "live ids kept for M08 mirror classes (4, 5, 6, 228, …)" but defines no dataset, no totals, no facets and no id range. So the only published spec for the store M10 owns is written in another module. | M08 SRS §6 (line 338); M08 URS OQ-M08-12. | Add a Classroom/enrolment dataset subsection to M10 SRS §6 in the same form as M02/M04 §6.13/§6.15: totals, facets, id range, anchors (M08 observed classes and the designed classes), and the runtime id rule for classes created on S5. |
| AUD-M10-05 | **Major** | URS DV-M10-02, FN-M10-5.2.5, AC-23.3; SRS FR-M10-56, BR-M10-17, DATA-M10-04, E2E-M10-39 | **DV-M10-02 invents a value and a rule and states them as fact.** Nothing in the evidence supports `mission_source = soalan_guru`. It appears in no inventory state, no page script, no discovery text and no other module. The only observed value is the hidden input `bank_soalan`. `#youtubeSection` contains only text, the "Soalan Saya" link and an alert; it has no question picker. The rule that "the mission draws its questions from the teacher's Soalan & Rujukan questions of the subject" is INFERRED, but the E2E that is not marked provisional (E2E-39, AC-23.3) asserts `soalan_guru`. `mission_type = youtube` already carries the teacher's choice, so the minimal fix of the broken `toggleSource()` is to show and hide the section only. | `inventory/M10/S12-misi-harian-cipta.json` EL-S12-011 (hidden `mission_source` only) and EL-S12-025…028; live `/guru/misi-harian/cipta`: `toggleSource` is referenced but no function is defined. | Narrow DV-M10-02 to the visibility toggle of `#youtubeSection`. Drop `soalan_guru` or mark it PROPOSED in §9, and assert it only in a provisional E2E. Move the question-pool rule of BR-M10-17 for type `youtube` into provisional behaviour (OQ-M10-10). |
| AUD-M10-06 | **Major** | URS DV-M10-28, AC-48.2; SRS FR-M10-129, §10 | **DV-M10-28 is over-broad and the two documents contradict each other.** The URS says that "any unlisted instance below 12px in M10 page content is covered by this rule", while the text sizes of the other screens "were not measured". That silently changes screens nobody inspected. The SRS (FR-129, AC-48.2, E2E-09) limits the rule to S2. Live has several sub-12px texts outside S2 that neither document lists. | Live, 1280 px, computed font sizes: **S1** guide text 10px, checklist subtitles and "Lihat" 9px, "Top 3" / "Analitik Kelas →" / "Rule-based" 11px. **S7** trend day labels 8px, trend "0%" 9px, "Tidak Hadir" badges 10px. **S21** tier names 10px, thresholds "(10)" … 8px, card chips 11px. S17, S27, S28, S29, S10 and S5 have none. S2 sizes range from 0.5rem to 0.75rem (the style sheet includes `font-size:0.5rem`). | Either list every instance (S1, S7 and S21 elements with their live sizes) in DV-M10-28 and extend FR-129 and E2E-09 to them, or limit DV-M10-28 to S2 exactly as the SRS does and replicate the other screens as live. Remove the blanket sentence. |
| AUD-M10-07 | **Major** | URS FN-M10-6.4.7, AC-32.3, §7; SRS FR-M10-90, §8.2, E2E-M10-56; discovery §2.20 | **Missed live defect on S20 "Padam", and SOURCE-DERIVED copy mislabelled as PROPOSED.** The S20 delete form is **nested inside** the edit form. The live DOM discards the inner `<form>`, so "Padam" submits the **outer** form (`POST …/4454` with `_method` = PUT and DELETE; the server reads the last value, DELETE) **without any confirm**. The page source has `onsubmit="return confirm('Padam soalan ini?')"` on the dropped form. The SRS calls "Padam soalan ini?" PROPOSED COPY, the URS says "confirm UNVERIFIED", and E2E-56 asserts a confirm that live never shows. The inventory also missed the confirm, because the browser removed the attribute. | Live `/guru/soalan-berstruktur/4454/edit`: `document.forms` has 3 forms and no delete form. The Padam button's `form` = the edit form with `_method` values "PUT,DELETE" and no `onsubmit`. Source text: `<form … onsubmit="return confirm('Padam soalan ini?')">` nested inside the edit form (`s20-padam-nested-form.png`). Never clicked. | Add a DV (D9: a destructive control that deletes without its intended confirm), for example a separate delete form with the source confirm "Padam soalan ini?" (SOURCE-DERIVED, not PROPOSED). Alternatively, replicate and state that live deletes immediately. Update FN-6.4.7, FR-90, §8.1/§8.2 and E2E-56. Add a discovery note (top-up) for the nested form. |
| AUD-M10-08 | **Major** | URS FN-M10-2.2.1, §5 (S2 row), DV-M10-17; SRS §10 (S2 row); discovery §2.2 and §7.1 | **The S2 responsive behaviour is described wrongly, and the unlisted fix is presented as live.** The docs say that "KPI tiles 4 → 2 → 1 columns" and that "'LIVE' and the clock stay desktop-only as live / hidden". On live, the grid **never reflows**: it has 4 columns at 1280, 768 and 375 (`grid-template-columns` 174/174/174/208 px at 768). At 375 the tiles are squeezed and the panels ("GPS Sekolah", "Engagement Pelajar", "Soalan Dijawab") are **clipped off-screen** by `body{overflow-x:hidden}`. The five links and the LIVE badge are **not hidden**: they have `display:block/flex` and sit at x = 380–791 px, clipped. The only media query is `max-width:1400px`. DV-M10-17 fixes only the nav, while the SRS silently specifies "KPI tiles 1 per row / 2 per row", which is an unlisted deviation. | Live S2 at 375: links at x 284 (Remedial), 380, 461, 554, 647, 724; `.live-badge` display flex; `scrollWidth` 375 with overflow hidden (`s2-375-nav-clipped.png`, identical to discovery `command-center-mobile.png`). At 768: 4 columns, 2 header items clipped. | Rewrite DV-M10-17 as "S2 layout breakage at < 1024px": the grid reflow (4 → 2 → 1), panels not clipped, the nav row, and a deliberate decision for LIVE/clock (clipped on live, so reachable or hidden per D9 minimality). List it as a deviation, correct FN-2.2.1, URS §5, SRS §10 and discovery §7.1, and cover 768 in E2E-09. |
| AUD-M10-09 | Minor | URS AC-18.5; SRS E2E-M10-30 | Provisional E2E not marked. AC-18.5 / E2E-30 asserts "Hadir 5 on 22/09" for the teacher. That depends on the INFERRED population (BR-M10-04) and on designed sessions (a populated attendance state never observed), yet it carries no "(provisional)" or "yes" mark. The count "34 provisional" is therefore wrong by one. It is also affected by AUD-M10-01. | — | Mark AC-18.5 and E2E-30 as provisional (35 provisional E2E). |
| AUD-M10-10 | Minor | URS §9 "PROPOSED items to report at G1"; SRS §8.2 | The G1 list in the URS is incomplete. It omits the PROPOSED COPY that the SRS §8.2 lists: the confirms "Padam jadual ini?", "Padam mesej ini?" and "Padam soalan ini?" (S8, S9, S15; for S20 see AUD-07), "Tiada soalan untuk topik lemah" (BR-12), the trend labels "Naik"/"Turun"/"Stabil" (BR-14; live takes `p.trend_label` from the server), and the Evaluate alert and suggestion texts (BR-15). The URS FN-4.2.3 also says "confirm and copy UNVERIFIED", while the SRS adds a confirm, which is new behaviour for an unobserved control. | Live S2 script: `{text: p.trend_label, …}` (the label is server-side, so the PROPOSED label is justified). | Add every PROPOSED COPY item to the URS §9 G1 list and align FN-4.2.3, 4.3.2 and 5.5.5 with the SRS (state explicitly that a confirm is PROPOSED behaviour). |
| AUD-M10-11 | Minor | URS DV-M10-08; SRS BR-M10-24, FR-94 | Two different PROPOSED CSV formats for the same question store. M10 invents `subjek,tahap,soalan,pilihan_a…` while M04 FR-57 / AC-M04-13.6 (also INFERRED) specifies `question_text,option_a,…,subject_id,education_level_id,difficulty_level,marks,explanation` for the import into the same M04 store (D12: one owner, no parallel schemas). | M04 URS AC-M04-13.6; SRS FR-M04-57. | Reuse or derive from the M04 import format (M04 owns the import contract). Keep M10's Panduan copy as live, and keep the header PROPOSED in §9. |
| AUD-M10-12 | Minor | URS FN-M10-6.1.4, coverage EL-S17-024…026 | (a) `fa-toggle-off` "(draft)" is asserted as an OBSERVED control, but it is not in the live source: every row is published and the source contains only `fa-toggle-on`. (b) The live toggle button's title **"Tukar Status"** (captured in `inventory/M10/S17-soalan-berstruktur.json`) is missing from the URS and SRS. | Live `/guru/soalan-berstruktur` source: `title="Tukar Status"` and `fa-toggle-on` present; `fa-toggle-off` absent. | Mark the draft icon INFERRED and add the title "Tukar Status" to FN-6.1.4. |
| AUD-M10-13 | Minor | SRS §6.4, §6.11, FR-126; URS §4 preamble | "Admin teacher profile id 3" is labelled observed. Only the URL `https://prestasiplus.my/guru/3` is observed. The live admin's user id is 1 (M01: `/pelajar/1`), and both `/guru/1` and `/guru/3` return 404, so nothing shows which entity 3 belongs to. The claim that it is a TeacherProfile id is plausible but INFERRED. | Live S32: three occurrences of `/guru/3`; `schoolPicker currentId: null`; GET `/guru/3` 404 and `/guru/1` 404. | Label the id INFERRED in DATA-M10-03 and §6.11 (OQ-M10-12 already asks the question). |
| AUD-M10-14 | Minor | SRS §6.11 (S17 anchor 4454 "text/model answer as observed"); URS FN-M10-7.6.2 | Privacy of seeds. Live stimulus 4454 begins "Soalan Oleh: {real teacher name} Kertas 2 …", and discovery masked it as `<person>`. "As observed" could lead a builder to copy the real name from live. S26 placeholder "Contoh: Cikgu Nur Demo" is live copy but looks like a real person's name. | Live S17 first row: "Soalan Oleh: Cikgu R… Kertas 2 Bab 7 Tingkatan 5 (2019) …" (not quoted here in full). | State in §6.11 that the "Soalan Oleh:" author is replaced by a fictitious name. Refer the S26 placeholder to the Delivery Lead (replicate the live copy, or D9 privacy treatment). |
| AUD-M10-15 | Minor | URS DV-M10-15, FN-7.4.4; SRS FR-109, BR-22 | DV-M10-15 is sound and creates no new contradiction on S24 (the options Mudah/Sederhana/Sukar map to 2/3/4, the same as the M04 labels; S23 "Tahap 4" matches "Sukar"). However, "saving with '-- Pilih --' keeps the saved difficulty" is a server rule nobody observed, and it is written as fact. | Live S24: options `"" "-- Pilih --"` (selected), `1 Tahap 1 (Mudah)`, `2 Tahap 2 (Sederhana)`, `3 Tahap 3 (Sukar)`; S23 chip "Tahap 4". | Mark the "-- Pilih --" handling INFERRED. |
| AUD-M10-16 | Info | DV-M10-14 | Confirmed that the chips are in descending count order with "Lain" in its count position: 3,287 … 795, 763, 510, 363, 269. Replication is correct. | Live S21. | — |
| AUD-M10-17 | Info | DV-M10-25 | Confirmed that exactly 8 icon tiles are blank: SCI `fa-beaker`, CHEM `fa-flask-round`, EKON `fa-trending-up`, ADDMATH `fa-variable`, SK `fa-monitor`, BA/BC/BT `fa-languages`. PHY `fa-zap` and AKAUN `fa-receipt` render. The h1 colour is `rgb(30,41,59)` on the gradient. The fix fits D9. | Live S27 `::before` content. | — |
| AUD-M10-18 | Info | DV-M10-26, DV-M10-01, 03, 04, 05, 09, 13, 18–21, 23; replicated 06, 07, 10, 11, 12, 16, 22, 27 | Checked and accepted. They fit D9/D10 and are minimal. DV-M10-12: the admin S1 figures 20719 / "✅ 19361 diluluskan" (re-verified live) are declared as documented display constants in DATA-M10-11 and do not sit next to a contradicting figure on the same screen, which complies with D11 XL-34. DV-M10-03: the populated states are provisional (E2E-16 "yes"). The admin empty-scan state is the defined fix output. | See the claims list. | — |

---

## Coverage matrix and traceability checks

- **Inventory re-run.** `tools/inventory.js` and `sanitize.js` were run live at 1280 on S1, S9, S13, S14 and S33. Content elements after the shell: S9 = 14, S13 = 11, S14 = 39, S33 = 13, S1 = 83. All equal the saved `inventory/M10/*.json` counts and texts (the S1 guide was hidden in this browser, and the pill "Tunjuk panduan Mula Di Sini" is in the inventory). No new element was found on the sampled screens. The exception is the S20 confirm of AUD-07, which the DOM itself drops.
- **Coverage matrix.** 3,150 rows, of which 99 are exclusions. The exclusions are exactly the M16 tournament banner "LIVE:" / "MAIN" / "DAFTAR" on the 33 user-shell screens S1 and S3–S34 (33 × 3), which is correct. I spot-checked 30 mappings, one row in every 105 (S1-007, S2-029, S4-010, S7-009, S10-024, S15-004, S16-087, S17-003 (excluded), S18-036/141/246/351/456/561/666/771/876/981, S20-077, S21-013/118/223, S22-094/199, S25-024, S26-098, S28-030/135, S30-006, S31-054). All map to the right Function.
- **Traceability** (script in the scratchpad `m10-audit/trace.js`): 212 FN, and every FN is cited by at least one FR. All 162 ACs appear in at least one E2E, all 129 FRs appear in at least one E2E, and there are 80 E2E, 34 of them marked provisional. Every provisional AC is covered by a provisional E2E. There are no orphans. Exception: AUD-09. The three viewports are declared for every E2E in SRS §12.
- **`|` escaping.** The table rows with interpolated pipes (FN-2.2.4, 6.1.3, 6.3.2, FR-17, BR-08, BR-19, the §6 types) are escaped with `\|`. No broken table was found.

---

## Claims verified (live or evidence), 60

| # | Claim (doc) | Result |
|---|---|---|
| 1 | S1 "Soalan" 20719 (FN-2.1.3) | ✓ live |
| 2 | S1 "✅ 19361 diluluskan" | ✓ live |
| 3 | S5 11 level radios `tahun-1…6`, `tingkatan-1…5`, none `required` (DV-22) | ✓ live |
| 4 | S5 SK rule: `x-show="!schoolType \|\| schoolType === 'SK'"` on the Tahun tiles (BR-03) | ✓ live source |
| 5 | S33 placeholder "cth: MAT5B2" | ✓ live |
| 6 | S33 `maxlength=6` (join-code length) | ✓ live |
| 7 | S33 `class_code` required | ✓ live |
| 8 | Join-code samples UDL749 / KCC904 / JOV330 / 0VV295 (BR-02) | ✓ M08 discovery |
| 9 | S9 `maxlength=500` | ✓ live |
| 10 | S9 message `required` | ✓ live |
| 11 | S9 priorities `normal` (checked) / `important` | ✓ live |
| 12 | S10 countdown resets to 30 (`this.countdown = 30`), "Auto-muat semula setiap 30 saat" | ✓ live |
| 13 | S10 failure text "Gagal mendapatkan data. Periksa sambungan internet anda." | ✓ live |
| 14 | S14 `time_limit_minutes` 1–360, placeholder "Tiada had" | ✓ live |
| 15 | S14 `max_attempts` 0–99 | ✓ live |
| 16 | S14 statuses `draft` / `scheduled` / `published` | ✓ live |
| 17 | S12 "3 syiling" / "per soalan betul" | ✓ live |
| 18 | S12 "5 hingga 50 soalan" | ✓ live |
| 19 | S12 `toggleSource()` referenced, not defined (D-02) | ✓ live |
| 20 | S12 `mission_source` only `bank_soalan`; no evidence of `soalan_guru` | ✗ AUD-05 |
| 21 | S12 youtube section = text + link + alert, no picker | ✓ inventory |
| 22 | S2 remedial "(<50% accuracy)" and "Tiada pelajar dengan topik lemah" strings | ✓ live source |
| 23 | S2 `setInterval(fetchData, 10000)`, footer "Data dikemaskini setiap 10 saat" | ✓ live |
| 24 | S2 confirm "Batal set soalan remedial untuk …" | ✓ live source |
| 25 | S2 drill types students/today/subjects/gps, kirk t1–t4, mood, engagement (`data-drill="engagement"`) | ✓ live source |
| 26 | S2 prediction trend label from the server (`p.trend_label`); "Naik/Turun/Stabil" is PROPOSED | ✓ (PROPOSED justified) |
| 27 | S2 text sizes 0.5–0.75rem (DV-28 basis) | ✓ live |
| 28 | S2 at 375: five links "hidden", LIVE/clock "desktop-only", KPI "2-up → 1-up" | ✗ AUD-08 (clipped; grid always 4 columns) |
| 29 | S2 tab title "Command Center — Guru: {nama}" | ✓ live |
| 30 | S7 "≥5 answers/day" footnote "sekurang-kurangnya 5 soalan" | ✓ live |
| 31 | S7 137 rows | ✓ live |
| 32 | S7 labels T4/T5/"Tingkatan 4"/"Tingkatan 5", groups in that order (DV-13) | ✓ live (split 12/15/2/108) |
| 33 | S7 date default = max = today | ✓ live |
| 34 | S7 and S1/S21 texts below 12px | ✗ unlisted, AUD-06 |
| 35 | S16 "Sembunyikan Panduan" / "Baca Panduan Dulu!" / "Tiada kelas ditemui." | ✓ live |
| 36 | S17 "Showing 1 to 20 of 4061 results", pager 1–10 … 203 204 | ✓ live |
| 37 | S17 first row 4454 Perniagaan "MOTS 3", 1 sub, "8m", "Public", "Terbit" | ✓ live |
| 38 | S17 toggle form `POST …/4454/toggle-status` | ✓ live (title "Tukar Status" missing from docs, AUD-12) |
| 39 | S17 `?status=draft` → "Tiada soalan berstruktur lagi" | ✓ live |
| 40 | S18 sub labels from `'abcdefghij'` | ✓ live source |
| 41 | S18 Eksperimen template does not revert (`if (this.template !== 'eksperimen') return;`) | ✓ live source |
| 42 | S20 chapter not preselected (D-05); `kbat_level` = 3 | ✓ live |
| 43 | S20 sub "Markah" min 1 max 50, no `required` | ✓ live |
| 44 | S20 rubric "Tambah" always F (`addRubric` pushes `konstruk:'F'`) | ✓ live |
| 45 | S20 "Padam" confirm "PROPOSED COPY"; delete via nested form | ✗ AUD-07 (source copy; nested form, no confirm) |
| 46 | S21 stats 16817 / 16817 / 0 / 0 | ✓ live |
| 47 | S21 "Pecahan Subjek" order, including "Lain — 763" (DV-14) | ✓ live |
| 48 | S21 card date "02 May 2026" | ✓ live |
| 49 | S23 chips "Bahasa Melayu", "textbook_content_rebuild", "Tahap 4", "mcq", options "A)"…"D)" | ✓ live |
| 50 | S24 difficulty options "Tahap 1 (Mudah)"…"Tahap 3 (Sukar)", values 1–3, nothing preselected (DV-15 basis) | ✓ live |
| 51 | S27 8 blank icons, which ones, and icon classes (DV-25) | ✓ live |
| 52 | S27 h1 dark (`rgb(30,41,59)`) | ✓ live |
| 53 | S28 header "Bahasa Melayu" / "6,048 soalan" (AC-01.3) | ✓ live |
| 54 | S28 `?question_type=mcq&difficulty=3` → "Tahap 3", "Bahasa Melayu T3 - Sokongan Tema Buku Teks" | ✓ live |
| 55 | S28 `teacher_databank`, "Sudah Dilaporkan", "Ralat rangkaian. Sila cuba lagi.", "Gagal menghantar laporan." | ✓ live source |
| 56 | S29 "36" Jumlah Artikel | ✓ live |
| 57 | S32 public URL `/guru/3`; `/guru/3` and `/guru/1` both 404 | ✓ live (id nature INFERRED, AUD-13) |
| 58 | `/guru/set-soalan/1` → 405 (DV-26 basis) | ✓ live |
| 59 | M08 classes 2001–2003 / students 3001–3012 "adopted unchanged" | ✗ AUD-01 (M08 v1.2: no 2003, 2002 = Sejarah, 3001–3008 + 3201–3215) |
| 60 | Canonical names "Admin Demo" (id 1) and "Guru Demo" (id 5, SMK DEMO 900001) | ✓ M01 SRS |

---

## Safety log

- Read-only. The only clicks were client-side reveals needed for measurements, and no reveals were needed after the loads. The following were never pressed: Simpan, Hantar, Cipta, Kemaskini, Padam, Broadcast, toggle, Jana, remedial scan, Evaluate, Badges, attendance. No quiz, session or live-class link was opened.
- The S20 "Padam" defect was established from the DOM (`button.form`, `document.forms`) without clicking.
- GETs ran one at a time with 400 ms or more between them. Every screenshot was masked with `sanitize.js`; on S20, "Cikgu …" texts were also masked. No credentials were written to any file.

---

## Round 2 (targeted re-audit of URS/SRS v1.1): **PASS**

**Scope.** The v1.1 revision lines of both documents, SRS §6.2.1, §6.11 and §13 (R-M02-01, R-M04-01…06), the DVs that changed (02, 08, 15, 17, 28, 29), the edited FRs, ACs and E2Es, discovery §2.20 and D-26, and the URS §9 G1 list. I re-checked the following on live (lane 1, read-only, GETs at least 400 ms apart):
- S20 confirm source;
- S7 level split;
- S21 page 2 first id.

The S2 grid and clipping evidence is the round-1 measurement, unchanged.

| Severity | Open after round 2 |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 2 (new) |
| Info | 1 (new) |

### Round-1 findings

| ID | Status | Evidence (round 2) |
|---|---|---|
| AUD-M10-01 | **Closed** | SRS §6.11 is re-based on M08 v1.3/v1.4: classes 2001 "5 MARIKH - Kimia" and 2002 "5 MARIKH - Sejarah" (T5, DMO101/102), members 3001–3008, no class 2003, and 3009–3012 removed. I recomputed the anchors from M08 SRS §6.10 (lines 407–416) and they are correct: Kimia 9+10+8+8+8+8+9+8 = 68, plus Sejarah 09-18 3×5 = 15, gives **83**; S7 22/09 Hadir 4 (3005–3008, 8 answers each) = 50%; 09-24 below 5 answers for everyone, so 0%; 18/09 Hadir 3; S3 +27% (60 − 33). The values that can no longer be reproduced (13 students, 177, 8%, Hadir 5, S34 via 2003) are listed as **withdrawn, not tuned**. S34 is now covered by a runtime join in a provisional E2E. |
| AUD-M10-02 | **Closed** | S7 population = the M02 named selection `attendanceMirror` (R-M02-01): 137 generated rows, ids inside 1–6,000, **14 T4 / 123 T5**, no answers 19–25 Sep, no M10 user rows. Live still shows {T4 12, T5 15, Tingkatan 4 2, Tingkatan 5 108} = 14 / 123. |
| AUD-M10-03 | **Closed** (pending M04 acceptance, routed) | S17 cites **Q-STRUCT-ALL**, S27 cites **Q-SPM-POOL**, S21 cites the requested **Q-CONTRIB(user)** (R-M04-01), and S28 cites the requested **Q-TEACHER-DATABANK(subject)** (R-M04-02). The requests are precise: observed values, per-subject counts, id order 522425 → page 2 from **522445** (re-verified live), 64 pages of 15 (946–960), and the 25 "other types" marked INFERRED. R-M04-03 names a cell for every anchor, including a non-approved cell for the pending 700301 and the 700301–700399 sub-range. R-M04-04 records that only `public` is stored, R-M04-05 covers reason `outdated` / source `teacher_databank` / `success`, and R-M04-06 covers the 7 paper types. |
| AUD-M10-04 | **Closed** (one Minor wording point, R2-02) | New SRS §6.2.1: N = 750 = T4 **13** + T5 **645** + other 92, which matches M08 S1/S3/S10/S11. The 13 T4 rows are exactly M08's (4, 5, 6, 8, 9, 10, 25, 90, 115, 419, 516, sc-419, sc-806). Enrolment T4 149 and T5 3,911 match M08, and the M11 observed classes 4 and 228 are anchors. The **4,533 vs 4,529** and **551 vs ≤ 550** conflicts are reported (OQ-M10-19), not tuned. Runtime class ids start at 9,000,001. The "DEMO-4S" join-code conflict is sent to M08. |
| AUD-M10-05 | **Closed** | DV-M10-02 now only toggles the section. `mission_source` stays `bank_soalan` (DATA-M10-04, FR-56, BR-17). The question pool is INFERRED and provisional. **E2E-39 and AC-23.3 are provisional.** The non-provisional S12 checks moved to the new E2E-81. |
| AUD-M10-06 | **Closed** | DV-M10-28 (URS), FR-129, AC-48.2 and E2E-09 now all name the same screens: S1, S2, S7 and S21, text only inside `main`. The measured sizes are listed and the blanket sentence is withdrawn. |
| AUD-M10-07 | **Closed** | New DV-M10-29 and D-26 (discovery §2.20/§7.2 corrected). FN-6.4.7, FR-90, E2E-56 (cancel path, not provisional) and E2E-82 (delete, provisional) are updated. The confirm copy is SOURCE-DERIVED and **matches live**: `confirm('Padam soalan ini?')`, still nested (re-fetched 2026-09-25). |
| AUD-M10-08 | **Closed** | DV-M10-17 now states the live clipping: 4 columns at every width, the only media query `max-width:1400px`, links at x = 380–791 px clipped, LIVE badge clipped rather than hidden. The fix is grid 4/2/1, a nav row below 1024 px and LIVE/clock visible (reasoned minimal). FN-2.2.1, FR-14, SRS §10 and E2E-09 (375 / 768 / 1280) agree. |
| AUD-M10-09 | Closed | AC-18.4/18.5 and E2E-30 are provisional. The count is now 36 provisional E2E. |
| AUD-M10-10 | Closed | The URS §9 G1 list now covers every PROPOSED COPY item (the S8/S9/S15 confirms as PROPOSED behaviour, BR-12/14/15 texts) and notes that the S20 confirm is SOURCE-DERIVED. |
| AUD-M10-11 | Closed | DV-M10-08, FR-94 and BR-24 now use the M04 import template (AC-M04-13.6); no second schema. |
| AUD-M10-12 | Closed | FN-6.1.4 and FR-76 have the title "Tukar Status"; the draft icon `fa-toggle-off` is marked INFERRED. |
| AUD-M10-13 | Closed | DATA-M10-03 and §6.11 say "public id 3 OBSERVED; that it is a TeacherProfile id INFERRED". |
| AUD-M10-14 | Closed | The 4454 "Soalan Oleh:" author is fictitious in the seed. The S26 placeholder was purged by the Delivery Lead ("Contoh: Cikgu Nur Demo") and is treated as settled. `grep` for the purged names finds no hits in M10 docs, the M10 inventory or this report. |
| AUD-M10-15 | Closed | DV-M10-15 and FR-109 mark the "-- Pilih --" server rule INFERRED. |

### Regression checks

- **Coverage.** The URS §6 has 3,150 EL rows and the inventory `inventory/M10/S*.json` also totals 3,150. There are 0 unmapped rows, and the 99 exclusions are unchanged.
- **Traceability** (`m10-audit/trace.js`). 212 FN, every one cited by an FR. 162 ACs, all in E2E. 129 FRs, all in E2E. 82 E2E, **36 provisional**. Every provisional AC is in a provisional E2E. No orphans.
- **Spot-check of 12 edited passages.** DV-M10-02, 08, 15, 17, 28, 29; FR-14, 56, 76, 90, 94, 129; BR-17, BR-24; E2E-09, 30, 39, 56, 81, 82; FN-2.2.1, 6.1.4, 6.4.7; URS §9 list; discovery D-26. All are consistent with each other and with the live evidence.
- **Stale references.** No remaining 2003, 3009–3012 or "13 pelajar" in M10 outside the withdrawal notes.

### New findings (round 2)

| ID | Severity | Doc / section | Issue | Required fix |
|---|---|---|---|---|
| R2-01 | Minor | SRS §0 | Two editing leftovers in document control. The v1.0 change-log row contains unrendered template placeholders `{{FRCOUNT}}`, `{{E2ECOUNT}}` and `{{E2EPROV}}`. The "Source URS" field still says v1.0 although the URS is v1.1. | Replace the placeholders with 129 / 80 / 34 and set Source URS to v1.1. |
| R2-02 | Minor | SRS §6.2.1 A | The id-range row says "750 ids chosen deterministically in 1–1,156", while the designed anchors 2001 and 2002 lie outside that range and "each take a `tingkatan-5` slot (645 unchanged)". Read literally, the total becomes 752. | State that 748 ids are generated in 1–1,156 and the 2 designed anchors fill the other 2 T5 slots (N = 750). |
| R2-03 | Info | M11 SRS §6 / XR-M11-06, E2E-M11-06 (not M10) | M11 still uses classes 2001–2003 with 2002 = Bahasa Melayu and students 3001–3012. M10 §13 item 8 already routes this. | M11 to align at its next revision or the XL gate. |

**Round 2 verdict: PASS.** There are no open Critical or Major findings. The two Minor items can be fixed by the writer without another audit round. R-M02-01 and R-M04-01…06 are cross-module requests for the XL gate.
