# R1 E2E readiness map (H-A23)

Date: 2026-10-31. Branch `r1/ha23-e2e-readiness`, off `feature/v3-bijak-r1` at 823d8dfb (BASE-19). Docs only; nothing was run.

Question: what must be merged so that B4 (T23) can run the whole R1 acceptance flow on the real stack, and in which order?

Sources: `docs/team/status/B4.md`, `MERGE-LOG.md`, `BOARD.md`, `requests/*.md` and the lane status files on `origin/team/r1-board`; the T23 baseline report `docs/qa/r1-e2e-baseline-2026-10-31.md` on `origin/r1/t23-e2e`; my admin and student parity checks (H-A19, H-A20, H-A22); `docs/qa/r1-backend-ac-coverage.md` (H-A17). Branch heads are the heads on origin when this was written.

Method for conflicts: `git merge-tree --write-tree` between BASE-19 and each branch, and in a chain (objects only, no checkout, no working-tree change). A conflict listed here is a textual conflict on today's heads. It says nothing about test results; B1 re-runs the gates on the real merge.

## 1. Result in short

- T23 last ran on BASE-1 (51 pass, 27 fail, 6 skip). BASE-19 already holds the fix or the cause-fix for several baseline bugs: R1E2E-01 (subject codes), R1E2E-08 (T04 lifecycle, approved is served), the T03 bridge, T25/T07/T32 (stimuli, groups, essay_choice), T28 (rewards), T35 (Arkib). Re-running now would change the picture, but would still stop at steps 2 to 4.
- Steps 5 (pupil), 6 (Databank, Latih Tubi SPM, Bab) and most of 7 work on BASE-19 code. The Mula 403 on an image question (R1E2E-05) is fixed on a branch, not in base.
- Steps 1 to 4 (admin side) need these unmerged units: T29 and T33 (DSKP approve gate), T34 (Terbit gates and override), T10 (Set Builder UI), T13 and t13b (Studio, status buttons), plus T26 (seed).
- **Smallest set** (section 5): T26 via `r1/b1-e2e-off-poc`, `r1/e2e05b-own-stimuli`, T29, T33, T34, T10, T13, t13b, T30 and hc4. That is 10 merges. It also needs 3 owner actions (BASE merges) because T33, T34 and t13b conflict today.
- **No branch at all** (section 6): R1E2E-02 DSKP picker, R1E2E-04 legacy "Hantar untuk Semakan", the pupil Lapor control, the T34 follow-up (structured blockers, `canOverride`), H-C1 Bab empty state, a playable structured paper for e2e after T36, and T43/T44/T47/T48/T49.

## 2. Unit table

"Contains BASE-19" says whether the head already includes 823d8dfb. "Alone vs BASE-19" is the virtual merge of the head with base. Verdicts are the last ones recorded by B1/B2/B3 on the board; a moved head means the delta is not reviewed yet.

