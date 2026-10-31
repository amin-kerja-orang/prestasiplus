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
  - Not yet "Ready for B1 merge": BASE-9..BASE-14 landed during this cycle (latest BASE-14 70971776); tip dbf7d81e lacks it (merge-tree clean). C4: merge BASE-14 and post the head; docs-only, so B2-C re-check is a tree diff.

### Merge readiness summary (cycle 1)
Note (post-review): BASE-9..BASE-14 (T07, T08, T28, H-A2, R1E2E-01, T32 @87a9a363) merged while this cycle ran. Latest BASE-14 = 70971776. No Team C tip contains it, so **no unit is "Ready for B1 merge" this cycle**. T14 tip 4b033de3 and T15 tip dbf7d81e both merge-tree clean on BASE-14. T07 now in base → T11 kuiz.mapper conflict moves to the lane's BASE-14 merge. T32 now in base at 87a9a363 → the T13 served-lock MAJOR must be re-checked on T13 tip 17ac8f28.
- T15: Approve; merge BASE-14 → then ready.
- T14: Approve with Minors and the tip has BASE-8. Fix the Minor, or the B1 lead accepts it, then it is ready.
- T12: Approve with Minors. Needs T11 first, plus a posted head with BASE-8 (the tip has new commits).
- T11: needs the security MEDIUM fixed, T07 merged first, and the new tip reviewed.
- T10: Changes requested (dirty override); needs T34 first.
- T13: Changes requested (Studio on unlocked T32 routes); needs T32 with the served lock first.

## Cycle 2 — 2026-10-31 (started 20:32 MYT, base BASE-14 70971776)

Scope: the three new READY heads with no verdict. T11, T12, T14 and T15 are unchanged since cycle 1, so their verdicts stand. Each head was trial-merged into BASE-14; all three were clean. **None of the three heads contains BASE-14.** Method as in cycle 1; DB specs ran on a local Postgres 16.

- **T10 r1/f08-builder-ui @ e1546909 (C1, round 3): Changes requested**
  - Trial merge on BASE-14: clean (54183461). The head lacks BASE-14.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (33 files). `vitest --project unit src/modules/m28-bijak-spm/__tests__ src/shells registry-boot`: 56 files, 710/710.
  - MAJOR (cycle 1, **still open**) `PaperEditorPage.vue:556-562`: the override is still offered while `dirty`. `publish({override})` does not save first, so the old saved version is published and the unsaved edits are lost.
  - MAJOR (new) `admin/builder/components/PaperQuestionOps.vue:50-52`, `copy.ts:150-152`: "Tambah soalan / Padam soalan" now place and un-place a bank question (the placements routes). V2 creates and deletes an *extra* question with Nombor soalan / Jenis jawapan / Markah (cloud-student-mechanism §3.4 l.392; design S4.4). This change of meaning is not in any deviation table. The V2 confirm text, shown verbatim, tells the admin the question and its skema are deleted for good, but the action only removes a placement. Fix: add a deviation row (UX-1x) with a [PROPOSED] confirm that matches the action, or get a lead/user decision.
  - MAJOR (merge gate, **still open**): "Sunting bahagian / petikan" (`http.ts` updateSection/updateGroupLabel) still needs T34. BASE-14 has no groups route and a strict section patch. Merge T10 only after T34, or flag the blocks off. Tambah/Padam routes already exist on BASE-14.
  - Minor `PaperEditorPage.vue:538,658`: two add/remove models run side by side. The local picker only applies on Simpan draf; PaperQuestionOps writes at once and lists the saved data, not the local `ids`. Padam on a unit already removed locally returns 422. Fix: render from `ids`, or keep one add path.
  - Minor `PaperQuestionOps.vue:33-42,105`: search has no debounce or sequence guard, and shows only the first 20 with no "Muat lagi".
  - Minor `domain/blockers.ts:32-36`: on t34 tip e363fe51, blockers are still strings, so the text fallback runs. The overridable "Kontrak Simulasi … belum Disahkan" line does not match /tidak layak/, so the main override case is not offered. This closes with REQ-C-002.
  - Minor (BASE-14 interaction) `SetBuilderPage.vue:381-388,466-477`, `PaperEditBlocks.vue`: T07's empty-group placeholder `{kind:'passage',label:''}` renders an empty stimulus box, a badge with a blank label, and a blank "Sunting petikan" row. Fix: skip these when the stimulus has no label, text or image.
  - Cycle-1 Minors **still open**:
    - "di atas" contradiction (`PaperEditorPage.vue:497`)
    - per-unit Naik/Turun race (`SetBuilderPage.vue:165-203`)
    - mock ignores `override` (`memory.ts:268-273`)
    - V2 copy flashes on Semak (`:233,:244`); `published_ok`/`blockedCount` unused; "kontrak blueprint" vs "kontrak Simulasi"
    - Kod kertas read-only deviation not recorded (`PaperMetaForm.vue:92-94`; stale comment at :5)
    - errRename still the fallback for metadata/passage, **partly fixed** (Tambah/Padam now use errAdd/errRemove)
    - nits (title empty/200 check, REQ-C-008 answerable from the contract, test name, unused keys, v2-portals §6.4 count)
  - Passed:
    - D90: Tambah adds and Padam removes the whole group (contract `paths.ts:312,328`).
    - Payloads match e363fe51 and BASE-14.
    - Edits are saved before Tambah/Padam; the buttons are hidden on a published paper.
    - The blockers.ts order canOverride → flags → text is unit-tested.

