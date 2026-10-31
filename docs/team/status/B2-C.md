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

## Cycle 3 — 2026-10-31 (20:52 MYT, base BASE-14 70971776)

No new work. Every READY-FOR-REVIEW head in status/C1–C4.md already has a verdict in cycle 1 or cycle 2: T10 e1546909, H-C6 c554cbae, T11 48fa74e8, T12 07f57221, T13 17ac8f28, T14 6f2f682a, T15 17f62b94. The cycle 1 and 2 verdicts and the "Ready for B1 merge" summary still stand. No Team C head contains BASE-14.
- Not reviewed (no READY claim or evidence yet): `r1/f08-builder-ui` moved to 467116b3 (20:44, V2 admin parity, R1-F09 scope). The other branch tips (T11 dafc435f, T12 9e7cb8fb, T14 4b033de3, T15 dbf7d81e) are the BASE-8 tips already noted in cycle 1. None of them contains BASE-14.
- Next cycle: the lanes merge BASE-14 and post READY heads. T14 and T15 then need only a tree diff against the reviewed trial merge.
