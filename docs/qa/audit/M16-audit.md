# M16 — Battle, Games & Competitions — Independent Audit (AUD, round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M16-battle-games.md` v1.0 (2,778 lines), `docs/requirements/srs/M16-battle-games.md` v1.0 (1,024 lines) |
| Evidence | Discovery `M16-battle-games.md` (§1–§11, D-M16-1…31, Appendices A–B), `inventory/M16/*.json` (+ `_summary.md`, `_crawl.json`, `_snapshot-2026-09-26.json`), `img/M16/`. Live re-walk on 2026-09-26 (about 14:20–14:35 MYT) on browser lane 3 with the admin account, read-only. <br>• A context-level route guard aborted every non-GET request. The only exception was the login POST. I verified it with POST probes before login, after login and at the end (`/permainan/roda-nasib/spin`, `/liga/sertai`, `/api/battle/quick-match`: all "Failed to fetch"). The only non-GET requests the pages made were Cloudflare RUM beacons, and all were aborted. <br>• Nothing was clicked. No room, match, queue, invitation, spin, submit, league, tournament or settings request was made, and no quiz or AI prompt was started. <br>• I read the game pages S13–S16 with a GET `fetch()` of their HTML, so their scripts never ran. `/permainan/kad-memori` was loaded once for a font sweep. It has no auto-submit, and the guard was active. <br>• Page loads were spaced at 350–450 ms or more. |
| Cross-module docs | M14 SRS v1.1 (BR-M14-21, BR-M14-35, XR-M14-07, §7 `onGameResult`), M04 v1.9, M05 v1.8/v1.9 (Q-ANS-ALL 478,499, Q-ANS-CORRECT), M02 v1.11 (§6.15 schools 10,220 / 10,212, users id policy), M07 (PKSK "Tingkatan 1/4"), M11 (BR-M11-04/05), M12 (id check), M17 SRS (user anchors 4402/4418), M18 SRS (KLUANG inactive schools), TRACKER D4/D9–D12 |
| Auditor | independent audit agent (not an author) |
| Screenshots | None were taken. Student names were never written to any file. Name checks were done inside the browser with salted SHA-256 (see "Privacy check"). |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 10 |
| Info | 5 |

What is good:
- **Coverage is complete.** I re-ran the matrix by script (`<scratchpad>/m16-audit/check.cjs`, deleted afterwards):
  - There are 32 inventory files: 1,571 content elements and 601 shell elements.
  - The matrix has 1,621 listed rows. The shell exclusions add 551 (SHA 168 + 7 + 14 = 189; SHU 285 + 12 + 2 + 5 + 23 + 30 + 5 = 362), so all 2,172 elements are accounted for.
  - There are 0 duplicates, 0 unmapped elements, 0 extras and 0 references to unknown Functions.
  - Every mapped FN exists (169 defined, 121 cited). The FN catalogue's "EL" column agrees with the matrix for every element (0 inconsistencies).
- **Traceability is clean.** The counts are 40 US, 169 FN, 168 AC (51 provisional), 140 FR (140 raw rows) and 96 E2E (96 raw rows, 39 provisional). The script found **0 errors**:
  - every FN has an FR and sits in a story;
  - every AC has an FR and an E2E, and every FR has an E2E;
  - every E2E's FR list owns its ACs;
  - the provisional marks agree both ways;
  - the "Provisional: … (39 of 96)" line matches;
  - the §3.1 table equals the derived US → FR → E2E sets.
- **The SOURCE-DERIVED values match the live page code** (claims list below):
  - Roda Nasib: the 8 segments, their weights (25/20/15/8/3/15/10/4), colours and icons, the 4.2 s spin and 5–8 turns;
  - the battle polling: 3000 ms, `maxWait = 120000`, `errorCount >= 5` and all 14 messages;
  - the scoring of Betul/Salah, Cabaran Kilat, Tembak and Susun, and the result titles;
  - `personalBest` 38 / 40;
  - the S20 countdown literal `2026-09-27T23:59:59.999999Z` (DV-17 confirmed: "1h 17j 36m" at 14:22 MYT on Saturday);
  - the S24 `spmCounts` map;
  - the banner component and `/api/tournament/active` → `[]`;
  - the Jutawan counts for grades 4, 7, 10 and 11 (all 65 cells checked equal A.7).
- **The observed seeds match live exactly:**
  - S3: weekly empty, monthly 8082 row, 7 all-time rows, the Johor filter and `?period=bogus`;
  - S4: heroes and cards of 8106, 900, 8082, 8880 and 2710, and all 21 Battle Terkini rows of 8106 / 8880 / 2710 / 8082 (scores, winner colour, A-colour rule, relative text);
  - S7 Top 10: all 10 rows × 5 values, pill colours, and "long name" flags on ranks 3, 4, 5, 7, 9 and 10;
  - the S8–S12 Pendahulu values: 10 / 8 / 10 / 1 / 6 rows;
  - S20: all 20 rows (sesi / betul / tepat);
  - leagues 1 and 2: header, code, WhatsApp URL, standings and "Sertai";
  - S28 week of 21 Sep: all 49 rows;
  - S29: 160 / 0 / 0 / 189, tiles 35, breakdown 35/6/4/3/2.
- **The approved fixes are real live defects.** Each of DV-01, 02, 03, 04, 06, 07, 09, 10, 12, 13, 15, 17, 20, 24, 27, 30, 31 and 33 was re-observed today (see the deviation review).

Why it fails (2 Major):
1. **AUD-M16-01: the S28 earlier weeks are invented and contradict live.** SRS §6.11.6 seeds the weeks of 14 Sep, 07 Sep and 31 Aug with a made-up rule: "first 48 schools; streak = 21 Sep value − 0.1 × weeks back". Live shows those weeks read-only by GET, and they differ in both membership and values.
2. **AUD-M16-02: the battle seeds mislabel every 0–0 battle, and DV-M16-26's reasoning is wrong.** The observed standings are reproduced **exactly** by the observed battle rows if a 0–0 battle is a win for player B (a non-zero tie is "seri"). The seeds mark all ten 0–0 battles "seri". This leaves S4 showing contradicting figures on the same page, which neither D9 nor D11 addresses.

---

## Findings

