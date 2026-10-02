# M14 — Gamification (Coins, Tokens, Challenges) — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M14 Gamification |
| Version | 1.8 |
| Date | 2026-09-27 |
| Status | **Approved (G1)** — 2026-09-26 (v1.6–v1.7: XL3 Addendum B; v1.8: as-built update after the F-26b / F-26 builds and their G4 reviews; no observed value changed), after audit round 2 PASS (`docs/qa/audit/M14-audit.md`), together with the URS. Every POST result and every earning trigger stays INFERRED or PROPOSED and provisional (URS OQ-M14-01). |
| Author | product-analyst (agent) for §1–§5, §8–§10, §12–§13; solution-architect (agent) for §6 data entities, datasets, seeds and cross-module contracts, §7 mock API and repository contract, §11 |
| Source URS | [urs/M14-gamification.md](../urs/M14-gamification.md) v1.0 (FN-M14-n.n.n, 41 stories, AC-M14-nn.m) |
| Source discovery | [M14-gamification.md](../../discovery/M14-gamification.md), inventory `docs/discovery/inventory/M14/` (incl. `_snapshot-2026-09-26.json`), screenshots `docs/discovery/img/M14/` |
| Related | [M01](M01-authentication.md) (User, guard, login, register FR-18, BR-24, 404 page, canonical accounts 1–11), [M02](M02-users-schools.md) (users dataset §6.15 and id policy, `coinsEnabled`), [M03](M03-curriculum.md) (chapters), [M04](M04-question-bank.md) (question store), [M05](M05-practice.md) (sessions, BR-08/09/10/20/25/31, wallet seeds of §6.12), [M06](M06-spm.md) (SPM modes), [M07](M07-pksk.md), [M08](M08-student-performance.md) (DATA-M08-10, FR-M08-41/105/115/126, BR-M08-25/28), [M10](M10-teacher-class.md) (BR-M10-06/16, DATA-M10-11, contributions), [M15](M15-rewards-shop.md) (XR-M15-01…08), [design/shells.md](../../design/shells.md) (DV-SH-03), [architecture/overview.md](../../architecture/overview.md) (§6.6 datasets, §6.7 repositories — the provisional M05 wallet moves here, §6.13 hooks, §10 shell contracts) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.8 (note) | 2026-09-27 | **F-26 G4 review correction (Delivery Lead: replicate live).** BR-M14-03 "session coins vs wallet credit" and XR-M14-01 (f) restored: M05 stores the session `coinsEarned` by its BR-09 (OBSERVED on every live session; M06 BR-M06-19 agrees); M14's credited `coinsEarned` goes only into the M05 #6 submit response and is never stored on the session (M05 v1.17 BR-09, BR-31 step 6). The XR-M14-11 check item on pupil 4627 stays (Perlu pengesahan). |
| 1.8 | 2026-09-27 | **As-built update after the F-26b (M14) and F-26 (M05) builds and their G4 reviews; doc-only; status stays Approved (G1); no observed value changed.** BR-M14-03: modes `remedial` and `question_set` take the practice wording ("Latih Tubi: …", `quiz_practice`; INFERRED); `correctByLevel` is an optional input that M05 does not send (every correct counts at level 1 when the tier rates apply). BR-M14-24: "Latihan" also for `remedial` / `question_set` (INFERRED), "PKSK" for `pksk` (INFERRED). BR-M14-26 / §8.2: credit-back row "Tebus Tunai #{id} dibatalkan" (PROPOSED COPY). DATA-M14-08: `totalDays` 0 for accounts 2 and 4 (seeded). New DATA-M14-23 SessionCredit (`gamification.sessionCredits`, idempotency per `sessionId`; P1–P4 and M1–M4 pre-credited). §6.11.1: ledger earn cells `legacy` 3 and `achievement` 3 carved from earn 52,426 (sample weights over 52,420; every total exact); wallet exclusion list = the build's full user-anchor set; **ledger anchor owners** (INFERRED) incl. generated student 12 for #53662 / #53663, the rule that generated rows never go to observed-row owners, alternatives and the accepted residual mismatches (4017, 4014, 4036, February owners 4075–4081; SQ-M14-04). §6.11.4: 4021–4029 balances **designed** (= "Baki" of the owned observed row; 1,058 / 17 / 5,813 / 5 / 897 / 103 / 752 / 154 / 5,424, each ≤ lifetime) — they were "gen.", no observed value. §6.1 / §7.1: M05 read contract cross-reference (`practice.history`, `practice.answers`, `practice.mastery`); `streak.get` returns `totalDays`, `practisedToday`, `multiplier`; `onSessionCompleted` idempotent. New XR-M14-11 (M01 `users.isAnchor(id)`), XR-M14-12 (M02 `complimentary.coinsEnabled(userId)`). |
| 1.7 | 2026-09-27 | **XL3 Addendum B, B-01 follow-up; status stays Approved (G1).** The S22 rank-2 wallet **4202** (1,559 questions / 0 syiling) is the observed M17 Guru-tab row `<teacher:137>` (SMK JALAN REKO, 497 MCQ + 1,062 Struktur = 1,559, Syiling 0, login 04/06/2026 05:47). M02 v1.25 moves 4202 from 8082 to **8087** by swap with a generated 8087 teacher (the 8082 placement of v1.3 was designed; S22's masked school column shows rank 2 at a different school from rank 1). Wallet values unchanged (balance 0, `questionsCount` 1,559); S22 both tabs unchanged (the admin's "Sekolah Saya" lists every teacher; the "Seluruh Malaysia" school column is masked on live); Σ over T 63,459 unchanged. §6.11.5 and XR-M14-05 restated. |
| 1.6 | 2026-09-27 | **XL3 Addendum B, B-01 (`docs/qa/audit/cross-module-logic-M12-M18.md`); status stays Approved (G1).** The M17 snapshot row `<teacher:101>` (no school, never logged in, "Syiling" **42,600**) is M02 v1.24 fixture teacher **5316**. Of the three designed zero-question teacher wallets of §6.11.5 (Σ 42,617), one is now **5316: balance 42,600, totalEarned 42,600, `questionsCount` 0**; the other two stay on the two highest-id generated active teachers with `questionsCount` 0 outside the fixture schools, balances **9 / 8** (was 14,206 / 14,206 / 14,205). Σ balance over active non-fixture teachers = 20,720 + 0 + 0 + 10 + 110 + 2 + 42,600 + 9 + 8 = **63,459** (unchanged, M17 Q-M17-TEACHER-COINS). S22: 5316 has `questionsCount` 0 and, among zero-question teachers, ranks after every one with a lower user id — far more than the 46 zero-question rows S22 shows (BR-M14-28), so both tabs stay exactly as observed (3,906 / 20,720; 1,559 / 0; 256 / 0; 1 / 10; …). Teacher wallets stay 12; no ledger rows (unobserved); every other M14 named query, anchor, dataset total and E2E value unchanged. |
| 1.5 | 2026-09-27 | **XL3 round 3, R3-02; status stays Approved (G1).** pelajarmaju (account 4) is at fixture school 900004 "SK Demo Bestari" (M02 v1.16), outside the M11 and M17 populations (§6.11.7); the remaining 900002 references are the admin's seed school and stay. Traceability 0 errors. |
| 1.4 | 2026-09-27 | **XL3 round 2, R2-09 (M07 XR-M07-03); status stays Approved (G1).** BR-M14-03 states the rate for session mode `pksk` (M05 v1.12 mode) with the same precedence as every other mode: a passed `coinsPerCorrect` first, then `flat_quiz_reward` when > 0 (seed 1), then the tier `pksk_reward_correct` (S2 "🛡️ PKSK — Syiling per Jawab Betul", seed 5) — INFERRED: no PKSK ledger row was observed on live, and the flat setting ("tiada beza difficulty") is observed to override the other tier per-answer fields. Ledger source `quiz_pksk` recorded. Traceability 0 errors. |
| 1.3 | 2026-09-27 | **XL batch 3 round 1 fixes** (`docs/qa/audit/cross-module-logic-M12-M18.md`; status stays Approved (G1)). XL3-14: teachers 4207 and 4208 are **inactive** (M02 v1.12 places them as school 8277's two inactive teachers); three new materialised zero-question wallets on generated active teachers carry 42,617, so Σ balance over active non-fixture teachers = 20,842 + 42,617 = **63,459** (M17 Q-M17-TEACHER-COINS) and both S22 tabs stay exactly as observed (script-checked); "Sekolah Saya" lists every teacher for a viewer who is not a teacher (the admin at 900002 needs none of the 8082 teachers). XL3-15: DATA-M14-08 gains the stored counter `totalDays` (2710: 13 and 4; all others 0) and §6.11.7 seeds the M18 / M17 streak anchors (KLUANG 81, BATANG PADANG 29, the 8880 / 7780 / school 1 top-10 rows, pupil 2022 streak 1); XR-M14-10 to M18 on two means that its own top-10 rows cannot reproduce. Minors: "minggu" step in BR-M14-35 (XL3-28); `onGameResult` accepts `correct`, `total`, `detail` (XL3-29); `canEarnSyiling(userId)` (XL3-26); post-login values 372 / 269 stated (XL3-30). M02 v1.12 placements recorded (4001–4108 at 8082 / 8078 / 8106; 4201–4206 at 8082). Names checked with M05 (`mock.addSession`, `onSessionCompleted`), M08 (`wallet.summary.currentSyiling`), M16 (`onGameResult → {coinsCredited, xpAdded}`, `canEarnSyiling`). Coverage 1,759/1,759; traceability 0 errors. |
| 1.2 | 2026-09-26 | **Approved (G1).** Audit round 2 PASS. R2-01: the 10 unseeded post-clock rows are 4 `quiz_spm` (#53678, #53677, #53676, #53673) and 6 `daily_login`. R2-02: the materialised-store row now lists the designed challenge completions and pelajarmaju's 3 achievements (§6.11.3). User decision on the shop source ("ikut macam mana ada sekarang"): the student shop S5 (M15) replicates live and stays empty for every account; no shop catalogue source is modelled (aligned with M15 v1.3); OQ-M14-05 closed. "Siap Hari Ini" definition stays INFERRED (OQ-M14-12; non-blocking, both definitions read 0 at the clock). Traceability re-run 0 errors. |
| 1.1 | 2026-09-26 | **Revision history — v1.1, audit round 1** (FAIL 0/3/9). AUD-01: the designed replay applies BR-16 (pelajarmaju 267 / 432 XP, 19 ledger rows 140201–140219, 3 achievements); runtime-unlock scenarios moved to pelajar2 (E2E-35/36); XR-M14-01(c) corrected. AUD-02: DV-M14-14 S4 sort (FR-90, #28, E2E-67, AC-26.6). AUD-03: single project clock 2026-09-25T15:40 for every scenario; the 10 observed ledger rows stored after it are not seeded and their slots are generated rows dated before it (§6.11.1 clock treatment, alternatives recorded); "Siap Hari Ini" = Q-DAILY-FINISHERS (users who completed every active challenge today; 0); E2E-16/18/20/26/55/56/69 restated; SQ-02 closed. Minors: DV-06 colour only + live `min-width: 40px` (BR-34, FR-78); BR-03 rate precedence (passed mission rate 3 overrides the flat reward) and the session/wallet coin difference; runtime ids continue the live tables (cash request 3, draw 1); `onGameResult(…) → {coinsCredited, xpAdded}` in BR-21, §7.1, §6.14; openings count from M15 `mysteryBox.openingsCount` (BR-16); ledger gaps 767 and `legacy` source; feasibility 178,000–1,506,287; xp ≥ xpNeeded display (BR-05); S6 "Koin" = `currentSyiling` (FR-13, XR-03); new M05 hook `mock.addSession`; contribution deletions do not decrement (BR-23). Traceability re-run 0 errors. |
| 1.0 | 2026-09-26 | First issue. M14 takes over the provisional wallet/streak store of architecture §6.7 (same repository names, extended) and answers M15 XR-M15-01…08. 2 D11 virtual datasets (wallets 2,255; ledger 52,964) with snapshot anchors; 22 owned entities; 43 mock endpoints + repository contract; 135 FRs; 36 BRs; E2E and SEC items per §12/§11.1; traceability checked by script (§3.1). |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M14-01 (header titles), 02 (share link to the viewer's own profile), 03 (Kedudukan share value), 04 (challenge types by meaning), 05 (settings label example), 06 (dark count text on light tier bars), 14 (S4 sort applied), 07 (S14 overflow at 375), 08 (one streak store), 09 (coin figures derived from the wallet; applied by M08), 11 (text ≥ 12 px). Rejected — replicate live: DV-M14-10 (negative token data), 12 (534 vs 535), 13 ("Susah" vs "Sukar").

---

## 1. Scope

The M14 prototype implements, against the mock service layer, the 22 screens of URS §1 and the `/kombo` redirect, and it owns (D12): the student wallet and its coin ledger, the token balance, XP, level, tier and title; the streak; daily challenges and their daily completions; achievements; referral codes and referrals; the teacher wallet, its ledger, teacher badges, the teacher reward catalogue and redemptions, and teacher cash requests; the gamification settings; the 11-item syiling-priced reward catalogue with its real cost; cabutan draws and tickets. Other modules change wallets only through the repository contract of §7.1. M14 reads users and schools (M01/M02), sessions and mastery (M05), and the M15 redemption store only where named.

**Out of scope:** URS §8 — M15 shop, redemptions and mystery-box configuration; M08 performance screens (they read M14); M05 dashboard (it reads M14); M16 games; winner drawing; real payouts; the backend.

---

## 2. Screens & routes

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/admin/gamification` | Overview | Admin | SHA · "Gamifikasi Overview" / "Gamifikasi Overview" | #18 |
| S2 | `/admin/gamification/tiers` | Tier configuration | Admin | SHA · "Tier Configuration" / "Tier Config" | #19–#22 |
| S3 | `/admin/gamification/challenges` | Challenge admin | Admin | SHA · "Cabaran Harian" / "Cabaran Harian — Admin" | #23–#27 |
| S4 | `/admin/gamification/students` | Students + award | Admin | SHA · "Pelajar Gamifikasi" / "Pelajar Gamifikasi" | #28, #29 |
| S5 | `/admin/gamification/transactions` | Coin ledger | Admin | SHA · "Transaksi Syiling" / "Transaksi Syiling" | #30 |
| S6 | `/admin/gamifikasi/guru` | Teacher gamification | Admin | SHA · "Gamifikasi Guru" / "Gamifikasi Guru — Admin" | #31–#33 |
| S7 | `/admin/gamifikasi/guru/tebusan` | Teacher redemptions | Admin | SHA · "Tebusan Guru" / "Tebusan Guru — Admin" | #34, #35 |
| S8 | `/admin/gamifikasi/guru/tunai` | Teacher cash requests | Admin | SHA · "Tebus Tunai Guru" / "Tebus Tunai Guru — Admin" | #36, #37 |
| S9 | `/admin/gamifikasi/pengaturan` | Settings | Admin | SHA · "Tetapan Gamifikasi" / "Tetapan Gamifikasi — Admin" | #38, #39 |
| S10 | `/admin/reward-control` | Reward control + cabutan | Admin | SHA · "Kawalan Ekonomi Reward" / "Kawalan Reward — Admin" | #40–#43 |
| S11 | `/gamification` | Student dashboard | Pelajar, Admin | SHU · "Gamifikasi Dashboard" / "Gamifikasi Dashboard" | #3 |
| S12 | `/gamification/convert` | Convert | Pelajar, Admin | SHU · "Tukar Syiling → Token" / "Tukar Token" | #5, #6 |
| S13 | `/gamification/challenges` | Daily challenges | Pelajar, Admin | SHU · "Cabaran Harian" / "Cabaran Harian" | #7 |
| S14 | `/gamification/leaderboard` | Leaderboard | Pelajar, Admin | SHU · "Papan Pendahulu" / "Papan Pendahulu" | #8 |
| S15 | `/gamification/achievements` | Achievements | Pelajar, Admin | SHU · "Pencapaian Anda" / "Pencapaian — PRESTASIPLUS" | #9 |
| S16 | `/gamification/referral` | Referral | Pelajar, Admin | SHU · "Rujuk Kawan, Dapat Syiling!" / "Rujuk Kawan — PRESTASIPLUS" | #11 |
| S17 | `/gamification/history` | History | Pelajar, Admin | SHU · "Sejarah Transaksi" / "Sejarah Transaksi" | #4 |
| S18 | `/gamification/kad-kongsi` | Share cards | Pelajar, Admin | SHU · "Kad Kongsi" / "Kad Kongsi — PRESTASIPLUS" | #10 |
| S19 | `/guru/gamifikasi` | Teacher dashboard | Guru, Admin | SHU · "Syiling & Ganjaran" / "Gamifikasi Guru" | #12 |
| S20 | `/guru/gamifikasi/tebus-tunai` | Cash-out | Guru, Admin | SHU · "Tebus Tunai" / "Tebus Tunai" | #13, #14 |
| S21 | `/guru/gamifikasi/kedai` | Teacher shop | Guru, Admin | SHU · "Kedai Hadiah" / "Kedai Hadiah Guru" | #15, #16 |
| S22 | `/guru/gamifikasi/leaderboard` | Teacher leaderboard | Guru, Admin | SHU · "Papan Pendahulu" / "Papan Pendahulu Guru" | #17 |
| — | `/kombo` | redirect → `/dashboard` | All | — | — |

Subtitles: S1–S5 "Selamat datang, Admin", S11–S17 "Selamat datang kembali" (DV-M14-01); the others as URS FN-M14-1.1.5. Query names keep the live names (`search`, `tier`, `sort`, `page`, `type`, `date_from`, `date_to`, `status`, `rarity`, `period`, `tab`). `{id}` values are integers.

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M14-01 | The user-portal sidebar and drawer SHALL hold the M14 entries of URS FN-M14-1.1.1–1.1.3 (labels, icons, targets, drawer group "Gamifikasi"; "Kombo" → `/kombo`; teacher "Syiling & Ganjaran"; "Gamifikasi Guru"); neighbouring M15 entries are rendered by the shell from M15's data. | 1.1.1, 1.1.2, 1.1.3 | 01.1 |
| FR-M14-02 | The admin panel SHALL hold the "Gamifikasi" group of URS FN-M14-1.1.4 (sidebar and the "Lagi" list, as captured) and "Streak / Kombo" → `/kombo`. | 1.1.4, 1.1.2 | 01.2 |
| FR-M14-03 | The shell header SHALL show the titles and subtitles of URS FN-M14-1.1.5 (DV-M14-01, DV-SH-03); pages with a correct live title keep it. | 1.1.5 | 01.3, 01.4, 01.5 |
| FR-M14-04 | Each screen SHALL set the tab title of URS FN-M14-1.1.6; S1–S10 SHALL render in the admin panel shell and S11–S22 in the user-portal shell for every role. | 1.1.6, 1.1.7 | 01.6 |
| FR-M14-05 | Every M14 route SHALL require a session (M01 guard; guest → `/login`). | 1.2.1 | 02.1 |
| FR-M14-06 | Route guard (BR-M14-01): S1–S10 admin only; S19–S22 `teacher` and `admin`; S11–S18 every logged-in role; others are redirected to their M01 landing page and the endpoints answer 403 `FORBIDDEN` (provisional). | 1.2.2 | 02.2 |
| FR-M14-07 | `/kombo` SHALL redirect to `/dashboard` for every role without rendering an M14 page. | 1.2.3 | 02.3 |
| FR-M14-08 | S14 SHALL ignore `?period=`; S22 SHALL treat an unknown `?tab=` as `sekolah`; S15 with an unknown `?rarity=` SHALL render the pills, no card and no message; S17 with an unknown `?type=` SHALL render the empty state; S4 with a non-matching `?search=` SHALL render its empty text. | 1.2.4 | 02.4 |
| FR-M14-09 | Unknown paths under the M14 prefixes SHALL render the global 404 page (M01) (provisional). | 1.2.5 | 02.5 |
| FR-M14-10 | The shell chips SHALL read `GET /api/me/gamification-summary` (#1): "{coins} koin", "{points} mata", "{streakDays} hari 🔥" (mobile strip: the three values and "🔥"). | 1.3.1 | 03.1 |
| FR-M14-11 | Every wallet read in every module SHALL come from the M14 wallet repository (§7.1); a user without a wallet row SHALL read the defaults of BR-M14-02; the first credit SHALL create the row; every wallet write SHALL go through the repository (BR-M14-30). | 1.3.2, 1.3.5 | 03.2, 03.4, 03.5 |
| FR-M14-12 | Every streak value in every module SHALL come from the one M14 streak store (`streak.get`, DV-M14-08). | 1.3.3 | 03.2, 03.6 |
| FR-M14-13 | M14 SHALL expose `wallet.summary.currentSyiling` for M08's S18 syiling (with its tier progress) and S6 "Koin" — the same value and word as the header chip on that page (DV-M14-09, XR-M14-03); M08's S20 "Koin" keeps its own named query. | 1.3.4 | 03.3 |
| FR-M14-14 | S11 SHALL render the hero identity and figures of URS FN-M14-2.1.1–2.1.2 from #3 (`wallet`, tier, title). | 2.1.1, 2.1.2 | 04.1 |
| FR-M14-15 | S11 SHALL render the next-tier block (BR-M14-06): label, bar, "{pct}%" with 1 decimal, "Perlu {n} syiling lagi"; no block at the highest active tier. | 2.1.3 | 04.2 |
| FR-M14-16 | S11 hero buttons SHALL link to S12, S13 and `/gamification/rewards`. | 2.1.4 | 04.3 |
| FR-M14-17 | S11 SHALL render the four stat cards of URS FN-M14-2.1.5 with `earnedToday` and `earnedThisWeek` (BR-M14-07) and the XP bar (BR-M14-05). | 2.1.5 | 04.4, 04.5 |
| FR-M14-18 | S11 SHALL render "Cabaran Hari Ini" with the first 4 active challenges of #7 and "Lihat semua →". | 2.1.6 | 05.1 |
| FR-M14-19 | S11 SHALL render "Transaksi Terkini" with the latest 6 ledger rows of the user (relative time, BR-M14-35) and "Semua →". | 2.1.7 | 05.2 |
| FR-M14-20 | S11 SHALL render "Tahap Penguasaan Subjek" from M05 `practice.mastery(userId)` (read only) with the formats of URS FN-M14-2.1.8. | 2.1.8 | 05.3 |
| FR-M14-21 | S11 SHALL render "Sistem Tier" (active tiers by `sortOrder`) with "✨ ANDA DI SINI" on the viewer's tier. | 2.1.9 | 05.4 |
| FR-M14-22 | S11 SHALL render "Gelaran Seterusnya" (BR-M14-09) and the "Kad Kongsi" link card. | 2.1.10, 2.1.11 | 05.5 |
| FR-M14-23 | S17 SHALL render the header with "Baki semasa: **{currentSyiling}** syiling" and "← Dashboard". | 2.2.1 | 06.1 |
| FR-M14-24 | S17 SHALL render the five type pills as links (`?type=`), the active one highlighted. | 2.2.2 | 06.2 |
| FR-M14-25 | S17 SHALL list every row of the viewer's ledger for the type, newest first (BR-M14-33), without a pager, with the icon, description, "dd/mm/yyyy HH:mm · {relative}", signed amount and "Baki: {balanceAfter}". | 2.2.3 | 06.1, 06.3 |
| FR-M14-26 | S17 SHALL show the empty state of URS FN-M14-2.2.4 when no row matches. | 2.2.4 | 06.2 |
| FR-M14-27 | S12 SHALL render the header and balance tiles from #5. | 3.1.1 | 07.1 |
| FR-M14-28 | S12 SHALL render the amount input with `min` = rate, `max` = `currentSyiling`, `required`, placeholder "0" and initial value = rate. | 3.1.2 | 07.1, 08.1 |
| FR-M14-29 | S12 quick buttons SHALL set rate, 5 × rate and `currentSyiling` and mark the clicked one active. | 3.1.3 | 07.2 |
| FR-M14-30 | S12 SHALL recompute the preview floor(amount ÷ rate) (ms-MY) on every input and show the rate line with the tier label. | 3.1.4 | 07.1, 07.2 |
| FR-M14-31 | "Tukar Sekarang" SHALL be disabled while amount < rate or amount > `currentSyiling` (BR-M14-10). | 3.1.5 | 08.1 |
| FR-M14-32 | S12 SHALL render the tier-rate grid with "ANDA" and the tip of URS FN-M14-3.1.7. | 3.1.6, 3.1.7 | 07.3 |
| FR-M14-33 | "Tukar Sekarang" SHALL call #6; the mock SHALL apply BR-M14-10/11 atomically, return the new balances and S12 SHALL re-render with the PROPOSED success message of §8.2; a refused amount SHALL show the §8.2 error and change nothing (provisional). | 3.1.8 | 08.2, 08.3, 06.3 |
| FR-M14-34 | S13 SHALL render the header and the counter "{completed}/{active}" "Selesai" from #7. | 4.1.1 | 09.1, 09.2 |
| FR-M14-35 | S13 SHALL render one card per active challenge in order `sortOrder`, `id` with the content of URS FN-M14-4.1.2; a completed card keeps the layout with the full bar and the completed styling of §8.2 (PROPOSED). | 4.1.2 | 09.1, 09.2 |
| FR-M14-36 | Progress SHALL be computed for today by BR-M14-12 from the M05 session store, capped at the target. | 4.2.1 | 09.2, 10.1, 10.2 |
| FR-M14-37 | On session completion M14 SHALL award every newly completed challenge once per day (BR-M14-13): ledger row, syiling and XP. | 4.2.2 | 10.1, 10.2 |
| FR-M14-38 | Progress and completions SHALL restart at 00:00 Asia/Kuala_Lumpur (mock clock). | 4.2.3 | 10.3 |
| FR-M14-39 | Inactive challenges SHALL be excluded from S13, S11, the M05 widget and Q-CHALLENGES-ACTIVE. | 4.2.4 | 10.4 |
| FR-M14-40 | S14 SHALL render the header and the podium (order silver, gold, bronze) from #8. | 5.1.1, 5.1.2 | 11.1 |
| FR-M14-41 | S14 SHALL render rows #4–#50 with "{title} · Level {level}", lifetime syiling and the tier emoji. | 5.1.3 | 11.2 |
| FR-M14-42 | #8 SHALL rank Q-LEADERBOARD (BR-M14-17) and ignore any period parameter; no own-rank card. | 5.1.4 | 11.2, 11.3 |
| FR-M14-43 | Every person name SHALL come from the M02 users dataset (fictitious) and avatars SHALL be initials; S8 SHALL mask the bank account number and holder (SEC-M14-04). | 5.1.5, 13.1.5 | 11.1, 41.4 |
| FR-M14-44 | S15 SHALL render the header with "{unlocked}/25 dicapai" from #9. | 6.1.1 | 12.1 |
| FR-M14-45 | S15 SHALL render the streak card from the single store with "{multiplier}x Bonus" (BR-M14-15) and "Terbaik: {best} hari". | 6.1.2 | 12.1 |
| FR-M14-46 | S15 SHALL render the rarity pills as links and filter by `rarity`; an unknown value SHALL render no card and no message. | 6.1.3 | 12.3 |
| FR-M14-47 | S15 SHALL render the 25 cards in catalogue order with the content of URS FN-M14-6.1.4 (progress only for the 5 kuiz badges, BR-M14-16). | 6.1.4 | 12.2 |
| FR-M14-48 | An unlocked card SHALL open the share modal of URS FN-M14-6.1.5 on click; "Tutup" and a backdrop click SHALL close it. | 6.1.5, 6.1.8 | 13.1, 13.2 |
| FR-M14-49 | "Muat Turun" SHALL render the card to PNG (scale 2) named `pencapaian-{slug}.png` (simulated capture in tests). | 6.1.6 | 13.2 |
| FR-M14-50 | "WhatsApp" SHALL open `wa.me` with the text of URS FN-M14-6.1.7 and the viewer's profile URL (DV-M14-02). | 6.1.7 | 13.2 |
| FR-M14-51 | Achievements SHALL be evaluated and unlocked by BR-M14-16 on practice-mode session completion, paying their reward with the PROPOSED ledger row (provisional). | 6.1.9 | 14.1, 14.2, 14.3 |
| FR-M14-52 | S18 SHALL render the four tabs (default "Profil") and the profile card from #10. | 6.2.1, 6.2.2 | 15.1 |
| FR-M14-53 | S18 SHALL render the Kombo (single streak store), Penguasaan (one card per M05 mastery subject) and Kedudukan cards. | 6.2.3, 6.2.4, 6.2.5 | 15.2 |
| FR-M14-54 | Each "Muat Turun" SHALL save `prestasiplus-{card}.png` behind a `downloading` guard. | 6.2.6 | 15.4 |
| FR-M14-55 | Each "WhatsApp"/"Kongsi" SHALL open `wa.me` with the texts of URS FN-M14-6.2.7 + "\n\n" + the viewer's profile URL (DV-M14-02, DV-M14-03). | 6.2.7 | 15.3 |
| FR-M14-56 | S16 SHALL render the header and the reward tiles (50 / 25 from BR-M14-19). | 7.1.1 | 16.1 |
| FR-M14-57 | S16 SHALL show the viewer's code (BR-M14-18) and "Salin Kod" SHALL copy it and change its label to "✓ Disalin!". | 7.1.2 | 16.2 |
| FR-M14-58 | S16 SHALL render the WhatsApp and Telegram links (URL-encoded as live, new tab) and "Salin Link" SHALL copy the register URL and change its label to "✓ Link Disalin!". | 7.1.3, 7.1.4 | 16.2, 16.3 |
| FR-M14-59 | S16 SHALL render the three referral statistics of BR-M14-19. | 7.1.5 | 16.1 |
| FR-M14-60 | On registration with a pending referral code (XR-M14-02) M14 SHALL apply BR-M14-19 (provisional). | 7.1.6 | 17.1, 17.2 |
| FR-M14-61 | `gamification.onSessionCompleted` SHALL credit the session by BR-M14-03 (rows, amounts, complimentary rule) and return `{coinsEarned, pointsEarned, streakCount, totalBalance}` to M05 BR-31. | 8.1.1 | 18.1, 18.2, 18.3, 03.5 |
| FR-M14-62 | XP SHALL increase by the handed `pointsEarned`, challenge, achievement and mystery-box XP; `level` SHALL not change at runtime (BR-M14-05, provisional). | 8.1.2 | 18.4 |
| FR-M14-63 | The streak SHALL follow BR-M14-14 (provisional). | 8.1.3 | 19.1 |
| FR-M14-64 | Streak activity rows SHALL follow BR-M14-14 (spm +7 on the first SPM session of the day; daily_login +2 on a student's first password login of the day). | 8.1.4 | 19.2, 18.1 |
| FR-M14-65 | No runtime rule SHALL write `streak_bonus` rows (BR-M14-14). | 8.1.5 | 19.3 |
| FR-M14-66 | A session of a user with a teacher wallet SHALL also write the teacher mirror rows of BR-M14-24. | 8.1.6 | 20.1 |
| FR-M14-67 | After every credit the tier SHALL be re-assigned by BR-M14-08 (upgrade only; seeds keep observed tiers). | 8.2.1 | 21.1, 21.2, 21.3 |
| FR-M14-68 | Titles SHALL be derived by BR-M14-09. | 8.2.2 | 21.1 |
| FR-M14-69 | Tier reward fields SHALL apply as BR-M14-03/BR-M14-21 (flat reward first, PKSK, Papan Bijak). | 8.2.3 | 37.4 |
| FR-M14-70 | #29 SHALL apply BR-M14-20 (award) atomically. | 8.3.1 | 22.1, 26.4 |
| FR-M14-71 | `gamification.onGameResult` SHALL apply BR-M14-21 (XP only while `games_award_syiling` = 0). | 8.3.2 | 22.5 |
| FR-M14-72 | `debitTokens` / `creditTokens` SHALL apply BR-M14-22 atomically and refuse with `INSUFFICIENT_BALANCE`. | 8.3.3 | 22.2, 22.3 |
| FR-M14-73 | `creditSyiling` with source `mystery_box` and `addXp` SHALL write "Kotak Misteri: {name}" and the XP (BR-M14-22). | 8.3.4 | 22.3 |
| FR-M14-74 | `draws.buyTicket` SHALL apply BR-M14-29 (provisional). | 8.3.5 | 22.4 |
| FR-M14-75 | The legacy claim row #42 SHALL be a seed row of type `spend`, source `reward_claim`; no runtime legacy claim endpoint SHALL exist (OQ-M14-05 closed: the student shop replicates live and stays empty). | 8.3.6 | 27.2 |
| FR-M14-76 | Every repository write SHALL be atomic with `balanceAfter` and SHALL never leave `currentSyiling` or `tokenBalance` below 0 (BR-M14-30). | 8.3.7 | 22.2, 22.4 |
| FR-M14-77 | S1 SHALL render the header and the six cards from #18 with the named queries of §6.10. | 9.1.1, 9.1.2 | 23.1, 23.5 |
| FR-M14-78 | S1 SHALL render "Taburan Tier" in alphabetical key order with the bar width = count ÷ Q-WALLETS and `min-width: 40px` (live), the count inside the bar, integer percentages, and the count text slate-800 on the gold, silver and platinum fills (DV-M14-06). | 9.1.3 | 23.2 |
| FR-M14-79 | S1 SHALL render "Top 10 Pelajar" from Q-LEADERBOARD. | 9.1.4 | 23.3 |
| FR-M14-80 | S1 SHALL render the 10 newest ledger rows (raw type capitalised, signed amount, raw source, relative time) and "Lihat semua →". | 9.1.5 | 23.4 |
| FR-M14-81 | S2 SHALL render one form per tier with the fields, sub-blocks and native `required`/`min` of URS FN-M14-9.2.2–9.2.5 and save through #20 (provisional success copy). | 9.2.1, 9.2.2, 9.2.3, 9.2.4, 9.2.5 | 24.1, 24.2, 24.3 |
| FR-M14-82 | S2 SHALL post the hidden `perks` unchanged; no perk input for existing tiers. | 9.2.6 | 24.3 |
| FR-M14-83 | "🔴 Nyahaktif" / "🟢 Aktifkan" SHALL toggle a tier through #21 (BR-M14-08, provisional). | 9.2.7 | 24.5 |
| FR-M14-84 | "Tambah Tier" SHALL create a tier through #22 with the defaults of URS FN-M14-9.2.8 (provisional). | 9.2.8 | 24.4 |
| FR-M14-85 | S3 SHALL render "Senarai Cabaran ({n})" and one form per challenge with its fields and "Simpan" (#24). | 9.3.1, 9.3.2, 9.3.3 | 25.1, 25.2 |
| FR-M14-86 | The "Jenis" select SHALL show the five types; the stored types SHALL follow DV-M14-04. | 9.3.4 | 25.1 |
| FR-M14-87 | The toggle SHALL deactivate/activate a challenge through #25 (provisional). | 9.3.5 | 10.4 |
| FR-M14-88 | "Padam" SHALL ask "Padam cabaran ini?" and, when confirmed, delete through #26 (provisional). | 9.3.6 | 25.3 |
| FR-M14-89 | "Tambah Cabaran" SHALL create through #27 with the defaults of URS FN-M14-9.3.7 (provisional). | 9.3.7 | 25.4 |
| FR-M14-90 | S4 SHALL render the header and the GET filter form; filters SHALL be applied by #28 and kept in the URL and page links; the `sort` option SHALL order the rows descending by its field, ties by lifetime then wallet creation (DV-M14-14; live ignores `sort`). | 9.4.1, 9.4.2 | 26.2, 26.3, 26.6 |
| FR-M14-91 | The award form SHALL validate natively (V-M14-06) and call #29; unknown user → the §8.2 error (provisional). | 9.4.3 | 26.4, 26.5 |
| FR-M14-92 | S4 SHALL render the table of URS FN-M14-9.4.4, 20 rows a page, with the tier badge colours. | 9.4.4 | 26.1, 26.2 |
| FR-M14-93 | S4 SHALL render the Laravel pager (desktop from 640 px, "« Previous" / "Next »" below). | 9.4.5 | 26.1, 26.3 |
| FR-M14-94 | S4 SHALL render "Belum ada pelajar dalam sistem gamifikasi" when no row matches. | 9.4.6 | 26.3 |
| FR-M14-95 | S5 SHALL render the header and the filter form; "Reset" only while a filter is set; dates inclusive (provisional). | 9.5.1, 9.5.2 | 27.2, 27.3 |
| FR-M14-96 | S5 SHALL render the ledger table of URS FN-M14-9.5.3, 25 rows a page, newest first (BR-M14-33). | 9.5.3 | 27.1 |
| FR-M14-97 | S5 SHALL render the pager and "Tiada transaksi ditemui" when empty. | 9.5.4, 9.5.5 | 27.1, 27.2 |
| FR-M14-98 | S19 SHALL render the four cards from #12 (`questionsCount`, earned/active badges). | 10.1.1 | 28.1, 28.5 |
| FR-M14-99 | S19 SHALL render the badge tiles (earned = `questionsCount` ≥ threshold) and the next-badge block. | 10.1.2, 10.1.3 | 28.2, 28.5 |
| FR-M14-100 | S19 SHALL render "Katalog Ganjaran" (empty copy or active rewards, PROPOSED card). | 10.1.4 | 28.3, 30.2 |
| FR-M14-101 | S19 SHALL render the teacher ledger newest first with the date format "dd MMM yyyy, HH:mm" and, when empty, "Belum ada transaksi" (PROPOSED reuse). | 10.1.5 | 28.3, 28.5 |
| FR-M14-102 | S19 buttons SHALL link to S20, S21, S22 and `/guru/soalan/cipta`; the "+{n} syiling" label SHALL follow `coins_per_question`. | 10.1.6 | 28.4 |
| FR-M14-103 | S20 SHALL render the cards (BR-M14-26) and "Maklumat" from #13. | 10.2.1, 10.2.2 | 29.1, 29.3 |
| FR-M14-104 | S20 SHALL render the amount input (min, max = available, step 1), the quick buttons and the preview shown only for min ≤ coins ≤ max (BR-M14-25). | 10.2.3, 10.2.4, 10.2.5 | 29.1, 29.2 |
| FR-M14-105 | S20 SHALL render the three required bank fields with the 25 live options. | 10.2.6 | 29.1, 29.3 |
| FR-M14-106 | Submit SHALL be enabled only for a valid amount, ask the live confirm and call #14 (BR-M14-26; refusals of §8.2) (provisional). | 10.2.7 | 29.3, 29.4 |
| FR-M14-107 | S20 SHALL list the viewer's requests (PROPOSED row) or "Tiada rekod tebus tunai lagi", and "Kembali ke Dashboard". | 10.2.8, 10.2.9 | 29.1, 29.3, 29.5 |
| FR-M14-108 | S21 SHALL render the header, balance, "Dashboard" link and the empty state when no reward is active. | 10.3.1, 10.3.2 | 30.1 |
| FR-M14-109 | S21 SHALL render active rewards (PROPOSED card) and "Tebus" SHALL call #16 (BR-M14-27, provisional). | 10.3.3 | 30.2 |
| FR-M14-110 | S22 SHALL render the tabs, the table (with "Sekolah" on the global tab) and the back link from #17. | 10.4.1, 10.4.2, 10.4.3 | 31.1, 31.2 |
| FR-M14-111 | #17 SHALL rank by BR-M14-28 (teachers only, school scope, 50 rows). | 10.4.4 | 31.1, 31.3, 31.4 |
| FR-M14-112 | `teacherGamification.onQuestionContributed` SHALL apply BR-M14-23 (provisional). | 10.5.1 | 32.1 |
| FR-M14-113 | Reaching a badge threshold SHALL award the badge bonus once (BR-M14-23). | 10.5.2 | 32.2 |
| FR-M14-114 | Cash request status changes SHALL apply BR-M14-26 (hold, debit at PAID, release at REJECTED) (provisional). | 10.5.3 | 32.3, 29.3 |
| FR-M14-115 | S6 SHALL render the four cards and the two links with the PENDING cash count badge from #31. | 11.1.1, 11.1.2 | 33.1 |
| FR-M14-116 | S6 SHALL render the badge table and the per-row "Edit" toggle (values kept while hidden) with the PUT form (#32). | 11.2.1, 11.2.2, 11.2.3 | 33.2, 33.3 |
| FR-M14-117 | S6 SHALL render "Katalog Ganjaran ({n})", the "Tambah Ganjaran" toggle and the multipart form (#33) with native validation. | 11.3.1, 11.3.2, 11.3.3 | 34.1, 34.2 |
| FR-M14-118 | S6 SHALL list catalogue rows with the PROPOSED layout after a create. | 11.3.4 | 34.2 |
| FR-M14-119 | S7 SHALL render the status pills, the per-status empty texts and the back link from #34. | 11.4.1, 11.4.2, 11.4.3 | 35.1 |
| FR-M14-120 | S7 SHALL list redemptions (PROPOSED row) and change their status through #35 (BR-M14-27, provisional). | 11.4.4 | 35.2 |
| FR-M14-121 | S8 SHALL render the cards, pills, table and links of URS FN-M14-11.5.1–11.5.3, 11.5.5 from #36. | 11.5.1, 11.5.2, 11.5.3, 11.5.5 | 36.1, 36.2 |
| FR-M14-122 | The S8 row form SHALL ask "Kemaskini status?" and call #37 (any status; note stored and shown, PROPOSED) (provisional). | 11.5.4 | 36.3 |
| FR-M14-123 | S9 SHALL render the 10 setting rows with the DV-M14-05 label. | 11.6.1, 11.6.2, 11.6.3 | 37.1 |
| FR-M14-124 | S9 SHALL rebuild "Pratonton Kadar" on every input with the live fallbacks. | 11.6.4 | 37.2 |
| FR-M14-125 | "Simpan Tetapan" SHALL save through #39 (shared keys with S10) and the three links SHALL open S6, S8, S7. | 11.6.5, 11.6.6 | 37.3, 37.4, 37.5 |
| FR-M14-126 | S10 SHALL render the three tiles from Q-RC-CLAIMS (BR-M14-31) with the session year in the label. | 12.1.1 | 38.1, 38.2 |
| FR-M14-127 | S10 "Tetapan Kewangan" SHALL save the five shared keys through #41. | 12.2.1 | 38.2, 37.4 |
| FR-M14-128 | S10 SHALL render the 11-row real-cost table with one form per row (#42) and the "RM" equivalent. | 12.3.1 | 39.1 |
| FR-M14-129 | S10 SHALL render the cabutan table (empty text), the closed `<details>` and the create form (#43, V-M14-12). | 12.4.1, 12.4.2, 12.4.3 | 40.1, 40.3 |
| FR-M14-130 | S10 SHALL list draws (PROPOSED row) and the draw repository SHALL serve M15 (BR-M14-29, provisional). | 12.4.4, 12.4.5 | 40.2, 22.4 |
| FR-M14-131 | Every M14 screen SHALL follow §10 and NFR-RESP-01..10 (no page overflow 320–1920 px, DV-M14-07; tables scroll in their cards). | 13.1.1 | 41.1 |
| FR-M14-132 | Text under 12 px on live SHALL be raised to 12 px (DV-M14-11). | 13.1.2 | 41.2 |
| FR-M14-133 | Small controls SHALL keep their live visual size with a 44 px hit area. | 13.1.3 | 41.3 |
| FR-M14-134 | Figures, dates and money SHALL use the formats of URS FN-M14-13.1.4. | 13.1.4 | 27.1, 28.3, 36.1 |
| FR-M14-135 | Accessibility SHALL replicate live (D10). | 13.1.6 | 41.3 |

### 3.1 Traceability (US → FR → E2E)

Generated by script from the FR table (§3) and the E2E table (§12); checked by `trace.cjs` (0 errors).

| US | FR | E2E |
|---|---|---|
| US-M14-01 | 01, 02, 03, 04 | 01, 02, 03, 04 |
| US-M14-02 | 05, 06, 07, 08, 09 | 05, 06, 07, 08, 09 |
| US-M14-03 | 10, 11, 12, 13, 61 | 10, 11, 12, 13, 14 |
| US-M14-04 | 14, 15, 16, 17 | 15, 16, 17 |
| US-M14-05 | 18, 19, 20, 21, 22 | 18, 19 |
| US-M14-06 | 23, 24, 25, 26, 33 | 20, 21, 24 |
| US-M14-07 | 27, 28, 29, 30, 32 | 22 |
| US-M14-08 | 28, 31, 33 | 23, 24, 25 |
| US-M14-09 | 34, 35, 36 | 26, 27 |
| US-M14-10 | 36, 37, 38, 39, 87 | 28, 29, 30 |
| US-M14-11 | 40, 41, 42, 43 | 31, 32 |
| US-M14-12 | 44, 45, 46, 47 | 33, 34 |
| US-M14-13 | 48, 49, 50 | 35 |
| US-M14-14 | 51 | 36 |
| US-M14-15 | 52, 53, 54, 55 | 37, 38, 39 |
| US-M14-16 | 56, 57, 58, 59 | 40 |
| US-M14-17 | 60 | 41 |
| US-M14-18 | 61, 62, 64 | 42, 43, 44 |
| US-M14-19 | 63, 64, 65 | 45, 46, 47 |
| US-M14-20 | 66 | 48 |
| US-M14-21 | 67, 68 | 49, 50 |
| US-M14-22 | 70, 71, 72, 73, 74, 76, 130 | 51, 52, 53, 54 |
| US-M14-23 | 77, 78, 79, 80 | 55, 56, 57 |
| US-M14-24 | 81, 82, 83, 84 | 58, 59, 60, 61 |
| US-M14-25 | 85, 86, 88, 89 | 62, 63, 64, 65 |
| US-M14-26 | 70, 90, 91, 92, 93, 94 | 51, 66, 67, 68 |
| US-M14-27 | 75, 95, 96, 97, 134 | 69, 70 |
| US-M14-28 | 98, 99, 100, 101, 102, 134 | 71, 72 |
| US-M14-29 | 103, 104, 105, 106, 107, 114 | 73, 74 |
| US-M14-30 | 100, 108, 109 | 75, 76 |
| US-M14-31 | 110, 111 | 77, 78 |
| US-M14-32 | 112, 113, 114 | 79, 80 |
| US-M14-33 | 115, 116 | 81, 82 |
| US-M14-34 | 117, 118 | 83, 84 |
| US-M14-35 | 119, 120 | 76, 85 |
| US-M14-36 | 121, 122, 134 | 80, 86 |
| US-M14-37 | 69, 123, 124, 125, 127 | 87, 88 |
| US-M14-38 | 126, 127 | 89, 90 |
| US-M14-39 | 128 | 91 |
| US-M14-40 | 129, 130 | 92, 93 |
| US-M14-41 | 43, 131, 132, 133, 135 | 94, 95, 96, 97 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M14-01 | **Access.** Guest → `/login`. S1–S10 and endpoints #18–#43: role `admin`. S19–S22 and #12–#17: `teacher` or `admin`. S11–S18 and #1–#11: any logged-in user. Other roles are redirected to their M01 landing page; endpoints answer 403 `FORBIDDEN`. | OBSERVED (admin) / INFERRED |
| BR-M14-02 | **Wallet defaults.** A user without a wallet row reads `currentSyiling` 0, `totalSyilingEarned` 0, `tokenBalance` 0, `xp` 0, `level` 1, tier = the active tier with the lowest `minSyiling` (Gangsa), title Permulaan, streak 0 / 0; no row is created by a read. The first repository credit creates the row (`createdAt` = now) and it then counts in Q-WALLETS. Same values as M01 BR-24 and M05 BR-25. | INFERRED |
| BR-M14-03 | **Session credit** (`onSessionCompleted`, called by M05 BR-31 step 6 for every mode). coinsPerCorrect precedence: (1) a `coinsPerCorrect` passed by M05 wins — M05 passes 3 for `mission` sessions (M05 BR-09, XL2-08); (2) else `flat_quiz_reward` when > 0; (3) else the tier's `quiz_reward_l{d}` for each correct answer of difficulty d (INFERRED; the per-level split is the optional input `correctByLevel` {1–5 → count}, which **M05 does not send** — as built, without it every correct answer counts at level 1; v1.8); Mode `pksk` (M05 v1.12; M07 PKSK practice completing through BR-31) follows the same precedence: passed `coinsPerCorrect`, else `flat_quiz_reward` when > 0 (seed 1 → 1 per correct), else the tier `pksk_reward_correct` (seed 5) instead of `quiz_reward_l{d}` (PKSK questions have no level, S2 "Semua soalan PKSK (tiada level)") — INFERRED: no PKSK ledger row was observed on live; the flat setting is observed to override the tier per-answer fields for Latih Tubi and SPM rows. coins = correct × coinsPerCorrect. When coins > 0 one `earn` row is written: modes `random` / `chapter` / `revision` / `mission` → source `quiz_practice`, "Latih Tubi: {correct} betul — {pct}" (also `remedial` and `question_set`, the other M05 practice modes of M05 BR-35 — INFERRED, no ledger row of these modes was observed; v1.8); `past_year` → `quiz_spm`, "SPM Tahun Lepas: {correct} betul — {pct}"; `latih_tubi` → `quiz_spm`, "Latih Tubi SPM: {correct} betul — {pct}"; `ramalan` → `quiz_spm`, "Ramalan SPM: {correct} betul — {pct}" (PROPOSED COPY); `pksk` → `quiz_pksk` "PKSK: {correct} betul — {pct}" (PROPOSED COPY). No row when coins = 0. A student with M02 `coinsEnabled = false` earns no syiling (XP still added). **Session coins vs wallet credit:** M05 stores the session `coinsEarned` by its own BR-09 (= correct; mission 3 × correct; OBSERVED on every live session); the wallet credit is M14's and may differ (flat setting ≠ 1, complimentary student, historical rates) exactly as on live (A2: session 14, ledger +42); the returned `coinsEarned` (= the credited amount) goes only into the M05 #6 submit response, which M05 S7 "Ganjaran Anda" shows, and is never stored on the session; M05 S9 and M08 BR-M08-28 keep the session figure (v1.8 note, F-26 G4, Delivery Lead: replicate live; M05 BR-09 / BR-31 step 6, overview §6.8). Order of rows written by one completion: session credit, streak activity (BR-M14-14), challenge rewards (BR-M14-13), achievement rewards (BR-M14-16). | OBSERVED (row texts, flat 1) / INFERRED |
| BR-M14-04 | **Percent format in descriptions:** pct = correct ÷ total × 100 rounded to 2 decimals, trailing zeros and point dropped, + "%" ("32.35%", "35%", "20%"). | OBSERVED |
| BR-M14-05 | **XP and level.** `xp` += `pointsEarned` handed by M05 (BR-09), + challenge `reward_xp`, + achievement XP, + mystery-box XP, + game XP. `level` is stored and never changed at runtime (Q4, provisional). xpNeeded(level) = 100 + 10 × (level − 1); `levelProgressPct` = min(100, round(xp ÷ xpNeeded × 100)) (admin 8/110 → 7 %, the M05 value). When xp ≥ xpNeeded the text still reads "{xp}/{xpNeeded} XP" and the bar is full (designed pelajar "916/100 XP", pelajarmaju "432/120 XP"; PROPOSED — live never observed; URS OQ-M14-12). | OBSERVED (values) / INFERRED |
| BR-M14-06 | **Next tier progress (S11):** next = the active tier with the smallest `minSyiling` above the current tier's; pct = `currentSyiling` ÷ next.minSyiling × 100 with 1 decimal, capped at 100; need = max(0, next.minSyiling − `currentSyiling`). No next tier → no block. | OBSERVED (admin) / INFERRED |
| BR-M14-07 | **Earned today / this week (S11):** Σ of positive ledger amounts of the user with `createdAt` in today (00:00–24:00) or this week (Monday 00:00 – Sunday 24:00), Asia/Kuala_Lumpur, mock clock; shown "+{n}". | INFERRED (admin +0 / +0 OBSERVED) |
| BR-M14-08 | **Tier assignment.** After every credit, the wallet takes the highest **active** tier whose `minSyiling` ≤ `currentSyiling` if it is higher than the current tier; it never moves down (debits, conversions, deactivation of a lower tier do not demote). A deactivated tier is skipped for upgrades, hidden from S11/S12 grids and its holders keep their stored tier (INFERRED). Seeds keep the observed tier of every anchor. | INFERRED (Q3) |
| BR-M14-09 | **Titles** by `totalSyilingEarned`: 📚 Permulaan 0, 🎓 Pelajar 300, Master 2,000, Grandmaster 3,500, Legenda 5,000, Mitos 10,000 (emojis of the last four not observed → none). Next title = the next threshold; "Perlu {threshold − totalSyilingEarned} syiling lagi untuk gelaran ini"; none after Mitos. | OBSERVED (Permulaan/Pelajar, anchors) / INFERRED (cut-offs) |
| BR-M14-10 | **Conversion validity:** s is an integer, rate ≤ s ≤ `currentSyiling`, rate = the viewer's tier `conversionRate`; the client disables the button otherwise; the server refuses otherwise (`422 VALIDATION_ERROR`). | OBSERVED (client) / INFERRED (server) |
| BR-M14-11 | **Conversion effect** (atomic): `currentSyiling` −= s; `tokenBalance` += floor(s ÷ rate); ledger `convert` row, source `token_conversion`, amount −s, `tokens` t, description "Tukar {s} syiling → {t} token"; `totalSyilingEarned` and the tier unchanged. | OBSERVED (row) / INFERRED |
| BR-M14-12 | **Challenge progress** (today, from M05 `practice.history(userId, {date})` and the answer log): metric per challenge — `sessions` (completed sessions of any mode), `correct` (Σ correct), `bestAccuracy` (max floor(session accuracy %)), `bestCorrectInSession`, `chapters` (distinct M03 curriculum chapters of today's answered questions; SPM pool questions without a chapter add none), `minutes` (floor(Σ timeSpent ÷ 60)), `streak` (M14 `streak.current`). Seeded mapping: 1 sessions, 2 bestAccuracy, 3 chapters, 4 correct, 5 sessions, 6 correct, 7 minutes, 8 streak, 9 bestAccuracy, 10 bestCorrectInSession (M05 BR-10). A new challenge takes the default metric of its type: `quiz_count` → sessions, `accuracy` → bestAccuracy, `topic_variety` → chapters, `streak` → streak, `time_spent` → minutes. progress = min(target, metric). | INFERRED (M05 BR-10; Q7) |
| BR-M14-13 | **Challenge award:** after each session completion, every active challenge with progress ≥ target and no completion today gets a completion row (user, challenge, date) and, in order (`sortOrder`, `id`), a ledger row "Cabaran selesai: {title}" (`earn`, `daily_challenge`, +`rewardSyiling`) and +`rewardXp`. Q-DAILY-FINISHERS counts the users whose completions today cover every active challenge. | OBSERVED (row) / INFERRED |
| BR-M14-14 | **Streak.** Qualifying event: completing a session (any mode) or a password login of a `student`. On a qualifying event on date d (Asia/Kuala_Lumpur): if `lastActivityDate` = d → no change; if d − 1 → `current` + 1; otherwise `current` = 1; `best` = max(`best`, `current`); `lastActivityDate` = d. Reads never change the value (admin 1 with last activity 19/05/2026). Activity rows: first SPM-mode session (`past_year`, `latih_tubi`, `ramalan`) of the day → `earn` +7 "Streak activity (spm)" source `spm`; first student password login of the day → `earn` +2 "Streak activity (daily_login)" source `daily_login` (a form login as pelajar / pelajarmaju at the clock therefore reads 372 / 269; E2E that assert 370 / 267 use `setUser`, which calls no hook — XL3-30); complimentary students get no row. **No streak bonus** is written at runtime (only 2 `streak_bonus` rows exist, both seed data). `practisedToday` (M05 FR-09) = a completed session today. | OBSERVED (values, amounts) / INFERRED (triggers) |
| BR-M14-15 | **Multiplier:** "1.0x" for every streak value (the only observed step); shown on S15 and S18; it multiplies nothing in the prototype. | OBSERVED (1.0x) / INFERRED |
| BR-M14-16 | **Achievements** (catalogue DATA-M14-06): evaluated after each completion of a practice-mode session (`random`, `chapter`, `revision`). Criteria (INFERRED from the descriptions): "kuiz" = completed practice-mode sessions (1, 10, 50, 200, 500 — these 5 show progress); streak badges = `streak.current` ≥ 3 / 7 / 30 / 100 (Pelajar Awal = 7); Pengumpul Syiling / Hartawan Syiling / Raja Syiling = `totalSyilingEarned` ≥ 100 / 1,000 / 5,000; Tepat Sasaran = 10 practice sessions with accuracy ≥ 90 %; Penjelajah = practice answers in 5 distinct subjects; Ahli Kotak Misteri = 10 M15 openings (`mysteryBox.openingsCount(userId)`, M15 Q-M15-OPENINGS-COUNT); Cabaran Selesai / Penakluk Cabaran = 20 / 100 challenge completions; Tokoh Matematik = 100 correct Matematik answers; Pakar Sains = 200 correct Sains answers; Si Pantas = 50 answers under 10 s each (from M05 answer times, when recorded); Sahabat Belajar = 3 rewarded referrals; Pengumpul Lencana = 15 unlocked achievements; Ilmuwan Sejati = 1,000 answers with overall accuracy ≥ 85 %; Wira JomBelajar = all active challenges completed on 30 consecutive days. On unlock: +syiling (`earn`, source `achievement`, "Pencapaian: {name}", PROPOSED COPY), +XP; unlocked once. | OBSERVED (catalogue, admin 0/25) / INFERRED / PROPOSED |
| BR-M14-17 | **Student leaderboard (Q-LEADERBOARD):** every wallet by `totalSyilingEarned` desc, then wallet `createdAt` asc, then `userId` asc; top 50; podium = ranks 1–3; S1 Top 10 = ranks 1–10. | OBSERVED (order) / INFERRED (ties) |
| BR-M14-18 | **Referral code:** one per user, 7 characters from [A-Z0-9], unique, stable (seed: admin "4JURJTT"; others deterministic from the user id); created on first read of S16. | OBSERVED (format) / INFERRED |
| BR-M14-19 | **Referral reward** (INFERRED, provisional): on registration of a new user with a pending code (M01, XR-M14-02) belonging to another existing user: new user +25 (`bonus`, source `referral`, "Bonus rujukan: kod {CODE}", PROPOSED COPY), referrer +50 (`bonus`, `referral`, "Rujukan kawan berjaya", PROPOSED COPY), a Referral row {referrerId, refereeId, rewarded: true}. Unknown code, own code or a user already referred → nothing. Stats (S16): Rujukan = referrals of the user; Ganjaran Dicapai = rewarded referrals; Syiling Diperolehi = Σ referrer syiling (50 × rewarded). | OBSERVED (50/25 copy) / INFERRED / PROPOSED |
| BR-M14-20 | **Admin award:** user must exist (any role; the wallet row is created when missing); 1 ≤ amount ≤ 10,000 integer; reason required (≤ 255 characters, INFERRED); `bonus` row, source `admin_award`, description = reason; tier re-assigned (BR-M14-08). | OBSERVED (form) / INFERRED |
| BR-M14-21 | **Games (M16) and tier game fields:** `onGameResult(userId, {game, event, coins?, xp, correct?, total?, detail?}) → {coinsCredited, xpAdded}` (the optional `correct`, `total`, `detail` fill the ledger wording M16 XR-02 (a)/(c) specifies, XL3-29): XP always added; syiling only while `canEarnSyiling(userId)` (= `games_award_syiling` = 1 and the user's M02 `coinsEnabled` ≠ false, XL3-26) — `coins` as passed by M16, or for Papan Bijak the tier `boardGameRewardCorrect` / `boardGameRewardWin` when `coins` is omitted — with the M16 source and wording of the ledger sample (e.g. "Jawab betul dalam Papan Bijak 🎲", "Menang Papan Bijak! 🏆🎲"); `coinsCredited` = 0 while the setting is 0, so M16 can show what was actually paid (M16 D-M16-24). | OBSERVED (setting, rows) / INFERRED |
| BR-M14-22 | **Token and M15 movements** (XR-M15-02): `debitTokens(userId, n, {source, refId})` (`hadiah_redeem`, `mystery_box`) refuses when `tokenBalance` < n (`INSUFFICIENT_BALANCE`); `creditTokens(userId, n, {source: 'hadiah_refund', refId})`; token movements are stored in the internal TokenMovement log (not shown on any screen, as live) and never in the coin ledger. `creditSyiling(userId, n, {source: 'mystery_box', description: 'Kotak Misteri: {name}'})` writes an `earn` row; `addXp(userId, n, {source})` adds XP without a row; `debitSyiling(userId, n, {source, refId, description})` writes a `spend` row and refuses when `currentSyiling` < n. | OBSERVED (row text) / INFERRED |
| BR-M14-23 | **Teacher contribution and badges:** `onQuestionContributed(teacherId, questionId)` (M10, on each objective or structured question created): `questionsCount` += 1; teacher wallet += `coins_per_question` with the row "Sumbang Soalan #{questionId}" (PROPOSED COPY; Q5, provisional). Then each active badge with threshold ≤ `questionsCount` not yet earned is earned once with the row "Badge: {name} ({threshold} soalan)" +`bonusCoins`. Editing a badge threshold never revokes an earned badge. Deleting a contributed question (M10) never decrements `questionsCount` and never takes coins back (INFERRED: live keeps 20,719 without "+10" rows; provisional). | OBSERVED (badge rows) / INFERRED / PROPOSED |
| BR-M14-24 | **Teacher mirror of practice:** when the user has a teacher wallet (role `teacher`, or `admin`), each completed session also writes to the teacher ledger "{label} - {pct} ketepatan" with +correct (0 included), label = "Latih Tubi SPM" (`latih_tubi`), "SPM Tahun Lepas" (`past_year`), "Latihan" (M05 practice modes `random`, `chapter`, `revision`, `mission` as observed, and `remedial`, `question_set` — INFERRED, v1.8), "Ramalan SPM" (`ramalan`, PROPOSED), "PKSK" (`pksk` — INFERRED, no PKSK teacher row observed; v1.8); and on the first SPM session of the day "Aktiviti harian: spm" +7. The teacher wallet is created on first write. | OBSERVED (rows) / INFERRED |
| BR-M14-25 | **Cash preview:** cash = coins ÷ `cash_rate_coins` × `cash_rate_sen` ÷ 100, shown "RM" + 2 decimals; preview and submit only when `min_cash_withdrawal` ≤ coins ≤ available. | OBSERVED |
| BR-M14-26 | **Cash request lifecycle:** held = Σ coins of the teacher's requests in PENDING / APPROVED / PROCESSING; available = balance − held; a request needs `cash_withdrawal_enabled` = 1 (else 403 `CASH_DISABLED`), min ≤ coins ≤ available, integer, and the three bank fields; it is created PENDING. Any status can be set by the admin (as live). Entering PAID debits the coins once (`spend`, "Tebus Tunai #{id}", PROPOSED COPY); leaving PAID for another status credits them back (INFERRED) with the teacher-ledger row "Tebus Tunai #{id} dibatalkan" (+coins; PROPOSED COPY, §8.2; v1.8); REJECTED releases the hold. S8 cards: PENDING count, APPROVED count, PAID count, Σ cash of PAID. S6 badge = PENDING count. | OBSERVED (fields, confirm) / INFERRED (Q6) / PROPOSED |
| BR-M14-27 | **Teacher rewards and redemptions** (PROPOSED, provisional): an active reward can be redeemed when stock is null or ≥ 1, the teacher's redemptions of it < `maxPerUser` (if set), this calendar month's < `maxPerMonth` (if set) and available balance ≥ `costCoins`; the redemption is PENDING and holds the cost; DELIVERED debits it ("Tebusan: {name}", PROPOSED COPY) and decrements stock; CANCELLED releases it. | PROPOSED / INFERRED |
| BR-M14-28 | **Teacher leaderboard:** users with role `teacher`; `sekolah` = same `schoolId` as the viewer when the viewer is a teacher; for any other viewer (the admin, seed school 900002) every teacher, as the live admin view; ordered by `questionsCount` desc, then user id asc; top 50; "Syiling" = teacher balance (0 without a wallet). | OBSERVED (admin view) / INFERRED |
| BR-M14-29 | **Draws** (XR-M15-03): created by #43 with status `open` when "Buka serta-merta" is ticked, else `draft` (PROPOSED); `listOpenDraws(today)` = status `open` and `closesAt` ≥ today; `buyTicket(drawId, userId)` = one ticket per call, refused when not open (`DRAW_CLOSED`), when the user holds `maxTicketsPerStudent` tickets (`TICKET_LIMIT`) or when `currentSyiling` < `ticketCostSyiling` (`INSUFFICIENT_BALANCE`); on success `debitSyiling(…, {source: 'cabutan_ticket', description: 'Tiket Cabutan: {title}'})` (PROPOSED COPY) and a DrawTicket row. Winner drawing: not built. | OBSERVED (fields) / INFERRED / PROPOSED |
| BR-M14-30 | **Atomicity and non-negative balances:** every repository write runs in one mock transaction; a refused write changes nothing; `currentSyiling` and `tokenBalance` never go below 0 at runtime; `balanceAfter` of a new row = the balance after the write. Seeded negative token values (DV-M14-10) are data and can only rise. | INFERRED |
| BR-M14-31 | **S10 tiles (Q-RC-CLAIMS):** over claims of the syiling-priced reward catalogue with `claimedAt` in `current_session_year`: liability = Σ `costValueSen` ÷ 100 (RM, 2 decimals); students = distinct users; claims = count. No claim record exists in the seed (ledger #42 is a ledger row only) → RM0.00 / 0 / 0. | INFERRED (XR-M15-07, OQ-M14-05) |
| BR-M14-32 | **Settings:** one store of 10 keys (DATA-M14-16); S9 edits all ten, S10 edits five of them; a save changes only the posted keys; values are integers ≥ 0 (booleans 0/1). Consumers read them at use time (conversion of teacher cash, contribution coins, flat reward, games, budget year). | OBSERVED / INFERRED |
| BR-M14-33 | **Ledger order:** `createdAt` desc, then `id` desc; S5 25 a page, S17 all rows, S11 6, S1 10. | OBSERVED |
| BR-M14-34 | **Tier distribution (S1):** rows by tier key ascending (bronze, gold, platinum, silver); count = Q-TIER(key); width = count ÷ Q-WALLETS × 100 % with `min-width: 40px` (live); the count inside the bar, white on bronze and slate-800 on gold, silver and platinum (DV-M14-06); label = round(count ÷ Q-WALLETS × 100) + "%". | OBSERVED + DV-M14-06 |
| BR-M14-35 | **Relative time:** < 1 min "baru sahaja" (INFERRED), then floor minutes "{n} minit yang lepas", hours "{n} jam yang lepas", days "{n} hari yang lepas" (1–6 days), weeks "{floor(d ÷ 7)} minggu yang lepas" (7–29 days; OBSERVED on M16, the shared formatter of M01/M04, XL3-28), months "{n} bulan yang lepas" (30-day months, INFERRED), years "{n} tahun yang lepas" — the Laravel `diffForHumans` pattern in BM (OBSERVED minit/jam/minggu/bulan). | OBSERVED / INFERRED |
| BR-M14-36 | **Overview cards (S1):** Pelajar Aktif = Q-WALLETS; Syiling Dijana = Q-SYILING-DIJANA; Token Ditukar = Q-TOKENS-CONVERTED; Penukaran = Q-CONVERSIONS; Cabaran Aktif = Q-CHALLENGES-ACTIVE; Siap Hari Ini = Q-DAILY-FINISHERS (§6.10). | OBSERVED (values) / INFERRED (definitions) |

## 5. Validation rules

| ID | Form / field | Rule | Message | Trigger |
|---|---|---|---|---|
| V-M14-01 | S12 `syiling_amount` | number, `required`, `min` = rate, `max` = `currentSyiling` | button disabled (no text); server: "Jumlah syiling tidak sah." (PROPOSED COPY) | on input / on submit |
| V-M14-02 | S2 tier forms | `label_ms`, `icon`, `min_syiling`, `conversion_rate`, `sort_order`, L1–L5, PKSK, Papan Bijak required; numbers min 0 (L1–L5, PKSK, Papan Bijak) | browser bubble ("Please fill out this field." in Chrome) | on submit |
| V-M14-03 | S2 add tier | as V-02 + `tier_name` required and unique (server: "Nama tier sudah wujud.", PROPOSED COPY); `perks` optional | browser bubble / PROPOSED | on submit |
| V-M14-04 | S3 challenge forms | every field required | browser bubble | on submit |
| V-M14-05 | S3 delete | confirm "Padam cabaran ini?" | — | on submit |
| V-M14-06 | S4 award | `user_id` number required; `amount` 1–10,000 required; `reason` required | browser bubble; server unknown user "Pengguna tidak dijumpai." (PROPOSED COPY) | on submit |
| V-M14-07 | S6 badge edit | no native `required` (live); server: name required, threshold ≥ 1, bonus ≥ 0 (INFERRED; "Sila lengkapkan semua medan wajib." SRS.md §7.3) | PROPOSED | on submit |
| V-M14-08 | S6 reward create | `name` required; `category` required (has a default); `cost_coins` ≥ 1 required; `stock` ≥ 0; `max_per_user`, `max_per_month` ≥ 1; image `accept="image/*"` | browser bubble | on submit |
| V-M14-09 | S20 cash form | `coins_amount` `required`, `min` = `min_cash_withdrawal`, `max` = available, `step` 1; `bank_name`, `bank_account`, `account_holder` required; confirm "Sahkan tebus tunai?\n\n{coins} syiling = RM{cash}\n\nTeruskan?" | button disabled; browser bubble | on input / on submit |
| V-M14-10 | S8 status form | confirm "Kemaskini status?"; `admin_note` optional | — | on click |
| V-M14-11 | S9 settings | number inputs min 0, step 1 (no `required`) | browser bubble for a value below 0 | on submit |
| V-M14-12 | S10 draw | `title` required; `prize_pool` must be empty or a JSON array of `{label, value_sen, qty}` (server: "Format JSON kolam hadiah tidak sah.", PROPOSED COPY) | browser bubble / PROPOSED | on submit |
| V-M14-13 | S10 settings and costs | no `required`; `cost_value_sen` integer ≥ 0 (INFERRED) | — | on submit |

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase. User, school, challenge, tier, badge, reward, request and draw ids are integers; ledger ids are integers (live `#53678`). Mock storage follows architecture §6.5–§6.7: two **virtual datasets** (§6.11) and materialised tables for the rest. The provisional wallet/streak repository of architecture §6.7 (defined in M05 with `owner: 'M14'`) moves into M14 with the same method names (§7.1).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Used for |
|---|---|---|
| User (id, name, email, role, schoolId, `coinsEnabled`, `isComplimentary`) | M01 / M02 (users dataset §6.15) | names, roles, school scope, complimentary rule. `coinsEnabled` is read at call time through M02 `complimentary.coinsEnabled(userId)` once M02 exposes it (XR-M14-12); until then the build falls back to "complimentary student (`isComplimentary`) → false, everyone else → true" (M02 §6.15 B seeds all 90 complimentary students with `coinsEnabled = false`) |
| School | M02 | S22 "Sekolah" |
| QuizSession, QuizAnswer, SubjectMastery | M05 | session credit input, challenge metrics, achievement criteria, S11 mastery, S18 figures (119 / 38.7 % / 4). **Read contract (M05 §7.2, v1.8; read at call time):** `practice.history(userId, {date?: 'YYYY-MM-DD' MYT, modes?})` → all completed sessions matching the filter, unpaged (`id`, `mode`, `status`, `correct`, `total`, `completedAt`, `timeSpent`; `correct` / `total` = DATA-M05-01 `correctCount` / `questionCount`) — BR-M14-12 today's sessions, `practisedToday`, BR-M14-16 practice-session counts; `practice.answers(userId, {date})` → `chapterId`, `subjectId`, `isCorrect`, `answeredAt` — the `chapters` metric and subject criteria; `practice.mastery(userId)` → `[{subjectId, correct, answered, lastAnsweredAt}]` — S11 mastery. M14 fails loudly (`CONTRACT` error) when a method is missing or a row has another shape |
| CurriculumChapter | M03 | "Penjelajah Topik" metric |
| Question | M04 | contribution events (via M10) |
| HadiahReward, HadiahRedemption, MysteryBox openings | M15 | token debits/credits, "Ahli Kotak Misteri" |
| TeacherMission | M10 | `coinsPerCorrect` of mission sessions |

### 6.2 DATA-M14-01 — StudentWallet (virtual dataset `wallets`, owner M14)

| Field | Type | Req | Notes |
|---|---|---|---|
| userId | int | yes | key; M02 user |
| currentSyiling | int | yes | ≥ 0 at runtime |
| totalSyilingEarned | int | yes | Σ positive credits (lifetime); unchanged by debits |
| tokenBalance | int | yes | may be negative in seed data only (DV-M14-10) |
| xp | int | yes | header "mata" |
| level | int | yes | stored (Q4) |
| tierKey | enum `bronze\|silver\|gold\|platinum\|…` | yes | facet; upgrade-only (BR-M14-08) |
| createdAt | datetime | yes | tie-break of rankings |
| title, nextTitle, xpNeeded, levelProgressPct, earnedToday, earnedThisWeek | derived | — | BR-M14-05/07/09 |

### 6.3 DATA-M14-02 — CoinTransaction (virtual dataset `coinLedger`, owner M14)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | live range 1–53,678 (`#53678`); runtime ≥ 9,000,001 |
| userId | int | yes | wallet owner |
| type | enum `earn\|spend\|convert\|bonus\|refund` | yes | facet |
| amount | int | yes | signed (+ earn/bonus/refund, − spend/convert) |
| balanceAfter | int | yes | "Baki Selepas" / "Baki:" |
| source | string | yes | facet within type: `quiz_practice`, `quiz_spm`, `quiz_pksk`, `structured_question`, `spm`, `daily_login`, `streak_bonus`, `daily_challenge`, `token_conversion`, `token_convert`, `reward_claim`, `mystery_box`, `papan_bijak`, `papan_bijak_win`, `benteng_play`, `benteng_win`, `perang_fakta_win`, `mathrace_play`, `jutawan_ilmu`, `quiz_complete`, `admin_award`, `referral`, `achievement`, `cabutan_ticket`, `legacy` (the admin's three February 2026 rows, whose live source keys were not shown; their wording "Cabaran Kilat: 3 betul, combo 2x" and "Betul/Salah: 3 betul, streak 2" suggests M16 game rows, and "One-time sync …" a migration row) |
| tokens | int\|null | no | conversion rows only |
| description | string | yes | exact live wording (§4) |
| refId | string\|null | no | e.g. session id, draw id |
| createdAt | datetime | yes | displayed as stored ("dd/mm/yyyy HH:mm") |

### 6.4 DATA-M14-03 — Tier (owner M14; 4 rows)

`{id, tierName (key, unique), labelMs, icon, color, minSyiling, conversionRate, sortOrder, perks: string[], quizRewardL1…L5, pkskRewardCorrect, boardGameRewardCorrect, boardGameRewardWin, isActive}`. Seed = discovery §2.2 (ids 1–4).

### 6.5 DATA-M14-04 — DailyChallenge and DATA-M14-05 — ChallengeCompletion (owner M14)

DailyChallenge `{id, title, description, icon, challengeType enum quiz_count|accuracy|topic_variety|streak|time_spent, metric (internal, BR-M14-12), targetValue, rewardSyiling, rewardXp, difficulty enum easy|medium|hard, sortOrder, isActive}` — 10 rows (§6.11). ChallengeCompletion `{id, userId, challengeId, date (local), completedAt}` — unique (userId, challengeId, date).

### 6.6 DATA-M14-06 — Achievement and DATA-M14-07 — UserAchievement (owner M14)

Achievement `{id 1–25 (live order; live ids not exposed), icon, name, description, rarity enum common|rare|epic|legendary, rewardSyiling, rewardXp, criterion (BR-M14-16), progressTarget|null (the 5 kuiz badges)}`. Rarity colours: common #9ca3af, rare #3b82f6, epic #8b5cf6, legendary #f59e0b; share gradients of discovery A.2. UserAchievement `{userId, achievementId, unlockedAt}`.

### 6.7 DATA-M14-08 — Streak (owner M14)

`{userId, current, best, lastActivityDate (local date), totalDays}`; default 0 / 0 / null / 0. `totalDays` = the stored "Jumlah Hari" counter read by M18 (not derived from the answer log: 2710 shows 13 and 4 with 3 calendar days); runtime: +1 on each new streak day (INFERRED, provisional). **Seeded `totalDays` (v1.8):** 13 and 4 for the two 2710 pupils (§6.11.7); **0 for every other row, explicitly including the designed accounts 2 (pelajar) and 4 (pelajarmaju)**, whose replayed `current` / `best` (2 / 2 and 3 / 3, §6.11.3) do not set the counter; the admin 0. "Active" (M18) = stored `current` > 0; reads never decay (BR-M14-14).

### 6.8 Referral, teacher side, settings, rewards, draws

| Entity | Fields | Notes |
|---|---|---|
| DATA-M14-09 ReferralCode / Referral | code `{userId, code}`; referral `{id, referrerId, refereeId, codeUsed, rewarded, createdAt}` | BR-M14-18/19 |
| DATA-M14-10 TeacherWallet | `{userId, balance, totalEarned, questionsCount, createdAt}` | materialised; S19–S22 |
| DATA-M14-11 TeacherCoinTransaction | `{id, userId, amount (signed, 0 allowed), description, createdAt}` | S19 history (no type/source shown on live) |
| DATA-M14-12 TeacherBadge / TeacherBadgeAward | badge `{id, name, icon (FA class), threshold, bonusCoins, isActive}` (8); award `{userId, badgeId, awardedAt}` | §6.11 |
| DATA-M14-13 TeacherReward | `{id, name, category enum general\|digital\|physical\|voucher, costCoins, stock\|null, maxPerUser\|null, maxPerMonth\|null, description, imageUrl\|null, isActive, createdAt}` | 0 rows |
| DATA-M14-14 TeacherRedemption | `{id, userId, rewardId, costCoins, status enum PENDING\|PROCESSING\|DELIVERED\|CANCELLED, createdAt, updatedAt}` | 0 rows |
| DATA-M14-15 CashWithdrawal | `{id, userId, coins, cashSen, bankName, bankAccount (stored; API returns masked), accountHolder (stored; API masked), status enum PENDING\|APPROVED\|PROCESSING\|PAID\|REJECTED, adminNote\|null, createdAt, paidDebited bool}` | 2 rows |
| DATA-M14-16 GamificationSetting | `{key, value int, label}` × 10 | §6.11 |
| DATA-M14-17 GamificationReward (syiling-priced catalogue) | `{id 1–11, name, type enum VOUCHER\|PHYSICAL\|EXPERIENCE\|DIGITAL\|SUBSCRIPTION, priceSyiling, costValueSen}` + claims `{id, userId, rewardId, costValueSen, claimedAt}` (0 rows) | owner M14 (URS OQ-M14-05) |
| DATA-M14-18 Draw / DATA-M14-19 DrawTicket | draw `{id, title, description, ticketCostSyiling, maxTicketsPerStudent, prizePool [{label, valueSen, qty}], closesAt (date), status enum draft\|open\|closed, createdAt}`; ticket `{id, drawId, userId, createdAt}` | 0 rows (XR-M15-03) |
| DATA-M14-20 LearnerBadge / LearnerBadgeHolding | badge `{id, name, icon (FA), rarityLabel\|null}`; holding `{userId, badgeId, awardedAt}` | the teacher-awarded "lencana" set read by M08 FR-M08-126 and M10 BR-M10-16 (not shown on any M14 screen); definitions OBSERVED on M08 S6: "Pemula Rajin" `fa-seedling`, "Pelajar Aktif" `fa-running`, "Pengumpul" `fa-coins` |
| DATA-M14-21 TokenMovement | `{id, userId, delta, source, refId, createdAt}` | internal audit log (BR-M14-22); no screen |
| DATA-M14-22 DailyLoginMark | `{userId, date}` | "first login of the day" |
| DATA-M14-23 SessionCredit (table `gamification.sessionCredits`, v1.8) | `{id, userId, sessionId, completedAt, coinsEarned, pointsEarned, streakCount, totalBalance}`; index `sessionId` | **idempotency of `onSessionCompleted`:** one stored result per credited `sessionId`; a second call with a credited `sessionId` returns the stored result and writes nothing (a retried or duplicated M05 submit never pays twice). Seed: the designed sessions **P1–P4** (account 2) and **M1–M4** (account 4) are pre-credited with their replay results (§6.11.3), so M05 cannot pay them again; no other seeded session has a row. Not shown on any screen. Alternative considered: dedupe by a `refId` search of the ledger — rejected, sessions with coins 0 write no ledger row and would be credited twice |

### 6.9 Enumerations and constants

Type labels (S5/S17 pills): earn "💰 Dapat", spend "🛍️ Belanja", convert "🔄 Tukar", bonus "🎁 Bonus", refund "↩️ Refund". Tier keys → labels: bronze Gangsa 🥉, silver Perak 🥈, gold Emas 🥇, platinum Platinum 💎. Difficulty: easy "Mudah" (select) / "Mudah" (badge); medium "Sederhana"; hard "Susah" (select) / "Sukar" (badge). Challenge types: quiz_count "Bilangan Kuiz", accuracy "Ketepatan (%)", topic_variety "Topik Berbeza", streak "Kombo", time_spent "Masa (min)". Rarity: common "Biasa", rare "Jarang", epic "Epik", legendary "Legenda". Cash status labels: PENDING "Menunggu", APPROVED "Diluluskan", PROCESSING "Dalam Proses", PAID "Dibayar", REJECTED "Ditolak". Redemption status: PENDING "Menunggu", PROCESSING "Diproses", DELIVERED "Dihantar", CANCELLED "Dibatal". Teacher reward category: general "Am", digital "Digital", physical "Fizikal", voucher "Baucar". Banks (S20, 24 + placeholder): discovery A.6.

### 6.10 Named count queries (every displayed count cites one)

| Query | Definition | Seed value | Screens |
|---|---|---|---|
| Q-WALLETS | wallet rows | **2,255** | S1 "Pelajar Aktif", S4 total, tier bar widths |
| Q-TIER(key) | wallets with `tierKey` = key | bronze **1,889**, silver **292**, gold **41**, platinum **33** | S1 distribution, S4 `?tier=` |
| Q-SYILING-DIJANA | Σ `totalSyilingEarned` over wallets | **3,124,192** | S1 |
| Q-TX(type?, from?, to?) | ledger rows | all **52,964**; earn **52,426**; convert **535**; spend **1**; bonus **2**; refund **0** | S5 totals and pager |
| Q-CONVERSIONS | ledger rows with source `token_conversion` | **534** | S1 "Penukaran" |
| Q-TOKENS-CONVERTED | Σ `tokens` over Q-CONVERSIONS | **7,801** | S1 "Token Ditukar" |
| Q-CHALLENGES-ACTIVE | active challenges | **10** | S1, S3 "Senarai Cabaran (10)" (all rows), S13 denominator |
| Q-DAILY-FINISHERS | distinct users whose ChallengeCompletion rows dated today cover every active challenge (INFERRED; a count of completion rows would give 11 at the project clock against the observed 0) | **0** at the project clock (pelajar 7/10, pelajarmaju 4/10) | S1 "Siap Hari Ini" |
| Q-LEADERBOARD | BR-M14-17, top 50 | #1 1,018,083 … #50 2,930 | S14, S1 Top 10 |
| Q-ACH-UNLOCKED(user) | UserAchievement rows | admin **0** | S15 "{n}/25" |
| Q-REFERRALS(user) | BR-M14-19 | admin **0 / 0 / 0** | S16 |
| Q-TEACHER-BADGES / -ACTIVE | badges / active badges | **8 / 8** | S6 "Lencana", "Lencana Guru (8)", S19 "7/8" denominator |
| Q-TEACHER-REWARDS / -ACTIVE | catalogue rows / active | **0 / 0** | S6 cards, "Katalog Ganjaran (0)" |
| Q-TEACHER-REDEMPTIONS(status) | redemptions | **0** each | S6 "Tebusan Pending", S7 |
| Q-CASH(status) / Q-CASH-PAID-RM | requests / Σ cash of PAID | PENDING **2**, others **0** / **RM0.00** | S8 cards, S6 badge "2" |
| Q-RC-CLAIMS(year) | BR-M14-31 | **RM0.00 / 0 / 0** | S10 tiles |
| Q-TEACHER-LB(tab, viewer) | BR-M14-28 | 50 rows | S22 |

### 6.11 Seed and dataset spec

#### 6.11.1 Dataset spec (format of M02 §6.15 / M10 §6.2.1)

| Store | Kind | Total / cells | Id range and anchors | Runtime | Evidence |
|---|---|---|---|---|---|
| `wallets` (StudentWallet) | **D11 virtual dataset** | **2,255** rows; facet `tierKey`: bronze 1,889 · silver 292 · gold 41 · platinum 33 (exact cells) | key = userId. **Anchors:** admin 1; designed 2 and 4 (§6.11.3); **M14 fixture students 4001–4108** (108 rows from the snapshot, table §6.11.4; registered in the M02 users dataset, XR-M14-05). Generated rows take the userIds of M02 generated `student` users (deterministic selection: role `student`, the M01 generated e-mail pattern `pelajar{000000}@demo.test`, ascending id), never a user anchor of another module — **the full set the build excludes (v1.8, `OTHER_MODULE_USER_ANCHORS`):** 1–11 (1, 2, 4 are wallet anchors themselves), 1919, 2001–2060, 3001–3008, 3101–3109, 3151–3152, 3201–3215, 4001–4108 (wallet anchors themselves), 4201–4208, 4301–4358, 4401–4402, 4418, 4501–4504, 4644, 4664, 5001–5999 — those read defaults (BR-M14-02) unless listed as anchors here. The list is a hand-kept copy of the M02 placement table until M01 exposes `users.isAnchor(id)` (XR-M14-11); the e-mail pattern is a second guard (a user with another e-mail is never selected), and the prime fails the build if fewer than 2,255 eligible students remain. Exception: generated student **12** is placed on a generated bronze wallet with a pinned balance (ledger anchor owner, below). | a new wallet on first credit (overlay insert); counts rise | S4 pager "of 2255", tier filters; S1 cards |
| — generated attributes | derived per cell with constraints | `totalSyilingEarned`: gold ∈ [2,000, 2,884], silver ∈ [500, 1,933], bronze ∈ [0, 497]; **Σ over all 2,255 wallets = 3,124,192 exactly** (anchors fixed at 2,565,737 incl. admin 256, 2 → 370, 4 → 267; the 2,144 generated rows share 558,455 by a deterministic per-tier distribution with a largest-remainder repair pass; the build fails if infeasible — feasible range with the inclusive bounds 178,000–1,506,287 checked); `tokenBalance` of generated rows ∈ [0, 50]; `currentSyiling` ∈ [0, lifetime]; `level` 1–22 by tier band; `xp` ≥ 0; `createdAt` 2025-10-01 … 2026-09-20 (older than the page-113 anchors) | no generated row reaches the observed top pages: every generated gold / silver / bronze value is below the lowest anchor of its S4 page 1 and below S14 #50 (2,930) | — | snapshot pages 3–8, 24 |
| `coinLedger` (CoinTransaction) | **D11 virtual dataset** | **52,964** rows; facet `type`: earn 52,426 · convert 535 · spend 1 · bonus 2 · refund 0; within convert: `token_conversion` 534 · `token_convert` 1; spend: `reward_claim` 1; bonus: `streak_bonus` 2; earn sources split by the 400-row sample weights (daily_login 90, quiz_spm 127, quiz_practice 86, daily_challenge 51, jutawan_ilmu 14, mystery_box 6, spm 4, quiz_complete 4, mathrace_play 3, structured_question 2, papan_bijak 2, benteng_win 2, papan_bijak_win 1, benteng_play 1, perang_fakta_win 1; INFERRED weights, largest remainder) applied to **52,420** earn rows, plus two exact earn cells the sample does not cover but the anchors need (v1.8, INFERRED): **`legacy` 3** (the admin's three February rows, 140001–140003) and **`achievement` 3** (pelajarmaju's three "Pencapaian: …" rows, §6.11.3) — carved from the earn total, so earn 52,426, the type totals and 52,964 stay exact | 52,964 = 52,911 rows with live-range ids + 53 anchor rows with reserved ids. The 52,911 carry ids in 1–53,668 (757 ids unused, deterministic gaps); ids 53,669–53,678 belong to the 10 observed rows stored after the project clock, which are **not seeded** (clock treatment below) — 767 ids of 1–53,678 unused in all. **Anchors (live ids):** S5 page 1 at the clock (#53654–#53668), the S5 convert page 1 (25 rows #52427–#53663), #42 (spend), #51 and #44 (bonus), page 2118 (#15–#44 as listed). **Anchors (reserved ids 140001–140299, live ids unobserved):** admin 140001–140014, pelajar (2) 140101–140120, pelajarmaju (4) 140201–140219 (§6.11.3). | runtime rows from 9,000,001 (overlay) | snapshot pages 9–15, S17 |
| — generated attributes | derived | `createdAt` increases with id from 2026-02-11 to **2026-09-25 12:19** (so S5 page 1 at the clock starts with the 15 observed rows #53668–#53654; the 10 slots of the unseeded post-clock rows are ordinary generated earn rows — 4 `quiz_spm`, 6 `daily_login` as the observed cells — dated before 12:19); the 14 rows older than #15 (page 2119) are 11 generated rows + the admin's 3 February rows; game sources dated ≤ 2026-05-25; `amount` per source from the sample (e.g. daily_login +2, quiz_spm = correct 1–40, daily_challenge = a challenge reward); Σ `tokens` over the 509 generated `token_conversion` rows = **7,721** (7,801 − the 80 of the 25 anchors), each `amount` = −tokens × a tier rate; `balanceAfter` ≥ 0; `userId` = a wallet user (generated wallets and generated rows are independent facets: a generated user's wallet balance is not recomputed from generated rows; per-user reconciliation holds for the admin, 2, 4 and runtime writes); generated rows never belong to 1, 2, 4 or to an owner of an observed live-id row (ledger anchor owners, below; v1.8) | — | — | sample `ledgerSample` |
| Every other store | materialised | tiers 4, challenges 10, achievements 25, teacher badges 8, settings 10, syiling-priced rewards 11, cash requests 2, teacher wallets 12 (1, 5, 4201–4208 and three designed wallets: M02 fixture teacher 5316 and two generated active teachers, §6.11.5, v1.6) with ledgers, streaks, referral codes; teacher rewards / redemptions / draws / tickets / claims / referrals / referrals: 0; challenge completions and unlocked achievements only as §6.11.3 (the designed completions of accounts 2 and 4 and pelajarmaju's 3 achievements; the admin's historical completions) | table ids from the live values where shown (tiers 1–4, challenges 1–10, badges 1–8, rewards 1–11, cash 1–2); runtime ids of materialised tables continue after the highest seeded id (cash requests from 3, draws, teacher rewards and redemptions from 1; test fixtures use their own ids, e.g. 1001), so the PROPOSED rows "Tebus Tunai #3" and draw "#1" follow | — | discovery §2 |

**Clock treatment (AUD-M14-03; Delivery Lead: one project clock `2026-09-25T15:40:00+08:00` for every module and build).** The snapshot was taken on 26/09 (about 11:45 MYT); 10 observed ledger rows are stored after the project clock: #53669 16:11, #53670 16:36, #53671 22:13, #53672 22:45, #53673 22:45 (25/09), #53674 01:16, #53675 02:08, #53676 03:28, #53677 03:30, #53678 03:32 (26/09) — all `earn` (4 `quiz_spm`: #53678, #53677, #53676, #53673; 6 `daily_login`: #53675, #53674, #53672, #53671, #53670, #53669); their observed values are recorded here and in the snapshot. **Chosen:** they are not seeded; each takes an ordinary generated slot of its own cell dated before the clock, so every observed total and cell (52,964; earn 52,426; convert 535 / 534 / 7,801; the wallet dataset, which is independent) stays exact, S5 page 1 and S1 "Transaksi Terkini" show the observed rows up to #53668 (25/09 15:29) with relative times computed at the clock, and nothing shown is dated after "now". Alternatives: (a) seed them and show future dates with a clamped relative time — rejected: rows dated after the clock contradict the clock; (b) move the project clock to 26/09 03:45 — rejected by the Delivery Lead (one fixed clock for all modules); (c) shift their timestamps before the clock — rejected: alters observed values; (d) drop them and lower the totals — rejected: alters 52,964 / 52,426. Page-2118 anchors keep the observed order by seconds (#20 before #21, #18 before #19). The designed completions of 25/09 (pelajar 7/10, pelajarmaju 4/10) stay; "Siap Hari Ini" counts users who finished every active challenge (Q-DAILY-FINISHERS = 0, as observed).

**Ledger anchor owners (v1.8, as built; INFERRED — the live rows show no user, the snapshot masks it).** Rules: (1) rows chain to one user when their balances chain (+2 → 5,810 then +3 → 5,813; 80 → 88 → 93 → 103; +2 → 401 then −400 → 1; the Papan Bijak chains of page 2118); (2) a row later than the newest generated row (25/09 12:19) is its owner's last row before the clock, so the owner's balance at the clock **equals** that row's "Baki" — such rows go only to wallets whose balance matches; (3) older convert chains keep an owner of a matching tier; (4) **generated rows never go to an observed-row owner** (their balances stay those of their observed rows).

| Live ids | Owner | Balance at the clock |
|---|---|---|
| #53668 | 4021 | designed 1,058 (§6.11.4) |
| #53667 | 4022 | designed 17 |
| #53666, #53665 | 4023 | designed 5,813 |
| #53664 | 4024 | designed 5 |
| #53663, #53662 (bronze conversion 400 → 8, rate 50) | **generated student 12** (M01 pattern `pelajar000012@demo.test`, not an anchor; placed on the first generated bronze wallet key by swap, balance pinned to **1**; the prime fails the build if 12 stops being a generated student) | designed 1 (= #53663 "Baki") |
| #53661 | 4004 | 129 (observed; matches) |
| #53660 | 4046 | 3,010 (observed; matches) |
| #53659, #53658, #53656, #53655 | 4026 | designed 103 |
| #53657 | 4025 | designed 897 |
| #53654 | 4027 | designed 752 |
| #53521, #53520 | 4017 | 14 observed (row "Baki" 12, 22/09) |
| #53189 | 4029 | designed 5,424 |
| #52790–#52804 | 4014 | 692 observed (last row "Baki" 8, 14/09) |
| #52663, #52662 | 4028 | designed 154 |
| #52427–#52430 | 4036 | 977 observed (last row "Baki" 30, 09/09) |
| #42 | 4075 | 484 observed (row "Baki" 365, 28/02) |
| #51 | 4077 | 470 observed (row 140, 27/02) |
| #44 | 4079 | 422 observed (row 445, 27/02) |
| page 2118 (#15–#39) | 4080 and 4081 (two Papan Bijak chains) | 473 / 473 observed (last rows 85 / 123, 26/02) |

**Designed balances.** The S14 anchors 4021–4029 show only lifetime, level and title on live; their balances were "gen." and are now **designed (= "Baki" of the owned observed row)**: 1,058 / 17 / 5,813 / 5 / 897 / 103 / 752 / 154 / 5,424, each ≤ its lifetime (10,552 / 8,720 / 8,328 / 7,845 / 7,807 / 6,792 / 6,435 / 5,873 / 5,832); student 12 → 1. No observed value changes; Σ lifetime and every tier cell are unchanged (balances are not totalled by any query). **Alternatives:** (a) leave 4021–4029 generated and accept that S4 (balance column) and S17 (the owner's own history) contradict the observed "Baki" of rows on S5 page 1 — rejected: a visible contradiction on the first page; (b) put the rows on generated users — rejected for the rows whose balance can be designed on a platinum anchor (the lifetimes fit the chains and keep the rows on observed top-page users), accepted only for #53662 / #53663, which need a **bronze** owner with balance 1 that no bronze anchor has (every bronze anchor balance is observed). **Accepted residual mismatches** (older rows followed by later unobserved activity; SQ-M14-04): 4017 balance 14 vs #53521 "Baki" 12; 4014 692 vs #52804 "Baki" 8; 4036 977 vs #52430 "Baki" 30; and the February owners 4075, 4077, 4079, 4080, 4081, whose observed balances at the clock differ from their February "Baki" values (484 vs 365; 470 vs 140; 422 vs 445; 473 vs 85; 473 vs 123) — the rows between are generated-history gaps that are not reconciled per user.

#### 6.11.2 Admin mirror (every value observed)

| Store | Admin (id 1) |
|---|---|
| Wallet | 256 / lifetime 256 / tokens 0 / xp 8 / level 2 / bronze (Gangsa) / createdAt 2026-02-11 05:23 |
| Ledger (ids 140001–140014, oldest first) | 11/02/2026 05:23 "Cabaran Kilat: 3 betul, combo 2x" +4 (4) · 19/02/2026 21:47 "Betul/Salah: 3 betul, streak 2" +4 (8) · 19/02/2026 23:12 "One-time sync: transfer missing coins from legacy student_coins table" +35 (43) · 11/05/2026 14:22 "Latih Tubi SPM: 14 betul — 35%" +42 (85) · 14:22 "Streak activity (spm)" +7 (92) · 14:22 "Cabaran selesai: Mula Hari Ini" +10 (102) · 14:22 "Cabaran selesai: Kilat Matematik" +30 (132) · 14:22 "Cabaran selesai: Jawab 5 Betul" +12 (144) · 14:27 "Latih Tubi SPM: 11 betul — 32.35%" +22 (166) · 14:27 "Cabaran selesai: Rajin Berlatih" +15 (181) · 14:27 "Cabaran selesai: Cabaran Kilat" +40 (221) · 19/05/2026 03:26 "SPM Tahun Lepas: 1 betul — 20%" +3 (224) · 03:26 "Streak activity (spm)" +7 (231) · 03:26 "Cabaran selesai: Penjelajah Topik" +25 (256). All `earn`; sources: the three February rows `legacy` (their live source keys were not shown; the first two read like M16 game rows), then `quiz_spm`, `spm`, `daily_challenge` |
| Streak | current 1, best 5, lastActivityDate 2026-05-19 |
| Achievements / referral | 0 unlocked / code "4JURJTT", 0 referrals |
| Challenge completions | 11/05/2026: 5, 4, 6, 1, 10; 19/05/2026: 3 (history only; none today) |
| Teacher wallet | balance 92,683, totalEarned 92,683, questionsCount **20,719**, badges 1–7 awarded 2026-03-21 23:02; 18 rows (discovery A.4, newest first): "SPM Tahun Lepas - 0% ketepatan" 19 May 2026 03:49 0 · "Aktiviti harian: spm" 03:26 +7 · "SPM Tahun Lepas - 20% ketepatan" 03:26 +1 · "Latih Tubi SPM - 32.35% ketepatan" 11 May 14:27 +11 · "Aktiviti harian: spm" 14:22 +7 · "Latih Tubi SPM - 35% ketepatan" 14:22 +14 · the 7 "Badge: …" rows 21 Mar 2026 23:02 (+50,000, +25,000, +10,000, +5,000, +2,000, +500, +100) · "Latihan - 100% ketepatan" 19 Feb 22:48 +20 · 22:39 +15 · "Latihan - 20% ketepatan" 22:27 +2 · "Latihan - 30% ketepatan" 22:23 +3 · "Latihan - 60% ketepatan" 06 Feb 2026 16:26 +3 (Σ 92,683) |
| Cash requests | none of the admin's |

#### 6.11.3 Designed accounts (replayed through BR-M14-03/12/13/14 from the M05 §6.12 sessions; values computed, not typed)

| Account | Wallet | Ledger rows (ids, oldest first) | Streak | Completions |
|---|---|---|---|---|
| `pelajar@demo.test` (2) | 370 / lifetime 370 / tokens 0 / xp 916 (10 × 70 correct + 216 challenge XP) / level 1 / bronze / title Pelajar | 140101–140120: 22/09 19:00 "SPM Tahun Lepas: 4 betul — 40%" +4, "Streak activity (spm)" +7, "Cabaran selesai: Mula Hari Ini" +10 · 24/09 20:15 "Latih Tubi SPM: 26 betul — 76.47%" +26, "Streak activity (spm)" +7, Kilat Matematik +30, Mula Hari Ini +10, Jawab 5 Betul +12, Cabaran Kilat +40 · 20:40 "SPM Tahun Lepas: 6 betul — 60%" +6, Latihan 10 Minit +20 · 25/09 08:30 "Ramalan SPM: 34 betul — 85%" +34, "Streak activity (spm)" +7, Si Tepat +20, Kilat Matematik +30, Mula Hari Ini +10, Jawab 5 Betul +12, Latihan 10 Minit +20, Kombo 2 Hari +25, Cabaran Kilat +40 (Baki 370) | 2 / 2 / 2026-09-25 | 22/09: 5 · 24/09: 4, 5, 6, 10, 7 · 25/09: 2, 4, 5, 6, 7, 8, 10 |
| `pelajarmaju@demo.test` (4) | 267 / lifetime 267 / tokens 0 / xp 432 (10 × 26 + 159 challenge XP + 13 achievement XP) / level 3 (M05) / bronze / title Permulaan | 140201–140219: 23/09 16:10 "Latih Tubi: 8 betul — 80%" +8, Si Tepat +20, Mula Hari Ini +10, Jawab 5 Betul +12, "Pencapaian: Langkah Pertama" +5 (55) · 24/09 17:05 "Latih Tubi: 9 betul — 90%" +9, Si Tepat +20, Mula Hari Ini +10, Jawab 5 Betul +12, Kombo 2 Hari +25, Ketepatan 90% +35, "Pencapaian: Pengumpul Syiling" +10 (lifetime 166; 176) · 25/09 09:15 "Latih Tubi: 6 betul — 60%" +6, Mula Hari Ini +10, Jawab 5 Betul +12, Kombo 2 Hari +25, "Pencapaian: Streak 3 Hari" +10 (239) · 10:00 "Latih Tubi: 3 betul — 42.86%" +3, Penjelajah Topik +25 (Baki 267) | 3 / 3 / 2026-09-25 | 23/09: 2, 5, 6 · 24/09: 2, 5, 6, 8, 9 · 25/09: 5, 6, 8, 3; achievements 1 (23/09), 5 (24/09), 3 (25/09) |
| `pelajar2@demo.test` (3), `tidakaktif` (11) | no row → defaults | — | 0 / 0 | — |
| `guru@demo.test` (5) | no student wallet (defaults); **teacher wallet** balance 0, totalEarned 0, questionsCount **1** (the M10 contribution 700302, M10 §6.11) | — | 0 / 0 | — |

Referral codes of 2–11: deterministic 7-character codes (BR-M14-18). Achievements: the replay applies BR-M14-16 after each practice-mode session (pelajarmaju above); pelajar's sessions are SPM modes, so none. The runtime unlock is exercised on pelajar2 (AC-M14-14.1).

#### 6.11.4 Wallet anchors 4001–4108 (fictitious students; values from the snapshot; "gen." = generated within the constraints above)

The rows of S4 page 1 (platinum = default sort), the tier-filter pages 1 (silver, gold, bronze), S14 ranks 21–33 (platinum, lifetime, level and title only) and S4 page 113 (the last 15 rows; their `createdAt` is the newest of all wallets so they sort last among equal lifetimes). Names and e-mails are generated by M02 (fictitious). **v1.8:** the balances of 4021–4029 are designed, each = the "Baki" of the last observed ledger row the user owns and ≤ its lifetime (owners, alternatives and accepted residual mismatches: §6.11.1 "Ledger anchor owners"); their tokens and XP stay "gen.".

| User id | Tier | Level | Syiling (balance) | Token | Jumlah Syiling (lifetime) | XP | Evidence |
|---|---|---|---|---|---|---|---|
| 4001 | platinum | 66 | 1,018,033 | 1 | 1,018,083 | 19,794 | S4 platinum p1 #1 |
| 4002 | platinum | 62 | 680,230 | 275 | 686,730 | 9,640 | S4 platinum p1 #2 |
| 4003 | platinum | 45 | 135,760 | 0 | 135,760 | 2,274 | S4 platinum p1 #3 |
| 4004 | platinum | 39 | 129 | 1764 | 65,129 | 55 | S4 platinum p1 #4 |
| 4005 | platinum | 37 | 60,245 | 0 | 60,305 | 205 | S4 platinum p1 #5 |
| 4006 | platinum | 36 | 57,083 | 0 | 57,783 | 1,915 | S4 platinum p1 #6 |
| 4007 | platinum | 37 | 26,737 | 0 | 54,937 | 1,316 | S4 platinum p1 #7 |
| 4008 | platinum | 33 | 44,093 | 0 | 44,093 | 1,811 | S4 platinum p1 #8 |
| 4009 | platinum | 30 | 31,864 | 11 | 32,084 | 889 | S4 platinum p1 #9 |
| 4010 | platinum | 30 | 30,269 | 0 | 30,269 | 282 | S4 platinum p1 #10 |
| 4011 | platinum | 29 | 29,902 | 1 | 29,942 | 1,441 | S4 platinum p1 #11 |
| 4012 | platinum | 28 | 25,178 | 0 | 25,178 | 491 | S4 platinum p1 #12 |
| 4013 | platinum | 26 | 20,223 | 0 | 20,223 | 284 | S4 platinum p1 #13 |
| 4014 | platinum | 24 | 692 | 327 | 15,792 | 875 | S4 platinum p1 #14 |
| 4015 | platinum | 23 | 15,264 | 0 | 15,264 | 475 | S4 platinum p1 #15 |
| 4016 | platinum | 22 | 13,913 | 0 | 14,053 | 609 | S4 platinum p1 #16 |
| 4017 | platinum | 23 | 14 | 34 | 12,934 | 670 | S4 platinum p1 #17 |
| 4018 | platinum | 21 | 12,256 | 0 | 12,256 | 278 | S4 platinum p1 #18 |
| 4019 | platinum | 21 | 11,732 | 0 | 11,732 | 116 | S4 platinum p1 #19 |
| 4020 | platinum | 20 | 10,734 | 0 | 10,734 | 259 | S4 platinum p1 #20 |
| 4021 | platinum | 20 | 1,058 designed (= "Baki" of #53668) | gen. | 10,552 | gen. | S14 #21 |
| 4022 | platinum | 19 | 17 designed (= "Baki" of #53667) | gen. | 8,720 | gen. | S14 #22 |
| 4023 | platinum | 18 | 5,813 designed (= "Baki" of #53666) | gen. | 8,328 | gen. | S14 #23 |
| 4024 | platinum | 17 | 5 designed (= "Baki" of #53664) | gen. | 7,845 | gen. | S14 #24 |
| 4025 | platinum | 17 | 897 designed (= "Baki" of #53657) | gen. | 7,807 | gen. | S14 #25 |
| 4026 | platinum | 16 | 103 designed (= "Baki" of #53659) | gen. | 6,792 | gen. | S14 #26 |
| 4027 | platinum | 15 | 752 designed (= "Baki" of #53654) | gen. | 6,435 | gen. | S14 #27 |
| 4028 | platinum | 14 | 154 designed (= "Baki" of #52663) | gen. | 5,873 | gen. | S14 #28 |
| 4029 | platinum | 15 | 5,424 designed (= "Baki" of #53189) | gen. | 5,832 | gen. | S14 #29 |
| 4030 | platinum | 14 | gen. | gen. | 5,639 | gen. | S14 #30 |
| 4031 | platinum | 15 | gen. | gen. | 5,625 | gen. | S14 #31 |
| 4032 | platinum | 14 | gen. | gen. | 5,501 | gen. | S14 #32 |
| 4033 | platinum | 14 | gen. | gen. | 5,440 | gen. | S14 #33 |
| 4034 | gold | 13 | 4,877 | 0 | 4,937 | 268 | S4 gold p1 #1 |
| 4035 | gold | 12 | 4,176 | 0 | 4,176 | 209 | S4 gold p1 #2 |
| 4036 | gold | 12 | 977 | 76 | 4,107 | 239 | S4 gold p1 #3 |
| 4037 | gold | 12 | 4,012 | 0 | 4,012 | 133 | S4 gold p1 #4 |
| 4038 | gold | 12 | 3,956 | 0 | 3,956 | 108 | S4 gold p1 #5 |
| 4039 | gold | 11 | 3,740 | 0 | 3,740 | 249 | S4 gold p1 #6 |
| 4040 | gold | 11 | 3,627 | 0 | 3,627 | 184 | S4 gold p1 #7 |
| 4041 | gold | 11 | 3,464 | 0 | 3,464 | 114 | S4 gold p1 #8 |
| 4042 | gold | 11 | 3,421 | 0 | 3,421 | 107 | S4 gold p1 #9 |
| 4043 | gold | 11 | 3,327 | 1 | 3,367 | 11 | S4 gold p1 #10 |
| 4044 | gold | 10 | 3,174 | 0 | 3,174 | 204 | S4 gold p1 #11 |
| 4045 | gold | 10 | 3,045 | 0 | 3,045 | 159 | S4 gold p1 #12 |
| 4046 | gold | 10 | 3,010 | 0 | 3,010 | 110 | S4 gold p1 #13 |
| 4047 | gold | 10 | 2,987 | 0 | 2,987 | 154 | S4 gold p1 #14 |
| 4048 | gold | 14 | 2,362 | 17 | 2,945 | 1,309 | S4 gold p1 #15 |
| 4049 | gold | 10 | 185 | 76 | 2,935 | 98 | S4 gold p1 #16 |
| 4050 | gold | 10 | 2,780 | 1 | 2,930 | 126 | S4 gold p1 #17 |
| 4051 | gold | 10 | 2,901 | 0 | 2,901 | 109 | S4 gold p1 #18 |
| 4052 | gold | 19 | 2,355 | 10 | 2,900 | 1,891 | S4 gold p1 #19 |
| 4053 | gold | 10 | 2,885 | 0 | 2,885 | 76 | S4 gold p1 #20 |
| 4054 | silver | 11 | 1,916 | 4 | 2,423 | 1,058 | S4 silver p1 #1 |
| 4055 | silver | 6 | 1,923 | -1 | 2,372 | 569 | S4 silver p1 #2 |
| 4056 | silver | 18 | 1,862 | 4 | 2,357 | 1,702 | S4 silver p1 #3 |
| 4057 | silver | 13 | 1,873 | 12 | 2,341 | 1,205 | S4 silver p1 #4 |
| 4058 | silver | 13 | 1,818 | 18 | 2,170 | 1,203 | S4 silver p1 #5 |
| 4059 | silver | 14 | 1,995 | 10 | 2,160 | 1,336 | S4 silver p1 #6 |
| 4060 | silver | 15 | 1,910 | 16 | 2,125 | 1,403 | S4 silver p1 #7 |
| 4061 | silver | 5 | 1,862 | 5 | 2,103 | 409 | S4 silver p1 #8 |
| 4062 | silver | 8 | 1,717 | -1 | 2,072 | 769 | S4 silver p1 #9 |
| 4063 | silver | 8 | 1,607 | 17 | 2,055 | 713 | S4 silver p1 #10 |
| 4064 | silver | 22 | 1,588 | 11 | 2,043 | 2,136 | S4 silver p1 #11 |
| 4065 | silver | 5 | 1,852 | 5 | 2,010 | 478 | S4 silver p1 #12 |
| 4066 | silver | 14 | 1,767 | 11 | 2,001 | 1,313 | S4 silver p1 #13 |
| 4067 | silver | 16 | 1,801 | 6 | 1,993 | 1,587 | S4 silver p1 #14 |
| 4068 | silver | 7 | 1,990 | 0 | 1,990 | 168 | S4 silver p1 #15 |
| 4069 | silver | 8 | 1,979 | 0 | 1,979 | 23 | S4 silver p1 #16 |
| 4070 | silver | 10 | 1,811 | 6 | 1,966 | 904 | S4 silver p1 #17 |
| 4071 | silver | 19 | 1,680 | 0 | 1,959 | 1,848 | S4 silver p1 #18 |
| 4072 | silver | 8 | 1,948 | 0 | 1,948 | 5 | S4 silver p1 #19 |
| 4073 | silver | 9 | 1,643 | -3 | 1,934 | 895 | S4 silver p1 #20 |
| 4074 | bronze | 5 | 496 | 15 | 609 | 481 | S4 bronze p1 #1 |
| 4075 | bronze | 3 | 484 | 0 | 581 | 241 | S4 bronze p1 #2 |
| 4076 | bronze | 5 | 498 | -2 | 567 | 497 | S4 bronze p1 #3 |
| 4077 | bronze | 2 | 470 | 17 | 561 | 187 | S4 bronze p1 #4 |
| 4078 | bronze | 5 | 461 | 15 | 548 | 459 | S4 bronze p1 #5 |
| 4079 | bronze | 2 | 422 | 0 | 545 | 143 | S4 bronze p1 #6 |
| 4080 | bronze | 3 | 473 | 10 | 537 | 237 | S4 bronze p1 #7 |
| 4081 | bronze | 3 | 473 | 5 | 534 | 246 | S4 bronze p1 #8 |
| 4082 | bronze | 4 | 444 | 15 | 531 | 345 | S4 bronze p1 #9 |
| 4083 | bronze | 1 | 468 | 12 | 527 | 95 | S4 bronze p1 #10 |
| 4084 | bronze | 3 | 478 | 6 | 526 | 234 | S4 bronze p1 #11 |
| 4085 | bronze | 4 | 459 | 3 | 525 | 339 | S4 bronze p1 #12 |
| 4086 | bronze | 2 | 422 | 7 | 520 | 127 | S4 bronze p1 #13 |
| 4087 | bronze | 5 | 459 | 6 | 514 | 430 | S4 bronze p1 #14 |
| 4088 | bronze | 2 | 454 | -2 | 512 | 167 | S4 bronze p1 #15 |
| 4089 | bronze | 3 | 491 | 4 | 510 | 255 | S4 bronze p1 #16 |
| 4090 | bronze | 1 | 497 | 12 | 507 | 90 | S4 bronze p1 #17 |
| 4091 | bronze | 2 | 400 | 15 | 504 | 111 | S4 bronze p1 #18 |
| 4092 | bronze | 3 | 498 | 0 | 498 | 35 | S4 bronze p1 #19 |
| 4093 | bronze | 3 | 498 | 0 | 498 | 33 | S4 bronze p1 #20 |
| 4094 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2241 |
| 4095 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2242 |
| 4096 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2243 |
| 4097 | bronze | 1 | 0 | 17 | 0 | 16 | S4 page 113 row 2244 |
| 4098 | bronze | 1 | 0 | 11 | 0 | 13 | S4 page 113 row 2245 |
| 4099 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2246 |
| 4100 | bronze | 1 | 0 | 0 | 0 | 16 | S4 page 113 row 2247 |
| 4101 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2248 |
| 4102 | bronze | 1 | 0 | -1 | 0 | 3 | S4 page 113 row 2249 |
| 4103 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2250 |
| 4104 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2251 |
| 4105 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2252 |
| 4106 | bronze | 1 | 0 | -1 | 0 | 21 | S4 page 113 row 2253 |
| 4107 | bronze | 1 | 0 | 9 | 0 | 9 | S4 page 113 row 2254 |
| 4108 | bronze | 1 | 0 | 0 | 0 | 0 | S4 page 113 row 2255 |

#### 6.11.5 Catalogue seeds (live ids and values)

- **Tiers 1–4:** discovery §2.2 table exactly (Gangsa 🥉 #cd7f32 0 / 50 / 1; Perak 🥈 #c0c0c0 500 / 40 / 2; Emas 🥇 #ffd700 2000 / 30 / 3; Platinum 💎 #e5e4e2 5000 / 20 / 4; L1–L5 1–5, PKSK 5, Papan Bijak 5 / 25 each; the perks lists as observed); all active.
- **Challenges 1–10:** discovery §2.3 values (titles, descriptions, icons, targets, rewards, difficulty, sort order), with `challengeType` per DV-M14-04 (1 quiz_count, 2 accuracy, 3 topic_variety, 4 quiz_count, 5 quiz_count, 6 quiz_count, 7 time_spent, 8 streak, 9 accuracy, 10 quiz_count) and the metrics of BR-M14-12; all active.
- **Achievements 1–25:** discovery §2.15 table in live order (icon, name, description, rarity, syiling, XP; progress targets 1, 10, 50, 200, 500 on ids 1, 2, 4, 10, 12).
- **Teacher badges 1–8:** discovery §2.6 (Penyumbang Baru `fa-seedling` 10 / 100 … Legenda Terulung `fa-crown` 50,000 / 250,000); all active.
- **Settings:** coins_per_question 10, cash_rate_coins 10, cash_rate_sen 8, min_cash_withdrawal 100, cash_withdrawal_enabled 1, reward_budget_sen_session 1000, reward_budget_sen_month 300, current_session_year 2026, flat_quiz_reward 1, games_award_syiling 0 (labels as S9, DV-M14-05 on row 2).
- **Syiling-priced rewards 1–11:** discovery §2.10 (Baucar Buku RM10 VOUCHER 500 / 1000 … testing PHYSICAL 100 / 1000).
- **Cash requests:** id 1 — teacher **4208**, 163,445 syiling, RM1,307.56, Maybank, account "5140 2233 8819" / holder "Cikgu Demo Tunai Dua" (fictitious, shown masked), PENDING, 2026-04-14 23:04; id 2 — teacher **4207**, 18,140, RM145.12, Bank Rakyat, "2201 7788 1100" / "Cikgu Demo Tunai Satu", PENDING, 2026-04-15 13:15.
- **Teacher wallets (S22 and S8 anchors, fictitious teachers 4201–4208 registered by M02, XR-M14-05):** 4201 questionsCount 3,906 / balance 20,720; 4202 1,559 / 0; 4203 256 / 0; 4204 1 / 10; 4205 0 / 110; 4206 0 / 2; 4207 0 / 18,140; 4208 0 / 163,445 (the last two are **designed (unobserved)**: their requested coins, the minimum that lets the live PENDING requests exist; held, so "Boleh Ditebus" 0; both are **inactive** teachers, placed by M02 v1.12 as school 8277's two inactive teachers, so they fall outside M17's active-teacher total — XL3-14). 4201 and 4203–4206 are active teachers at 8082 (M02 v1.12); **4202 is at 8087** SMK JALAN REKO (M02 v1.25) — it is the observed M17 Guru-tab row `<teacher:137>` (497 MCQ + 1,062 Struktur = its 1,559, Syiling 0, login 04/06/2026 05:47). **Three designed wallets** on active teachers outside the fixture schools, Σ 42,617 (v1.6, XL3 B-01): **5316** (M02 v1.24 fixture teacher, no school, never logged in = the observed M17 Guru-tab row `<teacher:101>`, "Syiling" 42,600 **OBSERVED**): balance **42,600**, totalEarned 42,600, `questionsCount` **0** (its 5,547 M04 contributions are imported rows, not `onQuestionContributed` events; with 0 it stays out of S22's 50 rows, where no row shows 42,600); and the two highest-id generated active teachers with `questionsCount` 0: balances **9** and **8** (designed, unobserved; the rest of the observed 63,459). All three rank after every observed zero-question row by user id, so they never enter S22's 50 rows. Σ balance over active non-fixture teachers = 20,720 + 0 + 0 + 10 + 110 + 2 + 42,600 + 9 + 8 = **63,459** = M17 Q-M17-TEACHER-COINS (teacher 5 at fixture school 900001 and the admin are outside T). No ledger rows (unobserved). The S22 tie order among zero-question teachers is not asserted (it differs between the live tabs).
- **Learner badges (DATA-M14-20):** 1 "Pemula Rajin" `fa-seedling`, 2 "Pelajar Aktif" `fa-running`, 3 "Pengumpul" `fa-coins` (OBSERVED on M08 S6); holdings: M08 designed student 3201 holds 1–3 (M08 AC-M08-15.5).
- **Clock:** the single project clock `2026-09-25T15:40:00+08:00` for every seed value and every scenario (§6.11.1 clock treatment).

#### 6.11.7 Streak anchors for M18 and M17 (XL3-15; pupils fictitious, ids as placed by M02 v1.12 / M18 §6.11)

| School | Kombo-active pupils (`current` > 0) | Rows | Observed mean |
|---|---|---|---|
| 8765 | 18 | designed, Σ current 148 | 8.2 |
| 8880 | 14 | top-10 exact (current / best): 13/16, 13/13, 12/20, 11/16, 8/14, 8/10, 7/16, 6/16, 6/12, 4/8; 4 more at 1 / 1 | 6.4 (seed gives 6.6 — XR-M14-10) |
| 2700 | 12 | designed, Σ 82 | 6.8 |
| 3160 | 12 | designed, Σ 112 | 9.3 |
| 8767 | 11 | designed, Σ 58 | 5.3 |
| 8772 | 10 | designed, Σ 64 | 6.4 |
| 2710 | 4 | designed, Σ 30; two pupils with `totalDays` 13 and 4 | 7.5 |
| 7780 | 15 | top-10 exact: 15/16, 14/23, 12/18, 12/14, 10/20, 9/18, 8/16, 8/9, 7/15, 7/11; 5 more at 1 / 1 | 7 (seed gives 7.1 — XR-M14-10) |
| school 1 | 14 | first 10/19, tenth 4/9, others designed; Σ 69 | 4.9 |

KLUANG = 81 active; BATANG PADANG = 29. Every other anchor pupil of these schools has `current` 0 and `totalDays` 0; "designed" rows keep `best` ≥ `current`. M17: pupil **2022** streak `current` 1 (M17 S7). No badge or achievement of an M17 pupil is dated September 2026 (pelajarmaju, account 4, is at fixture school 900004 "SK Demo Bestari" per M02 v1.16, outside the M11 and M17 populations, so her designed unlocks are outside M17's scope).

#### 6.11.6 Test-only fixtures (unobserved states; never in the default seed)

| Fixture | Content | Used by |
|---|---|---|
| `m14-teacher-reward` | teacher reward 1001 "Baucar Buku RM20" (voucher, 200 syiling, stock 5, max 1 / user, active) | AC-30.2, 34.2, 35.2 |
| `m14-draw-open` | draw via `createDraw` (M15 fixture `draw`: "Cabutan Demo", 50, 10, placeholder pool, closes 2026-09-30, open) | AC-22.4, 40.2 |
| `m14-cash-flow` | none (created at runtime by AC-29.3) | AC-32.3, 36.3 |
| `m14-complimentary` | M02 fixture 5901 (`coinsEnabled` false) logged in with `setUser` | AC-18.3 |

### 6.12 Cross-module requests (to the owners; D12)

| # | Owner | Request |
|---|---|---|
| XR-M14-01 | M05 | (a) Replace the provisional wallet/streak store (`owner: 'M14'`) by the M14 repository (same names, §7.1); BR-31 step 6 calls `gamification.onSessionCompleted({userId, sessionId, mode, correct, total, timeSpent, completedAt, pointsEarned, coinsPerCorrect?})` and returns its result. (b) Move the quest catalogue §6.10 and BR-10 to M14: the S1 widget reads `challenges.today(userId)`; quest rewards are paid by M14 (BR-M14-13), not by M05. (c) Designed wallet values become the M14 replay: pelajarmaju coins **267**, points **432**, level 3, bar **100 %** with the text "432/120" where shown (was 340 / 120 / 3 / 40 %); pelajar coins **370**, points **916**, level 1, bar 100 %; admin unchanged (256 / 8 / 2 / 7 %). (f) Session coins: `onSessionCompleted` receives `coinsPerCorrect` = 3 for `mission` sessions (M05 BR-09) and returns the credited `coinsEarned`, which M05 S7 "Ganjaran Anda" shows through the #6 response only; the stored session `coinsEarned` stays the M05 BR-09 figure and may differ from the wallet credit, as on live (BR-M14-03; v1.8 note, F-26 G4). (g) *v1.8:* the read contract M14 uses is M05 §7.2 (`practice.history`, `practice.answers`, `practice.mastery`; §6.1 above); `onSessionCompleted` is idempotent per `sessionId` (DATA-M14-23) and M05 does not send `correctByLevel`. (d) The badge shelf (FR-M05-16) reads `learnerBadges.forUser` (empty for every seeded student except 3201). (e) A new test hook `mock.addSession(userId, {mode, correct, total, timeSpentSec, at})` that inserts one completed session without answers (the pager hook `addSessions` stays as it is; M13 `addAnswer` precedent), used by M14 `gamificationSession` (SQ-M14-05). |
| XR-M14-02 | M01 | (a) After a successful password login call `gamification.onLogin(userId, at)` (BR-M14-14; `setUser` fast login does not call it). (b) Keep FR-M01-18 (no referral field); on load of `/register?ref=`, keep the query code in memory/sessionStorage `pp.pendingRef` and send it as `referralCode` in the register request; after creating the user call `referrals.onRegistered(newUserId, referralCode)` (provisional). |
| XR-M14-03 | M08 | (a) DATA-M08-10: `koinTotal`, `syiling`, `streakCurrent`, `streakBest` and `badges` are read from M14 (`wallet.summary`, `streak.get`, `learnerBadges.forUser`), not seeded by M08; S6 "Koin" = `currentSyiling` (admin 256, was 342,703; the same value and word as the header chip "koin" on that page, so they never diverge after a conversion), S18 syiling = `currentSyiling` (256; tier progress "244 syiling lagi ke Silver", was 103 / 397), S18 activity streak and best from `streak.get` (admin 1 / 5, was 0 / 0) — DV-M14-08/09. (b) S20 "Koin" keeps BR-M08-28 (no change). (c) `practiceDays`, `lastPracticeAt`, `joinedAt`, `profileLevelId` stay M08-owned. (d) E2E-M08-17 "342,703" → "256"; E2E-M08-50 S18 values updated. |
| XR-M14-04 | M10 | (a) Call `teacherGamification.onQuestionContributed(teacherId, questionId)` after each objective or structured question created through M10 (BR-M14-23). (b) Optional single source (recommended: no change, the DISPLAY_CONSTANT 20,719 equals M14's value): S1 "Soalan" may read `teacherWallet.questionsCount` (admin 20,719 = the DATA-M10-11 constant; teacher 5 = 1, then 2 after the runtime create) instead of the display constant. (c) BR-M10-16 Command Center badges read DATA-M14-20. (d) `mission` sessions: closed — M05 BR-09 already passes 3 per correct (XL2-08). (e) Deleting a contribution never decrements `questionsCount` (BR-M14-23, provisional). |
| XR-M14-05 | M02 | Register as anchors of the users dataset (§6.15 B/C; no count changes): **4001–4108** role `student` (108 wallet anchors; placed by M02 v1.12 as active grade-11 rows at 8082 (40), 8078 (34) and 8106 (34)); **4201–4208** role `teacher` (placed by M02 v1.12: 4201–4206 active at 8082, 4207–4208 inactive at 8277; **v1.7: 4202 moved to 8087 by M02 v1.25**, = the observed M17 Guru row `<teacher:137>`); fictitious names and e-mails. |
| XR-M14-06 | M15 | Answers to XR-M15-01…08: see §6.13. Request: `mysteryBox.openingsCount(userId)` over Q-M15-OPENINGS-COUNT for the "Ahli Kotak Misteri" achievement (BR-M14-16). |
| XR-M14-07 | M16 | Report game results through `gamification.onGameResult(userId, {game, event, coins?, xp})` and show the returned `coinsCredited` (0 while `games_award_syiling` = 0; fixes D-M16-24) (BR-M14-21). |
| XR-M14-08 | M07 (+ M05 v1.12) | PKSK practice completes through M05 BR-31 with mode `pksk` (M05 v1.12); M14 credits it by the BR-M14-03 precedence (passed rate → flat reward → tier `pksk_reward_correct`), ledger source `quiz_pksk`, "PKSK: {n} betul — {pct}" (PROPOSED COPY). |
| XR-M14-10 | M18 | Name the D9 value for the Kombo means that M18's own top-10 rows cannot reproduce (8880 ≥ 6.6 vs 6.4; 7780 ≥ 7.1 vs 7; BATANG PADANG 6.1 vs "6"); M14 seeds the rows of §6.11.7 and will adjust only the designed rows once M18 decides. |
| XR-M14-09 | Global shell / M23 | Add the M14 menu entries (URS FN-M14-1.1.1–1.1.4), the header titles (FN-M14-1.1.5, DV-SH-03) and the chips from #1 (already in architecture §10). |
| XR-M14-11 | M01 (v1.8, open) | Expose `users.isAnchor(id)` (true for every user anchor of any module, from the M02 placement table) so that M14 stops keeping its hand copy of the exclusion list (§6.11.1) and the generated-student e-mail check. Until then a new anchor placed by another module must also be added to the M14 list; check item: pupil **4627** (M02 v1.26, class-1156 pupil at 8082) is not in the v1.8 build list — confirm that its row fails the generated e-mail pattern or add it (Perlu pengesahan). |
| XR-M14-12 | M02 (v1.8, open) | Expose `complimentary.coinsEnabled(userId)` (the per-student toggle of M02 #20, DATA-M02-09) as a repository read; M14 reads it at call time for BR-M14-03 and `canEarnSyiling` (BR-M14-21). Until then the build falls back to `isComplimentary` (§6.1), which is equal for the seed but ignores a runtime toggle change. |

### 6.13 Answers to M15 (XR-M15-01…08)

| M15 item | M14 answer |
|---|---|
| XR-M15-01 wallet read | **Accepted.** `GET /api/gamification/wallet` (#2) → `{data: {currentSyiling, tokenBalance, xp, level, …}}` (superset); admin 256 / 0 / 8 / 2 — matches M15's seed. |
| XR-M15-02 atomic writes | **Accepted** with M15's names: `debitTokens`, `creditTokens`, `creditSyiling`, `addXp`, `debitSyiling` (§7.1); refusal `INSUFFICIENT_BALANCE`, nothing written; no negative balance at runtime (BR-M14-30). Token movements go to the internal TokenMovement log only (the live coin ledger lists syiling only). Mystery-box syiling rows "Kotak Misteri: {name}", type `earn`, source `mystery_box`. |
| XR-M15-03 draws | **Accepted.** M14 owns Draw and DrawTicket (DATA-M14-18/19): `draws.listOpenDraws(today)`, `draws.ticketsOf(drawId, userId)`, `draws.buyTicket(drawId, userId)` (BR-M14-29): refusals `DRAW_CLOSED`, `TICKET_LIMIT`, `INSUFFICIENT_BALANCE` (M15 v1.1 names), on success one ticket, the syiling debit and the row "Tiket Cabutan: {title}" (source `cabutan_ticket`). |
| XR-M15-04 shop source / legacy catalogue | **Ownership decided:** the 11-item syiling-priced catalogue is M14's (DATA-M14-17): its only admin screen is M14 S10 and its only claim trace (#42 "Tuntut: Lencana Super Learner" −100 = item 7 at its syiling price) is in the M14 ledger. **Shop source: closed by the user ("ikut macam mana ada sekarang", 2026-09-26)** — S5 replicates live and stays empty for every account; no shop catalogue source is modelled (M15 v1.3); no legacy claim endpoint is exposed. |
| XR-M15-05 conversion hint | M14's rate model is the tier `conversionRate` (OBSERVED in S12 and the ledger). The M15 hint "100 syiling = 1 token = RM1" states a rate no tier uses: a wrong label under D9. Recommended minimal fix for M15: "1 token = RM1" (drop "100 syiling = "). M15 owns that DV. |
| XR-M15-06 budget | **No** for hadiah redemptions (INFERRED): the RM10 / RM3 limits are in "nilai-kos" sen, the unit of the syiling-priced catalogue's `cost_value_sen` on the same S10 page; they apply to that catalogue's claims, which are not built (OQ-M14-05 closed). M15 applies none — consistent. |
| XR-M15-07 S10 counters | **No M15 dependency:** the tiles count claims of the syiling-priced catalogue (BR-M14-31), not hadiah redemptions (INFERRED; OQ-M14-05 closed). |
| XR-M15-08 hooks | **Accepted:** `setWallet(userId, {syiling?, tokens?, xp?})`, `getWallet(userId)`, `ledger(userId)`, `createDraw({...})` (§6.14). |

### 6.14 Test hooks (dev/test builds only)

Global hooks of architecture §6.13. **M14 module hooks:** `setWallet(userId, {syiling?, tokens?, xp?, level?, tierKey?})` (sets fields directly and writes **no** ledger row — test fixtures only), `getWallet(userId)` (the summary of #2), `ledger(userId, {type?})` (rows newest first), `createDraw({title, description?, ticketCostSyiling?, maxTicketsPerStudent?, prizePool?, closesAt, openNow?})` (returns the draw), `setStreak(userId, {current, best, lastActivityDate})`, `setTeacherWallet(userId, {balance?, questionsCount?})`, `gamificationSession(userId, {mode, correct, total, timeSpentSec, at?})` (inserts one completed session through the requested M05 hook `mock.addSession` — no answers, so the chapter metric adds nothing — and then runs `onSessionCompleted` exactly as BR-31 does; for M14 E2E without driving the quiz UI), `gameResult(userId, {game, event, coins?, xp})` (returns `{coinsCredited, xpAdded}`). Fixture loader `m14LoadFixture(name)` (§6.11.6).

---

## 7. Mock API endpoints

*(solution-architect)* Base `/api`; envelope, error format and locale of SRS.md §7 (list meta extended with `from`, `to` as M01/M02). **S** = any logged-in user; **T** = role `teacher` or `admin`; **AD** = `admin`; guests 401, other roles 403 `FORBIDDEN`. Every mutating call runs in one mock transaction (BR-M14-30). Page routes keep the live URLs; the mock endpoints are the REST shape of the same actions (live forms post `_token`, the mock uses the session). Mock latency per architecture §6.13.

| # | Method | Path | Auth | Mut. | Request | Response | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/me/gamification-summary` | S | no | — | 200 `{data: {coins, points, streakDays}}` (= currentSyiling, xp, streak.current; architecture §10 contract kept) | 401 | header chips (server-rendered) |
| 2 | GET | `/api/gamification/wallet` | S | no | — | 200 `{data: {userId, currentSyiling, totalSyilingEarned, tokenBalance, xp, level, xpNeeded, levelProgressPct, tier: {key, labelMs, icon, color, minSyiling, conversionRate}, nextTier: {…}\|null, title: {name, emoji}, nextTitle: {name, emoji, threshold, need}\|null, earnedToday, earnedThisWeek, streak: {current, best, multiplier}}}` (XR-M15-01) | 401 | — |
| 3 | GET | `/api/gamification/dashboard` | S | no | — | 200 `{data: {wallet (#2), challenges: Challenge[4], recent: LedgerRow[6], mastery: [{level, subjectName, stage, correct, nextTarget, accuracy, multiplier}], tiers: Tier[] (active), }}` | 401 | GET `/gamification` |
| 4 | GET | `/api/gamification/transactions` | S | no | `type?` | 200 `{data: LedgerRow[] (all rows, newest first), meta: {currentSyiling, type}}`; LedgerRow = `{id, type, amount, balanceAfter, source, description, createdAt}` | 401 | GET `/gamification/history?type=` |
| 5 | GET | `/api/gamification/convert` | S | no | — | 200 `{data: {currentSyiling, tokenBalance, rate, tierLabel, quick: [rate, 5 × rate, currentSyiling], tiers: [{key, labelMs, icon, minSyiling, conversionRate, isMine}]}}` | 401 | GET `/gamification/convert` |
| 6 | POST | `/api/gamification/convert` | S | yes | `{syilingAmount: int}` | 200 `{data: {syilingDebited, tokensCredited, currentSyiling, tokenBalance, transactionId}}` | 422 `VALIDATION_ERROR` (BR-M14-10; message §8.2), 401 | POST `/gamification/convert` (`syiling_amount`) |
| 7 | GET | `/api/gamification/challenges` | S | no | — | 200 `{data: [{id, icon, title, description, difficulty, rewardSyiling, rewardXp, target, progress, pct, completed}], meta: {completed, active}}` | 401 | GET `/gamification/challenges` |
| 8 | GET | `/api/gamification/leaderboard` | S | no | any query ignored | 200 `{data: {podium: [{rank, userId, name, initials, totalSyilingEarned, tier}] (3), rows: [{rank, userId, name, initials, title, level, totalSyilingEarned, tierIcon}] (≤ 47)}}` | 401 | GET `/gamification/leaderboard` |
| 9 | GET | `/api/gamification/achievements` | S | no | `rarity?` | 200 `{data: {unlocked, total: 25, streak: {current, best, multiplier}, items: [{id, icon, name, description, rarity, rarityLabel, rarityColor, rewardSyiling, rewardXp, progress: {value, target}\|null, unlocked, unlockedAt}]}}` (unknown rarity → `items: []`) | 401 | GET `/gamification/achievements?rarity=` |
| 10 | GET | `/api/gamification/share-cards` | S | no | — | 200 `{data: {name, initial, profileUrl, profile: {answered, accuracy, sessions, tierKey, tierIcon, level, currentSyiling}, kombo: {current, best, multiplier}, mastery: [{subjectName, level, stage, accuracy, correct}], ranking: {accuracy, correct, answered}}}` | 401 | GET `/gamification/kad-kongsi` |
| 11 | GET | `/api/gamification/referral` | S | no | — | 200 `{data: {code, rewardReferrer: 50, rewardReferee: 25, registerUrl, whatsappUrl, telegramUrl, stats: {referrals, rewarded, syilingEarned}}}` | 401 | GET `/gamification/referral` |
| 12 | GET | `/api/guru/gamification` | T | no | — | 200 `{data: {balance, totalEarned, questionsCount, coinsPerQuestion, badges: [{id, name, icon, threshold, bonusCoins, earned}], badgesEarned, badgesActive, nextBadge: {…, need}\|null, catalogue: TeacherReward[] (active), transactions: [{id, description, amount, createdAt}]}}` | 401, 403 | GET `/guru/gamifikasi` |
| 13 | GET | `/api/guru/gamification/cash` | T | no | — | 200 `{data: {balance, available, held, cashValue, minWithdrawal, maxWithdrawal, rateCoins, rateSen, enabled, banks: string[25], history: [{id, coins, cash, bankName, status, createdAt}]}}` | 401, 403 | GET `/guru/gamifikasi/tebus-tunai` |
| 14 | POST | `/api/guru/gamification/cash` | T | yes | `{coinsAmount, bankName, bankAccount, accountHolder}` | 201 `{data: {id, coins, cash, bankName, bankAccountMasked, status: 'PENDING', createdAt}}` | 422 (BR-M14-26), 403 `CASH_DISABLED`, 401 | POST `/guru/gamifikasi/tebus-tunai` |
| 15 | GET | `/api/guru/gamification/shop` | T | no | — | 200 `{data: {balance, available, rewards: TeacherReward[] (active)}}` | 401, 403 | GET `/guru/gamifikasi/kedai` |
| 16 | POST | `/api/guru/gamification/shop/:rewardId/redeem` | T | yes | — | 201 `{data: TeacherRedemption}` (PROPOSED) | 404, 409 `OUT_OF_STOCK` / `LIMIT_REACHED` / `INSUFFICIENT_BALANCE`, 401, 403 | unknown (no item on live) |
| 17 | GET | `/api/guru/gamification/leaderboard` | T | no | `tab=sekolah\|global` (other → sekolah) | 200 `{data: {tab, rows: [{rank, userId, name, schoolName?, questions, syiling}] (≤ 50)}}` | 401, 403 | GET `/guru/gamifikasi/leaderboard?tab=` |
| 18 | GET | `/api/admin/gamification/overview` | AD | no | — | 200 `{data: {cards: {activeStudents, syilingGenerated, tokensConverted, conversions, activeChallenges, completedToday}, tierDistribution: [{key, count, pct, color}], top10: [{rank, name, tierKey, level, totalSyilingEarned}], recent: [{name, type, amount, source, createdAt}] (10)}}` | 401, 403 | GET `/admin/gamification` |
| 19 | GET | `/api/admin/gamification/tiers` | AD | no | — | 200 `{data: Tier[]}` | 401, 403 | GET `/admin/gamification/tiers` |
| 20 | PUT | `/api/admin/gamification/tiers/:id` | AD | yes | `{labelMs, icon, color, minSyiling, conversionRate, sortOrder, quizRewardL1…L5, pkskRewardCorrect, boardGameRewardCorrect, boardGameRewardWin, perks}` | 200 `{data: Tier}` | 422, 404 | PUT `/admin/gamification/tiers/{id}` |
| 21 | POST | `/api/admin/gamification/tiers/:id/toggle` | AD | yes | — | 200 `{data: {isActive}}` | 404 | POST `…/tiers/{id}/toggle` |
| 22 | POST | `/api/admin/gamification/tiers` | AD | yes | `{tierName, labelMs, icon, color, minSyiling, conversionRate, sortOrder, perks?: string, quizRewardL1…L5, pkskRewardCorrect, boardGameRewardCorrect, boardGameRewardWin}` | 201 `{data: Tier}` (perks = [text] or []) | 422 (V-M14-03) | POST `/admin/gamification/tiers` |
| 23 | GET | `/api/admin/gamification/challenges` | AD | no | — | 200 `{data: DailyChallenge[] (all, by sortOrder, id)}` | 401, 403 | GET `/admin/gamification/challenges` |
| 24 | PUT | `/api/admin/gamification/challenges/:id` | AD | yes | `{title, description, icon, challengeType, targetValue, rewardSyiling, rewardXp, difficulty, sortOrder}` | 200 `{data: DailyChallenge}` | 422, 404 | PUT `…/challenges/{id}` |
| 25 | POST | `/api/admin/gamification/challenges/:id/toggle` | AD | yes | — | 200 `{data: {isActive}}` | 404 | POST `…/challenges/{id}/toggle` |
| 26 | DELETE | `/api/admin/gamification/challenges/:id` | AD | yes | — | 200 `{data: {deleted: 1}}` | 404 | DELETE `…/challenges/{id}` |
| 27 | POST | `/api/admin/gamification/challenges` | AD | yes | as #24 | 201 `{data: DailyChallenge}` | 422 | POST `/admin/gamification/challenges` |
| 28 | GET | `/api/admin/gamification/students` | AD | no | `search, tier, sort (total_syiling_earned\|current_syiling\|token_balance\|level; each descending by its field, DV-M14-14), page` (20) | 200 envelope `{data: [{userId, name, email, tierKey, tierColor, level, currentSyiling, tokenBalance, totalSyilingEarned, xp}], meta: {page, pageSize: 20, totalItems, totalPages, from, to}}` | 401, 403 | GET `/admin/gamification/students` |
| 29 | POST | `/api/admin/gamification/award` | AD | yes | `{userId, amount, reason}` | 200 `{data: {userId, currentSyiling, transactionId}}` | 422 `VALIDATION_ERROR` (range, reason), 404 `NOT_FOUND` (user; message §8.2) | POST `/admin/gamification/award-syiling` |
| 30 | GET | `/api/admin/gamification/transactions` | AD | no | `type, dateFrom, dateTo, page` (25) | 200 envelope `{data: [{id, userId, name, type, amount, balanceAfter, source, description, createdAt}], meta: {…, from, to}}` | 401, 403 | GET `/admin/gamification/transactions` |
| 31 | GET | `/api/admin/gamification/guru` | AD | no | — | 200 `{data: {cards: {rewards, activeRewards, badges, pendingRedemptions}, pendingCash, badges: TeacherBadge[], rewards: TeacherReward[]}}` | 401, 403 | GET `/admin/gamifikasi/guru` |
| 32 | PUT | `/api/admin/gamification/guru/badges/:id` | AD | yes | `{name, icon, threshold, bonusCoins, isActive}` | 200 `{data: TeacherBadge}` | 422, 404 | PUT `/admin/gamifikasi/guru/lencana/{id}` |
| 33 | POST | `/api/admin/gamification/guru/rewards` | AD | yes | multipart `{name, category, costCoins, stock?, maxPerUser?, maxPerMonth?, description?, image?, isActive}` (image kept as an object URL, simulated) | 201 `{data: TeacherReward}` | 422 | POST `/admin/gamifikasi/guru/ganjaran` |
| 34 | GET | `/api/admin/gamification/guru/redemptions` | AD | no | `status=PENDING\|PROCESSING\|DELIVERED\|CANCELLED\|all` (default PENDING) | 200 `{data: TeacherRedemption[]}` | 401, 403 | GET `/admin/gamifikasi/guru/tebusan?status=` |
| 35 | PATCH | `/api/admin/gamification/guru/redemptions/:id` | AD | yes | `{status}` | 200 `{data: TeacherRedemption}` (PROPOSED) | 404, 422 | unknown |
| 36 | GET | `/api/admin/gamification/guru/cash` | AD | no | `status=…\|all` (default PENDING) | 200 `{data: {cards: {pending, approved, paid, paidTotal}, rows: [{id, userId, name, coins, cash, bankName, bankAccountMasked, accountHolderMasked, status, adminNote, createdAt}]}}` | 401, 403 | GET `/admin/gamifikasi/guru/tunai?status=` |
| 37 | PATCH | `/api/admin/gamification/guru/cash/:id` | AD | yes | `{status, adminNote?}` | 200 `{data: row}` (BR-M14-26) | 404, 422 | PATCH `/admin/gamifikasi/guru/tunai/{id}` |
| 38 | GET | `/api/admin/gamification/settings` | AD | no | — | 200 `{data: [{key, label, value, kind: 'number'\|'toggle'}] (10)}` | 401, 403 | GET `/admin/gamifikasi/pengaturan` |
| 39 | PUT | `/api/admin/gamification/settings` | AD | yes | `{settings: [{key, value}]}` | 200 `{data: [...]}` | 422 (unknown key, value < 0) | POST `/admin/gamifikasi/pengaturan` |
| 40 | GET | `/api/admin/reward-control` | AD | no | — | 200 `{data: {tiles: {sessionYear, liabilityRm, students, claims}, settings: {rewardBudgetSenSession, rewardBudgetSenMonth, flatQuizReward, currentSessionYear, gamesAwardSyiling}, rewards: [{id, name, type, priceSyiling, costValueSen, costRm}], draws: Draw[]}}` | 401, 403 | GET `/admin/reward-control` |
| 41 | PUT | `/api/admin/reward-control/settings` | AD | yes | the 5 keys | 200 `{data: settings}` | 422 | POST `/admin/reward-control/settings` |
| 42 | PUT | `/api/admin/reward-control/rewards/:id/cost` | AD | yes | `{costValueSen}` | 200 `{data: reward}` | 422, 404 | POST `/admin/reward-control/reward/{id}/cost` |
| 43 | POST | `/api/admin/reward-control/draws` | AD | yes | `{title, description?, ticketCostSyiling, maxTicketsPerStudent, prizePool?: string (JSON), closesAt?, openNow}` | 201 `{data: Draw}` | 422 (V-M14-12) | POST `/admin/reward-control/draw` |

Referenced (not owned): M05 #6 `POST /api/practice/sessions/{id}/submit` (calls `onSessionCompleted`); M01 login and register (call `onLogin`, `referrals.onRegistered`); M15 #12 `GET /api/cabutan` and #9–#11 (call the draw and wallet repository); M08 #6/#20 (read `wallet.summary`, `streak.get`, `learnerBadges.forUser`).

### 7.1 Repository contract (`@/modules/m14-gamification/mock`, architecture §6.7)

| Method | Caller | Behaviour |
|---|---|---|
| `wallet.summary(userId)` | shell #1, M05, M08, M15 | #2 body; defaults for a missing row (BR-M14-02) |
| `wallet.credit(userId, {coins, points}, reason)` | kept for the architecture's provisional callers; delegates to `onSessionCompleted` when `reason.kind = 'session'`, else to `creditSyiling` + `addXp` | — |
| `gamification.onSessionCompleted({userId, sessionId, mode, correct, total, timeSpent, completedAt, pointsEarned, coinsPerCorrect?, correctByLevel?})` | M05 BR-31 step 6 (all modes, M06 included) | BR-M14-03/04/05/08/12/13/14/16/24 in one transaction; returns `{coinsEarned, pointsEarned, streakCount, totalBalance}`. **Idempotent per `sessionId` (v1.8):** a credited session returns its stored result (DATA-M14-23) and writes nothing. `correctByLevel` is optional and not sent by M05 (BR-M14-03). Reads M05 through M05 §7.2 (§6.1) |
| `gamification.onLogin(userId, at)` | M01 password login | BR-M14-14 (daily_login row for students, streak) |
| `gamification.onGameResult(userId, {game, event, coins?, xp, correct?, total?, detail?}) → {coinsCredited, xpAdded}`, `gamification.canEarnSyiling(userId)` | M16 | BR-M14-21 (XL3-26, XL3-29) |
| `referrals.onRegistered(newUserId, code)` | M01 register | BR-M14-19 |
| `streak.get(userId)` → `{current, best, lastActivityDate, totalDays, practisedToday, multiplier}`; `streak.forUsers(userIds)` (M18 aggregates) | shell, M05 (banner, `practisedToday`), M08, M10 ("Streak Champions"); later M18 `/kombo/*` aggregates (URS OQ-M14-18) | returns `{current, best, lastActivityDate, totalDays, practisedToday, multiplier}` (v1.8: `totalDays` = DATA-M14-08 stored counter; `practisedToday` = a completed M05 session today, read through `practice.history(userId, {date})`; `multiplier` = 1 (BR-M14-15, shown "1.0x")); reads never decay |
| `challenges.today(userId)` | M05 dashboard widget | #7 body |
| `achievements.forUser(userId)` | S15 | #9 body |
| `learnerBadges.forUser(userId)`, `learnerBadges.catalogue()` | M08 FR-126, M10 BR-M10-16, M05 FR-16 | DATA-M14-20 |
| `debitTokens(userId, n, {source, refId})`, `creditTokens(userId, n, {source, refId})` | M15 | BR-M14-22; `INSUFFICIENT_BALANCE` |
| `creditSyiling(userId, n, {source, description, refId?})`, `debitSyiling(userId, n, {source, description, refId})`, `addXp(userId, n, {source})` | M15, M16 | BR-M14-22 |
| `draws.listOpenDraws(today)`, `draws.ticketsOf(drawId, userId)`, `draws.buyTicket(drawId, userId)` | M15 S7 | BR-M14-29 (`DRAW_CLOSED`, `TICKET_LIMIT`, `INSUFFICIENT_BALANCE`) |
| `teacherGamification.onQuestionContributed(teacherId, questionId)`, `teacherWallet.summary(userId)` | M10 | BR-M14-23 |
| `settings.get(key)` | M15 (budget, if ever), M16 (`games_award_syiling`), M05 | DATA-M14-16 |

---

## 8. States & messages

### 8.1 Observed copy (exact)

| Screen | Copy |
|---|---|
| S1 | "🎮 Gamifikasi Overview" · "Pantau sistem gamifikasi PRESTASIPLUS" · cards "Pelajar Aktif", "Syiling Dijana", "Token Ditukar", "Penukaran", "Cabaran Aktif", "Siap Hari Ini" · "Taburan Tier" · "Top 10 Pelajar" · "{tier} · Level {n}" · "syiling" · "Transaksi Terkini" · "Lihat semua →" · headers "Pelajar", "Jenis", "Jumlah", "Sumber", "Masa" |
| S2 | "👑 Tier Configuration" · "Urus tier sistem gamifikasi — termasuk ganjaran Syiling per soalan" · "Senarai Tier" · "Label BM", "Icon", "Warna", "Min Syiling", "Kadar", "Urutan" · "📝 Latih Tubi — Syiling per Jawab Betul", "L1"…"L5" · "🛡️ PKSK — Syiling per Jawab Betul", "Semua soalan PKSK (tiada level)" · "🎲 Papan Bijak — Syiling", "Jawab Betul", "Menang" · "🔴 Nyahaktif" · "➕ Tambah Tier Baru", "Nama Tier (eng)", "Kadar Penukaran", "Perks", placeholders "diamond", "Berlian", "💎", "10000", "15", "Bonus 2x XP" · "Tambah Tier" |
| S3 | "🎯 Cabaran Harian" · "Urus cabaran harian untuk pelajar" · "Senarai Cabaran ({n})" · "Tajuk", "Keterangan", "Icon", "Jenis", "Sasaran", "Ganjaran Syiling", "Ganjaran XP", "Kesukaran", "Urutan" · options of §6.9 · "Simpan" · "🔴 Nyahaktif" · "Padam" · confirm "Padam cabaran ini?" · "➕ Tambah Cabaran Baru", placeholder "📝" · "Tambah Cabaran" |
| S4 | "👥 Pelajar Gamifikasi" · "Pantau progress pelajar & berikan bonus syiling" · "Cari nama/email..." · "Semua Tier", "🥉 Gangsa", "🥈 Perak", "🥇 Emas", "💎 Platinum" · "Jumlah Syiling", "Baki Syiling", "Baki Token", "Level" · "Cari" · "🎁 Berikan Bonus Syiling", "User ID" ("ID"), "Jumlah" ("100"), "Sebab" ("Bonus khas / Pertandingan"), "Berikan" · headers "Pelajar", "Tier", "Level", "Syiling", "Token", "Jumlah Syiling", "XP" · pager "Showing {from} to {to} of {total} results", "« Previous", "Next »" · empty "Belum ada pelajar dalam sistem gamifikasi" |
| S5 | "📋 Transaksi Syiling" · "Log semua transaksi syiling dalam sistem" · "Semua Jenis", "💰 Dapat", "🛍️ Belanja", "🔄 Tukar", "🎁 Bonus", "↩️ Refund" · "Dari", "Hingga", "Tapis", "Reset" · headers "ID", "Pelajar", "Jenis", "Jumlah", "Baki Selepas", "Sumber", "Keterangan", "Tarikh" · "ID:" · empty "Tiada transaksi ditemui" |
| S6 | "Jumlah Ganjaran", "Aktif", "Lencana", "Tebusan Pending" · "Tebusan Hadiah", "Tebus Tunai" · "Lencana Guru ({n})", headers "Lencana", "Ikon", "Threshold", "Bonus", "Status", "Tindakan" · "Aktif" · "Edit" · "Nama", "Ikon CSS", "Threshold", "Bonus Syiling", "Aktif", "Simpan" · "Katalog Ganjaran ({n})", "Tambah Ganjaran", "Nama *", "Kategori *", "Am", "Digital", "Fizikal", "Baucar", "Kos Syiling *", "Stok (kosong = tiada had)", "Had/Pengguna", "Had/Bulan", "Penerangan", "Gambar", "Aktif", "Simpan" · empty "Tiada ganjaran. Tambah ganjaran pertama!" |
| S7 | "Menunggu", "Diproses", "Dihantar", "Dibatal", "Semua" · "Tiada tebusan pending" / "processing" / "delivered" / "cancelled" · "Tiada tebusan" · "Kembali ke Gamifikasi Guru" |
| S8 | "Menunggu", "Diluluskan", "Dibayar", "Jumlah Dibayar" · pills "Menunggu", "Diluluskan", "Dalam Proses", "Dibayar", "Ditolak", "Semua" · headers "Guru", "Syiling", "Tunai", "Bank", "Status", "Tarikh", "Tindakan" · "PENDING" … · "Nota..." · confirm "Kemaskini status?" · "Tetapan", "Ganjaran" |
| S9 | "Tetapan Gamifikasi Guru" · the 10 labels of URS FN-M14-11.6.2/11.6.3 · "Key:" · "Aktif", "Tidak Aktif" · "Pratonton Kadar" · preview lines · "Simpan Tetapan" · "Ganjaran Guru", "Tebus Tunai", "Tebusan" |
| S10 | "Liabiliti sesi {year}", "jumlah kos hadiah ditebus", "Pelajar menebus", "Jumlah tebusan" · "⚙️ Tetapan Kewangan" + 5 labels + "Simpan Tetapan" · "🎁 Kos Sebenar Hadiah (sen) — digital = 0, tak makan bajet", headers "Hadiah", "Jenis", "Harga syiling", "Kos sebenar (sen)", "Simpan" · "🎟️ Cabutan", headers "#", "Tajuk", "Status", "Tiket", "Kolam", "Pemenang", "Tiada cabutan lagi." · "➕ Cipta Cabutan Baru", "Tajuk", "Penerangan", "Harga tiket (syiling)", "Max tiket / pelajar", "Kolam hadiah (JSON)", "Tarikh tutup", "Buka serta-merta", "Cipta Cabutan" |
| S11–S22 | every string of URS §3 (EP-M14-2…7, 10) and discovery Appendix B |

### 8.2 PROPOSED COPY and PROPOSED layouts (report at G1; URS OQ-M14-12)

| Where | PROPOSED |
|---|---|
| S12 success / error | "Berjaya! {s} syiling ditukar kepada {t} token." (green flash above the form) · "Jumlah syiling tidak sah." (red flash) |
| S4 award | "Bonus {amount} syiling diberikan kepada pengguna #{userId}." · "Pengguna tidak dijumpai." |
| S2, S3, S6, S9, S10 saves | "Berjaya disimpan." (green flash at the top of the content); server validation "Sila lengkapkan semua medan wajib." (SRS.md §7.3 example) · "Nama tier sudah wujud." · "Format JSON kolam hadiah tidak sah." |
| S3 delete | "Cabaran dipadam." |
| S2/S3 toggle | "🟢 Aktifkan" (inactive state button) |
| S6 badge | status pill "Tidak Aktif" (slate-100/500) for an inactive badge |
| S20 | success "Permohonan tebus tunai dihantar." · disabled "Tebus tunai tidak aktif buat masa ini." · history row: date "d MMM yyyy HH:mm", "{coins} syiling", "RM{cash}", bank name, status pill (colours: PENDING yellow-100/700 OBSERVED; APPROVED blue-100/700; PROCESSING indigo-100/700; PAID emerald-100/700; REJECTED red-100/700) |
| S8 | admin note shown under the status pill (slate-500, 12 px); status pill colours as S20 |
| Ledger descriptions | "Ramalan SPM: {n} betul — {pct}", "PKSK: {n} betul — {pct}", "Pencapaian: {name}", "Tiket Cabutan: {title}", "Sumbang Soalan #{id}", "Tebus Tunai #{id}", "Tebus Tunai #{id} dibatalkan" (teacher-ledger credit-back when a request leaves PAID, BR-M14-26; v1.8), "Tebusan: {name}", "Bonus rujukan: kod {CODE}", "Rujukan kawan berjaya"; teacher "Ramalan SPM - {pct} ketepatan", "PKSK - {pct} ketepatan" (BR-M14-24, v1.8) |
| S17 icons | 🛍️ spend, 🔄 convert, 🎁 bonus, ↩️ refund (from the pill icons) |
| S19 empty history | "Belum ada transaksi" (reuses the observed S17 text) |
| S13 completed card | full emerald bar, "✅" before the title, card border emerald-300 |
| S15 unlocked card | full colour (no grey filter), `cursor: pointer`, the rarity colour as border |
| S19/S21 reward card, S6 catalogue row, S7 redemption row | card: name, category label, "{cost} syiling", "Stok: {n}\|∞", button "Tebus"; row: name, category, cost, stock ("∞"), limits, status pill; redemption row: teacher, reward, cost, status, "d MMM yyyy HH:mm", status select + ✓ with confirm "Kemaskini status?" (the S8 pattern) |
| S10 draw row | "#{id}", title, status key (`draft`/`open`/`closed`), tickets sold, Σ qty, winners "—", empty last cell |
| Title cut-offs | Master 2,000, Grandmaster 3,500, Legenda 5,000, Mitos 10,000 (BR-M14-09) |

### 8.3 Loading and errors

The lists and pages show the shared loading behaviour of the shells while the mock responds (live is server-rendered). A mock failure uses the global error convention of M01 (retry). 401 → `/login`; 403 → the M01 landing page.

---

## 9. Permissions matrix

| Role | S11–S18 (#1–#11) | Convert #6 | S19–S22 (#12–#17) | S1–S10 (#18–#43) | Repository writes | Notes |
|---|---|---|---|---|---|---|
| Admin | view own wallet (256) | yes | view own teacher wallet (92,683); request cash; redeem | view / create / edit / delete (tiers, challenges, badges, rewards, settings, costs, draws), award, cash status | via the screens | OBSERVED screens; POST effects INFERRED |
| Pelajar | view own | yes | → landing page / 403 | → landing page / 403 | own session, login, M15 spending | INFERRED (provisional) |
| Guru | view own (defaults unless a wallet row exists) | yes | view own; request cash; redeem | → landing page / 403 | contributions (M10), own sessions | INFERRED (provisional) |
| Ibu Bapa, Penaja, Admin Sekolah, PPD, JPN | view own (defaults) | yes | → landing page / 403 | → landing page / 403 | — | UNVERIFIED (provisional) |
| Guest | → `/login` | — | → `/login` | → `/login` | registration referral (M01) | INFERRED |

---

## 10. Responsive behaviour

Shell switch at 1024px (sidebar → drawer + bottom nav) per design/shells.md. Tables follow NFR-RESP-05 (b): horizontal scroll inside their card, as live; no sticky column. Control sizes replicate live with 44px hit areas (FR-133). Text ≥ 12px (DV-M14-11).

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | cards 2 a row; tier and top-10 cards stacked; table scrolls in card | cards wrap (3 a row); cards stacked | 6 cards one row; tier + top-10 side by side |
| S2 / S3 | one field column; long forms; badges 12px | 2–3 field columns | 4–6 field columns |
| S4 / S5 | filter fields stacked; award card stacked; table scrolls in card; pager "« Previous / Next »" | filters one row; table scrolls in card | full table |
| S6 | cards 2 a row; badge table scrolls in card; forms one column | 4 cards | 4 cards; forms multi-column |
| S7 / S8 | pills wrap; S8 cards 2 a row; table scrolls in card | cards 4; table fits | same |
| S9 | rows full width | same | same |
| S10 | tiles stacked; tables scroll in card; form one column | tiles 3 | tiles 3; form 2–3 columns |
| S11 | one column; cards 2 a row; tier grid 1 | cards 2 a row; tier grid 2 | cards 4; challenges / transactions side by side; tier grid 4 |
| S12 | tiles side by side; tier grid 2 | grid 2 | grid 4 |
| S13 | cards 1 column | 2 | 2–3 |
| S14 | podium 3 narrow cards within the viewport (DV-M14-07); rows full width | same | same |
| S15 | badge grid 2; modal full width | grid 3; modal centred | grid 4–5; modal centred |
| S16 / S17 | stacked; pills wrap | same | same |
| S18 | tabs one row (icon + label); cards full width | same | same |
| S19–S22 | cards 2 a row; badge tiles 2 a row; S20 form one column; S22 table scrolls in card | 4 cards; tiles 4 | same |

---

## 11. Non-functional requirements

| ID | Requirement | Global |
|---|---|---|
| NFR-M14-01 | Datasets: `wallets` and `coinLedger` are D11 virtual datasets; every count is a named query of §6.10; a build check asserts that no seeded ledger row is dated after the project clock, and 2,255 / 1,889 / 292 / 41 / 33 / 3,124,192 / 52,964 / 52,426 / 535 / 534 / 7,801 / 1 / 2 / 0, the anchors at their ids and values, and that no generated row enters S4 page 1 of any tier, S5 page 1 or S14. | D11 |
| NFR-M14-02 | Query budget: #28 and #30 ≤ 50 ms per page on the CI machine (architecture §6.6). | NFR-01 |
| NFR-M14-03 | Atomicity: every repository write and its caller's write succeed or fail together (BR-M14-30); a Vitest test injects a failure and checks no partial state. | NFR-04 |
| NFR-M14-04 | Privacy: fictitious names only; bank account numbers and holders are stored in the mock but returned masked by #36 and #13 (last 3 digits of the account; holder initials) and never logged. | NFR-05 |
| NFR-M14-05 | Accessibility replicates live (D10; FR-135). | NFR-02 |
| NFR-M14-06 | Locale: ms-MY separators; dates as FR-134; Asia/Kuala_Lumpur for "today", weeks and the challenge reset. | NFR-08 |
| NFR-M14-07 | Share images are produced client-side (html2canvas-equivalent); no network call; E2E stubs the download. | D4 |

### 11.1 Security notes (backend phase)

| ID | Live risk (replicated with dummy data) | Backend requirement |
|---|---|---|
| SEC-M14-01 | **Balance races.** Conversion, token spending, cabutan tickets and cash requests read a balance and then write; parallel requests can overspend (live already holds negative token balances, D-10). | One transaction per movement with a row lock or a conditional update (`balance >= amount`); unique idempotency key per request; a database CHECK (balance ≥ 0); nightly reconciliation of wallets against the ledger. |
| SEC-M14-02 | **Conversion rounding.** The live client lets any amount ≥ rate through and the server deducts the typed amount while crediting floor(amount ÷ rate), so up to rate − 1 syiling are lost per conversion; the client limits are the only checks observed. | Validate server-side (integer, rate ≤ s ≤ balance); either accept only multiples of the rate or deduct t × rate; show the exact debit before confirming; rate read inside the transaction (tier changes). |
| SEC-M14-03 | **Award abuse.** One admin form grants up to 10,000 syiling per request to any user id, with a free-text reason and no confirmation; 5 fields of the economy (flat reward, budgets, games) are editable on two pages. | Role-restricted (super-admin), per-admin daily cap, second approval above a threshold, audit log (who, whom, amount, reason), alerts on outliers; settings changes audited. |
| SEC-M14-04 | **Cash-out bank data (PII of teachers).** S20 posts bank account numbers and holder names; S8 lists them in clear to every admin (discovery masked them). | Encrypt at rest; mask in lists (last 3 digits); reveal on demand with an audit entry; restrict to finance roles; retention limit; verify the holder against the teacher's name; payout only to verified accounts. |
| SEC-M14-05 | **Cash workflow integrity.** Any status can be set in any order (PAID back to PENDING), no maker-checker, the debit timing is unobserved. | State machine (PENDING → APPROVED → PROCESSING → PAID; REJECTED from PENDING/APPROVED), debit exactly once, maker-checker for PAID, amount caps, fraud checks on large requests (163,445 syiling = RM1,307.56). |
| SEC-M14-06 | **Referral abuse.** Rewards for self-referral or mass sign-ups (+50 / +25 per account) — the live register form ignores `?ref=`, the server rule is unobserved. | One reward per new verified user; block own code, same device/IP/e-mail patterns; reward only after the referee's first activity; cap per referrer per day; audit. |
| SEC-M14-07 | **Farming.** Coins per correct answer, streak activity (+2 / +7 per day), challenges and games (`games_award_syiling`, "tutup exploit") can be farmed by repeating easy sessions or by scripts. | Server-side scoring only; rate limits per user; the flat reward already neutralises difficulty; anomaly detection on daily earnings; keep games XP-only unless protected. |
| SEC-M14-08 | **Minors and lucky draws.** Cabutan tickets are bought with syiling by minors; the prize pool is free-form admin JSON. | Legal review; schema validation of the pool; ticket caps enforced atomically; auditable, reproducible winner selection; parental notice for physical prizes. |
| SEC-M14-09 | **Public share links.** Share texts embed `/pelajar/{id}` with sequential ids (M08 SEC-M08-01). | Opt-in public profiles, non-guessable slugs. |
| SEC-M14-10 | **Multipart upload** of teacher reward images (`accept="image/*"` only on the client). | Server-side type and size checks, re-encoding, storage outside the web root, malware scan. |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024 and desktop 1280×800 (master SRS §10); when a step is width-specific it names the width and the scenario still runs on all three. Default user: the admin (`setUser(1)`). **Clock: every scenario runs at the single project clock `2026-09-25T15:40:00+08:00`** (architecture §6.12), including every scenario that reads S1, S5, S11 or S13; only E2E-29 moves it (`advanceTime`), and scenarios on another day use `advanceTime` explicitly. Share downloads, `wa.me` / `t.me` navigation and the clipboard are stubbed. **Provisional** = asserts INFERRED/PROPOSED behaviour; tagged `@provisional` until URS OQ-M14-01 is answered.

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M14-01 | Admin user-portal sidebar at 1280 (entries, icons, targets incl. "Kombo" → `/kombo`); drawer at 375/768 ("Gamifikasi" group, "Syiling & Ganjaran"). | 01 | 01.1 | |
| E2E-M14-02 | Admin panel "Gamifikasi" group at 1280 and the "Lagi" list below 1024; "Streak / Kombo" → `/kombo`. | 02 | 01.2 | |
| E2E-M14-03 | Header titles/subtitles on S1–S22 (DV-M14-01 on S1–S5, S11–S17; live on the others). | 03 | 01.3, 01.4, 01.5 | |
| E2E-M14-04 | Tab titles of the 22 routes; admin shell on S1–S10, user shell on S11–S22. | 04 | 01.6 | |
| E2E-M14-05 | No session: `/gamification`, `/gamification/convert`, `/guru/gamifikasi`, `/admin/gamification` → `/login`. | 05 | 02.1 | yes |
| E2E-M14-06 | Student (`setUser(2)`): `/admin/gamification`, `/admin/reward-control`, `/guru/gamifikasi` → landing page; #18 → 403. | 06 | 02.2 | yes |
| E2E-M14-07 | `/kombo` → `/dashboard` for the admin and for the student. | 07 | 02.3 | yes |
| E2E-M14-08 | `?period=week` same list; `?tab=zzz` → Sekolah Saya; `?rarity=zzz` pills only, no card, no message; `/gamification/history?type=zzz` empty state. | 08 | 02.4 | |
| E2E-M14-09 | `/gamification/xyz`, `/admin/gamifikasi/xyz` → global 404 page. | 09 | 02.5 | yes |
| E2E-M14-10 | Header chips 256 koin / 8 mata / 1 hari 🔥 at 1280; chips strip 256 / 8 / 1 🔥 at 375. | 10 | 03.1 | |
| E2E-M14-11 | 256 on S11, S12, S17, M05 `/dashboard`, S4 (admin row); streak 1 / best 5 on S15, S18 Kombo, M05 banner "Kombo 1 hari akan putus!", M08 `/prestasi/1`; streak anchors of §6.11.7 (KLUANG 81, BATANG PADANG 29, 2710 `totalDays` 13 and 4, pupil 2022 streak 1) through `streak.forUsers`. | 11, 12 | 03.2, 03.6 | |
| E2E-M14-12 | M08 `/pelajar/1` 256 and "244 syiling lagi ke Silver"; `/prestasi/1` "Koin" 256 (after M08 applies XR-M14-03). | 13 | 03.3 | yes |
| E2E-M14-13 | pelajar2: S11 0 / 0 / Level 1 / "Gangsa Tier" / "📚 Permulaan" / "Perlu 500 syiling lagi"; chips 0 / 0 / 0. | 11 | 03.4 | |
| E2E-M14-14 | Student completes an M05 session (5 correct): M05 "Ganjaran Anda", header chip, S11 and S17 agree. | 11, 61 | 03.5 | yes |
| E2E-M14-15 | S11 hero (🥉, 📚 Permulaan, Gangsa Tier, Level 2, 256, 0), progress 51.2 % "Perlu 244 syiling lagi", three buttons' targets. | 14, 15, 16 | 04.1, 04.2, 04.3 | |
| E2E-M14-16 | S11 cards (project clock): 256 "+0 hari ini", 0 "50 syiling = 1 token", 2 "8/110 XP" bar 7 %, 256 "+0 minggu ini". | 17 | 04.4 | |
| E2E-M14-17 | Student (clock 25/09 15:40): S11 370 "+198 hari ini", "+370 minggu ini". | 17 | 04.5 | yes |
| E2E-M14-18 | S11 "Cabaran Hari Ini" (4 cards, upper-case difficulty, "0/3", "+15 💰") and "Transaksi Terkini" (6 rows, "4 bulan yang lepas"); links → S13, S17. | 18, 19 | 05.1, 05.2 | |
| E2E-M14-19 | S11 mastery rows (L2 BM 48.94 % · 1.05x bonus; L1 Sejarah 35 %), tier grid with "✨ ANDA DI SINI", "Gelaran Seterusnya" "Perlu 44 syiling lagi…", "Kad Kongsi" → S18. | 20, 21, 22 | 05.3, 05.4, 05.5 | |
| E2E-M14-20 | S17 admin: header "Baki semasa: 256 syiling", 14 rows with dates, relative times, amounts and "Baki:" chain 256 … 4; no pager; "← Dashboard". | 23, 25 | 06.1 | |
| E2E-M14-21 | S17 pills: "💰 Dapat" 14 rows (`?type=earn`); Belanja / Tukar / Bonus → empty state texts. | 24, 26 | 06.2 | |
| E2E-M14-22 | S12 render: tiles 256 / 0, input 50 (min 50, max 256), preview 1, "Kadar: 50 syiling = 1 token (Gangsa)"; quick 250 → 5, Semua (256) → 5; tier grid with "ANDA"; tip. | 27, 28, 29, 30, 32 | 07.1, 07.2, 07.3 | |
| E2E-M14-23 | S12 typing 30 → 0 disabled; 300 → 6 disabled; 50 → enabled. | 31, 28 | 08.1 | |
| E2E-M14-24 | Convert 250: S12 6 / 5 + success message; S11 6 / 5, "Jumlah Syiling" 256, Gangsa; S17 "🔄 Tukar" row "Tukar 250 syiling → 5 token" −250 "Baki: 6". | 33, 25 | 08.2, 06.3 | yes |
| E2E-M14-25 | #6 direct: 251 → −251, +5; 300 → 422 and no change. | 33 | 08.3 | yes |
| E2E-M14-26 | S13 admin (project clock): "0/10 Selesai", 10 cards in order with rewards, "Progres: 0/{target}", "0%". | 34, 35 | 09.1 | |
| E2E-M14-27 | S13 student (25/09 15:40): "7/10", Si Tepat 80/80 100 %, Kombo 2 Hari 2/2, Cabaran Kilat 20/20, Rajin Berlatih 1/3 33 %, Ketepatan 90% 85/90. | 34, 35, 36 | 09.2 | yes |
| E2E-M14-28 | pelajar2 at 26/09 09:00 via `gamificationSession`: random 6/10 5 min → "2/10", rows +6, +10, +12, "Pencapaian: Langkah Pertama" +5, balance 33; second session 5 correct → Kilat Matematik +30, Mula not repeated. | 36, 37 | 10.1, 10.2 | yes |
| E2E-M14-29 | After `advanceTime` to 00:05 next day: S13 all progress 0, "0/10". | 38 | 10.3 | yes |
| E2E-M14-30 | Admin deactivates challenge 10 (S3): S13/S11 without Cabaran Kilat, "{n}/9", S1 "Cabaran Aktif" 9; reactivate restores. | 39, 87 | 10.4 | yes |
| E2E-M14-31 | S14 podium order and values (686,730 / 1,018,083 raised / 135,760, "💎 Platinum"), 47 rows with the title/level/value checkpoints of AC-11.2, fictitious names, initials avatars. | 40, 41, 43 | 11.1, 11.2 | |
| E2E-M14-32 | S14 `?period=week` identical DOM list; no period filter, no own-rank card. | 42 | 11.3, 11.2 | |
| E2E-M14-33 | S15 header "0/25 dicapai", streak card 1 / "1.0x Bonus" / "Terbaik: 5 hari", 25 locked cards in order, progress only on the 5 kuiz badges. | 44, 45, 47 | 12.1, 12.2 | |
| E2E-M14-34 | S15 pills Biasa 6, Jarang 8, Epik 6, Legenda 5; active pill purple; `?rarity=zzz` nothing. | 46 | 12.3 | |
| E2E-M14-35 | pelajar2 after the unlock of E2E-36: card click → modal content; "Muat Turun" → `pencapaian-langkah-pertama.png`; "WhatsApp" text + `/pelajar/3`; pelajarmaju's seeded card → `/pelajar/4`; "Tutup" and backdrop close. | 48, 49, 50 | 13.1, 13.2 | yes |
| E2E-M14-36 | pelajar2 `gamificationSession` (random 6/10) → unlocks Langkah Pertama only (+5 syiling, +3 XP, "Pencapaian: Langkah Pertama"), S15 "1/25"; admin S15 stays 0/25; pelajarmaju S15 "3/25" with the three seeded "Pencapaian: …" rows in S17 and balance 267. | 51 | 14.1, 14.2, 14.3 | yes |
| E2E-M14-37 | S18 Profil card values; tabs Kombo (1 / 5 / 1.0x), Penguasaan (BM 48.9 % 46; Sejarah 35 % 14), Kedudukan (38.7 %, "Ketepatan · 46/119 betul"). | 52, 53 | 15.1, 15.2 | |
| E2E-M14-38 | S18 WhatsApp texts: Kedudukan "…PRESTASIPLUS: 38.7%! Jom latih tubi!" + `/pelajar/1`; Profil text + link; Kombo and Penguasaan texts. | 55 | 15.3 | |
| E2E-M14-39 | S18 "Muat Turun" → `prestasiplus-profil.png`; a second click during the download is ignored. | 54 | 15.4 | |
| E2E-M14-40 | S16 render (tiles, code 4JURJTT, stats 0/0/0), "Salin Kod" → clipboard + "✓ Disalin!", "Salin Link" → register URL + "✓ Link Disalin!", WhatsApp/Telegram hrefs. | 56, 57, 58, 59 | 16.1, 16.2, 16.3 | |
| E2E-M14-41 | Guest `/register?ref=4JURJTT` → new student 25, admin 306, S16 1 / 1 / 50; `?ref=ZZZZZZZ` → nobody credited. | 60 | 17.1, 17.2 | yes |
| E2E-M14-42 | pelajar2 `past_year` 4/10 → rows "SPM Tahun Lepas: 4 betul — 40%" +4 then "Streak activity (spm)" +7; a 0-correct session → no row. | 61, 64 | 18.1, 18.2 | yes |
| E2E-M14-43 | Complimentary 5901 session with 8 correct → no syiling, no row. | 61 | 18.3 | yes |
| E2E-M14-44 | pelajar2 `past_year` 6/10 → S11 "Level 1", "73/100 XP", header "73 mata". | 62 | 18.4 | yes |
| E2E-M14-45 | Streak: pelajarmaju session on 26/09 → 4 / 4; pelajar session on 27/09 → 1 / best 2. | 63 | 19.1 | yes |
| E2E-M14-46 | pelajar2 password login twice on one day → one "Streak activity (daily_login)" +2; admin login → none. | 64 | 19.2 | yes |
| E2E-M14-47 | pelajarmaju reaches day 4 and a test profile reaches day 10 → no `streak_bonus` row; S5 bonus filter still #51, #44 only. | 65 | 19.3 | yes |
| E2E-M14-48 | Admin `latih_tubi` 11/34 → teacher history "Latih Tubi SPM - 32.35% ketepatan" +11 and "Aktiviti harian: spm" +7; S17 "Latih Tubi SPM: 11 betul — 32.35%" +11. | 66 | 20.1 | yes |
| E2E-M14-49 | Award 250 to the admin → Perak, "Naik ke Emas", rate 40, title Pelajar, next Master; convert 400 → balance 106, still Perak. | 67, 68 | 21.1, 21.2 | yes |
| E2E-M14-50 | S4 `?tier=platinum` includes balance 129 / lifetime 65,129 platinum; `?tier=bronze` includes lifetime 609 bronze (seed tiers unchanged). | 67 | 21.3 | |
| E2E-M14-51 | S4 award user 3 / 100 / "Pertandingan" → success message, S5 bonus filter first row "+100" "admin_award" "Pertandingan" "Baki Selepas 100", pelajar2 S17 "🎁 Bonus" row, S4 total 2,256. | 70, 91 | 22.1, 26.4 | yes |
| E2E-M14-52 | `gameResult` Papan Bijak correct for pelajar2 with the setting 0 → XP only, no row; with 1 → +5 "Jawab betul dalam Papan Bijak 🎲". | 71 | 22.5 | yes |
| E2E-M14-53 | `debitTokens(2 → 0 tokens)` refused `INSUFFICIENT_BALANCE`; admin converts 250 then box debit 2 + credit 12 syiling / 5 XP → tokens 3, balance 18, S17 "Kotak Misteri: Kotak Gangsa" +12. | 72, 73, 76 | 22.2, 22.3 | yes |
| E2E-M14-54 | Fixture `m14-draw-open`: `buyTicket` → −50 "Tiket Cabutan: Cabutan Demo"; 11th ticket, closed draw, balance < 50 → refused, nothing written. | 74, 76, 130 | 22.4 | yes |
| E2E-M14-55 | S1 (project clock) cards 2,255 / 3,124,192 / 7,801 / 534 / 10 / 0 ("Siap Hari Ini" 0 although pelajar and pelajarmaju completed challenges today); tier distribution order, counts inside the bars (`min-width: 40px`), %, slate-800 count text on gold/silver/platinum (DV-M14-06); Top 10 #1 and #10. | 77, 78, 79 | 23.1, 23.2, 23.3 | |
| E2E-M14-56 | S1 recent transactions (project clock): 10 rows #53668 … #53659 with "Earn"/"Convert", amounts, sources and relative times 11 minit, 1/1/1/2/2/2/2/2/2 jam; no row dated after the clock; "Lihat semua →" → S5. | 80 | 23.4 | |
| E2E-M14-57 | After converting 250: S1 "Penukaran" 535, "Token Ditukar" 7,806. | 77 | 23.5 | yes |
| E2E-M14-58 | S2 render: 4 tier forms with values, L1–L5, PKSK, Papan Bijak, "🔴 Nyahaktif"; clearing "Min Syiling" blocks submit; no perk input on existing tiers. | 81, 82 | 24.1, 24.3 | |
| E2E-M14-59 | S2 Perak Kadar 35 saved → a Perak user's S12 "Kadar: 35 syiling = 1 token (Perak)". | 81 | 24.2 | yes |
| E2E-M14-60 | S2 add "diamond"/"Berlian" 10000/15/5 → S11 5 tier cards, S2 5 forms. | 84 | 24.4 | yes |
| E2E-M14-61 | S2 Nyahaktif Platinum → S11/S12 without Platinum; button "🟢 Aktifkan"; toggle back. | 83 | 24.5 | yes |
| E2E-M14-62 | S3 render: "Senarai Cabaran (10)", values of the 10 forms, badges, "Jenis" per DV-M14-04. | 85, 86 | 25.1 | |
| E2E-M14-63 | S3 Rajin Berlatih reward 20 → S13 "💰 +20 Syiling". | 85 | 25.2 | yes |
| E2E-M14-64 | S3 "Padam" on 10: dismiss → unchanged; accept → "Senarai Cabaran (9)", S13 9 cards. | 88 | 25.3 | yes |
| E2E-M14-65 | S3 add "Ulang Kaji Ringkas" with defaults → last S13 card "+10 Syiling" "+5 XP" "MUDAH". | 89 | 25.4 | yes |
| E2E-M14-66 | S4 default at 1280: pager "Showing 1 to 20 of 2255 results", pages 1–10, "...", 112, 113; first row platinum 66 / 1,018,033 / 1 / 1,018,083 / 19,794 with the tier colour badge. | 92, 93 | 26.1 | |
| E2E-M14-67 | S4 filters Perak 292 (first row 11 / 1,916 / 4 / 2,423 / 1,058), Emas 41, Platinum 33, Gangsa 1889 with a "−2" token; search "zzzq" → empty text; at 375 pager "« Previous" / "Next »"; sort "Baki Token" → `sort=token_balance`, select kept, first row token 1,764; "Baki Syiling" → 1,018,033 first; "Level" → level 66 first (DV-M14-14). | 90, 92, 93, 94 | 26.2, 26.3, 26.6 | |
| E2E-M14-68 | S4 award: amount 0 / 10001 / empty reason blocked natively; user 999999 → "Pengguna tidak dijumpai.". | 91 | 26.5 | yes |
| E2E-M14-69 | S5 (project clock): "of 52964 results", first row #53668 "Streak activity (daily_login)" 25/09/2026 15:29, rows 1–15 = #53668…#53654, no row dated after the clock; page 2118 first row #44; filters spend (#42 "Tuntut: Lencana Super Learner", Reset shown), convert (535, #53663 first), bonus (#51, #44), refund ("Tiada transaksi ditemui"), earn (52426). | 96, 97, 95, 75 | 27.1, 27.2 | |
| E2E-M14-70 | S5 Dari 2026-02-26 Hingga 2026-02-27 → only those days, newest first; "Reset" clears. | 95 | 27.3 | yes |
| E2E-M14-71 | S19 admin: cards 92,683 / 92,683 / 20,719 / 7/8; 8 badge tiles (7 emerald, 1 red-50); next badge "29,281 soalan lagi…"; katalog empty texts; 18 history rows with dates "19 May 2026, 03:49" … "06 Feb 2026, 16:26"; buttons' targets. | 98, 99, 100, 101, 102, 134 | 28.1, 28.2, 28.3, 28.4 | |
| E2E-M14-72 | Teacher (`setUser(5)`): S19 0 / 0 / 1 / 0/8, "Seterusnya: Penyumbang Baru" "1 / 10" "9 soalan lagi untuk bonus 100 syiling", "Belum ada transaksi". | 98, 99, 101 | 28.5 | yes |
| E2E-M14-73 | S20 admin: cards 92,683 / 92,683 / 0 / RM741.46; "Minimum tebus: 100 syiling"; Min/Max; 25 bank options; "500 syiling" → "RM4.00"; typing 50 → preview hidden, disabled; "5,000 syiling" clickable; empty history; "Kembali ke Dashboard" → S19. | 103, 104, 105, 107 | 29.1, 29.2, 29.5 | |
| E2E-M14-74 | S20 submit 500 / Maybank / "1234567890" / "Admin Demo": confirm text; accept → Dalam Proses 500, Boleh Ditebus 92,183, history row PENDING; S8 "Menunggu" 3; dismiss → nothing; `cash_withdrawal_enabled` 0 → refusal message. | 106, 107, 114, 103 | 29.3, 29.4 | yes |
| E2E-M14-75 | S21 admin: header, 92,683, "Dashboard" link, empty state texts and "Dashboard Gamifikasi" link. | 108 | 30.1 | |
| E2E-M14-76 | Fixture `m14-teacher-reward`: S21 card, S19 katalog card; "Tebus" → S7 "Menunggu" row; admin moves it to Diproses then Dihantar → debit 200 from the admin teacher wallet, S6 "Tebusan Pending" 0. | 109, 100, 120 | 30.2, 35.2 | yes |
| E2E-M14-77 | S22 admin: "Sekolah Saya" active, 50 rows starting 🥇 3,906/20,720, 🥈 1,559/0, 🥉 256/0, admin absent; "Seluruh Malaysia" adds "Sekolah" with the same first three; back link; the 50 rows contain none of the three added wallets; Σ active non-fixture teacher balances = 63,459 with 4207/4208 inactive. | 110, 111 | 31.1, 31.2, 31.4 | |
| E2E-M14-78 | Teacher S22 "Sekolah Saya": only SMK DEMO teachers, teacher 5 first with 1 / 0. | 111 | 31.3 | yes |
| E2E-M14-79 | Teacher creates a question on M10 S22 → S19 2 / 10 syiling / "Sumbang Soalan #{id}" +10; `setTeacherWallet(5, {questionsCount: 9})` then one more create → "Badge: Penyumbang Baru (10 soalan)" +100, tile emerald. | 112, 113 | 32.1, 32.2 | yes |
| E2E-M14-80 | Admin's request of E2E-74 (id 3, runtime ids continue the table) set PAID on S8 → S19 92,183 with "Tebus Tunai #3" −500, S8 Dibayar 1, "RM4.00"; request 2 set APPROVED with note "Semak akaun" → "Diluluskan" pill list with the note; REJECTED releases the hold; dismissing "Kemaskini status?" changes nothing. | 114, 122 | 32.3, 36.3 | yes |
| E2E-M14-81 | S6 cards 0/0/8/0, links and badge "2", "Lencana Guru (8)" rows with icons, "+bonus", "Aktif", "Edit". | 115, 116 | 33.1, 33.2 | |
| E2E-M14-82 | S6 "Edit" form fields; typed value kept after hide/show; save "Bonus Syiling" 150 → row "+150" and S19 tile "+150 syiling". | 116 | 33.3 | yes |
| E2E-M14-83 | S6 "Katalog Ganjaran (0)" empty text; "Tambah Ganjaran" form fields and category options; empty submit blocked at "Nama *". | 117 | 34.1 | |
| E2E-M14-84 | S6 create "Baucar Buku RM20" → "Katalog Ganjaran (1)", cards 1 / 1, PROPOSED row. | 117, 118 | 34.2 | yes |
| E2E-M14-85 | S7 pills and the five empty texts; active pill indigo; back link. | 119 | 35.1 | |
| E2E-M14-86 | S8 cards 2/0/0/RM0.00; rows (request 2 then 1) with masked bank details, "PENDING", dates; other pills empty; "Semua" both; links. | 121, 134 | 36.1, 36.2 | |
| E2E-M14-87 | S9 rows, keys, values and DV-M14-05 label; preview live update (16 sen → RM0.16 / RM1.60 / RM16.00; 0 → fallback 8); links → S6, S8, S7. | 123, 124, 125 | 37.1, 37.2, 37.5 | |
| E2E-M14-88 | S9 save `min_cash_withdrawal` 200 → S20 "Minimum tebus: 200 syiling", "Min: 200"; save `flat_quiz_reward` 2 → S10 shows 2 and a 5-correct session pays +10. | 125, 127, 69 | 37.3, 37.4 | yes |
| E2E-M14-89 | S10 tiles "Liabiliti sesi 2026" RM0.00 / 0 / 0; "Tetapan Kewangan" values and unchecked checkbox. | 126, 127 | 38.1 | |
| E2E-M14-90 | S10 save `current_session_year` 2027 → tile "Liabiliti sesi 2027", S9 row 2027. | 126, 127 | 38.2 | yes |
| E2E-M14-91 | S10 cost table 11 rows (DIGITAL 0); save 1500 on row 1 → "RM15.00". | 128 | 39.1 | yes |
| E2E-M14-92 | S10 cabutan: headers, "Tiada cabutan lagi.", closed `<details>`, open → fields and defaults 50 / 10, placeholder. | 129 | 40.1 | |
| E2E-M14-93 | S10 create "Cabutan Merdeka" (placeholder pool, 2026-10-31, open) → row "#1 … open 0 11 —", M15 `/cabutan` lists it; missing "Tajuk" blocked; invalid JSON → message. | 130, 129 | 40.2, 40.3 | yes |
| E2E-M14-94 | Responsive sweep of the 22 routes: `scrollWidth ≤ innerWidth` (S14 at 375 included); tables scroll inside their cards below 768. | 131 | 41.1 | |
| E2E-M14-95 | Font-size sweep at 375 on S2, S3, S4, S5, S6, S11, S13, S15, S18, S19: no visible text < 12 px. | 132 | 41.2 | |
| E2E-M14-96 | Touch: tap at the edge of the 44 px hit area of S6 "Edit", S8 ✓/select, S10 "Simpan"/checkbox, S1/S11 "Lihat semua →" activates them; visual sizes as live; no ARIA additions (D10). | 133, 135 | 41.3 | |
| E2E-M14-97 | Privacy: S1, S4, S5, S8, S14, S22 names are seed names (none of the masked live tokens), avatars initials, S8 account "•••" + 3 digits and holder masked. | 43 | 41.4 | |

Provisional: E2E-M14-05, 06, 07, 09, 12, 14, 17, 24, 25, 27, 28, 29, 30, 35, 36, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53, 54, 57, 59, 60, 61, 63, 64, 65, 68, 70, 72, 74, 76, 78, 79, 80, 82, 84, 88, 90, 91, 93 (49 of 97)

---

## 13. Open questions

URS §9 (OQ-M14-01…17) applies unchanged. SRS-level items:

1. **SQ-M14-01 Owner acceptance of §6.12.** M05 (XR-01: repository hand-over, quest move, designed wallet values), M08 (XR-03), M01 (XR-02), M10 (XR-04), M02 (XR-05), M16, M07 and the shell (XR-07…09) must accept before the M14 build; items for the next XL gate. The M15 answers (§6.13) close XR-M15-01/02/03/06/07/08 and give a recommendation for XR-M15-05; XR-M15-04's shop source stays open for the user.
2. **SQ-M14-02 Clock — closed (Delivery Lead, 2026-09-26).** One project clock `2026-09-25T15:40:00+08:00` for every module and build; the 10 observed ledger rows stored after it are not seeded (§6.11.1 clock treatment) and "Siap Hari Ini" is Q-DAILY-FINISHERS.
3. **SQ-M14-03 Architecture §6.7 update.** The "Wallet, streak (provisional)" row becomes the M14 repository of §7.1 (same method names plus the M15 names); the `GET /api/me/gamification-summary` contract of §10 is kept.
4. **SQ-M14-04 Per-user reconciliation of generated rows.** Generated wallets and generated ledger rows are independent facets (§6.11.1); a generated user's S4 balance is not the sum of generated S5 rows. The designed accounts (1, 2, 4) and runtime writes always reconcile. *v1.8:* owners of observed live-id rows match their newest row where that row is the last before the clock (4021–4029 designed, 4004, 4046, student 12); the accepted residual mismatches of older rows (4017 14 vs 12, 4014 692 vs 8, 4036 977 vs 30, February owners 4075–4081) are listed in §6.11.1 "Ledger anchor owners". Accept, or ask for a heavier generator.
5. **SQ-M14-05 M05 test hook.** `gamificationSession` needs the new M05 hook `mock.addSession(userId, {mode, correct, total, timeSpentSec, at})` (XR-M14-01(e)); the pager hook `addSessions` is not overloaded.
