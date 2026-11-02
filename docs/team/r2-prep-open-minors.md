> **R2 preparation only, read-only (A1b, 02 Nov).** These are open B2/B3 Minor/Nit/Info findings on team A units (BASE-140..189) that are not yet recorded. No code. Since then, the REQ-B-071 doc/comment/in_tree minors are fixed (reqb071-minors c38ee66c; A3 docs) and the 0106/0107 runbook entry is on ac-gaps.

# Open Minor / Nit / Info findings on team A units (BASE-140 onward)

Sources read: `status/B2.md` Log (cycles 19-29), `status/B3.md` Log (cycles 42-46), `requests/from-B.md` (rows marked "not a merge blocker" / OPEN),
`MERGE-LOG.md` BASE-140..189, all on `team/r1-board@b699f861`. Cross-checked against `docs/release/r1-kiv-r2.md` (38 rows, base 1216dbe7) and
`docs/architecture/v2-backend-deviations.md` (dev) on BASE-189.

Limit: for most "Approve w/ Minors" verdicts the status files give only the verdict, not the itemised Minors (the per-cycle detail stops at cycle 18).
Those are listed as "not itemised" and need B2/B3 to say what they were. Findings below are the ones the logs and from-B actually name.

Legend: KIV = in r1-kiv-r2.md; DEV = in a deviation row; FIXED = closed by a later merged unit (BASE number or branch).

## A. Named findings, still open and not recorded in KIV (add to KIV or fix)

| # | Finding | Unit @ head | Source | KIV | DEV | Suggested owner |
|---|---|---|---|---|---|---|
| 1 | Other routes run the same free-text search outside the `questions-list` rate bucket (AL-L1) | admin-list-perf 6389cd54 / 69f465c8 | B3 c44 | no | no | A4 |
| 2 | 0110 does not check file ownership of the reference image; published papers are not re-audited (A13-L1) | REQ-A-013 a2acf754 (team C unit, A ops/DB) | B3 c44 | no | no | C1, A ops for the audit |
| 3 | `count` of a filter bulk action is not a set; the summary audit row is written after the run (BF-L1, BF-L2) | REQ-A-021 1cbbeb57 with T49 8cb9fa5f | B3 c44 | no | no | A2 (T49 server side) |
| 4 | Guru dismissal of an exact duplicate link is self-attestation; the approving admin sees no warning (Info) | H-A18 a9ffe246 | B3 c45 | no | no | A2 |
| 5 | Control removes the pin and the sitting together (E05B-L1, Low) | E05B 4b9eac57 | B3 c43 | no | no | A3 (unit owner) |
| 6 | `GET /files` contract text says staff only, but pupils may read images served on a published paper (doc drift) | T10 bf78ca93 (C unit; contract text is A) | B3 c42 | no | no | A (contract owner), C1 informed |
| 7 | Only 4 reads limited in `servability-reads.service.ts:121-133` (rate limit coverage of servability reads) | A4 chain tip 6f2fb793 | B2 c20 | partly (row 26 names three other t45 Minors) | no | A4 |
| 8 | Release notes and QA docs still say Bab is required; Q17 evidence is inference (direct evidence `M10-teacher-class.md:363,256`); Q17 path should be `docs/requirements`; stale comment `imports.service.ts:61`; `chapterOfUnit` has no `in_tree` filter | REQ-B-071 4e38af8e, chain specs ee9474e0 | B2 c29, from-B REQ-B-075 | row 49 text itself is on the stale list | no | A3 (docs), A2 (`imports.service.ts:61`, `chapterOfUnit`) |
| 9 | ha24 55227da7, ha26 84501e1a, ac-gaps 3f9072c2 stale at BASE-154; `chapter-practice.spec.ts:103` states REQ-B-071 as fact; refresh after REQ-B-071 merges | A3 docs units | B2 c28 | no | n/a | A3 |
| 10 | `REQ-B-066`: runbook entry for 0106/0107 (lock_timeout, window, pg_trgm precheck, ANALYZE) and `r1-release-input-team-a.md:27` "0106 to 0109 free" | admin-list-perf | from-B REQ-B-066 (OPEN) | no | no | A3 docs (comment `env.schema.ts` fixed by alp-comment-240, BASE-187) |
| 11 | R1E2E-10: all-skipped bulk Terbitkan shows flash "0 soalan berjaya dikemaskini."; the "single route still 409" test calls `QuestionsService.setStatus`, not the HTTP route | R1E2E-10 5990fb6b (my review, A1b) | A1b | no | no | A2 |
| 12 | publish-lock-share: no test for the P2028 path (PUBLISH_TX budget); pg "client.query() when already executing" warning in the shared DB test helper | publish-lock-share 7ef73b79 | A1b | no | no | A4 / test-support owner |
| 13 | Jana generation under a solver-only regression ends in a 500 from the post-compose verify (fail-closed, status not asserted) | minors-kbat-chain 29545691 (A1b obs.) | A1b | no | no | A3 |
| 14 | runbook accuracy findings (intake env row missing, stale heads, citations) | ac-gaps af116ae2 | A1b | no | n/a | A3 docs (routed already; confirm closed) |

