# M06 — SPM — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 2 (`playwright2`). This agent did not write the URS or SRS. |
| Documents audited | `docs/requirements/urs/M06-spm.md` v1.0 · `docs/requirements/srs/M06-spm.md` v1.0 |
| Evidence | Live https://prestasiplus.my (admin session on lane 2, read-only); `docs/discovery/M06-spm.md` (incl. Appendices A–B); `docs/discovery/inventory/M06/*` and `_raw/M06/*`; page markup, inline scripts and CSS read in place; cross-checks against the M01, M03 and M04 SRS, `docs/discovery/M05-practice.md`, `docs/discovery/M04-question-bank.md` and `docs/discovery/inventory/M03/_curriculum-data.json`; masked audit screenshots in `docs/qa/audit/img/M06/` |
| Safety | Read-only throughout. No quiz, Tracking A set, structured answer page, mock exam or walkthrough was started. None of these was opened: `/quiz`, `/jawab`, `/spm-mock/{id}` (in progress) or `/spm/ramalan/{CODE}?year=&set=`. "Jana Mock SPM", "Bagi Walkthrough", "Mula", "Sambung →" and every submit were never pressed. All other pages were read by same-origin GET with ≥350 ms between requests. S6 was read for 12 more subject codes (set lists only, no start links followed). Duta cards were masked in the DOM before each screenshot. The two audit screenshots contain no names. No credentials or personal data are recorded here. The shared tools were not modified; the re-run batch was written to `.playwright-mcp/lane2/` only. |

## Verdict: **FAIL**

There are **0 Critical, 7 Major and 9 Minor** findings.

The completeness proof is sound:
- The inventory re-runs identically.
- URS §6 accounts for all 1,315 elements.
- The 30 exclusions are the M16 banner.
- Traceability closes.

The failures are in deviations and specified behaviour:
- **Two "fixes" change working live behaviour.**
  - DV-M06-02 is not a defect: the site uses a 1–5 difficulty scale, and the S4 buttons map onto it correctly.
  - DV-M06-07 moves the admin's S11–S13 out of the role-based admin shell, against the M01 DV-13 precedent.
- **DV-M06-01 and DV-M06-04 rest on count definitions that are wrong or incomplete.**
  - The "1,797 = Σ ready questions of all 2026 sets" rule is false on live (1,769).
  - The seed invents hidden set sizes to force 1,797, but those sets are visible on live.
  - The S3 counts are exactly the databank counts, and the DV does not record this.
- **S13 is mis-specified.** Its Subjek select is natively `required`, but the docs say no field is required.
- **An inbound M04 URL is not supported.** The Q2 route has a `question_id` + `count=1` variant (M04 BR-M04-17) that the M06 validation would reject.
- **The mock exam page (Q4) invents UX.** A count-up timer, no auto-submit, 30 radio items and a "Hantar" button are written as specified behaviour, although none of this was observed.

Every fix is a document edit. After that, a targeted re-audit of the affected items is enough.

## Summary counts

