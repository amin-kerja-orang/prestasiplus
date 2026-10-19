# Cross-module logic review — M12–M18 (XL batch 3)

| Field | Value |
|---|---|
| Scope | Approved URS + SRS of M12 kirkpatrick v1.3, M13 cikgu-alesa v1.1, M14 gamification v1.2, M15 rewards-shop v1.3, M16 battle-games v1.2, M17 admin-dashboard v1.3, M18 ppd-jpn v1.2, and every change they request of the approved owners M01 v1.9, M02 v1.11, M03 v1.9, M04 v1.10, M05 v1.9, M06 v1.4, M07 v1.6, M08 v1.7, M09 v1.4, M10 v1.6, M11 v1.8. Also read: TRACKER (D1–D13, canonical seeds, id policy, board), architecture overview v1.5 (§6.6–§6.13, §10), build-plan v1.7, the module audits M12–M18 (their "XL batch 3" notes), and the precedent reviews `cross-module-logic-M01-M07.md` and `cross-module-logic-M08-M11.md`. |
| Method | Docs only, no browser, no edits to requirement docs. Scripts in the scratchpad (`xl3/`): `nav.cjs` (every backticked page path of the M12–M18 SRS against the §2 route tables of all 18 SRS plus TRACKER §4), `m14.cjs` (M14 wallet anchors 4001–4108 parsed from SRS §6.11.4: sums, tier cells, platinum set), `calc.cjs` (accuracy fix, M12 T1 means, M17 teacher coins vs M14 wallets, M16 S20 vs M17 week budget), `m02budget.cjs` (M02 §6.15 student buckets after every batch-3 placement). Then targeted reads of §4 (rules), §6 (data, queries, seeds, requests), §7 (contracts), §9 (permissions) and the deviation tables. |
| Rules applied | CLAUDE.md §6: D9, D10, privacy, "seeds mirror observation", D11 (every count is a named query; a display constant only where no definition reproduces the figure and it is never shown beside a contradicting computed figure), D12 (one owner per store), the XL gate; the single project mock clock **2026-09-25T15:40:00+08:00** (Delivery Lead ruling, all modules; observed rows after it are not seeded). |
| Severity scale | As batches 1 and 2. **Critical**: an observed live flow cannot complete in the rebuild. **Major**: two approved docs contradict each other, or a module depends on a contract, record or value its owner does not define (so the module cannot be built correctly). **Minor**: stale reference, wording, local inconsistency without a wrong result. |
| Date | 2026-09-27 |

## Verdict

**FAIL — 0 Critical, 24 Major, 12 Minor.**

What already fits:
- Every page path the seven SRS reference resolves (`nav.cjs`: 446 owned route patterns, 33 targets covered by an owned prefix, **0 unresolved**).
- No user, school, class, question-block or record-id range overlaps across modules (§4).
- M13 fits its owners unchanged: M05 v1.6+ already provides Q-ANS-USER and `mock.addAnswer` (E2E-M05-62 = M13 E2E-47, 3008 Kimia 2/9).
- M15 ↔ M14 contract names agree exactly: `debitTokens`, `creditTokens`, `creditSyiling`, `addXp`, `debitSyiling`, `draws.listOpenDraws / ticketsOf / buyTicket`, `DRAW_CLOSED`, `TICKET_LIMIT`, `INSUFFICIENT_BALANCE`, `mysteryBox.openingsCount`. The S5 rule (empty shop for every account) is the same in both.
- The M14 designed replay matches the M05 designed sessions P1–P4 and M1–M4 exactly. The wallet anchor arithmetic holds (`m14.cjs`): 108 anchors Σ 2,564,844 + admin 256 + pelajar 370 + pelajarmaju 267 = 2,565,737; generated share 558,455; all 33 platinum wallets are anchors.
- The M12 T1 means reproduce the displayed values (8.399 / 6.500 / 9.60 / 8.304 / 4.601), and M17 reads Q-M12-T1 rather than copying it.
- 8880 and 2710 inactive: M16 and M18 now use one definition.

**Almost none of the batch-3 requests have been applied by the owners.** M05 v1.9 records the M14 requests as "pending XL batch 3" (SQ-11). No other owner mentions them. Beyond the pending adoptions, the scripted checks found nine real contradictions:

1. **Accuracy.** M05's Q-ANS-CORRECT (381,842) cannot hold with M17's 82.9%. With the pinned anchors, the whole log needs 396,053–396,476 correct answers (XL3-01/02).
2. **M16 S20 weekly ranking.**
   - It was observed on 26 Sep at 14:22, after the project clock.
   - Its top five are the same persons as M17's week top pupils (4359 = pupil 2022), so each has two ids.
   - Ranks 6–20 need at least 797 correct answers in a week where M17 leaves only 715 answers for everyone else (XL3-16).
3. **Battle totals.** M16 seeds 71 finished battles; M17 observed 168 total / 66 finished (XL3-17).
4. **Teacher coins.** The designed M14 teacher wallets 4207 and 4208 hold 181,585 syiling. M17's Σ over active teachers is 63,459 (XL3-14).
5. **M17 S11 pupil "Syiling" 65,304.** No wallet in M14's dataset can hold it (XL3-19).
6. **8880 logins.** M18's risk seed needs 27 never-logged-in T4/T5 pupils at 8880. M11 (and M17) show 8 (+0) (XL3-20).
7. **Class-516 answers.** M18 puts the 6,563 answers in "non-practice sessions". That would break M08's observed T4 level card (11 sessions) and the "4 Simulasi" row (0 sessions) (XL3-21).
8. **M02 student buckets.** They are exhausted by the new anchors unless 29–36 T4-pool pupils are re-homed, and school 1 (emptied by M02) must hold 16 pupils (XL3-08).
9. **M16 anchor 4321.** At primary school 2710 with the PROPOSED grade "Tingkatan 4", it would add a 34th school row to M11's observed monitoring table (XL3-18).

