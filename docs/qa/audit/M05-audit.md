# M05 — Practice & Drills (Latih Tubi) + `/dashboard` — Independent Audit (AUD)

| Field | Value |
|---|---|
| Stage | AUD (TRACKER §6 step 4) |
| Date | 2026-09-25 |
| Auditor | Independent audit agent on browser lane 2 (`playwright2`). This agent did not write the URS or SRS. |
| Documents audited | `docs/requirements/urs/M05-practice.md` v1.0 · `docs/requirements/srs/M05-practice.md` v1.0 |
| Evidence | Live https://prestasiplus.my (admin session, read-only); `docs/discovery/M05-practice.md` (§2.7, §9, App. A–C); `docs/discovery/inventory/M05/*`; the scrubbed page sources in `inventory/_raw/M05/work/` (S7 script and template read line by line); cross-checks against the M01, M03, M04 and M06 SRS; `/spm/history` (M06) read to identify the admin's sessions; masked screenshots in `docs/qa/audit/img/M05/` |
| Safety | Read-only throughout. The M05 write-guard (`tools/jobs/M05-guard.js`) was installed before the inventory re-run. No session URL was opened (`/practice/{CODE}/quiz`, `/subjektif`, `/practice/chapter/{CODE}/{id}/quiz`, `/practice/revision/{CODE}`, `/latihan-berstruktur/{id}/jawab`); their hrefs were read only. "Mula Kuiz", "Mula", "Simpan", the S15 selects and every submit were never touched. Other pages were read by same-origin GET with ≥450 ms between requests. Teacher and school names were masked (sanitize.js plus a text mask) before the S10 screenshot, and the screenshot was checked for leaks. No credentials or personal data are recorded here. The shared tools were not modified; the re-run output was written to `.playwright-mcp/lane2/M05-audit-rerun.json` only. |

## Verdict: **FAIL**

There are **0 Critical, 5 Major and 10 Minor** findings.

The completeness proof is sound:
- The inventory re-runs identically on the 7 states sampled.
- URS §6 accounts for all 860 elements.
- The 42 exclusions are all the M16 tournament banner.
- The SHU 001–003 rows are correctly labelled as logo/tagline, so the M06 mistake is not repeated here.
- Traceability closes.

The failures concern data and cross-module truth, not coverage:
- **DV-M05-05 and the admin seed create a practice session that does not exist on live.** Because of it, five live values that did not contradict each other are rewritten (S8 sessions and time, S9 totals, S12 BM).
- **The admin's 4 live "Latihan" sessions are M06 SPM sessions** (2 "Tahun Lepas", 2 "Latih Tubi" on `/spm/history`). The documents treat them as random drills, and invent an "SPM" badge where live shows "Latihan". M05 and M06 also model and seed the same sessions differently.
- **The S15 rule BR-27 ("any mode incl. M06 spm") is contradicted by live.** The admin has 84 SPM answers in BM and SEJ, yet every S15 row reads "Belum mula".
- **`/latihan-berstruktur` has a `scope=spm[&track=bahasa]` variant that M05 omits.** Live renders it as a different page, and M06 and M04 both depend on it.
- **The DV-M05-04 fix creates a new contradiction on S1.** A subject card would read "6538 soalan" next to "Statistik Subjek" "13872 soalan" for the same subject. The alternatives were not recorded.

Every fix is a document edit. After that, a targeted re-audit of the affected items is enough.

## Summary counts

| Measure | Result |
|---|---|
| Content elements in URS §6 (script) | **860 / 860** inventory IDs (S1–S6, S8–S15): 0 missing, 0 extra, 0 duplicates. 818 are mapped and 42 excluded. |
| The 42 exclusions | All are `EL-M05-S{1–6,8–15}-001–003` "LIVE:" / "MAIN" / "DAFTAR", which is the hidden `tournamentBanner()` widget, so **M16 is correct**. The SHU exclusions 001–003 are the logo link, the logo image and "Platform Latih Tubi Nasional", correctly labelled "logo and tagline" (global shell). |
| Matrix ↔ §3 FN | 81 distinct content FNs + 14 SHU FNs = 95, as stated; 0 unknown FN ids; 158 FNs defined. |
| Mapping semantics (by hand) | 30 rows (every 28th row), **30 correct** (list below) |
| Live re-inventory (`inventory.js` + `run-state.js`, `jobs/M05.js`, write-guard on) | 7 states: S1 default@1280, S3 math-default@1280, S4@1280, S8 all@375, S11 may-data@1280, S12@1280, S15@375. **Totals and element keys are identical** to the saved raw captures (694/425/399/420/405/415/401). There is no horizontal overflow. |
| S7 source vs the 16 source-only FNs (4.2.1–4.2.13, 4.3.1–4.3.3) | 14 exact. Two are imprecise: the report failure "view" (AUD-06) and the failed-check wording plus the button order (AUD-07). |
| Traceability (script) | 158 FN, each cited by ≥1 FR. 137 AC, each with ≥1 FR and ≥1 E2E. 132 FR, each with ≥1 E2E. 54 E2E on 375/768/1280. 0 dangling references. |
| Claims verified against live / source | **62**: 50 correct, 12 incorrect (list below) |
| Deviations DV-M05-01…12 | 01 valid (S3/S6/S10/S13 header "Dashboard" confirmed). 02 valid (S2/S3 `fas fa-zap`, S4 bare `book-open`/`globe`…, S12 `book-open`/`clock`; JAWI on S4 renders `fas fa-pen-nib`). 03 valid for `subject`/`topic_id`, but the `level` part is new UX (AUD-13). **04: creates a new S1 contradiction and records no alternatives** (AUD-05). **05: over-broad, with a fabricated seed** (AUD-01). 06: acceptable, but the definition is unobserved and owned by M14 (AUD-14). 07 valid (empty `<select name="level">` reproduced). 08 valid, but the new heading is PROPOSED COPY (AUD-12). 09 valid (`h3 … truncate`). 10 valid (`?bulan=2026-10` and `2030-01` show an active › link). 11 valid but incomplete (AUD-11). 12 valid (S15 bar tracks measure 0 px wide at 375). |
| Findings | **Critical 0 · Major 5 · Minor 10** |

## Findings

