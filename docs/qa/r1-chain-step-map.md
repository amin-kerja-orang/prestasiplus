# R1 chain QA: step to spec map (lane A3)

Scope: the R1 acceptance chain, from the admin uploading questions to the pupil's "Cuba Lagi".
Verified on a local, throwaway stack of the builder branches over BASE-105 (`7ea2208c`). The stack was never pushed.
The only new code is `apps/api/test/r1/chain-intake-to-pupil.spec.ts` on branch `r1/r1-chain-qa-a3` (based on BASE-105 alone).

Abbreviations: `pc` = `apps/api/test/r1/pipeline-chain.spec.ts`; `bp` = `apps/api/test/exam-builder/builder-placements.spec.ts`; `br` = `builder-review.spec.ts`; `bb` = `builder-blockers.spec.ts`; `pa` = `publish-acs.spec.ts`; `ci` = `apps/api/test/r1/chain-intake-to-pupil.spec.ts` (new).

## Stack (merge order, all `--no-ff`)

| # | Branch | Head | Conflicts |
|---|---|---|---|
| 1 | r1/reqc021-followup | 948aa327 | none |
| 2 | r1/ha18-gate-facts | fc409ae1 | none |
| 3 | r1/req-c012-a2 | dc3bfae8 | none |
| 4 | r1/reqb032-pinned-rule | a2cb5bb4 | none |
| 5 | r1/reqb052-archived-edit | f3a2448f | none |
| 6 | T48 (builder parity) | 6c5ae3a8 | none |
| 7 | T43b | 7a14581a | none |
| 8 | builder-search-perf | 1216b736 | none |
| 9 | T51 (taken at 54f63116) | 54f63116 | one |

Stack tip: `8c8523d8` (local only, detached). Migrations on the stack: 0104 (T48) and 0105 (H-A18), no number clash.

The only conflict was at step 9: `docs/architecture/v2-backend-deviations.md`, table rows appended at the end of the file by both sides. Resolved mechanically by keeping both sides. `contract:check` ok, api tsc 0.

## Counts on the stack (one vitest at a time, flock lock)

| Folders | Files | Passed | Todo | Failed |
|---|---|---|---|---|
| test/r1 + test/bijak-integration | 15 | 165 | 2 | 0 |
| test/exam-builder + test/bijak-kuiz | 27 | 465 | 0 | 0 |
| test/bijak-attempts + test/questions-workflow | 35 | 478 | 0 | 0 |
| `ci` alone (10 tests) | 1 | 10 | 0 | 0 |

`ci` is also 10/10 on BASE-105 alone.

## Step to spec and test name

