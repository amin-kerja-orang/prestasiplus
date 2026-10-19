# M18 — PPD & JPN (district and state portals, Amaran Awal, officer item analysis, officer Kombo views) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M18-ppd-jpn.md` v1.0 (203 FN, 41 US, 149 AC, 42 DV), `docs/requirements/srs/M18-ppd-jpn.md` v1.0 (113 FR, 34 BR, 38 endpoints, 108 E2E, 9 SEC, 17 XR, §6.9 reconciliation C1–C27) |
| Evidence | Discovery `M18-ppd-jpn.md`, `inventory/M18/*.json` (+ `_summary.md`, `_crawl.json`, `_snapshot-2026-09-26.json`), `img/M18/`. Live re-walk on 2026-09-26 between about 14:25 and 14:45 MYT on browser lane 1 with the admin account, read-only. Screens re-opened: S1, S2, S4, S5, S6, S7, S8, S9 (8880), S10, S11, S13, S14 (KLUANG and an unknown name), S16, S17 (1156), S18, S19, S20, S21, S23, S24 (2229), S25, S26, S27 (8880), S29 (8880, 3160), S30 (8880, **8765**), S31, S32, unknown-id probes for S30/S33/S17, and `/admin/schools?search=` (M02) for 8880 and 2710. |
| Safety | Before the first page load, a context-level route guard aborted every non-GET request except the login POST. GET URLs containing `format=csv` or `/amaran/export/` were also aborted. A probe `POST /amaran/intervensi/999999999` was aborted (`net::ERR_FAILED`, never sent). The final network log shows only aborted Cloudflare RUM beacons and the aborted probe as non-GET requests. Nothing was submitted, saved, evaluated or deleted, and nothing was exported. The effectiveness select and "Tunjuk IC Penuh" were not touched. No quiz was started and no AI prompt was sent. Page loads were ≥ 400 ms apart. S11 was open for about 3 s and then left for `about:blank`. No screenshot was taken. Client-side-only interactions: the S10 PPD select and search box, and the S8 "Ikut Subjek" tab. |
| Privacy | IC numbers were never read: on S9 only the count of IC-shaped cells and the digit-masked shape of the two spans were extracted (digits replaced by 9). Pupil and teacher names that appeared in tool output were not written anywhere. The browser's auto-saved snapshot and console log from this session were deleted. The scratch scripts (`<scratchpad>/m18-audit/recon.cjs`, `cov.cjs`, `cov2.cjs`, `trace.cjs`) contain no personal data. |
| Cross-module docs | M01 v1.9, M02 v1.11 (§6.15, XL2-35, student total check), M05 v1.8, M08 v1.7 (class 516 / 3201–3215, E2E-M08-02/12/64/67/68), M10 v1.6 (class anchors 4–10, 516), M11 v1.8 (§6.7 row 8880), M14 (BR-M14-14 streak), M17 (Q-M17-GPS 2.88 / 150), architecture overview §6.12 (single clock), TRACKER change log 2026-09-26 (M14 AUD-03 decision) |
| Auditor | Independent audit agent (not an author) |
| Scripts | `recon.cjs` (C1–C27 arithmetic, the risk score at two clocks, 8765 feasibility), `cov.cjs` / `cov2.cjs` (coverage and text match), `trace.cjs` (FN → FR → AC → E2E) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 6 |
| Minor | 5 |
| Info | 4 |

What is good:
- **Coverage is complete (script re-run).**
  - 2,264/2,264 inventory content elements are in the §6.1 matrix: 2,171 mapped and 93 excluded. The 93 exclusions are exactly the M16 banner triplets EL-M18-S{n}-001…003 on the 31 shell screens.
  - There are no duplicates, no rows with an unknown element, and no unknown FN references.
  - 2,175/2,175 quoted texts match the inventory text. The only differences are rows truncated with "…" and escaped pipes.
  - The SHU shell has 417 elements, of which 67 are listed and mapped. 179 of the 203 FNs appear in the matrix.
- **Traceability is clean (script).**
  - Counts: 203 FN, 41 US, 149 AC (23 provisional), 113 FR, 108 E2E.
  - Nothing is missing: every FN has an FR, every AC has an FR and an E2E, and every FR has an E2E. There are no bad references.
  - 21 E2E are provisional, matching the §12 list. No provisional AC is covered only by non-provisional E2E, and the reverse does not occur either.
- **Live values are exact.** About 90 live claims were re-checked and match, including:
  - S1: 118 / 135 / 2.49 A- / 135 red (100 %, "86 akademik berisiko, 49 belum mula latih") / 71.6 % / 81 of 135 / 64 (47.4 %) / Funnel 65 (48.1 %). Risk rows 12/13/12/14/4/21/59. Six subject cards. Kombo rows 18 · 8.2 … 4 · 7.5 with "Pelajar 0". Mastery 14/20/4 (36.8/52.6/10.5 %). School means 1.2 / 0.7. Correction notice and developer line.
  - S5 / S8: 116 schools, 0.6 %, 8765 JEA2029 21 · 0 · 0 % · 73.1 % · 222 (10.6/pelajar) · 22.6, and 21.9 on S8. "🏋" is shown for place 1. The subject select has 32 options (7 "(Teras)").
  - S7: 116 / 72 / 0 / 0.6 % / 222, "Dijana: 26 Sep 2026, 06:25" (UTC).
  - S4 / S13: all 7 rows of each period, and "today" 8082 1 · 57 · 60 · 95.0 %.
  - S6: 8765 row "— 60.3 76.3 92.2 — — 72.3 75.3".
  - S9 8880: 59 / 6.8 % / 0 / 4 / 55 / 15; monthly 675 / 485 / 71.9 %; calendar 33 / 7,307 / 221; correction cards; accordions 15/15/28.
  - S10: 1,189, the district rows (KLUANG 7 / 134 / 134), 7 risk rows with 8880 listed twice, and mastery 116.7 / 166.7 / 33.3 %.
  - S11: 1,187 / 72 / 6 / NaN / 83.8 % / "undefined".
  - S25 / S26: 10,535 / 71.6 %, school rows 6 · 222 · 83.8 %, 31 · 10,194 · 71.7 %, 1 · 119 · 38.7 %, and "1.5 % terlibat".
  - S27: 59 / 2 / 9 / 3 / 60 / 675 / 72.4 %, GPS 2.49 / 148, distribution 4/36/42/36/18/6/4/1/1/0, levels 143 + 113 murid.
  - S29 8880: 6.4 / 13 / 14 and "Jumlah Hari" 0.
  - S30 8880: 10,194 / 71.7 %, GPS 3.45 / 744, the 5 subject rows, pills 20/13/6/1.
  - S31 / S32: 33 / 0 / 29 / 6 / 15. S17 1156: 45.7 "Perlu Perhatian" · 58.6 % · 2026-09-15 · L4. S16 750 cards.
  - S24 2229: 2 / 0 / 2, 7 types, 751 class options, 2 statuses, 4 effectiveness options.