| Unit | Branch | Head | In base | Contains BASE-19 | Alone vs BASE-19 | Last verdict on board |
|---|---|---|---|---|---|---|
| T26 e2e seed | `r1/t26-e2e-seed` | 510f085b | no | no | clean | B2 Approve, B3 Pass; X1 MAJOR with H-A15 (see 4.3) |
| REQ-A-001 CI off PoC | `r1/b1-e2e-off-poc` | b209b4ff | no | no (has BASE-10) | clean | Approve with Minors, Minors closed; contains T26; "merge after or with T26" |
| T36 remove PoC | `r1/t36-remove-poc` | 40d4851d | no | no | conflict: `test/bijak-papers/generate.spec.ts` (and `bijak-integration/poc-flag.spec.ts` after T29..) | B3 Pass; B2 review open |
| R1E2E-05 + 05b | `r1/e2e05b-own-stimuli` (contains `r1/e2e05-stem-image` 00cec26f) | 57e7feee | no | yes | clean (00cec26f alone conflicts in `be09-mapping.ts`) | 05: Approve with Minors; 05b: not listed on the board |
| T29 servability | `r1/t29-servability` | c53e655d | no | yes | clean | Approve @10da0f3f; moved |
| T30 servability reads | `r1/t30-servability-reads` | 09d53c56 | no | yes | clean | Changes requested @f2eeec7d (2 MAJOR); moved, re-review |
| T33 leaf tags, approve gate, status route | `r1/t33-leaf-tags` | 276a6622 | no | no | conflict: `questions/http/views.ts`, `workflow/lifecycle/lifecycle.service.ts` (+ `questions.module.ts`, `questions.repository.ts` after T29) | B2 Approve (after T29), B3 Pass; migration 0102 |
| T34 builder review, override | `r1/t34-builder-review` | e363fe51 | no | no | conflict: `questions/questions.module.ts` | Changes requested (override lifts structural tier); B2 findings fixed in e363fe51, re-review open |
| T31 builder wire | `r1/t31-builder-wire` | 5ab47b09 | no | BASE-17 | clean alone (contains T34 e363fe51); conflict `questions.module.ts` after T29/T30 | Changes requested at an older head |
| T10 Set Builder, Semak Kertas (+F09) | `r1/f08-builder-ui` | 9aa080d5 | no | no | clean | Approve with Minors @e1546909; "after T34"; head moved (F09 V2 parity commits) |
| T13 Studio create/edit, groups | `r1/t13-studio-groups` | 114173c9 | no | BASE-14 | clean alone; conflict `questions.module.ts` after T29/T30 | B3 Pass; B2 re-review of rebuilt T13 open |
| t13b Studio list, status buttons | `r1/t13b-studio-list` | d8a6596d | no | BASE-14 | conflict: `lifecycle.service.ts` (T35) | not reviewed; in progress |
| hc-intake-parity | `r1/hc-intake-parity` | eaef3360 | no | no | clean; docs conflict (design doc) after others | READY, not reviewed |
| hc-kontrak-parity | `r1/hc-kontrak-parity` | 08474528 | no | no | clean | wip (tsc, eslint pending) |
| hc-kandungan-hub | `r1/hc-kandungan-hub` | b2424eb0 | no | BASE-14 | clean | wip (one lane test pending) |
| H-A13 archived paper | `r1/ha13-archived-paper` | d51a4abf | no | no | clean | Approve with Minors; needs `npm run contract:emit` |
| T11 Kuiz API follow-up | `r1/b16-kuiz` | 97e6c3df | no | yes | clean | Approve with Minors @dafc435f; moved |
| T12 Kuiz FE | `r1/f12-kuiz` | b38d2a0b | no | yes | clean | Approve with Minors @9e7cb8fb; moved |
| H-C8 Kuiz stimuli | `r1/hc8-kuiz-stimuli` | 7ac922a7 | no | no | clean | READY |
| H-C7 own stimuli above the stem | `r1/hc7-own-stimuli` | 786d3e4d | no | BASE-14 | clean | READY, merge after R1E2E-05b |
| H-C5 Mula refusal text | `r1/hc5-mula-403` | fc54afc8 | no | no | clean | READY |
| H-C4 Arkib button | `r1/hc4-report-arkib` | b458c8f3 | no | BASE-14 | clean | READY, merge after T35 (now in base) |
| H-C3 Esei pilihan | `r1/hc3-essay-choice-view` | 396961a7 | no | BASE-14 | clean | READY, after H-A7 (now in base) |
| T14 student bugs | `r1/t14-student-bugs` | 1903b713 | no | BASE-14 | clean | Approve @4b033de3; head moved |
| T15 BM copy | `r1/t15-bm-copy` | 09eabe2e | no | BASE-14 | clean | Approve @dbf7d81e; head moved |
| T38 self-mark reward | `r1/t38-selfmark-reward` | 662e602f | no | BASE-17 | clean | READY |
| T42 report paper (migration 0103) | `r1/t42-reports-intake-acs` | d1210e96 | no | yes | clean | part 1 READY |
| T42b intake figure crop | `r1/t42b-intake-acs` | a9c6467d | no | no | conflict: `intake/workflow/review.service.ts` after the others | in progress |
| H-A15 evidence origin filter | `r1/ha15-blueprint-evidence` | 779c23f9 | no | no | clean | Approve; X1 MAJOR with T26 |
| T23 E2E | `r1/t23-e2e` | 4232dc19 | no | BASE-1 | n/a | baseline only |