| ID | Severity | Doc + section | What's wrong | Live evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M05-01 | **Major** | URS §7 DV-M05-05, FN-9.3.1/9.3.2, AC-27.2, AC-28.1/28.2, AC-30.2, AC-36.2; SRS BR-06 ("every answer belongs to a session"), §6.12 admin session **A1**, the anchors line, E2E-39/41/45/51 | **The seed fabricates a session, and the DV rewrites live values that do not conflict.** On live, S8 (`period=all`) and S9 agree on the session count (**4**) and time. The only difference is "Soalan Dijawab": 119 vs 84. The extra 35 answers are the 19/02 chart point, and **no session exists for them anywhere** (neither `/practice/history` nor `/spm/history`). To make "every answer belongs to a session" hold, the seed invents session A1 (2026-02-19 10:05, 03:30, 20 coins). As a result: S8 "Sesi Latihan" goes from 4 to **5** and "Masa Berlatih" from 4m to **8m**; S9 goes from 4 / 84 / 21.8% / 26 to **5 / 119 / 28.9% / 46**; S12 BM goes from L2 46 / 94 / 48.9%, "46/50 betul", bar 84% to **32 / 79 / 40.5%, "32/50", bar 28%**. None of these rewritten values is the minimal fix. Live S12 BM (94 answered) differs from S8 BM (79) for an unknown reason. The DV takes S8 as the truth without recording that choice. | `/practice/progress?period=all`: "119 … 38.7% … **4** Sesi Latihan … **4m**". Chart `labels ["19/02","11/05","19/05"]`, `data [35,74,10]`. `/practice/history`: "4 · 84 · 21.8% · 26", 4 cards (19 May ×2, 11 May ×2). `/spm/history`: the same 4, nothing on 19/02. `/penguasaan`: BM "46 Betul 94 Dijawab 48.9%", bar `width: 84%`. | Seed the observed values: 4 admin sessions with their live times, plus 35 BM answers on 19/02 with no session. Keep S8 = 4 sessions / 4m and S9 = 4 / 84 / 21.8% / 26. Re-decide DV-05 minimally and record the choice among alternatives, for example: (a) replicate (S8 counts all answers, S9 counts session answers; different screens); (b) relabel only. Do not change S8 sessions/time or S9 totals. If S12 is changed, mark it as a Delivery Lead decision (PROPOSED), not as live-derived. Update AC-27.2, 28.1, 28.2, 30.2, 36.2 and the E2E anchors. |
| AUD-M05-02 | **Major** | URS FN-6.2.4/6.2.7, OQ-3; SRS §6.1 (`mode … spm written by M06 only`), §6.10 "Session types (S9)", BR-21, §8.3 "History type badges", §6.12 admin A2–A5 and pelajar P1–P3, BR-06 | **The admin's live sessions are SPM (M06) sessions, not random drills, and the documents contradict both live and M06.** (a) `/spm/history` lists the same 4 sessions as S9: 19 May 03:49 and 03:26 **"Tahun Lepas"**, 11 May 14:27 and 14:22 **"Latih Tubi"** (SPM). Yet S9 labels all 4 **"Latihan"** (`fa-book`, #6B7280). The observed "Latihan" badge therefore applies to SPM sessions. The docs map it to `random` and invent an "SPM" badge (`fa-graduation-cap` #4F46E5) for `spm`, which contradicts what live shows. (b) The seed models A2–A5 as `random · BM/SEJ · D1–D4`. (c) M06 models the same records as a separate entity (`DATA-M06-04 SpmQuizSession`) with different seeds: admin `latih_tubi` **MATH** 14/40, but live S8 shows that session is Sejarah (SEJ 40 answered, 14 betul); student 3 sessions / 85 answers / 47 coins vs M05 P1–P3 32 answers. On live, `/practice/history` and `/spm/history` read **one** session store. | `/spm/history` text quoted in the claims (#41–42). `/practice/history` card style `border-left: 4px solid #6B7280` with the badge "Latihan" on all 4. `/practice/progress?period=all`: "SE Sejarah 40 soalan … 14 betul 26 salah". | Model one session store shared by S9 and M06 S10 (M05 or M06 owns it; the Delivery Lead decides), with the M06 `type` values. The S9 badge for SPM sessions = "Latihan" #6B7280 (OBSERVED). Only non-SPM random/chapter/revision badges stay UNVERIFIED. Re-seed admin A2–A5 as the live SPM sessions (past_year BM ×2, latih_tubi BM 11/34, latih_tubi **SEJ** 14/40) and use **one** pelajar seed shared with M06. Queue a note to M06 (under revision): the 14/40 session is SEJ, not MATH. |
| AUD-M05-03 | **Major** | URS FN-8.3.6, AC-33.3, OQ-7; SRS BR-27 ("any mode, incl. M06 `spm`"), FR-119, §6.12 pelajar S15 anchors, E2E-47 | **The S15 progress rule contradicts live.** The admin has 84 answers in SPM sessions (BM 5+5+34, SEJ 40), including "Tahun Lepas" past-year SPM questions. Yet every S15 row, BM and SEJ included, reads **"Belum mula"**. Discovery's "T4/T5 only" inference assumed those answers were D1–D4 random drills, which is false (AUD-02). BR-27 therefore specifies a data source that live demonstrably does not use, and the E2E asserts green/amber/red bars built from `spm` sessions. | `/target-spm`: 20 rows "Belum mula" (screenshot `s15-rows-375.png`); `/spm/history`: BM and SEJ sessions. | Mark the S15 progress source **UNVERIFIED / pending LS-10**. State the observed fact (SPM Tahun Lepas and SPM Latih Tubi answers do **not** start a row). Remove "incl. M06 spm" from BR-27. Mark AC-33.3 and E2E-47's data rows provisional. |
| AUD-M05-04 | **Major** | URS §1 S10 / Q3 rows, FN-5.1.3–5.1.6, 5.2.1; SRS §2 S10/Q3, FR-91/93/94/96, §7 #15/#16, BR-23 | **A route variant is missing and conflicts across modules.** Live `/latihan-berstruktur?scope=spm[&track=bahasa]` is a different page: back link "Kembali ke Subjektif SPM" / "Kembali ke Tracking A SPM", h1 "Subjektif SPM" / "Tracking A Bahasa", a reduced Subjek list (15 / 2 subjects), extra card lines ("Tingkatan 5" chip, "1 bahagian · 8 markah"), a hidden `<input name="scope">` (and `track`) in the filter form, a pager and "Mula" hrefs that keep `scope`/`track` (`/latihan-berstruktur/4454/jawab?scope=spm`), and "559 set ditemui". M06 SRS routes S7/S9 and `/api/structured-sets` are declared "M05 route, SPM variant … owned by M05". M04 BR-M04-17 "Buka Soalan Sama" opens `/latihan-berstruktur/{id}/jawab?scope=spm`. M05 has **no** mention of `scope` or `track`: FR-91 submits only two parameters, FR-93 builds "Mula" without a query, and §7 #15 has no `scope`. | Page reads of the three URLs (claims #50–52). Screenshot `img/M05/s10-scope-spm-1280.png` (names masked). | Add the `scope`/`track` parameters to S10/Q3: carried by the form (hidden inputs), the pager and "Mula"; S10's own content when absent. Either specify the SPM-variant content here or delegate it explicitly to M06 FN-4.4/5.2, with M05 owning the route and API contract (`scope`, `track` on §7 #15/#16/#17). Add an AC and an E2E for `?scope=spm` round-trips, and make sure M04's `?scope=spm` answer link resolves. |
| AUD-M05-05 | **Major** | URS §7 DV-M05-04, FN-1.7.1, 2.1.4, AC-09.1, AC-36.1; SRS BR-05, FR-23/31, E2E-13/51 | **The fix creates a new contradiction and its alternatives are not recorded.** On live, the S1 subject card count equals the S2 count and matches S1 "Statistik Subjek" (only PM differs: 15014 vs 15414). DV-04 changes the S1 card and the S2 card to the Latih Tubi count but keeps "Statistik Subjek" bank-wide. The **same S1 page** would then show, for example, "Matematik 6538 soalan" (card) and "Matematik 13872 soalan" (statistics), and "Fizik 0 soalan" next to "Fizik 1261 soalan". The DV rewrites 62 live values (31 × S1, 31 × S2) and does not say why this is minimal compared with the alternatives: (a) lift the Darjah 1–4 limit; (b) keep the counts and change only the S2/S1 wording; (c) this rewrite. M06 AUD-03 set the precedent for recording the choice. | `/dashboard`: cards "13872 soalan Matematik", "1261 soalan Fizik"; statistics "Matematik 13872 soalan". `/practice/MATH` "6,538 soalan tersedia"; `/practice/PHY` offers no level. | Re-decide DV-04 and record the Delivery Lead's choice among the alternatives. If the rewrite stays, extend it so S1 does not contradict itself (or state and justify the in-page difference), and mark the new card values as a decision (PROPOSED), not as live. Update AC-09.1 / AC-36.1 and E2E-13/51. |
| AUD-M05-06 | Minor | URS FN-4.3.3, AC-24.3; SRS FR-89, §8.2 S7 "Report modal" | **The failure state is misdescribed.** The FN reads "network failure **view** 'Gagal menghantar laporan…'". The S7 source has no separate failure view. `catch` sets `reportSubmitted = true` and the text renders **inside the "Terima Kasih!" view with the green tick**. Any JSON response (including an HTTP error with `{message}`) also shows "Terima Kasih!" + that message. M04 replicated the same pattern (FR-M04-69). | `page_practice_revision_BM.html` `submitReport()`: `this.reportMessage = 'Gagal …'; this.reportSubmitted = true;`, and the template `x-show="reportSubmitted"` → `fa-check` + "Terima Kasih!" + `x-text="reportMessage"`. | State exactly: the failure text appears under "Terima Kasih!" with the green tick, as live (as M04). Alternatively, list it as a D9 contradictory-state deviation. Align AC-24.3 and E2E-35. |
| AUD-M05-07 | Minor | URS FN-4.2.7, FN-4.2.8; SRS FR-80 | **S7 source precision.** (a) FN-4.2.7 says "a failed check changes nothing". Per the script (as SRS FR-79 correctly says), any JSON response, including an error, marks the answer checked. With `is_correct` undefined this shows red "Masih belum tepat" and pushes a review item with an empty correct label. Only a network or non-JSON failure changes nothing. (b) "Lapor Soalan" sits **between** the question card and the feedback card, not after the feedback card. | S7 source lines 1655–1665 (`Lapor Soalan` block before `x-ref="feedbackCard"`); `checkAnswer()`. | Align FN-4.2.7 with FR-79, and state the button order in FN-4.2.8 / FR-80. |
| AUD-M05-08 | Minor | SRS §5 last row ("unknown `period` → default (30 on S8, all on S9, INFERRED); malformed `bulan` → current month (INFERRED)") | **Observable states are labelled INFERRED, and one of them is wrong.** `?period=zzz` on S8 and on S9: **no chip or pill is active** (S9 lists all sessions; S8 shows zeros). `?bulan=abc` and `?bulan=2026-13` return **HTTP 500 "500 - Ralat Pelayan"**, not the current month. | Chip styles read for `/practice/progress?period=zzz` (all `#F1F5F9`) and `/practice/history?period=zzz` (no `active`); `/pembetulan?bulan=abc` → 500. | Relabel as OBSERVED and specify "no active chip". For a malformed `bulan`, either replicate the 500 page or record a D9 deviation (server error = broken) with the chosen fallback. Add E2E steps. |
| AUD-M05-09 | Minor | URS FN-5.1.8 ("INFERRED (bands 2, 5, 6)"); SRS BR-23; discovery §1.2 | The KBAT bands can be observed: `?kbat_level=2` → "LOTS 2" green-100/green-700; `=5` → "HOTS 5" red; `=6` → "HOTS 6" red; `=1` "LOTS 1". | Four filtered page reads. | Relabel OBSERVED. |
| AUD-M05-10 | Minor | SRS BR-19 (sparkline `y = 2 + (100 − pct) × 0.26 … after scaling, INFERRED`) | The formula does not produce the observed points. For BM (57.1 → 32.4 → 10.0) it gives 13.2 / 19.6 / 25.4, but live is `0,2 60,15.6 120,28`. Live uses **min–max scaling**: y = 2 + (max − v) ÷ (max − min) × 26 (32.4 → 15.6 ✓). | S8 `all` source: `<polyline points="0,2 60,15.6 120,28">`, chart data 57.1/33.8/10.0 (BM per day 57.1 / 32.4 / 10.0). | Replace it with the min–max rule (x = i × 120 ÷ (n − 1)) and mark it OBSERVED. |
| AUD-M05-11 | Minor | URS §7 DV-M05-11, FN-9.2.2; SRS FR-126 vs E2E-54 | **The DV scope is incomplete, and the FR and E2E contradict each other.** At 375, other sub-12 px text exists: the S3 hero chip "6,538 soalan tersedia" (10 px) and the S9 coin label "SYILING" (10.4 px). FR-126 changes only the listed texts, but E2E-54 asserts **all** text ≥12 px on S1, S3, S9, S12 and S15, so it would fail on these. | Computed font sizes at 375 (S1 quest chips 10 px; S3 hero chip, level/difficulty labels 10 px, tips 11 px; S9 labels 10 px, "SYILING" 10.4 px; S12 chips 10 px; S15 "Belum mula" 9 px; S5, S8, S10, S11 none). | Add the S3 hero chip and S9 "SYILING" to DV-11, or narrow E2E-54 to the listed elements. Keep FR-126 and E2E-54 in step (M03 R2-24 pattern: content inside `main` only). |
| AUD-M05-12 | Minor | URS DV-M05-08 ("Subjek Perlu Perhatian"), AC-27.3; SRS FR-102, §8.3 (Q1/Q2 titles, feedback "Betul!"/"Salah", "Keputusan Latihan", messages, "Ulang Lagi"/"Kembali", "🏆 Cemerlang"/"👍 Bagus", "Peti Harian dibuka! 🎉", "Target berjaya disimpan.", "Gagal menyimpan target…", "Baki percubaan percuma anda telah habis.", "Bab ini masih dikunci."), AC-15.1/15.4, E2E-21/22/23 | New BM copy is labelled UNVERIFIED but not **PROPOSED COPY** (M02 DV-12 / M04 AUD-16 / M06 AUD-15 precedent). The LS-1/2/3/8 behaviours (count-up timer from 00:00, the S7 layout reused for Q1/Q2, silent redirect to `/pricing`) are INFERRED, yet E2E-21/22/23 assert them as fixed behaviour (M06 AUD-07 pattern). The S3 source has no timer hint either way. | S7 source is the only quiz template captured; Q1/Q2/trial gate never observed. | Mark these strings PROPOSED COPY for the Delivery Lead to report at G1. Mark E2E-21/22/23 (and AC-15.1 timer, AC-15.4) provisional pending LS-1/LS-8. |
| AUD-M05-13 | Minor | URS DV-M05-03 (level part), FN-2.1.6, AC-09.4, AC-12.2; SRS FR-34, BR-28 | The `?level=` fix is new UX: a hidden carry-over from S2 card links to S3. It also leaves **7 of the 11 dashboard level pills** (D5, D6, T1–T5) doing nothing visible, so they stay dead links. The DV records neither point. The `subject` and `topic_id` parts are valid, minimal fixes. | `/dashboard` pills `/practice?level=D1…T5`; S3 offers only D1–D4. | Record the level handling as a Delivery Lead decision (PROPOSED), with the alternatives (e.g. leave the pills as live, or treat only D1–D4). State the T-level outcome explicitly. |
| AUD-M05-14 | Minor | URS DV-M05-06, FN-9.3.4, AC-04.3; SRS BR-08 | **The streak definition on live is server-side and not observed.** The shell also has an M14 page `/kombo` (TRACKER M14). "Last practice 19 May" ignores later non-practice activity (M06 mock 317, "2 bulan yang lepas"). The fix is defensible (the reminder copy "Buat sekurang-kurangnya 1 latihan" implies a practice-based streak), but it sets M14's header pill value. | Header pill "1 hari 🔥" (server-rendered `1`); raw S1 has no client rule; `/kombo` renders the dashboard (M14). | Label the live definition UNOBSERVED in the DV evidence. Keep BR-08 as M05's working rule, flagged for M14 (OQ-13 d) together with `/kombo`. |
| AUD-M05-15 | Minor | SRS §6 intro and DATA-M05-01/02 (`subjectId`, `levelId`, `chapterId` strings), §6.12 "Chapter ids … '1', '3'" | This conflicts with M03 v1.2/v1.3: subject, level and chapter ids are **integers**, and M03 §6.9 keeps live ids only for chapters 35, 36, 91 and 92, **not 1 and 3**. AC-19.2 / E2E-25 (`/practice/chapter/MATH/1/quiz`) therefore depend on an unagreed M03 change (OQ-13 c is still open while the seed asserts it). | M03 SRS lines 22, 265 and §6.9; live `/practice/chapter/MATH` hrefs `/MATH/1/quiz?count=5…`. | Type the ids as int (as M03/M04). Keep the MATH 1/3 ids as a pending M03 change, or derive the E2E hrefs from the M03 seed until M03 adopts them. |