| Measure | Result |
|---|---|
| Content elements in URS §6 (script) | **1,315 / 1,315** inventory IDs (S1–S13): 0 missing, 0 extra, 0 duplicates. 1,285 are mapped to a Function and 30 are excluded. |
| The 30 exclusions | All are EL-M06-S1…S10-001–003 "LIVE:" / "MAIN" / "DAFTAR", which is the hidden `tournamentBanner()` widget, so **M16 is correct**. (The *shell* rows SHU/SHA-001–003 carry a wrong exclusion reason: AUD-M06-12.) |
| Matrix ↔ §3 FN | Every matrix FN exists in §3 (85 distinct FNs cited, 0 unknown). There are 117 FNs in total, and 24 of them are behaviour-only. |
| Mapping semantics, spot-checked by hand | 30 rows (every 43rd matrix row, S1–S12), **30 correct** (list below) |
| Live re-inventory (`inventory.js` + `run-state.js` + `sanitize.js` with the `tools/jobs/M06.js` job definitions) | 13 states: S1@1280, S2@375, S4 level-t4, S4 free-count, S5@1280, S6 mixed-psi, S7@375, S8 tab-core, S9 kbat-6, S10 past-year, S11@375, S12@1280, S13@1280. **Totals are identical** to the saved raw captures in all 13, and the content keys are identical. The only differences are the admin server-status widget values (S11–S13) and the random Duta card on S12, which is expected (DV-M06-16). The PII check found 0 leaks, and no state has horizontal overflow. |
| Traceability (script) | 117 FN, each cited by ≥1 FR. 95 AC, each with ≥1 FR and ≥1 E2E. 86 FR, each with ≥1 E2E. 40 E2E on 375/768/1280. 0 dangling references. |
| Claims verified against live | **58**: 47 correct, 11 incorrect (list below) |
| Deviations DV-M06-01…16 | 01: evidence incomplete, fix over-scoped (AUD-03). **02: not a defect** (AUD-01). 03: valid, but S4 is missing from its scope (AUD-11). 04: replicated rationale is false (AUD-02). 05: valid (27 items, weak topics 25, "0 / 30"). 06: valid, but the live evidence is wrong (AUD-08). **07: over-reach** (AUD-04). 08: valid for S4, S11 and S13, reproduced. 09: valid (computed background transparent, text white). 10: valid (the "Semua Subjek" bahasa list interleaves BI and BM). 11: = M01 DV-02. 12–16 (replicated): acceptable. |
| Cross-module | **M03:** codes, ids 1–31, `isCore` (Teras = 1–7; S8 Teras = the 5 subjective ones) and levels 10/11 all agree, and "Subjek SPM 25" = the M03 subjects linked to level 10 or 11 (verified: 25). The id *type* differs (AUD-13). **M04:** the difficulty scale contradicts DV-02 (AUD-01), and the inbound "Buka Soalan Sama" URL is not supported (AUD-06). The report modal source `spm` / `openReport(currentQuestion.id)` matches M04 discovery §2.14. **M05:** there is no SRS yet. The count-up MM:SS timer cited for Q4 is the M05 *revision quiz* timer, not a mock timer (AUD-07). **M01:** the seed accounts exist, and "Mula Latihan" → `/practice` = M01 DV-02. |
| Findings | **Critical 0 · Major 7 · Minor 9** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M06-01 | **Major** | URS §7 DV-M06-02, FN-M06-3.2.5, 3.2.7, AC-M06-08.3/08.4/08.5, AC-09.3, AC-10.1; SRS FR-M06-27/28/31, BR-M06-07, §2 (`difficulty` 1–4), E2E-11/12/13/14 | **DV-02 "fixes" working behaviour.** The whole platform uses a **1–5 difficulty scale**: 1 Sangat Mudah, 2 Mudah, 3 Sederhana, 4 Sukar, 5 Sangat Sukar (M04 FR-M04-18, BR-M04-10). **No question anywhere has difficulty 5** (M05 discovery §8 Q4: "Sangat Sukar" has 0 in every subject). On live, the S4 buttons "Asas" = 2, "Pertengahan" = 3, "Sukar" = 4 and "Sangat Sukar" = 5 line up with that scale: "Sukar" is key 4 and "Sangat Sukar" is key 5, as in M04, and "Sangat Sukar 0 soalan" is true. The only side effect is that key 1 (Sangat Mudah) cannot be chosen alone, which is a deliberate and consistent limit (D10). The DV instead maps "Sukar" to key 3, which M04 calls "Sederhana". An M04 question stored with difficulty 4 "Sukar" would then appear under "Pertengahan", which **creates** a cross-module contradiction. The `difficultyStats` keys 1–4 only mean that the data has no key 5. | `/spm/latih-tubi/MATH` `@click` handlers: `selectedDifficulty === 2 … === 5`. M04 SRS FR-M04-18 labels 1–5. M05 discovery line 344: difficulty 5 = 0 in all subjects. | Withdraw DV-02 ("Rejected — replicate live"). Buttons send and read keys 2–5 and show `difficultyStats[2..5]` (MATH 790 / 886 / 130 / 0). Restore the live values in AC-08.3/08.4/08.5 and AC-09.3 (`difficulty=4` for Sukar), FR-27/28/31, BR-07, SRS §2 and E2E-11…14. Note the D10 limit (key 1 is only reachable with "no difficulty"). |
| AUD-M06-02 | **Major** | URS §7 DV-M06-04; SRS BR-M06-01 ("Soalan Tracking A = Σ readyCount of all 2026 sets"), §6.10 Tracking A seed table, DV-04 rationale | **The replicated rationale is false, and the seed fabricates live data.** The hidden sets are fully visible on the S6 pages, which discovery did not read. Live values: **EKON** Set 7 = 19 and Set 8 = 18 (seed 29 and 29; EKON total 145, seed 166). **SCI** Sets 32–34 = 2, 1, 1 (seed 5, 2, 2; total 35). **CHEM** Set 9 = 2 (seed 4; total 22). With the real values, **Σ readyCount of all 2026 sets = 1,769, not 1,797**. Using GEO's bank size 67 gives 1,796, which still does not match. The seed values were chosen to force the sum. E2E would therefore render S6 EKON/SCI/CHEM with numbers that differ from live. | `/spm/ramalan/EKON`: "145 soalan kuiz siap guna", Set 7 "19 …", Set 8 "18 …". `/spm/ramalan/SCI`: "35 …", Sets 32/33/34 = 2/1/1. `/spm/ramalan/CHEM`: "22 …", Set 9 = 2. SEJ 31, PHY 8, BIO 3, and PI/PM/ADDMATH/PERNIAGA/TI/PSV empty all agree with the seed. | Seed the live set values (EKON, SCI, CHEM, and the S6 pages of every subject). Replace the "1,797" definition: either keep "1,797" as a fixture constant with an UNVERIFIED definition, or re-decide it under DV-01. Do not claim it is "consistent under its own definition". Correct the DV-04 row and BR-01, and add the S6 values of every subject to the seed. The 747 lane rule (67 + 640 + 40) *is* verified and can stay. |
| AUD-M06-03 | **Major** | URS §7 DV-M06-01, FN-M06-1.1.9, 3.1.3, AC-M06-01.2/01.3/02.1/07.2; SRS BR-M06-01/02, §6.10 hub values; URS OQ-M06-08 | **The DV evidence misses the key fact, and the fix changes more live numbers than D9 requires.** On live, **every S3 card count equals the S2 databank count** for all 18 subjects (BM 514 … TI 530), and BA shows 0 because it is not in the databank. The hub chips "Databank" and "Latih Tubi" are also equal (14,673). So S3 is not "a different, smaller query": it is the *databank pool*, used consistently on S2, S3 and the S3 lock. The real contradictions are narrower: (a) S3 "{n} soalan" vs S4 "{n} soalan tersedia"; (b) BA "Locked: 0/40" vs a startable S4; (c) the hub 14,673 / 20,529 vs the list sums (21,033). The DV rewrites all 19 S3 numbers, removes the BA lock, and invents definitions for three hub values ("Jumlah Soalan" 38,483, "Latih Tubi" 38,483, "Databank" 21,033). It records none of these as a Delivery Lead choice among alternatives. | `/spm/latih-tubi` vs `/spm/tahun-lepas`: 18/18 identical counts, re-read on 2026-09-25. The hub still reads 20,529 / 14,673 / 14,673. | Record the S3 = S2 identity in the DV evidence and in discovery D-1. Re-decide the minimal fix and write down the choice, for example: keep the S3 counts = databank count (live) and change only the S4 label or the lock; or keep DV-01 as written. Mark the new hub definitions and values as **PROPOSED** (a Delivery Lead / user decision, OQ-M06-08), not as live-derived. Update the AC values to match. |
| AUD-M06-04 | **Major** | URS §1 route table (S11–S13 "user portal (DV-M06-07; live admin panel)"), §7 DV-M06-07, FN-M06-1.2.4, AC-03.3; SRS §2 (Shell column), FR-M06-10, E2E-04 | **DV-07 goes beyond D9.** S11–S13 render the admin shell *for the admin* because the shell is chosen by role. The same happens on `/tetapan` (00-global-ui G-D3). M01 already decided this case: **FN-M01-2.3.8 / DV-M01-13 keep the admin shell for admin and fix only the header title**, and treat the user shell for other roles as INFERRED (M01 OQ-6). The only broken part is the "Dashboard" / "Selamat datang, Admin" title. Moving the admin into the user portal is a new layout decision, and it makes M06 inconsistent with M01. (S4, S6, S7 and S9 show "Dashboard" in the user shell. That title fix is valid.) | `/spm-mock`: header "Dashboard" / "Selamat datang, Admin" in the admin shell. `/spm/ramalan/GEO`, `/latihan-berstruktur?…scope=spm…`: header "Dashboard". M01 URS FN-M01-2.3.8, AC-M01-19.4. | Narrow DV-07 to the titles. S11–S13 use the admin shell for admin (header = the page title, subtitle as M01 DV-13) and the user shell for other roles (INFERRED, like M01 OQ-6). S4/S6/S7/S9 get the new header titles. Update the §1 table, SRS §2, FR-10, AC-03.3 and E2E-04. |
| AUD-M06-05 | **Major** | URS FN-M06-7.1.2 ("no field required"), 7.1.4/7.1.5, AC-22.1/22.3, §7 "Explicitly not deviations" ("no field `required` on the walkthrough form"), OQ-M06-07; SRS §5 ("S13 all fields: none required"), FR-M06-80/82/83, BR-M06-28, §8.2 S13 error copy; discovery §2.13 | **The S13 form is mis-specified.** (a) `select[name=subject]` carries **`required`**, and the form has no `novalidate`. Because the handler is on `submit`, the browser's native bubble blocks an empty subject **before** the script runs, so no busy state, request or alert happens. (b) `year` has **`maxlength="8"`**, which is not documented. (c) At the start of every submit the script sets `result.style.display='none'`, which hides any previous walkthrough (not documented). (d) The result card title is an **h2** (the docs say h3), and the body is **`<pre id="walkBody">`** (whitespace and newlines preserved), set as `d.walkthrough \|\| ''`. The inventory already held `"required": true` and `"maxlength": "8"`, but the narrative and both documents dropped them. | `#spmForm` outerHTML: `<select name="subject" required="">`, `<input name="year" type="text" placeholder="Cth: 2023" maxlength="8">`. Script: `e.preventDefault(); btn.disabled = true; … result.style.display = 'none';` `#result`: `<h2>✨ Walkthrough Cikgu Alesa</h2> <pre id="walkBody">`. `S13-walkthrough.json` element `subject` `"required": true`. | Specify the native required bubble on Subjek (no request), `maxlength=8`, the hide-on-submit, h2 + `pre`. Remove "no field required" from FN-7.1.2, SRS §5 and the "not deviations" list. Change the BR-28 empty-request error so that it requires a subject. Add an E2E step (empty subject → `checkValidity()` false, no request, no dialog). Tell the discovery owner that §2.13 needs a correction. |
| AUD-M06-06 | **Major** | URS FN-M06-3.3.1, AC-10.x; SRS §2 route Q2, FR-M06-31/32, BR-M06-07 ("`count` must equal the target when a target exists … else 422"), §5 Q2, §7 #8 | **Missing route variant and cross-module conflict.** M04 "Buka Soalan Sama" (M04 BR-M04-17, E2E-M04-40, OBSERVED) opens **`/spm/latih-tubi/{CODE}/quiz?question_id={id}&count=1`**, for example `MATH?question_id=136891&count=1`. MATH has target 40, so BR-M06-07 returns 422 for this link and the M04 admin action breaks in the rebuild. M06 does not mention `question_id` anywhere. | M04 discovery §2.13 line 439, M04 SRS BR-M04-17. `grep question_id` in the M06 URS/SRS: 0 hits. | Add the `question_id` parameter to Q2: a single-question `latih_tubi` session for that question, `count=1` allowed. Add it to FR-32 and BR-07/13 (exempt it from the target-count rule), SRS §5, §7 #8 (`questionId?`), an AC and an E2E. Mark the page behaviour INFERRED (L-3). |
| AUD-M06-07 | **Major** | URS FN-M06-6.2.3/6.2.4, AC-20.1/20.2/20.4; SRS FR-M06-72/73, BR-M06-22/23, §10 Q4, E2E-31/32 | **Invented UX is presented as specified behaviour.** The following are specified as fact: a "running count-up timer 'MM:SS' like the M05 quiz timer", "no automatic submit", 30 radio items A–D, a textarea per Paper 2 item, "6 × 10-mark" Paper 2 items and a "Hantar" button. None of it was observed. The evidence does not support the timer direction or the absence of an auto-submit. "Mock SPM penuh dengan timer" and "timer akan jalan dan tak boleh stop" fit a **countdown** just as well. The 2-month-old unsubmitted mock 317 proves only that nothing *server-side* closes the mock; a client countdown that submits at 0 would leave the same record if the tab was closed. The cited "M05 quiz timer" is the M05 *revision quiz* count-up (M05 discovery §2.7), not an exam timer. The FN-6.2.4 row marks this "INFERRED from warning copy and S11 data", but AC-20.2 and E2E-31 test it as fixed behaviour. | `/spm-mock` copy (hero, warning); `.sm-card` for 317 "Belum submit" / "Sambung →"; the Q4 page not opened (prohibited). | Mark the whole Q4 page (layout, timer direction, auto-submit, item counts, button copy) **UNVERIFIED / pending L-8**, and list each point in OQ-M06-05. Keep one neutral placeholder and label E2E-31/32 as provisional. Do not assert "no auto-submit" or "count-up". The Delivery Lead should put L-8 first when the user approves live sessions. |
| AUD-M06-08 | Minor | URS §7 DV-M06-06 (Live column); SRS BR-M06-25 | The DV's live evidence is wrong. The selectors `.grade-A, .grade-A\\+` and `.grade-B, .grade-B\\+` are **invalid as a whole**, so the browser drops the full rules. **A and B chips are also unstyled on live** (transparent background, `rgb(51,65,85)` text), not only A+ and B+. The DV fix (A/A+ emerald, B/B+ blue) is still right. | `document.styleSheets` `.grade*` rules present: only `.grade-C`, `.grade-D, .grade-E, .grade-G`, `.grade-pending`. Computed style of a test `.grade.grade-A` is transparent. | Correct the Live column: "A, A+, B, B+ unstyled (whole rules invalid)". Mark it OBSERVED (computed styles), not INFERRED. |
| AUD-M06-09 | Minor | SRS FR-M06-63 ("Latih Tubi and Tracking A solid in their hover colours — INFERRED"), BR-M06-21 / §7 #11 ("other → all"); URS FN-M06-8.1.3 | This is a mislabel plus a missing state. The active classes can be observed: `?type=latih_tubi` → "Latih Tubi" `bg-blue-500 text-white shadow-md`; `?type=ramalan` → "Tracking A" `bg-purple-500 text-white shadow-md`; "Semua" `bg-indigo-500`; inactive `hover:border-{indigo\|amber\|blue\|purple}-400`. With an unknown type (`?type=zzz`), all rows are listed **with no filter active**, not even "Semua". | S10 filter link classes read for 4 URLs. | Relabel as OBSERVED with the exact classes, and add "unknown `type` → all rows, no active filter" to FR-63/64, BR-21 and an E2E step. |
| AUD-M06-10 | Minor | URS FN-M06-6.3.4, AC-21.4; SRS FR-M06-78 | CSS upper-cases the review item header: `.q-review .num { text-transform: uppercase }` displays as "✗ SOALAN 1 · 0/1 MARKAH". This casing is not stated, although the URS convention requires it. | S12 CSS and `innerText` ("✗ SOALAN 27 · 0/1 MARKAH"). | Add "(upper case by CSS)" to FN-6.3.4, AC-21.4 and FR-78, and give the displayed form. |
| AUD-M06-11 | Minor | URS §7 DV-M06-03, FN-M06-3.2.2 / FR-M06-25 (S4 icon tile) | The DV-03 scope is incomplete. The S4 header icon tile uses the same subject icon, so `/spm/latih-tubi/SCI` renders `fa-beaker` blank (likewise CHEM, EKON, ADDMATH and BA). DV-03 lists only S1/S2/S3/S8. S5 and S6 were checked and have no blank icons. The DV's list of blank icons is otherwise exactly right. | Glyph test on `main i`: S3 {beaker, flask-round, trending-up, variable, languages}; S8 {+ monitor}; S1 {crystal-ball, stars}; S2 {beaker, trending-up, flask-round, variable}; S4 SCI {beaker}. | Add S4 (header tile) to DV-03, FN-3.2.2 and FR-25. |
| AUD-M06-12 | Minor | URS §6.2 SHU-001–003 and SHA-001–003 | These shell rows have the wrong exclusion reason. They are the shell **brand/logo** (`→ /dashboard`, image, "Platform Latih Tubi Nasional"; `→ /admin`, image, "Panel Pentadbir"), not the M16 tournament banner. They are already global shell, so the coverage totals do not change. | The row content quoted in §6.2 itself. | Relabel them "global shell (logo/brand)". |
| AUD-M06-13 | Minor | SRS §6.1 DATA-M06-01 (`subjectId` string "1"…"31") | This conflicts with **M03 v1.2**, which moved subject/level ids to **integers** (M03 §6 intro, change log 1.2), and with the M04 numeric ids. | M03 SRS line 22, line 265. | Type `subjectId` as int. Reference the M03 `GET /api/subjects` (+ `isCore`) instead of re-declaring it. |
| AUD-M06-14 | Minor | SRS §11 SEC-M06-03; FR-M06-52; URS FN-M06-4.3.2 | SEC-03 says as fact that "Belum Cukup sets (`?set=2`)" are reachable by URL, but that URL was never opened. At the same time, FR-52 specifies that such sets are blocked. Only BA Latih Tubi (S4) and the unlinked MATH set *list* were observed as reachable. | Discovery §9 (the set URLs were not opened). | Label the Belum Cukup reachability in SEC-03 INFERRED. Keep FR-52 as INFERRED, pending L-5. |
| AUD-M06-15 | Minor | SRS §5, §6.12, §8.2 (S11 "Sila pilih subjek.", S13 "Gambar tidak sah." / "Sila pilih subjek dan masukkan soalan atau gambar.", Q2 "Tiada soalan untuk tetapan ini. Sila ubah tetapan kuiz.", Q4 "Hantar", Paper 2 marker feedback, canned walkthrough texts) | New BM copy is labelled "UNVERIFIED COPY" but not **PROPOSED COPY** (the M02 DV-12 / M04 AUD-16 precedent). The S13 empty-request message can no longer be reached for a missing subject, because of AUD-05. | — | Mark these strings PROPOSED COPY and list them for the Delivery Lead to report at G1. Adjust the S13 message to the reachable case (subject chosen, no text and no image). |
| AUD-M06-16 | Minor | URS §7 DV-M06-08 (Live column) | The evidence is imprecise. (a) At 375 the S13 placeholder shows "Cth: 20" (not "Cth: 202"), and the "TAHUN (OPSYEN)" label wraps to two lines. (b) The S11 overlap happens because `.sm-card .grade { font-size: 1.5rem }` outranks `.grade-pending { font-size: .85rem }`. "Belum" therefore renders at 1.5rem, overflows its chip and runs into "Sambung →" (the chip and link boxes themselves do not intersect). The rebuild should give the pending chip its intended small size, not only move it. | Screenshots `img/M06/s13-form-375.png`, `img/M06/s11-mock-row-375.png`; S11 CSS. | Correct the Live column and add the pending-chip size to FR-70 / BR-25. |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9/D10? | Note |
|---|---|---|---|
| DV-M06-01 | Partly. S3 ≠ S4 and the BA lock vs a startable S4 are real contradictions, as is hub 14,673 vs Σ S2 21,033. | Yes for the contradictions. **The chosen values are a decision, not a fix.** | AUD-03 |
| DV-M06-02 | **No.** Keys 2–5 = Mudah…Sangat Sukar on the site's 1–5 scale. Difficulty 5 is empty everywhere. | **No** (working, deliberate limit, D10) | AUD-01 |
| DV-M06-03 | Yes. There are 8 blank icon names. | Yes (visual bug) | Add S4 (AUD-11). |
| DV-M06-04 (replicated) | — | Replicating is acceptable, but **the rationale and the seed are wrong** | AUD-02 |
| DV-M06-05 | Yes. "0 / 30 markah", 27 review items, weak topics 9 + 8 + 4 + 2 + 2 = 25. | Yes (contradictory) | Replicating the feedback line is correct. |
| DV-M06-06 | Yes, and wider: A and B are also unstyled. | Yes | AUD-08 |
| DV-M06-07 | Title "Dashboard": yes. Admin shell for admin: **deliberate** (role-based, M01 precedent). | Titles yes; layout move **no** | AUD-04 |
| DV-M06-08 | Yes. S4 "Pertengahan" (scrollWidth 87 > 67 at 375), S11 Paper select 82px and "Belum" overflow, S13 year field 82px ("Cth: 20"). | Yes (responsive) | AUD-16 |
| DV-M06-09 | Yes. The active "Semua" computed background is `rgba(0,0,0,0)` with white text. | Yes (unreadable) | — |
| DV-M06-10 | Yes. The "Semua Subjek" bahasa page 1 reads BI ×4, BM ×11, BI ×5, which contradicts "BM dahulu, BI kemudian". | Yes (contradictory) | — |
| DV-M06-11 | Yes (`/latih-tubi` 404). | = M01 DV-02 | — |
| DV-M06-12…16 (replicated) | — | Correctly replicated (working copy/behaviour) | — |