- **Every deviation DV-M18-01…42 was re-checked on live.**
  - Evidence was reproduced for 01–39 and 42. The S10 filter was tested through the PPD select: "PPD KLUANG" gives 479 and "KLUANG" typed gives 43.
  - Every rejected deviation is sound (06, 08, 09, 10, 12, 20, 28, 29, 33, 34, 35, 37, 38, 42).
  - DV-40 and DV-41 are not sound: see AUD-M18-03 and AUD-M18-04.
- **The (a) reconciliations re-run by script hold arithmetically.**
  - Schools: 118 − {8880, 2710} = 116. Σ of the 11 PPDs = 1,189, and 1,189 − 2 = 1,187.
  - Pupils: 135 − 59 − 4 = 72.
  - Accuracy: 71.6 = 7,539 / 10,535 pooled; 83.8 = 186 / 222; 0.6 = 73.1 / 116.
  - Scores: 21.93 → 21.9 and 21.93 + 0.3 × (10.57 ÷ 5) = 22.56 → 22.6.
  - Mastery: ÷ 38 versus ÷ 12.
  - Kombo: 81 and 7.19; Batang Padang 5.99 → "6".
  - 8880: 59 = 53 + 6, 58 = 15 + 15 + 28, 675 = 97 + 78 + 490 + 10 = 124 + 551, 7,307 / 10,194 = 71.7 %.
  - GPS: 369 / 148 = 2.49 and 2,569 / 744 = 3.45.
  - Duplicates and counters: 181 and 479 / 43.
- **XR-M18-01 is confirmed on live.** M02 `/admin/schools` lists 8880 (JEB2037, 59 pupils, 2 teachers) and 2710 (JBA2027, 4 pupils) as "Tidak Aktif" with the "Aktifkan" toggle, so the 118 / 116 split is an owner fact.
- **Privacy in the docs.** A grep for every pupil and teacher name seen live today, and for IC-shaped numbers, finds nothing in the URS, SRS or discovery. Seeds use "Murid Demo …" / "Guru Demo …".
- **DV-13 (masked by default, audited reveal) is justified.** Live ships 30 full ICs in the S9 8880 HTML (the 15 + 15 pupils of classes 516 / 517; "—" elsewhere, as XR-02 says). "Tunjuk IC Penuh" is an Alpine `confirm(...)` that sets `showFullIc = true` with no request, so the "direkodkan untuk pematuhan PDPA" claim is false. This is a contradictory rule under D9 as well as a privacy defect. Keeping the button, the confirm text and the toggle while moving the full IC behind an audited endpoint is the minimal fix. SEC-M18-01 and AC-20.2 are adequate. The mask format is the exception: see AUD-M18-02.
- **Security.** SEC-M18-01…09 are present and specific: IC, IDOR, CSV injection and minimum columns, CSRF on interventions, escaping of polled names, the `url()->previous()` leak, 500 on unknown ids, and developer text.
- **Responsive behaviour.** §10 specifies 375 / 768 / 1280 for every screen family, and E2E-108 sweeps S1 and S3–S33. The DV-19 evidence was reproduced: S20 `scrollWidth` is 498 at 375, while S1, S25 and S27 are 360.

Why it fails (6 Major):
1. The admin mirror is written against a 26-Sep clock, but the project runs on one clock, 25-Sep 15:40 (AUD-M18-01).
2. The live IC mask is observable, and the docs propose a different one that reveals more digits (AUD-M18-02).
3. The heat-map / S5 "Ketepatan" definition is refuted by live S30 8765, and the §6.11 C seed is arithmetically infeasible (AUD-M18-03).
4. DV-41 does not remove the contradiction it targets (AUD-M18-04).
5. XR-M18-08 ("one of them must be user 2229") cannot be applied beside M08's 3201–3215 anchors (AUD-M18-05).
6. The S30 critical-question selection rule (BR-M18-26) is contradicted by live S30 8765 (AUD-M18-06).

