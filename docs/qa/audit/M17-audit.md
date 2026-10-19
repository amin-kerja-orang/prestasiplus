# M17 — Admin Dashboard & Analytics — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M17-admin-dashboard.md` v1.0, `docs/requirements/srs/M17-admin-dashboard.md` v1.0 (incl. §6.5 reconciliation R-01…R-48, §6.8 XR-M17-01…20, §6.10 C-01…C-15) |
| Evidence | Discovery `M17-admin-dashboard.md`; `inventory/M17/*.json` (+ `_summary.md`, `_crawl.json`, `_snapshot-2026-09-26.json`); `img/M17/` (44, spot-checked `laporan-tab-murid.png`, `cc-student-desktop.png`: masked). Live re-walk on 2026-09-26 between about 14:24 and 14:35 MYT (06:24–06:35Z) on browser lane 2 with the admin account, read-only: S1, S2 JSON (`live-data`), S3 page + JSON (today / week / month), S4 8080 and 8082, S6 370, S7 2022, S8 2026 and 2025, S9 8880, S10, S11 (Overview, Murid rows), and the 375 px widths of S2, S4, S8, S11. |
| Safety | A context-level route guard aborted every request that was not GET/HEAD. Before login it let only `POST /login` through; after login that exception was switched off. It was checked twice with probe POSTs (to a non-existent path, and to `/login` after login): both were aborted and never sent. The console log shows only aborted Cloudflare RUM beacons and the two probes. Nothing was submitted, exported or downloaded. "Refresh" (`clear-cache`) was never pressed. No quiz was started and no AI prompt was sent. `?year=abc` was not re-triggered. Page loads were ≥ 400 ms apart. S2 itself was open only for about 2 s (at 375 px); the other `live-data` reads were single GETs. No screenshot was taken. |
| Privacy | Names were masked in the page before each read (numbers and headings only), with one exception: one S11 Overview text read returned the "Pelajar Paling Aktif" names into the auditor's transient tool output. They were not written to any file and appear nowhere in this report. The lane-2 console log of this session held no personal data and was deleted. Scratch scripts are in `<scratchpad>/m17-audit/` and hold no personal data. |
| Cross-module docs | M01 v1.9, M02 v1.11 (§6.15 id policy, isActive 1,432), M04 v1.9 (Q-ACTIVE 129,389, Q-DIFFICULTY, 466,041 = 465,278 + 763, Q-CONTRIB), M05 v1.8 (§6.14: 478,499, Q-ANS-CORRECT 381,842 PROPOSED), M07 v1.5 (PKSK split 190/191/191/191 designed, XL-31), M08 v1.7 (79.8 %), M10 v1.6, M11 v1.8 (§6.7 weekly cells, re-summed by script), M12 v1.1 (Q-M12-T1 336 · 4.6 · 8.3; XR-M12-09; Q-M12-CORRECT 253,478 / 306,133), M14 v1.1 (single project clock §6.11.1; teacher wallets 9; BR-M14-28), architecture overview §6.12, ADR-0006, precedent audits M12, M14, XL M08–M11 |
| Auditor | independent audit agent (not an author) |
| Scripts | `<scratchpad>/m17-audit/acc.cjs` (accuracy from S8 subjects), `trace.cjs` (coverage + traceability), `inv3.cjs` (inventory text match), `cells.cjs` (M11 weekly cells), `sums.cjs` (figure arithmetic) |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 8 |
| Info | 4 |

What is good:
- **Coverage is complete (script re-run).**
  - The matrix has 2,084 rows: S1 87, S2 108, S3 376, S4 29, S5 27, S6 31, S7 86, S8 327, S9 113, S10 494, S11 173 and SHA 233. These equal the inventory totals.
  - 1,851 M17 content elements are mapped, 24 SHA elements are mapped and 209 are excluded with an owner. 0 are unmapped and there are no duplicates.
  - All 2,084 inventory texts appear in their matrix rows, and every status matches.
  - 131 FNs are defined, 112 of them in the matrix. No row cites an unknown FN.
- **Traceability is clean (script).**
  - Counts: 131 FN, 122 AC, 100 FR, 99 E2E (16 provisional).
  - There is no FN without an FR, no FR citing an unknown FN, no AC without an FR or an E2E, and no FR without an E2E.
- **Live values are exact.** 60+ live claims were re-checked and match (list under "Live verification"). The live figures have not moved since the 12:33 snapshot, except the S8/S9 footer (AUD-M17-02).
- **The reconciliation arithmetic holds (script).**
  - S8 months Σ = 477,888 and S8 subjects Σ = 477,888.
  - 2,448 + 145 + 60 = 2,653, and the M11 cells re-summed give M31 7,571 and M32 2,448.
  - Per-school M11 cells + extension, then the P adjustments, give exactly 8082 130,308 − 231 = 130,077 and 8080 53,494 − 83 + 20 = 53,431.
  - S10: Q-ACTIVE 129,389 − Σ excluded 1,746 (518+641+305+145+40+37+23+22+10+3+2) = 127,643. This equals the live matrix column sum, and the live difficulty tiles are 38,968 / 46,154 / 32,987 / 9,534.
  - Q-DIFFICULTY − tiles = 726 / 984 / 733 / 66. This forces the PKSK split to have ≤ 66 at difficulty 4, so XR-M17-10 is justified: M07's split is a designed value (XL-31), not an observation.
  - Status: 128,006 + 400 = 127,643 + 763.
  - S1 DCs: +3,590 and +4,236 over M04, as stated.
  - Users: 1,381 + 49 + 2 = 1,432; 1,708 + 1,444 = 3,152; 269 + 233 = 502; 289 + 262 = 551; 1,642 − 1,563 = 79.
  - Logins: 25+3+1+2 = 31 and 84+4+1+1+5 = 95.
  - Ratios: 49.6 % = 1,563 ÷ 3,152; 305.8 = 477,888 ÷ 1,563; week change −65 with either 7,556 or 7,571.
  - S11 trends: 344 / 1,428 / 5,939 re-summed from the live chart.
  - S8 top-5 engagement = active ÷ daftar in all five rows. 8880 "2192 soalan/pelajar" = round(72,332 ÷ 33), and its trend Σ = 72,332. T4 = mean(2.5, 2.8, 2.9, 3.0, 3.2) = 2.88.
