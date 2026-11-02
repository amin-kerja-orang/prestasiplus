# R1 delta packets for team B re-review

Purpose: one short packet per READY head, from B's last verdict SHA to the current head, so a re-review reads only what changed.

- Heads checked with `git ls-remote origin` when this file was written: `r1/ha18-gate-facts` a9ffe246f, `r1/req-c012-a2` 47b854249, `r1/reqb052-archived-edit` f3a2448f9, `r1/reqa018-paper-servability-route` 9d6ef833f, `r1/delete-served-guard` fe7ef5378. BASE was BASE-115 `10cc09e7`.
- "BASE-only merge" means the merge brings the base branch in and nothing else. For ha18 I checked this: `ba5bdd6cd` (BASE-107) gives an empty `git diff fc409ae16 ba5bdd6cd -- apps packages`, and `629ea0d37` (BASE-108) changes exactly the 6 files that BASE-108 changed against BASE-107.
- Spec counts are the number of `it()` blocks in the file at the head (a static count; this packet was written without running vitest). Run counts are in the author's commit messages and in the B2 notes.
- B's finding ids are taken from `docs/team/requests/from-B.md` and `docs/team/status/B2.md` on `team/r1-board`. B's verdicts on `delete-served-guard` 7e5d82e6 and on `reqa018` cc42468e are not recorded in those files; their reasons below come from the brief for this task.

## 1. `r1/ha18-gate-facts` (H-A18, migration 0105): verdicts 3a2ac810 and d3842c48, head a9ffe246f

1. **Commits since d3842c48 (first-parent).** 864a31d42 merge BASE; 6c444a1f7 review fixes; ed81ce377 merge BASE-101; 1ba4be42c merge BASE-105; f29aeda9c conformance test; fc409ae16 pre-review fixes; ba5bdd6cd BASE-107 (BASE-only); 629ea0d37 BASE-108 (BASE-only, no A change); a9ffe246f REQ-B-057. 3a2ac810 to d3842c48 is one docs row (the author counts for the source declaration).
2. **Files, A changes only.** 6c444a1f7: 23 files (gate data, `questions.repository.ts`, `questions.service.ts`, `review.service.ts`, 0105 SQL, 10 specs, gate contract text). f29aeda9c: `test/conformance/questions/questions.ts`. fc409ae16: `questions.service.ts` (new `heldIssuesAfter`), `questions.repository.ts`, `gate-issues.ts`, 2 specs, 1 deviation row. a9ffe246f (8 files): 0105 `migration.sql`, `intake/workflow/review.service.ts`, `questions.repository.ts`, 3 specs, `intake/paths.ts` and `openapi.json`.
3. **What and why.**
   - **Earlier B2 findings on 3a2ac810 (closed, B2 cycle 20 note):** declared marks only when there are no parts; rights and source gates dropped by decision D99; bulk Semakan now runs the submit gate; import holds carried to the next version.
   - **fc409ae16:** the import hold is released on every edit path (one `heldIssuesAfter` helper); `gate-issues.ts` gives `questionText` and `parts` the code `REQUIRED_FIELD` and an unconfirmed low-confidence field `LOW_CONFIDENCE`.
   - **REQ-B-057 (B2 MAJOR on fc409ae1), a9ffe246f:**
     - `gateFacts` counts only open `exact` and `near` duplicate links (`questions.repository.ts:889`), so a pending `variant` link no longer blocks Semakan or Terbit forever.
     - An `accepted` intake item may still send `not_duplicate` ("Bukan pendua"), and its state stays `accepted` (`review.service.ts:425`). Other decisions on an accepted item stay 409.
     - 0105 adds both CHECKs `NOT VALID` and validates after the backfill (the B2 Minor on ACCESS EXCLUSIVE).
4. **Risk: medium.** A migration and a change to which intake decisions are allowed after accept; the SQL change is small and has a spec on a fresh database.
5. **Specs.** `test/intake-workflow/accepted-duplicates.spec.ts` (3 it), `test/questions-workflow/gate-facts.spec.ts` (13), `test/questions/migration-0105.spec.ts` (2), `test/questions-workflow/gate-issues.spec.ts` (3), `test/questions-workflow/bulk-approve-gate.spec.ts` (3). Author's last run at fc409ae16: questions-workflow 296/296, intake-workflow 137/137, conformance 409/409; not re-run for a9ffe246f here.

