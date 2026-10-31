# R1 verify-first notes: AC-R1-07.1 (keyword suggestion) and AC-R1-10.1 (what a submit writes)

- **Task:** T46. **Date:** 2026-10-31. **Base:** BASE-6 (`21ae62dd`), plus the T28 reward branch where stated.
- **What the ACs ask** (`docs/requirements/v3-bijak-spm-scope.md`):
  - AC-R1-07.1: "before build, the owning developer records whether V3 `attempts/marking.ts` already seeds suggestions and reads the V2 `RubricKeywordMarker` rule; the result is written in the item's task note."
  - AC-R1-10.1: "the developer documents from V2 code (`PracticeRecorder`) what a submit writes (session, Prestasi feed, kombo, syiling) with the rules and amounts; no amount is assumed."
  - AS-2: where a V2 behaviour is unverified, the first AC of the item is a verification step, not an assumption.
- **Where the notes live:** the ACs name "the item's task note" but the repo has no task-note file for R1-B13 or R1-B14 (`docs/architecture/v2-admin-student-pipeline.md` lists the tasks only). Per the brief, both notes are in this file under `docs/qa/`.
- **Limit that applies to both notes:** the V2 source (`backend/app/Support/RubricKeywordMarker.php`, `PracticeRecorder.php`, `ExamSimulationController`) is **not in this repository** and was not read. Everything said about V2 comes from the repo's own discovery documents (`docs/discovery/BIJAK-SPM-cloud.md`, `docs/discovery/cloud-student-mechanism.md`, `docs/discovery/v2-parity/student.md`) and from the V2 file and line references quoted in V3 code comments. Anything beyond that is marked **unconfirmed**. Live V2 stays read-only.
- **No tests were run** for this note. Test names are cited from the spec files.

---

## 1. R1-B13 / AC-R1-07.1: keyword-suggested marks

### 1.1 Question and answer

| Question (AC-R1-07.1) | Answer | Evidence |
|---|---|---|
| Does V3 `attempts/marking.ts` already seed suggestions? | **Yes.** `marking.ts` imports `seedSuggestions` (line 35) and calls it at line 154, right after automatic grading, in the function that builds the graded result. `self-mark.ts:decorateResult` then adds the detail lines (`selfMarkable`, `suggestion`) without changing marks. | `apps/api/src/modules/bijak/attempts/marking.ts:35,154`; `keyword-suggest.ts:seedSuggestions`; `self-mark.ts` header and `decorateResult` |
| Does it read the V2 `RubricKeywordMarker` rule? | **It is a port of it.** `keyword-suggest.ts` states it is "a port of the V2 `RubricKeywordMarker` (backend/app/Support/RubricKeywordMarker.php)" and cites V2 line ranges `:98-130`, `:138-145`, `:68-70`, and the submit step `:408-414`. Whether the port is line-for-line equal to V2 is **unconfirmed** (V2 source not in the repo). | `keyword-suggest.ts` header and `seedSuggestions` comment |
| Earlier status | The parity audit recorded B13 as "unverified" before the build (`docs/discovery/v2-parity/student.md:37`: "Whether a keyword suggestion seeds subjective marks: unverified"). That row is superseded by the code above. | `docs/discovery/v2-parity/student.md` row B13 |

### 1.2 Rule comparison (V2 as documented in the repo, against V3 code)