- **D9 fixes are minimal and evidenced.** Each DV row records alternatives, and all 27 were re-checked (below). The five rejections (07, 12, 15, 23, 24) are sound replications.
- **Privacy is respected.**
  - No real person's name appears in the URS, SRS, discovery narrative or inventory. A grep for name patterns (BIN/BINTI/Bt/Bte/A/L/A/P, honorific + name) and for the names seen live found none.
  - Seeds use "Murid Demo 2022" and "Cikgu Demo 1919". The sampled screenshots are masked.
- **Responsive and security are covered.** SRS §10 specifies each screen at 1280 / 768 / 375. The 375 overflows behind DV-01..04 were re-measured live (see below). SEC-M17-01…12 cover exports, the cache POST, `?year`, IDOR on drill-downs, XSS in the feed, PII in polls, e-mails in the S11 HTML, mood reasons, echoed `period`, the server widget and monitoring exports.

Why it fails (2 Major):
1. **A second, module-private clock (AUD-M17-01).** M17 states every value at 2026-09-26 12:33 and seeds owner rows and logins after the project clock of 2026-09-25 15:40. The Delivery Lead enforced that single clock for every module and build (M14 AUD-03). In the demo build, the M17 seed puts future-dated rows into the owners' stores and counts logins that have not happened yet.
2. **The executive-report footer is modelled as a persistent cache, but live regenerates it every minute (AUD-M17-02).** Without any Refresh, live showed 04:26, then 04:33, then 06:26, 06:27, 06:27 and 06:28 UTC, each equal to the minute of the request. The SRS seeds a fixed `generatedAt` of 12:26 (which is itself after the project clock) and asserts "12:26 PM" in 4 ACs/E2E.

