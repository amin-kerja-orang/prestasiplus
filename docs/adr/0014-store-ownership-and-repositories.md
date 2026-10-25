# ADR-0014: One owner per shared store, reached only through the owner's repository (implements D12)

- **Status:** Proposed. Implements project decision **D12** (Delivery Lead, 2026-09-25).
- **Date:** 2026-09-25
- **Related:** `docs/qa/audit/cross-module-logic-M01-M07.md` (XL-01, XL-03, XL-04, XL-07, XL-11, XL-19, XL-23), ADR-0009, ADR-0013, overview §6.7–§6.8

## Context
The XL review found parallel schemas for one store: M05 and M06 defined two practice-session schemas (XL-03). SPM questions lived outside the question store (XL-01). Consumers declared fields the owner did not define (XL-07, XL-08, XL-23). Write paths skipped the owner's side effects: SPM submit did not write the answer log, queue, mastery or wallet (XL-04), and revision served deactivated questions (XL-19). D12 decides: each shared store has exactly one owner module, and other modules read and write only through the owner's contract.

## Decision
1. **Repository per shared store**, defined in the owner module's `mock/repository/`, exported from `mock/index.ts`. It is the only writer of the store and the only public doorway to it. It exposes **domain methods** (not raw tables) that carry the owner's rules.

| Store | Owner | Key contract (examples) |
|---|---|---|
| Users, auth sessions | M01 (base) / M02 (admin extensions); canonical accounts seeded by mock core | `users.get`, `findByEmail`, `me`, `search`, `isSubscribed`, `trial`, `incrementTrialUsed` |
| Schools, JPN/PPD | M02 | `schools.search`, `get`, `options` |
| Curriculum (levels, subjects, chapters, topics, subtopics, legacy topics, topic progress **derived on read** from the M05 answer log, M03 v1.6 BR-19) | M03 | `curriculum.subjects`, `levels`, `chapters`, `topicProgress` (computed from `practice.answers`) |
| DSKP catalogue (13 subjects, Tingkatan 4 and 5: unit, SK, SP, TP descriptors; read-only, generated at build time, ADR-0022) | M03 | read through `dskpCatalog` (`subjects`, `load`, `loaded`, then `DskpSubjectView`: `units`, `sps`, `skOf`, `tpFor`, `search`); no repository, table or seed |
| Questions (objective, SPM pool rows, PKSK rows), structured questions, reports | M04 | `questions.get/getMany/count/groupCount`, `eligibleForPractice`, `sample`, `gradeAnswer`, `deactivate`, `contributeAnchors`; `structured.list/get`; `reports.create/…` |
| Practice sessions (all modes incl. SPM), answer log, revision queue, mastery counters, SPM targets, structured attempts | M05 | `practice.startSession`, `checkAnswer`, `completeSession`, `history`, `answers`, `queue`, `mastery` |
| Wallet, streak | M14 (**provisional in M05**) | `wallet.credit`, `wallet.summary`, `streak.get` |

2. **Session write path** (M05 FR-M05-51…55, BR-06/07/09/10/14/20, BR-31). Session status is `in_progress | completed` (M05 v1.3). Both M05 and M06 pages use the **M05 endpoints** #4–#6 (and #23 for mode-filtered history); M06 has no session endpoints (M06 v1.3). The handlers call:
   - `startSession`: trial check (BR-07), selection through `questions.eligibleForPractice` + `sample` (BR-04/13/17);
   - `checkAnswer`: grade through `questions.gradeAnswer`, store one check per question, trial +1 when not subscribed;
   - `completeSession`, in **one transaction**:
     1. regrade;
     2. write QuizAnswer rows (BR-06);
     3. set the session `completed` with its totals and coins;
     4. update the revision queue (BR-14);
     5. update the mastery counters (BR-20);
     6. credit the wallet with coins = correct and points = 10 × correct (BR-09);
     7. credit quest rewards once per quest per day (BR-10, INFERRED);
     8. return the streak value (BR-08).
   - Abandoned sessions record nothing. A second submit returns 409.
   - M06 reads the same schema through the M05 field map (`type` → `mode`, `total` → `questionCount`, `durationSec` → `timeSpent`), as XL-03/XL-04 require. M06 mock exams stay M06-owned `MockExam` records.
   - Topic progress is not written: M03 derives it on read from the answer log (BR-19).
3. **Contributions:** a non-owner module that must seed rows in a store it does not own (M05 practice questions, M06 SPM pool, M07 PKSK rows, M08 fixtures) calls the owner's `contributeAnchors` during the seed phase. The owner validates them against its schema, and they count within the owner's totals (ADR-0013).
4. **Provisional stores:** when the owner module is not yet built (M14 wallet, M19 trial rule), the first consumer defines the store with `owner: 'Mxx', provisional: true` and the same repository contract. The owner's build task moves it without changing the contract.
5. **Enforcement:**
   - ESLint forbids importing another module's `mock/tables`, `mock/datasets` or `mock/seeds`;
   - a boot check fails if two plugins declare a store with the same name;
   - repository unit tests assert the owner invariants for every consumer path (e.g. an M06 `completeSession` updates M05 S6, S8, S9 and S12 figures).