### Deviation verification (URS §7)

| DV | Live defect reproduced? | Within D9/D10? | Note |
|---|---|---|---|
| DV-M05-01 | Yes. The header shows "Dashboard" / "Selamat datang kembali" on `/practice/MATH`, `/practice/revision`, `/latihan-berstruktur`, `/remedial/saya`, and in the S7 source. User shell, not role-based. | Yes (wrong label) | — |
| DV-M05-02 | Yes. `fas fa-zap` (PHY), S4 bare `book-open`, `globe`, `calculator`… (JAWI `fas fa-pen-nib` renders), S12 `book-open`/`clock`. | Yes (invisible content) | — |
| DV-M05-03 | Yes. `/practice?subject=MATH` returns the S2 list (312,499 bytes). The "Mula Latihan 🚀" cards promise that subject. | `subject`/`topic_id`: yes. `level`: new UX | AUD-13 |
| DV-M05-04 | Contradiction real (Fizik 1261 advertised, 0 levels) | The fix choice is a decision, and it **creates an S1 contradiction** | AUD-05 |
| DV-M05-05 | Partly (S8 119 vs S9 84; S12 BM 94 vs S8 79) | **The rewrite is over-broad; the seed is fabricated** | AUD-01 |
| DV-M05-06 | "1 hari" + reminder with no practice since May: plausible stale value | Acceptable; definition unobserved; M14 owns it | AUD-14 |
| DV-M05-07 | Yes. `<select name="level" …> </select>` empty on ADDMATH. | Yes | — |
| DV-M05-08 | Yes. The heading "Topik…" lists subjects; "Ulang Kaji" → `/practice/BM`. | Yes | New heading = PROPOSED COPY (AUD-12) |
| DV-M05-09 | Yes. `h3 … truncate` on every chapter title. | Yes | — |
| DV-M05-10 | Yes. `?bulan=2026-10` → › `?bulan=2026-11`; `2030-01` → `2030-02`. The current month shows a grey span. | Yes | — |
| DV-M05-11 | Yes, but the list is incomplete | Yes (M03 DV-06b precedent) | AUD-11 |
| DV-M05-12 | Yes. S15 bar tracks measure 0 px wide at 375. | Yes (layout) | — |
| Replicated (D-7, D-10, D-12, D-14, D-15, D-16, Darjah 1–4, difficulty 5 = 0) | — | Correctly replicated (difficulty 5: `difficultyStats {"5":0}`, `difficultyByLevel` has keys 1–4 only; SK "D4 0 soalan") | — |