## 3. The acceptance flow, step by step

Provider codes: **BASE** = in 823d8dfb. A branch name with head means not merged. "Needs" lists what the step touches. Baseline results (S-ids) are from the T23 report on BASE-1.

### Step 1. Admin uploads: form, CSV, PDF, with an image and a D90 group

| Needs | Provider | State |
|---|---|---|
| Form: Bank Soalan > Tambah Soalan (m04 form), `POST /api/questions`, `POST /api/files` (question_image) | BASE | S1a, S1e passed on BASE-1 |
| CSV: Import & Semakan page, `POST /api/question-imports` | BASE | S1b passed; untagged rows refused at approve (AC-R1-14.4) |
| PDF/manual intake: Muat Naik Kertas, `POST /api/intake/batches`, `/files`, `/extract`, `GET batches/:id/review`, `POST items`, `items/:id/accept`, `items/bulk` | API: BASE (R1E2E-01 fixed in BASE-13). FE: BASE pages | S1c, S1d failed on BASE-1 |
| Intake issues shown to the admin (R1E2E-03) | FE: `r1/t13-studio-groups` 114173c9 and t13b (IntakeReviewPage renders `serverIssues`); not in `hc-intake-parity` | open until T13 merges |
| Intake DSKP unit picker (R1E2E-02) | **no branch**: `admin/intake/lib/dskp.ts` still holds the stand-in unit list on every branch (REQ-B-001 OPEN, owner C3) | blocks PDF/manual intake from reaching approved |
| D90 group: stimulus + members | API: stimulus and stimulus-group routes in BASE (T32, BASE-14). FE: Studio group editor, `/admin/studio/groups/:id` on T13 114173c9. Intake group header exists in BASE. Intake "Pautkan semua yang merujuk" (`POST /intake/stimuli/:id/link-references`) on T13 | needs T13 |
| Figure crop to question_image (R1-14.3) | `r1/t42b-intake-acs` a9c6467d | optional for the flow |
| Image stimulus or stem image playable later | see step 5 | |

Blockers: R1E2E-02 (no branch) and T13 (not merged). Form and CSV paths are ready now. A D90 group can be built without intake through T13 and T32.

### Step 2. Approve with the DSKP gate

| Needs | Provider | State |
|---|---|---|
| Approved is the served status | BASE (T04, BASE-4, migration 0100) | S5a to S5c were red only because of this; expected to pass on BASE-19 |
| DSKP approve gate for SPM T4/T5, per-leaf tp and cognitive level (migration 0102), `GET /api/questions/:id/gate-check`, `POST /api/questions/:id/status`, bulk approve through the same gate | `r1/t33-leaf-tags` 276a6622 (after T29) | not in base; conflicts today |
| Studio status buttons "Hantar untuk semakan" / "Terbitkan" / "Arkib", approval refusal list, "Dilihat murid di" | FE `r1/t13b-studio-list` d8a6596d (needs T33 routes and T30 reads) | not in base |
| Servability service and reads | `r1/t29-servability` c53e655d (API), `r1/t30-servability-reads` 09d53c56 (routes) | not in base |
| Legacy "Hantar untuk Semakan" on question detail (R1E2E-04, numeric id, 422) | **no branch** (REQ-B-002 OPEN); the Studio status buttons replace this path once t13b + T33 are in | S2a fails in base |
| Intake Baris Gilir Semakan accept / reject, "Terima semua" | FE `r1/hc-intake-parity` eaef3360 (labels, A/R/E, bulk) | optional |

Blockers: T29 then T33 (both need BASE merges by the owners), t13b. Without T33 only the API-assisted approve (S2c) works and the DSKP gate is not exercised.

### Step 3. Build the paper in Set Builder