## Alternatives considered
- **Shared global schema file (`src/mock/schema.ts`) with open table access:** it becomes a merge hotspot, and nothing stops modules from bypassing rules. This is what produced XL-03/XL-04.
- **Each module owns a copy and syncs it:** duplicate truth, and more contradictions.
- **Events or a pub-sub between modules for side effects:** hidden coupling and ordering issues. A direct transactional repository call is simpler and deterministic.

## Consequences
- One schema per store and one place for each rule. Cross-module flows (report → deactivate → practice eligibility; SPM submit → history, revision, mastery) are correct by construction.
- Owner modules' repositories must exist before consumers are built. The shared-store repositories are therefore **foundation tasks** (build plan F-23…F-27), built inside the owner modules' folders ahead of their UI.
- The backend phase maps each repository to a service with the same responsibilities.

## Amendment 1 (2026-09-26, overview v1.4 §6.7.1, build-plan v1.6)

Recorded after F-10 was built and the W0.4 review. Delivery Lead decisions.

1. **Framework as built.** `defineRepository({owner, provisional?, name?, store, stores?, queries?, validateAnchor?, methods?, registry?})`, imported from **`@/mock/repository`** (not re-exported from `@/mock/define`). Every repository exposes its domain methods, the named-query methods `count` / `groupCount` / `query` / `sample` / `where`, and, for a virtual dataset, `contributeAnchors`. These names are reserved. `withZeroCounts` fills the zero groups that `groupCount` omits.
2. **Lifecycle.** `contributeAnchors` is allowed only in `seed(ctx)`; dataset reads start in `finalise(ctx)` and throw `PHASE` before it.
3. **Enforcement (extends Decision 5).** A runtime ownership guard refuses every write to a guarded store that does not run inside a repository method of its owner (`OWNERSHIP`). `assertRepositoryConventions(plugins)` runs at boot (export and store-registration rules). Repository names are unique (`DUPLICATE_REPOSITORY`).
4. **Owners also write through their repository.** When a store has a repository, the owner's own handlers and seeds write it through that repository too, never through the raw store (overview §3 rule 3a).
5. **Synchronous methods.** Repository methods and `ctx.transaction` are synchronous; the owner scope ends at the first `await`.
6. **`count` is reserved for named queries.** A filter count is a domain method named `countWhere(filter)`. Contract text such as `questions.count(filter)` means `questions.countWhere(filter)` (overview X-11).
7. **Cell contributions (extends Decision 3).** A non-owner that contributes distribution cells (the M06 SPM pool: "cells plus anchors") calls an explicit owner method that wraps the dataset's `overrideSpec`, e.g. `questions.contributeCells(contributor, cells)`. It is callable only in the seed phase and the owner validates the cells. No module calls `overrideSpec` directly.

## Amendment 2 (2026-09-27, overview v1.6 §6.7, §6.7.2, §6.8, build-plan v1.8)

Delivery Lead decisions on XL batch 3 (XL3-03, XL3-23, R2-11). They change the Decision 1 table and Decision 2 step 6.

1. **The wallet belongs to M14, not to M05.** M14 owns the student wallets, the coin ledger, tiers, streak, daily challenges (quests), achievements and learner badges, referrals, teacher wallets, draws and settings. Its contract (M14 §7.1) includes `wallet.summary`, `streak.get`, `challenges.today`, `learnerBadges.forUser`, `gamification.onSessionCompleted`, `gamification.onLogin`, `gamification.onGameResult` and `gamification.canEarnSyiling`. The provisional wallet in M05 is withdrawn before it is built. `wallet.credit` survives only as a delegating shim.
2. **Session completion step 6 (replaces items 6–8 of Decision 2).** `practice.completeSession` calls `gamification.onSessionCompleted({userId, sessionId, mode, correct, total, timeSpent, completedAt, pointsEarned, coinsPerCorrect?})` inside the same transaction and stores the returned `coinsEarned`. Coin rates, quest rewards, streak and achievements are M14 rules.
3. **New owner stores and contract items.**
   - M05: KirkpatrickSessionAggregate, PupilSubjectAccuracy, the modes `mission`, `remedial`, `question_set` and `pksk`, and the hooks `mock.addSession` and `mock.addAnswer({…})`.
   - M04: `jutawanQuestions` (`questions.jutawan.*`), `coverageExcluded` and the ImportRun set.
   - M08: ItemStatistic.
   - M16: battles and game results.
   - M03: the chapter flag `inTree`.
4. **Provisional owner contracts for unspecified modules.** M26 owns mood check-ins and tuition centres, and M21 owns sponsors. Their only seeding reader, M17, declares them now with `owner: 'M26'` or `'M21'` and `provisional: true`. The owner's build task moves them unchanged.
5. **Call-time reads across modules.** A repository may call a repository of a module later in the registry (M05 → M14, M14 → M05). It does so inside methods at call time only, never at module load. Seeds keep `dependsOn` to earlier modules only.