### Live-session states (LS) — labels checked

| LS | Label | Audit |
|---|---|---|
| LS-4, LS-5 | SOURCE-DERIVED | Confirmed line by line against `page_practice_revision_BM.html` (loading, quiz, feedback, results bands 80/50, messages, rewards, review, the report modal with its 7 tints, `source:'revision'`, `question_count: 20`). Imprecisions: AUD-06, AUD-07. |
| LS-1, LS-2, LS-3 | INFERRED "reuse the S7 template" | No template for Q1/Q2 was captured. Reuse is a reasonable assumption and is labelled INFERRED, but the E2E treat it as fact (AUD-12). |
| LS-8 | INFERRED redirect to `/pricing` without a message | Plausible (the trial notice links `/pricing`), but the "no message" is invented; keep it provisional (AUD-12). |
| LS-10 | INFERRED | The progress source is contradicted by live (AUD-03). |
| LS-6, LS-7, LS-9, LS-11, LS-12 | INFERRED / not built / deferred | Acceptable. The S10 `scope` variant of LS-7's page is missing (AUD-04). |

### Seed check

- **Accounts.** `admin@`, `pelajar@` and `pelajar2@demo.test` match M01 §6.8 (grades 4 / 10 / 5, "Admin Demo"); `pelajarmaju@` matches M03. No new account is added.
- **The admin wallet (256 / 8 / Lvl 2), trial "Baki 0 / 50", S6 BM 46 / SEJ 26 / 72, and S11 May values** match live.
- **The admin sessions are wrong:** A1 is invented, and A2–A5 have the wrong mode and SEJ/MATH conflicts (AUD-01, AUD-02).
- **S12 admin BM values are rewritten** (AUD-01).
- **pelajar SPM sessions conflict with the M06 student seed** (AUD-02).
- **pelajar S15 rows rely on the contradicted BR-27** (AUD-03).
- **The practice question fixture (577 questions) replaces the live S2–S5 counts** (e.g. MATH D1 Bab 1 = 20, not 464). This is acceptable as dummy data (D1/D2), but AC-19.x and the E2E must read the counts from the API, as §12 already says.

