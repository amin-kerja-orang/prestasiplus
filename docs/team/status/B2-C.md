# Team B reviewer 2 — Team C units (writer: Team B reviewer 2 session)

Read-only reviews of Team C READY-FOR-REVIEW units. Verdicts here are for the head named in the C status file. B1 merges only units marked "Ready for B1 merge".

## Cycle 1 — 2026-10-31 (started 19:55 MYT, base BASE-8 baad88b7)

Method: each READY head was trial-merged into BASE-8 (`git merge --no-ff`, local only). Checks ran on the trial merge: api `tsc --noEmit`, `vue-tsc --noEmit -p tsconfig.app.json` (after one `vite build`), eslint on changed files, and targeted tests. DB specs ran on a local Postgres 16 via TEST_DATABASE_URL. Code review (code-reviewer) and security review (security-engineer) ran as parallel read-only passes, each in its own worktree.

Heads moved after READY: all six branch tips now contain BASE-8 (merged 19:06). T10, T11, T12 and T13 also carry **new feature commits that were not posted as READY**:
- T10: e1546909 (Tambah/Padam soalan, `overridable`)
- T11: dafc435f (AC-R1-18.4 archived refusal)
- T12: 9e7cb8fb
- T13: 17ac8f28 (lock path on T32 87a9a363, D93)

Those commits were not reviewed. T14 and T15 tips are BASE-8 merges only, and their trees are identical to my trial merges (`git diff trial <tip>` is empty).

- **T10 r1/f08-builder-ui @ 0f8475e0 (C1): Changes requested**
  - Trial merge on BASE-8: clean (64b6d8db). The head lacks BASE-8; tip 62733cf9/e1546909 has it.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (31 files). `vitest --project unit src/modules/m28-bijak-spm/__tests__ src/shells registry-boot`: 56 files, 705/705.
  - MAJOR `PaperEditorPage.vue:539-545` + `admin/builder/lib/use-paper-actions.ts:132-143`: PublishOverride stays usable while `dirty`. It uses blockers from the last review and publishes the last *saved* composition, then `reload()` drops the unsaved edits silently. Fix: disable the override while dirty, or save then reload the review before the override call.
  - MAJOR (merge order) `admin/builder/server/http.ts:353-363`: "Sunting bahagian/petikan" and the override need T34. On BASE-8, `PUT /api/admin/papers/:id/groups/:groupId` does not exist, and `BijakBuilderSectionPatch` (strict, requires `questionIds`) rejects label/instruction/compulsory, so http mode fails. Fix: merge only after T34, or hide the B09b blocks behind a flag. Paths and payloads match t34 @4d771b47.
  - MAJOR (R1 scope, user decision 31 Oct): "Tambah soalan / Padam soalan" is not in this head (it arrives in e1546909, not yet READY). "Bahan rujukan" (S4.4) is still missing (REQ to A). R1-F09 G4 cannot close on 0f8475e0.
  - Minor `PublishOverride.vue:15`: eligibility is guessed with `/tidak layak/`. The server is the real gate, but an editable section label containing "tidak layak" shows the box by mistake. Already replaced by `overridable` in e1546909.
  - Minor `PaperEditorPage.vue:484-493`: with only server blockers, the budget panel shows the green "Sepadan dengan blueprint" and "selesaikan N perkara di atas", but nothing is listed above. Show `publishDisabledWhy` instead.
  - Minor `SetBuilderPage.vue:195-203`: `pending` is per unit, so Naik/Turun on two units at once makes the second `movedOrder` undo the first. Use one page-wide lock.
  - Minor `admin/builder/server/memory.ts:190-201,268-273`: the mock review never emits overridable lines and mock publish ignores `override`, so the override path is untested in mock/e2e.
  - Minor (V2 copy, S4.2/S4.4):
    - Set Builder success uses the old native flash instead of "Set ini telah diterbitkan." (`copy.ts:193` is unused).
    - Semak publish/Tarik balik flashes (`PaperEditorPage.vue:232,243`) are not the DISC 3.4 strings (`publishedFlash`/`withdrawnFlash` exist).
    - PublishOverride says "kontrak blueprint" where S4.4 has "kontrak Simulasi".
    - The `contractTitle`/`contractNone` block is missing.
  - Minor `PaperMetaForm.vue:92-94`: "Kod kertas (kulit)" is read-only but V2 edits it. Record a deviation row; the comment at :5 is stale.
  - Minor `copy.ts:208` `errRename` is reused for metadata and passage failures (`PaperEditorPage.vue:259,274`).
  - Nit: header title inputs have no client empty/200 check. REQ-C-008 is answerable now: the BASE-8 contract has `title .trim().min(1).max(200)` (`packages/contract/src/bijak/builder/schema.ts:474-481`).
  - Nit: `builder-edit-blocks.test.ts:75` never calls `updateGroupLabel`.
  - Nit: untagged/unused copy keys (`errValidate`, `errNetwork`).
  - Nit: `v2-portals.md` §6.4 heading says (17) but lists 13 rows.
  - Passed: D90 in Set Builder (whole-group add/move/remove, `builder-groups.test.ts`); 2-click Jana → Terbitkan; title synced between the header and Kemas kini metadata; admin-only routes; no fixed widths.
  - Earlier B2: publishBlockedCount while dirty/review failed is **fixed** (`publish-gate.test.ts`). Menu 105 vs 104 is **fixed**.