### L-states (discovery §9) — labels checked

| L | Label in the SRS §8.3 | Audit |
|---|---|---|
| L-1, L-3 | SOURCE-DERIVED (report modal on `/spm/latih-tubi/{code}/quiz`, `openReport(currentQuestion.id)`, `source:'spm'`) | Confirmed in M04 discovery §2.14. The `question_id` variant is missing (AUD-06). |
| L-2, L-4 | OBSERVED record + M05 contract | OK (coins = correct holds on all 4 rows). |
| L-5 | SOURCE-DERIVED copy + INFERRED | OK. The block on locked sets is INFERRED (AUD-14). |
| L-8 | INFERRED | **Invented UX** (AUD-07) |
| L-9 | SOURCE-DERIVED classes | Confirmed: `.mr-hero` default green, `.bad` red, `.mid` yellow; `.q-review.correct` green / `.wrong` red. The grade bands are INFERRED (acceptable). |
| L-11 | SOURCE-DERIVED | The script matches, but the `required` subject, hide-on-submit and `pre` are missing (AUD-05). |
| L-12, L-13 | INFERRED | Acceptable. The history filter colours can be observed (AUD-09). |

### Seed check

- **Accounts.** `admin@`, `pelajar@`, `pelajar2@` and `guru@demo.test` exist in M01, and `pelajarmaju@` exists in M03. No new account is added.
  - `pelajar2` is a Darjah 5 student. Using this account as the "no SPM activity" student is harmless, because M06 has no level gate.