| ID | Severity | Doc & section | Issue | Live / cross-module evidence | Required fix (owner) |
|---|---|---|---|---|---|
| AUD-M16-01 | **Major** | SRS §6.11.6 last paragraph, §6.11.0 row "SekolahBersaingWeek" ("row values PROPOSED"); URS FN-M16-10.1.5, AC-M16-38.5; SRS E2E-M16-90 | **The earlier-week seed is invented and tuned.** It says the weeks of 14 Sep, 07 Sep and 31 Aug hold "the first 48 schools of the list above, streak = the 21 Sep value − 0.1 × weeks back … aktif and nota as 21 Sep". Live contradicts this in three ways:<br>**(a) Membership.** Each earlier week is the 21 Sep list **without 21 Sep row #46** (a Sabah school), not without #49.<br>**(b) Values.** Rows #1–#16 keep exactly the 21 Sep streaks (15.0, 9.3, 8.6, …, 4.9) in every earlier week. None of them is 0.1 lower.<br>**(c) Order and values of rows 17–20 and 46–48 differ** (table in the next column).<br>These pages are plain GETs (`?week=`). Discovery captured only their headline line, and the writer filled the rows with a formula. This breaks CLAUDE.md §6: "seeds mirror observation … never invent … never tune values". It also writes unobserved data where observation was trivially possible. The rebuild would show visibly wrong tables on three live URLs. | Live `/sekolah-bersaing?week=…` (states, %, streak; school identity compared by in-page equality only):<br>**Row order vs the 21 Sep rank:**<br>• 14 Sep: 1–17, **20, 18, 48, 19**, 21–45, **47, 49**<br>• 07 Sep: 1–18, **20, 19**, 21–45, 47, 48, 49<br>• 31 Aug: 1–16, **18, 19, 20, 17**, 21–45, 47, 48, 49<br>**Rows 17–20 and the tail that differ:**<br>• 14 Sep: #18 Kelantan 0.0 % 🔥 2.4 · #19 Selangor 0.2 % 1.8 · #20 KL 0.0 % 1.5 · #21–24 1.1 · #25–47 1.0 · #48 Selangor 0.0<br>• 07 Sep: #18 Selangor 0.4 % 1.8 · #19 Kelantan 2.2 · #20 Selangor 1.2 · #21–23 1.1 · #24–47 1.0 · #48 0.0<br>• 31 Aug: #17 Selangor 0.2 % 1.7 · #18 Selangor 0.4 % 1.2 · #19 Kelantan 1.6 · #20 Selangor 1.6 · #21–23 1.1 · #24–47 1.0 · #48 0.0<br>Nota is 0.0 everywhere, and the headers read "14 Sep 2026 · 48", "07 Sep 2026 · 48", "31 Aug 2026 · 48". | **Discovery (lane re-capture) + solution-architect:**<br>• Capture the three weeks' rows by GET (states, %, streak, nota, and the identity mapping to 21 Sep ranks, as above).<br>• Seed them exactly: the same school ids as the 21 Sep placement, minus row #46.<br>• Remove the "− 0.1 × weeks" rule and the "PROPOSED" label.<br>• Add a row assertion for one earlier week to AC-38.5 / E2E-90 (e.g. 14 Sep #18 Kelantan 🔥 2.4). |
| AUD-M16-02 | **Major** | SRS §6.11.1 (winner column of battles 18, 19, 23, 24, 31, 36, 41, 42, 44, 45 = "seri"), BR-M16-10, BR-M16-12 ("D11 display-data exception"), BR-M16-07 ("equal totals = seri"), §6.11.0 row BattleStanding; URS DV-M16-26, FN-M16-2.5.2, FN-M16-3.3.2/3.3.5, AC-M16-13.x | **The observed standings follow from the observed battles.** They do so once a **0–0 battle is counted as a win for player B**, while a non-zero tie is a draw. The count is one side per school player (intra-school battles count twice).<br>• **8090:** 9 listed battles, all 8090 v 8090, two of them 0–0. This gives 18 sides, 9 / 0 / 9, which is the observed all-time row. With the seeds' "seri" it would be 7 / 4 / 7.<br>• **8082, September:** 4 battles (30–33) give 8 sides, 4 / 0 / 4, which is the observed monthly row, battles 8 and "Pelajar" 2. DV-26 says this row "does not even match the 4 recorded battles (3 wins, 2 draws, 3 losses)", which is **false** under this rule.<br>• **8880 / 2710:** battles 35–37, with 36 being 0–0 and B = 4320 (8880). This gives 8880 2 / 0 / 1 and 2710 1 / 0 / 2, both as observed.<br>• **8106** has exactly one draw, 12 / **1** / 6. That matches battle 2 (8830–8830), the only non-zero tie on its page.<br>• **8078 and 8080** have 0 draws although their lists hold 0–0 battles (23, 24; 41, 42, 44, 45).<br>**Consequences.**<br>(a) The winner column of 10 seed rows contradicts the evidence. It is labelled neither OBSERVED nor INFERRED.<br>(b) The rebuild shows **same-page contradictions** on S4. For 8880, the cards read "3 Jumlah Battle, 2 Kemenangan" while Battle Terkini lists all 3 battles with 1 win, 1 draw and 1 loss by the seeds' rule. 2710 is the same. The standings are called a "D11 display-data exception", yet they are neither declared as DC-M16-nn nor kept away from a contradicting computed figure. This breaks D11.<br>(c) DV-26 is rejected on a factually wrong premise. Its conclusion (no student rows) may stand, but the stated reason must be corrected.<br>(d) The runtime rule BR-07 / BR-12 ("equal totals = seri") conflicts with the only observed tie semantics. | Live S3 all-time / monthly rows and live S4 Battle Terkini (scores, winner green, A/B colour) of 8106, 8880, 2710 and 8082, re-read today and equal to SRS §6.11.1 / §6.11.2. Note that live colours by **score**: a 0–0 row has no green, so the S4 row display is unaffected. | **solution-architect + product-analyst:**<br>• In §6.11.1 set `winner = 'B'` for the ten 0–0 battles. Label it "INFERRED from the observed standings (0–0 = win for B)". Keep the S4 colour rule by score, as live does.<br>• Rewrite BR-M16-12 so W/S/K and the battle count of the standings are **computed** from the Battle dataset, one side per school player at battle time. The observed rows are reproduced for 8090, 8082 (monthly), 8880 and 2710. For 8106, 8078, 8080 and 8082 all-time, generate older unlisted battles (D11 virtual rows, older than the 10 shown) to reach the observed totals. Keep only ketepatan / pelajar / skor as stored fields, or declare them DCs.<br>• If computing is rejected, declare each stored figure a DC with a D9 assessment of the S4 same-page contradiction.<br>• Fix the DV-26 reasoning.<br>• State the runtime 0–0 rule (PROPOSED) in BR-07. |
| AUD-M16-03 | Minor | URS §9 OQ-M16-15; SRS §8.2, SQ-M16-03 | **The G1 list of PROPOSED items is incomplete.** Items marked PROPOSED in the SRS but absent from OQ-15:<br>• all server validation messages V-M16-01…20 (about 20 BM strings, §5), including "Anda sudah spin hari ini."'s 409 and "Keputusan sudah dihantar." / "Keputusan tidak sah.";<br>• the league status label "Sedang Berlangsung" (BR-33);<br>• the 24 h invitation expiry (BR-06);<br>• the runtime standings formulas (`skor += round(score ÷ 100)`, Papan Bijak skor 10 × correct + 50);<br>• the Jutawan difficulty schedule and coin ladder (L15 = 1,000, L10 = 50);<br>• the Papan Bijak wrong-answer move-back, bonus / trap ±3;<br>• the Kuiz Relay speed bonus;<br>• the 8-word crossword;<br>• Kad Memori coins = `matches`;<br>• the bot accuracy 0.798 and the 10 s abandonment;<br>• seed battle `correct = floor(score ÷ 500)`;<br>• SpinStats `lastSpinDate`;<br>• the leagues' `gameMode` / `maxSchools`;<br>• the Sekolah Bersaing school placement;<br>• the anchors' grade (Tingkatan 4) and current schools. | — (internal) | **product-analyst:** Make OQ-M16-15 the complete list, the union with SRS §8.2 and every "PROPOSED" in §4–§6, as in M15 AUD-08. |
| AUD-M16-04 | Minor | SRS BR-M16-29, §6.6 (`segmentIndex 1–8`), §7 #35, §6.11.7 fixtures `spinNothing` / `spinSyiling5` ("segment 6" / "3"); URS FN-M16-7.1.3 | **Off-by-one on the wire.** The live client lands the wheel with `targetAngle = 360 − (data.result.segment_index * segAngle + segAngle / 2)`, so `segment_index` is **0-based** ("Cuba Lagi" = 5). If the SRS 1-based numbering is carried into the response, the wheel stops one segment away from the prize shown in the modal. | Live S18 script `doSpin()`; `segments` array order as A.5 | **solution-architect:** State that `result.segment_index` is 0-based (0–7). Keep 1-based numbering only as a doc label, or switch to 0-based everywhere, and fix the fixtures ("Cuba Lagi" = 5, "5 Syiling" = 2). |
| AUD-M16-05 | Minor | URS FN-M16-2.3.1, 2.4.2, 2.4.4, 2.5.4, 5.2.2; SRS FR-M16-28/31/33/37, §7.1, §8.1 | **Several SOURCE failure behaviours are attributed to the wrong handlers, or are missing.** Live code does the following:<br>• **Accept / reject challenger:** `data.error` goes to the **error banner** (`errorMsg`) and clears the incoming card. A network failure shows the banner "**Ralat rangkaian.**" This message is missing from the docs. The docs say "`data.error` or 'Ralat.'".<br>• **Send challenge:** a non-success result does nothing; only a network failure alerts "Ralat menghantar cabaran.", and the modal closes before the success alert. The docs say "alert `data.error` or …".<br>• **Accept invitation:** a non-success result does nothing; a network failure alerts "**Ralat.**" The docs say "`data.error` or 'Ralat. Sila cuba lagi.'".<br>• **Decline invitation:** failures are silent, and the row is removed only after a completed request.<br>• **Forfeit:** always reloads after a response and ignores `data.error`; a network failure alerts "Ralat. Sila cuba lagi.".<br>• **Papan Bijak quick-match start:** `data.error` shows the error line; a network failure shows "**Ralat rangkaian. Sila cuba lagi.**", which is not in §7.1 / §8.1. | Live S1 `battleLobby()` (`respondChallenger`, `sendChallenge`, `acceptInvitation`, `declineInvitation`, `forfeitBattle`), S7 `quickMatch().startSearch()` | **product-analyst:** Correct the five FNs, the FRs and §7.1 / §8.1 to the exact handler behaviour and copy above. |
| AUD-M16-06 | Minor | URS FN-M16-6.4.2, 6.5.1 ("credited projection"), 6.7.3; SRS FR-M16-92, BR-M16-28, §7 #32 / #34 | **DV-M16-23 cannot be built as specified.** The in-game counters of Tembak and Susun and the per-answer syiling shown during play must show the credited amount before `onGameResult` runs at submit. The client therefore needs to know whether games pay syiling. §7 #32 (payload) and #34 (Roda Nasib) return no such flag, and "credited projection" is not defined anywhere. | — | **solution-architect:** Add `coinsEnabled` (= M14 `games_award_syiling` = 1) to #32 and #34. Define the projection as the computed amount when enabled, else 0. The result tiles use the returned `coinsCredited`. Reference it in FR-92. |
| AUD-M16-07 | Minor | URS FN-M16-1.4.1, AC-M16-04.1; SRS FR-M16-12, E2E-M16-12 | **The DV-M16-24 list misses live sub-12 px texts:**<br>• S7 "Sistem cari pemain sepadan secara automatik" 10 px, the initials circles 11.2 px, and the "Subjek" / "Padanan" labels 10 px (the last only under "S7 labels");<br>• S29 "Tetapan papan permainan ular & tangga (50 petak)" 10 px, "Permainan yang tersedia dalam sistem" 10 px, suffix "petak" 10 px, and bar label "35 soalan" 9 px;<br>• the darjah picker group label "🏫 Sekolah Rendah" 10.4 px (S19, the same template on S13–S16).<br>The rule says "every M16 text", but E2E-12 checks only "the FN-M16-1.4.1 elements". | Live sweep at 375 of every leaf text node in `<main>` on S1–S12, S17–S20, S23–S29 | **product-analyst:** Complete the list. Make E2E-12 a sweep of every visible text node below 12 px on the M16 screens (M15 precedent). |
| AUD-M16-08 | Minor | URS FN-M16-3.3.5, §7 (no DV), FN-M16-1.4.2; SRS §10 row S4; discovery `_summary.md` ("Horizontal page overflow: flagged in none") | **S4 scrolls the page horizontally at 375 on live.** On 8106 / 8090 / 8082 the Battle Terkini rows push the "{n} bulan yang lepas" span (`ml-auto text-xs`) past the viewport. The document `scrollWidth` is 406 / 392 / 416 against a 360 client width, with long player names. School 900 (empty) does not scroll. This is layout breakage under D9 with no deviation entry and no specified fix. With fictitious names it may or may not reproduce. | Live 375 × 812: `/battle/ranking-sekolah/8106` scrollWidth 406, 8090 392, 8082 416, 900 360 | **product-analyst:** Add a DV: Battle Terkini names truncate or wrap and the time stays inside the row (minimal: `min-w-0` + truncate on the name, as S7 truncates). Put the rule in SRS §10 S4 and add S4 with long fictitious names to E2E-13. |
| AUD-M16-09 | Minor | URS FN-M16-1.1.1, 1.1.2, AC-M16-01.1 | **The menu entries lack live icon colours and the active rule** (same issue as M15 AUD-06).<br>• Sidebar: "Sekolah Bersaing" `fa-trophy text-amber-500` (both entries), "Liga Pertandingan" `text-yellow-500`, "Tournament" `text-amber-500`, "Permainan 🎮" `fa-gamepad` with **no colour on its active page** while the drawer copy has `text-purple-500`.<br>• Admin: the sidebar group items are `text-slate-400` at `text-xs`, and the "Lagi" items are `text-red-500` / `text-emerald-500`. | Live `/permainan` and `/admin` DOM, 1280 | **product-analyst:** Add the colour classes and the active-icon rule to FN-1.1.1 / 1.1.2, and pass them to the shell owner (XR-M16-06). |
| AUD-M16-10 | Minor | SRS XR-M16-04 (b), §6.11.2 hero lines | **M18 already anchors 8880 and 2710** as the "2 inactive in KLUANG" schools of the M02 register (M18 SRS §6 data table). XR-04 asks M02 for 2710 "SK, Johor, PPD KLUANG" and confirms 8880 without `isActive`. If M02 applies M16's request literally, the two modules may disagree on the 8 inactive schools. | M18 SRS L426 | **solution-architect:** In XR-04 state `isActive = false` for 8880 and 2710, as M18 does. Cite M18 so the XL batch sees one definition. |
| AUD-M16-11 | Minor | SRS XR-M16-07, BR-M16-37 | **The shared formatter change is not neutral for M14.** M14 BR-M14-35 renders 7–29 days as "{n} hari yang lepas" (its own INFERRED rule, not observed). XR-07 says M14 is "unchanged", but adding the week step changes M14's output for those ages. The change is justified (Laravel `diffForHumans` uses weeks, and live S4 shows "1 minggu yang lepas"), but the request must say so. | M14 SRS BR-M14-35 | **solution-architect:** Reword XR-07: "M14 BR-M14-35 changes for 7–29 days ('{n} hari' → '{floor(d ÷ 7)} minggu'); M14 checks any AC/E2E asserting 'hari' ≥ 7". |
| AUD-M16-12 | Minor | URS DV-M16-32 (DC-M16-02); SRS §6.10 Q-JUT-COUNT, XR-M16-01, SQ-M16-05 | **DC-M16-02 is a data store, not "a few display figures".** DC-M16-01 (10,218) is a valid D11 exception: a single observed figure, S3 subtitle only, never next to a contradicting computed figure, and no M02 query gives it (10,220 / 10,212). DC-M16-02 is **143 cells (Σ 149,911)** of M04 question-store facts held as M16 constants. That strains the D11 exception ("a few observed display figures") and D12 (question counts belong to M04). The live values are correct (65 cells re-read today). The provisional Jutawan game would sample a different pool (Q-ELIGIBLE) from the count it advertises. | Live S19 `?darjah=4/7/10/11` equal A.7; TRACKER D11 (XL-34) | **solution-architect / Delivery Lead:**<br>• Keep DC-02 only as an interim.<br>• Mark XR-M16-01(a) **blocking** for the XL batch before M16 build.<br>• Record in DV-32 that the game will sample the same M04 store once it exists, so the advertised count and the playable pool agree. |
| AUD-M16-I1 | Info | SRS BR-M16-08, SQ-M16-03 | **The bot accuracy is a hard-coded 0.798.** It equals M05 Q-ANS-CORRECT ÷ Q-ANS-ALL (381,842 ÷ 478,499). The TRACKER records an open M17 item on platform accuracy (82.9 % vs M05). The parameter is labelled SIMULATION and does not affect any displayed figure, so it is acceptable. | TRACKER 2026-09-26 row (M17 XR-03) | Optionally compute the value from the two M05 queries when the mock starts, so it follows any XL change. |
| AUD-M16-I2 | Info | URS DV-M16-13 | **Re-measured the league 2 table.** At 375 the T4 table is **471 px** in a 310 px `overflow: visible` wrapper (the docs say 335). The conclusion ("Purata" is cut; fix it with in-card scroll) is unchanged. | Live `/liga/2` at 375 | Optionally correct the figure. |
| AUD-M16-I3 | Info | URS §6.1 S17 rows (EL-S17-023, 048, 049, 068, 083, 087, 098) | **Six single first names in the Kad Memori card texts** (M04 question-bank content, e.g. "Di rumah, {first name} mengasingkan …") coincide with name words of live students. They are fictional characters of exam questions, already accepted by discovery. They are not personal data. | In-browser salted hash comparison | None. The rebuild's cards come from M04 anyway. |
| AUD-M16-I4 | Info | SRS §11.1 | **Every GET of a game page creates a server session** (`session_id` in the HTML, §7 #32 "Mut. yes"). This is a state change on GET, which matters for CSRF / prefetch in the backend phase. The SEC list is otherwise adequate. | Live S13–S16 HTML | Optionally add a SEC note: create sessions on an explicit POST in the backend. |
| AUD-M16-I5 | Info | URS FN-M16-1.3.2–1.3.4; SRS §6.13 | **The banner contract is complete for behaviour.** Presentation details are missing from the FNs:<br>• title `text-sm font-bold text-gray-800`;<br>• line `text-xs text-gray-500`;<br>• badges `px-3 py-1 rounded-lg text-xs font-bold`;<br>• `live_match` takes precedence over `status`;<br>• any non-`registration` status reads "Sedang berlangsung". | Live `tournamentBanner()` template on `/tournament` | Optionally add these to the FNs. |

---

## Deviation review (DV-M16-01…34)

| DV | Doc status | Audit | Reason (live today) |
|---|---|---|---|
| 01 header titles S6–S21 | Approved | **Agree** | Live header is "Dashboard" / "Selamat datang kembali" on `/permainan` and `/permainan/roda-nasib`. Shell rule DV-SH-03 applies. |
| 02 S28 in user shell | Approved | **Agree** | A non-admin route linked from the user sidebar ("Sekolah Bersaing NEW", `data-tip` "Leaderboard mingguan sekolah-sekolah Malaysia") renders admin chrome. |
| 03 Sambung Kata 500 | Approved | **Agree** | GET → HTTP 500, body length 0 (browser error page). The S28 handled page exists and is reused. |
| 04 S2 pills work | Approved | **Agree** | The pills are `@click="period = 'weekly'/'monthly'"` only, and the table is server-rendered (a control that does nothing). The seed is empty for both periods, so there is no visible difference in the seed. |
| 05 Batal sends nothing | Rejected | **Agree** | `cancelSearch()` only resets state. This is deliberate. |
| 06 Cabaran Masuk auto-open | Approved (waiting side replicated) | **Agree** | `showInvitations = true` appears nowhere in the markup (no opener). `requestJoinQueue` has no caller. Auto-open adds no control or copy, so the fix is minimal. |
| 07 flash at top | Approved | **Agree** | `/perang-fakta/XXXXXX` → 200 `/perang-fakta`, with the flash at y = 1,081 in an 800 px viewport (off-screen). `/papan-bijak/ZZZZZZ` → 404 stays. |
| 08 tie order | Rejected | **Agree** | Three loads of `/perang-fakta` gave three different orders of the tied rows (hash comparison). A stable seed order is one of the live orders. |
| 09 podium rows 1–3 | Approved | **Agree** | Live podium: 8090 519 left, 8106 738 centre, **8082** 367 right. Table #3 is 8078. |
| 10 S4 period boxes | Approved | **Agree** | Live 8106 shows "Minggu Ini #1 · 15 · 10/1/4 · 684" and "Bulan Ini #3 · 30 · 15/0/15 · 303" (8080's all-time figures). 8880 and 2710 both show "#1"/"#2" weekly while S3 weekly is empty. The fix changes only the contradicting boxes. See AUD-02 for the computed 8082 monthly row, which the rebuild keeps. |
| 11 league 1 status | Rejected | **Agree** | The status is stored ("Akan Datang" `!bg-amber-100`, league 2 "Tamat" `!bg-slate-200`). When unsure, follow live. |
| 12 BM enum labels | Approved | **Agree** | Live S25 chip "School" and S27 subtitle "Friendly · School" are raw enums. S26 labels them "Sekolah" / "Persahabatan". |
| 13 S27 in-card scroll | Approved | **Agree** | The table is clipped at 375 (I2). |
| 14 Papan Bijak chip | Approved | **Agree** | Live hub shows "🆕 Belum main lagi" and "🆕 Belum battle lagi", while the same account is Top 10 #1 with 6 games. |
| 15 "2-6 pemain" | Approved | **Agree** | Live S29 "Multiplayer 2-4 pemain." vs S7 `max_players` 2–6 (default 4). The fix changes one digit. |
| 16 Selesai 0 | Rejected | **Agree** | Live 160 / 0 / 0 / 189. A fix would require tuning room statuses. |
| 17 week end MYT | Approved | **Agree** | The literal `2026-09-27T23:59:59.999999Z` is 08:00 MYT Monday. At 14:22 MYT Saturday live read "1h 17j 36m". |
| 18 nothing under picker | Approved | **Agree** | The HTML initial state is `phase: 'countdown'` with the picker present. The submit code exists in the same component. |
| 19 Darjah 1–4 | Rejected | **Agree** | The same deliberate limit as M03 / M05 (D10). `?darjah=7…11` works (Jutawan "TINGKATAN 1/4/5"). |
| 20 quick-match error visible | Approved | **Agree** | Live `<div x-show="error">` sits inside the searching block after "Batal Carian". Every error path sets `searching = false`. |
| 21 Kad Memori "sebelum masa habis" | Rejected | **Agree (borderline)** | The copy promises a time limit the game lacks. It is promotional card copy, and "when unsure, follow live" applies. There is no new copy. |
| 22 Roda Nasib "bonus XP" | Rejected | **Agree (borderline)** | Same reasoning as 21. |
| 23 syiling shown = credited (0) | Approved | **Agree, with AUD-06** | M14 sets `games_award_syiling` = 0 and pays nothing (admin wheel "2 kali spin · 0 Syiling dimenangkan"). Live nonetheless shows "Ditambah ke akaun kamu!" and computed tiles: a false statement, so broken under D9. The fix is minimal: amounts become 0, and the two modal lines and the coin-fly hide only while nothing is credited. The layout and the setting-1 case stay. M14 XR-M14-07 asks for exactly this. The descriptive copy ("menang sampai 1,000 Syiling", "+100 🪙") correctly stays, because it describes a configurable economy. Implementability gap: AUD-06. |
| 24 text ≥ 12 px | Approved | **Agree, list incomplete (AUD-07)** | Confirmed: S6 badges 10.4, S7 table header 10.4, pills 11.2 ("0.7rem"), S19 heading 10.4 / counts 11.2, S27 "KOD JEMPUTAN" 10, S28 "AKTIF" 11.2, S29 tiles 9 at 375, S15 "⚠ GARIS MAUT" (`deadline-label`). |
| 25 S28 0.0 % vs 15.0 | Rejected | **Agree** | The rounding explanation is consistent across all 49 rows. |
| 26 S2 empty vs S3 | Rejected | **Conclusion agreed, reasoning wrong (AUD-02)** | The claim that the monthly row does not match the battles is false (4 battles × 2 sides = 8, 4 / 0 / 4, with 0–0 → B). Student rows still cannot be derived without inventing values. |
| 27 "Simpan Draf" visible | Approved | **Agree** | Live `bg-gray-600 text-white`, computed background `rgba(0,0,0,0)`, `name=action value=draft`. |
| 28 empty exam-paper select | Rejected | **Agree** | Data state. |
| 29 `?period=bogus` | Rejected | **Agree** | Live shows 7 all-time rows with no active pill. |
| 30 `?week=bogus` ignored | Approved | **Agree** | Live 500 "Ralat Pelayan". |
| 31 PKSK "Tingkatan 1/4" | Approved | **Agree** | Live "Tahap 1 (Darjah 1-3)" / "Tahap 4 (Darjah 4-6)" vs M07's T1 / T4 = entry to Tingkatan 1 / 4 ("PKSK Tingkatan 1 (SBP/MRSM)"). A wrong cross-module label; icons and values stay. |
| 32 DC-01 10,218 / DC-02 Jutawan | Approved (D11 exception) | **DC-01 agree; DC-02 interim only (AUD-12)** | The subtitle reads "Ranking 10,218 sekolah seluruh Malaysia" on every period. M02 has 10,220 / 10,212. |
| 33 `/liga/sertai`, spin GET → 404 | Approved | **Agree** | Live GET `/liga/sertai` 500 and `/permainan/roda-nasib/spin` 405. |
| 34 fictitious names | Approved | **Agree** | Real minors' names appear on 14 live screens (see the privacy check). The docs use anchors 4301–4377 / 4401 only. |

### Specific assessments requested

- **DV-23 (show only coins credited, i.e. 0).** The fix is correct and minimal, and it is the owner's request (M14 BR-M14-21 returns `coinsCredited`; XR-M14-07). It changes values, not layout. One gap remains: the live in-play counters need a flag before submit (AUD-06).
- **DV-32 (10,218 and the Jutawan counts as display constants).**
  - 10,218 meets the D11 exception exactly. It is one observed figure that no M02 definition reproduces, it is shown only on S3, and it is never next to 10,220.
  - The 143 Jutawan cells are correct values, but they are an M04 store in disguise. They are acceptable only as an interim until XR-M16-01 is answered, and that answer should be blocking before build (AUD-12).
- **The 79.8 % bot.** It is a SIMULATION parameter derived from the M05 named queries (381,842 ÷ 478,499 = 0.798). It is deterministic (stream `m16:battle:<uuid>`) and never displayed. It is acceptable. It should reach the G1 PROPOSED list (AUD-03), and it could be computed from the queries rather than hard-coded (I1).

---

## Claims verified against live (2026-09-26, lane 3)

These cover about 95 of the 169 Functions (> 25 %):
- 1.1.1–1.1.4, 1.2.3, 1.2.4, 1.3.1–1.3.5, 1.4.1, 1.4.2;
- 2.1.5, 2.2.3–2.2.5, 2.3.1, 2.3.2, 2.4.1–2.4.4, 2.5.4;
- 3.1.1, 3.1.2, 3.2.1–3.2.5, 3.3.1–3.3.6;
- 4.1.2–4.1.4, 5.1.3, 5.2.2, 5.2.3, 5.3.1, 5.4.1, 5.4.4, 5.4.5;
- 6.2.3, 6.3.3, 6.4.3, 6.5.4, 6.7.1, 6.7.2;
- 7.1.1–7.1.4, 7.2.1, 7.2.2, 7.3.1, 7.3.2, 7.3.4, 7.5.1;
- 8.1.1–8.1.3, 8.2.4, 8.2.7;
- 9.1.1–9.1.3, 9.3.1–9.3.6;
- 10.1.1–10.1.6, 11.1.1–11.1.3.

**S3 school ranking**
1. S3 tab "Papan Ranking Sekolah"; header "Papan Ranking Sekolah" / "Ranking 10,218 sekolah seluruh Malaysia".
2. S3 pills: `?period=weekly/monthly/all_time` (with `&state=Johor` kept); active `bg-blue-500`.
3. S3 weekly: "Belum ada data ranking. Mula battle untuk melihat ranking sekolah!", no podium.
4. S3 monthly: #1 8082 · 8 · "4/ 0/ 4" · 58 % · 2 · 591.
5. S3 all-time: the 7 rows exactly as SRS §6.11.2 / AC-12.3.
6. S3 Johor: rows #5 8880 and #7 2710; podium present (national).
7. S3 `?period=bogus`: 7 rows, no pill active (DV-29).
8. Podium order: 8090 519, 8106 738, 8082 367 (DV-09).

**S4 school detail**

9. S4 heroes: 8106 / 8082 "PPD HULU LANGAT · Selangor · SMK", 8880 "PPD KLUANG · Johor · SMK", 2710 "PPD KLUANG · Johor · SK", 900 "PPD KUALA LANGAT · Selangor · SK".
10. S4 cards: 8106 19 / 12 / 69 % / 7; 8082 40 / 20 / 29 % / 18; 8880 3 / 2 / 33 % / 1; 2710 3 / 1 / 8 % / 1; 900 0 / 0 / 0 % / 0 with every empty text.
11. S4 live period boxes are stale (DV-10 evidence).
12. S4 8106 Battle Terkini: 10 rows equal §6.11.1 #1–#10, including the green and slate/blue rules.
13. S4 8082: rows #30–#34 equal the seeds.
14. S4 8880 and 2710: rows #35–#37 with 4320 slate on 8880 and blue on 2710 (AC-13.6).
15. `/battle/arena/0000…` → 404; `/papan-bijak/ZZZZZZ` → 404.

**S2, S5, S6**

16. S2: pills are x-data only; empty row text as FN-3.1.2.
17. S6: 18 card h3s in the AC-14.2 order. The banner `x-data="tournamentBanner()"` is the first child of `<main>`.
18. S6 chips: "🆕 Belum main lagi" and "🆕 Belum battle lagi" (DV-14 evidence).

**S7–S12 lobbies**

19. S7 Top 10 head "#, PEMAIN, 🏆 MENANG, 🎮 JUMLAH, 📊 KADAR, ⭐ SKOR, ✅ BETUL" (upper case by CSS).
20. S7 Top 10: 10 rows equal §6.11.3, with pills `#FEF3C7/#92400E`, `#D1FAE5/#065F46` and `#FEE2E2/#991B1B`. Truncated names are 15 + "..." = 18 characters.
21. S7 `max_players` 2–6, default 4.
22. S8–S12 heroes, subtitles and rule lines exactly as FN-5.4.1.
23. S8–S12 Pendahulu value lists equal §6.11.3 (5, 4, 3×5, 2×3; 2, 1×7; 2, 2, 1×8; "1 kali MVP"; 1×6).
24. `/perang-fakta/XXXXXX` redirects with the flash off-screen (DV-07).

**S13–S16 games** (read from HTML, scripts not run)

25. Betul/Salah: `timeLeft: 45`, `points = 10 + min(streak,10)*2`, `syilingEarned += min(streak,5)`, submit body `{session_id, correct_count, total_answered, streak, score, syiling_earned}`.
26. Cabaran Kilat: `timeLeft: 60`, `multiplier = min(combo,10)`, `score += 10*multiplier`, `syiling += multiplier`, submit body with `max_combo`.
27. Tembak: `baseSpeed = max(5, 15 − (level−1)*0.7)`, tiles 1.8 s apart, `score += 10*level`, titles 500 / 200 / 80, submit body with `max_level`.
28. Susun: check `toLowerCase().trim()`, `syiling += ceil(points/3)`, submit body `{session_id, solved_count, total_puzzles, score, syiling_earned}`.
29. Coin-fly count `min(max(ceil(syiling/3),3),10)` (full mode).

**S18 Roda Nasib**

30. Chips "🎰 2 kali spin", "🪙 0 Syiling dimenangkan"; button "🎯 SPIN!"; canvas 380 × 380.
31. Segments equal A.5 exactly; `setTimeout(…, 4200)`; `spins = 5 + random*3`.
32. The refusal path is `alert(data.message)` + `alreadySpun = true`. `segment_index` is 0-based (AUD-04).

**S19 Jutawan**

33. Headings "📚 PILIH SUBJEK (DARJAH 4)" / "(TINGKATAN 1)" / "(TINGKATAN 4)" / "(TINGKATAN 5)", 10.4 px.
34. Counts for D4, T1, T4 and T5: all 65 cells equal A.7.

**S20 Pertandingan**

35. Week "21 Sep — 27 Sep 2026", countdown to the UTC literal (DV-17), refreshed every 60 s, "Tamat!" at the end.
36. Prizes "🥇 Juara +100 🪙 …".
37. Ranking: the 20 rows equal §6.11.4 (Σ sesi 138, Σ betul 2,098).

**S22 and error routes**

38. S22 GET → 500, empty body (DV-03).
39. `/liga/sertai` 500; spin GET 405; `?week=bogus` 500 "Ralat Pelayan …".

**S23–S24 tournaments**

40. S23: hero, "Cipta Tournament Baru", "Tiada tournament aktif buat masa ini."; `/api/tournament/active` → `[]`.
41. Banner script: fetch once with `Accept` + `X-Requested-With`, `res.ok` guard, errors swallowed. The template's classes and states are as FN-1.3.x.
42. S24: `tournamentForm()` spmCounts `{BM:25, BI:40, …, ADDMATH:20, …, TI:40}`; default `hybrid` / `subject` / 40; action `/tournament/admin`.
43. S24 "Simpan Draf" is transparent (DV-27).

**S25–S27 leagues**

44. S25: "Sertai dengan Kod", "Liga Saya (0)", "Liga Terbuka (1)"; card "Liga Sejarah 2026 5ST · Akan Datang · School · Persahabatan · Sejarah · 31/03 - 01/04/2026 · 3 sekolah · Lihat →" → `/liga/1`.
45. League 1: "Friendly · School", "Tingkatan: T5", `RMU4VCBS`, the exact WhatsApp URL (`_blank`), "Sertai Liga Ini", no standings.
46. League 2: "Tamat", "Bahasa Melayu", "01/04 - 30/04/2026", "2 sekolah", "Jumlah Markah", "T4, T5", `TEST2026`, no "Sertai", tabs T4 / T5.
47. League 2 rows: T4 1 · 8 · 2,935.0 · 77.2 % and 2 · 0 · 0.0 · 0.0 %; T5 both 0.

**S28 Sekolah Bersaing**

48. Week of 21 Sep: 49 rows equal §6.11.6 (state, %, streak, nota).
49. Earlier weeks differ from the seed (AUD-01).

**S29 settings**

50. Tiles 160 / 0 / 0 / 189.
51. Input 35 (min 0, max 38) and the help text.
52. Breakdown 35 / 6 / 4 / 3 / 2; bar "35 soalan · 10 khas · 3 biasa".
53. Game cards as FN-11.1.3, with live "2-4" (DV-15).

**S1 battle lobby**

54. S1 script: `maxWait = 120000`, the `errorCount >= 5` messages, and 11 distinct `/api/battle/*` literals (plus the invite accept / decline templates).
55. S1: PKSK level buttons "Tahap 1 (Darjah 1-3)" / "Tahap 4 (Darjah 4-6)" (DV-31).
56. S1: no `showInvitations = true` opener (DV-06).

**Menus and responsive behaviour**

57. User sidebar entries, targets and `data-tip`; drawer and bottom-nav "Game"; admin "Battle & Permainan" links, the "Lagi" subset and "Sekolah Bersaing" (AUD-09 for colours).
58. No horizontal page scroll at 375 on S1–S3, S5–S12, S17–S20, S23–S29. **Exception: S4** (AUD-08).
59. Tables at 375: S3 560 in 342 `auto`, S7 467 in 291 `auto`, S27 471 in 310 `visible` (clipped).

---

## Checks with no finding

- **Every count is a named query or a display constant**, apart from AUD-02 (battle standings), AUD-12 (DC-02 scope) and the fixed "Lagi 24 subjek lain" (31 − 7 subjects of M03).
  - Covered: S29 tiles, S25 / S27 counts, S18 chips, S19 stats, S20 rows, S28 header, the Top 10 and Pendahulu, the S6 chips and the banner.
- **Seeds mirror observation** for S3, S4 rows, S7–S12, S20, leagues, S28 21 Sep, S29, personal bests and spins. The exceptions are AUD-01 and AUD-02.
- **The cross-module sums hold.**
  - The S20 anchors give 138 sessions and Σ 2,098 correct, as XR-03 states.
  - The user anchors 4301–4377 and 4401 do not collide with M14 (4001–4108, 4201–4208), M15 (3151/3152), M08 / M09 blocks, or M17's observed 4402 / 4418 and 2013–2060.
- **The cross-module requests are justified.**
  - XR-01, 02, 03, 05, 06 and 08 are justified and minimal. XR-02's extra `correct` / `total` / `detail` fields exist only to keep the observed M14 ledger wording.
  - XR-04 needs the inactive flag (AUD-10), and XR-07 needs its M14 impact stated (AUD-11).
- **D10 is respected.** Native bubbles, alerts and confirm; no added ARIA; animations as live; no reduced-motion change.
- **Unobserved behaviour is labelled.** The arena, rooms, tournament detail, Jutawan game, POST outcomes and bots are PROPOSED / INFERRED / SIMULATION and provisional (51 AC / 39 E2E). The exceptions are AUD-01 and AUD-02(a).
- **Responsive behaviour** is specified for every screen at 375 / 768 / 1280 (SRS §10), and every E2E runs at all three. The only gap is S4 (AUD-08).
- **The SEC items are adequate.**
  - Covered: client scoring and shipped keys, CSRF, opponent search exposing minors, IDOR on queue and battle ids, unlimited invites, the client-side daily spin, public leaderboards of minors, league codes, 500 on bad input, and admin routes guarded by prefix.
  - One optional addition: I4.
- **The tournament banner contract** (§6.13) is complete for data, request, states, links and the exclusion rule for other modules, and it matches the live component (I5 for presentation).
- **D4 simulation is specified.** It uses named PRNG streams, the kept polling contracts and test hooks, and every simulated assertion is provisional.

## Privacy check

- **Docs versus live names.**
  - Person names were read from 14 live pages inside the browser: S4 Battle Terkini (6 schools), the S7 Top 10, the S8–S12 Pendahulu lists, the S20 ranking and the league 1 creator. That is 163 name strings and 207 distinct words.
  - They were compared with every word (4 letters or more) of the URS, the SRS and the discovery narrative. Only salted SHA-256 prefixes left the page.
  - **21 hits.** 15 are UI words ("Admin", "Prestasi", "Multiplayer", "Jemputan", …). 6 are single first names that occur in the docs **only** inside M04 question texts of S17 memory cards (I3).
  - **No surname or full name of a live person appears in the docs.** The docs name only anchors 4301–4377, 4401, the canonical accounts and public school ids.
- **During the walk**, two early extraction scripts returned a few live student names into the transient tool output. They were never written to any file. Every later read used masking or hashing.
- **Clean-up.**
  - No screenshots and no unmasked dumps were written.
  - The scratch scripts (`<scratchpad>/m16-audit/`, `.playwright-mcp/lane3/m16-audit/`) were deleted.
  - The lane-3 console log holds only resource, service-worker and aborted-request lines.
  - The credentials were not written anywhere.

---

# Round 2 (targeted re-audit of URS/SRS v1.1, 2026-09-26/27)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M16-battle-games.md` v1.1 (2,783 lines), `docs/requirements/srs/M16-battle-games.md` v1.1 (1,211 lines) |
| Method | **Live, lane 3, admin, read-only.** <br>• The context-level guard aborted every non-GET request except the login POST. I verified it with a POST probe before and after login, and again after the browser restart (rate-limit pause): every probe was blocked. <br>• The only pages loaded were `/sekolah-bersaing` and its three `?week=` variants, spaced ≥ 450 ms. <br>• No names were stored. Rows were identified by their 21 Sep rank, compared by equality inside the browser. <br>**Scripts** (`<scratchpad>/m16-audit-r2/`, deleted afterwards): <br>• `sb.cjs`: SRS §6.11.6 versus the top-up capture, cell by cell. <br>• `br12.cjs`: recomputes BR-M16-12 from the 47 listed battles of §6.11.1 plus the 24 generated battles described there. <br>• `check.cjs`: coverage and traceability, as in round 1. <br>**Regression grep** over the changed rules, ids and messages. |

## Top-up TU-M16-01 (saved to `docs/discovery/inventory/M16/_topup-2026-09-26.json`)

The file holds all 48 rows of each earlier week: position, 21 Sep rank, state, % Aktif, Streak Avg and Nota. It holds no school or person names. The membership, order and every cell the writer had already seeded agree with this capture, apart from the three cells marked below.

| Week | Cell (position → 21 Sep rank) | Live value | v1.1 seed |
|---|---|---|---|
| 14 Sep 2026 | pos 17 (→ 17) % Aktif | **0.5%** | 0.5% (TU) — confirmed |
| 14 Sep 2026 | pos 17 Streak Avg | **1.6** | 1.6 (TU) — confirmed |
| 14 Sep 2026 | pos 21 (→ 19) % Aktif | **0.0%** | 0.4% (TU) — **differs** |
| 07 Sep 2026 | pos 17 (→ 17) % Aktif | **0.5%** | 0.5% (TU) — confirmed |
| 07 Sep 2026 | pos 17 Streak Avg | **1.6** | 1.6 (TU) — confirmed |
| 07 Sep 2026 | pos 19 (→ 20) % Aktif | **0.0%** | 0.0% (TU) — confirmed |
| 07 Sep 2026 | pos 20 (→ 19) % Aktif | **0.0%** | 0.4% (TU) — **differs** |
| 31 Aug 2026 | pos 19 (→ 20) % Aktif | **0.0%** | 0.0% (TU) — confirmed |
| 31 Aug 2026 | pos 20 (→ 17) % Aktif | **0.0%** | 0.5% (TU) — **differs** |

The headers read "Minggu 14 Sep 2026 · 48", "07 Sep 2026 · 48" and "31 Aug 2026 · 48". None of the three weeks contains 21 Sep row #46.

## Verdict round 2: **PASS**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 1 (seed the TU values; not a blocker) |
| Info | 2 |

- **All 2 Majors and all 10 Minors of round 1 are fixed.** I1, I4 and I5 are also taken up.
- **Coverage re-run.**
  - 1,571 content and 601 shell elements.
  - 1,621 matrix rows plus 551 exclusions.
  - 0 duplicates, 0 unmapped, 0 extras and 0 unknown Functions.
  - FN "EL" columns agree with the matrix (0 inconsistencies).
- **Trace re-run.**
  - Counts: 40 US, 169 FN, 168 AC (**52** provisional; AC-11.2 became provisional), 140 FR and 96 E2E (39 provisional). Raw row counts equal the parsed counts.
  - **0 errors.** Every FN has an FR and a story; every AC has an FR and an E2E; every FR has an E2E; every E2E's FR list owns its ACs; the provisional marks agree both ways; the §3.1 table equals the derived sets; the "39 of 96" line matches.
- **Deviation totals** are 37: 27 approved and 10 rejected (URS §7 counted by script; SRS §0.1 L24–25 agrees). DV-26 moved to approved; DV-35, 36 and 37 are new.

## Round-1 findings: status

| Finding | Status | Evidence (v1.1) |
|---|---|---|
| AUD-M16-01 (Major) earlier weeks | **Fixed** | SRS §6.11.6 seeds each week as the 21 Sep list without #46, in the observed order and with the observed values. The "− 0.1 per week" rule is gone (grep: 0 hits). `sb.cjs` found **0 differences** outside the (TU) cells, and 3 differences in TU cells (R2-01). AC-38.5 (URS L794) asserts rows 18 and 20 of 14 Sep, row 17 of 31 Aug and the absence of #46. OQ-M16-17 (L2783) tracks the top-up. |
| AUD-M16-02 (Major) standings | **Fixed** | See "BR-M16-12 re-computation" below. The rule is stated in BR-07 (SRS L280), BR-10 (L283), BR-12 (L285), BR-14 (L287), §6.3 (L379–390), §6.10 Q-BAT-SCH / Q-BAT-STU and DC-M16-03 (L443–464), §6.11.0 (L472–473), §6.11.1 (L482–545) and §6.11.2 (L547–572). In the URS it is in DV-26 (L2730, now approved with a corrected premise), DV-35 (L2739), DV-36 (L2740), AC-11.2 (L629), AC-12.3 (L635) and AC-13.6 (L645). |
| AUD-M16-03 PROPOSED list | **Fixed** | OQ-M16-15 (URS L2781) is "complete list, v1.1". It includes the 0–0 colour rule, the §5 messages, the runtime formulas, the Jutawan ladder, the room rules, the bot accuracy read from M05, and the seed choices. |
| AUD-M16-04 `segment_index` | **Fixed** | BR-29 (SRS L302) gives 0-based indexes 0–7 and the landing formula `360 − (i × 45 + 22.5)`. §6.6 (L417) has `segmentIndex 0–7`, #35 (L938) says "0-based, 0–7", and the fixtures (L865) use 5 = "Cuba Lagi" and 2 = "5 Syiling". E2E-69 (L1172) says "segment_index 2". URS FN-7.1.3 (L377) matches. No 1-based reference is left. |
| AUD-M16-05 failure handlers | **Fixed** | URS FN-2.3.1 (L179), 2.4.2 (L187), 2.4.4 (L189), 2.5.4 (L198) and 5.2.2 (L277), and SRS §7.1 (L964–966) and §8.1 (L989, L995) now match the live handlers I read in round 1: "Ralat rangkaian." for the challenger banner, silent non-success, "Ralat." on accept, silent decline, the forfeit reload, and "Ralat rangkaian. Sila cuba lagi." on the S7 start. |
| AUD-M16-06 `coinsEnabled` | **Fixed** | #32 (SRS L935) and #34 (L937) return `coinsEnabled`. BR-28 (L301) defines the in-play amount as the computed amount when true and 0 otherwise. FR-92 (L171), URS FN-6.4.2 (L337), FN-6.7.3 (L366) and AC-26.3 (L720) match, and the flag is requested from M14 in XR-02. |
| AUD-M16-07 text sweep | **Fixed** | FN-1.4.1 (URS L142) lists the measured items, including "Sistem cari pemain …", the S29 help texts, the bar labels and "🏫 Sekolah Rendah". AC-04.1 (L585) and E2E-12 (SRS L1115) are now a sweep of every visible text node. |
| AUD-M16-08 S4 overflow | **Fixed** | New DV-M16-37 (URS L2741): an in-card scroll without a sticky column (precedent NFR-RESP-05(b); truncation was rejected because it hides observed text). BR-14, FR-13 (L92), AC-04.2 (L586) and E2E-13 (L1116) cover it, using 8106's long seeded names. |
| AUD-M16-09 menu colours | **Fixed** | FN-1.1.1 (URS L113) has amber-500, yellow-500, the colour dropped on the active page and `text-purple-500` in the drawer. XR-06 (SRS L877) passes it to the shell. |
| AUD-M16-10 inactive 8880 / 2710 | **Fixed** | XR-04 (SRS L875): `isActive = false` for both, citing M18. |
| AUD-M16-11 XR-07 impact | **Fixed** | XR-07 (SRS L878) states that the M14 BR-M14-35 wording changes from "hari" to "minggu" for 7–29 days, and that M14 must check its ACs and E2Es. |
| AUD-M16-12 DC-M16-02 | **Fixed** | DV-32 (URS L2736), §6.10 (SRS L463) and SQ-05 (L1209) mark it interim, with XR-M16-01 **build-blocking** and the game sampling the same M04 store. |
| I1 bot accuracy | **Taken up** | BR-08 (SRS L281): p = Q-ANS-CORRECT ÷ Q-ANS-ALL, read from M05 when the mock starts (0.798 at the seed), never hard-coded. |
| I4 GET creates a session | **Taken up** | SEC-M16-11 (SRS L1096). |
| I5 banner presentation | **Taken up** | FN-1.3.2–1.3.4 (URS L133ff) add the classes, the `live_match` precedence and the "any other status" rule. |
| I2, I3 | — | Information only. |

### BR-M16-12 re-computation (`br12.cjs`)

I parsed all 47 listed battles from §6.11.1. First I checked the winner rule, "higher score wins; equal non-zero scores = seri; 0–0 = B wins", against the winner column: **0 mismatches** (10 rows are 0–0 → B, and battle 2 is seri). I then added the 24 generated older battles exactly as specified:
- 8106: 9 battles, A a pupil of 8106 (5 generated pupils) wins, B without a school;
- 8078: 10 intra-school battles over 8 generated pupils;
- 8080: 5 intra-school battles over 6 generated pupils.

I computed one side per player at their school at battle time.

| Standing | Computed (battles · M/S/K · pupils) | Observed live | Result |
|---|---|---|---|
| all-time 8106 | 19 · 12/1/6 · 7 | 19 · 12/1/6 · 7 | ✓ |
| all-time 8090 | 18 · 9/0/9 · 2 | same | ✓ |
| all-time 8078 | 40 · 20/0/20 · 18 | same | ✓ |
| all-time 8082 | 10 · 5/0/5 · 4 | 40 · 20/0/20 · 18 | DV-M16-36 (intended) |
| all-time 8880 | 3 · 2/0/1 · 1 | same | ✓ |
| all-time 8080 | 30 · 15/0/15 · 10 | same | ✓ |
| all-time 2710 | 3 · 1/0/2 · 1 | same | ✓ |
| monthly 8082 (Sep 2026) | 8 · 4/0/4 · 2 | same | ✓ |
| weekly (21–27 Sep) | none | none | ✓ |
| student monthly | 4316 2/0/2, 4317 2/0/2 | S2 empty (DV-26 approved) | as specified |

- **The generated battles never enter a Battle Terkini list.** The last-10 lists are 8106 #1–10, 8090 #11–19, 8078 #20–29, 8082 #30–34, 8880 and 2710 #35–37, and 8080 #38–47, all identical to the observed lists, because the generated battles are older and those schools' lists are already full.
- **So every observed Battle / M/S/K / Pelajar value is reproduced except 8082 all time**, which is the documented DV-M16-36.

### Assessment of the new and changed deviations

| DV | Audit | Reason |
|---|---|---|
| 26 student standings computed (now approved) | **Agree** | The premise is corrected. The weekly period stays empty, as on live. The monthly period shows the 2 pupils that the battle records imply, with their unobserved figures marked PROPOSED and provisional (AC-11.2). |
| 35 0–0 = win for B; the list colours B's "0" green | **Agree** | It is the only rule that reproduces the observed standings (recomputed above). Live colours by score, so a 0–0 row shows no winner next to cards that count it as a win (for example 8880: "2 Kemenangan" beside one visible win). Colouring the ten 0–0 rows is the smallest visible change, and all other observed values stay. The alternative "0–0 = seri" would change at least 6 observed rows. |
| 36 8082 all time from its 5 records | **Agree** | Live 40 · 20/0/20 · 18 · 29 % · 367 is identical to 8078's row, while 8082's list holds only 5 battles, fewer than the 10-row cap, so the list is its full history. Generating 15 battles would put them into the observed 5-row list, so computing is the minimal non-contradicting fix. The S3 order is unchanged (equal Skor 367, stored order 8078 first). |
| 37 S4 in-card scroll | **Agree** | This matches the precedent of S2, S3, S7 and S27. |
| DC-M16-03 stored Ketepatan / Skor | **Agree** | These are 8 observed figures (7 all-time rows and 1 monthly row) that no battle field reproduces. The live monthly Skor 591 is not Σ round(score ÷ 100) = 417, for example. They are shown only in their own row, podium, card and box, and never next to a contradicting computed figure. Runtime increments are defined. See I-R2-02 for 8082. |

## New findings (round 2)

| ID | Severity | Doc & section | Issue | Evidence | Required fix (owner) |
|---|---|---|---|---|---|
| AUD-M16-R2-01 | Minor | SRS §6.11.6 weeks 14 Sep / 07 Sep / 31 Aug "(TU)" cells; URS OQ-M16-17 (L2783) | **Three of the nine TU cells were seeded with a 21 Sep value that differs from live:** 14 Sep pos 21 (seed 0.4%, live **0.0%**), 07 Sep pos 20 (seed 0.4%, live **0.0%**) and 31 Aug pos 20 (seed 0.5%, live **0.0%**). The other six cells are confirmed. None of the nine is asserted by an AC, so no test is wrong today. | `_topup-2026-09-26.json` `tuCells`; `sb.cjs` | **solution-architect:** Seed the TU values from the table above and remove the 13 "(TU)" marks. Close OQ-M16-17 and cite the top-up file in §6.11.0 / §6.11.6. No new audit round is needed. |
| AUD-M16-R2-I1 | Info | SRS §6.11.1 note ("the school at battle time of 4302 is none") | 8106's 19 sides need 4302 to have had no school at battle time. That cannot be observed (live shows only the current school, blue). It is stated and consistent with the colour rule, but it is not labelled INFERRED. | — | Optionally add "(INFERRED)" to that sentence. |
| AUD-M16-R2-I2 | Info | URS DV-M16-36, SRS §6.11.2 row 8082 | 8082 keeps DC-M16-03 Ketepatan 29 % and Skor 367, which are identical to 8078's and were probably copied by the same live job defect as its battle counts. Keeping them preserves the observed order and changes nothing else, so it is acceptable. | Live S3 all-time rows 3–4 | None required. Optionally note the likely copy in DV-36. |

## Regression checks (no finding)

- **"0–0".** Every rule, seed row, AC and E2E that concerns a 0–0 battle says "B" (BR-07/10/12/14, §6.11.1, AC-13.6, DV-35). No "0–0 … seri" remains, apart from the corrected history in DV-26.
- **`segment_index`.** 0-based everywhere. The only "1–8" hits are unrelated ranges.
- **`coinsEnabled`.** Present in #32, #34, BR-28, FR-92, FN-6.4.2, FN-6.7.3, AC-26.3 and XR-02, with no conflicting definition.
- **Unchanged content.** The other seeds (S3–S4 lists, Top 10, Pendahulu, S20, leagues, the 21 Sep S28 rows, S29, the Roda Nasib weights and the Jutawan cells) are unchanged. Every value I re-read on live in round 1 still holds in v1.1.
- **Privacy.** v1.1 adds no personal name. The top-up file stores states and figures only; its row identities were compared inside the browser. No screenshot was taken. The scratch scripts were deleted. The credentials are not stored.

Round-2 result: **PASS**. R2-01 is a data edit for the writer, using the TU values above.