---

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M17-01 | **Major** | URS §0 "Mock clock"; SRS §6.4 heading ("Values … at 2026-09-26T12:33"), §6.5 R-01 / R-07 / R-19 / R-20 / R-41 / R-45, §6.6, §6.8 XR-M17-01 and XR-M17-07 (`lastLoginAt` after the anchor), §6.2 seed `generatedAt` 26/09 12:26, §12 intro (`mockInit.now` = 12:33), every E2E that reads a period figure | **The M17 clock contradicts the single project clock.** R-01 is labelled (b) "snapshot-time difference", but it does not apply (b). It creates a module-private clock and asks M05, M02 and M01 to seed rows dated between 25/09 15:40 and 26/09 12:33: 145 segment answers with their sessions, the admin login 26/09 12:09, a pupil login 26/09 10:08 and a pupil login 25/09 23:29. The demo build boots at 25/09 15:40 (architecture §6.12, ADR-0006), and SRS §6.6 says only that "M17 screens then show the values computed at that time". Those values are never stated. They are also incoherent at that time: <br>• §6.6 counts a `lastLoginAt` later than now as "ever logged in" (S11 "Murid Pernah Login", M11), so the demo counts logins that have not happened; <br>• the S8/S9 footer seed (26/09 12:26) is in the future; <br>• DV-M17-27's live feed ("ENGKU HUSAIN answers at 11:32") and the S3 "today" anchors (60 answers, heatmap 11:00, 1 pupil, 11 GURU) are future rows; <br>• 8082's "today" becomes whatever falls on 25/09. <br>The Delivery Lead has already ruled on this pattern: M14 AUD-M14-03 → "one project clock `2026-09-25T15:40:00+08:00` for every module and build" (M14 SRS §6.11.1, TRACKER 2026-09-26). C-01 proves that the observed week figure cannot hold at the anchor. That is a real (b) difference to record, not a reason for a second clock. | M14 SRS L436/L587 (single clock, the 10 post-clock rows "not seeded"); TRACKER log "single project clock 2026-09-25 15:40 enforced for all builds"; SRS §6.6 L427–429; C-01 (2,508 < 2,653). | M17 solution-architect (+ product-analyst for URS §0 and the ACs); XL batch for the withdrawn owner requests | Apply the M14 treatment and classify the time differences as (b) for real. <br>1. **One clock.** Every M17 value, seed and E2E uses 2026-09-25T15:40:00+08:00. Delete the M17 clock from URS §0, SRS §6.4/§6.6 and §12. <br>2. **No post-clock rows.** Withdraw XR-M17-01 (the 145 extension answers and sessions). Record them, and the 12:33 values that depend on them, in SRS §6.6 as "observed later, not seeded". Post-anchor logins are not seeded either: the users concerned keep an earlier generated `lastLoginAt` before the clock (M14 slot precedent), so the "ever logged in" counts 1,708 / 269 / 289 stay. <br>3. **Restate the period figures at the project clock** as (b) values computed from the owners' datasets, and state them in §6.4/§6.7: all-time answers (477,888 − 145 = 477,743 if the extension was all P), 1,563 engaged (re-check that no pupil is engaged only through the extension), accuracy, "today" (25/09), the week to 25/09 15:40 (C-01: 2,448 + the ≤ 60 other-segment answers before the clock), the month, the logins per period, the top pupils per period, the heatmap, the live feed (DV-27 = the latest answers before 15:40), S11 7/30/90-day windows (ending 25/09) and the M11 consequences of R-45 (which disappear). <br>4. Keep the 12:33 observations in the snapshot as the fidelity record, as M14 did. At 25/09 15:40 live would itself have shown the earlier values. <br>5. Restate every affected AC/E2E and name the clock on each. Alternative (only if the Delivery Lead reopens the decision): move the project clock to ≥ 26/09 12:33 for **all** modules. Not recommended: it was rejected for M14. |
| AUD-M17-02 | **Major** | SRS §6.2 DATA-M17-01 (seed `generatedAt` 12:26, "Refresh replaces the entry"), BR-M17-18, BR-M17-31, FR-M17-63, E2E-M17-72, E2E-M17-98; URS FN-M17-6.1.2, FN-6.3.10, FN-6.4.6, AC-M17-24.3, AC-27.5, AC-28.3, OQ-M17-05; SEC-M17-11 | **The footer is not a stored build time.** Live regenerates the executive report, or shows its build time, at the request minute. Nobody pressed Refresh (discovery and this audit both certify that), yet the footer read 04:26Z at discovery, 04:33Z in the snapshot, then 06:26Z, 06:27Z, 06:27Z and 06:28Z on six loads in this audit. Each equals the server minute of the request (`live-data.generated_at` fetched on the same loads: 06:27:15, 06:27:15, 06:28:10). S9 8880 also read 06:26Z. So a fixed seeded `generatedAt` (12:26) with "rebuilt only by Refresh" is a behaviour live does not have. It is also a future time at the project clock (AUD-M17-01). AC-24.3 / E2E-72 (footer 12:26 before Refresh, 12:33 after) and AC-27.5 / AC-28.3 / E2E-98 ("12:26 PM") would assert non-live behaviour. SEC-M17-11 ("stale data … beyond the footer time") is not supported by the evidence. | Live 2026-09-26 06:26–06:28Z (above); snapshot `S8_eksekutif.default` footer "04:33 AM", discovery §2.8 "04:26 AM". | M17 solution-architect + product-analyst | Model the footer as the time the report was built, where live's build happens on each request (or behind a cache of at most about 60 s, INFERRED; the exact TTL is UNVERIFIED). <br>• Drop the seeded cache entry. Either set `generatedAt` = the request time rounded to the minute, or keep DATA-M17-01 with a TTL ≤ 60 s. <br>• Refresh still POSTs and reloads. Its observable effect is only that the footer shows the current minute (INFERRED, provisional). <br>• Restate AC-24.3, AC-27.5, AC-28.3, E2E-72 and E2E-98 at the project clock, e.g. "25 Sep 2026, 03:40 PM" (MYT, DV-06). <br>• Correct FN-6.3.10 / 6.4.6 and SEC-M17-11. <br>• Keep the observed UTC readings in the matrix as evidence of DV-06. |
| AUD-M17-03 | Minor | SRS §6.5 R-06, §6.10 C-03, XR-M17-03; URS OQ-M17-02 | **The accuracy conflict is real, and observed data settles it. It is not a question for the user.** An "active pupils only" definition cannot explain 82.9 %. P is already the active pupils, and a subset of 477,888 answers cannot hold ≥ 395,931 correct when the whole log holds ≤ 381,987 (381,842 + 145). Independent live evidence that the SRS does not use confirms 82.9 % as correct ÷ answered. The 26 S8 subject rows (accuracy × answers, Σ answers exactly 477,888) give 395,762–396,240 correct = **82.86 %**, which overlaps the 82.9 % band (395,931–396,408). The S3 JSON `correct_answers` (57/60, 2,249/2,653, 17,794/20,351) do the same per period. M05's 381,842 is itself PROPOSED, derived by assuming M08's observed "79.8 %" is correct ÷ answered over 478,499. That assumption is what the evidence refutes. M08's 79.8 % must have another definition (e.g. the mean of session accuracies) or be an M08 display constant. The finding is Minor for M17: M17's side is right. It blocks only the owners' fix in XL. | `acc.cjs` on snapshot `S8_eksekutif.default.leaves` 398–449; live S3 JSON (this audit); M05 SRS L515/L535 ("PROPOSED: round(0.798 × 478,499)"); M12 Q-M12-CORRECT 253,478 / 306,133 is compatible (82.8 % on its own scope). | M17 solution-architect (evidence); M05 + M08 in the XL batch (fix) | Add the subject-weighted evidence to R-06 / C-03. Restate OQ-M17-02 as an owner fix, not an open question: M05 raises Q-ANS-CORRECT to a value that gives Q-M17-ACC(all) = 82.9 % at the project clock (≈ 396,000 correct among P's answers). M08 re-defines "Purata Ketepatan 79.8 %" (recommended Q-SESS-ACC-MEAN, to be checked against M08's observed figures) or declares it a display constant. XR-M17-03 stays as written. |
| AUD-M17-04 | Minor | SRS §6.5 R-23, §6.10 C-12, XR-M17-06 | **Observed per-school answer totals in `live-data` are not reconciled.** `top_schools` also carries 8078 **88,255**, 8106 **59,086** and 8090 **120,623** (re-observed live; also listed in discovery §5.1 L335). These are the S4 "Soalan Dijawab" of those schools. R-23 reconciles only the engaged counts of 8078, 8106 and 8090. With the XR-M17-06 pins as written, the queries give: <br>• 8106: M11 cells + extension 59,211 + 60 = 59,271, plus a lower-grade pupil, so ≥ 59,271 ≠ 59,086; <br>• 8090: 120,782 plus "1 extra", so ≥ 120,782 ≠ 120,623; <br>• 8078 needs its 4 inactive answering pupils to hold exactly 723 answers (88,978 − 88,255), which is not stated. | Live `live-data` 06:25Z; `cells.cjs` on M11 §6.7. | M17 solution-architect | Add these three pairs to R-23 and C-12. Complete XR-M17-06: <br>• 8106: e.g. 1 inactive answering T4/T5 pupil + 2 answering lower-grade pupils, keeping engaged 307, with answers netting −185; <br>• 8090: 1 inactive answering pupil + 1 answering extra, keeping 134, netting −159; <br>• 8078: inactive answers = 723. <br>Alternatively, record them explicitly as (b) with the reason. |
| AUD-M17-05 | Minor | SRS §6.5 R-31, R-32 (and R-11 teacher totals), XR-M17-08; URS §7 intro ("the **only** intended differences"), OQ-M17-09 | **Visible live values are changed without a deviation row, under the wrong category.** "Sekolah (61)" → 57 and "Tidak Aktif (52)" → 48, several per-school teacher totals (8080/8078 +1, 8106/8102 +2) and the 8106 login count (358 → 355) are observed, working values. R-31/R-32 label them (b) "snapshot-time difference", but they are conflicts with M11's pinned teacher table, not time differences. URS §7 claims to list every intended difference, and these are not in it. XR-M17-08, which would restore 61, is only "optional". | Live S11 tabs re-read: "Sekolah (61)", "Semua (61)", "Aktif (9)", "Kurang (0)", "Tidak Aktif (52)". | M17 solution-architect + product-analyst; M02 / M11 in XL | Pursue XR-M17-08 in the XL batch as the preferred path, since it restores the observed values. If M11 rejects it, record each changed value as a deviation (category "cross-module constraint") in URS §7 with its alternatives, relabel R-31/R-32 as that category (not (b)), and keep OQ-M17-09 for the G1 report. |
| AUD-M17-06 | Minor | URS FN-M17-6.2.2; SRS §6.3 DC-M17-04 | **DC-M17-04 is not scoped to 2026 in the function.** FN-6.2.2 prints "{DC-M17-04}% selepas pembetulan" for every year. Live 2025 shows "Ketepatan 0%" / "**0% selepas pembetulan**" (re-observed). The SRS table says "(2026)", but no FR/BR states what other years show. | Live `?year=2025` (this audit); snapshot `S8_eksekutif.2025/2027`. | M17 product-analyst | State it in FN-6.2.2 / BR-M17-18: DC-M17-04 for 2026 only. A year without answers shows "0%" (observed). A year with answers other than 2026 does not occur at the seed (INFERRED: 0 %). Add one E2E assertion on 2025. |
| AUD-M17-07 | Minor | SRS §6.3 column "Beside a contradicting computed figure?" for DC-M17-04 and DC-M17-05 | **The D11 answers are too thin for two constants.** DC-04 (82.8 % "selepas pembetulan") sits in the same S8 card as the computed 82.9 %. DC-05 drives the S2 AI sentence "3.6% pelajar terlibat aktif" = (29+11+43) ÷ 2,315, shown on the same screen as the computed "1,563 aktif menjawab" of 3,152 (49.6 %). Neither is a proven contradiction, since the definitions differ, but the table says only "another quantity" / "no bucket population". | Live S8 KPI and S2 AI sentence (re-observed). | M17 solution-architect | Give the reasoning. <br>• DC-04: a post-correction accuracy that includes correction attempts in the denominator can be lower than the raw accuracy, so it is not contradictory. <br>• DC-05's 3.6 %: "terlibat aktif" = the engaged tiers of the bucket population ≠ "aktif menjawab" = ≥ 1 answer; replicated as on live (DV-24 rejected). <br>List the AI ratio explicitly as derived from DC-M17-05 in FN-3.3.3. |
| AUD-M17-08 | Minor | URS §9 OQ-M17-08 vs SRS §8.2 | **The PROPOSED lists disagree.** URS OQ-M17-08 omits: <br>• "Perlu tindakan" (S1 sponsor sub-line, SRS FR-M17-14 / §8.2); <br>• "Julat tarikh tidak sah." (§5 / §8.2); <br>• the PROPOSED per-day placement of structured / battle / game activities in the S11 series (§6.7 E); <br>• the new "Kuiz Objektif" value 1,406 / 341 / 4,915 introduced by DV-16. <br>SRS §8.2 omits the Refresh behaviour that the URS lists. | grep "PROPOSED" in both docs. | M17 product-analyst | Make both lists identical and complete, so the G1 report shows every PROPOSED item. |
| AUD-M17-09 | Minor | SRS §12 E2E-M17-02 ("375 only"), E2E-M17-04 ("1280 only") | CLAUDE.md §7 and the M14 precedent require every scenario to run on all three sizes, with width-specific steps named inside. E2E-02 (bottom nav / drawer) and E2E-04 (active sidebar item) are restricted to one size. | SRS L633, E2E-04 row (`trace.cjs`). | M17 product-analyst | Run both on 375 / 768 / 1280, and state the expected shell per width (drawer at 375; the `design/shells.md` behaviour at 768; sidebar at 1280). |
| AUD-M17-10 | Minor | SRS §6.8 XR-M17-14, XR-M17-20 | **Two owner requests do not state what the owners must keep.** M14 materialises 9 teacher wallets (1, 5, 4201–4208), and S22 "Papan Pendahulu Guru" shows a teacher's "Syiling" (0 without a wallet) and orders by `questionsCount` (BR-M14-28). Giving the active teachers Σ balance 63,459 (XR-14) and adding generated `createdBy` contributions Σ 11,414 (XR-20) can change observed S22 rows and M14 `questionsCount`. | M14 SRS L434, L447, BR-M14-28, #17. | M17 solution-architect; M14 / M04 in XL | Add the constraint to both requests: M14 S22 (both tabs) and the teacher-wallet anchors keep their observed values. The new balances and contributions go only to teachers outside the observed S22 top rows, or the XL reviewer checks that the observed rows are unchanged. |
| AUD-M17-I1 | Info | — | Coverage and traceability re-run clean (figures above). | `trace.cjs`, `inv3.cjs` | — | — |
| AUD-M17-I2 | Info | SRS §6.10 | Every C-01…C-15 arithmetic claim that was re-run holds (list under "What is good"). | `sums.cjs`, `cells.cjs` | — | — |
| AUD-M17-I3 | Info | URS §7 | The M11 cell total re-summed from M11 §6.7 is 472,359, and 8880 sums to 10,196, against M11's stated 472,371 and 10,208. The 12-answer gap is in M11's table text (likely a cell outside M1–M32, or a parse artefact). This does not change any M17 figure, but it is worth a look at the next M11 touch. | `cells.cjs` | M11 (optional) | Check the 8880 row of M11 §6.7. |
| AUD-M17-I4 | Info | SRS §6.8 XR-M17-07 | The PROPOSED user-id block 2013–2021 / 2023–2060 is clear of the M11 8080 anchors 2001–2011 and of the M02 fixture blocks (5001–5999, 3001–3008, 3201–3215, 3105–3109). | M02 SRS L547 | — | — |

---

## Clock assessment (task 2)

- **Is a per-module clock consistent with the single project clock?** No.
  - The Delivery Lead's M14 ruling (one clock, 2026-09-25T15:40:00+08:00, for every module and build; post-clock observed rows are not seeded) applies directly.
  - Architecture §6.12 lets a suite pick a *time of day* (M06/M07 10:00 on 25/09). It does not let a suite seed owner rows after the project clock.
  - M17's R-01 needs exactly such rows (XR-M17-01, post-anchor `lastLoginAt`, cache 26/09 12:26).
- **Classification:** Major (AUD-M17-01).
- **Proposed fix:**
  - Derive the M17 figures at the project clock and treat every snapshot-time difference as a genuine **(b)**: values computed at 15:40 on 25/09, with the 12:33 readings kept as the observed record.
  - Keep the "ever" counts by giving post-anchor login users an earlier generated `lastLoginAt`.
  - Withdraw XR-M17-01.
  - None of the (d) constants depends on the clock, so DC-M17-01…07 are unaffected.

## Accuracy assessment (task 2)

- **Is it truly blocking?** Yes, for the owners (M05/M08), but not for M17.
- **Can "active pupils only" explain it?** No. A subset cannot have more correct answers than the whole log.
- **Where does the different definition sit?** On M08's side. 82.9 % is correct ÷ answered over P's 477,888 answers, and the S8 subject rows alone reproduce it (82.86 %). M05's 381,842 was derived from M08's 79.8 % under the assumption that it is also correct ÷ answered, and that assumption is false.
- **Action:** route XR-M17-03 as a mandatory owner fix in XL (AUD-M17-03). No user decision is needed.

## Display constants vs D11 (task 2)

None of the seven constants is shown beside a *contradicting* computed figure:

| Constant | Where shown | Why it does not contradict |
|---|---|---|
| DC-01 / DC-02 | S1 only | S10's 128,006 / 400 are on another page (DV-23 rejected) |
| DC-03 | S2 | S2 has no computed correction figure |
| DC-04 | S8, same card as 82.9 % | Plausibly another quantity; the reasoning should be stated (AUD-07) |
| DC-05 | S2 buckets and the AI 3.6 % | Different definition from "aktif menjawab"; the reasoning should be stated (AUD-07) |
| DC-06 | S11 | No computed score on S11 |
| DC-07 | S8 | The S8 per-school rows are self-consistent (active ÷ computed daftar = the shown engagement in all 5 top rows). The top-5 Σ (275,889 answers, 771 active) stays below the computed platform totals (477,888, 1,563) |

- The S2/S4 vs S8/S9 per-school differences are on different screens and follow live (DV-15 rejected).
- DC-04 needs its year scope (AUD-06).

## Live verification (task 1) — re-observed 2026-09-26 06:24–06:35Z

- **S1:**
  - Soalan Aktif 130,152; "Minggu ini: 0"; Diluluskan 150,683; "Aktif digunakan: 129,752".
  - Menunggu Review 0; Draf 0; 31; 11; Pengguna 5,159.
  - Penaja 6 / 0 / 0 / 6; distribution 0 / 0 / 150,683 / 0 / 323,184.
  - 10 "Diluluskan" rows.
- **S2 `live-data`** (identical to the snapshot):
  - Totals: 9; 3,152; 1,563; 477,888; 60; 2,653; 7,556; −65; 82.9; gps 4.47; T1 4.7 (336); T2 82.9; T3 91; T4 2.880.
  - Engagement 29 / 11 / 43 / 3 / 2,229 (Σ 2,315); mood 307 / 280 / 72 / 91; correction 899 / 0.0 / 0 / no improvers.
  - Top schools 8082 392, 8078 341, 8106 307, 8080 175, 8090 134; top pupils 452 / 99.6 … 160 / 73.8.
  - Feed: 10 rows at 8087 "20:16".
- **S3 JSON:**
  - Today: 2 logins; 60 / 57 / 95; 1 pupil; 3/3 sessions · 60 s; 8082 1 · 60 · 95.0 · 11 GURU; heat {3: 60}; subjects [] and feed [].
  - Week: 31 logins (25/3/1/2); 2,653 / 2,249 / 84.8; 32 pupils; 160/160 · 166 s; missions 3.
  - The 10 week school rows match SRS §6.7 B exactly; month rows 8106 23 · 5,479 · 82.9 … match.
  - Month: 95 logins (84/4/1/1/5); 20,351 / 17,794 / 87.4; 86 pupils; 1,258 · 114 s; missions 8; top pupils 3,637 / 92.6 … 1,179 / 87.9.
  - `total_schools` 9 (DV-13). The login label stays "Login Hari Ini" on the week tab (DV-10).
- **S4:**
  - 8080: 185 / 175 / 53,431 / 81.7 %, "Senarai Guru (34)", all 0 classes (DV-22).
  - 8082: 549 / 392 / 130,077 / 82.3 %, "(68)", classes 44/45/43 pupils.
- **S6 370:** "5 PERNIAGAAN", T5, 30 pupils, row 1 2,378 · 93.5 % · "25/09 01:22" (UTC; MYT 09:22, DV-06), rows 2–14 as SRS §6.7 C.
- **S7 2022:**
  - 2,378 · 93.5 % · 15 · 1 · 27 %; "Latihan Bebas" 2223/2378.
  - Weeks …0 · 1166 (14/09) · 452 (21/09); headcount 16/06/2026 with TOV 40.00.
- **S8 2026:**
  - KPIs: 57; 3,152; "1,563 aktif 2026"; 49.6 %; 477,888; 82.9 % / "82.8% selepas pembetulan"; 502; 305.8; TINGGI KLUANG; Jun.
  - Months 5 … 20,351 with 3p … 86p; only "← 2025" (DV-14).
  - Tail: Kirkpatrick 336 · 4.6 /5 · 8.3; "GPS 2.88 · 5 subjek · 150 calon"; tuition 18 / 0.
  - Refresh is a POST form to `/admin/laporan-eksekutif/clear-cache` (not sent).
  - Five "Fokus" links (8880, 8106, 8078, 8082, 8102). Footer: AUD-02.
- **S8 2025:** "← 2024"; 0 aktif; 0 %; 0; "0% selepas pembetulan"; "Sekolah Paling Aktif" BANDAR BARU BANGI with "★ Paling Aktif" (DV-14).
- **S9 8880:**
  - 55.9 % · "33 aktif / 59 daftar" · 72,332 · "2192 soalan/pelajar" · 89.8 % · 9/12.
  - Trend 1 · 729 · 1,148 · 1,056 · 16,200 · 52,059 · 1,074 · 30 · 35.
  - Strongest "Pendidikan Al-Quran & As-Sunnah 100.0% (35 soalan)", weakest "Kimia 64.1% (744 soalan)".
  - Headcount Matematik 41 · 61.3 · 73.4 · +12.2 (AC-28.3) … Fizik 16 · 48.5 · 65.4 · +16.9.
- **S10:**
  - Imports 1,123 / 0 / 0 / 31,101; status 0 / 0 / 128,006 (99.7 %) / 0 / 400 (0.3 %).
  - Content 5 · 72/0 · 10.
  - Matrix: 31 rows; column sums D1 11,387 … T5 19,217; JUMLAH 127,643.
  - Difficulty tiles Σ 38,968 / 46,154 / 32,987 / 9,534 / 0; "Status Kurikulum" BM 84 bab …
- **S11:**
  - Overview: 1,708 / 3,152 · 1,444; 269 / 502 · 233; 1,642 / 3,152; 3,522; 44.6 % · "Struktur: 6.7%"; Pecahan 0 / 13 / 4 / 5; activity counts 923, 38, 23, 22, 21, 19, 19, 18, 16.
  - 30-day series identical to §6.7 E.
  - Tabs: (61) / (551) / (4,533); pills 61 / 9 / 0 / 52 / 289 / 262 (DV-16, DV-17).
  - Murid rows 101.2 % and 101.4 % present (DV-19).
- **375 px:**
  - S2: body 565 px clipped, `overflow-x: hidden` (DV-01).
  - S4 8082: 554 px (DV-02); S8: 525 px (DV-03); S11: 388 px (DV-04).
- **Deviations re-verified live:** DV-01, 02, 03, 04, 06, 07, 08, 09, 10, 11, 12 (active_teachers 0 vs 11 GURU), 13, 14, 15 (130,077 vs 49,813), 16, 17, 19, 21 (label), 22, 23, 24, 27.
- **Deviations not re-triggered:** DV-05 (`?year=abc`, forbidden), DV-18 (empty pills; screenshot evidence), DV-20 (same as 17), DV-25 (font sizes; discovery measurement), DV-26 (script; no visible effect).

## Re-audit checklist (round 2)

1. AUD-01: no value, seed or E2E stated at 26/09 12:33. XR-M17-01 withdrawn. §6.4/§6.7 restated at 25/09 15:40 with (b) records. "Ever logged in" counts kept by earlier `lastLoginAt`.
2. AUD-02: footer = build time at the request minute. No seeded `generatedAt`. AC/E2E restated.
3. AUD-03…10 as in the table.

---

# Round 2 — audit of URS / SRS v1.1

| Field | Value |
|---|---|
| Documents audited | `urs/M17-admin-dashboard.md` v1.1, `srs/M17-admin-dashboard.md` v1.1 |
| Mode | Doc-only. No fix needed a new live reading: the round-1 live readings, the snapshot and the S3/S11 JSON cover everything. Lane 2 was not opened. |
| Scripts | `<scratchpad>/m17-audit/trace.cjs`, `inv3.cjs` (re-run) and `r2.cjs` (new). `r2.cjs` independently recomputes the anchor figures, the C-12 infeasibility, the accuracy band and the today design. The writer's `anchor.cjs` was read and its logic reproduced in `r2.cjs`; it was not executed. |

## Verdict round 2: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 2 |
| Info | 2 |

### Re-checks that pass

- **Coverage and traceability** are unchanged and clean:
  - 2,084/2,084 elements in the matrix; 0 unmapped, 0 duplicates, all texts and statuses match;
  - 131 FN, 122 AC, 100 FR, 99 E2E (16 provisional);
  - no orphan in any direction;
  - every E2E now runs at 375, 768 and 1280.
- **The anchor restatement reproduces.**
  - All-time answers: 477,888 − 145 = 477,743.
  - Week: 2,653 − 145 = 2,508 = M32 2,448 + 60.
  - Month: 20,351 − 145 = 20,206.
  - Week change: (2,508 − 7,571) ÷ 7,571 = −67 %.
  - Depth 305.7. S8 Sep bar 20,206.
  - S11 windows ending 25/09: 7 days 423, 30 days 1,431, 90 days 5,931 (the 28/06 point is PROPOSED 0 and listed).
  - Non-P answers: 756 = 333 + 414 inactive-segment + 9 generated.
  - No E2E and no unqualified AC still asserts a 12:33 value. Every 12:33 figure is quoted as "live … at 12:33".
- **AUD-04 infeasibility proof re-run (`r2.cjs`): correct.**
  - Holding all five live totals needs P's other-segment answers = 477,743 − 472,371 + 1,361 = 6,733. M05 has only 5,795 generated rows (478,499 − 472,371 − 333), so it is impossible.
  - The net reductions are 8078 723, 8106 185, 8090 159, 8082 231 and 8080 63.
  - The inactive-segment budget is 423.
  - The writer's choice is also optimal. Only two schools can be exact:
    - {8082, 8080} uses I = 314;
    - the only three-school candidate, {8080, 8090, 8106}, needs I ≥ 83 + 187 + 160 = 430 > 423 once the engaged counts 175 / 307 / 134 are kept;
    - 8078 alone needs ≥ 723.
  - Keeping the two schools whose S4 pages were observed on screen is the right priority.
  - Engaged counts still hold: 8078 345 − 4 = 341; 8106 306 − 1 + 2 = 307; 8090 134 − 1 + 1 = 134.
- **The computed 8078 / 8106 / 8090 totals are not shown beside a contradicting observed figure.**
  - The values are 88,888 / 59,216 / 120,782.
  - They appear only on the S4 pages of those schools, which were never observed on screen.
  - S2 "Top Sekolah" shows only "{n} plj", which is exact. S3 shows week/month figures, which are exact. S8/S9 show DC-M17-07, and M11 monitoring shows M11's own segment figures; both are other screens with other definitions.
  - No E2E asserts these three values.
- **Round-1 fixes verified in the text:**

  | Finding | Status | What was verified |
  |---|---|---|
  | AUD-02 | Closed | Footer = request minute; ≤ 60 s cache INFERRED; E2E-72/98 at "03:40 PM"; OQ-05 rewritten. |
  | AUD-03 | Closed | Evidence in R-06/C-03/OQ-02; XR-M17-03 mandatory. See R2-03 for the band. |
  | AUD-04 | Closed | R-23 and C-12 as above. |
  | AUD-05 | Closed | DV-M17-28 with the alternatives; XR-M17-08 preferred; AC-32.1 flags "live 61". |
  | AUD-06 | Closed | FN-6.2.2 and DC-04 scoped to 2026; "0%" for a year without answers. |
  | AUD-07 | Closed | Reasoning for DC-04/05 added. |
  | AUD-08 | Closed | One 11-item list in both docs. |
  | AUD-09 | Closed | E2E-02/04 run at all three sizes with per-width steps. |
  | AUD-10 | Closed | XR-14/20 now protect M14 S22 and the wallet anchors, and M04 Q-CONTRIB of users 1 and 5. |
  | AUD-01 | Partly closed | The single clock is applied throughout, and XR-M17-01 is withdrawn. The residual issues are R2-01 and R2-02. |

### Findings round 2

| ID | Severity | Doc & section | Issue | Evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| R2-01 | **Major** | SRS §6.7 B ("today" at the clock), §6.4 today values; URS AC-M17-15.1 and the S3 today / heatmap / live-feed ACs; E2E reading S3 "Hari Ini" and the week/month top pupils | **The PROPOSED placement of the 16 "today" sessions contradicts the observed record and the doc's own anchor lists.** Two problems: <br>• **8082.** The 8 sessions are given to "the 8082 pupil with the post-clock answers", i.e. the 405-answer week / 2,968-answer month pupil. They carry 135 correct of 160 (25 wrong). But the same pupil's figures at the clock are week 330 · 99.7 % (329 correct: at most 1 wrong) and month 2,893 · 99.2 % (24 wrong). 25 wrong answers today cannot sit inside a week with 1 wrong. The S3 today row and the week/month top-pupil rows cannot all be produced by one dataset. <br>• **8106.** The 8 sessions are given to "the 8106 pupil with the most month answers", the 1,761-month pupil. That pupil also carries 60 post-clock answers, so their week at 12:33 would be ≥ 160 + 60 = 220. The observed 12:33 week top five (452, 405, 234, 200, 160) has no 8106 pupil. The anchor state plus the post-clock record would therefore not reproduce the observation. At the clock, the doc's own week top list (452, 330, 234, 200, 160) also omits this pupil, whose week is ≥ 160. The "GURU today 8082 11" and the live feed (the 8082 session ending 14:59) inherit the problem. | `r2.cjs`: pupil week at the clock 330 / 329 correct vs 25 wrong today; month wrong 24 < 25; 8106 week ≥ 220 at 12:33. Snapshot `S3_dailyActivity.week.data.top_students` (schools: 8080, 8082 ×4). | M17 solution-architect (+ product-analyst for the ACs) | Re-place the 25 Sep sessions so that the anchor state plus the post-clock record reproduce every observed 12:33 list. <br>• **8082:** use the week pupil with 160 · 73.8 %. Their whole week can be exactly the 8 sessions of today (118 correct), or use another pupil whose week and month accuracies allow the wrong answers. <br>• **8106:** split the 160 answers among ≥ 2 pupils whose week total stays below 160 even at 12:33 (the 1,761 pupil's pre-clock week ≤ 99), or reduce the answers per session. <br>Re-derive the today totals, accuracy, heatmap, live feed, "{n} GURU", and the week/month top lists at the clock. Check that the post-clock pupils still have pre-clock week activity, so week engaged stays 32. Keep all of it PROPOSED (OQ-08 item 11). Add a check to the script: clock state + post-clock record = the observed 12:33 top lists, school rows and totals. |
| R2-02 | Minor | SRS §6.6 (login shift), §6.4 Q-M17-LOGINS ("equal to live"), §6.7 E ("the 200 rows of `…tabs.murid.rows`"), XR-M17-07; URS change log, AC on the S3 login list | **The 24 h login shift changes observed login dates and rests on an unstated placement.** <br>• S11 Murid "Login Terakhir" shows **25/09/2026** for pupils of 8106 (row 64), 8080 (row 55), 8082 (row 5 or 33) and 8078 (row 29, 34 or 158). The shifted pupils among them would show **24/09/2026**. The teacher row with "25/09/2026 13:26" (the 8090 teacher) would move to 24/09. This contradicts §6.7 E, which seeds the 200 rows "as observed". Row 35 "26/09/2026" must change in any case. <br>• S11 also shows 25/09 logins for at least 4 pupils outside the 10-latest list (8082 ×1, 8078 ×2, SMK Leqoe ×1). Their logins are before 20:16 MYT, but the doc does not place them. If they fall before 15:40, "today 2" at the clock is wrong. If they fall after it, they are post-clock logins the doc does not handle. "Today 2 … equal to live" compares with 26/09, another day; keeping it by shifting whole days is a tuning choice, not an observation. | Snapshot `S11_laporan.default.tabs.murid.rows` (dates of rows 5, 29, 33, 34, 35, 55, 64, 78, 158) and `…guru.rows` row 27; `S3_dailyActivity.week.data.logins.recent` (10 latest, 25/09 12:16Z – 26/09 04:09Z). | M17 solution-architect; M02/M01 through XR-M17-07 | Prefer re-dating each post-clock login to the **same calendar day before 15:40** (26/09 ones to 25/09), keeping the order of the list. That keeps every S11 / M11 date, the week and month counts and the "ever" counts. "Today" at the clock then becomes a computed (b) value: 2 + the re-dated 25/09 logins + any unlisted 25/09 logins before 15:40. Place the ≥ 4 unlisted 25/09 logins explicitly. <br>If the 24 h shift is kept instead, list every changed date (S11 Murid/Guru rows, S3 drill, M11 pages) as (b) differences, remove "as observed" for those cells in §6.7 E, and place the unlisted logins. |
| R2-03 | Minor | SRS §6.10 C-03, §6.8 XR-M17-03, R-06 | The accuracy band at the clock is given as 395,804–396,281 correct of 477,743. The lower end is 82.849 %, which renders "82.8%". The band that shows "82.9%" is **395,811–396,287**. `anchor.cjs` subtracts the 127 post-clock correct answers from the 12:33 band (57 observed + 70 PROPOSED), and its check only requires the band to overlap. | `r2.cjs`: ceil(0.8285 × 477,743) = 395,811; floor(0.8295 × 477,743) = 396,287. | M17 solution-architect | Use 395,811–396,287, or pin a single value (e.g. 396,000 − 127 = 395,873), in C-03, R-06 and XR-M17-03. |
| R2-I1 | Info | — | The login shift keeps the "ever logged in" counts (1,708 / 269 / 289), the week and month counts and role splits, and the order of the 10-latest list. AC-32.1 "Login Terakhir 5 jam yang lepas" for KHIR JOHARI at 15:40 (pupil 10:08) is consistent. | — | — | — |
| R2-I2 | Info | — | The 17 "today" sessions come from 22 activities − 5 post-clock sessions of 25/09 (8106 3, 8078 1, 8082 1). This count is sound. Only their placement (R2-01) and the per-session answer count (20, PROPOSED) are designs. Pupil 2022's 20/20 at 09:21 is observed (S6 "25/09 09:22", S7 modal). | — | — | — |