- **H-C6 r1/hc6-skema-evidence @ c554cbae (C1): Approve with Minors**
  - Trial merge on BASE-14: clean (4f50df3b). The head lacks BASE-14.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (2 files). `vitest --project unit` kontrak-evidence-skema + m28 `__tests__` + registry-boot: 34 files, 477/477.
  - Code `EvidenceDrawer.vue`: for a skema, Tempoh and Peraturan are hidden, and neither `durationMin` nor `rule` is sent; a trial paper is unchanged (SPP 10.3, AC-39.8). Correct and minimal.
  - Minor: the new BM line "Skema tidak mencetak peraturan menjawab atau tempoh, jadi kedua-duanya tidak diisi." is not in V2 and not tagged [PROPOSED] or recorded as a deviation.
  - Minor: editing an existing skema item that carries a rule or duration silently drops them on save. This is probably intended; note it in the test or the deviation row.
  - Info: the server side (H-A15, `r1/ha15-blueprint-evidence`) is not merged. The FE works on its own.
  - No security flag (no new endpoint; fields only removed).

- **T13 r1/t13-studio-groups @ 17ac8f28 (C3, round 3): Approve with Minors**; **security: Pass on the C3 delta (1 Low)**, with a residual Medium in T32 base code routed to A2
  - Trial merge on BASE-14 (T32 87a9a363 now in base): clean (5f523cfd). The head lacks BASE-14.
  - Checks: api tsc 0; vue-tsc 0; eslint 0 (51 files); `contract:check` ok.
    - DB (local PG): studio-group-lock, studio-part-images, stimulus-api, stimulus-display, stimulus-group-rules, figure-links(+unit), stimulus-links: 8 files, 61/61.
    - FE `--project unit` (10 changed test files + registry-boot): 11 files, 64/64.
  - Conflict resolution against T32: no T32 behaviour lost. `git diff 70971776 HEAD -- apps/api/src/modules/questions/` is additive: StudioController/StudioDskpService, `numberLabel`, `mapOptionImageIds`, part-image `referencedIds`; `joinNew` (:605) and `move` (:896) are kept.
  - Minor `src/stores/session.ts:326-334`, `http-session.ts:136`: a 401 → `clear()` → `dropLocalDrafts()` wipes the Studio draft in the exact case recovery is for. Drafts are already keyed per user. Fix: drop drafts only in `logout()` and on a user switch.
  - Minor `StudioGroupEditor.vue:53,72,96,342-343`: the client lock is stricter than the server (it blocks appending a draft, which T32 allows) and reads the latest status (misses a served question with a pending draft). It still shows the removed `GROUP_LOCKED_MESSAGE` text. The server 409 is now authoritative, so this is UX only. Fix: drop or narrow the lock; use `STIMULUS_MESSAGES.groupServed`.
  - Minor (D93) `StudioGroupEditor.vue:150-168`, `StudioEditorPage.vue:178-183`: on the create page, "Cipta rangsangan kongsi" creates the stimulus and an empty group at once. An abandoned page leaves orphans that nothing can list yet. Fix: create them in the save step, or dissolve them on leave; at least note it in UX-13.
  - Minor `StudioEditorPage.vue:223`: the badge shows the raw status enum. Use the BM labels.
  - Minor / SEC LOW (C3, **still open**) `intake/workflow/stimuli.service.ts:125-137` linkReferencing: items are read before the batch lock, and `updateMany` filters on id only. Fix: add `stimulusId: null, reviewState in ('generated','needs_review')` to the where.
  - Minor (impact unverified, **still open**) `extraction.service.ts:413-418`: extraction-time links skip the contiguity gather.
  - SEC LOW (A2/C3) lock order: `questions.service.ts:894-896` locks the question then the group (`move`), while the stimulus routes lock the group then the questions. A concurrent pair can deadlock → 500. Fix: lock the groups first, or map deadlock to 409.
  - **SEC MEDIUM, T32 residual, owner A2 (base code, not C3's delta)** `stimuli.repository.ts:223,248-282`: "served" = active + live approved only. An archived question still pinned in a Terbit paper is not counted, and the 409 texts (`contract questions/stimuli.ts:45-47`) tell the admin to archive first. Archive the member, then `PUT /stimuli/:id`, `PUT/DELETE` the group or remove the member: pupils on the published paper see the changed or missing figure for a pinned, graded version (image rule B `PAPER_PINNED_STATUSES`). Fix: add a pinned-in-published-paper EXISTS to `servingMemberIds`/`stimulusServed`, and reword the messages.
  - Cycle-1 re-check:
    - Studio on T32 routes without a served lock: **fixed**. 409 on updateStimulus :83, updateGroup :153, deleteGroup :163, and add/remove/order/set via `GroupMembers.set`.
    - Client lock: **open** (Minor, no longer unsafe).
    - FOR UPDATE: **fixed** (`GroupMembers.lock` in set/joinNew/move, `lockQuestions` in id order).
    - Intake accept 409: **fixed** by design (`joinNew` appends).
    - Non-atomic saveMembers: **fixed** (one `PUT /stimulus-groups/:id/members`).
    - Inline cap message: **fixed** (`M.membersTooMany`).
    - Raw badge: **open**. Orphan stimulus: **open** (widened by D93). linkReferencing race: **open**. Extraction contiguity: **open**.
    - Draft wipe: logout **fixed**, 401 over-clears.
    - Security T13-SEC-M1: **fixed** for live-served members. SEC-L1: **fixed**. T32-L1: **fixed** for stimuli (question path decimal id remains Low, admin only). T32-L2: **fixed**.
  - B2 probe 1 (a draft joins a served group) is now intended D93/T32 behaviour: the draft is appended and served members keep their order. The spec was re-pointed accordingly.

### Merge readiness summary (cycle 2)
- **No Team C unit is "Ready for B1 merge"**: no head contains BASE-14 (70971776).
- **T15:** Approve. Merge BASE-14 → ready.
- **H-C6:** Approve with Minors. Tag the new copy, then merge BASE-14.
- **T13:** Approve with Minors; security Pass on the C3 delta. Merge BASE-14. Lead to decide whether the Minors (401 draft wipe, orphan D93 groups) block. The T32 residual Medium is for A2.
- **T14:** Approve with Minors. Merge BASE-14.
- **T12:** Approve with Minors. Needs T11.
- **T11:** security MEDIUM (kuiz check accepts any own session) still open; the T07 conflict now has to be resolved in the lane's BASE-14 merge.
- **T10:** Changes requested: dirty override; Tambah/Padam meaning not recorded as a deviation; merge after T34.

## Cycle 3 — 2026-10-31 (20:52–21:25 MYT, base BASE-14 70971776)

Scope: the heads posted by C2 and C4 at 20:55 MYT (cb66671). A first note (5abb327) said there was no new work. It was written before that commit was pulled and is replaced by this section. T10, H-C6 and T13 have not changed, so their cycle 2 verdicts stand.

Method: each head was trial-merged into BASE-14 in a scratch worktree, one at a time.
- Code review: 3 code-reviewer subagents plus 1 security-engineer subagent (opus, high effort, each in its own worktree, reading only).
- Checks were run by this session on each trial merge. DB specs used a local Postgres 16 via TEST_DATABASE_URL.
- **No head contains BASE-14**, so **no unit is "Ready for B1 merge"**.

- **T11 r1/b16-kuiz @ dafc435f (C2): Approve with Minors** (code); **security: Changes requested** (MEDIUM still open)
  - Trial merge on BASE-14: **CONFLICT** in `apps/api/src/modules/bijak/kuiz/kuiz.mapper.ts` (`resolveStimuli`, with T07). Fix: take BASE-14's `kind: KUIZ_KIND[s.kind]` and drop `TODO(T07)` with the raw `kind: s.kind`. If T11's side is kept, tsc fails and the 4 picture kinds return 500. **H-C8 @ 7ac922a7 already contains this resolution**, so land T11 and T12 through H-C8 (or resolve in the same way).
  - Checks: the T11 code was run inside the H-C8 trial (below): api tsc 0; `test/bijak-kuiz` 3 files 31/31; contract:check ok.
  - The delta (403 `paperUnavailable` on per-paper page and check) is good:
    - 404 checks run first (bad id, Draf paper, another pupil's Jana paper), then the 403 (`kuiz.service.ts:345-355`). No existence oracle.
    - The message is fixed; no question id leaks.
    - The text is identical to H-A13 `BIJAK_ATTEMPTS_MESSAGES.paperUnavailable` and to the mock.
  - SECURITY MEDIUM (from cycle 1, **still open**) `kuiz.service.ts:139-140` (`check`), `:182-183` (`finish`):
    - `lockSession` filters by (id, userId) only, and `check` never calls `incrementTrialUsed`.
    - The `finish` guard `mode !== KUIZ_MODE` cannot tell a kuiz session from M06 Latih Tubi, because `KUIZ_MODE = 'latih_tubi'` (`:58`, `contract/practice/schema.ts:21`).
    - Exploit: start a practice session (`latih_tubi`, `targetQuestionId`), then call the kuiz check repeatedly. This returns the key and explanation with no BR-07 count, and submit then credits rewards.
    - Fix (C2 + A, M05 store owner): add a distinct kuiz origin or mode, and reject other sessions in `check` and `finish` with `quizNotFound`. Product decides whether the kuiz itself consumes trial checks (REQ to A/QUESTIONS).
  - Minor `kuiz.service.ts:353`: the rule requires `isActive && approved`, but H-A13 (`papers/attempt-source.ts:90-91`) checks only approved ("is_active is NOT checked"). A deactivated but unarchived question therefore gives "Mula" OK while the per-paper Kuiz is refused. Fix: use one predicate (`resolveForAttempt`: `not_eligible`→403).
  - Minor `docs/requirements/v3-bijak-spm-scope.md:198` (AC-R1-18.4) still says "Terbit papers keep their frozen snapshot". Product-analyst: update the AC to match REQ-A-003/Q1.
  - Minor `apps/api/test/bijak-kuiz/kuiz.spec.ts:383` (19b) covers only the archived-status case. Add cases for a missing question, an inactive question, no placements, and an archive through the real lifecycle (which clears `live_version_no`).
  - Minor `packages/contract/src/bijak/kuiz/paths.ts:106,122`: the 403 is still documented as role/CSRF only. Add the `paperUnavailable` 403, then re-emit openapi.
  - Low (security) `kuiz.service.ts:353`: every page and check runs `getMany(placed,'live')` (up to 300/min per user). Use a status-only count or a short cache.
  - Low (product) `paperCheck` returns key and explanation for any placed MCQ, even while the pupil has an open scored sitting on the same paper (V2 parity `/simulasi/{paper}/kuiz`). Product to decide.
  - Earlier findings:
    - (b) pages/markableTotal computed before the `complete` filter, and paperCheck marks skipped items: **still open**.
    - (c) servable re-check: **partly fixed** (isActive mismatch above).
    - (d) `singleMcqLeaf`-only draw: **still open**.
    - (e) B3 M1 (key via paperCheck): **still pending product**, not in QUESTIONS.md, so the lead should raise it.
    - Contract `[PROPOSED]` tag on the Q1-approved line: drop it (owning unit).

- **T12 r1/f12-kuiz @ 9e7cb8fb (C2): Approve with Minors**
  - Trial merge on BASE-14: **CONFLICT** in the same `kuiz.mapper.ts` hunk (through b16). Resolve as for T11, or land via H-C8.
  - Checks (H-C8 trial, which contains T12):
    - vue-tsc 0; eslint 0.
    - `vitest --project unit src/modules/m28-bijak-spm src/app/__tests__ registry-boot`: 49 files, 642/642.
  - Minor `PaperQuizPage.vue:164`: "Kertas belum tersedia" is new copy (not in V2 §1.8, BIJAK-SPM-cloud §3.6 or Q1). Tag it [PROPOSED] and list it for the user, or reuse an existing title.
  - Minor `PaperQuizPage.vue:97-101`: every 403 becomes "Kertas belum tersedia", including role and CSRF ("Akses ditolak"). Switch only on the `paperUnavailable` text.
  - Minor `server/kuiz-mock.ts:186-187`: the mock skips a missing placed question and serves the paper. It should throw forbidden `PAPER_UNAVAILABLE`, as H-C5 does in `store.ts`.
  - Nit `PaperQuizPage.vue:118`: a 403 on check leaves the page interactive. Consider `phase='unavailable'`.
  - Earlier Minors, all **still open**:
    - The "Soalan n" chip counts leaves.
    - "Kertas penuh" should be "← Kertas penuh" (`lib/kuiz.ts:21`).
    - Syiling/Mata chips (`KuizPage.vue:192-193`).
    - `Number()` vs `parseInt` (`lib/kuiz-count.ts:7`).
    - Stale "Semak Jawapan" comments.
    - No `loadSeq` test.
    - The mock returns 200 for an out-of-range page.

- **H-C5 r1/hc5-mula-403 @ fc54afc8 (C2): Changes requested**; **security: Pass**
  - Trial merge on BASE-14: clean (3d7b1da3).
  - Checks:
    - vue-tsc 0; eslint 0 (3 files).
    - `vitest --project unit src/modules/m28-bijak-spm registry-boot`: 34 files, 478/478.
  - MAJOR `src/modules/m28-bijak-spm/pages/PaperCoverPage.vue:172,181`: the `failure` UAlert sits inside `<section v-if="!needsChoice">`, so the 403 is invisible on the "Mula Semula" path.
    - Scenario: open non-fresh sitting → question archived → "Mula Semula" → `begin(true)` → the API (H-A13 `attempts.service.ts:216-223`) and the mock (`store.ts:396-403`) return 403 → the sitting stays open and the pupil sees nothing.
    - After H-A13 this is the main way to reach the cover, because the card is hidden without an open sitting.
    - Fix: render the alert outside that section (or under `resume-choice` too), and add a test for a rejected restart.
  - Minor `__tests__/mula-403.test.ts` covers only the no-open-sitting case.
  - Nit `:63-66`: the `&& e.message` fallback never fires over HTTP (`toBijakError` always fills "Akses ditolak").
  - Nit `store.ts:400`: the mock does not refuse a paper with zero placements; the API does (`attempt-source.ts:89`).
  - Security: the message is UAlert `:title` text, not v-html. The error shape matches H-A13 (FORBIDDEN + BM line).

- **H-C8 r1/hc8-kuiz-stimuli @ 7ac922a7 (C2): Changes requested**; **security: Pass** (XSS, file tokens, stimulus leakage; it inherits the T11 MEDIUM unchanged)
  - Trial merge on BASE-14: clean (6fb8048a). It resolves the T11/T12 `kuiz.mapper.ts` conflict. The H-C8 delta is the merge 7ac922a7 itself (`--remerge-diff`, 10 files).
  - Checks on the trial:
    - api tsc 0; contract:check ok; vue-tsc 0; eslint 0 (134 changed files vs base).
    - api `TEST_DATABASE_URL=… npx vitest run test/bijak-kuiz`: 3 files, 31/31.
    - `vitest --project unit src/modules/m28-bijak-spm src/app/__tests__ registry-boot`: 49 files, 642/642.
  - MAJOR `src/modules/m28-bijak-spm/lib/kuiz.ts:58` with `src/components/question-display/StimulusFigure.vue:194`: a table stimulus whose body is not a parseable grid comes with `table: null` and a body.
    - The FE passes `kind:'table'` through, and StimulusFigure has no branch for it, so only the "label · Jadual" figcaption shows and the text is lost.
    - The paper path (`StimulusView.vue`) shows the text, so this breaks kuiz = paper parity (e.g. a Word-imported table with merged cells).
    - Fix: map `table && !s.table` → `passage` in `toStimulus` (or let StimulusFigure show `text` without a grid), and add a test.
  - Minor `lib/kuiz.ts:66`: the caption is copied into `table.caption`, so it shows twice (`<caption>` and figcaption). V2 §1.5 shows it once, and `kuiz-server.test.ts:165` asserts the duplicate. Drop the spread and fix the test.
  - Minor `apps/api/src/modules/bijak/kuiz/kuiz.mapper.ts:236-238`: an own stimulus that reuses the group's (or an earlier) picture file is silently dropped even when its label or caption differs. This contradicts "Never silently dropped", and the bridge `ownStimuliOf` keeps it. Remove the file-dedup for labelled own stimuli.
  - Minor (parity, carried from T11/R1E2E-05b) — the kuiz serves some questions that the real paper refuses:
    - a leaf-only part stimulus (`kuiz.service.ts:373-374` vs bridge `stimulus_outside_group`);
    - groups with 0 or more than 3 stimuli;
    - `imageToken: null` (`file_missing`).
    Track this as a follow-up.
  - Minor `kuiz.service.ts:266-269`: `markableTotal` still counts skipped incomplete parts. H-C8 skips more questions, so "Skor: x / y" can show a total the pupil cannot reach.
  - Minor (test gap): `e2e/bijak/kuiz-responsive.spec.ts` mock data has no wide table. Add one and assert `fits()` at 375. The classes (`max-w-full overflow-x-auto`) look right.
  - Nit `kuiz.mapper.ts:180`: whitespace-only body counts as content. Use `body?.trim()`.
  - Nit: an unlabelled own picture gets `alt: null` (the bridge sends "Gambar untuk soalan ini").
  - Passed:
    - `toKuizStimulus` matches T07 `stimulusDefOf` and `stimulusTableOf`.
    - Shared-ungrouped, unknown, audio and empty stimuli → incomplete.
    - Captionless pictures are still served.
    - Link order is `position asc`.
    - D90: group stimulus once, members together, own stimuli on the first leaf only.
    - approved/isActive filters are unchanged.
    - The contract change is additive. Its own openapi hunk is kuiz-only.
    - No new copy and no real names.
    - Security: all fields render via `{{ }}`. StimulusFigure's only v-html (`svg`) is never set from the wire. Only `files.public_id` tokens are sent, and they are scoped by `pupilMayReadQuestionImageSql`.
  - Low (security): there is no size cap on table rows/cols or body in the kuiz response. The content is author-controlled, so this is hardening only.

- **T14 r1/t14-student-bugs @ 4b033de3 (C4): Approve with Minors** (cycle 1 verdict stands)
  - The tree equals the cycle 1 reviewed trial merge on BASE-8 (103afab9).
  - Merge-tree on BASE-14: clean. The head lacks BASE-14.
  - The `StructuredAnswerPage.vue:74` `isStem` Minor and the doc Nit are still open.

- **T15 r1/t15-bm-copy @ dbf7d81e (C4): Approve** (cycle 1 verdict stands)
  - The tree equals the cycle 1 reviewed trial merge (3c7e67c6).
  - Merge-tree on BASE-14: clean. The head lacks BASE-14.

- **H-C7 r1/hc7-own-stimuli @ 26ec4608 (C4, stacked on R1E2E-05b fcf08660): Approve with Minors**
  - Trial merge on BASE-14: clean (c3abd60f). The C4-only commit is 26ec4608.
  - Checks:
    - vue-tsc 0; eslint 0 (14 files).
    - `vitest --project unit src/modules/m28-bijak-spm registry-boot`: 33 files, 478/478.
  - Passed:
    - D90: the bridge `ownStimuliOf` excludes group stimulus ids and refuses shared-ungrouped ones, so a group stimulus never reaches `question.stimuli`.
    - `stimuli` has minItems 1 and is sent only when non-empty, so `??` never meets `[]`.
    - `stemImage` equals `stimuli[0]` when present, so it is never shown twice.
    - Stimuli render above the stem (cloud-student-mechanism §1.5), and ResultPage has the same logic.
    - No new v-html.
  - Minor `src/modules/m28-bijak-spm/pages/ResultPage.vue:125-128,413-416` has no test. Add tests for own stimuli above the stem, the `stemImage` fallback, and "not twice".
  - Nit `ResultPage.vue:414-415`: `ownStimuliOf` is called twice per row. Use a computed Map.
  - Nit `QuestionBlock.vue:121`: `data-testid="stem-image"` now also wraps passages and tables. Add a comment or an `own-stimuli` id.
  - Merge after R1E2E-05b.

- **H-C3 r1/hc3-essay-choice-view @ 6ee50cd5 (C4, stacked on H-A7 d7424ace): Changes requested**
  - Trial merge on BASE-14: clean (b5f21584). The C4-only commit is 6ee50cd5.
  - Checks:
    - vue-tsc 0; eslint 0 (6 src files).
    - `vitest --project unit src/modules/m04-question-bank registry-boot`: 35 files, 480/480.
    - The `QuestionQualityPage.vue:291` `sm:p-5` lint error is on base (8bb59c2a) and is not touched here.
  - MAJOR (the B2 Minor on H-A7, unaddressed and now user-facing) `apps/api/src/modules/questions/questions.service.ts:800`: `flatShaped` excludes essay_choice, so a PUT drops `modelAnswer` and `pointsValue`. essay_choice reads as `questionType:'essay'`, so `QuestionForm.vue:511-524,600-604` shows those fields as editable and pre-filled. An admin edits and saves, sees the success flash, and the change is lost. Fix (either):
    - make those fields read-only when `question.essayTopics?.length`, with a [PROPOSED] BM note;
    - or have A return a BM 422.
  - Minor `QuestionListPage.vue:591`, `QuestionDetailPage.vue:290`: "Esei pilihan" is new copy (in no discovery, parity or design doc). Tag it [PROPOSED] in the copy or deviation table.
  - Minor `QuestionListPage.vue:590`: the badge sits in `#excerptText-cell`, which DsDataTable card mode (narrow screens) does not render. Add a card field, or record the gap (consistent with the DSKP badges).
  - Nit `src/modules/m04-question-bank/api/questions.ts:130-131`: `EssayTopic` was inserted under the `Question` JSDoc. Move it above.
  - Nit `mock/repository/questions.ts:556`: an out-of-scope cast removal (the same as H-C4; merges cleanly, vue-tsc 0).
  - Merge after T25 and H-A7.

- **H-C4 r1/hc4-report-arkib @ c92c711b (C4, stacked on T35 2dd3c598): Changes requested**
  - Trial merge on BASE-14: clean (a8920d4d). It is also clean against the current T35 tip 4ea790b1, whose newer commits do not change the request shape. The C4-only commit is c92c711b.
  - Checks:
    - vue-tsc 0; eslint 0 (8 src files).
    - `vitest --project unit src/modules/m04-question-bank registry-boot`: 35 files, 479/479.
  - Passed:
    - The payload matches `QuestionReportUpdateRequestSchema` (`archive` is a FlagSchema, applied via `archiveReported`).
    - Errors go through the existing flash.
    - The button is 44px.
  - MAJOR `src/modules/m04-question-bank/components/ReportCard.vue:77-87` + `api/reports.ts` `ReportUpdated`: the H-A13 (d51a4abf) response `data.warning`/`data.papers[]` is ignored.
    - The warning is the Q1-approved line: "Soalan ini ada dalam kertas yang telah diterbitkan. Murid tidak boleh memulakan percubaan baharu pada kertas itu sehingga soalan diganti."
    - An admin who archives a question placed on a Terbit paper is never told that pupils are now blocked.
    - Fix: add `warning?`/`papers?` to the type, show a warning flash with the paper titles, and have the mock return them. If another FE unit owns this, the lead can downgrade it to a tracked item.
  - Minor `ReportCard.vue:93,295-308`: Arkib fires without a confirm. The .cloud Panel equivalent has "Arkibkan soalan ini?" (cloud-student-mechanism.md:349). Add a confirm with that copy and record it as a deviation.
  - Minor `lib/report-reasons.ts:157`: `ARCHIVE_NOTE = 'Diarkibkan oleh admin'` is new copy. Tag it [PROPOSED].
  - Minor `mock/handlers/reports.ts:114-122`: the mock reads only `isActive`. T35 `displayOf` also treats fixed + archived as "Dikeluarkan", so in the mock an archived-then-Selesai report shows "Selesai".
  - Minor `mock/repository/reports.ts:152-157`: a structured question is archived by setting it inactive. Note this in the m04 mock deviation notes.
  - Nit `ReportCard.vue:296`: Arkib still shows for an already-archived question (a harmless no-op).
  - Merge after T35. H-C4 sits on the older T35 2dd3c598, so take the T35 tip first.

### Merge readiness summary (cycle 3)
- **No Team C unit is "Ready for B1 merge"**: no head contains BASE-14 (70971776).
- Approve, needs only BASE-14:
  - **T15**: Approve.
  - **T14**: Approve with Minors.
- **T12**: Approve with Minors. Land it with T11 via H-C8 (the conflict is resolved there).
- **T11**: Approve with Minors on the code, but the **security MEDIUM** (kuiz check accepts any own session; `KUIZ_MODE='latih_tubi'`) is still open, and the merge into BASE-14 conflicts in kuiz.mapper.ts.
- Changes requested:
  - **H-C8**: blank non-grid table (MAJOR). Merge after T07 (in base), R1E2E-05b, T11 and T12.
  - **H-C5**: 403 invisible on Mula Semula (MAJOR).
  - **H-C3**: essay_choice edit silently loses model answer and points (MAJOR). Merge after T25 and H-A7.
  - **H-C4**: H-A13 archive warning not shown (MAJOR). Merge after T35.
- **H-C7**: Approve with Minors. Merge after R1E2E-05b.
- Unchanged since cycle 2: T10 Changes requested; H-C6 Approve with Minors; T13 Approve with Minors (security Pass on the delta).

## Cycle 4 — 2026-10-31 (21:55–22:45 MYT, trial base BASE-17 8e8812ed; latest at write-up BASE-21 a6ff0c0d)

Scope: the five C4 heads posted at 21:55 MYT (e5638c3). The C1, C2 and C3 heads that were READY at cycle start had verdicts already. New C1 heads (T10 @ 524887207, H-C6 @ 503ab17d6) and C3 heads (T13 @ 114173c99, T13b @ d8a6596d1) were posted during this cycle. **They are not reviewed here.**

Method: each head was trial-merged into BASE-17 (`--no-ff`, scratch worktree). Each worktree had its own `npm ci`, because workspace packages must resolve to the worktree, not the base checkout. Code review used 2 code-reviewer subagents (opus, high effort, read-only, one worktree each). No security flag on these units. DB specs ran on a local Postgres 16.

BASE-15..21 landed while this cycle ran. BASE-20 = T14 and BASE-21 = T15 were merged by B1 on the B2 verdict, which agrees with this one. BASE-18 = T35 tip 4ea790b1. The three stacked heads were re-checked with `git merge-tree` against BASE-21; all are clean.

- **T14 r1/t14-student-bugs @ 1903b713 (C4): Approve** (already MERGED as BASE-20)
  - Trial merge on BASE-17: clean (02e02bdb).
  - Checks:
    - api tsc 0; vue-tsc 0; eslint 0 (9 files).
    - `vitest --project unit src/modules/m06-* src/modules/m05-practice/__tests__ src/modules/m28-bijak-spm/__tests__ packages/exam-core registry-boot`: 76 files, 1258/1258.
    - api (local PG) `test/bijak-attempts test/exam-core`: 10 files, 174/174.
  - Minor `StructuredAnswerPage.vue:74-79` isStem: **fixed**. A row is a stem only with 0 marks AND a next label starting with `${label}.`.
    - This matches `flatten.ts` (child label = parent + "."). "1" does not catch "10.a", and the last row is a leaf.
    - `stem-rows.test.ts:31-50` fails under the old rule.
  - Nit T14-D1/D2 "D9 choice": **fixed**.
  - T14-D4 ("Tiada soalan" tile, user decision) is still recorded (`v2-bijak-spm.md:665`).

- **T15 r1/t15-bm-copy @ 09eabe2e (C4): Approve** (already MERGED as BASE-21)
  - Trial merge on BASE-17: clean (189e4ce2).
  - Checks:
    - api tsc 0; vue-tsc 0; eslint 0 (2 files).
    - `vitest --project unit semakan QuestionFormPages registry-boot`: 4 files, 60/60.
  - `git rev-list --no-merges dbf7d81e..09eabe2e ^70971776` is empty, and the BASE-14 merge changed nothing in the T15 diff (docs/comments only).

- **H-C7 r1/hc7-own-stimuli @ 786d3e4d (C4, stacked on R1E2E-05b fcf08660): Approve with Minors** (unchanged)
  - Trial merge on BASE-17: clean (722c4a1e). Merge-tree on BASE-21: clean. The stack is current with `r1/e2e05b-own-stimuli`.
  - Checks:
    - api tsc 0; vue-tsc 0; eslint 0 errors (14 files; 2 `require-default-prop` warnings in a test stub).
    - `vitest --project unit src/modules/m28-bijak-spm registry-boot`: 33 files, 478/478.
  - Since 26ec4608 only the BASE-14 merge was added (empty remerge-diff). Earlier Minor (no ResultPage test) and Nits (`ownStimuliOf` twice, `stem-image` testid) are **still open**.
  - Not ready: R1E2E-05b is not in base, and the head lacks BASE-21.

- **H-C3 r1/hc3-essay-choice-view @ 396961a7 (C4): Changes requested**
  - Trial merge on BASE-17: clean (9747e57d). H-A7 and T25 are now in base, so the delta is C4-only (6 files). Merge-tree on BASE-21: clean.
  - Checks:
    - api tsc 0; vue-tsc 0; eslint 0 (6 files).
    - `vitest --project unit src/modules/m04-question-bank registry-boot`: 35 files, 480/480.
  - No C4 code change since cycle 3. Every earlier finding is **still open**:
    - **MAJOR** `apps/api/src/modules/questions/questions.service.ts:803` `flatShaped` still excludes essay_choice (`:830` keeps `v.parts`), while `QuestionForm.vue:511-524,600-604` shows modelAnswer/pointsValue as editable. H-A7 now loads essay_choice into the form as essay, so the silent loss is easier to hit. Fix: make the fields read-only when `essayTopics?.length` (with a [PROPOSED] note), or have the API return a BM 422.
    - Minor: "Esei pilihan" copy is untagged.
    - Minor: the badge is missing in DsDataTable card mode (<md, `DsDataTable.vue:283-299`).
    - Nits: EssayTopic JSDoc; cast.

- **H-C4 r1/hc4-report-arkib @ b458c8f3 (C4): Changes requested**
  - Trial merge on BASE-17: clean (d96cc779).
  - Checks:
    - api tsc 0; vue-tsc 0; eslint 0 (14 files).
    - `vitest --project unit src/modules/m04-question-bank registry-boot`: 35 files, 479/479.
  - New: the head is stacked on the stale T35 2dd3c598, not the merged tip 4ea790b1. It lacks b6552aa0 (`archiveReported`), so on this head Arkib on a question with a revision in Semakan gives a 409.
    - Merge-tree on BASE-21 (which has T35 tip as BASE-18) is clean with **no apps/api diff**, so merging the latest BASE fixes it.
    - Fix: merge BASE-21 into the branch and re-post.
  - Earlier findings, **still open**:
    - MAJOR: the H-A13 `warning`/`papers` response is ignored (`ReportCard.vue:77-87`, `api/reports.ts:114-122`). H-A13 d51a4abf is still not in BASE-21. If the lead prefers, treat this as a merge-order item (show the warning when H-A13 lands).
    - Minor: no "Arkibkan soalan ini?" confirm (`v2-admin-student-pipeline.md:397`, `cloud-student-mechanism.md:349`).
    - Minor: `ARCHIVE_NOTE` untagged.
    - Minor: mock display ignores `status==='archived'`; structured archive = inactive is not recorded.
    - Nit: Arkib shows for an already-archived question.

### Merge readiness summary (cycle 4)
- T14 and T15: Approve. **Already merged** (BASE-20, BASE-21).
- **No other Team C unit is "Ready for B1 merge"**. No other head contains BASE-21 (a6ff0c0d).
- H-C7: Approve with Minors. Needs R1E2E-05b merged first, then a BASE-21 merge.
- H-C3: Changes requested (essay_choice edit loses data). Its dependencies H-A7 and T25 are now in base.
- H-C4: Changes requested (H-A13 warning; merge BASE-21 to pick up the T35 tip).
- Unchanged from cycle 3: T11, T12, H-C5, H-C8.
- Next cycle: T10 @ 524887207, H-C6 @ 503ab17d6, T13 @ 114173c99, T13b @ d8a6596d1.