| Needs | Provider | State |
|---|---|---|
| Builder API: list, create, generate, pool, placements, order, review, copy, publish | BASE | S3b, S3d passed on BASE-1 (Pembina Kertas) |
| Seed: T4 pupil, Admin Pusat, 3472/2 blueprint Disahkan, serves_students | `r1/t26-e2e-seed` 510f085b (profile `e2e`, `E2E_SEED=1`) | not in base. B4's baseline needed this |
| Set Builder UI `/admin/studio/sets`, Semak Kertas extensions, Studio and Kontrak Simulasi menu entries | FE `r1/f08-builder-ui` 9aa080d5 (T10 + F09 V2 labels) | S3a "Halaman Tidak Dijumpai" until merged |
| Routes the UI calls: `PUT /admin/papers/:id/groups/:groupId`, `PUT {reference}`, placements, section-pool, audited publish override | `r1/t34-builder-review` e363fe51 | T10 cannot work against the real API without T34 |
| Builder wire carries `stimuli[]` (7 kinds, picture URL) | `r1/t31-builder-wire` 5ab47b09 (contains T34) | not required for placement; needed to show group stimuli in the editor |
| Kontrak screens (create, Sahkan) | BASE; V2 labels on `r1/hc-kontrak-parity` 08474528 (wip) | D95: UAT creates and verifies in the UI, E2E uses the seed |

Blockers: T26 (seed), T34 (routes), T10.

### Step 4. Semak Kertas, then Terbit (Disahkan, or override)

| Needs | Provider | State |
|---|---|---|
| Publish check equals attempt check (R1E2E-06), Spec blueprint refused (R1E2E-07 / AC-R1-16.2) | `r1/t34-builder-review` e363fe51 ("attempt-path and Disahkan Terbit gates") | S3c published on a Spec blueprint in base |
| Audited override with a reason | T34 (API), T10 f08 (UI "Terbitkan walaupun tidak memenuhi kontrak blueprint", reason field) | not in base |
| Structured blockers and a `canOverride` flag | T34 follow-up: **not pushed** (REQ-C-002, A3 in progress). f08 falls back to a text heuristic | not a blocker for the flow, a UX risk |
| Semak Kertas edits (metadata, Bahagian, petikan title, Bahan rujukan, Tambah/Padam soalan) | T34 API + f08 UI | not in base |
| Disahkan blueprint evidence rule | BASE (D76); H-A15 `r1/ha15-blueprint-evidence` 779c23f9 changes the rule (admin rows only) | see 4.3 |

Blockers: T34 re-review (B2 changes requested; B2 findings fixed in e363fe51), T10.

### Step 5. Pupil: list, Mula, answer, Hantar, self-mark, result, Cuba Lagi, Lihat semakan lepas

| Needs | Provider | State |
|---|---|---|
| Hub list, cover, Mula, resume, autosave, Hantar, result | BASE (`m28-bijak-spm` pages; `bijak/papers`, `bijak/attempts`) | S4a2, S4c, S4d, S4e passed |
| A paper with an image question starts (R1E2E-05: Mula 403 "a stimulus outside the question group cannot be shown") | `r1/e2e05b-own-stimuli` 57e7feee (API; contains 05 00cec26f). T03 and T07 are in base | S4a failed; fix not in base |
| Own stimuli above the stem on attempt and result | FE `r1/hc7-own-stimuli` 786d3e4d (after 05b) | not in base |
| Mula shows the API's BM refusal on 403 | `r1/hc5-mula-403` fc54afc8 (FE); API refusal for an archived paper `r1/ha13-archived-paper` d51a4abf | optional |
| Self-mark, keyword suggestion, Cuba Lagi, Lihat semakan lepas | BASE (R1-B12/B13/B15 and F11). B-02 and B-05 re-tests passed on BASE-1 | S4b needs a written part in the paper (step 1 structured question) |
| Rewards: Syiling, XP, kombo per attempt | BASE (T28) | |
| Self-mark reward delta (D94) | `r1/t38-selfmark-reward` 662e602f | not in base; not in the flow list |
| Kuiz `/simulasi/kuiz` and per paper (B-04) | API follow-up `r1/b16-kuiz` 97e6c3df; FE `r1/f12-kuiz` b38d2a0b, `r1/hc8-kuiz-stimuli` 7ac922a7 | B-04 still red in base; not in the numbered flow, but T23 re-tests it |

Blockers: `e2e05b` (image paper). A written part needs a structured question: via Studio (T13) since intake is blocked by R1E2E-02.