## Coverage spot-check (30 rows, all correct)

S1-018 "FEATURE" badge→1.2.1 · S1-046 dot→1.2.4 · S1-074 "Progres"→1.4.1 · S1-102 quest description→1.4.2 · S1-130 "Kekalkan kombo…"→1.4.2 · S1-158 "🏅 Papan Pendahulu"→1.5.3 · S1-186 "Mula Latihan 🚀" `?subject=BI`→1.7.1 · S1-214 "🏫 Sekolah Rendah (KSSR)"→1.7.3 · S1-242 "Sains" chip→1.7.4 · S1-270 "9600"→1.7.5 · S1-298 "⭐"→1.7.6 · S2-003 "DAFTAR"→excluded M16 · S3-006 "0" (trial)→2.2.3 · S3-034 "Semua Tahap"→2.2.8 · S3-062 "Mula Kuiz" `/practice/BM/quiz?count=10`→2.2.10 · S4-003 "DAFTAR"→excluded M16 · S5-004 "Semua Subjek"→3.2.1 · S5-032 "Bab 1: Nombor Bulat hingga 100"→3.2.4 · S6-013 "Tips Ulang Kaji"→4.1.4 · S8-023 "Mula Latihan"→6.1.4 · S8-051 "40 soalan dijawab"→6.1.7 · S9-025 "Latihan" `fa-book`→6.2.4 · S9-053 "20.0%"→6.2.4 · S10-017 "Trial"→5.1.4 · S10-045 "Showing to of results"→5.1.6 · S10-073 "3 soalan · Tingkatan 4"→5.1.4 · S11-016 "Mei 2026"→7.1.2 · S11-044 "0.0%"→7.1.5 · S12-028 "46/50 betul"→7.2.3 · S14-005 "Tiada misi hari ini"→8.2.2 · S15-027 "50-69% (Perlu Usaha)"→8.3.5.

## Claims verified against live / source (62)

✓ = correct, ✗ = incorrect (with finding).