**Build impact:**
- Not blocked: the student-slice work in progress, except F-26, whose provisional wallet seeds change (pelajarmaju 340 → 267 coins, points 120 → 432; pelajar 370 / 916) — XL3-03, XL3-36.
- M14 build: blocked by XL3-03, 06, 09, 12, 14, 15.
- M16 build: blocked by XL3-10 (Jutawan store, build-blocking by M16's own rule), 16, 17, 18.
- M17 build: blocked by XL3-01/02, 11, 14, 16, 17, 19, 23.
- M18 build: blocked by XL3-05, 07, 08, 20, 21.
- M12 build: blocked by XL3-04 and XL3-13.
- M13 and M15 builds: blocked by nothing of their own. M15 needs M14's repository to exist, which is XL3-03.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 24 |
| Minor | 12 |
| **Total** | **36** |

---

## 1. Navigation (script result)

- **Catalogue:** 446 route patterns. They come from the §2 route tables of all 18 SRS plus every path in TRACKER §4 for M19–M26.
- **Scan:** every backticked page path in the M12–M18 SRS. Of these, 33 are not in the catalogue verbatim, and **all 33 are covered by an owned prefix**:
  - action endpoints and sub-views of the module's own pages: `/admin/kirkpatrick/behavior|results|chain|interventions`, `/admin/gamification/tiers/{id}`, `/admin/reward-control/draw`, `/permainan/{game}/submit`, `/gamification/mystery-box/{id}/open`, `/sekolah/{id}/*`, `/amaran/keberkesanan/jpn`, `/analisa-item/sekolah/{id}`;
  - the M11-owned monitoring exports.
- **0 unresolved targets.**
- **Two prefixes point at pages whose owner has not yet adopted the request:**
  - `/guru/command-center/{school,classroom,student}/…` (M17 XR-12 → M10, XL3-12);
  - `/admin/kirkpatrick/pelajar/{id}` for 4664 / 4644 opened from M11's 8080 page (XL3-13).
- **Redirects checked:**
  - `/kombo` stays the M14 redirect, and M18's officer Kombo pages read DATA-M14-08 (M18 XR-15, M14 §7.1 `streak.get` lists M18) ✓;
  - `/ranking` stays with M08 ✓;
  - `/admin/laporan` stays with M17 ✓;
  - `/admin/performance` → M23 ✓;
  - officer landing pages `/ppd/dashboard` and `/jpn/dashboard` = M01 BR-07 ✓ (M18 XR-11 closed: nothing to change).

## 2. Known cross-module items — evaluation

| Item | Necessary? | Consistent? | Applied by owner? | Result |
|---|---|---|---|---|
| M14 ← M05 wallet repository handover, BR-31 step 6 `onSessionCompleted`, BR-10 quests to M14, `mock.addSession`, designed wallets 370/916 and 267/432 | Yes | **Yes.** The replay equals the M05 sessions P1–P4 / M1–M4 (every row re-derived); `wallet.credit` stays as a delegating shim for the architecture's provisional callers | No: M05 v1.9 SQ-11 "pending" | XL3-03 |
| M14 ← M08 DV-09 (S6 342,703 and S18 103 → derived 256; S18 "244 syiling lagi ke Silver" = 500 − 256 ✓; streak 1/5); S20 "Koin" 26 stays (BR-M08-28 = Q-SESS-USER coins) | Yes | Yes | No (M08 L388, E2E-M08-17 still 342,703) | XL3-06 |
| M14 ← M01 login hook `onLogin`, referral `pp.pendingRef` | Yes (BR-M14-14 streak and daily_login) | Yes | No | XL3-09 (+ Minor XL3-30) |
| M14 ← M02 anchors 4001–4108 (student), 4201–4208 (teacher) | Yes | No id overlap. Cell fit: see XL3-08; **4207/4208 conflict with M17**: see XL3-14 | No | XL3-08, XL3-14 |
| M14 ← M10 `onQuestionContributed` | Yes | Yes (deletions do not decrement; admin 20,719 display constant unchanged) | No | XL3-12 |
| M14 ↔ M16 `onGameResult(userId, {game, event, coins?, xp}) → {coinsCredited, xpAdded}`; `games_award_syiling = 0`; `coinsEnabled` | Yes | Contract names agree. **Two gaps:** M16's extra fields `correct`, `total` and `detail` are not in M14's signature (Minor XL3-29); M16's `coinsEnabled` ignores the user's M02 `coinsEnabled` (complimentary students), so the in-play counter and the credit can disagree when the setting is 1 (Minor XL3-26) | M14 side defined; M16 request pending | XL3-26, XL3-29 |
| M14 ← M15 `DRAW_CLOSED`, `TICKET_LIMIT`, `mysteryBox.openingsCount` | Yes | **Yes, exact** (M14 §6.13, §7.1; M15 §6.10 XR-03/12) | Yes | — |
| Accuracy (M17 XR-03, mandatory) | Yes | **No** (script, §3) | No | XL3-01, XL3-02 |
| M12 XR-02 session segment | Yes | Only as a store separate from the answer log (DV-M12-24: 8080 April 511 answers where M11's cells are 0) | No | XL3-04 |
| M12 XR-05 Q-M12-HC-RECORDS 4,378 | — | M08 cannot host 4,378 OTR records without changing its own observed platform headcount figures (6 configs · 48 pupils · 744 graded entries) | No | Minor XL3-34: activate DC-M12-02 |
| M12 XR-09 M17 T1 "4.6/5" | Yes | Yes. M17 R-27 reads Q-M12-T1; DV-M17-08 gives k = round(4.6) = 5 stars | Yes (M17) | M10 variant: Minor XL3-32 |
| M12 XR-01/06/10 one id per person (4664/4644 at 8080; no 5571/5551) | Yes | Yes: 5571/5551 appear in no other doc; 4664/4644 collide with nothing | No (M02, M11) | XL3-08, XL3-13 |
| M18 XR-02 pupil placement | Yes | Feasible only with k ≥ 29 re-homed T4-pool pupils, and only if school 1 is swapped back into the users' schools | No | XL3-08 |
| M18 XR-03 separate per-pupil subject-accuracy set (M05) | Yes (8765 needs 13 pupils where S1 shows 12) | Yes, as a small stored M05 table independent of the log and of SubjectMastery | No | XL3-05 |
| M18 XR-08 3201–3215 → 8880 | Yes (live "4 Simulasi" at 8880) | M08 "9 murid" still holds (900001 = canonical 2 + 3001–3008). **But** their 6,563 answers must be **sessionless**, and their `lastLoginAt` conflicts with M11 | No | XL3-20, XL3-21 |
| M18 XR-18 M14 `totalDays` | Yes | Yes (reads never decay the streak, BR-M14-14) | No | XL3-15 |
| M18 XR-19 M08 critical-question set | Yes | Yes, as an M08-owned stored item-statistics set; question anchors need an M04 id block | No | XL3-07, XL3-11 |
| M18 XR-01 8880 / 2710 inactive | Yes | Yes: 3 of M02's 8 inactive (with 8277). No module filters monitoring or M17 counts by school `isActive` | No | XL3-08 |
| M16 XR-01 Jutawan store (build-blocking) | Yes | 143 cells (Σ 149,911) that no Q-ALL / Q-ACTIVE cell reproduces | No | XL3-10 |
| M16 XR-03 Q-WEEK-RANK | Yes | **No** (post-clock, duplicate identities, infeasible) | No | XL3-16 |
| M16 XR-04 anchors 4301–4377 \ 4351, 4401; schools 2710, 900 | Yes | Ids are clear. **4321 at primary 2710 with grade T4** breaks M11 | No | XL3-18 |
| M16 XR-07 "minggu" step | Yes | M01 BR and M04 already list "minggu"; M14 BR-M14-35 does not | No | Minor XL3-28 |
| M17 XR-06/07 `isActive` pins; anchors 2022, 1919, 4402, 4418, 2013–2060 | Yes | Σ inactive 1,381 + 49 + 2 = 1,432 ✓; ids clear of 2001–2012 (M11) and of every other block | No | XL3-08 |
| M17 XR-09/11/20 M04 `coverageExcluded`, ImportRun D11 set, `createdBy` | Yes | Yes (C-10 fit given M07 split) | No | XL3-11 |
| M17 XR-12 M10 Command Center mount; classes 366–372, 813 | Yes | Yes (813 ≠ M10's 1156 "5 CYBER") | No | XL3-12 |
| M17 XR-14 M14 teacher coins, S22 unchanged | Yes | **No** | No | XL3-14 |
| M17 XR-15 M16 battles 168/0/66 | Yes | **No** (71 finished seeded) | No | XL3-17 |
| Mood owner (M10 or M26) | Yes (M12 XR-08, M17 XR-18, M10 FR-17) | M10 already cites "M26 wellbeing check-ins"; `/wellbeing/alerts` is an M26 route | No owner | XL3-23: recommend M26 |
| M13 reads of M05 (`Q-ANS-USER`, `mock.addAnswer`) | Yes | **Yes** (M05 §6.14.2, FR-M05-146, E2E-M05-62) | Yes | — |

---

## 3. The accuracy fix (XR-M17-03) — recomputed

`calc.cjs`:

| Quantity | Value |
|---|---|
| All answers (M05 Q-ANS-ALL) | 478,499 |
| Answers of P (active pupils outside fixture schools) at the clock | 477,743 |
| Non-P answers | 756 (= M17 C-02) |
| Band of P-correct that renders "82.9%" | **395,811–396,287** (matches M17) |
| M17 pin | 395,873 → 82.863% |
| Non-P anchors (answers / correct) | admin 119 / 46; pelajar 94 / 70 (P1–P4); pelajarmaju 37 / 26 (M1–M4); 3001–3008 83 / 38 → **333 / 180** |
| Free non-P answers (generated or inactive) | 423, correct 0–423 |
| **Q-ANS-CORRECT required** | **396,053–396,476** (all-answer accuracy 82.77–82.86%) |
| M05 today | 381,842 (79.80%) — short by at least 14,211 |
| M16 bot p = Q-ANS-CORRECT ÷ Q-ANS-ALL after the fix | 0.8277–0.8286 (M16 reads the query, so the value flows through; only its "0.798 at the seed" text goes stale, XL3-25) |

**What the other definitions do:**
- **M08 S1 "Purata Ketepatan 79.8%" cannot stay correct ÷ answered on the same log.** It must be redefined.
- **M08 T5 level card "79.7%"** is correct ÷ answered over the sessions of T5-class members (BR-M08-07). After the fix it is feasible only if those members hold at most **404,054–406,137** answers, and only if the remainder is answered at ~100% accuracy. With a realistic 85% accuracy for the rest, the T5 answers must stay under ~201k, while T5 holds 29,971 of 32,122 sessions (on average 14.9 answers per session, that would be ≈ 446k).
- **M12 T2 82.8%** (253,478 / 306,133) is in its own store, so it is unaffected (XL3-04). **M12 "Skor Purata" 80.3%** is the mean of session scores (BR-M12-04).
- **M13 and M11** read per-user or per-school values only, so they are unaffected.
- **M17 per-school accuracies** (8082 82.3%, 8080 81.7%) and **M18 KLUANG 71.6%** are pinned cells inside the same raised total. They stay consistent because M17's S8 subject rows (Σ exactly 477,888) already give 82.86%.

**Recommendation (decision item):**
- **M05** pins Q-ANS-CORRECT so that P-correct = **395,873** exactly, the non-P anchors keep their 180, and the 423 free non-P answers get a stated correct count. The recommended stated count is 338 (80%), giving Q-ANS-CORRECT **396,391** (82.84%).
- **M08** redefines "Purata Ketepatan" on S1 **and the level cards** as the **mean of completed-session accuracies** (`correctCount ÷ questionCount`), served by a new M05 query (e.g. Q-SESS-MEAN-ACC(scope)).

Reasons for the session mean:
- It is the definition live already uses for M12 "Skor Purata" (80.3% over the T4/T5 segment) and for M16 "tepat" (BR-M16-31). The remaining ~11,131 sessions would then average ≈ 78.9%, which is plausible.
- It needs no display constant (D11 prefers a definition).
- It removes the implausible T5 allocation.
- A display constant would be valid on S1 (no contradicting figure beside it). It would not fix T5 79.7%, and it is weaker under D11.

Alternative rejected: lowering M17's 82.9%. The observed per-subject and per-period evidence proves the definition (M17 R-06).

---

## 4. Seeds and id ranges — checked

**Users id space (1–6,000; runtime ≥ 9,000,001):**

| Block | Module |
|---|---|
| 1–11 | canonical |
| 1919 | M17 teacher |
| 2001–2012 | M11 8080 anchors |
| 2013–2021, 2022, 2023–2060 | M17 |
| 3001–3008, 3201–3215 | M08 |
| 3101–3109 | M09 |
| 3151–3152 | M15 |
| 4001–4108, 4201–4208 | M14 |
| 4301–4377 (\4351), 4401 | M16 |
| 4402, 4418 | M17 |
| 4644, 4664 | M12 |
| 5001–5990 | M02 |

**No overlap.** 5551/5571 are used by nobody (they fall in M02's reserved block, as M12 requires).

**Other ranges:**

| Kind | Ranges | Result |
|---|---|---|
| Schools | 900001–900003 (fixtures), anchors 1, 127, 900, 987, 2700, 2710, 3160, 7780, 8078–8880 … | No clash. **School 1 is emptied by M02 but needs 16 pupils for M18** (XL3-08) |
| Classes | M10 anchors 4–10, 25, 90, 115, 228, 419, 516, 1154–1156, 2001, 2002; M17 366–372, 813; M18 517 | No clash |
| Other records | M13 13101–13599; M14 ledger reserved 140001–140299; M15 rewards 1–59 and redemptions 1–3; M18 interventions 2, 3 (runtime ≥ 1,000); M12 interventions runtime from 1; M08 HeadcountConfig 209–213, 504 and M17 617; M04 question blocks 700001–700999 (M08 / M10 / M11) | No clash. M18's critical questions have no block yet (XL3-11). M12 and M18 both name an entity "Intervention" (Minor XL3-33) |

**Seeds mirroring observation:**
- M14's post-clock ledger rows, M17's post-clock answers and logins, and M18's ranking snapshot (`generatedAt` 15:30) follow the single-clock rule.
- **M16 S20 does not** (observed 26 Sep 14:22 — XL3-16).
- The M14 wallet arithmetic re-computes exactly (Verdict).
- The M02 student buckets (`m02budget.cjs`): 4,158 + 10 + 22 + 137 + 134 + 72 = 4,533 ✓. They are overbooked after batch 3 (XL3-08).

## 5. Counts map — new or changed figures

| Figure | Query / constant | Status |
|---|---|---|
| M14 S1/S4/S5 totals | Q-WALLETS, Q-TIER, Q-TX, Q-CONVERSIONS … (M14 §6.10) | ✓ |
| M14 "Siap Hari Ini" | Q-DAILY-FINISHERS = 0 | ✓ |
| M08 S6 / S18 Koin | M14 `wallet.summary` (DV-M14-09) | pending (XL3-06) |
| M08 S1 "Purata Ketepatan" | redefinition needed | XL3-02 |
| M12 T4 "Rekod Headcount" | DC-M12-02 (recommended) | XL3-34 |
| M12 S5 "41 rekod", correlation | DC-M12-01, DC-M12-03 | valid (never beside a contradicting figure) |
| M16 S3 subtitle 10,218 | DC-M16-01 | valid |
| M16 S19 Jutawan counts | DC-M16-02 interim → M04 `jutawanQuestions` | XL3-10 |
| M16 S20 | Q-WEEK-RANK (M05) | XL3-16 |
| M17 DC-M17-01…07 | audited | valid |
| M17 Q-M17-TEACHER-COINS 63,459 | M14 TeacherWallet | XL3-14 |
| M17 S11 top-200 "Syiling" | M14 wallet (undefined field) | XL3-19 |
| M17 Q-M17-BATTLES | M16 Battle | XL3-17 |
| M17 Q-M17-MOOD / SPONSORS / TUITION | owners not yet specified | XL3-23 |
| M18 ranking / usage | DATA-M18-03, stored aggregate of the daily job | valid (never beside the M11 figures) |
| M18 Q-M18-ACCSTU | M05 separate set | XL3-05 |
| M18 Q-M18-CRIT | M08 item statistics | XL3-07 |

## 6. Entities, enums and contracts

**Consistent:**
- M14 ↔ M15 names and refusals (§2).
- `streak.get` shape `{current, best, lastActivityDate, practisedToday, multiplier}` for M05, M08, M10 and M18.
- M13 ↔ M10 `/api/guru/classes`.
- M17 R-27 ↔ Q-M12-T1.
- M18 ↔ M01 BR-07 landing pages.
- M18 ↔ M02 `ppdState` / `ppdDistrict` (canonical 9 = "PPD HULU LANGAT" / Selangor, as M18 §6.12 needs).
- M16 ↔ M02 school `isActive`.

**Gaps:**
- M16 `onGameResult` extra fields (XL3-29).
- M16 `coinsEnabled` (XL3-26).
- M17 hook signature `mock.addAnswer(userId, questionId, isCorrect)` vs M05's `{userId, questionId, isCorrect, answeredAt?}` (XL3-31).
- M10 Kirkpatrick T1 scale vs M17 (XL3-32).
- The duplicate entity name "Intervention" (XL3-33).
- The M05 invariant "generated answers always belong to a session" vs sessionless answers of 3201–3215 and of pupil 2022 (XL3-05, XL3-21).

## 7. Roles and permissions — checked

- M12: admin and teacher twins; S8 403 for non-user ids 5571/5551 ✓.
- M14: T = teacher or admin, AD = admin ✓.
- M15: the teacher approval page on `/cikgu/kelulusan-hadiah` ✓.
- M16: user-portal pages for every logged-in user; admin settings AD ✓.
- M17: A and AT (teacher scoped by BR-M17-30 on the M10-mounted pages, pending XL3-12).
- M18: the officer roles `ppd_officer` / `jpn_officer`, admin previews by the DATA-M18-05 constant scopes ✓.

No role is granted a page by one module and denied it by another.

## 8. End-to-end flows

| Flow | Path | Result |
|---|---|---|
| Student completes a session | M05 #6 submit → BR-31 step 6 `gamification.onSessionCompleted` (M14) → ledger row + wallet + streak + challenges → M05 S7 "Ganjaran Anda" (returned `coinsEarned`) → header chips #1 → M08 S6/S18 (`wallet.summary`) → M11 / M17 via M05 queries | **Broken until XL3-03 and XL3-06** (M05 still credits the provisional wallet; M08 still seeds 342,703). The M17 badge query reads M14 ✓ |
| Login | M01 password login → `onLogin` → streak + `daily_login` +2 | **Missing** (XL3-09). Post-login chip values at the clock need stating (XL3-30) |
| Game result | M16 submit → `onGameResult` → `{coinsCredited: 0 while games_award_syiling = 0}` → result tiles | Contract ✓; extra fields and `coinsEnabled` Minor (XL3-26/29) |
| Redemption | M15 #9–#11 → `debitTokens` / `creditTokens` / `creditSyiling` (atomic, `INSUFFICIENT_BALANCE`) → TokenMovement log; tickets via `draws.buyTicket` (`DRAW_CLOSED`, `TICKET_LIMIT`) | ✓ (reachable through fixtures only, since the shop is empty as live) |
| Teacher contribution | M10 create → M04 write contract → `teacherGamification.onQuestionContributed` → `questionsCount`, badges | **Missing in M10** (XL3-12) |
| Officer views | M18 over M02 schools (per-state / per-PPD registers), M02 users (168 pupils), M05 log / sessions / accuracy set, M08 headcount / item statistics, M10 classes, M14 streaks | **Blocked** by XL3-05, 07, 08, 15, 20, 21 |
| Admin analytics | M17 over M02 / M05 / M04 / M08 / M10 / M12 / M14 / M16 (+ M21 / M26) | **Blocked** by XL3-01/02, 11, 12, 14, 16, 17, 19, 23 |
| Kirkpatrick | M12 over M02 / M01 / M05 segment / M08 / M12 stores; S8 from M11 links | Blocked by XL3-04, 13 |

---

## 9. Findings

| ID | Sev | Owner | Doc IDs (side A ↔ side B) | Problem | Fix |
|---|---|---|---|---|---|
| XL3-01 | **Major** | **M05** | M05 §6.14.1/§6.14.2 Q-ANS-CORRECT 381,842 "PROPOSED round(0.798 × 478,499)", E2E-M05-61 ↔ M17 R-06, C-03, XR-M17-03 (82.9% = correct ÷ answered of P) | A subset (P) needs ≥ 395,811 correct, while the whole log holds 381,842. The value came from reading M08's 79.8% as correct ÷ answered, which the M17 evidence disproves. | Pin P-correct **395,873**; keep the anchors' 180 non-P correct; state the free non-P correct (recommended 338) → **Q-ANS-CORRECT 396,391** (any value 396,053–396,476 works). Update §6.14.1/§6.14.2 and E2E-61. Add Q-SESS-MEAN-ACC(scope) (mean of completed-session `correctCount ÷ questionCount`) for M08 (§3). |
| XL3-02 | **Major** | **M08** | M08 §6.3 L346 (Q-ANS-CORRECT ÷ Q-ANS-ALL = 79.8%), BR-M08-07 (level accuracy per answer: T5 79.7%, T4 63.9%), E2E-M08-09 ↔ XL3-01 | After XL3-01, 79.8% is not correct ÷ answered. T5 79.7% per answer then needs T5-class members to hold ≤ 404,054 of 478,499 answers at ~100% accuracy for the rest (`calc.cjs`), which is implausible for 29,971 of 32,122 sessions. | Redefine S1 "Purata Ketepatan" and the level-card accuracy (S1, S2, S3) as Q-SESS-MEAN-ACC (M05). Keep the observed values (79.8 / 79.7 / 63.9) as the build targets. Class figures (BR-M08-10, 77.6%) may stay per answer. Record the definition INFERRED and cite M12 BR-M12-04 and M16 BR-M16-31 as precedent. A display constant for 79.8% is the fallback only. |
| XL3-03 | **Major** | **M05** (+ architecture) | M05 SQ-4, SQ-11, BR-08/09/10, §6.10 quests, §6.12 wallet seeds (pelajarmaju 340 / 120 / 3 / 40%), FR-M05-16 ↔ M14 XR-M14-01 (a)–(f), §7.1, BR-M14-03/12/13/16 | Not applied. M05 still owns the quest catalogue and the provisional wallet with its own designed values, so the session → wallet flow and every wallet figure differ from M14. | Apply XR-M14-01 (a)–(f): BR-31 step 6 calls `onSessionCompleted` and shows the returned `coinsEarned`; the S1 widget reads `challenges.today`; drop the M05 wallet and quest seeds (pelajar **370 / 916 / L1 / 100%**, pelajarmaju **267 / 432 / L3 / 100%**, admin 256 / 8 / 2 / 7%); the badge shelf reads `learnerBadges.forUser`; add `mock.addSession`. Re-run E2E values that show coins or points. |
| XL3-04 | **Major** | **M05** (decision; + M12) | M12 XR-M12-02, §6.5 (20,991 sessions, 306,133 / 253,478, per school / subject / month / heat, 5 served-unanswered), DV-M12-24 ↔ M05 §6.14 (log 478,499, sessions 32,122, "generated answers always belong to a generated session") ↔ M11 §6.7 cells | M12 asks for session aggregates "without QuizAnswer rows". DV-M12-24 shows the segment is not a slice of the answer log: 8080 has 511 M12 answers in April 2026 where the M11 weekly cells M1–M11 are all 0, and 4664 has 219 answers while M11 shows 0. If these sessions sit inside Q-SESS-ALL, M08 / M17 session figures and the session-answer invariant break. | **Recommended:** a separate **M05-owned aggregate store** (`kirkpatrickSegment`, a D11 virtual dataset of session aggregates `{userId, schoolId, subjectId, completedAt, questionCount, answeredCount, correctCount, scorePct}`), outside Q-SESS-ALL and never joined to QuizAnswer, with the M12 §6.5 totals and anchors as its pins; Q-M12-* are named queries on it. This keeps 32,122 / 478,499 and every M08 / M11 / M17 figure unchanged and adds no rows to them. Alternative (inside the 32,122 with non-log sessions) rejected: it breaks M05's session-answer total and M08 BR-M08-07 accuracy over sessions. |
| XL3-05 | **Major** | **M05** | M05 §6.14 ↔ M18 XR-M18-03/04/05, §6.10; M17 XR-M17-02/04/05; M16 XR-M16-03 | None is applied. Needed: (1) the separate stored per-pupil × subject accuracy set (`{userId, subjectId, correct, answered}`; 8765 X/Y anchors; "0%" rows at 3160, 2700, 8767) — accept as a small M05 table independent of the log and of SubjectMastery; (2) the 12 before-M1 answers moved to 8765 (with M11); (3) the 8880 / 8765 practice-session pins and 2 `orphan` rows (definition (a), excluded by the M18 M04 join); (4) **sessionless answers**: 3201–3215's 6,563 (XL3-21) and pupil 2022's 6 (XR-M17-04), which contradict "generated answers always belong to a generated session"; (5) `subjectId` nullable ("Latihan Bebas"); (6) the M17 activity pins (windows, months, per-school, S11 series, top-200); (7) Q-WEEK-RANK (after XL3-16). | Apply all seven; restate "answers without a session" as {admin 35, 3201–3215 6,563, pupil 2022 6} and the session-answer total accordingly (478,464 − 6,569 = 471,895 in sessions). Re-run the §6.14 feasibility with the M17 budgets (generated other answers 5,795 = 5,372 P + ≤ 423). |
| XL3-06 | **Major** | **M08** | M08 DATA-M08-10, §6.10 L388 (S6 koin 342,703; S18 103 / 397; streak 0/0), E2E-M08-17/50 ↔ M14 XR-M14-03, DV-M14-08/09 | Not applied. M08 seeds coin and streak values that M14 owns (D12), and they differ from M14's. | Read `wallet.summary`, `streak.get` and `learnerBadges.forUser`: S6 Koin **256**; S18 syiling 256, "244 syiling lagi ke Silver", streak **1 / 5**. S20 "Koin" 26 stays (BR-M08-28). Update E2E-17 and E2E-50. |
| XL3-07 | **Major** | **M08** | M08 §6.4/§6.8 (744 graded entries; class-516 configs 209–213 = 75 entries; SchoolSpmHistory; no item-statistics store) ↔ M12 XR-04/05, M17 XR-13, M18 XR-06/09/19 | Not applied: headcount entries of 4664 / 4644; SchoolSpmHistory `gradeCounts` (2025 platform row 4.30 / 180; 8080 2026 4.00 with one B+); the 2026 subject rows (2.50…3.20 × 30) — **stored at school 8880** (M17 R-26), and M12 reads "platform" 2026 rows as the rows of any school (DV-M12-26); HeadcountConfig 617 (class 370) and pupil 2022's rows; 8880's **148** graded entries (A+ 4 · A 36 · A- 42 · B+ 36 · B 18 · C+ 6 · C 4 · D 1 · E 1), which after XL3-21 must **contain the 75 class-516 entries** (config 213 already uses C+ 2 and C 1; the 209–212 at-risk rows use C+ 2 more), so 209–212 must be generated inside C+ ≤ 2 more, C ≤ 3 more, D ≤ 1, E ≤ 1, G 0; the stored item-statistics set (KLUANG / Johor 20, 8880 20 + T4, 8765 6); S30 layout and wording. | Apply them, with the 8880 grade check as a build assertion. Q-M12-HC-RECORDS is **not** hosted (XL3-34). |
| XL3-08 | **Major** | **M02** (+ M01) | M02 §6.15 A/B/C (student buckets 4,158 + 10 + 22 + 137 + 134 + 72; school 1 emptied for 900002; per-state weights INFERRED; 8 inactive schools) ↔ M12 XR-01, M14 XR-05, M15 XR-09, M16 XR-04, M17 XR-06/07, M18 XR-01/02/08 | None applied. `m02budget.cjs`: M18 needs 78 non-register pupils (46 primary at 3160 / 2700 / 2710 / 1 + 32 lower forms at 8880 / 8765 / 8772 / 8767 / 7780). With ≥ 1 on each of the other 19 filter schools, 2 at 8106 and M15's 2 no-school anchors, the "other students" pool of 72 is **over by 29** unless **k ≥ 29** (M18 caps k at 36) T4-pool pupils are re-homed with lower grades. At k = 36 only **22** no-school, no-class generated slots remain (7 others + 15 rows displaced from 8880); M16 needs 22 such slots for 4302–4325 (in no M10 class, XR-M16-05), so its other no-school anchors must use `attendanceMirror` or T4-pool slots. School 1 must hold 16 pupils. Johor 1,189 / Perak 1,102 and the PPD counts must become pinned state cells. | Publish one consolidated placement table: canonical, M08, M09, M11, M12 (4664 / 4644 at 8080: 4664 logged in, 4644 null), M14 (4001–4108 in any generated student slot, 4201–4208 at M11 teacher schools, **4207 / 4208 `isActive = false`**, XL3-14), M15 (3151 / 3152 no school), M16 (per XL3-16/18), M17 (2022 at 8080, 1919 no school, 4402 / 4418 at 8082, 2013–2060, role × `isActive` pins), M18 (168 pupils with k fixed at 29–36; 3201–3215 → 8880 replacing 15 Aktif T4 rows). Swap school 1 back in and empty another live filter school that no module observes. Pin the Johor / Perak / PPD cells. Mark 8880 and 2710 inactive. Re-run the §6.15 build checks (4,533; 4,158; 1,666 / 2,492; 522 / 277; 57; school 900001 = 9; no-school bucket). |
| XL3-09 | **Major** | **M01** | M01 login and register FRs ↔ M14 XR-M14-02, BR-M14-14/19 | `gamification.onLogin(userId, at)` after a password login, and the `pp.pendingRef` → `referralCode` → `referrals.onRegistered` path, are missing, so streaks and `daily_login` rows never happen. | Add both, as XR-M14-02 states (`setUser` fast login does not call `onLogin`). |
| XL3-10 | **Major** | **M04** (build-blocking for M16) | M04 dataset (466,041; Q-ALL / Q-ACTIVE cells) ↔ M16 XR-M16-01, DC-M16-02 (143 cells, Σ 149,911; e.g. Sejarah T1 2,974 > Q-ALL 2,447) | No M04 query can give the S19 counts, and the game would sample another pool. | **Recommended:** accept an M04-owned `jutawanQuestions` store (like the structured bank: outside Q-ALL / 466,041) with exactly the 143 cells, `questions.jutawan.count(subjectId, level)` and `questions.jutawan.sample(filter, n, rng)`; then retire DC-M16-02. Also answer M16 XR-01 (b) sample filters and (c) report source `papan_bijak`. |
| XL3-11 | **Major** | **M04** | M04 DATA-M04-01 / 07, §4.1, §6.13 ↔ M17 XR-09/11/20, M18 XR-10 | Not applied: facet `coverageExcluded` (1,746 active rows; Table A pins; the 9 level-less rows moved out of Bahasa Melayu; M08's 15 Sejarah T4 anchors `spmPool = true`); ImportRun as a D11 set (1,123 runs, Σ 31,101, none in Aug–Sep; re-date the seeded run); `createdBy` of generated contributions (Σ 11,414 over active teachers, per school as M17 R-43), leaving Q-CONTRIB of users 1 and 5 unchanged; an id block and records for M18's critical questions (20 KLUANG, 8880's 20 + T4 variant, 8765's 6). | Apply them and re-run the M04 fit (it also needs M07's split, XL3-22). Assign the M18 block (e.g. 701001–701099). |
| XL3-12 | **Major** | **M10** | M10 FR-M10-26 (BLOCKED), §6.2.1 / §6.11 classes, contribution flow ↔ M14 XR-04, M17 XR-12, M18 XR-08 | Not applied: `onQuestionContributed` after every teacher create; Command Center S4–S7 mounted on `/guru/command-center/{school,classroom,student}/…`; classes 366–372 (8080, owner 1919) and 813 "5 CYBER" (8082, owner 4402) with their members; 8082's 14 class-owning teachers (Σ 515 pupils); mission sessions 3 / 8; class **516 owned by 8880** and new class **517** "5 Simulasi" (T5, 15 of 8880's T5 pupils), "5 Sinar" / "5 Delima", 8880 teachers' 5 + 4 classes; 7780 / school-1 memberships of the T4 / T5 BM / SEJ classes; badges from DATA-M14-20. | Apply them. Class 517 takes a generated class slot (750 unchanged), and its 15 members must already count in M08's T5 "Murid" 3,911 (Minor XL3-35). |
| XL3-13 | **Major** | **M11** | M11 §6.7 rows 8880 / 8765, FR-58 links, S4 page, BR-M11-04/05 ↔ M12 XR-06/10 (R2-04), M18 XR-04/13, M16 XR-05, M17 XR-08 | Not applied: rows 8880 10,208 → **10,196** and 8765 210 → **222** (the 12 before-M1 answers; those values were `observed:false`, so no observed value changes); the 8080 "kirkpatrick" links for Students A / B = **4664 / 4644**, with S4 behaviour for a student with 0 monitoring answers **not specified** (the linked page opens for them after DV-M12-25); `battles.countFor` / `gameResults.countFor` for "Battle" / "Permainan"; the XR-M17-08 decision (S11 "Sekolah (61)"). | Apply the row move and the links; define the zero-answer S4 state (header, empty sections, as the existing no-answer rows). Adopt the M16 counters. For XR-M17-08, recommend **reject** (keep M11's teacher-table rule and DV-M17-28's fallback 57 · 9 · 0 · 48): the preferred path needs 3 re-roled users or a new unobserved M11 rule. |
| XL3-14 | **Major** | **M14** (+ M02, M17) | M14 §6.11.5 teacher wallets 4201–4208 (4207 18,140; 4208 163,445 "designed"), S22 ↔ M17 Q-M17-TEACHER-COINS 63,459 (Σ balance over **active** teachers outside fixture schools), XR-M17-14 | `calc.cjs`: 4201–4208 hold **202,427**; 4207 + 4208 alone hold **181,585 > 63,459**. With all of them active teachers, the observed M17 tile is impossible. The other six hold 20,842, so another 42,617 must sit on teachers outside S22's observed rows. | **Recommended:** 4207 and 4208 are **inactive teachers** (2 of M02's 49; they are designed, unobserved), so they fall outside T. Their cash rows on S8 stay unchanged. The remaining 42,617 goes on new materialised teacher wallets with `questionsCount = 0` that sort below every observed S22 row (e.g. `createdAt` newer than every observed zero-question teacher), so S22 stays as observed. Alternative: M17 sums available (balance − held) — rejected, as it is a new definition without evidence. |
| XL3-15 | **Major** | **M14** | DATA-M14-08 `{userId, current, best, lastActivityDate}` ↔ M18 XR-07/18, BR-M18-33 | `totalDays` does not exist, and the KLUANG / BATANG PADANG streak anchors are not seeded. Without them M18 S29 / S33 and every Kombo figure cannot be built. | Add stored `totalDays` (2710: 13 and 4; other observed rows 0) and the §6.11 F streak anchors (81 / 7.2; 29 / 6; per-school top-10). "Active" = stored `current` > 0 (reads never decay, BR-M14-14 ✓). |
| XL3-16 | **Major** | **M16** (with M17, M05) | M16 §6.11.4 S20 table (4359–4377, 4303; Σ 138 sessions / 2,098 correct; ranks 1–5: 450 / 401 / 187 / 145 / 118), XR-M16-03, AC-M16-29.5; audit (S20 read 26 Sep 14:22) ↔ M17 §6.4, §6.7 B (week at the clock: 2022 452 · 99.6% · 23 sessions; 8082 pupils 330 (live 405, 401 correct), 234 · 62.0%, 200 · 93.5%, 160 · 73.8%; per-school week Σ 2,508), C-17 | (1) **Post-clock.** S20 was observed on Saturday 26 Sep 14:22, after the project clock; 4360's 401 includes the 72 post-clock correct answers M17 removed (329 at the clock). (2) **Two ids for one person.** Ranks 1–5 are exactly M17's week top five (450 ≈ 452 × 99.6%, 401 / 405, 187 = 200 × 93.5%, 145 = 234 × 62.0%, 118 = 160 × 73.8%), and 4359 = pupil **2022** (23 sessions). M16 gives them new ids with no school; M17 places them at 8080 / 8082. (3) **Infeasible.** At the clock the week has 2,508 P answers; M17's named week pupils use 1,793, leaving **715**, while ranks 6–20 need ≥ **797** correct. (4) M17's PROPOSED placements contradict the observed S20: the 160 · 73.8% pupil has **4** sessions on S20 (M17: 8 × 20), and 8106 pupils A / B (125 correct each) and the 1,761-month pupil (80, 127 at 26 Sep) do not appear although they would rank 5–10, unless their week sessions are SPM modes. | **M16:** map ranks 1–5 to M17's pupils (2022; the four 8082 week pupils from M17's 2013–2060 block) and place ranks 6–20 at monitoring schools inside M17's per-school week figures; restate S20 **at the project clock** (4360 → 329 correct and its pre-clock sessions; other rows as computed), with the 26 Sep values kept as the observed record (M14 / M17 precedent). **M17:** re-derive the PROPOSED 25 Sep placements with M16's observed session counts (the 8082 160-pupil = 4 sessions; the 8106 A / B and 1,761 pupils' week sessions in SPM modes, which S20 excludes, or other values), keeping today = 17 sessions. **M05** hosts Q-WEEK-RANK over the result. Joint script check required. |
| XL3-17 | **Major** | **M16** (+ M17) | M16 §6.11.0 Battle store: **71** seed rows, all `finished`; GameSession "runtime (empty seed)" ↔ M17 Q-M17-BATTLES 168 total / 0 active / **66** finished; pupils' battles 0 / 4 / 23 and **games 0 / 5 / 47** over 7 / 30 / 90 days (XR-M17-15) | M16 has more finished battles (71) than M17 observed (66) and 97 fewer battles in total. M17's game counts have no seeded M16 record. | M16 hosts **168** battles: 66 `finished` plus 102 in another status (`forfeited` or a status M16 defines) — reclassify 5 of the 71 so the S3 / S4 observed standings still compute (state which statuses BR-M16-12/13 count), and seed game results by pupils giving 0 / 5 / 47 (dates before the clock). Recompute Q-BAT-* and re-check DC-M16-03. |
| XL3-18 | **Major** | **M16** (+ M02) | M16 §6.11.4 ("4301 → 8106, 4320 → 8880, 4321 → 2710 … others any student grade (PROPOSED Tingkatan 4)") ↔ M11 BR-M11-08 (every school with a T4/T5 student is a row of the observed 33-school table), M18 §6.11 B (2710 = 4 primary pupils; 8880 composition) | 4321 as a T4 pupil at primary school 2710 adds a **34th M11 row** and changes every observed M11 S2 figure. 4301 (8106) and 4320 (8880) must fit the registers (8106 T4 count; 8880 = 26 T4 of which 15 are 3201–3215). | 4321 = a primary grade (one of 2710's 4, not the answering one); 4301 and 4320 get grades and login states inside their schools' M11 cells; S20 anchors per XL3-16; other anchors per XL3-08. |
| XL3-19 | **Major** | **M17** (+ M14) | M17 URS AC (S11 Murid row 1 "… 65,304 …"), XR-M17-14 ("pupil wallet 'Syiling' of the S11 top-200 rows") ↔ M14 §6.11.1 (every wallet with lifetime ≥ 5,000 is platinum; all 33 platinum wallets are anchors 4001–4033) | `m14.cjs`: no anchor has 65,304 as `currentSyiling` or `totalSyilingEarned` (platinum #3 135,760, #4 65,129), and no generated wallet can exceed 5,000 lifetime. The S11 value cannot come from M14's dataset, and the field read is not named. | M17 names the field. If it is a legacy per-user coin total (like M08's pre-DV-09 342,703), record the S11 "Syiling" column as M17 documented display data (DC-M17-08: never beside a contradicting M14 figure; S11 shows no wallet figure). Otherwise map each top-200 value ≥ 5,000 to a platinum anchor and ask M14 to adjust — rejected, as M14's values are observed. |
| XL3-20 | **Major** | **M18** (decision; + M11, M17, M02) | M18 §6.11 B risk inputs (8880: "T4 15 never active (80), T5 12 never active (80)"; BR-M18-13 score 80 = no session and **no `lastLoginAt`**; BR-M18-15 "belum mula latih" 49), XR-M18-08 open point ↔ M11 §6.7 8880 "31 · 14 · **8 (+0)**" (observed 25 Sep 19:24); M17 XR-06 (8880: 6 extra never-logged, consistent with M11) | M18 needs **27** null-login T4 / T5 pupils at 8880 (15 of them answered). M11 shows 8 null-login and 0 answered-without-login. `lastLoginAt` cannot return to null between 25 and 26 Sep, so the two observations contradict each other (D9). A login within 30 days cannot give 80 either (M17 shows no 8880 login this month). | **Recommended:** keep M11 / M17 (two modules and a reconciled register). M18 fixes minimally: the 15 class-516 pupils and 4 of the 12 get old `lastLoginAt` values (score 100 per BR-M18-13); 8 stay null (80); re-derive the 86 / 49 split and the school-average ordering, and record a D9 deviation listing the changed M18 scores. Alternative: change M11's 8880 row to "Belum login 23 (+15)" and more — rejected, as it breaks M11 and M17 observed figures. |
| XL3-21 | **Major** | **M18** (+ M05, M08) | M18 §6.10 (answer-log row: "the other 9,519 answers of 8880 and 0 of the class-516 pupils' 6,563 answers are in **non-practice** sessions"), XR-M18-05/08 ↔ M08 BR-M08-07 (T4 "Jumlah Sesi" = distinct sessions **of any mode** of T4-class members = **11**), BR-M08-09 (S3 "4 Simulasi" Sesi **0**), E2E-M08-09/11/12 | If 3201–3215's 6,563 answers are in sessions of any mode, the observed T4 11 sessions and the 516 row "0" break (≥ 164 sessions at 40 answers). | State the 6,563 as **answers without a session** (`sessionId` null; M18 R14e already says "no session"), with M05 XL3-05 (4). Then M08's session-based figures hold (BR-M08-07/09/10 count sessions) and M18 S30 counts the log. M08 checks S6 / S7 of 3201–3215 (weak-topic SP records may appear, BR-M08-12; E2E-68 asserts only headcount and cadangan). |
| XL3-22 | **Major** | **M07** | M07 PKSK difficulty split 190 / 191 / 191 / 191 (designed, XL-31) ↔ M17 XR-M17-10, R-12 (S10 difficulty-4 tile forces PKSK ≤ 66) | Not applied; M17 S10 cannot compute otherwise. Also M14 XR-08: pass mode `pksk` if PKSK practice completes through BR-31. | Split **253 / 253 / 191 / 66** (the observed anchors 2 × 3 and 3 × 2 fit; Q-DIFFICULTY unchanged); confirm the `pksk` mode. |
| XL3-23 | **Major** | **Delivery Lead / solution-architect** | M17 Q-M17-MOOD, Q-M17-SPONSORS, Q-M17-TUITION (XR-16/17/18); M12 XR-08; M10 FR-17 ("M26 wellbeing check-ins") ↔ TRACKER (M21, M26 not started; `/wellbeing/alerts` and `/pusat-tuisyen/*` in M26) | M17 S1 / S2 / S8 figures read stores whose owners are unspecified (M21, M26 are Phase E/F). Under D12 M17 may not seed them, so M17 cannot be built. | **Recommended:** mood owner **M26** (wellbeing; M10 already cites it); tuition centres M26; sponsors M21. Define **provisional owner contracts** in architecture §6.7 now (the provisional-wallet pattern: `owner: 'M26'` / `'M21'`, seeds 750 check-ins 307 / 280 / 72 / 91 before 1 Sep; 2 centres 18 / 0; 6 suspended sponsors), moved to the owner when it is specified. |
| XL3-24 | **Major** | **M03** | M03 chapter tree 1,251 (ids 1–1,251 plus kept live ids incl. 1280 / 1281) ↔ M17 XR-M17-19, R-14 (Σ 1,311) | Not applied: 60 chapters outside the tree (Pendidikan Muzik 56, Pendidikan Syariah Islamiah 3, Sains Rumah Tangga 1). | Add them with `inTree = false`, ids clear of every kept live id; M03 screens keep counting 1,251. |
| XL3-25 | Minor | M16 | BR-M16-08, SQ-M16-03 ("0.798 at the seed") ↔ XL3-01 | The value becomes ≈ 0.828. | Reword to "the M05 platform accuracy". |
| XL3-26 | Minor | M16 (+ M14) | M16 #32 / #34 `coinsEnabled` = setting only, FR-M16-92 ↔ M14 BR-M14-03 (a student with M02 `coinsEnabled = false` earns no syiling), M02 field `coinsEnabled` | With the setting at 1, a complimentary student's in-play counter would show coins that `onGameResult` does not credit. The same name also means two different things. | `coinsEnabled` = setting ∧ the user's M02 `coinsEnabled` (or M14 exposes `canEarnSyiling(userId)`); rename the payload field, e.g. `gameCoinsEnabled`. |
| XL3-27 | Minor | M16 | XR-M16-03 ("confirm no designed account has more than 26 correct") ↔ M05 M1–M4 (pelajarmaju: 26 correct in the week, practice modes) | pelajarmaju ties rank 20 (26) and wins on user id (4 < 4377), so it displaces the observed row. | Record the computed rank-20 outcome in M16 E2E after XL3-16 (M16 already allowed "enters at its computed rank"). |
| XL3-28 | Minor | M14 | BR-M14-35 (days, then months) ↔ M16 XR-07 (OBSERVED "1 minggu yang lepas"), M01 / M04 BRs (units incl. "minggu") | M14 omits the week step of the shared formatter. | Add "{floor(d ÷ 7)} minggu yang lepas" for 7–29 days; check M14 ACs and E2E at ≥ 7 days; confirm F-03 has the step. |
| XL3-29 | Minor | M14 | §7.1 `onGameResult(userId, {game, event, coins?, xp})` ↔ M16 XR-02 (a) (`correct`, `total`, `detail`) | Without these fields the ledger cannot write the observed wording once the setting is 1. | Accept the optional fields and the ledger wording of XR-02 (a) / (c). |
| XL3-30 | Minor | M14 (+ M01, M05) | BR-M14-14 (first student password login of the day → +2 `daily_login`), §6.11.3 (no 25/09 login row for accounts 2 and 4) | At the clock a UI password login as pelajar / pelajarmaju gives chips of 372 / 269, not the designed 370 / 267. | State the expected post-login values (or which E2E use `setUser`) in M14 and in the E2E of M01 / M05 / M15 that assert chips after a form login. |
| XL3-31 | Minor | M17 | §6.9 `mock.addAnswer(userId, questionId, isCorrect)` ↔ M05 FR-M05-146 `mock.addAnswer({userId, questionId, isCorrect, answeredAt?})` | The signatures differ. | Use M05's object signature. |
| XL3-32 | Minor | M10 (+ M17) | M10 BR-M10-10 (T1 = mean reaction 0–10; stars round(t1 ÷ 10 × 5)), FR-M10-17 ↔ M17 BR-M17-08 / DV-M17-08 (T1 = Q-M12-T1 satisfaction /5) | The same Kirkpatrick widget uses two T1 scales and sources. | M10 reads Q-M12-T1 in the teacher scope; state whether DV-M17-08 applies to the teacher twin, or document the difference. |
| XL3-33 | Minor | M12 / M18 | DATA-M12-02 Intervention (alertType mood / inactive / declining; live 0) ↔ DATA-M18-01 Intervention (type kaunseling…; ids 2, 3) | Two owned stores share one entity and repository name. Their contents differ, so they are separate live tables. | Rename (e.g. `KirkpatrickIntervention`, `AmaranIntervention`) and give them distinct repository names. |
| XL3-34 | Minor | M12 | §6.5 Q-M12-HC-RECORDS, §6.7 DC-M12-02 (fallback) ↔ M08 (744 entries, S13 6 configs / 48 pupils); M17 R-25 | M08 cannot hold 4,378 OTR records without changing its observed platform headcount figures. | Activate **DC-M12-02** (valid: no other headcount-record figure on its cards); withdraw the M08 query request. |
| XL3-35 | Minor | M18 (+ M10, M08) | M18 XR-08 class 517 "5 Simulasi" (T5, 15 of 8880's T5 pupils) ↔ M08 T5 card "Murid 3,911", M10 750 | It is unstated whether 517's members were already T5-class members, and whether 517 replaces a generated class. | State both (then 3,911 and 750 stay unchanged). |
| XL3-36 | Minor | solution-architect | overview §6.7 (provisional wallet in M05, `owner: 'M14'`), §10 chips; build-plan v1.7 (no M12–M18 tasks; F-26 provisional wallet seeds) ↔ M14 §7.1 | The handover and the new seed values (pelajar 370 / 916, pelajarmaju 267 / 432) are not reflected. F-26 code seeded the old values. | Update §6.7 / §10; add batch-3 tasks after this gate; route a follow-up to F-26 when M14-T1 lands. |

## 10. Critical and Major findings by owner (route in parallel)

| Owner | Findings | What to do |
|---|---|---|
| **M05** | XL3-01, 03, 04, 05 | Raise Q-ANS-CORRECT (396,391 recommended) and add Q-SESS-MEAN-ACC; apply the M14 handover; host the M12 segment as a separate aggregate store; the M18 / M17 / M16 requests incl. sessionless answers and the per-pupil accuracy set |
| **M08** | XL3-02, 06, 07 | Redefine 79.8% / level accuracy (session mean); read the M14 wallet; headcount, history and item-statistics seeds incl. the 8880 grade check |
| **M02** (+ M01) | XL3-08 | One consolidated placement table and a re-run of the build checks |
| **M01** | XL3-09 | `onLogin`, referral path |
| **M04** | XL3-10, 11 | `jutawanQuestions` store (build-blocking for M16); `coverageExcluded`, ImportRun, `createdBy`, M18 question block |
| **M03** | XL3-24 | 60 out-of-tree chapters |
| **M07** | XL3-22 | PKSK split 253 / 253 / 191 / 66; `pksk` mode |
| **M10** | XL3-12 | Contribution hook, Command Center mount, classes 366–372 / 813 / 516 / 517 and memberships |
| **M11** | XL3-13 | 8880 / 8765 rows, 4664 / 4644 links + zero-answer S4, battle counters, reject XR-M17-08 |
| **M14** | XL3-14, 15 | 4207 / 4208 inactive + S22-safe extra wallets; `totalDays` and the streak anchors |
| **M16** | XL3-16, 17, 18 | S20 at the clock with M17 identities; 168 / 66 battles and game results; anchor grades |
| **M17** | XL3-16 (joint), XL3-19 | Re-derive the PROPOSED 25 Sep placements; S11 "Syiling" definition or DC |
| **M18** | XL3-20, 21 | 8880 login D9 fix on M18's side; sessionless class-516 answers |
| **Delivery Lead / architect** | XL3-23 | Owners M26 (mood, tuition) and M21 (sponsors) with provisional contracts |

Minor findings: M16 XL3-25/26/27; M14 XL3-28/29/30; M17 XL3-31; M10 XL3-32; M12 / M18 XL3-33; M12 XL3-34; M18 XL3-35; architect XL3-36.

## 11. Recommendations on the decision items

1. **Accuracy.** M05 pins P-correct 395,873 (Q-ANS-CORRECT 396,391). M08 moves "Purata Ketepatan" and the level cards to the mean of session accuracies (§3). No user question is needed.
2. **M12 segment.** Use a separate M05 aggregate store outside Q-SESS-ALL and the answer log (XL3-04).
3. **Q-M12-HC-RECORDS.** Activate DC-M12-02 (XL3-34).
4. **3201–3215.** Move them to 8880 with **sessionless** answers (XL3-21). Their `lastLoginAt` follows M11 / M17 (not null), and M18 records the D9 change to its risk seed (XL3-20). M08's "9 murid" still holds.
5. **M18 accuracy set.** Accept a small M05 table separate from SubjectMastery (XL3-05).
6. **M16 Jutawan.** Accept an M04 `jutawanQuestions` store (XL3-10).
7. **M16 S20.** Restate at the project clock with M17's identities (XL3-16).
8. **Teacher coins.** 4207 / 4208 inactive; new zero-question wallets carry 42,617 outside S22 (XL3-14).
9. **XR-M17-08.** Reject; keep DV-M17-28's fallback (XL3-13).
10. **Mood owner.** M26, with a provisional contract now (XL3-23).

Round 2 re-checks only the changed sections plus a re-run of `calc.cjs`, `m02budget.cjs` and a joint S20 / M17-week script.

---

# Round 2 — re-check after the owner fixes

| Field | Value |
|---|---|
| Scope | M01 v1.10, M02 v1.15, M03 v1.10, M04 v1.11, M05 v1.11, M07 v1.7, M08 v1.8, M10 v1.7, M11 v1.9, M12 v1.4, M14 v1.3, M16 v1.3, M17 v1.4, M18 v1.4. Unchanged: M06 v1.4, M09 v1.4, M13 v1.1, M15 v1.3; architecture overview v1.5 and build-plan v1.7. Delivery Lead decisions 1–8 of 2026-09-27 are taken as given. |
| Method | Status of XL3-01…36 with section and line citations. Scripts re-run in `xl3/`: `r2.cjs` (accuracy partition, M02 v1.15 student check, M14 teacher coins, M18 DV-44 kombo mean, M16 S20 ranks 6–20 per-school budgets), plus `nav.cjs`, `m14.cjs` and `calc.cjs`. Regression scan across M01–M18 for ids, names, counts, flows and the clock, and the owner-raised residuals. |
| Date | 2026-09-27 |

## R2.1 Verdict

**FAIL — 0 Critical, 6 Major, 6 Minor.**

**Round-1 closure:**
- All 24 round-1 Majors are closed as written.
- 11 of the 12 Minors are closed; XL3-36 is still open (R2-11).

**Scripted checks that pass:**
- Q-ANS-CORRECT 396,391: P accuracy 82.86%, platform 82.84%, free non-P accuracy 79.9%.
- Students 4,158 + 9 + 1 + 7 + 137 + 98 + 36 + 87 = **4,533**; M08 T4 card 98 + 36 + 15 = **149**.
- Teacher coins 20,842 + 42,617 = **63,459**.
- M16 S20 ranks 6–20 fit M17's per-school week remainders exactly for 8078 (295), 8090 (95) and 8088 (20), and stay under the others (8080 85/100, 8082 55/70, 8106 69/90).
- M18 DV-M18-44 is justified. 8880's top-10 kombo rows sum to 88, so 14 active pupils give a mean of 6.57–7.43; the observed 6.4 cannot be computed from them.
- No id collision: new blocks M03 1282–1341, M04 701001–701099, M10 missions 7103/7104 and sets 7401/7402.
- `nav.cjs`: 0 unresolved.

**The six Majors:**
- **One comes from the new Delivery Lead decision 2.** Pelajarmaju at the real school 5441 falls inside M17's population P, which changes observed M17 figures (R2-01).
- **Five are residuals the owners raised, each confirmed:**
  - 8765 / 2700 sessions are not in M05's KirkpatrickSessionAggregate: C9 is not resolved (R2-02);
  - M05 has not placed the 8 mission sessions (R2-03);
  - M05 has no `pksk` mode (R2-04);
  - the class memberships of the M18 schools' pupils require swaps that the default seed does not make (R2-05);
  - the M17 "{n} GURU" enrolments are not designed anywhere (R2-06).

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 6 |
| Minor | 6 |
| **Total** | **12** |

## R2.2 Status of the round-1 findings

| ID | Status | Evidence |
|---|---|---|
| XL3-01 | **Closed** | M05 §6.14.2 L552 Q-ANS-CORRECT 396,391; L526–529 partition (non-P anchors 180 + free 338). `r2.cjs` confirms. The partition becomes stale under decision 2 (R2-01). |
| XL3-02 | **Closed** | M08 BR-M08-07 L269, L99, L352: Q-SESS-MEAN-ACC (M05 L554); class figures per answer; Murid Terbaik ≥ 3 sessions (changelog L20). |
| XL3-03 | **Closed** | M05 changelog L27; BR-08/09/10/31 → M14; wallets 370/916 and 267/432 (L479); `mock.addSession` FR L244; SQ-4 and SQ-11 closed. |
| XL3-04 | **Closed** (residual R2-02) | M05 §6.14.4 L586 KirkpatrickSessionAggregate; M12 L270, L384, L596 cite it. |
| XL3-05 | **Closed** (residuals R2-02, R2-03) | M05 L587 PupilSubjectAccuracy; Q-ANS-NOSESSION L555 (6,604 → session answers 471,895); Q-WEEK-RANK L563; `subjectId` nullable (FR-151 L245); the 12 before-M1 answers at 8765 (M11 L342). |
| XL3-06 | **Closed** | M08 E2E-17 L648 "256"; the remaining "342,703" mentions are in the changelog. |
| XL3-07 | **Closed** | M08 changelog L20: DATA-M08-11 ItemStatistic (L337, L382, L384); 8880's 148 entries = 75 class-516 entries + 73 others (`grade8880.js`); config 617; SchoolSpmHistory at 8880. |
| XL3-08 | **Closed** (new issue R2-01 from decision 2) | M02 §6.15 D L554–616: k = 36; school 1 swapped back in (1267 emptied); 4207/4208 inactive (L554, L594); 4664/4644 (L591); build checks re-run (changelog L32–35). |
| XL3-09 | **Closed** | M01 FR-M01-69 L163 (`onLogin`), FR-M01-70 L164 (referral). |
| XL3-10 | **Closed** at M04 (M04 L202, L246, L275; DATA-M04-12) | M16's own text still calls DC-M16-02 interim: Minor R2-07. |
| XL3-11 | **Closed** | M04 `coverageExcluded` L203/247/276/319; ImportRun D11 set; M18 block 701001–701099 (L203, L508). |
| XL3-12 | **Closed** (residuals R2-03, R2-05, R2-06) | M10 L202/L309 `onQuestionContributed`; FR-M10-26 unblocked; classes L417; missions L516. |
| XL3-13 | **Closed** | M11 L342 (8880 10,196; 8765 222); FR-M11-87 L154 (zero-answer S4); links L430/514; battle counters; XR-M17-08 kept. |
| XL3-14 | **Closed** | M14 L585–586 (4207/4208 inactive; three zero-question wallets carry 42,617); `r2.cjs` gives 63,459. S22 stated as unchanged by M14's script. |
| XL3-15 | **Closed** | M14 `totalDays` L379; streak anchors L600–604. |
| XL3-16 | **Closed** | M16 §6.11.4 (4359–4377 dropped; ranks 1–5 = 2022 and W2–W5; ranks 6–20 inside the budgets); M17 C-19 L527; M05 v1.11 changelog L28 (2018/2019 `latih_tubi`, W5 4 × 40). `r2.cjs` per-school budgets pass. |
| XL3-17 | **Closed** | M16 L108/279/285/371 (`abandoned`; 168 = 66 + 5 + 97; 47 game results); M17 L363/418 read Q-M16-BATTLES. |
| XL3-18 | **Closed** | M16 §6.11.4: 4321 primary Darjah 6 at 2710; 4301 and 4320 T5 register rows. |
| XL3-19 | **Closed** | M17 DC-M17-08 L314 (S11 shows no M14 wallet figure beside it: valid under D11). |
| XL3-20 | **Closed** by decision 3 | M18 DV-M18-43 L268/396/474/739; M11 8880 row unchanged (L342). |
| XL3-21 | **Closed** | M05 Q-ANS-NOSESSION; M18 L450/517; M08 BR-M08-07 session counts unaffected. |
| XL3-22 | **Closed** (residuals R2-04, R2-08, R2-09) | M07 L214/344: 253 / 253 / 191 / 66; M04 changelog L19. |
| XL3-23 | **Closed** in M17 (L286–287, L352, L365) | The architecture registry is still missing: Minor R2-11. |
| XL3-24 | **Closed** | M03 L228/321/395/404: ids 1282–1341, CH-ALL-INCL-ORPHAN 1,311, runtime floor 1342. |
| XL3-25 | **Closed** | M16 BR-M16-08 L283 (82.84%). |
| XL3-26 | **Closed** | M14 `canEarnSyiling` L285/709; M16 #32/#34. |
| XL3-27 | **Closed** | M16 S20 rank 14 = pelajarmaju. Its row still shows school 900002: see R2-01. |
| XL3-28 | **Closed** | M14 BR-M14-35 L299 (weeks 7–29 days). |
| XL3-29 | **Closed** | M14 changelog L20 (`correct`, `total`, `detail`). |
| XL3-30 | **Closed** | M14 changelog L20 (372/269); M01 E2E-51. |
| XL3-31 | **Closed** | M17 changelog L20 (object signature). |
| XL3-32 | **Closed** (documented difference) | M10 changelog L20: T1 keeps the observed "/10" scale; DV-M17-08 does not apply to the teacher twin. |
| XL3-33 | **Closed** | M12 `KirkpatrickIntervention` (L20); M18 `AmaranIntervention` (L21). |
| XL3-34 | **Closed** | M12 DC-M12-02 active (L352). |
| XL3-35 | **Closed** | M10 L417; M18 changelog L21. |
| XL3-36 | **Open** | Overview v1.5 L434 and L720 still place the wallet in M05; build-plan has no batch-3 tasks: R2-11. |

## R2.3 New and residual findings

| ID | Sev | Owner | Doc IDs | Problem | Fix |
|---|---|---|---|---|---|
| R2-01 | **Major** | **Delivery Lead + M02 / M01** (consequences in M05, M08, M09, M14, M16, M18) | M02 v1.15 L479/574 and M01 v1.10 L30 (canonical 4 at real school **5441**) ↔ M17 BR-M17-03 (P = active students **outside fixture schools**); M05 L526/528 (pelajarmaju counted **outside P**); M14 L604 ("the designed unlocks of pelajarmaju are at fixture school 900002, outside M17's scope"); M09 SRS L447 and URS L613/791 (pelajarmaju at 900002 sees perutusan #3); M08 L320 and M16 §6.11.4 rank 14 (school "900002") | At 5441 pelajarmaju joins P. Her designed sessions M1–M4 (37 answers, 26 correct, 23–25 Sep, including M3 and M4 today) and her 3 September achievement unlocks then change **observed M17 values at the clock** (`r2.cjs`):<br>• today 340 → 357 answers, 17 → 19 sessions, 4 → 5 pupils, 3 → 4 active schools (a new S3 row for 5441);<br>• week 2,508 → 2,545;<br>• month 20,206 → 20,243;<br>• engaged 1,563 → 1,564 unless the replaced generated pupil had answers;<br>• Q-M17-BADGES "0 in every period" → 3.<br>M05's P / non-P partition is also stale: pelajarmaju's 37 / 26 move into P. M09's provisional AC (only #3) changes. 5441 has no state or district (owner residual): a Johor-KLUANG placement would change M18's KLUANG figures, and a PPD HULU LANGAT placement would change M18's officer views. | **Recommended:** place canonical 4 at an **existing fixture school, 900003** (SMK Demo Seri Putra). Fixture schools are excluded from P, M11, M12, M17 and M18 (BR-M11-34, BR-M17-03, BR-M18-02). 900002 stays empty, which keeps M08 S9 "Tiada Data Pelajar". The S1 filter stays 60 because 900003 already holds user 3102. Update M01 §6.8, M02 §6.15 B/C/D, M08 L320, M09 L447 / URS L613/791 (pelajarmaju then sees 900003's perutusan #4, provisional), M14 L604 and M16 rank-14 row. **Alternative (keep 5441):** M05 moves pelajarmaju into P, reduces generated P answers by 37 and generated P correct by 26, and re-dates her M1–M4 sessions and unlocks before September; M02 gives 5441 a state outside Johor, Perak and PPD HULU LANGAT. This alternative is rejected: it changes M05, M08, M14 and M16 designed scenarios (quests "today", M16 rank 14). |
| R2-02 | **Major** | **M05** (+ M18, M12) | M05 §6.14.4 L586 (KirkpatrickSessionAggregate = "T4/T5 students at non-fixture schools"; totals and anchors as M12 §6.5 only); `feas.js` C9 still **FAIL** (L543); SQ-12 (a) open (L887) ↔ M18 L390, L478, L517 (8765's 21 sessions / 309 / 242 for 2 pupils and 2700's one session 14 / 4 at 28.6% "read from KirkpatrickSessionAggregate"); M12 top-up 8765 row (16 pupils · 5 active · 51 sessions · 290 answers; `observed:false` reference) | C9 is **not resolved.**<br>• M05 lists none of M18's 8765 or 2700 rows in the store.<br>• 2700 is a primary school, so its pupil is outside the store's own scope (T4/T5).<br>• If both 8765 pupils are T4/T5, M12's Q-M12 queries over the same store would put ≥ 309 answers on 8765, against M12's 290 reference. | M05:<br>• widen the store's scope to "session aggregates outside the log" with the pupil's grade and school kept, so that every Q-M12-* filters T4/T5 at non-fixture schools (as M12 §6.5 defines);<br>• add the M18 anchors (8765: 2 pupils 4 · 60 · 64% and 17 · 249 · 82.6%, months Jan–Apr, last sessions 07/04 and 21/03; 2700: one pupil 14 / 4, 13/02/2026) with grades that keep M12's 8765 row, e.g. the 17-session pupil is one of 8765's 5 lower-form pupils, or state M12's 8765 row values;<br>• re-run `feas.js` C9 to PASS and close SQ-12 (a).<br>M18 cites the anchors. |
| R2-03 | **Major** | **M05** | M10 L516 (request R-M05-02: 8 completed September sessions of class-813 pupils as mode `mission`, 5 on 7103 dated 08/09, 3 on 7104 dated 22/09) ↔ M05 §6.14.1 (no mission pins; no 7103/7104 anywhere) ↔ M17 Q-M17-MISSIONS (week 3, month 8, today 0) | M17's mission figures have no M05 records to count (Q-SESS-LINK gives 0). | M05 marks 8 existing sessions of class-813 members as `mission` with `missionId` 7103 (5) / 7104 (3), inside the existing session counts and M17's per-school figures; add the pin to §6.14.1 and to E2E-61. |
| R2-04 | **Major** | **M05** | M07 v1.7 BR-M07-26, FR-M07-65, §13.1 XR-M07-02 (L577ff) ↔ M05 §6.1 mode enum (no `pksk`); M14 BR-M14-03 (maps `pksk` → `quiz_pksk`) | M07's PKSK domain practice now completes through M05 BR-31 with mode `pksk`. M05 does not define that mode, the `pkskDomainId` / `pkskTargetLevel` fields, nullable `subjectId` on PKSK answers, or the completion path, so the flow M07 → M05 → M14 cannot complete. | Add mode `pksk` with those fields to DATA-M05-01/02 and BR-31 (M07's `completeSession` call). The seed holds no `pksk` session, so no count changes. Classification for consumers: R2-10. |
| R2-05 | **Major** | **M10 + M02** (with M18) | M10 L418 (register pupils join T4 classes 4–10 "only by a one-for-one swap"; **"the default seed makes no swap"**); M02 L609 (re-homed pool at 8765 = 0; 7780 5, school 1 9, 3160 9, 2700 10, 2710 2, 8772 1) and L616 open point (1) ↔ M18 §6.11 B / F and C28 (8765: 17 pupils in classes, T4-class set **14**, T5-class set **7**, 4 in both; in-class pupils 8772 8, 8767 8, 7780 8 of the "Bestari / Cemerlang / Dedikasi - BM / SEJ" classes) | With no swap and no re-homed pool pupil at 8765, 8765 has **0** pupils in the T4 classes 4–10, against M18's observed 14. It also has none in their T5 twins, against 7. 8772, 8767 and 7780 are short too, since their observed in-class counts exceed their re-homed pupils (1, 0, 5). M18's S22, S28 / S30 T4 / T5 denominators and class-kombo rows cannot be built. | M10 (with M02) puts the swaps **in the default seed**:<br>• 8765: ≥ 14 T4-class memberships by one-for-one swaps with T4-pool members, and the 7 T5-twin memberships by the same rule, so M08 T5 "Murid" 3,911 stays;<br>• 8772, 8767, 7780: the missing in-class pupils likewise.<br>The swapped-out pool members lose their memberships (M02 records it). Re-run `t4check.js` (149) plus a T5 check (3,911). |
| R2-06 | **Major** | **M10** (with M17) | M17 BR-M17-11 L224 ("{n} GURU" = distinct owners of a class with an active enrolment of a pupil who answered in the period), §6.4 Q-M17-SCH-TEACHERS (today 8106 2, 8082 1, 8080 1; week 8106 17, 8082 50, 8078 22, 8080 6, 8090 9; month 8106 18, 8082 61, 8080 8, 8078 37, 8090 23, 8284 1) ↔ M10 L417 (8082: 14 of 68 teachers own classes; 8080: its 34 teachers own none, 1919 owns 366–372) | The enrolments that produce these counts are defined nowhere. 8082's 8 week pupils need classes of **50** distinct owners and its 22 month pupils **61**, so at least 36 / 47 owners must be teachers outside 8082. 8080 needs 6 / 8 owners, 1919 plus 5 / 7 others. Without the design, S3 "{n} GURU" cannot be built or checked. | M10 publishes the enrolment design: which generated owners (school or no school) own classes holding each school's week / month / today answering pupils, with counts matching the list above, and consistent with 8082's 14 owners Σ 515 pupils, class 813's 44 members, the M08 T4 / T5 cards and M11 (no M11 count depends on class ownership). Add a script check. |
| R2-07 | Minor | M16 | M16 §6.10 L459, L467, L905, SQ-M16-05 L1244 ("DC-M16-02 … interim until M04 decides", "build-blocking") ↔ M04 v1.11 DATA-M04-12 `jutawanQuestions` (L202) | The stale wording keeps the display constant as the S19 source. | Q-JUT-COUNT = M04 `questions.jutawan.count`; retire DC-M16-02; Jutawan samples `questions.jutawan.sample`. |
| R2-08 | Minor | M04 | M07 L214/585 (cites "M04 Q-PKSK-DIFFICULTY", XR-M07-01) ↔ M04 v1.11 (the cells exist, the named query does not) | Name mismatch. | Add Q-PKSK-DIFFICULTY = 253 / 253 / 191 / 66 / 0 to M04 §4.1. |
| R2-09 | Minor | M14 | BR-M14-03 L267 (precedence (1) passed rate, (2) `flat_quiz_reward` > 0, (3) tier rate; "PKSK sessions use `pksk_reward_correct`") ↔ M07 XR-M07-03 | It is ambiguous whether `flat_quiz_reward` (seed 1) or `pksk_reward_correct` (5) wins for mode `pksk`. | State it, e.g. "mode `pksk`: the tier's `pksk_reward_correct`, before the flat reward" (INFERRED). No seeded value changes. |
| R2-10 | Minor | M05 (for M08, M11, M17) | M08 BR-M08-11 (practice-mode list), M11 BR-M11-04 (type by mode), M17 Q-M17-SESS / Q-M17-ACT (any mode) ↔ new mode `pksk` (R2-04) | Consumers have no display or count rule for runtime `pksk` sessions. The seed has none, so no seeded figure moves. | M05 states the classification (recommended: `pksk` is a practice mode for BR-M08-11, with M11's "Latihan" type, counted by M17 as a session); M08, M11 and M17 cite it. |
| R2-11 | Minor | solution-architect | overview v1.5 L434, L720 (provisional wallet in M05); no registry of the provisional M26 / M21 stores that M17 L286–287 declares under "architecture §6.7"; build-plan v1.7 without batch-3 tasks | XL3-36 is still open. The provisional-store pattern M17 cites is not recorded for M26 / M21. | Update §6.7 / §10 (the wallet is M14's; provisional M26 mood / tuition and M21 sponsor stores with their seeds); add batch-3 tasks; route the F-26 seed follow-up. |
| R2-12 | Minor | M12 | M12 changelog L20 ("XR-08 open (mood owner, recommended M26)") ↔ decision 6 (mood → M26, provisional contract) | The status is stale. | Mark XR-M12-08 decided: `moodCount` reads the M26 provisional store (0 check-ins in scope for the Behavior read model, as today). |

## R2.4 Regression scan (no finding)

- **Clock:** every module states the single clock 2026-09-25T15:40. The new records (M10 missions 08/09 and 22/09, question sets 28/08, M14 streak anchors, M16 game results and abandoned battles, M05 25/09 sessions up to 14:59) are all dated before it. M16 S20 and M17 now keep the post-clock readings as the observed record only.
- **Ids:** no overlap across the users blocks listed in §4, M03 1282–1341, M04 701001–701099, M10 7101–7104 / 7401–7402 / 7601–7602, class ids 366–372 / 813 / 516 / 517, M13 13101–13599, M14 140001–140299. M16 users 4359–4377 are withdrawn everywhere (M02 v1.13 L33).
- **Names:** `onSessionCompleted`, `onLogin`, `onGameResult → {coinsCredited, xpAdded}`, `canEarnSyiling`, `mock.addSession`, `mock.addAnswer({…})`, Q-SESS-MEAN-ACC, Q-ANS-NOSESSION, Q-WEEK-RANK and `questions.jutawan.*` are the same in owner and consumer docs. The exception is Q-PKSK-DIFFICULTY (R2-08).
- **Counts:** DC-M12-02, DC-M16-01, DC-M16-03, DC-M17-01…08 and DATA-M18-06 (DV-M18-44, proven necessary by `r2.cjs`) are each shown without a contradicting computed figure beside them.
- **Flows:**
  - session → M14 → M08: closed;
  - login → M14: closed;
  - game → M14: closed;
  - redemption → M14: closed;
  - contribution → M14: closed;
  - officer views: blocked only by R2-02 and R2-05;
  - M17: blocked by R2-01, R2-03 and R2-06;
  - PKSK → M05 → M14: R2-04.

## R2.5 Findings by owner (open)

| Owner | Major | Minor |
|---|---|---|
| Delivery Lead + M02 / M01 | R2-01 (relocate canonical 4 to fixture 900003, then update the stale references in M08, M09, M14, M16) | — |
| M05 | R2-02 (store anchors for 8765 / 2700, C9 PASS), R2-03 (mission sessions), R2-04 (`pksk` mode) | R2-10 |
| M10 (+ M02) | R2-05 (default-seed swaps at 8765 / 8772 / 8767 / 7780), R2-06 ("{n} GURU" enrolment design) | — |
| M04 | — | R2-08 |
| M14 | — | R2-09 |
| M16 | — | R2-07 |
| M12 | — | R2-12 |
| solution-architect | — | R2-11 |

Round 3 re-checks R2-01…12, re-runs `r2.cjs` (with pelajarmaju's final placement), `feas.js` C9 and the M10 `t4check.js` plus a T5 check, and runs a small script for the "{n} GURU" enrolments.

---

# Round 3 — re-check after the round-2 fixes

| Field | Value |
|---|---|
| Scope | M01 v1.11, M02 v1.16, M03 v1.10, M04 v1.12, M05 v1.12, M07 v1.7, M08 v1.8, M10 v1.8, M11 v1.9, M12 v1.5, M14 v1.4, M16 v1.4, M17 v1.5, M18 v1.5. Unchanged: M06, M09, M13, M15. **On disk:** architecture overview is still **v1.5** and build-plan is still **v1.7**; the promised v1.6 / v1.8 have not landed. |
| Method | R2-01…12 verified with section and line citations. The owners' build scripts were copied into `xl3/` and run from there, unchanged: M10 `t4check.js` (with `s29.json`), M10 `guru-check.js` and M05 `feas.js`. `r2.cjs` was re-run. Regression scan across M01–M18 for stale references to canonical 4, mode names, display constants and the clock. |
| Date | 2026-09-27 |

## R3.1 Verdict

**FAIL — 0 Critical, 1 Major, 4 Minor.**

**What passes:**
- 11 of the 12 round-2 findings are closed. R2-11 (architecture) is still open, as expected.
- Every owner script passes:
  - `t4check.js`: T4 card **149**, class sizes 58 / 53 / 54, Σ memberships 356, T5 card **3,911**, every S29 per-class count met; 21 T4 swaps in, 1 re-homed pupil leaving T4 classes, 32 T5 swaps; pool 98 → 78.
  - `guru-check.js`: every M17 "{n} GURU" target met for 8106, 8082, 8080, 8078, 8090, 8088 and 8284 (today / week / month); fixed owners keep their classes (1919: 366–372; 4402: 813 only).
  - `feas.js`: C1–C8 and C10–C14 PASS; C9 N/A.

**Remaining findings:**
- **One Major (R3-01).** The swap design is complete on memberships but says nothing about **sessions**. It can therefore move M08's observed T4 / T5 level-card figures, and the build check does not assert them.
- **Four Minors.** Stale references after the canonical-4 move (M08, M14, M16, M09), two consumers not yet citing M05 BR-35, and the architecture update.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 4 |
| **Total** | **5** |

## R3.2 Status of the round-2 findings

| ID | Status | Evidence |
|---|---|---|
| R2-01 | **Closed** (stale references: R3-02, R3-03) | M02 v1.16 changelog L54, §6.15 C L576 (canonical 4 at fixture **900004**; 900002 without a pupil; student check 4,158 + 10 + 7 + 137 + 98 + 36 + 87 = 4,533, recomputed); M01 v1.11 L422; DV-M02-13 in M02 URS L1882 (S1 filter 61 vs live 60, final Delivery Lead decision with alternatives). 900004 lies in the fixture range 900001–900099, so pelajarmaju is outside P (M17 BR-M17-03), M11 (BR-M11-34) and M18 (BR-M18-02): the observed M17 today / week / month / badge values are unchanged. The M05 partition (L526/528, `feas.js` C1: non-P anchors 333 / 180) is valid again. |
| R2-02 | **Closed** | M18 DATA-M18-07 L356 / L402 / L438 (C30) / L463: 8765's 21 sessions / 309 / 242 and 2700's session are M18 documented display values. M05 BR `feas.js` C9 is N/A (changelog L29); SQ-12 (a) is closed; KirkpatrickSessionAggregate keeps its T4/T5 scope, so M12's 8765 row is untouched. **D11 note:** S9 shows 8765's session correct count (242) next to the calendar's answer-log correct count (186). These are two labelled definitions, observed together on live, and M18 records the pairing (C30). This replicates live and is not a rebuild-introduced contradiction, so it is accepted. |
| R2-03 | **Closed** | M05 §6.14.1 L544 / L573 (7103 × 5 dated 08/09, 7104 × 3 dated 22/09, relabelled existing practice sessions of class-813 members); `feas.js` C13 PASS (M17 week 3 / month 8 / today 0; Q-SESS-ALL and Q-WEEK-RANK unchanged, since `mission` is a practice mode). |
| R2-04 | **Closed** | M05 §6.1 L247 / L376 (mode `pksk`, `pkskDomainId`, `pkskTargetLevel`; nullable `subjectId` / `selectedOptionId` on PKSK answers), BR-34 L336 (`practice.completeSession`), FR-M05-152, E2E-M05-67; `feas.js` C14 (0 seeded `pksk` sessions). |
| R2-05 | **Closed on memberships** (sessions: R3-01) | M10 §6.2.1 L419 and table A.1; `t4check.js` PASS (see R3.1). |
| R2-06 | **Closed** | M10 §6.2.1 L420; `guru-check.js` PASS. M17 v1.5 DV-M17-29 L347 / L433 / L468: 8284 month = 0 is a valid D9 fix. The month pupil is the week pupil, and the week value is 0, so month 1 contradicts it. |
| R2-07 | **Closed** | M16 §6.10 L468 "retired in v1.4"; L906, L1245. |
| R2-08 | **Closed** | M04 §4.1 L276 Q-PKSK-DIFFICULTY 253 / 253 / 191 / 66 / 0. |
| R2-09 | **Closed** | M14 BR-M14-03 L268 (passed rate → `flat_quiz_reward` > 0 → tier `pksk_reward_correct`; INFERRED, with reason). |
| R2-10 | **Closed at the owner** (consumer citations: R3-04) | M05 BR-35 L337. M16 BR-M16-31 already counts practice modes; M17 v1.5 cites BR-35. |
| R2-11 | **Open** (Minor, only architecture item) | overview.md still v1.5 (L434 / L720 place the wallet in M05); build-plan.md still v1.7. |
| R2-12 | **Closed** | M12 XR-M12-08 L391 (decided: M26, provisional). |

## R3.3 New findings

| ID | Sev | Owner | Doc IDs | Problem | Fix |
|---|---|---|---|---|---|
| R3-01 | **Major** | **M10** (with M02, M05, M08) | M10 §6.2.1 L419 (swap rule: 21 school pupils join T4 classes, 20 pool pupils leave them; 32 school pupils join T5 twins, 32 "generated T5 members" leave every T5 class) ↔ M08 BR-M08-07 L269 (level cards count **all** sessions of the distinct class members: T4 **11** sessions · 63.9% with the top students "3 sesi · 30 soalan" and "4 sesi · 60 soalan"; T5 **29,971** sessions · 79.7%, observed) and M05 §6.14.1 (level cells pinned); M18 (8765: 6 answering pupils; 17 of 21 in classes) | Membership changes move the M08 level cards whenever a joiner or leaver holds M05 sessions. The swap rule and `t4check.js` check distinct members only. The design itself forces sessions into play:<br>• 8765 has 17 pupils in classes and only 4 outside, so at least 2 of its 6 answering pupils are class members. Their 222 log answers sit in generated sessions (M05 Q-ANS-NOSESSION lists only admin, 3201–3215 and 2022).<br>• If they are T4-class members, T4's observed 11 sessions change.<br>• If they are T5-only members, T5's 29,971 sessions and its session mean change, unless the matching leavers carry the same sessions.<br>• Nothing forbids the 20 swapped-out T4-pool pupils from being the holders of the 11 T4 sessions, or the 32 T5 leavers from holding sessions. | Add a **session-neutrality rule** to M10 §6.2.1 and to `t4check.js`:<br>(1) T4 joiners hold no M05 session: 8765's 14 T4-class pupils are taken from its 15 non-answering pupils; 8767 and 8772 have no answering pupil;<br>(2) the 20 swapped-out pool pupils hold no session (the T4 session holders stay);<br>(3) 8765's answering in-class pupils are T5-only members, and each T5 leaver carries exactly the sessions / answers / correct / session accuracies of its joiner, or holds none when the joiner holds none;<br>(4) the build asserts M08 Q-SESS-LEVEL T4 11 · 63.9% and T5 29,971 · 79.7% after the swaps.<br>M02 then updates its §6.15 bucket text (pool 98 → 78: the 20 swapped-out pupils become no-school, no-class students; they must not be M16's 32 T4-pool anchors 4326–4358, which M16 lists as T4-class members). |
| R3-02 | Minor | M08, M14, M16 | M08 L320 (canonical 4 "(900002)"), L279 / L402 and changelog L20 ("XR-M08-01, open"); M14 L605 ("unlocks of pelajarmaju are at fixture school 900002"); M16 §6.11.4 rank-14 row L655 (school "900002") ↔ M02 v1.16 / M01 v1.11 (900004) | Stale school id. XR-M08-01 is now satisfied (900002 holds no pupil). | Replace 900002 by 900004 in these rows and close XR-M08-01. |
| R3-03 | Minor | M09 | M09 SRS L447 (pelajarmaju at "900002 SK Demo" sees perutusan #3), E2E-M09-57 L863 (provisional: pelajarmaju sees only #3), URS L613 / L791 ↔ M02 v1.16 (900004) | Perutusan #3 is scoped to school 900002 (author 3104). At 900004 pelajarmaju sees no school post, so the provisional E2E fails. | M09: pelajarmaju at 900004 sees only national posts. Either update E2E-57 / the AC, or retarget the provisional #3 scenario to another account at 900002, e.g. a test-only fixture. The admin stays at 900002. |
| R3-04 | Minor | M08, M11 | M08 BR-M08-11 L273 (practice modes enumerated without `pksk`); M11 BR-M11-04 L200 (type map without `pksk`) ↔ M05 BR-35 L337 (`pksk` is a practice mode for M08; "Kuiz" for M11) | The consumers' own rules contradict the owner's classification for runtime `pksk` sessions. No seeded value is affected (the seed holds 0). | Add `pksk` to BR-M08-11's practice list and to BR-M11-04's "Kuiz" map, citing M05 BR-35. |
| R2-11 | Minor | solution-architect | overview v1.5 L434 / L720; build-plan v1.7 | Still not on disk. | Land overview v1.6 (the wallet is M14's; provisional M26 mood / tuition and M21 sponsor stores) and build-plan v1.8 (batch-3 tasks; F-26 seed follow-up). |

## R3.4 Regression scan (no further finding)

- **Clock:** the new records (missions 08/09 and 22/09, the 8284 D9 value, the pelajarmaju sessions at fixture 900004) are all before 2026-09-25T15:40. No module seeds a post-clock row.
- **Ids:** 900004 is used only by M01 / M02 for canonical 4. There is no clash with M09's 900003 or the M02 fixtures. No new id blocks since round 2.
- **Names:** mode `pksk` means the same in M05 (§6.1), M07 (BR-M07-26), M14 (BR-M14-03, source `quiz_pksk`), M16 (battle `questionType`) and M17 (Q-M17-SESS / ACT). The only gap is the consumer rules of R3-04. `practice.completeSession` is the same in M05 BR-34 and M07 XR-M07-02.
- **Counts:**
  - DC-M16-02 is retired.
  - DATA-M18-07 is valid (see R2-02).
  - DV-M02-13 (filter 61) is a recorded Delivery Lead decision. No other module shows a schools-with-users figure that it contradicts: M11, M12 and M17 show 57, and M17's "Sekolah (61)" stays rejected at 57.
  - `r2.cjs`: teacher coins 63,459; students 4,533; T4 149.
- **Flows:**
  - session → M14 → M08 / M11 / M17: closed;
  - login, game, redemption and contribution → M14: closed;
  - PKSK → M05 (`completeSession`) → M14: closed;
  - officer views and M17 S3: closed, subject to R3-01 for the M08 level cards.

## R3.5 Open findings by owner

| Owner | Major | Minor |
|---|---|---|
| M10 (+ M02, M05, M08) | R3-01 (session-neutral swaps; assert the M08 level cards in `t4check.js`) | — |
| M08 | — | R3-02 (900004, close XR-M08-01), R3-04 (`pksk` in BR-M08-11) |
| M14 | — | R3-02 (L605) |
| M16 | — | R3-02 (rank-14 row) |
| M09 | — | R3-03 (pelajarmaju perutusan scope) |
| M11 | — | R3-04 (`pksk` in BR-M11-04) |
| solution-architect | — | R2-11 (overview v1.6 / build-plan v1.8) |

Round 4 needs only: R3-01 (re-run the extended `t4check.js`), then a check that the four Minors are fixed.

---

# Round 4 — targeted re-check of the round-3 findings

| Field | Value |
|---|---|
| Scope | M02 v1.17, M05 v1.14, M08 v1.9, M09 v1.5, M10 v1.10, M11 v1.10, M14 v1.5, M16 v1.5, overview v1.6, build-plan v1.8; everything else unchanged since round 3. |
| Method | The current owner scripts (M10 `t4check.js` with `s29.json` and `guru-check.js`; M05 `feas.js`) were copied into `xl3/r4/` and run from there, unchanged. Two new scratch checks, `g1.cjs` and `g34.cjs`, test the T4 top-row accuracy. Each fix is verified by section and line; the edited docs got a regression scan. |
| Date | 2026-09-27 |

## R4.1 Verdict

**FAIL — 0 Critical, 1 Major, 0 Minor.**

**What passes:**
- **All four round-3 Minors and R2-11 are closed.**
- **All three owner scripts pass:**
  - `t4check.js`:
    - T4 card 149, class sizes 58 / 53 / 54, 356 memberships;
    - M16 anchors 4326–4358 are still T4-class members;
    - the 20 swapped-out pupils are generated rows g47–g66 (not holders, not anchors);
    - T4 level 11 sessions · 63.9%; class 5/9 7 · 51.3%; class 6/10 4 · 81.7%;
    - T5 29,971 · 79.7%, with 2 leavers carrying the 8 sessions of 8765's 2 answering joiners;
    - 8765's 14 T4 joiners are all non-answering.
  - `guru-check.js`: every "{n} GURU" target is met.
  - `feas.js`: 16 PASS, C9 N/A, 0 FAIL.
- **R3-01 is closed for the level cards and the class cells.**

**What fails:**
- **One Major (R4-01), exposed by the R3-01 fix.** The new placement no longer reproduces M08's observed T4 "Murid Terbaik" row "4 sesi · 60 soalan **64%**".
  - `t4check.js` gives that pupil sessions of 13, 12, 12, 12 correct out of 15 each. That is 49 / 60 = **81.7%** by either definition (equal session sizes).
  - M05 `feas.js` C15 prints "(64 %)" as a label, not as a computed value.
  - M08's §6.3 design text (L353) still describes the older, different holder allocation.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 0 |
| **Total** | **1** |

## R4.2 Status of the round-3 findings

| ID | Status | Evidence |
|---|---|---|
| R3-01 | **Closed** (level cards, class cells, T5 neutrality); the top-row regression is R4-01 | M10 §6.2.1 L443 (holders, session neutrality, v1.9 / v1.10); M02 v1.17 changelog (pool 78 + `t4PoolSwappedOut` 20, none a holder or M16 anchor); M05 §6.14.1 L547; `feas.js` C15–C17 PASS; `t4check.js` OK (§R4.1). |
| R3-02 | **Closed** | M08 L321 (account 4 at 900004); L280 / L403 (XR-M08-01 resolved); M14 L606; M16 §6.11.4 L656. |
| R3-03 | **Closed** | M09 SRS L448, E2E-M09-57 L864 (pelajarmaju sees neither #2 nor #3; the author 3104 at 900002 sees #3); URS L614, L792. |
| R3-04 | **Closed** | M08 BR-M08-11 L274 (`pksk` counts as a practice mode, M05 BR-35); M11 BR-M11-04 L201 and §6.6 L318 (`pksk` → "Kuiz"). |
| R2-11 | **Closed** | overview v1.6: §6.7 store table (wallet, streak, quests and badges owned by M14; no provisional wallet in M05), L438–439 provisional M26 / M21 stores hosted in M17 (§6.7.2), §6.8 step 6 → `gamification.onSessionCompleted`, §10 chips from M14. build-plan v1.8: F-26b (M14 store in the student slice), F-24b / F-25b / F-26c / F-31 / F-33, batch-3 task rows §2.10–§2.16. |

## R4.3 New finding

| ID | Sev | Owner | Doc IDs | Problem | Fix |
|---|---|---|---|---|---|
| R4-01 | **Major** | **M08** (definition) with **M05 / M10** (session lists) | M08 §6.3 L353 (observed T4 top rows "3 sesi · 30 soalan 93.3%" and "4 sesi · 60 soalan **64%**"; its design gives class 6/10 = the 3-session pupil + one 30 · 21 pupil and class 5/9 = the 4-session pupil + two others); BR-M08-07 L270 (Murid Terbaik "by accuracy"; BR-M08-05 default = correct ÷ answered; only the level cards were moved to the session mean in XL3-02) ↔ M05 §6.14.1 L547 and M10 §6.2.1 L443 (v1.10: class 6/10 = the 4-session pupil alone, 49 / 60); `t4check.js` g1 = [13/15, 12/15, 12/15, 12/15] | The observed row value no longer holds.<br>• Class 6/10 must be 81.7% per answer and now holds only the 4-session pupil, so that pupil is 49 / 60 = 81.7% per answer.<br>• Its equal-size sessions also give a session mean of 81.7%, so S3 would show "81.7%" instead of the observed "64%".<br>• "64%" cannot be a per-answer value for 60 questions (38 / 60 = 63.3%, 39 / 60 = 65%), so the row must use the session mean.<br>• M08 does not state that definition.<br>• M08 §6.3 and M05 / M10 describe two different holder allocations for the same 11 sessions. | (1) **M08:** BR-M08-07 "Murid Terbaik" accuracy = the pupil's mean of completed-session accuracies (M05 Q-SESS-MEAN-ACC per user, as the level cards, XL3-02); restate §6.3 L353 to cite M05 §6.14.1's allocation instead of its own. (2) **M05 / M10:** give the 4-session pupil unequal sessions with 49 / 60 correct and a session mean that rounds to 64%. `g1.cjs` finds 6,920 such lists, e.g. 0/1, 1/1, 5/7, 43/51 = 63.94%. Re-tune the two 2-session pupils (46 questions, 11 correct) so the 11-session level mean stays 63.9%: the remaining ratio sum must lie in 166.59–167.69, and `g34.cjs` finds 17,820 lists, e.g. 0/1, 1/1, 4/8, 6/36. The 3-session pupil stays 10/10, 9/10, 9/10 (93.3% by both definitions). (3) **`t4check.js`** asserts the two top rows' displayed accuracies (93.3% and 64%). |

## R4.4 Regression scan of the edited docs (no finding)

- **Clock:** no new record in the edited docs is dated after 2026-09-25T15:40.
- **Ids:** M02 `t4PoolSwappedOut` (20 generated rows g47–g66) does not overlap the M16 anchors or the session holders. Account 4 at 900004 is consistent across M01, M02, M08, M09, M14 and M16 and the architecture docs.
- **Names:** mode `pksk` is consistent across M05 BR-35, M08 BR-M08-11, M11 BR-M11-04, M14 BR-M14-03, M16 and M17.
- **Counts:** students 4,533, T4 149, T5 3,911, the M17 "{n} GURU" targets, Q-ANS-CORRECT 396,391 and teacher coins 63,459 are unchanged.
- **Flows:** unchanged since round 3 (all closed).

## R4.5 Open findings by owner

| Owner | Major | Minor |
|---|---|---|
| M08 (+ M05, M10) | R4-01 (Murid Terbaik = session mean; §6.3 cites the M05 allocation; 4-session pupil re-tuned to 64% with the level mean kept at 63.9%; `t4check.js` asserts the rows) | — |

Round 5 re-runs `t4check.js` with the top-row assertion and checks the M08 BR-M08-07 / §6.3 wording. Nothing else is open.

---

# Round 5 — targeted re-check of R4-01

| Field | Value |
|---|---|
| Scope | M05 v1.15, M08 v1.10, M10 v1.11 (claims: Murid Terbaik = session mean with ties by user id; the exact H1–H4 session lists; M05 C15 / C17–C19). Nothing else changed. |
| Method | The owner scripts (`t4check.js` + `s29.json`, `guru-check.js`, `feas.js`) were copied into `xl3/r5/` and run from there. My own recomputation, `r5.cjs`, derives every figure from the lists in M10 §6.2.1 L450–455 / M05 §6.14.1 L548. `band.cjs` searches for session lists under M08's display rule. The three docs got a regression scan. |
| Date | 2026-09-27 |

## R5.1 Verdict

**FAIL — 0 Critical, 1 Major, 0 Minor.**

**Correct as claimed** (recomputed by `r5.cjs`, the same as `t4check.js` and `feas.js`, which print OK and 18 PASS / C9 N/A / 0 FAIL):

| Figure | Recomputed value |
|---|---|
| H2 | 28 / 30, session mean **93.3%** (displays "93.3%" ✓) |
| Class 6/10 (H1) | 49 / 60 = **81.7%** ✓ |
| Class 5/9 (H2 + H3 + H4) | 7 sessions, 39 / 76 = **51.3%** ✓ |
| T4 level | 11 sessions, session mean 63.899 → **63.9%** ✓ |
| Murid Terbaik T4 | Only H1 and H2 have ≥ 3 sessions, so 2 rows, ordered 93.3 then H1 ✓ (H3 and H4 have 2 sessions each and are not listed) |
| T5 rows | 10 all-correct pupils at 100.0%, tied and ordered by ascending user id in the live order; no other T5 pupil with ≥ 3 sessions reaches 100% (C18 / C19) ✓; the "100%" display of live 126.7…103.1% follows DV-M08-07 ✓ |
| `guru-check.js` | OK |

**What still fails — H1's displayed value.** H1's session mean is **63.936%**.
- M08 FR-M08-27 L116 formats the row accuracy with "1 decimal without '.0'", so the screen shows **"63.9%"**, not the observed **"64%"**. AC-M08-10.3 and E2E-M08-12 assert "64%".
- The same list shows "93.3%", so live does print one decimal. "64%" therefore means a value that rounds to 64.0, i.e. within [63.95, 64.05).
- My round-4 example (0/1, 1/1, 5/7, 43/51 → 63.94%) used an integer-rounding band that was too wide. This recommendation is corrected below.

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 1 |
| Minor | 0 |

## R5.2 Status of R4-01

| Claim | Status | Evidence |
|---|---|---|
| M08: Murid Terbaik = session mean, ties by user id | **Applied** | BR-M08-07 L270; FR-M08-27 L116; AC-M08-10.3 (URS L501); E2E-M08-12 L645 |
| M08 §6.3 cites M10 §6.2.1 | **Applied** | M08 L354 (the v1.8 construction is gone: no "20 · 13" / "13 · 1" lists remain) |
| M10 exact lists H1–H4 | **Applied, H1 does not render "64%"** | M10 §6.2.1 L450–455 (H1 "63.94 % → **64 %**"); M05 §6.14.1 L548 |
| M05 C15 / C17 / C18 / C19 | **PASS as coded** | `feas.js` in `xl3/r5/`. C15 prints "64 %" by integer rounding, which does not match M08's 1-decimal format. |

## R5.3 Finding

| ID | Sev | Owner | Doc IDs | Problem | Fix |
|---|---|---|---|---|---|
| R5-01 | **Major** | **M10 / M05** (the lists); M08 unchanged | M10 §6.2.1 L450 (H1 0/1, 1/1, 5/7, 43/51 → 63.94%); M05 §6.14.1 L548; `feas.js` C15, `t4check.js` "top row A" ↔ M08 FR-M08-27 L116 (1 decimal without ".0"), AC-M08-10.3, E2E-M08-12 ("64%") | H1 renders "63.9%" under M08's own format. The observed "64%" requires a session mean in [63.95, 64.05). | **H1:** re-pick a list with 49 / 60 correct and a session mean in [63.95, 64.05). `band.cjs` finds **649** such lists; the one with the largest minimum session size is **0/7, 5/7, 11/13, 33/33 → 64.011%** (class 6/10 still 49 / 60 = 81.7%). **H3 + H4:** re-tune them so the level mean still displays 63.9. With that H1 the ratio sum must lie in [166.31, 167.41); `band.cjs` finds **420** lists with session sizes 5–20, e.g. H3 = 4/5, 4/6 and H4 = 3/15, 0/20 (Σ 11 / 46, so class 5/9 stays 39 / 76 = 51.3%). **Checks:** `feas.js` C15 and `t4check.js` compare the **formatted strings** ("64%", "93.3%", "63.9%"), not integer rounding. M08 needs no change. |

## R5.4 Regression scan (M05, M08, M10)

- The session lists are identical in M05 L548 and M10 L450–455. M08 L354 cites them instead of copying them.
- No new ids. The holders are generated pool rows, not swapped out and not M16 anchors (`t4check.js`).
- T4 149 / T5 3,911 / 11 · 63.9% / 29,971 · 79.7% / Q-ANS-CORRECT 396,391 are unchanged.
- E2E-M08-12's link "T4 first row → `/prestasi/3201`" refers to Murid Berisiko (3201 has no session and is not a Murid Terbaik row); this is unchanged and consistent.
- No other finding.

## R5.5 Open findings by owner

| Owner | Major | Minor |
|---|---|---|
| M10 + M05 | R5-01 (H1 session mean in [63.95, 64.05); re-tune H3 / H4; the checks compare displayed strings) | — |

Round 6 re-runs `r5.cjs` with the new lists and compares the formatted strings.

---

# Round 6 — targeted re-check of R5-01

| Field | Value |
|---|---|
| Scope | M05 v1.16, M10 v1.12 (pinned lists H1, H3, H4; H2 unchanged; checks compare M08's displayed strings). Nothing else changed. |
| Method | The owner scripts (`t4check.js` + `s29.json`, `guru-check.js`, `feas.js`) were copied into `xl3/r6/` and run from there. My own `r6.cjs` recomputes every string with M08's formatter (FR-M08-27: one decimal, trailing ".0" dropped). |
| Date | 2026-09-27 |

## R6.1 Verdict

**PASS — 0 Critical, 0 Major, 0 Minor.** R5-01 is closed, and nothing is open in XL batch 3.

## R6.2 Evidence

**Pinned lists — identical in both docs:**
- M10 §6.2.1 L451–454: H1 (6/10) 0/7, 5/7, 11/13, 33/33; H2 (5/9) 10/10, 9/10, 9/10; H3 (5/9) 4/5, 4/6; H4 (5/9) 3/15, 0/20. L455 gives the class, level and formatter notes.
- M05 §6.14.1 L549: the same lists, with the "64%" / "93.3%" strings.
- The old lists (43/51, 3/5 7/7, 1/14 0/20) survive only in the M10 v1.11 changelog row (L21), which is history.

**Recomputed strings (`r6.cjs`, all match):**

| Figure | Computation | Mean or ratio | Displayed |
|---|---|---|---|
| H1 (Murid Terbaik, listed) | 4 sessions · 60 questions, 49 / 60 | session mean **64.011** | **"64%"** |
| H2 (Murid Terbaik, listed) | 3 · 30, 28 / 30 | session mean **93.333** | **"93.3%"** |
| H3, H4 | 2 sessions each, so not listed (≥ 3 required) | 73.3 / 10 | — |
| Class 5/9 | H2 + H3 + H4 = 7 sessions, 39 / 76 | — | **"51.3%"** |
| Class 6/10 | H1 = 4 sessions, 49 / 60 | — | **"81.7%"** |
| T4 level | 11 sessions | session mean **63.883** | **"63.9%"** |

The Murid Terbaik T4 order is H2 then H1, as observed.

**Owner scripts (in `xl3/r6/`):**
- `t4check.js`: OK — T4 149, class cells 7 · 51.3 and 4 · 81.7, top rows "64%" and "93.3%", 2-session pupils 11 / 46, T5 29,971 · 79.7%, 8765 joiners non-answering. Its top-row log line prints a doubled "%" sign ("64% %"); this is output text only and not a finding.
- `guru-check.js`: OK.
- `feas.js`: 18 PASS, C9 N/A, 0 FAIL. C15 and C17 now compare the formatted strings (level "63.9%" from 63.883, H1 "64%" from 64.011, H2 "93.3%", 5/9 "51.3%", 6/10 "81.7%").

**Regression:** Q-ANS-CORRECT 396,391, sessionless answers 6,604, T4 149 and T5 3,911 are unchanged. No other doc was edited in this round.

## R6.3 Final counts, XL batch 3 (M12–M18)

| Round | Critical | Major | Minor | Verdict |
|---|---|---|---|---|
| 1 | 0 | 24 | 12 | FAIL |
| 2 | 0 | 6 | 6 | FAIL |
| 3 | 0 | 1 | 4 | FAIL |
| 4 | 0 | 1 | 0 | FAIL |
| 5 | 0 | 1 | 0 | FAIL |
| 6 | 0 | 0 | 0 | **PASS** |

M12–M18 and the owner changes they requested of M01–M11 are cleared at the XL gate for build.

---

# Addendum A — post-pass recheck (M02 v1.19, M10 v1.14)

| Field | Value |
|---|---|
| Scope | M02 v1.18 (teacher anchors 4501–4504, M04 SQ-7) and v1.19 (M19 discovery C1–C5: the 14 live subscription rows; BR-24 `used` = active students; +10 active non-register students at 8228 / 8090 / 8106; the 8102 complimentary pupils active; inactive-student pins 0 at 8880, 8087, 8107, 8277, 10220, 8228; every one of the 57 real schools holds a student; `t4PoolSwappedOut` 20 → 0; T4 pool 78 → 75; DV-M02-14), and M10 v1.14 (T4 = 75 + 38 + 21 + 15). Checked against M11 §6.7, M12, M16, M17 and M18. |
| Method | The owner scripts (`t4check.js` + `s29.json`, `guru-check.js`, `feas.js`) were copied into `xl3/addA/` and run there. M02 has no standalone build-check script; the private `m02/check.js` only builds the SRS and checks traceability. I therefore wrote `a02.cjs`, which recomputes the M02 §6.15 student check, the 12 `used` values as P at each school, and the M17 populations. Targeted reads: M02 §6.14 L62–65, §6.15 B L553 / L560, D L592–620, L590; M17 BR-M17-03 L217, §6.4 L332 / L340, R-08 L389, XR-M17-06 L487; M11 §6.7. |
| Date | 2026-09-27 |

## A.1 Verdict

**FAIL — 0 Critical, 1 Major, 1 Minor.** The batch-3 PASS of Round 6 is suspended until A-01 is fixed.

**The v1.19 changes themselves are consistent.** A-01 is an **older defect**: it was present since M02 v1.12 and M17 v1.1 and was missed in rounds 1–6. It surfaced now because the v1.19 `used` = P check makes the per-population arithmetic explicit.

## A.2 What holds (script `a02.cjs` and the owner scripts)

**Students and T4 pool:**
- 4,158 + 10 + 7 + 137 + 75 + 39 + 107 = **4,533** (M02 L590).
- The T4 pool splits as 98 = 75 + 3 re-homed + 20 former `t4PoolSwappedOut` (now in G, 87 → 107).
- T4 card 149 = 75 + 38 + 21 + 15. The re-homed count is 39 in M02 and 38 in M10: one school-1 re-homed pupil holds only T5 memberships.

**`used` = active students at the school (BR-24 v1.19).** All 12 live values are reproduced as register + extras − inactive pins:

| School | Used | School | Used | School | Used |
|---|---|---|---|---|---|
| 8277 | 150 | 8880 | 59 | 8102 | 776 |
| 8082 | 549 | 10220 | 2 | 8106 | 562 |
| 8078 | 423 | 8080 | 185 | 8090 | 386 |
| 8087 | 312 | 8107 | 675 | 8228 | 13 |

These equal M17 Q-M17-SCH-PUPILS (8082 549, 8080 185, 8078 423, 8106 562, 8880 59, 8102 776). v1.19 in fact fixes 8106 (560 + 2 − 1 = 561 before) and 8102 (the 2 inactive complimentary pupils).

**School counts:**
- M17 "Jumlah Sekolah" (schools with ≥ 1 student) = **57** now that each of the 19 other filter schools and 5183 holds a student (v1.12 would have given 45).
- M11 / M12 (schools with ≥ 1 user) = **57** = 34 + 23.
- The S1 filter is 61 (DV-M02-13, unchanged).

**M11 §6.7:** unchanged. Only non-T4/T5 students were added (8228 stays 5 T4/T5); 1,666 / 2,492 and 522 / 277 are unchanged.

**M12:** 4664 / 4644 at 8080 are unchanged; Q-M12-SCH-OPTIONS = 57.

**M16:**
- 4301 (8106), 4320 (8880) and 4321 (2710) are unchanged.
- 4302–4325 stay no-school, no-class.
- The 32 T4-pool anchors 4326–4358 are still T4-class members: `t4check.js` shows that the moved rows g44–g46 are not anchors, not H1–H4 and hold no session.

**M18:** the 168 pupils of the 9 schools are unchanged (the 3 re-homed and 16 G students go to the 19 non-M18 filter schools). 8880 = 53 + 6 = 59 with inactive pin 0, which is consistent with DV-M18-43 (14 never logged in). 8088's single answering pupil is a G student, consistent with M17's week (other segment 60 = 40 no-school + 8088's 20).

**New teacher anchors 4501–4504** (8087, 8107, 8880 = M18's "Guru Demo KL-01", 8090) do not clash with 4201–4208, 4301–4401, 4402 / 4418 or 2001–2060.

**Owner scripts:**
- `t4check.js`: OK (T4 149, 11 · "63.9%", "51.3%", "81.7%", "64%", "93.3%", T5 3,911 · 79.7%).
- `guru-check.js`: OK.
- `feas.js`: 18 PASS, C9 N/A, 0 FAIL.

## A.3 Findings

| ID | Sev | Owner | Doc IDs | Problem | Fix |
|---|---|---|---|---|---|
| A-01 | **Major** | **M02** (pins) + **M17** (C-05, XR-M17-06 wording) | M02 §6.15 B L553 ("by role: student **3,152** active / **1,381** inactive, teacher **502** / **49**, other roles 0 / 2") and D L613 (same pins; "logged in: active pupils 1,708, active teachers 269, all teachers 289") ↔ M17 BR-M17-03 L217 (P = active students **outside fixture schools**, Q-M17-PUPILS 3,152; T = active teachers outside fixture schools, 502), R-08 L389, C-05 ("pupils inactive 1,381, teachers inactive 49, others 2 = 1,432") | The facet pins count **all** students and teachers, while M17's observed figures count only those **outside the fixture schools 900001–900099**. The fixture schools hold 10 active pupils (canonical 2 and 3001–3008 at 900001, canonical 4 at 900004) and the active teacher 5 (900001). Computed from the pins (`a02.cjs`):<br>• Q-M17-PUPILS = 3,152 − 10 = **3,142** (observed 3,152 on S2 / S3 / S8 / S11, E2E-M17-27 / 95);<br>• Q-M17-TEACHERS = 502 − 1 = **501** (observed 502; S8, S11 tiles);<br>• the logged-in pins 1,708 / 269 carry the same offset (the fixture pupils and teacher 5 have `lastLoginAt`).<br>M17 C-05 derived 1,381 as 4,533 − 3,152 without subtracting the fixture accounts. | **M02:** pin the facets on M17's populations (feasible, no observed value moves; the only observed isActive figure is the total 1,432):<br>• students inactive **1,371** (so the active students outside the fixtures = 3,152);<br>• teachers inactive **48** (active outside the fixtures = 502);<br>• other roles inactive **13** (Σ 1,371 + 48 + 13 = 1,432; ≤ the 75 other-role users excluding canonical 1, 6–10);<br>• state the logged-in pins on the same populations: 1,708 pupils and 269 teachers outside the fixtures; state whether "all teachers 289" includes teacher 5.<br>Re-run the build check.<br>**M17:** restate C-05 and XR-M17-06 with the fixture accounts excluded; no figure changes. |
| A-02 | Minor | M02 | §6.15 D v1.19 row ("active; no answers except 8088's pupil") and the v1.19 re-budget paragraph | The 10 new active students (8228 8, 8090 1, 8106 1) and the 23 moved students (16 G + 3 re-homed at the 19 filter schools, 1 at 5183, …) have no stated `lastLoginAt`. Logins would move M17 Q-M17-LOGINS, the "Pernah Login" 1,708 and the S11 per-school login columns. | State `lastLoginAt` null for them, or name the M17 per-school login cells they fill. |

## A.4 Open findings by owner

| Owner | Major | Minor |
|---|---|---|
| M02 (+ M17 wording) | A-01 (population-based `isActive` / login pins: students 1,371, teachers 48, other roles 13 inactive) | A-02 (login state of the v1.19 students) |

Addendum re-check: re-run `a02.cjs` with the new pins (P 3,152, T 502, Σ 1,432, used values unchanged) and check the M17 C-05 wording.

---

# Addendum A — recheck (M02 v1.20, M17 v1.6)

| Field | Value |
|---|---|
| Scope | A-01 and A-02 only. M02 v1.20 changelog L40, §6.14 fixture-login table L500–503, §6.15 C L578; M17 v1.6 changelog L20 (C-05, XR-M17-06). |
| Method | `xl3/addA/a02r.cjs` recomputes the populations. The owner scripts (`t4check.js`, `guru-check.js`, `feas.js`) were re-run from `xl3/addA/`. A grep scan checked for stale fixture-teacher login statements. |
| Date | 2026-09-27 |

## Verdict

**PASS — 0 Critical, 0 Major, 0 Minor.** A-01 and A-02 are closed, and the batch-3 PASS of Round 6 is restored.

## Evidence

**P and T (`a02r.cjs`):**
- P = 4,533 − 10 fixture students − 1,371 inactive = **3,152**.
- T = 551 − 1 fixture teacher (5) − 48 inactive = **502**.
- Σ inactive = 1,371 + 48 + 13 = **1,432**, the observed value.
- The fixture accounts (students 2, 3001–3008, 4; teacher 5) sit outside the pins (M02 L40, M17 L20).

**Logged-in counts:**
- Pupils in P: 1,708. Teachers in T: 269. Both pins are stated on P / T (M02 L40, M17 L20).
- "All teachers" = 277 register + 12 outside the register and outside the fixture schools = **289**. The 12 are 1919, 4401 and 5306–5315 (M02 L503, L578); M09 3101 stays null (L500).
- The 20 logged-in inactive teachers this implies fit within the 48 inactive teachers (4207 and 4208 are among them).
- Teacher total 522 + 29 = 551, where 29 = 3101 + 1919 + 4401 + 5 + 5301, 5306–5329 (L578).

**Teacher 5315:** now logged in, dated 2026-08-01 20:00 (designed, before the clock). It replaces fixture teacher 5 in the "all teachers" set, so 289 is unchanged.
- It sits outside the M11 register, so M11's 277 / 522 are untouched.
- It is outside every M17 login window (today / week / month = September), so Q-M17-LOGINS 13 / 31 / 95 are unchanged.
- M01's canonical accounts are unaffected.
- No other doc states 5315's login (grep).

**A-02:** every student added or moved in v1.19 has `lastLoginAt` null (M02 L40): 8228 8, 8090 1, 8106 1, the 20 former `t4PoolSwappedOut` rows and the 3 re-homed pool rows. M17's login counts and 1,708 are therefore unaffected.

**Unchanged figures:**
- M11: register 4,158 / 522 and logins 1,666 / 2,492 / 277 do not depend on `isActive`.
- M10: T4 pool 75, T4 card 149.
- M17: per-school P / `used` values (A.2) unchanged.

**Owner scripts:** `t4check.js` OK; `guru-check.js` OK; `feas.js` 18 PASS, C9 N/A.

No requirement doc was modified by this review.

---

# Addendum B — shared-data changes after the Addendum A PASS

| Field | Value |
|---|---|
| Scope | M02 v1.21–v1.23, M17 v1.7–v1.9, M18 v1.7, M04 v1.14, M16 v1.6, M15 v1.4, M01 v1.12, M19 v1.1 (Draft; dependencies and ids only). design-system v1.7 (icon rows) has no cross-module data and was not reviewed. |
| Method | The owner scripts were copied into `xl3/addB/` and run there: `t4check.js`, `guru-check.js`, `feas.js`, M18 `recon-v16.cjs`, M17 `anchor.cjs` (v1.9) and M19 `recon.cjs` (with its `seed.cjs`). My own `b1.cjs` covers the populations, the 12 `used` values and the Guru-tab arithmetic. `nav.cjs` was extended to M19. Targeted reads of the changelog rows, M02 §6.15 D, M04 BR-M04-38(c) / SQ-8, M17 §6.4 L374, FR-M17-94 / FN-M17-8.4.1, and the M17 discovery snapshot `S11_laporan.default.tabs.guru`. |
| Date | 2026-09-27 |

## B.1 Verdict

**FAIL — 0 Critical, 1 Major, 1 Minor.** Everything else reconciles.

## B.2 What reconciles

**Owner scripts:**

| Script | Result |
|---|---|
| `t4check.js` | OK (T4 149 = 75 + 38 + 21 + 15; the moved rows g44–g46 are neither holders nor M16 anchors; "63.9%" / "51.3%" / "81.7%" / "64%" / "93.3%"; T5 3,911 · 79.7%) |
| `guru-check.js` | OK |
| `feas.js` | 18 PASS, C9 N/A |
| M18 `recon-v16.cjs` | 7 / 7 PASS (two-field model; 115 dated / 54 null `lastActiveAt`; KLUANG 86 / 49; 7780 97.647, school 1 97.5, district 97.576; 8880 S28 T4 15 × 80) |
| M17 `anchor.cjs` | 45 PASS (clock figures 477,743 / 2,508 / 20,206 / 340 / 17 unchanged; S11 "Murid" 51 of 57 rows exact; DC-M17-09 and DV-M17-31 cover the 70 short pupils; no uniform definition fits the five engaged schools, so DV-M17-30 (8080 174) is justified) |
| M19 `recon.cjs` | 25 checks, 0 failures |

**Platform and per-school figures (`b1.cjs`):**
- P = 4,533 − 10 − 1,371 = **3,152**; T = 551 − 1 − 48 = **502**; Σ inactive **1,432**.
- The 1,708 logged-in pupils hold: the v1.21 withdrawn extras, the v1.22 moves and the 23 MODELLED moves all carry `lastLoginAt` null.
- DV-M02-15 (per-school counts include inactive pupils) reproduces all **12 `used` values** as register + extras (8277 150, 8880 59, 8102 776, 8082 549, 10220 2, 8106 562, 8078 423, 8080 185, 8090 386, 8087 312, 8107 675, 8228 13). These equal M17 Q-M17-SCH-PUPILS.
- M11: 4,158 / 522 and 1,666 / 2,492 / 277 are unchanged, since only non-T4/T5 students moved.
- M10: T4 pool 75 unchanged.
- 57 schools under both definitions; S1 filter 61 (DV-M02-13).

**The 23 MODELLED moves (9167, 9806, 2418) change no visible figure elsewhere:**

| Module | Why nothing moves |
|---|---|
| M08 | S1 role counts unchanged; the moved players are in no class |
| M10 | The `attendanceMirror` holds none of them |
| M11 / M12 | 9167 and 9806 are monitoring schools, but the movers are re-graded below T4, so the T4/T5 registers and alerts are unchanged |
| M14 | Wallets are keyed by user |
| M15 | Shows name and e-mail only |
| M16 | S4 colours stay `text-blue-600` because 9167, 9806 and 2418 are not listed schools (M16 v1.6); 4316 / 4317 stay no school; S2 / S3 / S20 unchanged |
| M17 | S11 row totals are the purpose of the move; S4 drill counts are computed consistently |
| M18 | None of these schools is M18-visible (recon V1–V7) |
| M01 | Canonical 11 at 9167 stays inactive, and login is refused before any school is shown |

**D9 and display-constant checks:**
- **DV-M17-30 (8080 shows 174):** 174 equals the M11-consistent value, so it creates no new visible contradiction.
- **DV-M17-31 (2418 shows 4):** consistent with 2418's S4 drill.
- **DC-M17-09 (five S11 "Murid" totals):** M17 checked S4, S8 / S9, the CSV exports and the "Belum Login" list; no computed figure for those schools sits beside them on S11.
- **M18 two-field model:** withdraws DV-M18-43 / 45 with 0 visible changes. M11 / M17 read `lastLoginAt`; M18 BR-M18-13 / 15 / 34 read the stored `lastActiveAt` (M02 XR-M18-21 applied).

**Ids:**
- M19 payers 3301–3324, 3614, 4373, 5450, 5451, 5475, 5600 do not collide:
  - 4373 lies in M16's former S20 range, but 4359–4377 are not created (M16 v1.3);
  - 5450 / 5451 / 5475 / 5600 lie in M02's reserved block 5001–5999 but outside every used sub-block (5401–5411, 5501–5502, 5601–5605), and M02 places them itself;
  - 5551 / 5571 stay unused.
- 8102's "Belum login" cell holds the 300 fixtures + 30 payers = 330 ≤ 755.
- The M02 teacher anchors 4501–4504 are unchanged.

**Links:** `nav.cjs` (now including M19): **0 unresolved**.

**M19 v1.1 (Draft):** it depends on M02 v1.22 `schoolSubscriptions.countByStatus()` / `activeByPackage()`, `users.setSubscription` (also listed in M01 v1.12 §6.1) and BR-12 / `billing.computeExpiry`. All are present.

## B.3 Findings

| ID | Sev | Owner | Doc IDs | Problem | Fix |
|---|---|---|---|---|---|
| B-01 | **Major** | **M17** (definition) with **M04 / M02 / M14** (attribution) | M17 §6.4 L374 Q-M17-TEACHER-Q "M04 (Q-CONTRIB + structured by `createdBy`) … Σ over T 11,414", FR-M17-94 L165, XR-M17-20, R-43 ("M04's generated `createdBy` and M14's teacher balances are unobserved compositions") ↔ M04 v1.14 BR-M04-38(c) L250, SQ-8 L1032 (7,565 of the 11,414 rows on `createdBy` 5801, an **admin**, `contribSchoolId` 0; "consumers … never by joining `createdBy` to the teacher role"; "no teacher id published on live"); M14 v1.3 (42,617 on three zero-question wallets); discovery `S11_laporan.default.tabs.guru` (FN-M17-8.4.1 table: MCQ, Struktur, Syiling per teacher, 400 of 551 rows captured) | (1) **Definition clash.** Under M17's written definition (Σ over T by `createdBy`), the Guru tile computes **3,849** (4501–4504 only), not the observed **11,414**, because 5801 is not in T. M04 forbids that join, but M17 was not updated.<br>(2) **The same tab contradicts itself.** Its rows (MCQ / Struktur per active teacher) would sum to 3,849 beside the 11,414 tile.<br>(3) **The observed rows are not reproduced.** The captured Guru rows show the contributors:<br>• `<teacher:101>`: no school, never logged in, **5,547 MCQ, 0 structured, 42,600 syiling**;<br>• `<teacher:137>` at SMK JALAN REKO: 497 MCQ, 1,062 structured, logged in 04/06/2026.<br>So 7,106 of the 7,565 "unattributed" rows are attributed on live. R-43 and SQ-8's premise are therefore wrong. The M14 split of the 42,617 across three wallets does not place the observed 42,600 on that teacher. | **M17:**<br>• the tile = M04 `count('Q-TEACHER-CONTRIB')` (platform 11,414);<br>• per-teacher MCQ / Struktur = `questions.teacherContributions` per teacher;<br>• restate R-43 and XR-M17-20.<br>**M04 + M02 (SQ-8):**<br>• attribute teacher:101's 5,547 MCQ to one active, never-logged, no-school outside-register teacher (e.g. one of 5301 / 5316–5329, `lastLoginAt` null), which keeps 29 / 289 / 269;<br>• teacher:137 sits at a live teacher-only school that DV-M17-28's fallback leaves without users: keep its 1,559 rows plus the remaining 459 (Σ 2,018) on the placeholder, and record that in DV-M17-28 / SQ-8.<br>**M14:** put **42,600** of the 42,617 on that same teacher's wallet (`questionsCount` 0, so S22 is unchanged); the remaining 17 go to the other two new wallets.<br>Neither the tile nor the observed rows then change. |
| B-02 | Minor | M02 (with M08, M10, M17) | M02 DATA-M02-01 new stored `User.lastActiveAt` (XR-M18-21; read by M18 BR-M18-13 / 15 / 34) ↔ derived response fields of the same name: M17 `CcClass.students[].lastActiveAt` (L570, = latest `answeredAt`, FR-M17-52), M08 class ranking `lastActiveAt` (L483, "Terakhir Aktif"), M10 kehadiran rows `lastActiveAt` (L603) | The same name now carries two meanings. A builder reading the stored field for the M08 / M10 / M17 columns would change observed values (e.g. M17 class 370's last-activity times). | M02 notes on DATA-M02-01 that `lastActiveAt` is read only by M18, and that the M08 / M10 / M17 response fields are derived from the answer log. Alternatively rename the stored field (e.g. `riskActivityAt`). |

## B.4 Open findings by owner

| Owner | Major | Minor |
|---|---|---|
| M17 + M04 / M02 / M14 | B-01 (tile definition = M04 count; attribute teacher:101's 5,547 MCQ and 42,600 syiling; rest stays placeholder under DV-M17-28) | — |
| M02 (+ M08 / M10 / M17) | — | B-02 (`lastActiveAt` name scope) |

The recheck needs only: `b1.cjs` with the attribution, the M17 L374 / FR-94 / R-43 wording, M04 SQ-8 and M14 §6.11.5.