- **Mocks 16 and 317.**
  - Their ids, subjects, papers and relative times at `setNow 2026-09-25` match live: "4 bulan yang lepas" and "2 bulan yang lepas".
  - The first three keys (A, B, A) and question texts match live. No personal data is included.
  - The 30 items and the weak-topic counts 11/10/5/2/2 follow DV-05, which is legitimate.
- **History stats.** The admin figures 4 / 21.8% / 26 / 84 match live. The student figures 3 / 68.3% / 47 / 85 are arithmetically correct.
- **Tracking A sets are wrong for EKON, SCI and CHEM** (AUD-02).

## Coverage spot-check (30 rows, all correct)

S1-010 "Subjek SPM"→1.1.2 · S2-013 "10" link→2.1.3 · S2-056 "Pilih set:"→2.1.3 · S2-099 "Additional Mathematics"→2.1.2 · S2-142 "Perniagaan" card→2.1.2 · S3-020 "Matematik"→3.1.3 · S3-063 AKAUN link→3.1.3 · S4-023 "Mula Kuiz"→3.2.7 · S4-066 404 "Mula Latihan"→1.3.2 · S5-045 "Bank Besar"→4.1.6 · S5-088 "SEJ · Target set: 40 soalan"→4.1.5 · S5-131 "Readiness"→4.1.6 · S5-174 "Locked"→4.1.6 · S5-217 "Bank Besar"→4.1.6 · S5-260 "1 bank besar"→4.1.10 · S6-037 "11 set belum cukup"→4.2.2 · S6-080 AKAUN Set 10 link→4.2.4 · S6-123 404 "PRESTASIPLUS"→1.3.2 · S7-046 "Bahasa Melayu" card→4.4.4 · S7-089 BI stem→4.4.4 · S8-016 caption→5.1.3 · S8-059 Fizik link→5.1.5 · S8-102 "Teras" badge (tab grid)→5.1.6 · S8-145 "Sains Komputer" (tab grid)→5.1.6 · S9-041 "Tingkatan 4"→5.2.3 · S9-084 "1 bahagian · 7 markah"→5.2.3 · S10-005 h1→8.1.1 · S10-048 empty text→8.1.5 · S12-011 "📍 Johor"→1.4.1 · S12-054 "📚 Belajar Topik Lemah"→6.3.5.

