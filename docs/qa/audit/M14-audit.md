# M14 — Gamification (syiling, tokens, XP, tiers, challenges, achievements, kombo, referral, teacher wallet, reward control) — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M14-gamification.md` v1.0, `docs/requirements/srs/M14-gamification.md` v1.0 |
| Evidence | Discovery `M14-gamification.md` (§1–§10, D-1…D-10, Q1–Q7, Appendices A–B), `inventory/M14/*.json` (+ `_summary.md`, `_snapshot-2026-09-26.json`), `img/M14/`. Live re-walk on 2026-09-26 around 13:17 MYT on browser lane 2 with the admin account, read-only: all 22 screens plus `/kombo`, M08 `/pelajar/1`, `/prestasi/1` and `/leaderboard`. |
| Safety | A context-level route guard aborted every non-GET request. It was installed right after login and checked with a probe POST, which was aborted and never sent. Afterwards the network log shows only failed (aborted) Cloudflare RUM beacons; the two RUM beacons that went out before the guard came from the login page itself. Nothing was submitted, converted, awarded, toggled, saved, drawn or claimed. No quiz was started and no AI prompt was sent. Page loads were ≥ 400 ms apart. No screenshot was taken. |
| Cross-module docs | M05 SRS v1.8 (BR-08/09/10/25/31, §6.12, §6.13), M08 SRS v1.7 / URS (DV-M08-25, OQ-M08-06, DATA-M08-10), M01 v1.9 (FR-18, BR-24), M02 v1.11 (§6.15 id policy), M10 v1.6 (BR-M10-06/16, 700302, E2E-M10-58), M15 SRS v1.0 (XR-M15-01…08, #11, #13, BR-M15-18/19), M16 discovery (§5.8, D-M16-24), M18 discovery (S29/S31–S33), architecture overview §6.12 |
| Auditor | independent audit agent (not an author) |
| Scripts | `<scratchpad>/m14-audit/cov.cjs`, `cov2.cjs`, `trace.cjs` |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 3 |
| Minor | 9 |
| Info | 4 |

What is good:
- **Coverage is complete (script re-run).**
  - 1,759/1,759 content elements appear in the §6.1 matrix: 1,723 mapped and 36 excluded. The 36 exclusions are exactly the M16 banner triplets S11–S22-001/002/003.
  - No duplicate element and no unknown FN reference.
  - All 1,310 text-bearing elements match their inventory text.
  - 183 FNs are defined.
- **Traceability is clean (script).**
  - Counts: 183 FN, 141 AC, 41 US, 135 FR, 97 E2E.
  - There is no FN without an FR, no AC without an FR or an E2E, and no FR without an E2E.
  - 49 E2E are provisional, matching the §12 list. Every provisional AC is covered only by provisional E2E.
- **Live values are exact.** 64 claims match the live site (list below). They include:
  - the tier table and the 10 challenges, including sort orders 0/0/0/0/5…10 and the D-4 types;
  - the 25 badges with rarity counts 6/8/6/5;
  - referral links and encoding;
  - settings, costs, the draw form, S19/S20 teacher values and the 25 bank options;
  - the S4/S5 totals and filters, and the S14 podium and title checkpoints;
  - the 14-row admin ledger;
  - the M08 figures 103 / 342,703.
- **The admin mirror reconciles.**
  - The student wallet 256 equals the Σ of the 14 history rows, with "Baki: 256" last (live).
  - The teacher wallet 92,683 = 7 badge rows (92,600) + 11 activity rows (83), and it matches live S19 row for row.
- **Wallet and ledger arithmetic holds.**
  - Anchors 4001–4108: 108 rows, Σ lifetime 2,564,844; + 256 + 370 + 242 = 2,565,712. That is exact, and the generated remainder of 558,480 over 2,144 rows is feasible.
  - Tier cells: generated platinum 0, gold 21, silver 272, bronze 1,851.
  - Seven negative-token anchors, as live.
- **The designed pelajar replay recomputes exactly.**
  - 370 syiling and 916 XP (700 + 216).
  - 7/10 challenges completed on 25/09, and "+198 hari ini".
  - Every completion follows BR-12/13/14 from the M05 §6.12 sessions P1–P4.
- **pelajarmaju's challenge replay recomputes exactly**: 242 / 419, quests 4/10 as in M05. Achievements are the exception (AUD-M14-01).
- **INFERRED items are marked.** Tier assignment (BR-08), the level formula (BR-05), the title cut-offs (BR-09, also listed as PROPOSED), no streak bonus at runtime (FN-8.1.5 / BR-14) and the XP source (OQ-09) are all labelled INFERRED.
- **Privacy.** No real name appears in either document (grep). Bank data is masked by specification (SEC-M14-04, NFR-M14-04).

Why it fails (3 Major):
1. **pelajarmaju's designed seed breaks the doc's own achievement rule (AUD-M14-01).** The replay skips BR-16 although all four of pelajarmaju's sessions are practice mode. As a result S15 would show a visible contradiction, and the M05 wallet values that M14 requests (242 / 419) are wrong under M14's own rules.
2. **The S4 sort does not work on live (AUD-M14-02).** The docs specify it as working ("all descending", OBSERVED). Live ignores `sort`.
3. **The admin mirror only holds under an E2E-only clock (AUD-M14-03).** The demo build boots at 25/09 15:40. At that time 10 anchor ledger rows lie in the future and S1 "Siap Hari Ini" computes 11 instead of the observed 0.

---

## Findings

| ID | Severity | Doc & section | Issue | Live / doc evidence | Owner | Required fix |
|---|---|---|---|---|---|---|
| AUD-M14-01 | **Major** | SRS §6.11.3 (pelajarmaju row and "Achievements unlocked: none — the seed replay does not evaluate achievements"), §6.12 XR-M14-01(c); URS AC-M14-13.1, 14.1; SRS E2E-35, 36 | The designed wallets are "replayed through BR-M14-03/12/13/14 … values computed, not typed", but BR-16 is left out. pelajarmaju's four M05 sessions M1–M4 are `chapter`, `chapter`, `random` and `revision`, which are exactly the practice modes that BR-16 evaluates. Under the doc's own rules: <br>• M1 unlocks Langkah Pertama (+5 / +3 XP); <br>• M2 unlocks Pengumpul Syiling (lifetime 166 ≥ 100, +10 / +5); <br>• M3 unlocks Streak 3 Hari (streak 3, +10 / +5). <br>The seed instead shows S15 with 4 completed practice sessions against "Langkah Pertama 0/1…" locked, and a streak of 3 against "Streak 3 Hari" locked. That is a new visible contradiction; the admin's live 0/25 is explained by SPM-only sessions, which does not apply to pelajarmaju. The values requested of the G1-approved M05 (242 / 419) inherit the omission. | M05 SRS §6.12 M1–M4 modes; SRS BR-M14-16 ("evaluated after each completion of a practice-mode session"); replay arithmetic above. | M14 (product-analyst + solution-architect) | Include BR-16 in the replay. <br>• pelajarmaju becomes **267 syiling / 432 XP**, with three rows "Pencapaian: …" (23/09, 24/09, 25/09) and the balance chain re-computed. <br>• Update XR-M14-01(c) to 267 / 432. <br>• Move AC-13.1/14.1 and E2E-35/36 to pelajar2, which has no sessions (E2E-28 already shows "Pencapaian: Langkah Pertama" there), or to a fixture profile. <br>Alternatively, if the rule is kept, state the exception as a rule (for example "evaluated only for sessions after 2026-09-26") and mark it INFERRED. The first option is recommended. |
| AUD-M14-02 | **Major** | URS FN-M14-9.4.2 ("all descending", OBSERVED); SRS FR-M14-90, #28 `sort`, NFR-M14-01 | On live, `sort` does nothing. `?sort=level`, `?sort=current_syiling` and `?sort=token_balance` (with or without `tier`) keep the select on the chosen value but always list rows by lifetime syiling. The docs present sorting as observed live behaviour. A builder would add a feature live does not have, and the D11 guarantee ("no generated row enters S4 page 1") was checked only for the default order. | Live 2026-09-26: the first five rows are identical (1,018,083 / 686,730 / 135,760 / 65,129 / 60,305) for all three sort values; bronze + token_balance lists 609 / 581 / 567 first, as the default. | M14 product-analyst | Decide under D9 and write it down. <br>• **Replicate:** the select keeps the chosen value and the page links carry it, but the order is always `totalSyilingEarned` desc. <br>• **Or DV-M14-14 (broken control → apply the sort):** give the live evidence, and extend the NFR-01 anchor check to page 1 of each sorted view. <br>Relabel FN-9.4.2 accordingly and add an E2E step. |
| AUD-M14-03 | **Major** | URS §0 "Clocks", OQ-M14-16; SRS §6.11.5, §12 intro, SQ-M14-02; architecture §6.12 | The mirror clock `2026-09-26T03:45:10+08:00` is justified for the E2E, since the snapshot post-dates the project clock. But architecture §6.12 boots the dev/demo build at **2026-09-25T15:40** for everyone. At that time: <br>• anchors #53669–#53678 (25/09 16:11 → 26/09 03:32) are in the future; BR-35 defines no future relative time, so S1 "Transaksi Terkini" is undefined; <br>• S5 page 1 lists future-dated rows; <br>• Q-COMPLETED-TODAY returns **11** (the designed completions of pelajar and pelajarmaju on 25/09), not the observed **0**. <br>So the "admin mirrors live exactly" claim fails in the product the user sees. SQ-02 presents the issue as an E2E preference only. Several admin scenarios that read S1 also do not state their clock (E2E-30, 49, 51, 57). | Live S1 times are stored UTC (a row stored as 03:32 shows "1 jam yang lepas" at 13:17 MYT), confirming OQ-16. Architecture §6.12: "one clock … now = 2026-09-25T15:40:00+08:00". | M14 solution-architect; Delivery Lead decision | Raise it as a Delivery Lead decision with these options: <br>(a) move the project anchor clock to ≥ 2026-09-26T03:45:10+08:00 for all modules, re-checking relative ages (XL2-33 precedent); <br>(b) keep 25/09 15:40 and specify the demo behaviour: BR-35 for future rows, plus a D11 display rule for "Siap Hari Ini", both listed as deviations; <br>(c) make the M14 designed completions and rows avoid "today" at the project clock. <br>In every case, state the clock on every E2E row that reads S1, S5, S11 or S13. |
| AUD-M14-04 | Minor | URS DV-M14-06, FN-M14-9.1.3; SRS FR-M14-78, BR-M14-34 | DV-06 is half based on a defect that does not exist. Live bars carry `min-width: 40px` inline, so the gold / platinum / silver bars are 40 px wide and the count (13–23 px + 12 px padding) fits **inside** them. Nothing overflows. The spec leaves out the live `min-width`, and the fix's "just right of the bar end" placement changes working behaviour. The real problem is white text (`text-white drop-shadow`) on light fills. That also applies to gold #ffd700, which DV-06 does not name. | `tier-dist-bar … style="width: 1.81%; background:#ffd700; min-width:40px"`, span `text-xs font-bold text-white drop-shadow`; measured bar widths 125 / 40 / 40 / 40 px. | M14 product-analyst | Add `min-width: 40px` (live) to FN-9.1.3 / BR-34. Reduce DV-06 to "count text slate-800 on light fills (silver, platinum, gold)", drop the outside placement, and correct the evidence text. |
| AUD-M14-05 | Minor | SRS BR-M14-03, §7.1 `onSessionCompleted`, XR-M14-01, XR-M14-04(d); M05 BR-09/BR-31 | Two coin figures per session are left implicit. <br>• M05 stores the session `coinsEarned` by its own BR-09 (= correct; mission 3 × correct, decided XL2-08). M14 credits the wallet by BR-03 (flat × correct, 0 for `coinsEnabled = false`). <br>• With `flat_quiz_reward` = 2 (AC-37.4), for a complimentary student (AC-18.3) or for a mission, M05 S9 / M08 BR-M08-28 would show session coins that differ from the wallet credit. Live does diverge the same way (A2: session 14 vs ledger +42), so this is replicable, but it must be stated. <br>• BR-03 applies "flat first" but also a mission rate "when M05 passes it (INFERRED, OQ)". Precedence is ambiguous, and the mission rate is already decided in M05. | M05 BR-09 (mission 3 × correct, Delivery Lead XL2-08); live A2/A3 14/11 in M05 S9 vs +42/+22 in the ledger. | M14 solution-architect (with M05) | In BR-03, say that a passed `coinsPerCorrect` overrides the flat reward (mission = M05 BR-09) and close the OQ. State that the M05 session `coinsEarned` (BR-09) and the wallet credit may differ, as on live, and that M05 S7 "Ganjaran Anda" shows `onSessionCompleted().coinsEarned`. Add the M05 side to XR-M14-01. |
| AUD-M14-06 | Minor | SRS §6.11.1 ("runtime ids from 1000 (tables)") vs URS AC-M14-32.3 / E2E-80 ("Tebus Tunai #3"), AC-M14-40.2 / E2E-93 (draw "#1") | The id policy contradicts the ACs. A new cash request would be id 1000 ("Tebus Tunai #1000"), and a new draw would be #1000. | Doc-internal. | M14 | Pick one: live-continuing ids (cash 3, draws 1) or 1000+. Update the ACs, E2E and PROPOSED rows to match. |
| AUD-M14-07 | Minor | SRS BR-M14-29, BR-M14-21, §7.1, §6.14, BR-M14-16; M15 #13, BR-M15-18; M16 D-M16-24 | Cross-module contract names disagree: <br>• `buyTicket` refusals are `DRAW_CLOSED` / `TICKET_LIMIT` in M14, but M15 #13 expects 404 (not open) / `TICKET_CAP`. <br>• `onGameResult` is `{game, event, coins?, xp}` in BR-21, but `{game, event, xp}` in §7.1 and in the hook `gameResult`. With the setting at 1, a game other than Papan Bijak therefore has no coin input. <br>• It returns nothing, so M16 cannot fix D-M16-24 (games display syiling while `games_award_syiling` = 0). <br>• "Ahli Kotak Misteri" (10 openings) needs an M15 openings count, but no M15 query is named or requested. | M15 SRS #13 `409 TICKET_CAP \| INSUFFICIENT_BALANCE`, 404 not open; M16 discovery §5.8. | M14 solution-architect (with M15, M16) | Align the refusal codes with M15 or ask M15 to change. Unify the signature as `onGameResult(userId, {game, event, coins?, xp}) → {coinsCredited, xpAdded}` in BR-21, §7.1 and §6.14. Add a request to M15 (for example `mysteryBox.openingsCount(userId)`) and cite it in BR-16. |
| AUD-M14-08 | Minor | SRS §6.11.1, §6.3, §6.11.2 | Dataset details are inconsistent: <br>• "714 ids unused" assumes all 52,964 rows sit in ids 1–53,678, but 50 anchor rows (admin 14 + designed 36) use reserved ids 140001–140216 and are counted in the total (the page-2119 note depends on this). The gaps must be 764, or the totals do not add up. <br>• The feasibility maximum 1,508,431 uses exclusive bounds; with the stated inclusive ranges it is 1,506,287 (the conclusion is still feasible). <br>• The admin's February rows use source `legacy`, which is not in the DATA-M14-02 source enum. | Arithmetic: 53,678 − 52,964 = 714 with no room for the 50 reserved-id rows; 21 × 2,884 + 272 × 1,933 + 1,851 × 497 = 1,506,287. | M14 solution-architect | Correct the gap count (or state that the reserved-id rows replace 50 generated ids), restate the feasibility range, and add `legacy` to the enum or use an existing key. Say which of the Feb rows are M16 game rows ("Cabaran Kilat…", "Betul/Salah…"). |
| AUD-M14-09 | Minor | SRS BR-M14-05, §6.11.3, XR-M14-01(c); URS OQ-M14-03 | The designed wallets create a visible oddity. pelajar shows "Level 1" with "916/100 XP" and pelajarmaju "Level 3" with "419/120 XP" (432 after AUD-01), because the level never changes at runtime (INFERRED). How live shows xp > xpNeeded is unobserved, and the designed data now depends on it. | Doc-internal. | M14 product-analyst | Specify the S11 / M05 display for xp ≥ xpNeeded (e.g. "916/100 XP", bar capped at 100 %) as INFERRED/PROPOSED. List it in OQ-M14-12 so the Delivery Lead reports it at G1. |
| AUD-M14-10 | Minor | URS DV-M14-09 rationale, §1.1 | Two points in DV-09 need correcting. <br>• The rationale says the header chip (256) sits beside 103 on `/pelajar/1`. On live, `/pelajar/1` has no koin chip (only "🪙 103 Syiling", "397 syiling lagi ke Silver", "0 Kombo"). The chip sits beside 342,703 only on `/prestasi/1` ("342,703 Koin" and "256 koin"). For 103 the contradiction is between screens (397 vs S11 244), which is still D9 "contradictory values". <br>• Mapping S6 "Koin" to `totalSyilingEarned` makes it differ from the header "koin" (`currentSyiling`) after any conversion or spend, on the same page and under the same word. | Live 2026-09-26 `/pelajar/1`, `/prestasi/1`. | M14 product-analyst | Correct the evidence sentence. Record the post-conversion difference between S6 "Koin" (lifetime) and the header chip, either as an accepted named difference or by choosing `currentSyiling`, and inform M08. |
| AUD-M14-11 | Minor | URS FN-M14-12.1.1, 6.1.4, 10.4.2 (and conventions §0); FN-M14-6.1.9; URS §0 "Clocks" | Three gaps against the doc's own conventions: <br>• CSS upper-casing is not stated where live uses it: S10 tile labels ("LIABILITI SESI 2026", "PELAJAR MENEBUS", "JUMLAH TEBUSAN"), the S15 rarity tag ("BIASA"), and the S22 headers ("GURU", "SOALAN", "SYILING"). The convention says such cases are stated. <br>• FN-6.1.9 cites "SRS BR-M14-15" for the achievement criteria; they are in BR-M14-16. <br>• URS §0 says the hooks are in "SRS §6.13"; they are in §6.14. | Live innerText of those elements. | M14 product-analyst | Add "upper case by CSS" to the three FNs and fix the two references. |
| AUD-M14-12 | Minor | SRS §6.14 `gamificationSession`, XR-M14-01(e), SQ-M14-05; XR-M14-04 | Two hook and contract gaps: <br>• M14 asks M05 to overload the pager hook `mock.addSessions(userId, n)` with a session object. The M13 precedent added a dedicated hook (`mock.addAnswer`). <br>• XR-04 does not say what happens to `questionsCount` when a contributed question is deleted. M10 E2E-58 deletes #700302 (M10 "Jumlah" drops), while M14 S19 would keep 1. | M05 §6.13; M10 E2E-M10-58. | M14 solution-architect | Request a new hook name, e.g. `mock.addSession(userId, {mode, correct, total, timeSpentSec, at})`. State in BR-23 / XR-04 that deletions do not decrement (INFERRED, as live keeps 20,719 with no "+10" rows) and mark it provisional. |
| AUD-M14-13 | Info | SRS §6.11.5 (teachers 4207/4208) | The balances 18,140 / 163,445 are the minimum that lets the live PENDING requests exist. They are unobserved: live S22 shows no teacher with these balances among its 50 rows, which is consistent because their questionsCount is 0 and the tie order is not asserted. This is acceptable as designed data. Label it "designed (unobserved)" in the table. | Snapshot S22 rows: non-zero balances only 20,720, 10, 110, 2. | M14 | — |
| AUD-M14-14 | Info | SRS §7.1 `streak.get` callers | M18 discovery has `/kombo/sekolah/{id}`, `/kombo/ppd` and `/kombo/jpn` (active kombo per school, average kombo). They are future readers of the M14 streak store and will need an aggregate query. This does not block M14 now. | M18 discovery S29, S31–S33. | M14 / M18 (later) | Note it for M18's XL gate. |
| AUD-M14-15 | Info | DV-M14-09 "26 unchanged" | The default `/leaderboard` view read "0 Koin" as its first Koin figure today (26 in the snapshot); the period view was not investigated. The figure is M08's named period query, so M14 is not affected. | Live 2026-09-26. | M08 | M08 may re-check which period BR-M08-28's "26" belongs to. |
| AUD-M14-16 | Info | Rejected DV-10, 12, 13; approved DV-01, 02, 03, 05, 07, 08, 11 | These were re-checked on live: <br>• **Rejected, all sound:** DV-10 (7 negative token rows, data); DV-12 (534 `token_conversion` vs 535 `convert`, two named figures); DV-13 ("Susah" / "Sukar", each control consistent). <br>• **DV-01:** the header reads "Dashboard" on S1–S5 and S11–S17. <br>• **DV-02:** `/pelajar/3` is hard-coded in both `shareWhatsApp` and `whatsapp()`. <br>• **DV-03:** the server-rendered text "…PRESTASIPLUS: ! Jom latih tubi!"; filling it with the card's 38.7 % is minimal. <br>• **DV-05:** the label reads "cth: 100 syiling". <br>• **DV-07:** S14 `scrollWidth` 376 at 375; every other route ≤ 375. <br>• **DV-08:** S15 / S18 show 0 / 0 against header 1, M08 1 / 5. <br>• **DV-11:** see the discovery layout375. | Live 2026-09-26. | — | — |

---

## Coverage spot-check (sample)

Script: 1,759/1,759 covered, 0 missing, 0 unknown FN, 1,310/1,310 texts match. Manually sampled mappings, all correct:
- S1-003…014 cards; S1-015–028 distribution;
- S2-005–021 tier 1 form; S2-041 hidden perks;
- S3-017/018 Jenis; S3-033–036 Padam;
- S4-008–018 award;
- S5-031 Reset;
- S6-021 Edit; S6-158–178 reward form;
- S8-022–027 row form;
- S9-015–019 (DV-05);
- S10-038 `<details>`;
- S11-093–104 mastery;
- S12-016–018 quick buttons;
- S15-146–150 modal;
- S16-015/016 links;
- S17-029–032 empty state;
- S18-062 Kedudukan share;
- S19-060–063 buttons;
- S20-035–041 bank fields;
- S22-004/005 tabs;
- SHA-106, SHU-138–143.

## Claims verified against live (64)

| # | Claim | Result |
|---|---|---|
| 1 | S1 tab "Gamifikasi Overview"; header "Dashboard" / "Selamat datang, Admin" (DV-01 premise) | ✅ |
| 2 | S1 cards 2,255 / 3,124,192 / 7,801 / 534 / 10 / 0 | ✅ |
| 3 | Distribution order bronze, gold, platinum, silver; widths = count ÷ 2,255; colours #cd7f32 / #ffd700 / #e5e4e2 / #c0c0c0 | ✅ (`min-width: 40px` missing from the spec, AUD-04) |
| 4 | S1 recent: 10 rows "Earn", +18 / +19 / +20 quiz_spm, then daily_login +2 …; relative times follow stored-UTC (OQ-16) | ✅ |
| 5 | S2 four tiers: label, icon, colour, min, rate, order, L1–L5 1–5, PKSK 5, Papan Bijak 5 / 25, perks JSON exact | ✅ |
| 6 | S2 "🔴 Nyahaktif" ×4; tab "Tier Config" | ✅ |
| 7 | S3 "Senarai Cabaran (10)"; ten rows: titles, descriptions, icons, targets, syiling, XP, difficulty, sort orders 0/0/0/0/5–10 | ✅ |
| 8 | S3 all `quiz_count` except 3 `topic_variety` (DV-04 premise) | ✅ |
| 9 | S3 difficulty options easy=Mudah, medium=Sederhana, hard=Susah; card badges Mudah / Sederhana / Sukar | ✅ |
| 10 | S3 type options (5 keys and labels); confirm "Padam cabaran ini?" | ✅ |
| 11 | S4 "Showing 1 to 20 of 2255 results"; row 1 platinum 66 / 1,018,033 / 1 / 1,018,083 / 19,794 | ✅ |
| 12 | S4 tier filters silver 292 (first 11 / 1,916 / 4 / 2,423 / 1,058), gold 41 (13 / 4,877 / 0 / 4,937 / 268), platinum 33, bronze 1,889 (5 / 496 / 15 / 609 / 481) | ✅ |
| 13 | S4 award form: user_id number required "ID"; amount 1–10000 "100"; reason "Bonus khas / Pertandingan" required | ✅ |
| 14 | S4 `?search=zzzq` → "Belum ada pelajar dalam sistem gamifikasi" | ✅ |
| 15 | S4 `sort` applied, descending | ❌ ignored on live (AUD-02) |
| 16 | S5 "of 52964"; #53678 earn +18 6,335 quiz_spm "SPM Tahun Lepas: 18 betul — 90%" 26/09/2026 03:32 | ✅ |
| 17 | S5 spend → #42 −100 365 reward_claim "Tuntut: Lencana Super Learner" 28/02/2026 08:00; "Reset" shown | ✅ |
| 18 | S5 convert "of 535", first #53663 "Tukar 400 syiling → 8 token" | ✅ |
| 19 | S5 bonus #51 +25, #44 +50 (streak_bonus); refund "Tiada transaksi ditemui"; earn "of 52426" | ✅ |
| 20 | S5 page 2118 starts #44; "Showing 52926 to 52950 of 52964" | ✅ |
| 21 | S5 "Reset" absent without a filter | ✅ |
| 22 | S6 tab; "Tebus Tunai" badge 2; 8 badge rows name / threshold / +bonus / "Aktif" / "Edit" | ✅ |
| 23 | S6 edit form: no `required`; values name / `fas fa-seedling` / 10 / 100 / checked | ✅ |
| 24 | S6 reward form multipart: name required; cost min 1 required; stock min 0; limits min 1; image `image/*`; Aktif checked | ✅ |
| 25 | S7 pills and "Tiada tebusan pending"; back link | ✅ |
| 26 | S8 rows: request 2 18,140 / RM145.12 / Bank Rakyat / PENDING / 15 Apr 2026 13:15, then request 1 163,445 / RM1,307.56 / Maybank / 14 Apr 2026 23:04 | ✅ |
| 27 | S8 status options PENDING…REJECTED; confirm "Kemaskini status?" | ✅ |
| 28 | S8 shows the account number and holder in clear (SEC-M14-04 premise) | ✅ (masked in the rebuild) |
| 29 | S9 ten labels and keys; the `cash_rate_sen` label says "cth: 100 syiling = 8 sen" (DV-05 premise) | ✅ |
| 30 | S9 values 10, 10, 8, 100, 1, 1000, 300, 2026, 1, 0 | ✅ |
| 31 | S9 preview text exact | ✅ |
| 32 | S10 tiles RM0.00 / 0 / 0 with "2026" | ✅ (upper case by CSS, AUD-11) |
| 33 | S10 finance settings 1000 / 300 / 1 / 2026 / unchecked | ✅ |
| 34 | S10 11 cost rows with type, price, sen and RM (digital 0) | ✅ |
| 35 | S10 draw form: title required; defaults 50 / 10; `closes_at` date; `open_now`; `<details>` closed | ✅ |
| 36 | S11 hero 🥉 / 📚 Permulaan / Gangsa Tier / Level 2 / 256 / 0; "Naik ke Perak" 51.2 % "Perlu 244 syiling lagi" | ✅ |
| 37 | S11 cards +0 hari ini / 50 syiling = 1 token / 8/110 XP / +0 minggu ini | ✅ |
| 38 | S11 four challenges with 0/3, 0/80, 0/3, 0/10 and +15 / +20 / +25 / +30 | ✅ |
| 39 | S11 six recent rows, each "4 bulan yang lepas" | ✅ |
| 40 | S11 mastery L2 BM 46 / 50, 48.94 % · 1.05x; L1 SEJ 14 / 25, 35 % | ✅ |
| 41 | S11 tier grid and "✨ ANDA DI SINI"; "Perlu 44 syiling lagi untuk gelaran ini" | ✅ |
| 42 | Header chips 256 koin / 8 mata / 1 hari 🔥 | ✅ |
| 43 | S12 input min 50, max 256, value 50, placeholder "0", required; button enabled; rate line "(Gangsa)"; quick buttons; tip | ✅ |
| 44 | S13 "0/10 Selesai"; card "💰 +15 Syiling" "⭐ +10 XP" "Progres: 0/3" "0%" | ✅ |
| 45 | S14 podium 1,018,083 (centre, CSS order 2, raised), 686,730 (order 1), 135,760 (order 3), all "💎 Platinum" | ✅ |
| 46 | S14 47 rows; #4 Mitos L39 65,129; #21 Mitos L20 10,552; #22 Legenda L19 8,720; #34 Grandmaster L13 4,937; #41 Master L11 3,464; #50 Master L10 2,930 | ✅ |
| 47 | S14 `scrollWidth` 376 at 375 (DV-07) | ✅ |
| 48 | S15 streak card 0 / 1.0x / Terbaik 0 (DV-08 premise); 25 cards; first "👣 Langkah Pertama … 🪙 5 · ⭐ 3 XP 0/1"; last "🦸 Wira JomBelajar … 🪙 400 · ⭐ 300 XP" | ✅ |
| 49 | S15 progress only on the 5 kuiz badges (0/1, 0/10, 0/50, 0/200, 0/500) | ✅ |
| 50 | S15 rarity counts 6 / 8 / 6 / 5; `?rarity=zzz` 0 cards | ✅ |
| 51 | S15 `shareWhatsApp`: `/pelajar/3` hard-coded; exact text template (DV-02) | ✅ |
| 52 | S16 tiles 50 / 25; code 4JURJTT; stats 0 / 0 / 0; WhatsApp and Telegram hrefs (URL-encoded) with `_blank` | ✅ |
| 53 | S17 "Baki semasa: 256 syiling"; 14 rows; first "Cabaran selesai: Penjelajah Topik 19/05/2026 03:26 · 4 bulan yang lepas +25 Baki: 256"; last "… 11/02/2026 05:23 · 7 bulan yang lepas +4 Baki: 4" | ✅ |
| 54 | S17 pills (no refund pill) and hrefs; `?type=zzz` → empty state | ✅ |
| 55 | S18 share texts (profil, kombo 0 / 0, two mastery texts, Kedudukan ": !") and `whatsapp()` appending `/pelajar/3` (DV-02, DV-03) | ✅ |
| 56 | S19 cards 92,683 / 92,683 / 20,719 / 7/8; 8 tiles; "Seterusnya: Legenda Terulung 20,719 / 50,000 29,281 …" | ✅ |
| 57 | S19 18 history rows with exact texts, dates and amounts (Σ 92,683) | ✅ |
| 58 | S20 cards 92,683 / 92,683 / 0 / RM741.46; min 100, max 92683, step 1, required; submit disabled | ✅ |
| 59 | S20 25 bank options incl. the placeholder, in the live order; confirm "Sahkan tebus tunai?\n\n" + … | ✅ |
| 60 | S21 empty state texts; balance 92,683 | ✅ |
| 61 | S22 headers "#, Guru, Soalan, Syiling" (upper case by CSS); 50 rows; top 3,906 / 20,720, 1,559 / 0, 256 / 0, 1 / 10; `?tab=zzz` → default | ✅ |
| 62 | `/kombo` → `/dashboard` | ✅ |
| 63 | M08 `/pelajar/1` "🪙 103 Syiling", "397 syiling lagi ke Silver", "0 Kombo", "0 kombo terpanjang" | ✅ (no header chip there, AUD-10) |
| 64 | M08 `/prestasi/1` "1 Kombo Hari", "5 Rekod Terbaik", "342,703 Koin" beside header "256 koin" | ✅ |

## Checks with no finding

- **Responsive.** SRS §10 gives the behaviour of every screen at 375, 768 and 1280. All 97 E2E run at the three sizes. The live sweep at 375 found only S14 overflowing (DV-07). The table-in-card rule is consistent with NFR-RESP-05.
- **D10.** No ARIA, keyboard or motion additions. The 44 px hit areas keep the live visual size (M07/M09 precedent).
- **Counts.** Every displayed count cites a named query in §6.10. No display constant is introduced. M10's 20,719 constant stays M10's; XR-04(b) is optional.
- **SEC.** SEC-M14-01…10 cover balance races, conversion rounding, award abuse, bank PII, the cash state machine, referral abuse, farming, lucky draws for minors, public profile ids and multipart upload. They are adequate for the backend phase.
- **Seeds mirror observation.** Tiers, challenges, badges, settings, costs, cash requests, the admin ledger, the teacher ledger and anchors 4001–4108 are all as observed. Nothing is tuned: the generated remainder is derived from the totals. Designed values (accounts 2, 4 and 5, teachers 4207/4208) are declared as designed. The one exception is the achievement omission (AUD-01).

---

## Requests to approved modules

| Request | To | Assessment |
|---|---|---|
| XR-M14-01(a) The wallet/streak repository moves to M14 (same names) and BR-31 step 6 calls `onSessionCompleted` | M05 v1.8 | **Justified and minimal.** Architecture §6.7 already marks the store `owner: 'M14'` (D12). Add the coin-figure note of AUD-05. |
| XR-M14-01(b) The quest catalogue §6.10 and BR-10 move to M14; the widget reads `challenges.today` | M05 | **Justified.** S3 edits and toggles must reach the M05 widget; two catalogues would contradict each other (D12). The metrics are unchanged (the M14 replay reproduces M05's pelajarmaju quests 4/10). |
| XR-M14-01(c) Designed wallets: pelajar 370 / 916 / L1; pelajarmaju 242 / 419 / L3 / bar 100 % (was 340 / 120 / 40 %) | M05 | **Justified in principle; the values are not yet correct.** 340 / 120 appears only in M05 SRS §6.12 (ACs use "{M14 coins}"), so the change is minimal. The pelajar values recompute exactly. pelajarmaju must become **267 / 432** once BR-16 is replayed (AUD-01). The "Level 1, 916/100 XP" display must be specified (AUD-09). **Hold until AUD-01 is fixed.** |
| XR-M14-01(d) The badge shelf reads `learnerBadges.forUser` | M05 | **Justified**: one owner for the badge set also read by M08 / M10. |
| XR-M14-01(e) `addSessions` accepts a session object | M05 | **Justified need; wrong form.** Request a new hook instead of overloading the pager hook (AUD-12). |
| XR-M14-03 DV-09: M08 S6 "Koin" 342,703 → 256 (lifetime), S18 103 → 256 with "244 syiling lagi ke Silver", S18 streak 0 / 0 → 1 / 5; 26 stays; two E2E updated | M08 v1.7 | **Justified and minimal.** M08 DV-M08-25 / OQ-M08-06 explicitly left these to M14. Live shows 342,703 "Koin" beside the header "256 koin" on `/prestasi/1`, and 103 contradicts S11's balance (397 vs 244 to Silver). Only the contradicting values change; `practiceDays` and `joinedAt` stay M08's. Keeping 26 is right: it is a named period query, not a balance. Correct the DV-09 rationale and record the post-conversion divergence between S6 "Koin" and the header (AUD-10). |
| XR-M14-02(a) Login hook `gamification.onLogin` after a password login | M01 v1.9 | **Justified and minimal**: no visible M01 change; `setUser` does not call it. |
| XR-M14-02(b) Carry `?ref=` in memory/sessionStorage and send `referralCode` in the register call; the form stays as live | M01 | **Justified as provisional.** Live promises the referral rewards and links to `/register?ref=`, while the form ignores the code. Carrying it invisibly keeps FR-18's UI unchanged. M01 must label it INFERRED/provisional and never show it as observed. |
| XR-M14-05 Anchors 4001–4108 (students) and 4201–4208 (teachers) in the users dataset, no count change | M02 v1.11 | **Justified and minimal.** Both blocks lie inside 1–6,000 and are free: M02 blocks are 1–11, 2001–2012, 3001–3215, 5001–5990; grep finds no other use of 4001/4201. They take the place of generated cells. Place 4201–4208 inside the 522-teacher M11 register without changing its per-school counts, and give them a school so S22's "Sekolah" column is filled. |
| XR-M14-04(a) Contribution hook after each objective or structured create | M10 v1.6 | **Justified.** State the deletion rule (AUD-12). |
| XR-M14-04(b) S1 "Soalan" may read `questionsCount` | M10 | **Optional; recommend no change.** The DISPLAY_CONSTANT 20,719 (DV-M10-12) equals M14's value, so both stay consistent without touching an approved module. |
| XR-M14-04(c) BR-M10-16 badges read DATA-M14-20 | M10 | **Justified**: one owner. |
| XR-M14-04(d) Pass the mission `coinsPerCorrect` "if it applies (OQ)" | M10 / M05 | **Already decided** in M05 BR-09 (3 × correct, XL2-08). Close the OQ in M14 (AUD-05). |
| §6.13 Answers to XR-M15-01…08 | M15 v1.0 | **Mostly consistent.** The wallet superset, the atomic writes with M15's names, the draw ownership, the hooks, the 11-item catalogue ownership (the only admin screen and the only claim row are M14's) and the budget / S10 answers are all sound. The XR-M15-05 hint recommendation is correctly left for M15 to decide. Mismatches to fix: the `buyTicket` refusal codes, and the openings query needed for "Ahli Kotak Misteri" (AUD-07). |
| XR-M14-07 / M16 `games_award_syiling` = 0 while games display syiling | M16 (not yet at G1) | **M14 side correct**: XP only while 0 (live setting, no game rows after 25/05/2026). D-M16-24 is M16's to fix. M14 should return `{coinsCredited, xpAdded}` so M16 can show the credited amount (AUD-07). |
| XR-M14-08 (M07 PKSK mode), XR-M14-09 (shell) | M07, shell | Justified; no conflict found. |

## Safety and privacy statement

- Browser lane 2 only.
- Logged in with the admin account; the credentials were not written anywhere.
- Every non-GET request was aborted by the context-level route guard, checked twice with probe POSTs that were aborted and never sent.
- One extraction on S8 briefly returned the page text of a teacher row into the auditor's tool output. It was not saved to any file, and it is not quoted in this report or in the repo.
- The lane-2 page snapshots created by this audit were deleted. A grep of `.playwright-mcp/lane2` for the leaked tokens finds nothing.
- No screenshots were taken.
- Scratch scripts are in `<scratchpad>/m14-audit/` only and contain no personal data.


---

# Round 2 (targeted re-audit of URS/SRS v1.1, 2026-09-26)

Scope: the fixes for AUD-M14-01…12, the new clock treatment, and a regression scan.

Evidence:
- Both documents at v1.1.
- The snapshot `_snapshot-2026-09-26.json` (S5 page 1 rows #53654–#53678).
- M15 SRS v1.3.
- Scripts re-run from `<scratchpad>/m14-audit/`: `cov.cjs`, `cov2.cjs`, `trace.cjs`, plus seed arithmetic checks.

No new live check was needed: every fix is verifiable against round-1 live evidence or the snapshot. The browser was not reopened.

## Verdict: **PASS**

| Severity | Count (round 2) |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 2 |
| Info | 2 |

## Round-1 findings: status

| ID | Status | Verification (section / line in v1.1) |
|---|---|---|
| AUD-M14-01 (Major) | **Closed** | **SRS §6.11.3 L454.** pelajarmaju is 267 / lifetime 267 / xp 432 (260 + 159 + 13), with 19 rows 140201–140219. The chain recomputes: 55 → 176 (Pengumpul Syiling at lifetime 166) → 239 (Streak 3 Hari at streak 3) → 267. Achievements are 1 (23/09), 5 (24/09) and 3 (25/09). <br>**Moved scenarios.** The runtime unlock is on pelajar2: URS AC-13.1 L641; AC-14.1 L645 (lifetime 28 < 100, so only Langkah Pertama; balance 33, consistent with AC-10.1); new AC-14.3 L647 (pelajarmaju 3/25); SRS E2E-35/36 L854–855. <br>**M05 request.** XR-M14-01(c) L601 now reads 267 / 432 / L3 / "432/120". <br>The v1.0 line "the seed replay does not evaluate achievements" is gone. |
| AUD-M14-02 (Major) | **Closed** | **DV-M14-14 (URS L2856)** records the live evidence (the select is kept, the order is always lifetime) and approves the D9 fix. FN-9.4.2, FR-90 and #28 follow it. <br>**New test.** AC-26.6 L717 and E2E-67 check the first rows: token 1,764, balance 1,018,033, level 66. <br>**Anchor check.** These first rows are guaranteed because generated `tokenBalance` ∈ [0, 50] (SRS L430), balance ≤ lifetime ≤ 2,884, and level ≤ 22. The NFR anchor check is scoped to the default order, as the DV states. |
| AUD-M14-03 (Major) | **Closed** | **One project clock (Delivery Lead).** URS §0 L30, SRS §6.11.1 clock treatment L435, SQ-02 closed L927. No trace of the mirror clock remains (grep for "mirror clock", "03:45:10" and "Q-COMPLETED-TODAY" finds nothing). <br>**Future rows.** The 10 post-clock rows are recorded and not seeded; the id arithmetic holds (§ "Seed arithmetic" below). <br>**Relative times** re-derived at 15:40 from the snapshot times: #53668 15:29 → "11 minit"; #53667…#53659 → 1/1/1/2/2/2/2/2/2 jam. #53663 is the "Convert" row. This matches AC-23.4 / E2E-56. <br>**S5 page 1.** It starts at #53668 "+2 1,058 daily_login 25/09/2026 15:29", as in the snapshot (AC-27.1 L720). <br>**"Siap Hari Ini".** It is Q-DAILY-FINISHERS = 0 (SRS L412, BR-13, BR-36, FN-9.1.2, OQ-17). See Info R2-03. |
| AUD-M14-04 | **Closed** | DV-06 (URS L2848) is reduced to the text colour on gold, silver and platinum. The live `min-width: 40px` is replicated in BR-34 L296 and FR-78 L150, and in E2E-55. |
| AUD-M14-05 | **Closed** | BR-03 L265 sets the precedence: a passed `coinsPerCorrect` wins, so a mission is 3 per correct answer; then the flat reward; then the tier. It also states that the session coins may differ from the wallet credit, as on live (A2: 14 vs +42), and that M05 S7 shows the returned `coinsEarned`. XR-01(f) is added. |
| AUD-M14-06 | **Closed** | §6.11.1 L433: runtime ids continue after the highest seeded id (cash from 3, draws from 1; fixtures keep their own ids such as 1001). "Tebus Tunai #3" (AC-32.3, E2E-80) and draw "#1" (AC-40.2, E2E-93) are now consistent. |
| AUD-M14-07 | **Closed** | **Game results.** `onGameResult(userId, {game, event, coins?, xp}) → {coinsCredited, xpAdded}` is the same in BR-21 L283, §7.1, §6.14 L626 and XR-07 L607. <br>**Draw refusals.** `DRAW_CLOSED` / `TICKET_LIMIT` / `INSUFFICIENT_BALANCE` now match M15 v1.3 #13 L467, BR-M15-19 and E2E-M15-49. <br>**Openings count.** `mysteryBox.openingsCount` / Q-M15-OPENINGS-COUNT is cited in BR-16 L278 and XR-06 L606, and M15 offers it (XR-M15-12, L403 / L412). |
| AUD-M14-08 | **Closed** | 52,911 live-range rows + 53 reserved-id anchors (admin 14 + pelajar 20 + pelajarmaju 19) = 52,964. The gaps are 757 in 1–53,668 and 767 in 1–53,678. The feasibility range is 178,000–1,506,287 with inclusive bounds. The enum now has `legacy` (L357). |
| AUD-M14-09 | **Closed** | BR-05 L267 specifies the display when xp ≥ xpNeeded ("916/100 XP", "432/120 XP", full bar) as PROPOSED, and it is listed in OQ-12 L2891. |
| AUD-M14-10 | **Closed** | DV-09 L2851 and §1.1 L73–74 are corrected. `/pelajar/1` has no chip: the contradiction there is between screens (397 vs 244). S6 "Koin" = `currentSyiling`, the same word and value as the chip, with the v1.0 choice recorded as alternative (b). FR-13 L85 and XR-03 L603 are aligned. |
| AUD-M14-11 | **Closed** | "Upper case by CSS" is added to FN-12.1.1 ("LIABILITI SESI 2026"), FN-6.1.4 ("BIASA") and FN-10.4.2. FN-6.1.9 now cites BR-M14-16, and the hook reference is corrected. |
| AUD-M14-12 | **Closed** | XR-01(e) and SQ-05 request a new hook `mock.addSession(…)`; the pager hook is not overloaded. BR-23 L285: deletions never decrement `questionsCount` (INFERRED, provisional). |

## Seed arithmetic and script re-runs

- **Coverage (`cov.cjs`, `cov2.cjs`).** 1,759/1,759 elements: 1,723 mapped and 36 excluded (the M16 banner triplets). No element is missing, no FN is unknown, no row is duplicated, and all 1,310 texts match the inventory.
- **Traceability (`trace.cjs`).** 183 FN, 143 AC (new: AC-14.3, AC-26.6), 135 FR, 97 E2E.
  - There is no FN without an FR, no AC without an FR or an E2E, and no FR without an E2E.
  - 49 E2E are provisional.
  - The script's 5 remaining messages are regex artefacts, the same as in round 1: parenthetical "…, provisional" wording, and "E2E-M14" digits read as list items.
- **Ledger.**
  - Type split: earn 52,426 + convert 535 + spend 1 + bonus 2 + refund 0 = 52,964.
  - Convert split: `token_conversion` 534 + `token_convert` 1.
  - Tokens: 7,801 = the 80 of the 25 convert-page anchors + 7,721 generated.
  - The 10 unseeded rows are all `earn`, so each takes an `earn` slot and every type total is unchanged.
- **Wallets.** The anchors sum to 2,564,844 + 256 + 370 + 267 = **2,565,737**. The generated remainder is 558,455 over 2,144 rows, inside 178,000–1,506,287, so the total is 3,124,192.
- **Admin at the clock.** The wallet is 256 (all 14 rows are ≤ 19/05/2026) and the streak is 1 / 5.
- **Designed accounts.** pelajar 370 / 916 is unchanged. pelajarmaju is 267 / 432, as verified above.

## Does the treatment of the future rows alter an observed value?

**No.**
- **Observed rows.** Every observed row that is shown keeps its id, amount, balance, source, text and stored time: #53654–#53668, #53663 on the convert page, #42, #51, #44, the page-2118 rows and the admin's 14 rows.
- **Observed totals.** All are exact: 52,964 / 52,426 / 535 / 534 / 7,801, and the wallet dataset, which is independent of the ledger.
- **The 10 post-clock rows.** Their values are recorded in SRS L435, not changed. They are simply not yet present at 25/09 15:40, which is coherent with the clock. At that time live would not have had them either.
- **Screen states that change.** The only differences are the rows 16–25 on S5 page 1 and the S1 recent list, and those are clock-relative states: the observed version belongs to 26/09 11:45.

## Round-2 findings

| ID | Severity | Doc & section | Issue | Evidence | Owner | Fix |
|---|---|---|---|---|---|---|
| AUD-M14-R2-01 | Minor | SRS §6.11.1 L432 and clock treatment L435 | The text says the 10 unseeded rows are "5 `quiz_spm`, 5 `daily_login` as the observed cells". The snapshot has **4** `quiz_spm` rows (#53678, #53677, #53676, #53673) and **6** `daily_login` rows (#53675, #53674, #53672, #53671, #53670, #53669). The totals are unaffected (all 10 are `earn`, and source weights are INFERRED), but the stated split is wrong. | `_snapshot-2026-09-26.json` pages[9]. | M14 solution-architect | Change it to "4 `quiz_spm`, 6 `daily_login`" in both places. |
| AUD-M14-R2-02 | Minor | SRS §6.11.1 L433 ("Every other store") | This line still says "completions / achievements unlocked: 0". §6.11.3 seeds the designed ChallengeCompletion rows (pelajar, pelajarmaju) and pelajarmaju's 3 UserAchievement rows. The statement was already loose in v1.0 and is now wrong for the achievements. | §6.11.3 L452–454. | M14 solution-architect | Change it to "completions and achievements: only the designed rows of §6.11.3 (none for the admin)". |
| AUD-M14-R2-03 | Info | SRS Q-DAILY-FINISHERS L412; URS OQ-17 L2896 | "Siap Hari Ini" = users who completed every active challenge was chosen so that the designed completions do not show 11 against the observed 0. It is INFERRED either way, marked as such, and reported at G1 (OQ-12 L2891). On live, the old definition (completion rows today) would also have been 0 at capture: no `daily_challenge` row is dated 26/09 on S5 page 1. So both readings fit the observation, and the user can confirm at G1. This is not a tuned value. | Snapshot S5 page 1. | Delivery Lead (G1) | Confirm at G1 with OQ-12. |
| AUD-M14-R2-04 | Info | — | Regression scan found nothing else: no leftover "mirror clock", "03:45:10", `Q-COMPLETED-TODAY`, "BR-M14-15 for criteria" or "§6.13" hook reference; no real names; responsive §10 and SEC §11.1 unchanged. | grep of both documents. | — | — |

M14 may proceed to G1. The two Minors are documentation corrections and can be fixed before G1 approval without a further audit round.