### Step 6. Databank, Latih Tubi SPM and Bab receive the text MCQs

| Needs | Provider | State |
|---|---|---|
| Approved admin MCQ counted and drawn (no pool tag), card = drawable (D91) | BASE (T04, T05, D91) | S5a to S5c red on BASE-1 only because approved was not served; expected green now |
| Bab tile counts only chaptered questions (R1E2E-09) | A to confirm; not a branch | Low |
| Bab empty state (H-C1 / B-01) | **no branch** (`r1/hc1-chapter-empty` is not on origin) | cosmetic for the flow |
| Zero-count Databank subject shows "Tiada soalan" | `r1/t14-student-bugs` 1903b713 | optional |

Blockers: none that needs a merge; only the re-run, and step 2 (approved questions must exist).

### Step 7. Laporan Soalan, then Arkib

| Needs | Provider | State |
|---|---|---|
| `PATCH /api/question-reports/:id {archive:true}` lifecycle archive; archived question leaves Latih Tubi SPM and new Jana pools | BASE (T35, BASE-18) | |
| "Arkib" action on the admin report row | FE `r1/hc4-report-arkib` b458c8f3 | not in base |
| Pupil report from a quiz question | BASE (QuizRunner "Lapor Soalan", `ReportQuestionModal`) | |
| Pupil report from Bijak attempt or Semakan with the paper stored (AC-R1-18.1) | API `r1/t42-reports-intake-acs` d1210e96 (migration 0103). **FE: no branch** (S-69) | blocks AC-R1-18.1 only |
| New sitting on a paper with an archived question refused; Kuiz per paper too | `r1/ha13-archived-paper` d51a4abf; Kuiz rule in b16 | optional for the flow |

Blockers: hc4 (merge), pupil Lapor control (no branch).

## 4. Merge order proposal for team B

### 4.1 Rules used

- API before the FE that calls it: T29 → T33 → T34 → (T31) for the admin routes; T33 and T30 before t13b; T34 before T10.
- Branches that already contain BASE-19 go first (no owner action). Branches that conflict today wait for the owner to merge the new BASE and re-post.
- Every merge changes `questions/questions.module.ts` for the later ones: the conflict is a union of providers and routes, as B2 noted for T29/T33.
- CI off PoC (REQ-A-001) before T36 (PoC removal): `r1/b1-e2e-off-poc` carries the workflow changes and contains T26.

### 4.2 Order