## Claims verified against live (58)

✓ = correct, ✗ = incorrect (with finding).

1. ✓ S1: tab "Mod SPM - PRESTASIPLUS", header "Mod SPM" / "Selamat datang kembali".
2. ✓ S1: pill "MOD SPM", h1 "Persediaan SPM", exact lead copy.
3. ✓ S1: live stats 20,529 / 25 / 0 / 1,797. Chips 14,673 / 14,673 / 1,797 / 4,059 set subjektif (the URS quotes these as live in DV-01).
4. ✓ S1: "Prestasi SPM Anda" 4 / 21.8% / 26 "Syiling Diperoleh" / 84.
5. ✓ "Subjek SPM 25" = M03 subjects linked to level 10 or 11 (25).
6. ✓ S1: blank `fa-crystal-ball`, `fa-stars`.
7. ✓ S2: 18 cards in the documented order with the documented counts.
8. ✗ S3: counts "from a different query". They equal the S2 counts 18/18 (AUD-03).
9. ✓ S3: target chips per subject (Custom 34/36, SPM 40 ×7, Latihan 40 ×5, Latihan 20 ADDMATH, none for 4).
10. ✓ S3: BA "0 soalan" "Target Latihan: 40" "Locked: 0/40".
11. ✓ S3/S2/S8: blank icon lists as in DV-03.
12. ✗ DV-03 scope: the S4 tile is also blank (AUD-11).
13. ✓ S4 MATH: tab "Latih Tubi SPM — Matematik", header "Dashboard" / "Selamat datang kembali".
14. ✗ S4 difficulty is off by one. It is the 1–5 scale (AUD-01).
15. ✓ S4: `grid grid-cols-4 gap-2` at 375, "Pertengahan" overflows.
16. ✓ S4: "Mula Kuiz" `:href="quizUrl()"`, default `…/MATH/quiz?count=40`.
17. ✓ S4 PERNIAGA: countOptions 5, 10, 20, 30, 40, 50, 60 (is_target false).
18. ✓ S4 re-inventory: level-t4 start href `…count=40&level=10`, PERNIAGA `…count=10`.
19. ✓ S5: lanes "3 subjek" "18 set" "747 soalan" / "2 subjek" "1,332 set" "Paper-based tracking".
20. ✓ S5: lane 747 = 67 + 640 + 40 (BR-M06-10).
21. ✓ S5: "Admin Readiness" (upper case), chips 1 / 1 / 58, text copy exact.
22. ✓ S5: 15 readiness tiles in the documented order (not 16).
23. ✓ S5: MATH lock chips 43–48, BM "2026 Set 1 · 9/34".
24. ✗ BR-M06-01 "1,797 = Σ ready of all 2026 sets". Live gives 1,769 (AUD-02).
25. ✗ Seed EKON Sets 7–8 (29, 29). Live gives 19, 18 (AUD-02).
26. ✗ Seed SCI Sets 32–34 (5, 2, 2). Live gives 2, 1, 1 (AUD-02).
27. ✗ Seed CHEM Set 9 (4). Live gives 2 (AUD-02).
28. ✓ S6 SEJ/PHY/BIO values match the seed.
29. ✓ S6 PI/PM/ADDMATH: empty state with the target chip. PERNIAGA/TI/PSV: empty state without a target line.
30. ✓ S6 GEO: header "Dashboard" (DV-07 title fix applies).
31. ✓ S6 "Belum cukup soalan untuk format KPM.", "Format set: n / 40", DSKP 100%.
32. ✓ S7: back link "Kembali ke Tracking A SPM" → `/spm/ramalan`, header "Dashboard".
33. ✓ S7 "Semua Subjek": "1,332 set ditemui", pager "… 66 67", BI/BM interleaved (DV-10).
34. ✓ S7: filter options and the selected state reflect the query (BM, KBAT 2).
35. ✓ S7: the pager keeps `subject_id`, `scope`, `track`, `kbat_level` (`…&kbat_level=2&page=2`).
36. ✓ S8: the info box, 4 stats and captions are exact.
37. ✓ S8: the "Semua" active class is applied but the computed background is transparent and the text white (DV-09).
38. ✓ S8: tab bindings teal-600 / amber-500.
39. ✓ S9 MATH: "Showing 1 to 20 of 298 results … 14 15", back link "Kembali ke Subjektif SPM".
40. ✓ S9: Subjek option order Semua, BM, BI, MATH, SCI, SEJ, BIO, EKON, PHY, GEO, CHEM, ADDMATH, PERNIAGA, AKAUN, SK, TI.
41. ✓ S10: stats 4 / 21.8% / 26 "Jumlah Syiling" / 84, unchanged by the filter.
42. ✓ S10: the 4 rows with exact text, newest first.
43. ✓ S10 `?type=latih_tubi`: 2 rows. `?type=ramalan`: empty-state copy + "Mula Kuiz SPM".
44. ✗ S10 active colours for Latih Tubi / Tracking A are "INFERRED", but they can be observed (AUD-09).
45. ✗ S10 unknown type: the "no active filter" state is not documented (AUD-09).
46. ✓ S11: form `POST /spm-mock/jana`, both selects `required`, 10 subjects with value = label, Paper 1 default.
47. ✓ S11: rows 317 "Belum submit" / "Belum" / "Sambung →" `/spm-mock/317`, and 16 "Score: 0/30 (0.00%)" / "G" / "Lihat →".
48. ✓ S11 at 375: Paper select 82px wide. "Belum" overflows into "Sambung" (DV-08).
49. ✗ DV-06 "only A+ / B+ unstyled". A and B are also unstyled (AUD-08).
50. ✓ S11/S13 header "Dashboard" / "Selamat datang, Admin" (admin shell).
51. ✓ S12: hero `mr-hero bad`, "G", "0.00%", "0 / 30 markah", tab "Result Mock SPM — Bahasa Melayu".
52. ✓ S12: 27 review items, all `.wrong`. Weak topics 9 / 8 / 4 / 2 / 2. Item 1 copy exact.
53. ✗ S12: the item header displays upper case, which is not stated (AUD-10).
54. ✓ S12: hero CSS green default, `.bad` red, `.mid` yellow.
55. ✓ S13: 16 subject options (incl. "Perdagangan", "Prinsip Akaun"), placeholders, upper-case labels, `accept="image/*"`, busy copy, `alert(d.error || 'Ralat')` / `'Ralat: ' + message`.
56. ✗ S13 "no field required". Subjek is `required`, year has `maxlength=8`, the result is hidden on submit, and the card uses h2 + `pre` (AUD-05).
57. ✓ S13 at 375: grid `2fr 1fr` with no breakpoint, year 82px, placeholder clipped (DV-08).
58. ✓ Unknown codes and ids give 404 (discovery states re-checked in the inventory: S4 / S6 / S12 not-found).