### Re-audit checklist (round 3)

1. **R2-01:** the today placement is consistent with the week/month top lists at the clock and at 12:33. There is a script check that clock state + post-clock record reproduces the 12:33 observations.
2. **R2-02:** post-clock logins are re-dated on the same day, or every changed date is recorded. The unlisted 25/09 logins are placed.
3. **R2-03:** the accuracy band is corrected.

---

# Round 3 — audit of URS / SRS v1.2

| Field | Value |
|---|---|
| Documents audited | `urs/M17-admin-dashboard.md` v1.2, `srs/M17-admin-dashboard.md` v1.2 |
| Mode | Doc-only. Lane 2 was not opened. |
| Scripts | `<scratchpad>/m17-audit/trace.cjs` and `inv3.cjs` (re-run), and `r3.cjs` (new). `r3.cjs` recomputes C-17 and C-18 independently; the writer's `anchor.cjs` was not executed. |

## Verdict round 3: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 1 |

### Round-2 fixes

| Finding | Status | Verification |
|---|---|---|
| R2-01 (Major) | **Closed** | `r3.cjs` recomputes every C-17 claim and all pass: <br>• **Today:** 340 answers = 20 + 160 + 80 + 80; 264 correct = 20 + 118 + 63 + 63 → 77.6 %. 8106 shows 126/160 = 78.8 %, and pupils A and B each 63/80 = 78.8 %. <br>• **8082 today pupil:** 118/160 = 73.8 %; the 8 sessions are its whole week, so its 42 wrong answers equal the week's 42. <br>• **405 pupil:** 401/405 = 99.0 % at 12:33 and 329/330 = 99.7 % at the clock. It has no today sessions any more. <br>• **No 8106 pupil reaches 160 in the week at 12:33.** A and B are at 159; the 1,761 pupil is 99 + 60 = 159. So the observed week top five (452, 405, 234, 200, 160) is reproduced. <br>• **8106 week:** 446/567 = 78.7 % at 12:33 and 399/507 = 78.7 % at the clock. The other 7 pupils hold 90 answers and 69 correct (76.7 %), which is feasible. <br>• **8106 1,761 pupil (month):** 1,534/1,701 = 90.2 %. <br>• **8082 week:** 910/1,069 = 85.1 % and 838/994 = 84.3 %. Its 4 other pupils hold 70 answers and 59 correct, which is feasible. <br>• **8078 week:** 240/305 = 78.7 % and 232/295 = 78.6 %. <br>• **Week engaged 32:** kept, because every post-clock answer is by a pupil already active in the week before the clock (Q-M17-ENGAGED note). <br>• **Other today figures:** heatmap 9:00 20 / 13:00 160 / 14:00 160, the live feed and the "{n} GURU" counts all follow, and are marked PROPOSED. |
| R2-02 (Minor) | **Closed** (see R3-02 for the recording) | The 24 h shift is dropped. <br>• The eight 25/09 post-clock logins keep their printed digits, stored as MYT times all ≤ 15:29. The two 26/09 logins become 15:39 and 15:38. The order of the 10-latest list is unchanged. <br>• Every S11 Murid/Guru "Login Terakhir" date stays as observed except row 35. The Guru row "25/09/2026 13:26" is kept. <br>• The 3 unlisted 25/09 pupils (8082 ×1, 8078 ×2) are placed at 09:00–11:00. The SMK Leqoe row is the listed pupil of 10220. <br>• Today logins = 10 + 3 = 13 (student 9 · teacher 1 · admin 1 · school_admin 2), computed. Week 31 and month 95, with their role splits, are unchanged. <br>• S3 today school list: 8078 "4 LOGIN" (school admin, pupil and 2 unlisted pupils), 8090 "2 LOGIN", 10220 "1 LOGIN". <br>• S11 KHIR JOHARI stays row 1 with "2 minit yang lepas" (15:38). <br>• C-18 passes. |
| R2-03 (Minor) | **Closed** | Band 395,811–396,287 in R-06, C-03, Q-M17-CORRECT and XR-M17-03. The pinned value 395,873 gives 82.863 %. |