- **T11 r1/b16-kuiz @ 48fa74e8 (C2): Approve with Minors** (code); **security: Changes requested**
  - Trial merge on BASE-8: clean (3733ad0a). The head lacks BASE-8; tip af4e21e6/dafc435f has it.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (6 files). `TEST_DATABASE_URL=… npx vitest run test/bijak-kuiz`: 2 files, 25/25.
  - T07 (tip b0421c6b) still conflicts at `kuiz.mapper.ts`. The resolution is mechanical: take `KUIZ_KIND[s.kind]` and drop TODO(T07). Then re-run `emit-openapi --check`. **Merge after T07.**
  - SECURITY MEDIUM `kuiz.service.ts:135-143` (`check`), `:182` (`finish`): the session is locked by (id, userId) only, with no mode/kuiz marker. Kuiz check therefore accepts any of the caller's own in-progress practice sessions and returns key + explanation without moving the BR-07 trial counter (cf. `practice.service.ts:229-231`). A non-subscribed pupil can bypass the 50-check paywall. Fix (C2 + A, M05 store owner): add a kuiz mode/origin marker and return 404 for other sessions. This is the earlier B3 L2/B2 Minor, widened; it is not cross-pupil (ownership is in SQL).
  - Minor `kuiz.service.ts:253-267` vs `:279`: `pages`/`markableTotal` are computed before the `complete` filter. The score denominator counts unseen parts. A Bahagian whose questions are all incomplete gives `items: []`, and PaperQuizPage then shows "Kertas ini tiada soalan" with no pager. `paperCheck` (:323-341) still marks the skipped items. Fix: filter first, build pages and total from the shown items, and record the skip as a deviation.
  - Minor (B3 L1, open) `kuiz.service.ts:244-250,330,344-350`: the per-paper kuiz serves pinned versions with no servable re-check (cf. `papers/attempt-source.ts:88-91`), in tension with AC-R1-18.4. dafc435f appears to address this (not reviewed).
  - Minor (carried): the random draw is `singleMcqLeaf` only (:93), while V2 §1.8 serves any MCQ part.
  - Passed: D90 (`groupId` on items, `groups[]` once per group, members contiguous, own stimuli on first leaf only; specs 22/23); count fallback 20 (never above 40, strictObject, no prototype pollution); no key before check; random pool approved/active/NOT_PKSK/learner-level; paper Terbit check (:347).
  - Earlier: paperPage `complete` **fixed** (side effect above); normaliseKuizCount unit test **fixed**; own stimuli per leaf **fixed**; :98 'published' **fixed** (now 'approved' after T04); check/finish any session **still open** (now MEDIUM); B3 M1 (key via paperCheck, coin/XP) **open**, product decision pending.