## Screenshots

- `docs/qa/audit/img/M06/s13-form-375.png`: S13 form at 375, Tahun field clipped ("Cth: 20").
- `docs/qa/audit/img/M06/s11-mock-row-375.png`: S11 in-progress row at 375, "Belum" at 1.5rem overflowing into "Sambung →".

---

## Round 2 — targeted re-audit of v1.1 (2026-09-25)

| Field | Value |
|---|---|
| Documents | URS `urs/M06-spm.md` v1.1 · SRS `srs/M06-spm.md` v1.1 (both carry a v1.1 revision-history row) · discovery `M06-spm.md` (the lines marked "(corrected after audit)") |
| Auditor / lane | The same independent auditor, now on **browser lane 3** (`playwright3`, own session). Read-only: 3 GETs (`/spm`, `/spm/latih-tubi/BA`, `/spm/latih-tubi/PERNIAGA`), no action triggered, no quiz, session or exam URL opened. Round-1 live evidence was reused where live had not changed. |
| Delivery Lead decisions taken as settled | DV-02 withdrawn; real S6 set values in the seed, with "Soalan Tracking A" computed (1,769, PROPOSED); DV-01 minimal (S4 uses the S2/S3 pool, hub Databank/Latih Tubi chips = Σ S2 = 21,033, PROPOSED); DV-07 changes titles only; Q4 neutral/UNVERIFIED; the M04 `question_id&count=1` link is supported. |

### Verdict: **FAIL**

There are **0 Critical, 1 Major and 2 Minor** findings still open.

All 16 round-1 findings are fixed. There is one new Major: the hub now contradicts itself on screen (AUD-M06-17). There are also two new Minor findings from the DV-01 edit: a stale AC value (AUD-M06-18) and missing PROPOSED labels on the S4 split values (AUD-M06-19).

### Regression checks (script)

| Check | Result |
|---|---|
| Coverage URS §6 vs inventory | **1,315 / 1,315.** 0 missing, 0 extra, 0 duplicates. 1,285 mapped and 30 excluded; all 30 are the S1–S10 "LIVE:"/"MAIN"/"DAFTAR" M16 banner. |
| Matrix FN references | 118 FNs defined; 0 unknown FNs cited |
| Traceability | 118 FN → all cited by an FR. 98 AC → all have ≥1 FR and ≥1 E2E. 88 FR → all have ≥1 E2E. 42 E2E. **0 dangling** FR/AC references. |
| Shell exclusions | SHU-001–003 now read "shell logo/brand (→ /dashboard, logo image, 'Platform Latih Tubi Nasional'): global shell, not the M16 banner". SHA-001–003 read the same way ("→ /admin … 'Panel Pentadbir'"). **Fixed.** |
| Seed split table (SRS §6.10) arithmetic | 19 rows. For every row, T4 + T5 = pool, Σ difficulty = pool, each level split sums to its level, and T4 + T5 per key equals the key total. **0 errors.** Σ pool = 21,033. BI, SEJ, PI, GEO and PHY keep their exact live S4 values (the pool equals their live S4 total). |
| Stale-value sweep (2,581 / 38,483 / 1,797 / 1,200 / 775 / difficulty=3 / count-up / "no auto") | Only live-evidence quotes remain (matrix rows, DV Live columns, OQ-08). There is **one stale spec value: AC-09.2 "2,732"** (AUD-M06-18). |
| Live re-check (lane 3) | The hub still reads 20,529 / 25 / 0 / 1,797 with chips 14,673 / 14,673 / 1,797 / 4,059. `/spm/latih-tubi/BA` "1,200 soalan tersedia", `/spm/latih-tubi/PERNIAGA` "2,732 soalan tersedia" (unchanged since round 1). |

### Round-1 findings: status

| ID | Status | Evidence in v1.1 |
|---|---|---|
| AUD-M06-01 | **Closed** | DV-02 is "Withdrawn — replicated" (URS §7). FN-3.2.5 binds keys 2, 3, 4, 5 to the M04 1–5 scale; key 1 is a D10 limit. FR-27, BR-07 (`difficulty` 2–5), SRS §2 and AC-09.3 (`…&difficulty=4` = Sukar) are updated, and E2E-12/13/14 use `difficulty=4` / `=5`. Discovery D-2 is corrected. |
| AUD-M06-02 | **Closed** | The seed uses the real S6 values (EKON 7–8 = 19/18, SCI 32–34 = 2/1/1, CHEM 9 = 2). The DV-04 Live column lists the per-subject sums (1,769; 1,796 with the GEO bank). BR-01 computes Σ ready = 1,769 (PROPOSED), and the statement "no value is chosen to reach a total" is in the DV. |
| AUD-M06-03 | **Closed** (as decided), **but it creates AUD-M06-17** | The DV-01 evidence now records S2 = S3 (18/18) and lists the alternatives it did not take. S2/S3 and the BA lock stay live. S4 uses the same pool, and the hub chips are 21,033 PROPOSED. OQ-08 lists every changed value for G1. |
| AUD-M06-04 | **Closed** | DV-07 is "Titles only". FN-1.2.4, SRS §2 (Shell column "role-based as live"), FR-10 and E2E-04 are updated: admin shell for admin with header = page title and no subtitle (as M01 DV-13); the user portal for other roles is INFERRED. "The role-based shell on S11–S13" is in the not-deviations list. |
| AUD-M06-05 | **Closed** | FN-7.1.2 now has `required` Subjek, `maxlength="8"` and "no novalidate", with the native bubble firing before the script. FN-7.1.4 hides the previous result. FN-7.1.5 has h2 + `<pre>` and `d.walkthrough \|\| ""`. New AC-22.5, FR-88 and E2E-42 (`checkValidity()` false, no request, no dialog). E2E-35 covers maxlength and E2E-36 covers hide-on-resubmit. BR-28 is limited to the case "subject chosen, no content". Discovery §2.13 is corrected. |
| AUD-M06-06 | **Closed** | New FN-3.3.4, AC-10.4, FR-87 and E2E-41 (`MATH?question_id=136891&count=1`, a foreign Sains id 564159 → back to S4, consistent with the M04 seed and E2E-M04-40). BR-07 and BR-13 exempt the single-question form; SRS §2, §5 and §7 #8 (`questionId`) are updated; L-3 is updated. |
| AUD-M06-07 | **Closed** | FN-6.2.3/6.2.4 are "UNVERIFIED, pending L-8": direction, duration, auto-submit and pause penalty are not specified, and the evidence limit on mock 317 is stated. FR-72/73 are provisional: FR-73 forbids assertions beyond "a timer element is visible and has no pause control". BR-22/23 are UNVERIFIED, AC-20.1/20.2/20.4 are provisional, and E2E-31/32 are marked provisional. "Hantar" and the item counts are PROPOSED, and OQ-05 lists every point as open. |
| AUD-M06-08 | **Closed** | DV-06 Live column: "A, A+, B and B+ are all unstyled (OBSERVED: computed styles)". Discovery D-10 is corrected. |
| AUD-M06-09 | **Closed** | New AC-18.6: `bg-blue-500` for Latih Tubi, `bg-purple-500` for Tracking A, and `?type=zzz` → all rows with no active filter. FR-63/64 and BR-21 are updated (per the SRS revision row). |
| AUD-M06-10 | **Closed** | FN-6.3.4 and AC-21.4 state "upper case by CSS: displays '✗ SOALAN 1 · 0/1 MARKAH'". |
| AUD-M06-11 | **Closed** | DV-03 now covers the S4 header tile (e.g. SCI) and says "S5/S6 have none". The fix scope is S1, S2, S3, S4 and S8. |
| AUD-M06-12 | **Closed** | See the regression checks above. |
| AUD-M06-13 | **Closed** | SRS §6.1: `subjectId` int (1…31, per M03 v1.2); name, `isCore`, icon and colour are read from M03 `GET /api/subjects`. |
| AUD-M06-14 | **Closed** | SEC-M06-03 separates OBSERVED (BA S4, MATH set list) from "To verify (INFERRED, L-5)" for Belum Cukup start URLs. BR-13 marks the refusal as INFERRED. |
| AUD-M06-15 | **Closed** | The URS §0 convention defines PROPOSED COPY / PROPOSED. OQ-M06-09 lists every new string: "Sila pilih subjek.", "Gambar tidak sah.", "Sila masukkan soalan atau muat naik gambar soalan." (now scoped to the reachable case), the Q2 message + "Kembali", "Hantar", the P2 feedback and the canned walkthroughs. SRS §5, §6.12 and §8 are relabelled. |
| AUD-M06-16 | **Closed** | The DV-08 Live column cites both audit screenshots: "Cth: 20", the label wrap, the `.sm-card .grade` 1.5rem override of `.grade-pending` .85rem, and the chip/link boxes that do not intersect. The fix keeps the pending chip at 0.85rem (FN-6.1.6). |