| Rule | V2, as documented | V3 code | Status |
|---|---|---|---|
| Which parts get a suggestion | Only `mark_scheme_points` with a non-empty answer and no mark yet. `band_rubric` and `model_answer` stay pure self-mark (`cloud-student-mechanism.md:184`; `v2-parity/student.md:37`). | `seedSuggestions` skips any part whose scheme kind is not `points` or whose status is not `belum_dimarkah`, and any empty answer. Tests: "a rubric part is self-markable but has no suggestion" (`self-mark.spec.ts`). | Same |
| Tokens | Lower-cased, stop-words removed; a token counts as a keyword at 5 or more characters (`cloud-student-mechanism.md:184`; `BIJAK-SPM-cloud.md:363`). | `tokenize`: tags stripped, lower-cased, split on anything that is not a letter or digit, stop-words dropped; `MIN_KEYWORD_LEN = 5`. | Same by description. The V3 stop-word list is a fixed set (Malay and English function words in `keyword-suggest.ts`); equality with the V2 list is **unconfirmed**. |
| Match rule per point | A point matches when **any** token of length 5 or more is in the answer; numeric/short points need **all** digit tokens (`BIJAK-SPM-cloud.md:363`). | `pointMatches`: any significant token; else all digit-bearing tokens; short alphabetic words never match. | Same |
| Mark | Sum of the matched points' marks when the points carry marks, else proportional; clamped 0..max (`BIJAK-SPM-cloud.md:363`; `cloud-student-mechanism.md:184`). | `suggestFromPoints`: sum of matched marks if the points carry marks, else `round(max * matched / total)`, clamped 0..max. The code comment notes PHP `round()` and `Math.round` agree for non-negative numbers (not tested against PHP: **unconfirmed**). | Same by description |
| Answer text read | V2 reads `working` + `value` text (`BIJAK-SPM-cloud.md:363`). | `answerTextOf` joins steps, final and text. | Equivalent by intent; exact field mapping to V2 **unconfirmed** |
| When stored | At submit, stored as `awarded_marks` with `self_marked = true` **only when greater than 0**; a zero match stays null (`cloud-student-mechanism.md:184`). | At submit, a suggestion above 0 is stored as the awarded mark and flagged `autoSuggested`; a zero is not stamped. The part keeps status `belum_dimarkah` so the total stays provisional; a self-mark replaces it and clears the flag. | **Difference (flag):** V2 sets `self_marked = true`; V3 keeps the part pending and uses its own `autoSuggested` flag. Effect on the total is the same ("a matched answer counts at once"); the stored flag differs. |
| Determinism | Not stated. | Pure function; same answer gives the same suggestion (AC-R1-07.4). | V3 behaviour proven below |
| Known V2 weakness | Single-token, any-one-hit matching over-awards prose, misses short answers, ignores negation (`docs/requirements/v2-question-bank-oldsystem-findings.md:36`). | Same behaviour on purpose ("deliberately crude and generous SUGGESTION" in the code header). | Replicated (D9: it works, so replicate) |

### 1.3 Proof in V3 tests (names only; not run for this note)

- `bijak-attempts/keyword-suggest.spec.ts`: `tokenize`; `suggestFromPoints (V2 RubricKeywordMarker)`; "is deterministic: the same answer twice gives the same suggestion (AC-R1-07.4)"; `decorateResult`: "flags selfMarkable parts and adds no suggestion to a rubric part (AC-R1-07.3)".
- `bijak-attempts/self-mark.spec.ts`: "R1-B13 keyword suggestion in the result": "a matched suggestion is stored as the awarded mark, flagged autoSuggested, and the total stays provisional"; "no keyword match: nothing is stamped (awarded 0), the suggestion is 0 and the part is not betul (AC-R1-07.3)"; "same answer, same suggestion (AC-R1-07.4)"; "the suggestion is not in the live attempt view or the autosave response (nothing leaks before Hantar)".

### 1.4 Result recorded for the item

- V3 already seeds suggestions at submit and the rule is a port of V2's. R1-B13 needs **no new matcher**; the remaining work is only what AC-R1-07.2 to 07.4 already have tests for.
- Open and **unconfirmed** until the V2 code can be read: stop-word list equality, field mapping of the answer text, and the `self_marked` flag difference above. If the lead wants exact V2 flag parity, that is a D9 decision (the visible behaviour is the same).

---

## 2. R1-B14 / AC-R1-10.1: what a submit writes

### 2.1 What V2 writes on submit (from the repo's discovery documents)