- **T12 r1/f12-kuiz @ 07f57221 (C2): Approve with Minors**
  - Trial merge on BASE-8: clean (0751c1d0). The head lacks BASE-8; tip 3c9f8af2/9e7cb8fb has it. Depends on T11.
  - Checks: api tsc 0 (the earlier exit 2 is fixed); vue-tsc 0; eslint 0 (25 files). `vitest --project unit src/modules/m28-bijak-spm src/app/__tests__ registry-boot`: 49 files, 639/639. api `test/bijak-kuiz` on the trial: 25/25.
  - Minor `PaperQuizPage.vue:67`: the "Soalan n" chip counts leaves, so a structured question shows as Soalan 3 and Soalan 4, and numbering restarts per Bahagian. Number per question, or confirm on .cloud.
  - Minor `KuizPage.vue:169`: "Kertas penuh" should be "← Kertas penuh" (BIJAK-SPM-cloud.md:183).
  - Minor `KuizPage.vue:192-193`: Syiling/Mata chips on "Kuiz Selesai!" are not in V2 §1.8 / design SS5. Remove them or add a deviation row.
  - Nit: `lib/kuiz-count.ts:7` uses `Number()` but the server uses `parseInt` (`?count=5abc` → 20 vs 5). Use one helper.
  - Nit: stale "Semak Jawapan" comments at KuizPage.vue:5 and KuizItem.vue:24. The two discovery docs disagree; record which one wins.
  - Nit: no test for the `loadSeq` guard. `watch(paperId)` does not reset picked/written/errors.
  - Nit: the mock paperPage returns 200 for an out-of-range page and ignores paper status.
  - Security (covered in the T11 pass): no v-html reachable (RichText escapes; svg never set from kuiz); `parseSubject` is whitelisted.
  - Earlier B2: api tsc chain **fixed**; "↻ Cuba Lagi" / count=total **fixed** (+ test); "✓ Semak" **fixed**; out-of-order guard **fixed** (untested); emptyHelp citation **fixed**; cover "Kuiz" **fixed**; SS6 deferral accepted (no R1 AC).

- **T13 r1/t13-studio-groups @ a4b41ec1 (C3, stacked on T32 fc380203): Changes requested**; **security: Changes requested**
  - Trial merge on BASE-8: clean (53b74f1f). This includes T32 fc380203, which is unmerged and has B2 Changes requested. The head lacks BASE-8; tip 5965e377/17ac8f28 has it.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (75 files).
    - DB (local PG): studio-group-lock, studio-part-images, stimulus-api, figure-links, figure-links-unit, stimulus-links: 6 files, 40/40.
    - FE `--project unit` (12 changed test files + registry-boot): 13 files, 77/77.
  - MAJOR / SEC MEDIUM `StudioGroupEditor.vue:174-247` → T32 `stimuli.service.ts:76-216`: the Studio now drives T32 `POST/DELETE members`, `PUT members/order`, `DELETE /stimulus-groups/:id`, `PUT /stimulus-groups/:id` and `PUT /stimuli/:id`. At fc380203 none of these has a served lock. Example: "Sertai" on served SEED-GRP-PASAR-1 joins (B2 probe 1 again, via the T32 route). `group-lock.ts` only guards `createFrom`/`applyUpdate`. Fix: the served lock in every StimuliService write (= T32-M1 / REQ-C-003, reported DONE @87a9a363, not in this head). Do not merge before that T32.
  - MAJOR `StudioGroupEditor.vue:54,93-101`, `StudioEditorPage.vue:114,148,179`: the client lock reads the *latest* version status (`views.ts:83`). A served question with an "Edit sebagai draf" v(n+1) shows `draft`, so reorder/remove/dissolve/stimulus edits are enabled on a served group. Fix: expose `served` (live version approved) or rely on the server lock.
  - Minor / SEC LOW `group-lock.ts:26-46` (called at `questions.service.ts:600,894`): no `FOR UPDATE` on the group row. A concurrent join can pass the 40 cap or the served check, and max+1 position collides → 500. Fix: lock the group (before the question row, same order as T32 addMember).
  - Minor / SEC LOW `intake/workflow/stimuli.service.ts:119-138` linkReferencing: items are read before the batch lock, and `updateMany` filters on id only. Fix: add `stimulusId: null, reviewState in (...)` to the where, or lock first.
  - Minor: intake accept of a 2nd item into a group whose 1st member is now approved → 409 with the Studio text. acceptRow maps only VALIDATION_ERROR, and no spec covers it. Map it to an intake issue + spec, or exempt it.
  - Minor `extraction.service.ts:413-418`: extraction-time links skip the contiguity `gather` (impact unverified).
  - Minor `StudioEditorPage.vue:222`: the badge shows the raw English status. Use the BM labels.
  - Minor `StudioGroupEditor.vue:226-235`: saveMembers is not atomic; `:161-165` leaves an orphan stimulus if createGroup fails.
  - Nit `group-lock.ts:43`: the cap message is inline; use STIMULUS_MESSAGES.
  - Info `src/stores/session.ts:333`: `handleUnauthorized` → `clear()` deletes Studio drafts on a 401. This defeats the V2 recovery banner in its main use case; lead to decide.
  - Passed: admin-only routes and CSRF; link-references scoped by visibleBatches, idempotent, bounded regex (no ReDoS); option pictures via the question_image token path (magic bytes, JPG/PNG/WebP, size per purpose); no v-html; numberLabel `trim().max(32)` text only; audit ids/counts only; PKSK cannot regroup; no fixed widths. Lane's real-HTTP 375/768/1280 check: 9/9.
  - Earlier: B2 MAJOR lock bypass **fixed for /api/questions** (spec 5/5) but **open via the T32 routes** (above). B2 MAJOR duplicate API **fixed** (studio/groups* dropped). Nombor soalan **fixed**; Bahagian omitted is recorded as UX-14. "Topik" **fixed**. serverIssues rendered **fixed**. 375/768/1280 **fixed**. patchStimulus shared rows → now T32-M1, **open** (A2). setMembers lock → new code lacks it (Low above). B3 T13-M1: dup API **fixed**, lock scope **open**. T13-L1 **moot** (code removed). T13-L2 draft key per user + clear on logout **fixed**. T32-L1/L2 **open** (A2).
  - Tip 17ac8f28 (not READY) deletes `group-lock.ts` and routes through T32 `GroupMembers`. It appears to address both MAJORs; review it when posted.