## 2. `r1/req-c012-a2` (REQ-C-012 edit as draft): verdict ba57ecc5, head 47b854249

1. **Commits since ba57ecc5 (first-parent).** c160c62c6 merge ha18 (H-A18); 64d24e69d SEC-C012-1; 46533c356 merge ha18 (pre-review fixes); dc3bfae88 import hold (M1); 9b1fd35e2 merge ha18 (BASE-107, no C-012 change); 47b854249 merge ha18 (REQ-B-057).
2. **Files, own change only.** 64d24e69d: `test/questions-workflow/edit-as-draft-provenance.spec.ts` (new, 100 lines). dc3bfae88: `questions.service.ts` (+3) and `test/questions/edit-as-draft.spec.ts` (+19). The whole route against the ha18 head is 8 files (`admin.controller.ts`, `audit.ts`, `questions.service.ts`, `paths.ts`, `schema.ts`, `openapi.json`, 2 specs), +446 lines.
3. **What and why.**
   - **B2 on ba57ecc5 (MAJOR when merged alone):** `addVersion` dropped 15 provenance columns, so a rights-`unclear` question could be edited as a draft and approved with NULL rights (a T33-L1 bypass on a new route). H-A18 `addVersion` copies them; 64d24e69d pins it for edit-as-draft (all 15 columns equal, a second round carries them, no rights refusal after D99).
   - **dc3bfae88 (author's pre-review M1, B2 cycle 20: Approve with Minors, after H-A18):** edit-as-draft built the draft without `importIssues`, so a held legacy image was lost and approve passed. It now carries `importIssuesOf` to version n+1, so approve gives 422 `media` until the picture is supplied. The same spec asserts the `audit_events` row (`mode: edit_as_draft`).
   - **47b854249:** takes REQ-B-057 into C-012; no C-012 code change.
4. **Risk: low.** A new admin-only route that copies data; the only shared code is the H-A18 path it merges.
5. **Specs.** `test/questions/edit-as-draft.spec.ts` (7 it), `test/questions-workflow/edit-as-draft-provenance.spec.ts` (2). Author's run at dc3bfae88: edit-as-draft 7/7, questions-workflow 298/298, questions 959 passed with 1 failure unrelated to this change (BR-16 draw-bounded, fixed by REQ-C-021 follow-up), security 185/185.

## 3. `r1/reqb052-archived-edit` (REQ-B-052, A3): no verdict SHA, full branch against BASE; head f3a2448f9

1. **Own commits (no merges).** ce0af563f red repro; 50017f8f1 fix; f3a2448f9 P1 pinned-clause spec and a cheaper probe. Everything else on the branch is merge content: H-A18 up to fc409ae16 (it does NOT contain REQ-B-057 a9ffe246f) and REQ-B-032 a2cb5bb42. Against BASE `f7b8c0fc` the merge base is a2cb5bb42, because BASE already held REQ-B-032 then.
2. **Files, own change only.** 50017f8f1: `questions.service.ts`, `questions.repository.ts` (`versionIsPinned`, `withdrawnVersionNos`), `bijak/question-bridge/be09-question-source.ts`, `archived-edit.spec.ts`, 1 deviation row. f3a2448f9: `questions.repository.ts` (+5/-1), `archived-edit.spec.ts` (+40).
3. **What and why.**
   - **REQ-B-052 (B3 MEDIUM E05B-L2):** an edit of an archived question, or of one pinned on a Terbit paper or a sat paper, used `rewriteVersion` and changed the pinned version in place (stem, key). The edit now adds version n+1 as a draft (`questions.service.ts:1066`) and version n stays byte-identical, for admin `update` and Guru `updateOwn`.
   - **Attempts bridge:** a withdrawn question is read from the newest archived published version (`withdrawnVersionNos`, repository `:1034`), so running sittings keep the original instead of failing closed.
   - **f3a2448f9 (B2 cycle 20: Approve with Minors, "no index on exam_attempts.paper_id"):** the `exam_attempts` probe now runs only for a withdrawn paper (`versionIsPinned`, repository `:1015`), because an attempt needs a published paper at start and a paper never returns to draft. No migration.
   - **Open for B:** the branch must take H-A18 a9ffe246f (REQ-B-057) before the final gate; B2 noted it waits for H-A18.
4. **Risk: medium.** It changes which branch `applyUpdate` takes for every edit, and a bridge read that pupils' sittings use.
5. **Specs.** `test/questions/archived-edit.spec.ts` (6 it). Author's run at 50017f8f1: 4 tests green; the P1 clause is red when the `versionIsPinned` clause is removed.

## 4. `r1/reqa018-paper-servability-route` (REQ-A-018 route, REQ-A-026b scenarios): verdict cc42468e, head 9d6ef833f

1. **Commits since cc42468e (first-parent).** 66cb4ee30 contract-tests scenarios; 9ce81df57 merge BASE (BASE-106, BASE-only); 9d6ef833f merge BASE-107 (BASE-only).
2. **Files, own change only (66cb4ee30).** `packages/contract-tests/src/scenarios/paper-servability.ts` (new), `src/scenarios/index.ts`, `packages/contract-tests/mock/known-mismatches.ts`.
3. **What and why.**
   - **Scenarios:** four scenarios for `GET /admin/questions/{id}/paper-servability` (admin 200 over ids 1..30, unknown 404, anonymous 401, student 403) run for both the frontend mock and the API (`allScenarios`). Smoke skips routes with a path parameter, so a mock-versus-real body difference had gone unseen (REQ-A-026b: the C client crashed on `{ data, meta }`).
   - **Known mismatches:** three `assertion` entries cover the mock not serving the route yet. They are dropped by a local commit (76511c9a8, not pushed) once C's `r1/reqa018-paper-servability-fe` is merged. Before that merge, `test:mock` still shows the 19 old unserved-route failures that `r1/mock-known-mismatches` lists.
   - The route itself (admin papers only, 200-paper cap, `meta`, one batched servability read) was reviewed earlier at cc42468e and has no change in this delta.
4. **Risk: low.** Test and known-mismatch files only.
5. **Specs.** `apps/api/test/conformance` 413/413 (the 4 new scenarios included, was 409), `question-paper-servability.spec.ts` (9 it), `question-paper-servability-limit.spec.ts` (1), `paper-servability-chunks.spec.ts` (3); author's combined run 426/426.

## 5. `r1/delete-served-guard`: verdict 7e5d82e6, head fe7ef5378

1. **Commits since 7e5d82e6 (first-parent).** fe7ef5378 only.
2. **Files (4).** `questions/errors.ts` (+5/-2), `test/practice-question-source/delete-in-session.spec.ts` (+53), `test/questions/foreign-key-violation.spec.ts` (new, +33), `test/r1/delete-served-guard.spec.ts` (+55).
3. **What and why (review minors on 7e5d82e6, from the brief).**
   - **M1:** a delete during a Latih Tubi or Kuiz session, then submit or finish, must answer 200 with a score, and a replay 422, never a 5xx (it exercises the regrade fallback).
   - **M2:** a mixed bulk delete (one deletable, one in use: affected 1, failed 1); a table-driven case for the other three RESTRICT tables (`remedial_test_items`, `battle_questions`, `battle_answers`); and a unit spec of `isForeignKeyViolation` (P2003; P2010 with `meta.code`; raw 23503; a non-FK error is false).
   - **Nit:** `errors.ts:55-59` `isForeignKeyViolation` also follows `meta.driverAdapterError` and its `cause`.
4. **Risk: low.** One error-mapping line of production code; the rest is specs.
5. **Specs.** `test/practice-question-source/delete-in-session.spec.ts` (6 it), `test/questions/foreign-key-violation.spec.ts` (5), `test/r1/delete-served-guard.spec.ts` (20). Not re-run for this packet.