| Item | V2 behaviour as documented | Source |
|---|---|---|
| Session / Prestasi feed | On submit and on **every self-mark**, one aggregate `practice_sessions` row is written or updated with `client_uuid = 'exam-attempt-{id}'` (idempotent), because "all reports, Prestasi and syiling read that ledger". | `BIJAK-SPM-cloud.md` section 4.5 (`ESC:471-553`) |
| Mode written | Native paper: `spm_tahun_lepas`, `paper1` if kertas is 1 else `paper2`; Tracking A composite: `spm_ramalan`; any other composite (Set Builder, Jana set): **not bridged**. | `BIJAK-SPM-cloud.md` 4.5 table |
| Units | Native paper: **marks** (`maxScore` / `recomputeScore`); Tracking A: counts of objective parts. | same |
| Syiling | `PracticeRecorder::SYILING_PER_CORRECT = 2` per correct unit (per **mark** for native papers). | `BIJAK-SPM-cloud.md` 4.5 (`PracticeRecorder.php:27-31,77-98`) |
| XP | `XP_PER_CORRECT = 10` per correct unit. | same |
| Later self-marks | "Add only a positive delta, never claw back." | same |
| Kombo (streak) | **Not documented step by step in the repo.** The only statement is that `PracticeRecorder` returns "Ganjaran Anda (syiling, kombo, mata, baki)" for latih tubi (`docs/discovery/v1-question-activity-baseline.md` row R13). | **unconfirmed** for the paper submit |
| Latih tubi result | Marked in the browser; the page posts to `PracticeRecorder::record` with mode `latih_tubi` (or `revision`). | `cloud-student-mechanism.md` lines 216, 239 |

### 2.2 What a V3 exam-mode submit writes

Source: `apps/api/src/modules/bijak/attempts/attempts.service.ts:emit` (runs after the commit; a failing port never fails the submit), `marking.ts` (display values), `integration/bindings.ts`, `practice/aggregate/aggregate.service.ts`.

| Item | V3 at BASE-6 | After T28 (`origin/r1/t28-bijak-rewards`, not in BASE-6) | Note |
|---|---|---|---|
| The sitting | `attempt_results` row, status `submitted` / `auto_submitted`, once per attempt (replays and concurrent submits keep one row). | same | Tests in section 2.4 |
| Prestasi feed / session | `PracticeAggregateService.recordGraded` writes **one** `practice_attempt_aggregates` row per attempt (`source`, `attempt_id` unique; subject, kertas, mode, status, units awarded and max = **marks**, duration, `start_type`, provisional, `is_test`, school snapshot) plus per-question items; a replay changes nothing; a regrade (a self-mark) updates the same row and its items. Prestasi reads exams from `exam_attempts` / `attempt_results` (`integration/performance-bijak-aggregate.ts`). | same | **Difference from V2:** V3 does not write a `practice_sessions` row for a paper; it has its own aggregate table. The V2 mode name `spm_tahun_lepas` is not written for papers. |
| Syiling | `WalletBijakReward.award`: ledger credit, `source = 'quiz_spm'`, `sourceId = attemptId`, amount = `floor(coins)` where `coins = score * 2` (`marking.ts`: `coins: score * 2`). Zero or less credits nothing. Exam mode only; a latihan attempt never earns; an abandoned attempt never earns. | same rate | Rate equals V2's 2 per mark. |
| XP | `points = score * 10` is computed but **not credited** at BASE-6. | `wallet.addXp(points)`, added only when the syiling credit was new, so a replay never pays XP twice. | Rate equals V2's 10 per mark. |
| Kombo (streak) | **Not touched** at BASE-6. | `streaks.touch` on the day the attempt closed, idempotent per day; a zero score still counts a closed exam. | Rule is **unconfirmed** against V2 (see 2.1). The T28 code comment says the same. |
| Mod Pelajar (`isTest`) | No ledger row, no balance, no XP, no streak (AC-20.3). | same | |
| Later self-mark | Updates the aggregate row and the score columns; **no reward is added or changed** (spec: "without a second reward"). | same | **Difference from V2, now decided (D94, user, 2026-10-31; `docs/TRACKER.md` on `origin/r1/d91-decisions`):** V2 adds a positive delta on a later self-mark. D94 says V3 follows V2 with a cap: when a self-mark raises the score the pupil earns 2 Syiling + 10 XP per mark gained, positive delta only, once per part, never above the part's full marks; a lower mark claws nothing back. This supersedes the "frozen at submit" rule for rewards only. **Not built yet: lane A1 builds it as T38.** Until T38 lands, a V3 pupil who raises a mark after the submit gains Prestasi but no extra syiling or XP. |
| Cuba Lagi | A new attempt, a new reward key (`attemptId`). | T28 comment: "Cuba Lagi is a new attempt and earns again, as V2 does" (lead decision recorded there). | No double award for the same attempt. |