| # | Merge | Why now | Owner action before merge |
|---|---|---|---|
| 1 | `r1/b1-e2e-off-poc` b209b4ff (contains T26 510f085b) | Seed for B4 and REQ-A-001 (compose.http.yaml, e2e-http.yml, frontend.yml: `BIJAK_POC_QUESTIONS` false, e2e seed, bank demo paper lookup). Must precede T36. Clean | none |
| 2 | `r1/e2e05b-own-stimuli` 57e7feee | R1E2E-05 Critical: a paper with an image question can start. Clean | B2 verdict for 05b (not on the board) |
| 3 | `r1/t29-servability` c53e655d | Base of T33/T34/T30. Clean | B2 delta review (head moved) |
| 4 | `r1/t30-servability-reads` 09d53c56 | "Dilihat murid di" reads, needed by t13b and Kandungan hub. Clean | B2 re-review (2 MAJORs open at f2eeec7d) |
| 5 | `r1/t33-leaf-tags` 276a6622 | DSKP approve gate, status route, gate-check (migration 0102). Conflicts: `views.ts`, `lifecycle.service.ts`, `questions.module.ts`, `questions.repository.ts` | A2 merges the new BASE; keep T07's `stimulusRecordOf` and T35's archive path |
| 6 | `r1/t34-builder-review` e363fe51, or `r1/t31-builder-wire` 5ab47b09 (contains it) | Terbit gates, override, review edits (R1E2E-06/07). Conflict: `questions.module.ts` | A3 merges the new BASE + T33, and B2 re-reviews (changes requested at last look). If T31 goes, it takes T34 with it; B2's note is T34 first, T31 on the final T34 |
| 7 | `r1/f08-builder-ui` 9aa080d5 (T10 + F09) | Set Builder UI (S3a), Semak Kertas, menu. Clean | B2 delta review (moved); needs 6 |
| 8 | `r1/t13-studio-groups` 114173c9 | Studio create/edit, D90 groups, intake link-references, `serverIssues` shown. Conflict: `questions.module.ts` after 3 to 5 | C3 merges the new BASE; B2 re-review of the rebuilt T13 |
| 9 | `r1/t13b-studio-list` d8a6596d | Studio list, tiles, status buttons, refusal list, "Dilihat murid di". Conflicts: `lifecycle.service.ts` (T35), module and repository | C3 merges the new BASE after 4, 5, 8 |
| 10 | `r1/hc4-report-arkib` b458c8f3 | "Arkib" on the report row (T35 is in base). Clean | none |
| — | **B4 can run the full flow after this point** (section 5) | | |
| 11 | `r1/ha13-archived-paper` d51a4abf, then `r1/hc5-mula-403`, `r1/hc7-own-stimuli` | Archived-paper refusal and its FE text; own stimuli above the stem | A1 runs `contract:emit` for H-A13 |
| 12 | `r1/b16-kuiz` 97e6c3df → `r1/f12-kuiz` b38d2a0b → `r1/hc8-kuiz-stimuli` 7ac922a7 | B-04 `/simulasi/kuiz`; hc8 after 05b | B2 delta review (both heads moved) |
| 13 | `r1/t14-student-bugs`, `r1/t15-bm-copy`, `r1/hc3-essay-choice-view` | Student bugs, approved copy, Esei pilihan | B2 delta review (T14/T15 moved) |
| 14 | `r1/hc-intake-parity`, `r1/hc-kontrak-parity`, `r1/hc-kandungan-hub` | V2 admin parity (REQ-A-004); two are marked wip by their own commits | docs conflict on `v2-admin-student-pipeline.md` (take both rows) |
| 15 | `r1/t38-selfmark-reward` → `r1/t40-attempts-acs`; `r1/t42-reports-intake-acs`; `r1/t42b-intake-acs` | D94 delta, AC specs, report paper (migration 0103), figure crop | t42b conflicts in `review.service.ts` |
| 16 | `r1/t36-remove-poc` 40d4851d | PoC removal; after step 1 (CI) and after REQ-B-003 is answered. Conflicts: `bijak-papers/generate.spec.ts`, `bijak-integration/poc-flag.spec.ts` | A2 merges the new BASE |
| last | `r1/ha15-blueprint-evidence` 779c23f9 | Only after the seed decision in 4.3 | A1 + A3 |

### 4.3 Two cross-branch hazards

- **X1 (T26 with H-A15).** After H-A15, `NO_EVIDENCE_BODIES` makes real Sahkan refuse 3472/2 while the e2e seed sets it Disahkan. B1 asked for a lead decision. Merge T26 before H-A15 and let the seed carry labelled admin-origin evidence, or document the bypass. Until then T23 is safe only with H-A15 left out.
- **T36 with e2e.** After T36 the PoC papers (ids 2 to 4) return 403. `e2e/api/bijak-part-input.spec.ts` needs a playable structured Kertas 2 bank paper (REQ-B-003, OPEN, no branch); until then those specs would be `test.fixme`.

## 5. Smallest set after which B4 can run the full flow

The flow is steps 1 to 7 above, with Terbit through the Disahkan gate and an override, and the DSKP gate at approve.

| Merge | Gives |
|---|---|
| 1. `r1/b1-e2e-off-poc` (with T26) | seed accounts, Disahkan blueprint, CI independent of PoC |
| 2. `r1/e2e05b-own-stimuli` | image question playable (S4a) |
| 3. `r1/t29-servability` | servability service |
| 4. `r1/t30-servability-reads` | "Dilihat murid di" API for t13b |
| 5. `r1/t33-leaf-tags` | DSKP approve gate, status route (S2) |
| 6. `r1/t34-builder-review` | Terbit gates, override, builder routes (S3c, S3 UI) |
| 7. `r1/f08-builder-ui` | Set Builder (S3a), Semak Kertas, Terbit UI |
| 8. `r1/t13-studio-groups` | Studio create/edit, D90 group, intake issues visible |
| 9. `r1/t13b-studio-list` | UI approval path (replaces R1E2E-04), status buttons |
| 10. `r1/hc4-report-arkib` | Arkib on the report row (step 7) |