| Step | Spec and exact test |
|---|---|
| Admin uploads, intake or import | `test/intake-workflow/flow.spec.ts` "upload, extract, review, edit, accept: a Draf question exists with provenance". Figure to one group with its image: `figure-image.spec.ts` "accept stores a question_image copy of the crop, linked to the one stimulus the two questions share". CSV import: `test/questions-workflow/imports.spec.ts`. Studio create: `pc` "creates the image stimulus and the passage stimulus ... then the two groups" and "creates three solo MCQs ... and one structured/essay question with a marking scheme". |
| Intake item to approve | `intake-workflow/cognitive-level.spec.ts` "an MCQ item with a level is accepted into a leaf ... and the SPM approval passes the gate". `ci` tests 1 to 3. |
| Approve gate, T33 DSKP | `questions-workflow/dskp-gate.spec.ts` "gate-check lists the missing cognitive level (Bahagian copy, step 3) and the kertas (step 1) ..." and "once the leaf has its level and the kertas is set, the gate passes ...". `bulk-approve-gate.spec.ts` "a DSKP-incomplete question ... is refused per row". `pc` "a question without the DSKP-complete data cannot be approved ...". |
| Approve gate, H-A18 Bab | `gate-facts.spec.ts` "9. the bulk Semakan runs the submit gate per row: a refused draft is a failed[] entry, a clean one moves" (noChapter case). `lifecycle-bulk.spec.ts` "moves the passing questions and reports the rest with code and fields". `gates.spec.ts` "chapter set" row. |
| Approve to servable, activities | `pc` "review -> approved -> (published) through the bulk-action route; every question ends servable". `pc` "a solo approved MCQ is served in Databank, Latih Tubi SPM, Simulasi Kuiz and Simulasi (kertas)". |
| Contract made Disahkan | `pc` "verify is refused without evidence, then Disahkan with a body-format (LPM) evidence item that states every compared value". |
| Section pool tags | `br` "once tagged, Terbit no longer reports 'bukan dalam kolam bahagian ini'". `pc` "tags the section pools of the questions". |
| Build: sections, pool, search | `bp` "builds a paper from approved questions, reviews it, Terbit; the student lists, opens and can sit it". Pool offers a group as one unit: `bp` "the section pool offers a group as ONE unit with the stimulus once". Search: `bp` "the text search covers the whole candidate set ..." (both variants) and `test/exam-builder/pool-text-search.spec.ts` (SQL vs describe, equal). |
| Build: D90 groups | `bp` "placing ONE member places the whole group, contiguous in group order", "removing one member removes the whole group", "reordering moves the group as a unit ...". `br` "D90: a group with no displayable stimulus is still a group". `pc` "places the passage group as ONE unit". |
| Build: D93 and review blockers | `br` "D93 ... a stimulus group with fewer than two members". `bb`: "D93: a one-member group is a hard GROUP_MIN_MEMBERS", "R1E2E-06: a question pupils cannot be served is a hard NOT_SERVABLE", "a missing-from-pool question (UNKNOWN_QUESTION) is hard ...", "NO_KEY: ...", "NO_MARKS: ...", "MODE_NOT_ALLOWED: ...". Override mix: `br` "never overrides a question or structure error". `pa` "AC-07.4 the publish checks list every violation". |
| Build: T48 parity | `builder-parity.spec.ts` (cover code, Pilih N, add section/question, delete question, pinned, stimulus edit), `semak-kertas-acs.spec.ts`. |
| Terbit, contract gate | `br` "R1E2E-07 / AC-R1-16.2 ... a paper on a Spec contract is refused ...; the audited override publishes it". `pa` "the blueprint gate: a contract that is not Disahkan is BLUEPRINT_NOT_VERIFIED (overridable) ...". `pc` "Terbit: the publish answers ok and the paper is Terbit". |
| Pinned version | `bp` "pinned versions stay after a question edit; a draft pins the version in force when placed". `pa` "AC-07.9 a question edited after Terbit does not change what the paper serves ...". `r1/pinned-version-rule.spec.ts` "a new version is approved (version 1 is superseded): the sitting keeps version 1, and so does its grading". `questions/archived-edit.spec.ts` "admin PUT (update): the pinned version stays byte-identical ...". `ci` test 6 (every placement pins version 1). |
| Pupil sits | `pc` "sees the paper in the Bijak SPM list and on its cover" and "starts an attempt: the group stimulus is served ONCE with both members; no answer key leaks". `pc` "the group image file is readable by the pupil once its member question is live (R1-B20) ...". `ci` test 7. |
| Submit, marking | `pc` "answers every question and submits" and "sees the result: MCQs auto-marked, the structured part waits for self-mark with a suggestion". `ci` test 8. |
| Self-mark | `pc` "self-marks the structured part (b12) and the total is recomputed". `bijak-attempts/self-mark.spec.ts` "R1-B12 self-mark" cases. |
| Reward on submit | `bijak-integration/flow.spec.ts` "3. credits the wallet once ..." and "3b. adds the XP ... touches the streak". `rewards.spec.ts` "WalletBijakReward.award" cases. No second reward on self-mark: `self-mark.spec.ts` "records the change to the performance aggregate (regraded) ... without a second reward". `ci` test 8b (first reward assertion on a bank paper). |
| Cuba Lagi | `pc` "Cuba Lagi: a NEW attempt on the same paper; the old attempt, its result and its history row stay". `self-mark.spec.ts` "R1-B15 Cuba Lagi". `ci` test 9. |
| Withdraw | `pa` "AC-07.7 ... a submitted attempt and its result, and an in-progress retry, survive a withdraw". `pc` "a draft paper is not visible to a pupil; a withdrawn paper is gone ...". |
| Archive or edit of a pinned question (B-052) | `questions/archived-edit.spec.ts` (5 tests). |

## Gaps closed by `chain-intake-to-pupil.spec.ts`

1. Intake to builder to pupil was never joined. `pipeline-chain` creates its questions through the Studio API and the intake specs stop at "approved". `ci` (10 tests: 1 to 9 plus 8b) runs a six-draft PDF through the scripted extractor, accepts, gets one figure group with its own `question_image`, approves under the gates, builds a paper where placing one member places the whole group, publishes with version 1 pinned on all six placements, then the pupil is served the stimulus once with a readable image URL, submits (6 of 6) and presses "Cuba Lagi" (new attempt, old result unchanged). The Bab is set by SQL, so the spec is green with and without the H-A18 gate.
2. Reward on a bank paper. The submit reward was proven only on the PoC papers. `ci` 8b asserts exactly one `quiz_spm` ledger row for the attempt, XP of at least 60, a streak of 1 or more, and that a replayed submit adds no row.

## Remaining sub-steps without a chain spec

- The explicit Bab refusal ("Sila pilih bab.") is covered per row by `gate-facts` and `lifecycle-bulk`, not as a chain step.
- No chain spec asserts the self-mark reward after a self-mark on a structured question. The halves exist separately: `self-mark.spec.ts` (no second reward) and `flow.spec.ts` (reward at submit).