**S11 row 35 (26/09/2026 → 25/09/2026): acceptable.** At the single project clock, a login dated 26/09 cannot exist yet.
- Keeping "26/09/2026" would mean seeding a future record, which the Delivery Lead ruled out.
- Any other day but 25/09 changes more than the minimum.
- Leaving the user never-logged-in would change "Pernah Login" 1,708 and M11.
- So 25/09 (15:38) is the minimal choice. It is a timing difference (category (b)), not a D9 deviation, so no DV row is needed.
- It is not yet recorded with its alternatives (R3-02).

### Regression scan

- **Coverage and traceability** are unchanged and clean:
  - 2,084/2,084 elements, 0 unmapped, 0 duplicates, all texts and statuses match;
  - 131 FN, 122 AC, 100 FR, 99 E2E (16 provisional);
  - no orphan in any direction;
  - every E2E runs at 375, 768 and 1280.
- **No value remains stated at 12:33** outside the "live …" record.
- **One stale value was found** (R3-01).

### Findings round 3

| ID | Severity | Doc & section | Issue | Owner | Required fix |
|---|---|---|---|---|---|
| R3-01 | Minor | SRS §6.7 B, sentence "Logins by role: today student 1 · admin 1; …" | This sentence was left over from v1.1. It contradicts the new today value of 13 (student 9 · teacher 1 · admin 1 · school_admin 2) in §6.4 Q-M17-LOGINS, §6.6, C-18 and AC-15.1. §12 says "the E2E values of §12 are these targets" (§6.7), so the two must agree. | M17 solution-architect | Change it to "today student 9 · teacher 1 · admin 1 · school_admin 2". |
| R3-02 | Minor | SRS §6.6 (row 35 sentence), §6.5 R-01 | The row-35 date change is stated only as "unavoidable" in §6.6 prose. No R-row records it with its alternatives, and R-01 does not mention it. | M17 solution-architect | Add it to R-01 (or a new R-row) as a (b) timing difference with the alternatives: keep 26/09 (future record, rejected by the single-clock decision); another day or no login (changes more observed values or "Pernah Login"); 25/09 15:38 (chosen, minimal). |
| R3-I1 | Info | — | The residual PROPOSED items of the clock restatement are all listed in OQ-M17-08 item 11 and SRS §8.2, for the G1 report. They are: <br>• the 16 today sessions and their "GURU" counts; <br>• the 3 unlisted login times; <br>• the 145 answers removed from Bahasa Melayu; <br>• the 28/06 point of the 90-day window. | — | — |

Both Minors are one-line doc edits and can be fixed without another audit round.