What this leaves out on purpose: Kuiz (B-04), T31 wire, H-A13, T36, hc-parity branches, T38, T42. B4 can run the numbered flow without them; B-04 and the report-from-Semakan check stay red or skipped.

What the minimal set still cannot cover (section 6): PDF/manual intake to approved (R1E2E-02) and the pupil Lapor control. The D90 group and a written part for self-mark come from Studio (T13), not from intake. If B4 wants intake to approved in this run, R1E2E-02 needs a fix first.

Owner actions inside the set: A2 (T33 merges the new BASE), A3 (T34 merges the new BASE and T33; B2 re-review), C3 (T13 and t13b merge the new BASE), B2 (delta reviews of T29, T30, T10, T13). The first two merges need none.

## 6. Blockers with no branch at all

| Blocker | Where it shows | Owner | Tracked as |
|---|---|---|---|
| Intake DSKP unit picker uses a stand-in list (`admin/intake/lib/dskp.ts`) | PDF and manual intake never reach approved (S1c, S1d) | C3 | R1E2E-02, REQ-B-001 OPEN |
| Legacy question detail "Hantar untuk Semakan" sends a numeric id (422) | UI approval from the legacy page (S2a). t13b + T33 give another path | C | R1E2E-04, REQ-B-002 OPEN |
| Pupil "Lapor" control on Bijak attempt and Semakan | AC-R1-18.1 (S-69 in the student parity check) | C (C2/C4) | REQ-A-005 |
| Structured blockers and `canOverride` on review and publish 422 | f08 override offer uses a text heuristic | A3 | REQ-C-002, T34 follow-up not pushed |
| Bab empty state | B-01 in the baseline | C4 | H-C1; `r1/hc1-chapter-empty` is not on origin |
| Playable structured Kertas 2 bank paper for e2e after T36 | `e2e/api/bijak-part-input.spec.ts` | A1 | REQ-B-003 OPEN |
| `pinned` per placed question in the builder answer ("Disematkan") | V2 parity chip | A3 | T48 (no branch) |
| Boleh tanda auto in the Kontrak write schema | R1-21.4 | A3 | T44 (no branch) |
| Chain upgrade and builder publish specs | AC coverage | A3 | T43 (no branch) |
| Bank filters Tahun/Negeri/Kertas/Jenis and filter-based bulk approve | admin parity | A2 | T47 (no branch) |
| Stimulus group and stimulus list endpoints, group members summary | Studio group browser | A2 | T49, REQ-C-004/005 accepted, no branch |
| Bab tile counts all subject questions, not chaptered ones | S5c wording | A | R1E2E-09, to confirm |
| Reward rule for repeated attempts (once per paper or per attempt) | T38/T40 specs depend on it | lead | REQ-B-004 / Q-B3-M1, a decision, not a branch |

## 7. CI note (REQ-A-001)

- The tracker request is REQ-A-001 (A to B1): switch the e2e workflows off PoC before T36. Places named: `compose.http.yaml:31`, `render.yaml:27`, `.github/workflows/e2e-http.yml:74`, `frontend.yml:102`.
- Delivered on `r1/b1-e2e-off-poc` b209b4ff: compose seeds the e2e profile behind `E2E_SEED=1` with a production guard, `BIJAK_POC_QUESTIONS` false, the workflows look up the bank demo paper by title and pass `BIJAK_PAPER_ID`. `render.yaml` is left untouched; `deploy/demo/redeploy-demo-migration-aware.sh` still requires the flag (B3 info on T36).
- Not run: Playwright suite and the docker stack (no daemon in that lane).

## 8. Limits

- No test, build or browser run in this unit. Conflict results are from virtual merges against 823d8dfb and say nothing about type checks or specs.
- Verdicts are copied from the board status files; several heads have moved since those verdicts, and that is marked in the tables.
- "Expected to pass" for steps 6 and 7 rests on the BASE-19 code and the T04/T05/T35 specs, not on a T23 re-run.
