# Open issues that look obsolete (22 Oct 2026)

Prepared by AZ-DevOps for the LEAD (AZ-26 housekeeping). **Nothing has been closed.** The LEAD decides. Evidence was checked against `feature/v2-backend` @ `23c98226` and the open PR list on 2026-10-21 ~21:00 UTC. "On tip" means `git merge-base --is-ancestor <sha> origin/feature/v2-backend` returned true.

## Recommended to close now

| Issue | What it was | Evidence it is done or superseded | Recommendation |
|---|---|---|---|
| #45 | [XL] Bijak stack cross-PR check (#36 #39 #41 #42 #43), 20 Oct: C1–C5, M1–M9, m1–m8 | The stack is merged, and so are the integration fixes it asked for. On tip: `apps/api/src/modules/bijak/integration/` (`bindings.ts`, `integration.module.ts`, `poc-question-source.ts`, `performance-bijak-aggregate.ts`), which covers C1 and C2. Also on tip: commits `dc7bcf4d` (#45 M1, M2, m4) and `6a1983b5` (#45 C2, M8). `docker/api/Dockerfile` copies `packages/exam-core` (C4). The aggregate `school_id` is migration `0018_aggregate_school_id` via #50, merged in `01c47e75` (M5). C5, the student UI on the mock, is handled on the frontend track: Bijak http specs tagged `@api` on `be/integration-frontend` (`f1f749a0`). | **Close as completed.** It was a point-in-time check of PRs that have since merged. Any residual item is tracked in #78. |
| #63 | [XL] Group B batch 2 merge recipe on `01c47e75` | Superseded by the batch-3 recipe #68, which re-merged the same PRs (#52 #57 #55 #53 #58) on a newer base. Batch 3 landed on tip (`7bdebea7`, tracker `2f3b8311`). | **Close as superseded by #68 / batch 3.** Its M2/M3/m1–m3 behaviour notes went into #78. |
| #68 | [Group B] batch-3 re-integration recipe | Batch 3 is merged: `be/groupb-batch3-reint` @ `7bdebea7` is on tip, and the backend-tracker change log records "LEAD merged batch3 via be/groupb-batch3-reint 7bdebea7". | **Close as completed.** |
| #75 | [cross-lane] BE-42 PKSK additive adapters in questions/practice/subscriptions (awareness notice) | BE-42 is merged: `be/BE-42-pksk` merge `3534555c` is on tip, with migrations `0028_pksk` and `0031_pksk_question_kind`. The backend tracker has BE-42 `done`. The notice asked only for replies if files were being edited at the time. | **Close as completed.** It was also on half AM's housekeeping list (AM-15/17 "close #75"). |
| #76 | [cross-lane][privacy] BE-23 leaderboard exposed pupils' full names nationally | Fixed in PR #77, merged 2026-10-21 09:22 UTC. On tip: `4a84c194`, `44a51e37`, `597cc25c`, and contract `2f150d0a` (leaderboard `userId` nullable). The same rule is applied to the games rankings in `a3c05270` (BE-45). | **Close as completed by #77.** |
| #94 | [gap BE-33] session audit rows have no `target_type`/`target_id` | Fixed by `a8f5b802` (on tip, merged via `2b0a9445`). The DB run on #94 (21 Oct 13:57 UTC) gives `audit-coverage.spec.ts` 37 passed, with the BE-03 test now a normal `it`. No `it.fails` is left for BE-03. | **Close as completed.** Half AM owns it (AM-01), so leave the closing to them or close it with a pointer to the DB run. |
| #100 | [gap BE-33] `POST /practice/sessions` not strict (**found in this sweep**) | Fixed by PR #106, merged 2026-10-21 13:40 UTC (`4b7fb987` on tip). That commit makes the start body strict, removes the row from the `it.fails` list in `sampled-domains.spec.ts` (the list on tip has only `/admin-sekolah/guru`, `/admin/articles`, `/me/notifications/bulk-read`, `/tiket` and `/auth/register`), and adds an unknown-field test in `start.spec.ts`. | **Close as completed by #106.** #97, #98 and #99 stay open: they are D63 go-live exceptions. |

## Close once a small remainder is done

| Issue | What it was | Evidence | Recommendation |
|---|---|---|---|
| #95 | [gap BE-33] password-reset audit rows miss the actor's role and scope | The code and test are fixed: `a8f5b802` is on tip, and the DB run on #95 passes with no `it.fails`. The issue's acceptance check also asks for a deviations row: "the request row has no actor, by design". `git grep` of `docs/architecture/v2-backend-deviations.md` on tip finds no such row. | **Close after half AM appends that deviations row** (AM-02). The test part is done. |
| #61 | [QA] Demo rehearsal on `01c47e75` + #56 (20 Oct) | The blockers B1–B4 and M1–M4 are resolved (#60, #62, `155cf001` composite builder source, #65). The thread ends with B4 merged on 20 Oct. Three minors are still open on other tracks: m4, the 70-character index name, is AZ-22 #132, still open. m1 (answered counts) and m2 (student 200 on `/performance/school`) are half AM's AM-12. | **Close after #132 merges**, with a pointer to AM-12 for m1/m2. You could also close it now, because each remainder has its own queue item. |
| #70 | [cross-lane] index on `practice_answers(answered_at)` | AZ-13 PR #127 (migration 0040) implements it and is still open. | **Close when #127 merges.** Not obsolete yet. |

## Keep open

| Issue | Why |
|---|---|
| #67 | The AZ checker's merge-queue log. It is still in use (the LEAD correction of 22 Oct 01:16 MYT is there). |
| #78 | The LEAD follow-up backlog. It still holds open items: ClamAV, the shared throttle store, the 78-xx cards. |
| #97, #98, #99 | D63: accepted go-live exceptions, to be fixed after go-live. |
| #109, #113 | The half queues. |

Not checked: issues already closed. #96 is closed already.
