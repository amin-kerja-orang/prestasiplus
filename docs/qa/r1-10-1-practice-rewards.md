# R1-10.1: what a practice submit writes (Latih Tubi, Databank, Ulang Kaji)

Status: current behaviour at BASE-105, pinned by `apps/api/test/bijak-integration/practice-rewards.spec.ts`.
This is a characterisation of what V3 does today, not a statement of the V2 rule. The V2 `PracticeRecorder.php` is not in the repo.

Modes: Latih Tubi = `latih_tubi`, Databank = `past_year`, Ulang Kaji = `revision`.

## What a submit writes (all in one transaction)

Path: `practice.service.ts:239` `submit` -> `practice.repository.ts` `completeSession` -> `WalletPracticeReward.onSessionCompleted`.

| Item | Rule today | Where |
|---|---|---|
| Replay guard | A session not `in_progress` is refused: 409 `ALREADY_SUBMITTED`; nothing is paid. | `practice.repository.ts:459` |
| Answers | Graded answers are copied to `practice_answers`; the temporary `practice_checks` are deleted. | `practice.repository.ts:496` |
| Session | `practice_sessions` row set to `completed` with `coins_earned` and `points_earned`. | `practice.repository.ts:499-512` |
| Syiling (stored) | 1 per correct answer (`correct`); a `mission` uses its own rate (default 3). | `rules.ts:60-61` |
| Points (stored) | `POINTS_PER_CORRECT = 10` per correct. | `rules.ts:48`, `practice.repository.ts:500` |
| Revision queue, mastery | Rewritten from the graded answers (Ulang Kaji removes a question answered right). | `practice.repository.ts:515-516` |
| Streak (kombo) | `streaks.touch(completedAt)`: +1 on a new Malaysia day after the previous day, reset to 1 after a gap, unchanged on the same day. No bonus syiling. | `bindings.ts:104`, `wallet/rules.ts:109-113`, `db/clock.ts:41` |
| Wallet credit | `wallet.credit` of the session coins, only when coins >= 1; one `coin_ledger` row keyed by the session id. A second call for the same key is a replay (no new row). | `bindings.ts:107-114`, `wallet.service.ts:175-176` |
| Ledger source | `quiz_spm` for `latih_tubi`, `past_year`, `ramalan`; `quiz_practice` for `revision`, `random`, `chapter`, mission, remedial, question set; `quiz_pksk` for `pksk`. | `practice/ports.ts:183-192` |
| Ledger description | "Latihan: jawapan betul". | `bindings.ts:20` |
| Session credit | `session_credits` row (coins, points, streak count, balance after), once per session. | `bindings.ts:115`, `wallet.service.ts:303` |
| Wallet XP total | **Not changed.** The 10 points per correct stay on the session and `session_credits`; `onSessionCompleted` never calls `wallet.addXp`. (Bijak paper submits do: `bindings.ts:74`.) | `bindings.ts:103-140` |
| Challenges, achievements | After the credit, in savepoints; achievements for practice modes only. They may pay their own bonus rows. | `bindings.ts:134,139` |
| Mod Pelajar | Streak is read, not moved; the credit is still written and stamped `is_test`. | `bindings.ts:104` |
| Response | `results.gamification` = coinsEarned, pointsEarned, streakCount, totalBalance. | `practice.service.ts:309-322` |

## Proof (spec) and mutation results

The spec runs the three modes on the real wallet, streak and reward binding (only the question bank is the in-memory fake). 19 tests: per mode 3 right, XP unchanged, 0 right, all right, second submit, reward-binding replay; plus the streak test.
Each assertion was checked by mutating the code, running the spec (red) and restoring:

| Mutation | Result |
|---|---|
| syiling per correct x2 (`rules.ts:61`) | 12 red |
| points per correct 10 -> 20 (`rules.ts:48`) | 9 red |
| `latih_tubi` falls to `quiz_practice` (`ports.ts`) | 2 red |
| description changed (`bindings.ts:20`) | 3 red |
| credit also for 0 coins (`bindings.ts:107`) | 3 red |
| practice submit also calls `addXp` | 6 red |
| streak guard removed (`wallet/rules.ts:110`) | 1 red |
| Malaysia day replaced by UTC day (`db/clock.ts:41`) | 1 red |
| `ALREADY_SUBMITTED` guard removed (`practice.repository.ts:459`) | 3 red |
| wallet replay check removed (`wallet.service.ts:176`) | 3 red |

## Open: not pinned (user decision pending)

- V2 `PracticeRecorder` rate for `latih_tubi`, `revision` and Databank. Only the paper rate is documented (2 syiling, 10 XP per mark, `docs/discovery/BIJAK-SPM-cloud.md:347`). The last observed V1 practice ledger is 1 per correct (`flat_quiz_reward` = 1; `docs/discovery/M14-gamification.md:580`), equal to ours. The older April-May 2026 rows paid 2-4 per correct.
- V2 kombo (streak) step and any streak bonus.
- Whether V2 practice credits the wallet XP (the client shows +10 mata; the admin XP contradicts it, `M14-gamification.md:612`). Today V3 does not; the spec pins "not changed".
- Whether `flat_quiz_reward` overrides the tier rates (inferred only).

If the decision changes a rate, the XP rule or the streak step, change this spec in the same commit.