### New findings

| ID | Severity | Doc + section | What's wrong | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M06-17 | **Major** | URS FN-M06-1.1.2/1.1.3/1.1.4, AC-M06-01.2/01.3, AC-02.1, §7 DV-M06-01, OQ-M06-08; SRS BR-M06-01, FR-02/03, §6.10 "Resulting hub values", E2E-01/03 | **The fix creates a contradiction on the hub screen.** In the rebuild S1 shows "**20,529** Jumlah Soalan" (the total number of questions, kept live) next to the module chips "Databank Soalan **21,033** soalan" and "Latih Tubi SPM **21,033** soalan". A *total* that is smaller than one of its own parts, on the same screen, is a new contradiction. On live the hub has no such conflict: 20,529 ≥ 14,673 on both chips, and the mismatch with Σ S2 is only visible across pages. The documents know about it ("note: smaller than Σ S2 21,033", OQ-08) but specify it anyway, and E2E-01 asserts both numbers. Under the settled DV-01 rule, the chips count "questions in the bank" (Σ S2). Nothing on the page defines "Jumlah Soalan" as a different, smaller population. Under D9 the fix must leave no visible contradiction. | Live `/spm` (lane 3): 20,529 / chips 14,673 / 14,673. SRS §6.10: "Jumlah Soalan 20,529 (live) … chips Databank 21,033 and Latih Tubi 21,033 (PROPOSED)". | Make the hub self-consistent. Recommended: **"Jumlah Soalan" = Σ S2 pool = 21,033** (PROPOSED), so all three come from one source. The alternative is to show on the page that the definitions differ, but no such definition exists on live. Update FN-1.1.2, AC-01.2, AC-02.1 (add "Jumlah Soalan ≥ each module chip"), BR-01, FR-02, §6.10, E2E-01/03 and OQ-08, and report the value at G1. |
| AUD-M06-18 | Minor | URS AC-M06-09.2 | A stale live value remains after DV-01: "Given PERNIAGA … '**2,732** soalan tersedia'". Under DV-01 the S4 total is the pool (PERNIAGA 934, SRS §6.10 and AC-02.1). AC-02.1 and AC-09.2 now contradict each other. E2E-12 does not assert the number, so it passes either way. | URS line 402. SRS §6.10 PERNIAGA pool 934. Live 2,732 is the replaced value. | Change the value to "934 soalan tersedia" (PROPOSED, DV-01). |
| AUD-M06-19 | Minor | URS AC-M06-08.3, 08.4, 08.5, AC-10.1; SRS E2E-11, E2E-13 | The S4 split values are not labelled PROPOSED in every place. AC-08.2 labels the Tingkatan split "(seed breakdown of the same pool, PROPOSED)". AC-08.3 (514 / 577 / 85 / 0, "the 505 difficulty-1 questions"), AC-08.4 (309 / 410 / 58 / 0; 205 / 167 / 27 / 0) and AC-08.5 (SCI "1299", "1,172", "904") do not. AC-08.3 even carries "(keys 2–5, as live …)", which reads as if the numbers were live. They are the proportional seed values of SRS §6.10, which is labelled PROPOSED. AC-10.1 / E2E-13 ("27 matching questions") likewise depend on the seed split. | SRS §6.10 heading: "divides each count in the proportions of the live S4 breakdown … PROPOSED values". Live MATH S4 was 1,500 / 1,081 and 790 / 886 / 130 / 0. | Add "(seed split, PROPOSED — DV-M06-01)" to AC-08.3, 08.4, 08.5 and AC-10.1. Reword "as live" so it clearly applies only to the key mapping and number formatting. |

### Edited passages spot-checked (12)

1. **URS §7 DV-M06-01.** The minimal fix, the alternatives it did not take and the PROPOSED values are all present. It leads to AUD-17.
2. **URS §7 DV-M06-02.** Withdrawn; the keys 2–5 rationale matches M04 FR-M04-18.
3. **URS §7 DV-M06-04.** The per-subject sums reproduce 1,769 (my round-1 figures), and the lane rule 747 is unchanged.
4. **URS §7 DV-M06-07 and SRS §2 Shell column.** Role-based shell; S11–S13 have no subtitle in the admin shell.
5. **URS FN-3.2.5.** Keys 2–5, the D10 limit on key 1, and DV-08 at 2 per row.
6. **URS FN-3.3.4, AC-10.4, SRS FR-87 and E2E-41.** Consistent with M04 BR-M04-17 and the M04 seed ids 136891 (MATH) and 564159 (Sains).
7. **URS FN-6.2.4 and SRS FR-73 / BR-23.** Nothing about the timer is asserted beyond the evidence.
8. **URS FN-7.1.2 / 7.1.4 / 7.1.5 and AC-22.5.** These match the live markup and script captured in round 1.
9. **URS AC-18.6.** Matches the live classes (round-1 capture).
10. **SRS §6.1 `subjectId`.** Integer per M03 v1.2.
11. **SRS SEC-M06-03.** OBSERVED and INFERRED are split correctly.
12. **SRS §6.10 split table and seed text.** The arithmetic is correct and the values are labelled PROPOSED at table level (for the AC labels, see AUD-19).