---

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M18-01 | **Major** | URS §0 "Admin" bullet and ACs header; SRS §6.4, §6.11 E, §6.13, §12 intro, §6.9 C9/C11, E2E-M18-45, 76, 84, 93 | The admin mirror is specified at `2026-09-26T12:36:44+08:00`. The project runs dev and demo builds, and the E2E fixture default, at one clock, **2026-09-25T15:40** (architecture §6.12). The Delivery Lead enforced this for all builds after M14 AUD-03 (TRACKER 2026-09-26). At the project clock: <br>• **Class-1156 risk score:** BR-M18-13 gives **44.7**, not the observed 45.7. The recon script shows 45.7 needs 11 whole days since the observed `lastLoginAt` 2026-09-15; at 25/09 there are 10 days. The `lastLoginAt` value is observed ("Terakhir aktif: 2026-09-15") and cannot be moved. <br>• **Ranking snapshot:** DATA-M18-03 `generatedAt` 2026-09-26 04:36:44Z lies **in the future**. C11's "(b) snapshot time" argument (windows 17–21 h after M11) cannot hold when M11 and M18 compute at the same instant. <br>• **Hard-coded times:** E2E-45, 84 and 93 assert 26-Sep "Dijana" times and dates. <br>Most other M18 figures are clock-robust. KLUANG, Johor and Perak have no answers in the last 30 days (S3 is 0 in every period, S12 is empty), and the 365-day and 12-month windows hold 8880's Feb–Apr activity either way. | Architecture overview §6.12 ("now = 2026-09-25T15:40:00+08:00"); TRACKER 2026-09-26 M14 audit row; recon `risk1156`: 26-Sep → 45.7, 25-Sep → 44.7 (whole days). | M18 solution-architect; Delivery Lead decision | Re-base the admin mirror on the project clock. <br>• State that the risk score is time-dependent. Either assert 44.7 at the project clock, or run E2E-76 / AC-26.3 / AC-27.2 with an explicit `mock.setClock` override for 45.7, and list this under the M14 AUD-03 decision. <br>• Date DATA-M18-03 `generatedAt` ≤ 2026-09-25T15:40. Either show that the seeded rows are feasible against M05 / M11 counts for windows ending then, or classify the stored ranking rows explicitly as an M18-owned stored aggregate (documented display data) and list the cross-module differences. <br>• Make every E2E that reads "Dijana", dates or the ranking name its clock. |
| AUD-M18-02 | **Major** | URS FN-M18-2.9.12, DV-M18-13 ("Visible UI unchanged"); SRS BR-M18-27 ("live mask format was not captured"), §8.2 "IC mask", AC-M18-20.x | The live mask **is observable**. Every S9 IC cell renders `<span x-show="!showFullIc">xxxxxx-xx-xx{last 2 digits}</span>` by default, next to the hidden full-IC span. That is 30 cells on 8880; the shape was read with the digits replaced. The docs instead propose "••••••-••-{last 4}". This: <br>• changes a visible default string that works on live (a D7/D9 breach); <br>• discloses **two more digits** of a minor's IC than live does, which goes against the privacy intent of DV-13 itself; <br>• contradicts DV-13's own "Visible UI unchanged". | Live `/ppd/sekolah/8880` DOM: `td.font-mono` → span `!showFullIc` text `xxxxxx-xx-xx99` (digits masked by the auditor) and span `showFullIc` `999999999999`. | M18 product-analyst | Mask = the live format "xxxxxx-xx-xx" + the last 2 digits (literal "x"). <br>• Update BR-27, FN-2.9.12, §8.2 and AC-20.x / E2E. <br>• Remove the IC mask from the PROPOSED list and record the observation in discovery Q/D. <br>• Keep full ICs only on #12. |
| AUD-M18-03 | **Major** | SRS BR-M18-19, Q-M18-ACCSTU, §6.9 C4 (73.1 feasibility) and C19, §6.11 C (8765 split, "fails the build otherwise"), XR-M18-03; URS DV-M18-40, DV-M18-02 | The heat map and S5 "Ketepatan" are defined as the mean of the pupils' **answer-log** accuracies. Live refutes this. <br>• **Live 8765 subject rows:** `/sekolah/8765/analisa-item` (not captured by discovery) shows Matematik 6 · 60 · 77.3 % · 17, Bahasa Melayu **1** · 43 · **83.7 %** · 7, Sejarah **1** · 52 · **84.6 %** · 8, Pendidikan Islam 1 · 50 · 92.3 % · 4 (Σ wrong 36 = 222 − 186). <br>• **Heat-map clash:** the heat map shows the same single BM and SEJ pupils at **60.3 %** and **72.3 %**, which no answer-log mean can produce. <br>• **Infeasible seed (script, independently of S30):** the KLUANG subject cards minus 8880's S30 rows leave 8765 exactly one BM pupil and one SEJ pupil. A single pupil at 60.3 % needs ≥ 23 wrong (35/58) and one at 72.3 % needs ≥ 13 (34/47): 36 > the 32 wrong answers 8765 has outside PI. So §6.11 C cannot be built. The R15 example also has no pupil with the 52 PI answers / 4 wrong. <br>• **Likely base:** the practice sessions. 8765's two session pupils at "64 %" and "82.6 %" give a mean of 73.03–73.57, which contains 73.1, and S5 subject 3 equals heat-map MT 76.3. That makes DV-40 (92.2 vs 92.3, "one pupil cannot have two accuracies") a **definition difference** (sessions vs answer log), like the rejected DV-10, not a contradiction. | Live S30 8765 and S6 (2026-09-26); recon `8765-feas` FAIL, `R15-PI` FAIL; S9 8765 per-pupil session rows (SRS §6.10). | M18 solution-architect + product-analyst | Re-derive Q-M18-ACCSTU from the practice sessions (or whichever base reproduces 73.1 / 76.3 / 60.3 / 72.3 / 92.2 by script) and mark it INFERRED. <br>• Rewrite BR-19, C4 and C19 and the §6.11 C / D seed with a **proven** split (for example, per-subject session accuracies of 8765's 2 session pupils). <br>• Reclassify DV-40 as "Rejected — two definitions, replicate 92.2" or give new evidence. <br>• Add the observed S30 8765 values (subject rows, pills, cards) to the seed / ACs and to XR-03/05/10. |
| AUD-M18-04 | **Major** | URS DV-M18-41; SRS BR-M18-33, FR-M18-110, C17, E2E-M18-107 ("≥ 1 for each row with a kombo") | DV-41 defines "Jumlah Hari" as distinct days with answers. It does not remove the contradiction it targets. <br>• Kombo streaks also grow on **logins** (M14 BR-M14-14), and live has many kombo pupils without answers: KLUANG has 81 kombo-active pupils but only 38 pupils with any answer. <br>• `/sekolah/3160/kombo` shows 12 kombo-active pupils, "Kombo Tertinggi 15" and top-10 rows 15/18 … 6/8, yet 3160 has **no answers** (it is absent from S25's schools with answers). <br>• Under BR-33, S29/S33 for 3160 (and 2700, 8772, 8767, 7780, school 1) would still read "Kombo 15 · Jumlah Hari 0". E2E-107's assertion is unsatisfiable there. <br>The fix is therefore neither effective nor free of a visible contradiction (CLAUDE.md §6). | Live `/sekolah/3160/kombo` (numeric cells only); S1 kombo 81 vs S25 answering pupils 31 + 6 + 1; M14 BR-M14-14. | M18 product-analyst | Re-decide under D9. Either <br>(a) **reject — replicate "0"**: a consistent live limitation that cannot be fixed without data M14 does not store; or <br>(b) define it from a store that records every qualifying day, which does not exist, so this would be new scope. <br>(a) is recommended. Update FR-110, C17 and E2E-107 accordingly. |
| AUD-M18-05 | **Major** | SRS XR-M18-08 ("one of them must be user **2229**"), §6.11 I, SQ-M18-03; URS AC-34.x; E2E-M18-91, 97; §6.11 H pupil links (live ids 2215–2232) | M08 v1.7 designs the class-516 pupils as **3201–3215**. They are used by M08 E2E-02, 12, 64, 67 and 68, and by M02 §6.15, where XL2-35 made them "no school". A user cannot be both 2229 and one of 3201–3215, so XR-08 as written cannot be applied, and every M18 AC / E2E that hard-codes 2229 fails. Moving 3201–3215 to 8880 is justified: live S9 shows "4 Simulasi" with 15 pupils of 8880, and "0 guna" matches M08's "no session". But it reverses an XL decision and needs compensation: M02's no-school count goes from 22 to 7, 8880's T4 26 must absorb the 15, and 15 generated register students must be re-homed. XR-08 does not state this. | M08 SRS §6 (class 516 row, E2E-M08-02/64/67/68); M02 v1.10 XL2-35 and the student total check; live `/amaran/intervensi/2229`, S30 links `/prestasi/2215…2232`. | M18 solution-architect (with M08, M02) | Drop "must be user 2229". Map the observed intervention pupil to one M08 anchor (for example 3215) and state the live-id → anchor mapping once (the live ids are observations, not seed ids). Update §6.11 I, AC-34.x, E2E-91/97 and the S30 link ids. Rewrite XR-08 to M02: `schoolId 8880` for 3201–3215 as 15 of 8880's 26 T4 register pupils, with the arithmetic keeping 4,533, the register 4,158 and M08's T4 card 149. Raise it at the XL batch 3 gate. |
| AUD-M18-06 | **Major** | SRS BR-M18-26 (selection "answered by ≥ 2 pupils … ≥ 50 % wrong … top 20"), FR-M18-106; URS FN-M18-5.3.7/5.3.8 | Live S30 for 8765 lists "Semua (6)" / "Matematik (4)" / "Pendidikan Islam (2)". Card 1 is 84.6 % salah with 6 pupils; cards 2 and 3 are **"0.0 % salah"**, **"1 pelajar cuba"**, difficulty **"Mudah"**. BR-26 excludes all of these (fewer than 2 pupils, under 50 % wrong), so a builder would render a different list on a reachable admin screen. The rule was fitted only to the all-"100.0 % salah" anchors of KLUANG and 8880. The difficulty label also varies ("Mudah"), whereas the docs state all cards are "Sukar". | Live `/sekolah/8765/analisa-item` 2026-09-26 (question stems are public M04 content; no pupil data read). | M18 product-analyst + solution-architect | Re-derive the S30 selection and order so they reproduce both 8880 (20 cards) and 8765 (6 cards, including the 0 % rows), and label it INFERRED. Add 8765's S30 as an observed anchor (AC + seed + XR-10 M04 anchors). Say whether S25/S26 share the rule; their observed lists are all 100 %. |
| AUD-M18-07 | Minor | SRS §6.9 C9, XR-M18-05 | The orphan-row model for 10,194 vs 10,196 is a **legitimate minimal model**. It keeps both observed figures, adds no rows, changes no owner total, is labelled INFERRED, and the 71.5 % argument (R3e) holds (recon: 71.55–71.57 % with 10,537). But it is mislabelled "(b) snapshot-time difference". Under the single project clock both figures are computed at the same instant, so it is an **(a) definition difference** (answers joined to M04 vs all rows). The "fallback (d) if M05 declines" also conflicts with §6.9's own rule that (d) is never used for an owner total. | SRS §6.9 header and C9; recon C9. | M18 solution-architect | Relabel C9 as (a) "Q-M18-ANS joins M04; M11 Q-ANS-SEG does not". Replace the (d) fallback with the escalation path (Delivery Lead decision at XL batch 3). |
| AUD-M18-08 | Minor | SRS §6.10 users row, XR-M18-02, XR-M18-08, §6.11 F | XR-02 is justified but its feasibility is not shown. <br>• M02 v1.11 allocates all 4,533 students (4,158 + 10 + 22 + 137 + 134 + 72). "Rebalance from the no-school pools" can only mean the M10-bound `attendanceMirror` (must stay no-school) or the **T4 class pool** (134, which feeds M08's T4 card 149). <br>• Live supports the latter: members of M10 classes 4–10 sit at 7780, school 1 and **3160** (S19 rows; `/sekolah/3160/kombo` class table "5 Bestari - BM" 3 · 14.3 · 15 · 3 …, 10 rows). <br>• The SRS does not name the pool, does not show that the T4 card stays 149 after re-grading (school 1 Darjah, 3160 primary), and leaves out the 3160 (and possibly 2700 / 8772 / 8767) class memberships from XR-08 and §6.11 F. | M02 SRS student total check (line "4,158 + 10 + 22 + 137 + 134 + 72"); live S19, S29 3160. | M18 solution-architect | Name the source pool in XR-02 and give the arithmetic (4,533, 4,158, T4 card 149, per-school counts). Add the observed 3160 class-kombo rows (and those of the other schools, if the Delivery Lead wants them observed) to §6.11 F / XR-07 / XR-08, or state that they are generated. |
| AUD-M18-09 | Minor | SRS §8.2, URS OQ-M18-10, V-M18-01, FN-M18-2.2.2, FN-M18-4.9.1–4.9.3 vs SRS §7.2 | The PROPOSED list is incomplete and inconsistent. <br>• **Missing from §8.2:** the notes / follow-up limit of 2,000 characters (V-M18-01) and the S2 officer "Pecahan Daerah replaced by the district's schools" (FN-2.2.2). <br>• **Missing from OQ-10:** the IC mask (now to be replaced by AUD-02), the S9 filled pupil-ranking layout and the notes limit. <br>• **CSV columns disagree:** URS FN-4.9.1 gives "#", Pelajar, Skor Risiko, Status, Ketepatan, Penglibatan, Penguasaan; SRS §7.2 gives "Bil", Pelajar, Sekolah (district), **Tingkatan / Kelas**, …. | Doc-internal. | M18 product-analyst | Make §8.2 and OQ-10 list every PROPOSED item once. Align the CSV column lists between the URS and SRS. |
| AUD-M18-10 | Minor | SRS §10 | Two gaps in the responsive table. <br>• The S2 officer page (provisional S11 component) and the S2 admin 403 page have no row. <br>• S11 says "fixed 4-column layout, panels shrink" at 375 without stating the no-horizontal-page-scroll outcome. That outcome is mandatory (CLAUDE.md §7), and E2E-108 will check it. | Doc-internal. | M18 product-analyst | Add S2 rows. For S11, state what happens at 375 / 768 (for example, panels stay in the grid with in-panel scroll and page `scrollWidth ≤ clientWidth`), or list the S11 layout as a deviation if live overflows. |
| AUD-M18-11 | Minor | Discovery coverage vs the SRS seed claims | Discovery did not capture `/sekolah/8765/analisa-item` or the S29/S33 pages of schools other than 8880 / 7780 / school 1 (only a link appears in the snapshot). Yet the SRS seeds and the XRs assert values for those schools, such as the 8765 accuracy split and the kombo classes. AUD-03, 04, 06 and 08 all come from this gap. | Snapshot `_snapshot-2026-09-26.json` (only `href=/sekolah/8765/analisa-item`). | M18 (discovery, lane 1 re-capture) | Capture S30 and S29 for every KLUANG / BATANG PADANG school with pupils (8765, 3160, 2700, 2710, 8772, 8767, 7780, 1) read-only, with names masked, and feed them into the fixes above. |
| AUD-M18-12 | Info | SRS XR-M18-01 | The inactive status of 8880 and 2710 is directly observable on M02 `/admin/schools` ("Tidak Aktif", "Aktifkan" toggle). | Live 2026-09-26. | M18 | Cite this evidence in XR-01 and DV-38. |
| AUD-M18-13 | Info | SRS §6.9 (a)-claims | 59 vs 53 (6 lower-form pupils; S9 grade options Darjah 6, T1–T3), 118 / 116, 1,189 / 1,187, 135 / 72, 71.6 / 83.8, 22.6 / 21.9, and the 8880 figures 675 / 485 / 7,307 / 10,194 all re-computed as stated. 73.1 is re-opened by AUD-03 (definition), not by arithmetic. | recon.cjs | — | — |
| AUD-M18-14 | Info | Owner requests XR-M18-01…17 | These requests are judged justified and minimal: XR-01, 04 (placing the 12 "before M1" answers at 8765 gives 222 = 210 + 12, consistent with live 8765 S30 222), 06, 07 (the "not decayed" confirmation is essential; see AUD-04), 09, 10, 11, 12, 13, 14, 15, 16 (32 options confirmed live) and 17. XR-02 and XR-08 need the changes in AUD-05 and AUD-08. XR-03 and XR-05 need the base correction in AUD-03. | Live + owner docs. | — | — |
| AUD-M18-15 | Info | Live defects seen but already covered | The following were all reproduced and are handled by existing DVs: S23 "Kembali" still points to `/chatbot/history?session_id=…` (DV-21, SEC-07); unknown ids give 500 / 200 / 403 (DV-25/26/27); the S18 CSV link is `/amaran/export/district/0` (DV-17); the S5 "Eksport CSV" `onclick` sends `district` and `state` but no subject (DV-06); content fonts are 10–11 px on S1 (DV-30); the S25 h2 is `rgb(30,41,59)` on the dark card (DV-31); the S8 "Ikut Subjek" tab leaves the content unchanged (DV-08). | Live 2026-09-26. | — | — |

---

## Scripted checks (summary)

| Script | Result |
|---|---|
| `cov.cjs` | Inventory 2,264 content + 417 SHU elements. Matrix: 2,331 rows, 0 duplicates, 0 unknown, 0 unmapped, 2,171 mapped, 93 excluded, 0 bad FN references. 203 FNs, 179 in the matrix. |
| `cov2.cjs` | 2,175 quoted texts checked, 0 mismatches (after allowing for "…" truncation and escaped "\|"). |
| `trace.cjs` | 203 FN / 41 US / 149 AC (23 provisional) / 113 FR / 108 E2E (21 provisional = §12 list). No FN without an FR, no AC without an FR or an E2E, no FR without an E2E, 0 bad references, provisional coverage consistent. |
| `recon.cjs` | 24 of the C-checks PASS. **FAIL** `R15-PI` and `8765-feas` (AUD-03). A rounding artefact in the script's own C14 line was checked by hand: 2.49 / 3.45 hold. Risk 1156: 45.7 at 26-Sep, 44.7 at the project clock (AUD-01). |

## Spot-check coverage

- **Screens re-opened:** 27 of 33 (S3, S12, S15, S22, S28 and S33 were not re-opened; they are templates of S9/S14/S29 or were covered by DV probes).
- **Values and states:** about 90 figures and strings, plus the empty states of S14, S21 and S9, the 403 and 404 pages, and the S11 NaN / "undefined" / "Memuatkan wawasan..." state. That is well above the 25 % target for figures and states.
- **Deviations:** all 42 DV rows were checked.

## Recommended routing

Route to the M18 writer (product-analyst + solution-architect) for v1.1: fix AUD-01 to AUD-11. AUD-01 needs a Delivery Lead decision in line with the M14 AUD-03 precedent. AUD-05 and AUD-08 should be raised at the XL batch 3 gate with M02 / M08 / M10. After v1.1, run audit round 2 on the changed sections plus a live re-check of S30 8765, S29 3160 and the S9 IC mask.

---

## Top-up (AUD-M18-11): live capture of 2026-09-26, 14:42 MYT

**Data:** `docs/discovery/inventory/M18/_topup-2026-09-26.json`.

**Scope of the capture:**
- For each of the 9 schools with pupils (8880, 8765, 2710, 3160, 2700, 8772, 8767, 7780, 1), four views were captured: S29 `/sekolah/{id}/kombo`, S30 `/sekolah/{id}/analisa-item`, S22 `/amaran/sekolah/{id}`, and the S9 per-pupil session columns.
- S30 of 8765 was also captured with the `?tingkatan=T4` and `?tingkatan=T5` filters.
- The S6 heat-map rows and S5 for every core `subject_id` were included.

**Method:**
- The same guard, masking and pacing as the main audit were used.
- Pupils appear only as ranked rows. Name, IC, e-mail and qualification columns were never read.
- A scan of the saved file finds 0 name, IC or e-mail patterns.

**How the data resolves the findings.** All three stay open until the docs change, but each now has a clear fix.

### AUD-M18-03 (accuracy bases): three different bases are observed

**1. Per-pupil accuracy comes from practice sessions (confirmed).** Pupil accuracy on S9 ("Accuracy") and on the Amaran pages ("Purata ketepatan") is the pupil's mean practice-session accuracy.
- The 2710 pupil shows three different figures:
  - 21.8 % as the per-pupil session accuracy;
  - 26/84 = 31 % as the pooled May session figure;
  - 46/119 = 38.7 % from the answer log.
- BR-M18-13 reproduces the risk scores of the newly captured pupils with these inputs: 2710 86.8, 2700 88.6, and 8765 72.2 and 67.

**2. Sessions and the answer log are separate stores.**
- 2700 has 1 session (14 questions, 28.6 %, 13/02/2026).
- Yet 2700's S30 shows "Soalan Dijawab 0", and 2700 is absent from S25.

**3. School-per-subject accuracy (S5 with `subject_id`, and the S6 heat map, which are identical) uses neither of those bases.**
- 8765 reads BM 60.3, MT 76.3, PI 92.2 and SEJ 72.3.
- It is not the answer log: S30 for 8765 shows a single BM pupil at 83.7 % and a single SEJ pupil at 84.6 %. 2710's S30 has only BM (1 · 79 · 40.5 %) and SEJ (1 · 40 · 35.0 %), which confirms that 8765 has exactly one BM pupil and one SEJ pupil.
- It is not the practice sessions: 8765's only two session pupils are at 64 % and 82.6 %, a mean of 73.3, not the 73.1 shown. 2700's 28.6 % session also appears nowhere; S5 shows "—" for 2700 in every core subject.
- The heat-map "0%" cells (3160 BI; 2700 BM, MT and SEJ; 8767 Sains and SEJ) do not follow BR-19's "class in the subject" rule. For example, 3160's pupils are only in BM/SEJ classes.
- **Conclusion:** the base is a stored per-pupil × subject figure. The most plausible source is M05 SubjectMastery correct/answered, the store behind "Purata tahap" (INFERRED).

**4. The subject-weakness block (BR-M18-16) matches the correction aggregate, not the practice sessions.** Its pupil counts equal DATA-M18-04's CorrectionSubject pupils exactly:
- 8765: Fizik 5, Biologi 3, Matematik 6, Sejarah 3, Kimia 5, Perniagaan 2, Matematik Tambahan 2, Sains Komputer 3, Geografi 1.
- 8880: BM, BI and MATH 1 each.
- MT shows 6/6 although only 2 pupils of 8765 have sessions.
- 2710 (new): BM, SEJ, Fizik, Geografi and Sains Komputer, each 1/1.

**Fix for the writer:**
- Define Q-M18-ACCSTU from that stored per-pupil subject accuracy (INFERRED) and seed the 8765 per-subject means and the "0%" cells as observed anchors (XR-03).
- Prove 73.1 by script, or keep it as that store's figure.
- Drop the infeasible answer-log split in §6.11 C.
- Reclassify DV-40 as "two bases, replicate 92.2".
- Base BR-16 on the per-pupil subject-stats rows.

### AUD-M18-04 (DV-41): the "Jumlah Hari" field works on live

Live "Jumlah Hari" is **not always 0**. In 2710's top 10, two rows read:
- Kombo 1, Terbaik 5, **Jumlah Hari 13**;
- Kombo 1, Terbaik 1, **Jumlah Hari 4**.

2710's calendar has only 3 days with correct answers in 365 days (2026-02-19 20, 2026-05-11 25 and 2026-05-19 1, Σ 46 as on S25). So the field is a **stored per-pupil counter**, not days counted from the answer log. All other 87 top-10 rows observed (8 schools) read 0.

DV-41's evidence ("0 on every row") is therefore false, and its fix would change working values.

**Fix for the writer:**
- Reject DV-41 and replicate the stored field.
- Add a request to M14 for a stored `totalDays` counter (or equivalent) on DATA-M14-08, with the observed anchors: 2710 = 13 and 4, and 0 for every other observed row.
- Update FR-110, BR-33, C17 and E2E-107.

The newly captured S29 class tables (every school uses the "4/5 Bestari / Cemerlang / Dedikasi - BM/SEJ" classes) also supply the class memberships missing in AUD-M18-08.

### AUD-M18-06 (S30 selection): what 8765 shows

**Cards:** 8765's S30 shows 6 cards ("Semua (6)", "Matematik (4)", "Pendidikan Islam (2)").
- Card 1: "Sukar", 84.6 % salah, 6 pelajar cuba, 28.6 % terlibat.
- Cards 2–6: "Mudah", "0.0 % salah", "1 pelajar cuba", 4.8 % terlibat.
- "Profil Kesukaran" counts these 6 cards: 5 Mudah / 0 Sederhana / 1 Sukar.

**With the T5 filter:** card 1 becomes **"Sederhana", 50.0 % salah, 2 pelajar cuba**, and its icon changes from `fa-frown` to `fa-meh`. Cards 2–6 keep `fa-smile`.

**Conclusions:**
- **The difficulty label and icon come from % salah within the current view, not from M04 difficulty.** 84.6 % → Sukar, 50.0 % → Sederhana, 0.0 % → Mudah. The exact cut-offs are INFERRED.
- **The level filter keeps the same 6 questions.** Only the attempt counts and the "% terlibat" denominators change: 21 for all, 14 for T4, 7 for T5.
- **The card set is not "every answered question".** 8765 answered 205 distinct questions (60 + 43 + 52 + 50), and 2710, with 119 answers, shows no cards. The set is a stored per-question statistics set, ordered by % salah descending and capped at 20 (as 8880 shows).

**Fix for the writer:**
- Drop the "≥ 2 pupils and ≥ 50 % wrong" filter and "difficulty = M04" from BR-26.
- Seed the card lists as observed anchors: 8880 has 20 cards, 8765 has 6, 2710 has none.
- Specify the label and icon rule from % salah (INFERRED cut-offs).

### New observation (Minor, owner: M18 solution-architect)

The 8765 T4 and T5 denominators (14 and 7) contradict SRS §6.11 B, which gives 8765 as T4 12, T5 4 and T1–T3 5. The T4 / T5 pupil split for 8765 in §6.11 B needs re-checking against these denominators. The S22 level labels are class-based (T4 11 / T5 6 / none 4), so they do not settle the split.

---

## Round 2 (URS / SRS v1.1, 2026-09-27)

### Scope and method

- **Documents audited:** `urs/M18-ppd-jpn.md` v1.1 and `srs/M18-ppd-jpn.md` v1.1.
- **Doc-only:** no live check was needed. Every fix was compared against the round-1 evidence and the top-up file `_topup-2026-09-26.json`. Line numbers below refer to v1.1.
- **Scripts:**
  - `cov.cjs`, `cov2.cjs` and `trace.cjs` were re-run.
  - A new `recon2.cjs` checks the v1.1 anchors, together with the round-1 `recon.cjs`.

### Verdict: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 5 (new; AUD-M18-R2-01…05) |

All 11 round-1 findings and the top-up Minor are closed. The 5 new Minor findings should be fixed in v1.2, or at the XL batch 3 gate for R2-04 and R2-05. None of them blocks G1.

### Scripted checks

| Check | Result |
|---|---|
| Coverage (`cov.cjs`, `cov2.cjs`) | Unchanged and complete: 2,264 of 2,264 elements (2,171 mapped, 93 excluded), 0 unmapped, 0 unknown, 0 bad FN references. 2,175 of 2,175 quoted texts match the inventory. |
| Traceability (`trace.cjs`) | 203 FN, 41 US, **151 AC** (+ AC-38.6, 38.7), 113 FR, **109 E2E** (+ E2E-109), 21 provisional (= the §12 list). 0 gaps and 0 bad references. |
| Reconciliation (`recon2.cjs` + `recon.cjs`) | 25 + 24 PASS, 0 FAIL. Details below. |

**What `recon2.cjs` confirms:**
- **Q-M18-ACCSTU anchors (SRS §6.11 C, l.457):** BM 35/58 = 60.3, SEJ 34/47 = 72.3, PI 47/51 = 92.2, MT mean (18/22, 17/24) = 76.3. The overall figure is the mean of the pupils' pooled rows: X 75.28, Y 70.83 → 73.06 → **73.1**.
- **S5 subject scores:** 18.7 / 23.5 / 28.3 / 22.3. Heat-map Purata 75.3.
- **Sessions are not the base:** the session mean of 8765's two pupils is 73.3, not 73.1.
- **BR-M18-13 reproduces every top-up score:** 2710 86.8, 2700 88.6, 8765 72.2 and 67, the 8765 login-only pupils with levels 99.4 / 98 / 97 / 95.5, and 8880 84.4 / 83.6 / 66.8 / 64.
- **Class 1156 at the project clock:** 44.7.
- **C28 denominators:** 14 + 7 − 4 = 17, giving 42.9 / 28.6 / 4.8 / 7.1 / 14.3 %.
- **Jumlah Hari:** 82 rows read 0.
- **2710 calendar:** Σ 46.
- **BR-26 cut-offs:** 100 / 84.6 → Sukar, 50 → Sederhana, 0 → Mudah.

### Round-1 findings: verification

| ID | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M18-01 | **Closed** | <br>• The project clock is set in URS l.29 and l.485, SRS §6.13 l.488 ("no M18 scenario overrides it") and SRS §12 l.690. <br>• Class 1156 reads 44.7 in AC-26.3 (l.677), AC-27.2 (l.682), E2E-76 (l.771) and E2E-79. <br>• "Dijana 25 Sep 2026, 15:40" appears in AC-16.1 / E2E-45 (l.740) and AC-31.1 / E2E-84 (l.779). <br>• The ranking `generatedAt` is 2026-09-25T15:30 (SRS l.461). <br>• C11 (l.403) is now a documented stored aggregate; it is never shown beside the M11 figures, which is D11-compliant. |
| AUD-M18-02 | **Closed** | The live mask "xxxxxx-xx-xx" + 2 digits is now used in BR-27 (l.277), FN-2.9.12 (URS l.253), AC-20.2 (l.642) and DV-13 (l.3373). The IC mask is gone from §8.2, and no "last 4" remains (grep). |
| AUD-M18-03 | **Closed** | <br>• Three bases are stated: BR-19 (l.269), Q-M18-ACCSTU (l.371), C4 (l.396) and C19 (l.411). <br>• The infeasible split has been dropped (l.457). <br>• The anchors reproduce the live values (script). <br>• DV-40 is rejected (URS l.3400) and AC-15.2 replicates 92.2 (l.613). <br>• BR-16 is based on the correction aggregate (l.266). <br>• Follow-ups: R2-02, R2-03, R2-04. |
| AUD-M18-04 | **Closed** | <br>• BR-33 (l.283) defines the stored counter; FN-6.2.4 (URS l.478) and AC-40.3 (l.758) use the observed 2710 values 13 and 4. <br>• DV-41 is rejected (l.3401), and its count of 82 zero rows is correct. <br>• C17 (l.409) and the new XR-18 (l.510) are in place. |
| AUD-M18-05 | **Closed** | <br>• §6.11 I (l.477) maps the live id 2229 once onto anchor 3215, and XR-08 (l.501) drops "must be user 2229". <br>• The remaining 2229 occurrences are inventory hrefs (observations) and SQ-03 only. <br>• Follow-up on the compensation arithmetic: R2-05. |
| AUD-M18-06 | **Closed** | <br>• BR-26 (l.276) describes the stored set with anchors 20 / 6 / 0, the class-based level filter, and labels and icons from % salah using the M08 BR-M08-18 cut-offs (verified: M08 l.276, > 0.70 / ≤ 0.30). <br>• FN-5.3.8 (URS l.458), AC-38.6 / 38.7 and E2E-109 (l.800) match the top-up exactly. <br>• Follow-up: R2-01. |
| AUD-M18-07 | **Closed** | C9 (l.401) is now (a), and the (d) fallback is replaced by escalation at the XL gate. |
| AUD-M18-08 | **Closed** | XR-02 (l.495) names the T4 class pool, gives the arithmetic (4,533 / 4,158 / T4 card 149 unchanged) and cites the top-up class memberships. |
| AUD-M18-09 | **Closed** | <br>• §8.2 (l.591 on) now lists the notes limit, S2 "Pecahan Daerah", the cell / selection / band rules and the CSV columns. <br>• The IC mask has been removed from the list. <br>• URS FN-4.9.1 (l.402) and SRS §7.2 (l.566) have the same columns. |
| AUD-M18-10 | **Closed** | §10 has the S2 officer row (l.646) and the S2 admin / 403 / 404 row (l.647), and S11 now states page `scrollWidth ≤ clientWidth` (l.645). |
| AUD-M18-11 | **Closed** | The top-up capture is cited as the source across the v1.1 changes (URS change log l.20). |
| Top-up Minor (8765 denominators) | **Closed** | C28 (l.419): the filter is class-based. 17 pupils are in classes (the S22 labels give T4 11 / T5 6 / none 4), and the arithmetic holds. |

**Regression scan:**
- No stale v1.0 definition remains (grep for "M04 difficulty", "practice session in the subject", "answer-log split", "last 4", "12:36:44" used as a clock).
- The deviation count adds up to 25 approved + 16 rejected + 1 provisional = 42 (URS l.3404).
- No real name or IC was added (grep with the same name list as round 1: 0 hits).

### New findings (round 2)

| ID | Severity | Doc & section | Issue | Evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M18-R2-01 | Minor | SRS BR-26 (l.276), Q-M18-CRIT (l.384), XR-M18-10 (l.503) | The stored per-question set has no consistent base and no owner request. <br>• BR-26 says the list is a stored set with "INFERRED owner M08 item statistics (XR-M18-10)". <br>• Q-M18-CRIT still names the base "M05 answer log ⋈ M04". <br>• XR-10 is addressed to **M04**, still asks for difficulty "Sukar" (the label is now derived from % salah), and omits 8765's 6 questions. <br>• No request asks M08 (or any owner) to hold the set, which D12 requires. | SRS lines cited; top-up `schools.8765.s30.cards`. | M18 solution-architect | Set Q-M18-CRIT's base to the stored set. Either add an XR to M08 to own the set (anchors KLUANG 20, 8880 20 and its T4 variant, 8765 6, every other school 0) or declare it an M18-owned aggregate like DATA-M18-03/04. In XR-10, add 8765's 6 stems and drop "difficulty Sukar". |
| AUD-M18-R2-02 | Minor | SRS BR-16 (l.266), §6.5 (l.346), §6.11 G (l.473) | BR-16 reads a stored `pupilsWeak` from CorrectionSubject, but: <br>• the §6.5 schema has no `pupilsWeak` field; <br>• §6.11 G gives no weak counts; <br>• 2710's five observed rows are missing: BM, SEJ, Fizik, Geografi and Sains Komputer, each "1/1 pelajar lemah". <br>The field is needed: 8765 SK (56.8 %) and Perniagaan (55.4 %) read 3/3 and 2/2 weak, so "weak" is not "row accuracy < 50 %". | Top-up `schools.{8765,2710,8880}.s22.weakness`; §6.11 G. | M18 solution-architect | Add `pupilsWeak` to CorrectionSubject. Seed the observed weak counts for 8880 (1/1 × 3) and 8765 (all m/m), and add 2710's five rows. |
| AUD-M18-R2-03 | Minor | SRS BR-19 (l.269), URS AC for S5 subject filter | BR-19 says S5 / S8 with `subject_id` show "the cell". Live S5 with `subject_id` 1, 3 and 5 shows SERI KENCANA (2700) as "—", while the heat map shows 2700 BM / MT / SEJ as "0%". So the S5 / S8 per-subject value shows "—" for 0, as the all-subject rule already says. | Top-up `s5BySubject8765` rows (2700 "0 0% — 0 0") and `s6HeatMapRowsWithValues`. | M18 product-analyst | State in BR-19 that S5 / S8 show "—" when the value is 0 or absent, while the heat map shows "0%". Add the 2700 case to an S5 AC / E2E step. |
| AUD-M18-R2-04 | Minor | SRS XR-M18-03 (l.496), BR-19 / Q-M18-ACCSTU "INFERRED owner M05 SubjectMastery" | XR-03 itself notes the problem. If Q-M18-ACCSTU is SubjectMastery, S1's observed "38 catatan … 12 pelajar unik" cannot hold: 8765 has 8 pupils with a level, 2710 has 2, and the "0%" rows need pupils at 2700, 3160 and 8767 (13 > 12). The doc leaves this to M05, although a feasible model already exists: a stored per-pupil subject-accuracy set **separate** from the mastery-level rows. | SRS l.496 open point; top-up `schools.8765.s22.pupilsRanked` (8 levels). | M18 solution-architect (with M05 at the XL batch 3 gate) | Pick the feasible model now, for example "a stored per-pupil × subject accuracy set, owner M05, distinct from SubjectMastery levels; INFERRED". Keep the S1 12-pupil count on the level rows. |
| AUD-M18-R2-05 | Minor | SRS XR-M18-08 (l.501) "M02 compensation" | 3201–3215 become class 516's 15 pupils. By C28, the T4 filter is class-based and 8880's only T4 class is 516, so they are the **15 answering T4 pupils** (S30 T4: 15 pupils · 6,563 answers). That places them inside M11's 8880 "Aktif 31". <br>Displacing 15 generated **non-active** rows ("Belum login 8 + Login sahaja 14") would raise Aktif to 46 and cut the non-active groups to 7, unless the answer histories also move. The 15 displaced rows must instead be Aktif rows whose answers move to 3201–3215. The open point on "answered without login (+0)" also stays. | Round-1 S30 8880 T4; M11 SRS §6.7 row 8880 ("31 · 14 · 8 (+0)"); C28. | M18 solution-architect (decision at the XL batch 3 gate, with M02 / M05 / M11) | Restate the compensation: 15 Aktif generated T4 rows leave 8880, and their answer histories move to 3201–3215, so Aktif 31 / 14 / 8 hold. Keep the login open point for the gate. |

### Routing

M18 v1.1 passes the AUD gate and can go to G1 (user approval). Then:
- Fix R2-01…03 in v1.2 (no re-audit needed; a code-reviewer spot check is enough).
- Raise R2-04 and R2-05 at the XL batch 3 gate together with XR-02, 03, 05, 08 and 18.