1. ✓ S1 tab "Dashboard - PRESTASIPLUS"; header "Dashboard" / "Selamat datang kembali".
2. ✓ S1 greeting "Selamat Petang, Admin PRESTASI+ 👋" / "Jom teruskan latihan hari ini! 🚀"; 🎓 `hidden md:block`.
3. ✓ Trial card: `fa-hourglass-half`, "PERCUBAAN PERCUMA" (upper-case by CSS), "Baki 0 / 50 soalan", "Langgan Sekarang".
4. ✓ Carousel: 5 slides with the exact types, titles and bodies; counter "n / 5".
5. ✓ Kombo banner copy and "Mula Latihan" → `/practice` (server-rendered "Kombo 1 hari akan putus!").
6. ✓ Stat cards 256 / 8 "Mata (Lvl 2)" / 1 / 0 / 0%; count-up `setTimeout(…,200)`, streak +1 every 50 ms.
7. ✓ 10 quests: titles, chips (upper-case), descriptions, targets, rewards +15 +20 +25 +30 +10 +12 +20 +25 +35 +40.
8. ✓ Chest "Selesaikan 10 lagi misi untuk buka peti! 🔒"; the widget has no link to `/misi-harian` (0 links).
9. ✓ Badge empty state copy; quick actions incl. badge "72" and "Panel Admin".
10. ✓ Articles: 5 cards, chips "TIPS BELAJAR" / "PANDUAN IBU BAPA", "7 bulan yang lepas".
11. ✓ "31 subjek"; card counts without separator (11688, 8039, 13872…); hrefs `/practice?subject={CODE}`.
12. ✓ Statistik Platform 130152 / 31 / 11 / 129752.
13. ✓ Level pills "Darjah 1 (11396)" … "Tingkatan 5 (20770)", hrefs `/practice?level=D1…`.
14. ✓ Soalan Terkini: subject chip upper-case "SAINS", text cut + "...", "4 bulan yang lepas", "T5".
15. ✓ Statistik Subjek sorted desc (PM 15414, MATH 13872, SCI 12165, BM 11688…), "Digunakan: 0x".
16. ✗ DV-04 leaves S1 consistent: a card/statistic contradiction is created (AUD-05).
17. ✓ S2 `?subject=MATH` → the unfiltered list (same page); separators "13,872".
18. ✓ S3 MATH: tab "Matematik - Latihan", header "Dashboard" (D-1), trial notice "Baki percubaan percuma: 0 soalan lagi.", hero "6,538 soalan tersedia".
19. ✓ S3 data: `difficultyStats {1:1340,2:2130,3:2511,4:557,5:0}`; D1 2,734 / D2 2,129 / D3 682 / D4 993; `difficultyByLevel` keys 1–4.
20. ✓ S3 availability logic = BR-12 (script getters).
21. ✓ `quizUrl` = URLSearchParams level, difficulty, count; default `/practice/MATH/quiz?count=10`; click is `prevent` + navigate only if `canStartQuiz`.
22. ✓ `getLevelName()` "Semua Tahap" / level name / "Tahap {id}".
23. ✓ Subjective link `x-if subjectiveCount>0`, needs a level; href `/practice/MATH/subjektif` (no query); `subjectiveLevelCounts = []`.
24. ✓ SK offers only "D4 Darjah 4 0 soalan"; ADDMATH "Semua Tahap 0 soalan", no level.
25. ✓ Changing level/difficulty does not reset the other selections (independent `@click` assignments). Consistent with the FNs.
26. ✓ `/practice/XYZ`, `/practice/chapter/XYZ` → 404 "404 - Halaman Tidak Dijumpai | PRESTASIPLUS".
27. ✓ S4: 10 cards with "18 bab tersedia 4,833 soalan chapter" … "Jawi 13 bab tersedia 1,300".
28. ✓ S5 MATH: options `1=Darjah 1 — 2,734 soalan` (selected) … `4`; Bab 1 open "0/464 … 464 baki"; hrefs `/practice/chapter/MATH/1/quiz?count=5|10|15|20`; Bab 2–8 "Kunci bab sebelumnya".
29. ✓ S5 BM D1: Bab 1 "18/320 soalan unik · Skor 44.4% · 302 baki" open; Bab 2 "5/317 · 60%" and Bab 3 "10/321 · 80%" locked (D-7); chapter id 35.
30. ✓ Chapter sums: MATH D1 chapters Σ = 2,734; BM D1 Σ = 958 (= option counts).
31. ✓ S5 ADDMATH: empty `<select name="level">` + "Tiada bab tersedia untuk tahap ini." (DV-07).
32. ✓ S5 titles `truncate` (DV-09).
33. ✓ S6: header "Dashboard" (D-1); banner "72 soalan perlu diulang kaji"; BM 46 / SEJ 26; tips copy exact; "Kembali ke Latihan".
34. ✓ S7 source: `startQuiz()` POST `{subject_id, question_count: 20}`; error → `throw new Error(data.message || 'Failed to load revision quiz')`, `alert(error.message || 'Maaf, …')` (SRS FR-75 is exact; discovery §2.7 was slightly wrong).
35. ✓ S7 timer counts up +1 s; "Soalan i daripada n"; progress `(i+1)/n`.
36. ✓ S7 feedback titles "Betul! Kali ini berjaya!" / "Masih belum tepat"; coin fly `{syiling:1, mata:10, mini:true}` after 300 ms.
37. ✓ S7 results: `Math.round(score/n*100)`; ≥80 green, 50–79 yellow, <50 red; the 4 messages exact; "{score} soalan salah berjaya diperbetulkan!" only ≥50; retry = `location.reload()`.
38. ✓ S7 rewards card (`gamificationData`), bonus fly after 400 ms; review collapsible, initially closed.
39. ✓ S7 report modal: 7 reasons and tints (red, amber, orange, yellow, blue, indigo, slate), maxlength 500, counter, "Batal" hides (reset happens on `openReport`), Esc and backdrop close, `source:'revision'`.
40. ✗ S7 report failure is a separate view: it renders under "Terima Kasih!" (AUD-06).
41. ✓ S8 `all`: 119 / 38.7% / **4** / **4m** live (✗ vs seed 5 / 8m, AUD-01); chart labels 19/02, 11/05, 19/05, data 57.1/33.8/10.0 and 35/74/10, axis titles "Ketepatan (%)" / "Jumlah Soalan".
42. ✓ S8 "Topik Perlu Perhatian" rows BM 79 / 40.5%, SE 40 / 35.0%; "Ulang Kaji" → `/practice/BM`, `/practice/SEJ` (DV-08 target change valid).
43. ✗ S8 sparkline formula (AUD-10).
44. ✗ S8/S9 unknown `period` → a default chip is active (none is; AUD-08).
45. ✓ S9 live: 4 / 84 / 21.8% / 26, cards "19 May 2026, 03:49", "0 / 5", "00:14", "💪 Cuba Lagi" (CSS upper-case, red), "20%" inner label, "SYILING", not clickable, border #6B7280.
46. ✗ S9 sessions are random drills: they are SPM "Tahun Lepas" / "Latih Tubi" sessions (AUD-02).
47. ✓ S10: header "Dashboard" (D-1); 32 subject options A–Z, 7 KBAT options; "Showing 1 to 20 of 4061 results … 1 2 … 10 ... 203 204"; pager keeps the query; newest first (4454).
48. ✓ S10 `?kbat_level=2` → "Showing 1 to 20 of 535 results 1…10 ... 26 27" (window rule of §8.1).
49. ✗ S10 KBAT bands 2/5/6 "INFERRED": they are observed (AUD-09).
50. ✗ S10 has no `scope` variant: `?scope=spm` renders "Subjektif SPM" (AUD-04).
51. ✗ S10 filter form has only 2 fields: with `scope` it has hidden `scope`/`track` (AUD-04).
52. ✗ "Mula" href has no query: `…/4454/jawab?scope=spm` under scope (AUD-04).
53. ✓ S11 May: "33.8% Sebelum 33.8% Selepas 0.0% Peningkatan", "Berdasarkan 74 soalan bulan ini", Sejarah 40 / 35.0 / 35.0, BM 34 / 32.4 / 32.4.
54. ✓ S11 current month › = grey `<span>`; ‹ → `?bulan=2026-08`; future months keep an active › (DV-10).
55. ✗ S11 malformed `bulan` → current month: live returns 500 (AUD-08).
56. ✓ S12 live: BM "L2 Aktif 46 Betul 94 Dijawab 48.9% Tepat" (red-500), "Menuju L3 46/50 betul", bar 84% #3B82F6, "x1.05 XP"; SEJ L1 14/40/35.0%, 14/25, bar 26.7% #F59E0B. Thresholds 10/25/50 fit both bars.
57. ✗ S12 admin BM seed 32/79 = live: live is 46/94 (AUD-01).
58. ✓ S13 empty copy; S14 "Tiada misi hari ini" / "Misi baru akan muncul bila guru anda assign."; S14 header "Misi Harian" (not D-1).
59. ✓ S15: 20 rows A–Z, "Belum mula", "-", options "Target, A+ … E", legend copy exact; bars 0 px wide at 375 (DV-12).
60. ✗ S15 progress counts M06 SPM answers: admin SPM answers exist, yet every row reads "Belum mula" (AUD-03).
61. ✓ No horizontal page scroll at 375 on S1, S2, S3, S4, S5, S6, S8, S9, S10, S11, S12, S15.
62. ✓ Sub-12 px texts listed by DV-11 exist as stated (quest chips 10 px, S3 10/11 px, S9 labels 10 px, S12 chips 10 px, S15 status 9 px). Two unlisted ones: AUD-11.

## Screenshots