## B. Named findings that ARE recorded (no action, listed for the cross-check)

| Finding | Unit | Where |
|---|---|---|
| New-sitting rule uses the live version / taken-down content for a running latihan sitting; no deadline | REQ-B-032, REQ-B-058 | KIV 1, 33 and dev (B3 c43/c46) |
| `exam_attempts(paper_id)` index absent | REQ-B-052 / delete-served-guard | KIV 4 |
| FE ignores `skipped[]` | R1E2E-10 5990fb6b | board REQ-A-040 (team C) |
| Cap on self-mark coins/XP per attempt | T38 13134ced | KIV 35, dev (BASE-173) |
| REP-N1 residual oracle (`fields.reasons` vs `fields.context`) | REQ-B-049 9ece8d76 | dev (REP-N1 text present); not in KIV: add a KIV line |
| Locked enum leftovers in MapIsland / m05 types | drop-lock-enums | KIV 25 |
| T48 `setGroupLabel` shared group; PKSK `applyStatus` no approve gate; number-clash check | T48, PKSK | KIV 36, 37, 38 |
| Legacy Simulasi groups not re-ordered | D90 Kuiz sweep | KIV 5 |
| Unique-label 422 has no deviation row | T48 6c5ae3a8 | likely covered by the T48 R5 rows (dev:901); verify |

## C. Closed since the finding (do not re-open)

| Finding | Closed by |
|---|---|
| AttemptSectionSnapshot lacks `versions` | minors-snapshot-versions (BASE-184) |
| Dead `reasons.length > 0` at `approval-check.ts:21` and its test | minors-chain-tip (BASE-182) |
| No API test that the gate stops counting after a dismiss | H-A18 minors (BASE-179) |
| T45 Part 3 / REQ-B-025(c) carried Minors | minors-t45 (BASE-175), minors-b025c (BASE-183) |
| bulkByFilter race (silent drop) | R1E2E-10 fe228f56 (BASE-178) |
| B058-L1, L2, `takenDownPins?` required | REQ-B-074 (A1b, pushed 45a75f68; not yet in base at BASE-189) |
| REQ-B-067 two guards | BASE-176 |
| 60/min list limit | BASE-137 and comment alp-comment-240 (BASE-187) |
| REQ-B-050 regex (Kertas filter) | admin-list-perf; from-B row still reads OPEN (stale status) |

## D. "Approve w/ Minors" with no itemised Minors in the status files (ask B2/B3)

chain-qa-selfmark 5b93da43, chain-qa-bab 0efba36c, chain QA 9b70ae39 (BASE-140/141); D90 Kuiz sweep 16cd704a (BASE-142); H-A24 c0f7a45d (BASE-145);
T43 238eb6eb (BASE-158); H-A26 21360a86 (BASE-162); AC gaps c2b93710 (BASE-163); REQ-B-058 d7665dfa (BASE-164; B3 Lows → REQ-B-074); REQ-A-032 b3f76c6e (BASE-166);
rule-line V2 a425206c (BASE-169); REQ-A-035 7cd7e3bd (BASE-170); a2-carried-minors 45f15242 (BASE-172); ha24 55227da7, ha26 84501e1a, ac-gaps 3f9072c2 (held);
T39 K1 evidence 669a1109 (BASE-189); REQ-B-071 4e38af8e. Owners follow the unit owner (A3 for chain/docs units, A2 questions, A4 servability).

## E. Team C units with open Minors (not team A; for completeness)

REQ-A-018 FE (summary denominator uses `rows.length` when truncated); Hub 151648eb; m04-e2e-refresh (some exact values loosened); Lapor 53fa8fad
(`t6-reports.spec.ts` ~229 vacuous count 0); T10 bf78ca93 (stale `publishErrors`, sticky bar height, mock Draf filter mismatch); REQ-A-008 f85db8ff
(`SetBuilderPage.vue` shows only the first stimulus; also `StudentViewDrawer.vue:37`); REQ-A-021 (filter bar not disabled while busy; `DsConfirmHost.vue:30`
collapses newlines in the destructive warning); StudioGroupEditor undebounced search until REQ-A-027 / `r1/reqb061-list-fanout`.