### 2.3 Kuiz and Databank sessions (AC-R1-10.4)

- A finished Kuiz stores a practice session, feeds the revision queue and calls the practice reward port once (`bijak-kuiz/kuiz.spec.ts` tests 11 and 12).
- A practice session (including the Databank mode, stored as `past_year`) goes through `WalletPracticeReward.onSessionCompleted`: streak touch, an idempotent credit of the **session coins**, then achievements and challenges for practice modes. Session coins are **1 per correct answer** (`practice/rules.ts:sessionCoins`; a mission uses its own rate) and points are **10 per correct** (`practice/submit.spec.ts`: "points are 10 x correct, the session keeps coins = correct"). The ledger source follows the mode (`quiz_spm` for the SPM modes).
- The V2 rate for latih tubi / Databank results is **not documented in the repo** (only that `PracticeRecorder` returns syiling, kombo, mata, baki); whether V2 pays 1 or 2 syiling per correct there is **unconfirmed**. The 2-syiling figure in `BIJAK-SPM-cloud.md` belongs to paper submits.

### 2.4 Proof in V3 tests (names only; not run for this note)

- `bijak-integration/flow.spec.ts`: "2. writes exactly one aggregate row with subject, kertas, marks, start type, duration and is_test false"; "3. credits the wallet once: one quiz_spm ledger row with the result coins"; "4. replaying the submit ... is a replay: one ledger row, same balance, one aggregate row"; "5. latihan: writes an aggregate row but no ledger credit"; "6. Mod Pelajar: ... credits NO reward (AC-20.3)". T28 adds "3b. adds the XP of the result once (10 per mark) and touches the streak (kombo)".
- `bijak-integration/rewards.spec.ts`: "WalletBijakReward.award: credits once per attempt, refuses the same attempt with another amount, and ignores zero coins"; "floors a fractional amount". T28 adds XP-once, streak-per-day and Mod Pelajar no-XP/no-streak tests.
- `bijak-attempts/self-mark.spec.ts`: "records the change to the performance aggregate (regraded) and the score columns, without a second reward".
- `bijak-attempts/attempts.spec.ts`: "submit 5. a failing reward port never fails the submit"; `attempts-hardening.spec.ts`: "F3: a latihan submit does not call the reward port; an exam submit calls it once".

### 2.5 Result recorded for the item

- V3 writes the same **kinds** of records as V2 except: the Prestasi feed is `practice_attempt_aggregates` (not a `practice_sessions` row), a later self-mark pays nothing extra today (V2 pays a positive delta; D94 decides V3 follows it with a cap, built as T38), and XP and kombo exist only after T28.
- Amounts: syiling 2 per mark and XP 10 per mark match the V2 figures in the repo's discovery document. No other amount is assumed.
- **Unconfirmed** (needs the V2 code): the kombo step of `PracticeRecorder`; the V2 rate for latih tubi / Databank sessions; the exact V2 cap rule of the self-mark delta (D94 states the V3 rule: once per part, never above the part's full marks).
- Decided since this note was first written: the later-self-mark reward follows V2 with a cap (D94), built by lane A1 as T38; Cuba Lagi earns per attempt (D93, T28 comment). Still open: merge T28 before sign-off so XP and kombo exist at all.