- `docs/qa/audit/img/M05/s15-rows-375.png`: S15 at 375. Each row's progress-bar track is squeezed to 0 px (DV-12 evidence).
- `docs/qa/audit/img/M05/s10-scope-spm-1280.png`: `/latihan-berstruktur?scope=spm` at 1280. It shows "Kembali ke Subjektif SPM", "Subjektif SPM" and the SPM card variant; authors and schools are masked (AUD-04 evidence).

---

## Round 2 — targeted re-audit of v1.1 (2026-09-25)

| Field | Value |
|---|---|
| Documents | URS `M05-practice.md` v1.1 · SRS `M05-practice.md` v1.1 (both carry a v1.1 revision-history entry) · discovery `M05-practice.md` (13 passages marked "(corrected after audit)") |
| Browser | Lane 1 (`playwright`), admin session, read-only. Pages were read by same-origin GET ≥450 ms apart. No session URL was opened (the `…/jawab` hrefs were read only). No action was triggered. |
| Out of scope (settled by the Delivery Lead, not re-audited) | Removal of the invented session; M05 owns the session store with A2–A5 as SPM "Latihan"; BR-27 from observation; M05 owns the `scope`/`track` variants; DV-04 withdrawn; `?level=` ignored; DV-06 withdrawn and moved to M14; malformed `bulan` → current month (DV-13). Only their implementation in the documents was checked. |

### Verdict: **PASS**

**0 Critical · 0 Major · 1 Minor (new).** All of AUD-M05-01…15 are closed. The new Minor is on the M06 side and does not block M05.

### Regression checks (script)

| Check | Result |
|---|---|
| URS §6 vs inventory | **860 / 860** rows, 860 unique, 0 missing, 0 extra; the 42 exclusions are all `-001…003` (M16 banner); 0 unknown FN ids. The FT-5.3 variant maps to the M06 inventory by cross-reference (no duplicated EL ids). |
| Functions | 163 defined (v1.0: 158; +5 = FN-5.3.1…5.3.5), 0 duplicates |
| FN → FR | 163/163 cited by ≥1 FR |
| FN → story | 163/163. The script flagged 9.2.2 only because US-38 lists it as "9.2.1, 9.2.2; all screen FNs", a parse artefact. |
| AC → FR / AC → E2E | 146/146 and 146/146 (new AC-25.6, 26.3, 27.6, 28.6, 29.5, 39.1–39.4) |
| FR → E2E | 137/137 (new FR-133…137 → E2E-55/56) |
| Dangling references | 0 (FN refs in FRs, AC refs in FRs and E2E, FR refs in E2E) |
| Live values | Unchanged since round 1: S8 `all` 119 / 38.7% / 4 / 4m; S9 4 / 84 / 21.8% / 26; S12 BM 46 / 94 / 48.9%, "46/50"; S15 20 × "Belum mula"; `?bulan=abc` → 500 |

### Round-1 findings — status

| ID | Status | Evidence |
|---|---|---|
| AUD-M05-01 | **Closed** | §6.12: A1 removed; "admin — (no session) 2026-02-19 · 35 BM answers" (20 correct), matching the live chart point 19/02 35 answers 57.1%. The anchors S8 119 / 38.7% / 4 / "4m", S9 4 / 84 / 21.8% / 26 and S12 BM 46/94 "46/50" bar 84% match **live today** (re-read on lane 1). BR-06 (S8 = all answers, S9 = sessions only) and BR-20 (S12 stored counters, OQ-15) replicate the live split without tuning. AC-27.2, 28.1/28.2, 30.2, 36.2 and E2E-39/41/45/51 were updated. Arithmetic: BM 35+34+5+5 = 79 answered / 20+11+1+0 = 32 correct; BM wrong 15+23+4+5 = 47 with one repeat → 46 queued (S6). All consistent. |
| AUD-M05-02 | **Closed** | DATA-M05-01 is the one store owned by M05 (modes incl. `past_year` / `latih_tubi` / `ramalan`). BR-21 and §6.10 give `past_year` / `latih_tubi` → "Latihan" `fa-book` #6B7280 (OBSERVED); the "SPM" badge is gone. The seeds match M06 SRS v1.2 §6.10 exactly — see the table below. |
| AUD-M05-03 | **Closed** | BR-27, FN-8.3.6 and FR-119 now state the observation (SPM answers do not start a row; source UNVERIFIED). Progress comes only from the test fixture `mock.setSpmProgress`, marked provisional (AC-33.3, E2E-47). Live re-check: 20 rows "Belum mula". |
| AUD-M05-04 | **Closed** | New FT-M05-5.3 (FN-5.3.1–5.3.5), FR-133…137, §7 #15–17 with `scope`/`track`, AC-25.6, AC-39.1–39.4, E2E-55/56. Checked against live `?subject_id=3&scope=spm`, `?subject_id=1&scope=spm&track=bahasa`, `?scope=spm&track=bahasa` and `?subject_id=3&scope=spm&kbat_level=6`: back links `/spm/subjektif` "Kembali ke Subjektif SPM" and `/spm/ramalan` "Kembali ke Tracking A SPM" ✓; h1 and sub-lines verbatim ✓; pill `fa-language` "Tracking A Bahasa" `uppercase` ✓; "559 set ditemui" / "1,332 set ditemui" ✓; hidden inputs `scope=spm` (+ `track=bahasa`) ✓; Subjek option values `"",1,2,3,4,5,11,22,9,12,10,8,23,21,17,25` (= FN-5.3.3) and `"",1,2` ✓; every card has a "Tingkatan 4/5" chip and "{n} bahagian · {m} markah" with `fa-layer-group` (20/20) ✓, which the plain S10 does not have (0) ✓; "Mula" `…/2510/jawab?scope=spm`, `…/3700/jawab?scope=spm&track=bahasa` ✓; the pager keeps `subject_id`/`scope`/`track` ✓; kbat 6 → S10 empty state, no pager ✓. Shell header per M06 DV-M06-07 (M06 v1.1 FN-M06-1.2.4), consistent. The answer-page back link (FR-137) is INFERRED from M06 FR-M06-47 and labelled provisional (AC-26.3, E2E-56). |
| AUD-M05-05 | **Closed** | DV-04 withdrawn; FR-23/28/31 all use `bankCount`. **DV-05 is now limited to Pendidikan Moral.** A live script comparison of all 31 subjects (S1 card vs S1 "Statistik Subjek" vs S2) finds only PM differing (15014 / 15414 / 15014); the other 30 agree (Pertanian and Sains Sukan are 0 everywhere). One value per subject on S1, S2 and the statistics creates no same-screen contradiction, and the S3 total stays the reachable count as live. §7.1 records the alternatives (a)/(b)/(c). |
| AUD-M05-06 | **Closed** | FN-4.3.3, FR-89 and discovery §2.7 (corrected): the failure text shows inside the same "Terima Kasih!" view with the green tick, as live and as M04 FR-M04-69. |
| AUD-M05-07 | **Closed** | FN-4.2.7 and FR-79: any JSON response (incl. error) marks the answer checked; only a network/non-JSON failure changes nothing. FN-4.2.8 and FR-80: "Lapor Soalan" comes before the feedback card. Both match the S7 source. |
| AUD-M05-08 | **Closed** | FR-98/105, BR-19/21, AC-27.6/28.6: unknown `period` → no active chip or pill (OBSERVED). New DV-M05-13 / FR-109 / AC-29.5: malformed `bulan` → current month, with live HTTP 500 recorded (re-checked: still 500). |
| AUD-M05-09 | **Closed** | BR-23, FN-5.1.8 and discovery §1.2: bands 1–2 LOTS green, 3 MOTS amber, 4–6 HOTS red, all OBSERVED. |
| AUD-M05-10 | **Closed** | BR-19: x = i·120/(n−1), y = 2 + (max − v)/(max − min)·26 → BM "0,2 60,15.6 120,28" ✓ (OBSERVED). |
| AUD-M05-11 | **Closed** | DV-11 now lists the S3 hero chip and S9 "SYILING" (10.4 px), scoped to `main` (M03 R2-24 pattern). FR-126 and E2E-54 are in step (every text node in `main` on S1/S3/S9/S12/S15 ≥12 px, icon glyphs and emoji excluded). |
| AUD-M05-12 | **Closed** | "PROPOSED COPY" convention added; DV-08 heading and all §8.3 placeholders are listed in OQ-16 for G1. AC-15.x and 16.x, E2E-21/22/23/28/38/47 are marked provisional. |
| AUD-M05-13 | **Closed** | `?level=` ignored as live (FN-2.1.6, FR-34, BR-28, AC-09.4/12.2, E2E-14); DV-03 is narrowed to `subject` and `topic_id`. |
| AUD-M05-14 | **Closed** | DV-06 withdrawn; the admin streak is seeded 1 as live (AC-04.1, 05.3); the rule is deferred to M14 with `/kombo` (OQ-14, §8). The reminder condition is labelled INFERRED. |
| AUD-M05-15 | **Closed** | §6 intro and DATA-M05-01/02: subject, level and chapter ids are int (M03 v1.3); chapter URLs use M03 seed ids (35/36 live); live 1 and 3 stay pending M03 (OQ-13 c) and are no longer asserted as seed fact. |