- **T14 r1/t14-student-bugs @ 6f2f682a (C4): Approve with Minors**
  - Trial merge on BASE-8: clean (103afab9). Tip **4b033de3 contains BASE-8 and its tree equals the trial**.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (9 files).
    - `vitest --project unit src/modules/m06-* src/modules/m05-practice/__tests__ src/modules/m28-bijak-spm/__tests__ packages/exam-core <changed tests> registry-boot`: 76 files, 1257/1257.
    - api (local PG) `test/bijak-attempts test/bijak-question-bridge`: 13 files, 302/302. `test/exam-core`: 1/1.
  - Minor `src/modules/m05-practice/pages/StructuredAnswerPage.vue:74`: `isStem = marks === 0` is looser than the stated rule (0 marks, no answer, no children). The contract allows a 0-mark leaf, which would lose its textarea. Fix: treat a row as a stem only when the next label starts with `${label}.`, or add a `leaf` flag in `flatten`.
  - Nit `docs/requirements/v2-bijak-spm.md:662-663`: T14-D1/D2 say "restores V2", but §1.3 shows `[N markah]` on every part. Call hiding "[0 markah]" a D9 choice.
  - B-08 "Tiada soalan" tile: kept per user decision 31 Oct and recorded as deliberate deviation T14-D4 citing .cloud §2.8/§2.1. Revert fbfb2fb1 is exact (`git diff 8ae71ef8^ fbfb2fb1` empty), no dead code.
  - exam-core `leavesOf`/`isStemRow` does not change marking for any real bundle (bridge/PoC leaves always carry `answer`).
  - Earlier B2: B-08 MAJOR **resolved by user decision** (deviation recorded); exam-core API runs **recorded** (lane 400/405, known H-A4 + timezone; mine above all pass); 375/768/1280 **done** (lane 17:20); guruChapter **fixed**; ResultPage guard → Q1 approved (T15).

- **T15 r1/t15-bm-copy @ 17f62b94 (C4): Approve**
  - Trial merge on BASE-8: clean (3c7e67c6). Tip **dbf7d81e contains BASE-8 and its tree equals the trial**.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (2 files). FE semakan + semakan-http + jana-retry-result + QuestionFormPages + registry-boot: 5 files, 66/66. api (local PG) self-mark.spec + chapter.spec: 2 files, 41/41.
  - The change is tags, comments and docs only, with no behaviour change. Every §7(j) string exists verbatim in code (attempts/schema.ts:42-49, m28 server/store.ts, ResultPage.vue:72, questions/schema.ts:59). Docs consistently say "approved, Q1". No real names. No security flag.
  - Nit (pre-existing): the mock `retryAttempt` (`m28/server/store.ts:788-795`) lacks the API's "Kertas ini sudah tidak tersedia untuk dicuba semula." path.
  - Info: the H-A13 strings approved in Q1 ("Kertas ini sedang dikemas kini…", admin Arkib line) are still [PROPOSED] on BOARD.md:96. That is the owning unit's job.
  - **Ready for B1 merge** (merge tip dbf7d81e).

### Merge readiness summary (cycle 1)
- Ready for B1 merge: **T15** @ dbf7d81e.
- T14: Approve with Minors and the tip has BASE-8. Fix the Minor, or the B1 lead accepts it, then it is ready.
- T12: Approve with Minors. Needs T11 first, plus a posted head with BASE-8 (the tip has new commits).
- T11: needs the security MEDIUM fixed, T07 merged first, and the new tip reviewed.
- T10: Changes requested (dirty override); needs T34 first.
- T13: Changes requested (Studio on unlocked T32 routes); needs T32 with the served lock first.