### Required for PASS

Fix AUD-M06-17 by choosing one source for the hub totals. Fix AUD-M06-18 and AUD-M06-19. After that, re-checking those rows is enough.

---

## Round 3 — targeted check of v1.2 (2026-09-25)

| Field | Value |
|---|---|
| Documents | URS / SRS v1.2 (revision row "v1.2, audit round 2 + M05 alignment" in both) |
| Lane / safety | Browser lane 3 (`playwright3`), read-only. One GET of `/spm`. No action and no quiz, session or exam URL. |
| Settled decisions (not re-opened) | "Soalan Tracking A" is computed from the sets (1,769, PROPOSED, DV-04). It is a cross-page contradiction with the live value, handled like M01 DV-05. The SPM session store is owned by M05, and M06 references it. |

### Verdict: **PASS**

There are **0 Critical, 0 Major and 1 Minor** open findings.

### Round-2 findings: status

| ID | Status | Evidence |
|---|---|---|
| AUD-M06-17 | **Closed** | FN-1.1.2/1.1.3/1.1.4, AC-01.2/01.3, BR-01 and E2E-01 now hold the live hub values: 20,529 / 25 / 0 and chips 14,673 / 14,673, as fixture constants that are not derived. AC-02.1 and E2E-03 assert "Jumlah Soalan ≥ each chip". AC-02.2 says pool changes do not move the hub. DV-01 is limited to "S4 only". OQ-08 is closed. **Live (lane 3) still reads 20,529 / 25 / 0 / 1,797, with chips 14,673 / 14,673 / 1,797.** |
| AUD-M06-18 | **Closed** | AC-09.2 reads "934 soalan tersedia (the S3/S2 pool, PROPOSED — DV-M06-01; live 2,732)". The only remaining "2,732" is the inventory quote in the matrix (EL-M06-S4-033), which is correct as evidence. |
| AUD-M06-19 | **Closed** | AC-08.2, 08.3, 08.4, 08.5 and AC-10.1 each carry "(seed split of the S3/S2 pool, PROPOSED — DV-M06-01)". "As live" now applies only to the key mapping 2–5 and the number formats. E2E-11/13 are labelled per the SRS revision row. |

### Same-screen check (DV-01, DV-04)

- **S1 (hub):** the four stats are 20,529 / 25 / 0 / 1,769, and the chips are 14,673 / 14,673 / 1,769 / 4,059. The "Soalan Tracking A" stat and the Tracking A chip show the same 1,769. The relation "Jumlah Soalan ≥ each chip" holds, so **there is no contradiction on the screen.**
- **S5:** it shows the lane (747), the readiness chips (1 / 1 / 58) and the tiles, and none of these shows the 1,769 total. Those values are unchanged and agree with the sets. **No contradiction on the screen.**
- **S4 (DV-01):** the header total = T4 + T5 = Σ of the difficulty keys over the pool, and S3 shows the same number. For Bahasa Arab S4 reads "0 soalan tersedia" with the fixed "40 (Target Latihan)" option, and "Mula Kuiz" leads to the PROPOSED zero-question message (FN-3.3.2). This is consistent with the S3 lock, and the lone count option is live behaviour. **No contradiction.**
- **Cross-page differences that remain are deliberate:** Σ S2 21,033 vs the hub chips 14,673 (live, replicated) and 1,769 vs live 1,797 (DV-04, PROPOSED, settled).

### Regression checks (script)

| Check | Result |
|---|---|
| Coverage | **1,315 / 1,315.** 0 missing, extra or duplicate. 30 exclusions, all the M16 banner. |
| Matrix FN references | 118 FNs defined, 0 unknown |
| Traceability | 118 FN → FR, all covered. 98 AC → FR and E2E, all covered. 88 FR → E2E, all covered. 42 E2E. **0 dangling.** |
| Stale sweep (38,483 / "21,033 soalan" / AC "2,732") | 0 hits in the spec; only the inventory quote remains. |
| Student stats arithmetic (E2E-28) | Rows: 4/10, 26/34, 6/10 and 34/40. The per-row accuracies (40 %, 76.47 %, 60 %, 85 %) average to **65.4 %**. Coins 4+26+6+34 = **70**, and questions answered 10+34+10+40 = **94**, as the SRS states. |

### Edited passages spot-checked (6)

1. **URS §7 DV-M06-01.** "S4 only". The Live column now includes PERNIAGA 2,732 → 934 and states the hub has no same-screen conflict. Consistent with FN-1.1.9.
2. **SRS BR-M06-01.** The hub values are live constants with UNVERIFIED definitions. "Soalan Tracking A" is computed as Σ `readyCount`, giving 1,769. This matches DV-04.
3. **URS AC-02.1 / AC-02.2 and SRS E2E-03.** The pool invariants (S2 = S3 = S4) and the hub invariants (constants, ≥) do not conflict.
4. **URS AC-08.3.** The PROPOSED label is present, and the "505 difficulty-1 questions" match the seed row MATH d1 = 505.
5. **SRS §6.10 admin sessions A2–A5.** The ids, times and values match the M05 SRS seed (A2 14/40 at 02:11, A3 11/34 at 01:45, A4 1/5 at 00:36, A5 0/5 at 00:14). A2 is Sejarah, as in M05. The stats 4 / 21.8 % / 26 / 84 match live.
6. **SRS §6.4 `SpmQuizSession.id`.** The string ids "A2"…"A5" and "P1"…"P4" are shared with M05, and new sessions get UUIDs. This fits the settled rule that M05 owns the store.

### New finding

| ID | Severity | Doc + section | What's wrong | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M06-20 | Minor (cross-module, tracked) | SRS §6.10 student sessions; §13 Q7; vs M05 SRS §6 sessions table | The one shared session store is still seeded **differently** in the two modules. **P2:** M06 has BM 26/34 (`latih_tubi`), but M05 has "spm · BM · T4, 12 · 9". **P4:** M06 has AKAUN Tracking A 34/40, but M05 does not have it. **Session type:** M05 labels A2–A5 "random" with a D1–D4 scope, while M06 types them `latih_tubi` / `past_year`, and neither SRS states how the M05 mode maps to the M06 `type` that S10 filters on. M06 records the P2/P4 gap as "proposed to M05", so this is tracked, but until M05 is updated one store cannot satisfy both E2E suites (M06 E2E-28 vs M05's anchors for P2). | M05 SRS lines 436–441. M06 SRS §6.10 and §13 Q7. | M05 is the store owner, so the M05 writer should adopt P2 = BM 26/34 (`latih_tubi`) and the new P4, or M06 should use M05's rows. In either case, add the M05 mode ↔ M06 `type` mapping for A2–A5 and P1–P4 to the owning SRS. Close §13 Q7 when both agree. |

Note: DV-04 still cites "(PROPOSED value; OQ-M06-08)" although OQ-08 is now closed. OQ-08 itself lists 1,769 as a remaining G1 value, so the reference still resolves. This is cosmetic only and not a finding.