### Cross-module seed check against M06 SRS v1.2 §6.10

| Id | M05 v1.1 §6.12 | M06 v1.2 | Match |
|---|---|---|---|
| A2 | 2026-05-11 14:22 `latih_tubi` Sejarah 40·14, 02:11, 14 coins | `latih_tubi` SEJ 14/40 2026-05-11 14:22, 131 s | ✓ |
| A3 | 2026-05-11 14:27 `latih_tubi` BM 34·11, 01:45, 11 | `latih_tubi` BM 11/34 14:27, 105 s | ✓ |
| A4 | 2026-05-19 03:26 `past_year` BM 5·1, 00:36, 1 | `past_year` BM 1/5 03:26, 36 s | ✓ |
| A5 | 2026-05-19 03:49 `past_year` BM 5·0, 00:14, 0 | `past_year` BM 0/5 03:49, 14 s | ✓ |
| P1 | 2026-09-22 19:00 `past_year` MATH 10·4, 05:00 | same, 300 s | ✓ |
| P2 | 2026-09-24 20:15 `latih_tubi` BM 34·26, 06:00 | same, 360 s | ✓ |
| P3 | 2026-09-24 20:40 `past_year` SEJ 10·6, 04:30 | same, 270 s | ✓ |
| P4 | 2026-09-25 08:30 `ramalan` AKAUN Set 1 40·34, 15:00 | same, 900 s | ✓ |
| Totals | admin 4 / 84 / 21.8% / 26; pelajar 4 / 94 / 65.4% / 70 | same (E2E-M06-28) | ✓ |

M05's derived pelajar anchors were recomputed and hold:
- S8 30 days: 94 / 74.5% / 4 / "30m" (1,830 s).
- S6 queue: BM 8, MATH 6, SEJ 4, AKAUN 6 = 24.
- S12: BM 26/34 → L2, "26/50", bar 4%; MATH 4/10 → L0, "4/10", bar 40%.
- Kombo: no banner, because P4 is today.
- S15: all rows "Belum mula".

BR-18 now excludes `past_year` answers, so the admin May value stays at the live 74 (40 + 34) and does not become 84.

### Edited passages spot-checked (12)

1. URS §7 DV-05: limited to PM, and the replicated differences are listed with reasons ✓ (live 31-subject comparison).
2. URS §7.1: decision table, with AUD-05 alternatives recorded ✓.
3. FN-5.3.2 / FR-133: back links, headings, pill, info card ✓ (live).
4. FN-5.3.3 / FR-134: option order and values ✓ (live).
5. FN-5.3.4–5.3.5 / FR-135/136: chips, bahagian line, "Mula", pager, empty state ✓ (live).
6. SRS §6.12 seeds: admin rows are observed values; the 19/02 answers have no session ✓.
7. BR-06 / BR-20: S8, S9 and S12 sources ✓.
8. BR-18: `past_year` exclusion keeps May = 74 ✓ (labelled INFERRED).
9. FN-4.2.7 / 4.2.8 and FR-79/80 against the S7 source ✓.
10. FR-89: report failure under "Terima Kasih!" ✓.
11. BR-19: sparkline formula ✓; FR-98/105 unknown period ✓.
12. §6.10 / BR-21 session-type badges: `past_year`/`latih_tubi` "Latihan" (OBSERVED), others PROPOSED ✓. DATA-M05-01/02 integer ids and nullable `sessionId` ✓.

Discovery corrections sampled: §1 (the admin's sessions are SPM), §1.2 KBAT, §2.7 report view, §2.8 sparkline, §2.9 badge and unknown period, §2.10 SPM variants, §2.11 `bulan` 500, §2.15 S15. All agree with live.

### New finding

| ID | Severity | Doc + section | What's wrong | Evidence | Required fix |
|---|---|---|---|---|---|
| AUD-M05-16 | Minor | **M06** SRS v1.2 §6.10 seed note ("M05 A1 (2026-02-19, a non-SPM drill) is not an SPM session and is not on S10") | M06 still refers to session A1, which M05 v1.1 removed. The 19/02 answers now have no session (M05 §6.12). No M05 change is needed. | M05 SRS §6.12 row "admin — (no session) 2026-02-19"; M06 SRS line 322 | Delivery Lead: route to the M06 writer and reword it to "the 35 answers of 19/02 have no session (M05 §6.12) and do not appear on S10". |
