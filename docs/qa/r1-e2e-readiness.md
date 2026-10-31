# R1 E2E readiness map (H-A23)

Date: 2026-10-31, refreshed 2026-11-01 against BASE-60 (`a3e92b06`). Branch `r1/ha23-e2e-readiness`. First written off BASE-19 (823d8dfb). Docs only; nothing was run.

Question: what must be merged so that B4 (T23) can run the whole R1 acceptance flow on the real stack, and in which order?

**Merge order authority.** The order of merges is decided by B1 and recorded in MERGE-LOG, and by the stacked order agreed in C-POLICY-2 (BOARD.md on `origin/team/r1-board`, accepted by the user). This page no longer proposes an order of its own: section 4 only restates that order and lists what is still unmerged. The step tables in section 3 were written on BASE-19; each has a "Refresh at BASE-60" line that replaces its provider/state cells where they changed.

Sources: `docs/team/status/B1.md`, `B2.md`, `B2-C.md`, `B4.md`, `MERGE-LOG.md`, `BOARD.md` and `requests/*.md` on `origin/team/r1-board`; the T23 reports on `origin/r1/t23-e2e` (latest `docs/qa/r1-e2e-2026-11-01-base58.md`, cycle 15); my admin and student parity checks (H-A19, H-A20, H-A22); `docs/qa/r1-backend-ac-coverage.md` (H-A17).

Method for conflicts: `git merge-tree --write-tree` of each unmerged head against BASE-60 (objects only, no checkout). A conflict listed here is a textual conflict on today's heads. It says nothing about test results; B1 re-runs the gates on the real merge.

## 1. Result in short

- BASE-60 holds most of what the first version of this page listed as missing: T26 and `b1-e2e-off-poc` (BASE-24/25), T29 (BASE-26), T33 with the DSKP approve gate (BASE-27), T30 with R1E2E-05b and servability-own-stimuli (BASE-28), T13 / T13b / T13c Studio (BASE-22, 53, 55, 59), the Kandungan SPM hub (BASE-45), the intake DSKP picker (REQ-B-001, BASE-47) and the detail-page submit (REQ-B-002, BASE-48), T11/T12 Kuiz (BASE-49, 58), T42 part 1 with migration 0103 (BASE-41).
- T23 cycle 15 on BASE-58 still failed S1h (R1E2E-17), S2e (R1E2E-10), S3a (T10 not in base), S3c/S3d (R1E2E-13), B-02 (R1E2E-14); S4a/S4a2 were skipped or blocked (`docs/team/status/B4.md`). Those results are B4's, not re-derived here.
- **Still unmerged on the admin path:** T34 (builder review and override, B2 CHANGES-REQUESTED, A3 fixing) and everything stacked on it: T31, REQ-A-008, T48 (migration 0104), T43/T43b, T10 `f08-builder-ui` and `hc-builder-parity`. Per C-POLICY-2 and B1 cycle 29, T10 and hc-builder-parity wait for T34.
- Also unmerged: T36 (B2 CHANGES-REQUESTED, REQ-B-029), H-A13 then H-C4, H-C8 (A4 ack on REQ-C-022), T38 then T40, T44 with H-A15 and Kontrak parity (T44 CHANGES-REQUESTED), T42b, T26b (X1 lead decision), the pupil Lapor control (held, REQ-B-031).
- Section 6 lists what had no branch on BASE-19 and what happened to each.

## 2. Unit table (refreshed at BASE-60)

"In base" shows the MERGE-LOG number. "Alone vs BASE-60" is the virtual merge of the current head with base. "State on the board" is the last verdict recorded by B1/B2/B3 in `status/*.md`; a head that moved after the verdict means the delta is not reviewed yet.

| Unit | Branch | Head | In base | Alone vs BASE-60 | State on the board |
|---|---|---|---|---|---|
| T26 e2e seed | `r1/t26-e2e-seed` | d474227d | **BASE-24** | merged | merged |
| REQ-A-001 CI off PoC | `r1/b1-e2e-off-poc` | b209b4ff | **BASE-25** | merged | merged |
| T29 servability | `r1/t29-servability` | c53e655d | **BASE-26** | merged | merged |
| T30 servability reads (with 05b and servability-own-stimuli) | `r1/t30-servability-reads` | 409df4bf | **BASE-28** | merged | merged |
| T33 leaf tags, approve gate, status route | `r1/t33-leaf-tags` | 95cea5be | **BASE-27** | merged | merged |
| T13 Studio create/edit, groups | `r1/t13-studio-groups` | cc339b4b | **BASE-53** | merged | merged |
| T13b Studio list, status buttons | `r1/t13b-studio-list` | 40b0fa93 | **BASE-55** | merged | merged |
| hc-intake-parity | `r1/hc-intake-parity` | c4f4a7c1 | **BASE-54** | merged | merged |
| hc-kandungan-hub (R1-21) | `r1/hc-kandungan-hub` | cdcb2171 | **BASE-45** | merged | merged |
| T11 Kuiz API | `r1/b16-kuiz` | f9c2843f | **BASE-49** | merged | merged |
| T12 Kuiz FE | `r1/f12-kuiz` | 9b33e061 | **BASE-58** | merged | merged |
| H-C7 own stimuli above the stem | `r1/hc7-own-stimuli` | 476a7999 | **BASE-30** | merged | merged |
| H-C5 Mula refusal text | `r1/hc5-mula-403` | c2d2cc9f | **BASE-37** | merged | merged |
| H-C3 Esei pilihan | `r1/hc3-essay-choice-view` | b5e93fd1 | **BASE-29** | merged | merged |
| T14 student bugs | `r1/t14-student-bugs` | 1903b713 | **BASE-20** | merged | merged |
| T15 BM copy | `r1/t15-bm-copy` | 09eabe2e | **BASE-21** | merged | merged |
| T42 report paper (migration 0103) | `r1/t42-reports-intake-acs` | d1210e96 | **BASE-41** | merged | merged |
| T34 builder review, override | `r1/t34-builder-review` | 7bc3419e | no | conflict: `apps/api/src/modules/questions/questions.module.ts`, `docs/architecture/v2-backend-deviations.md` | B2 CHANGES-REQUESTED (override lifts structural blockers; T33 cognitiveLevel fixtures); A3 fixing |
| T31 builder wire | `r1/t31-builder-wire` | b3501db9 | no | conflict: `apps/api/src/modules/questions/questions.module.ts`, `docs/architecture/v2-backend-deviations.md` | B2 CHANGES-REQUESTED (inherits T34); also needs REQ-A-008 |
| T10 Set Builder, Semak Kertas (+F09) | `r1/f08-builder-ui` | 930bcbf5 | no | conflict: `docs/design/v2-admin-student-pipeline.md` | B2 CHANGES-REQUESTED (order: after T34; type fixes); C1 |
| hc-builder-parity | `r1/hc-builder-parity` | 0d42619e | no | conflict: `docs/design/v2-admin-student-pipeline.md` | wait for T34 (T10 first); C1 |
| hc-kontrak-parity | `r1/hc-kontrak-parity` | 3ef624c8 | no | clean | B2 CHANGES-REQUESTED (inherited T44 MAJOR only; own delta Approve); C4 |
| T48 builder parity (migration 0104) | `r1/t48-builder-parity` | bdc70de4 | no | conflict: `apps/api/src/modules/questions/questions.module.ts`, `docs/architecture/v2-backend-deviations.md` | B2 CHANGES-REQUESTED; A3 (migration 0104) |
| T43 chain + publish specs | `r1/t43-chain-publish` | 89d30dab | no | conflict: `apps/api/src/modules/questions/questions.module.ts`, `docs/architecture/v2-backend-deviations.md` | B2 CHANGES-REQUESTED (follows T34); A3 |
| T44 Boleh tanda auto (contains H-A15) | `r1/t44-blueprint-fields` | 2d9c100d | no | conflict: `docs/architecture/v2-backend-deviations.md` | B2 CHANGES-REQUESTED (T33 fixtures; REQ-B-028 pool); A3 |
| H-A15 evidence origin filter | `r1/ha15-blueprint-evidence` | 7e5d637e | no | conflict: `docs/architecture/v2-backend-deviations.md` | B3 Pass; X1 lead decision with T26 seed |
| T26b e2e seed follow-up | `r1/t26b-e2e-seed` | 5cfd6ea5 | no | clean | B3 Pass; X1 lead decision |
| T36 remove PoC | `r1/t36-remove-poc` | 5bc34543 | no | clean | B2 CHANGES-REQUESTED (REQ-B-029: PoC seeds still published); A2 + lead |
| H-A13 archived paper | `r1/ha13-archived-paper` | 3979e212 | no | conflict: `apps/api/test/bijak-integration/report-archive.spec.ts`, `packages/contract/src/bijak/attempts/schema.ts`, `packages/contract/src/question-workflow/reports.ts` | B2 Approve w/ Minors, B3 Pass; needs base merge + `contract:emit` (A1) |
| H-C4 Arkib button | `r1/hc4-report-arkib` | 44a5f592 | no | clean | READY; after H-A13 (C-POLICY-2); C4 |
| H-C8 Kuiz stimuli | `r1/hc8-kuiz-stimuli` | 0cb54933 | no | clean | B2 Approve w/ Minors; waits for A4 ack on REQ-C-022 and B3 re-check |
| T38 self-mark reward | `r1/t38-selfmark-reward` | 662e602f | no | clean | B2 CHANGES-REQUESTED (choose-N overpay); A1 |
| T42b intake figure crop | `r1/t42b-intake-acs` | bca92f3d | no | conflict: `apps/api/src/modules/intake/workflow/review.service.ts` | B2 Approve w/ Minors; conflict in `review.service.ts` (A2 merges the base) |
| T23 E2E | `r1/t23-e2e` | 1f90a27f | no | clean | B4 branch (reports and e2e specs only); not merged into code |

## 3. The acceptance flow, step by step

> Refresh at BASE-60: the provider and state cells in this section are as of BASE-19. Use sections 2 and 4 for the current state. Items that moved: T26, `b1-e2e-off-poc`, T29, T30, T33, T13/T13b, hub, intake parity, T11/T12, H-C3/H-C5/H-C7, T42 are in base; T34, T31, T10, T48, T43, T44, T36, H-A13, H-C4, H-C8, T38 are not.

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

## 4. Merge order

The order is not set by this page. It is B1's decision in MERGE-LOG and the stacked order agreed in C-POLICY-2 (BOARD.md, accepted):

- T34 -> T13b -> T10 -> hub -> hc-builder-parity (T13b and the hub are merged; T34 is the open prerequisite, then T10, then hc-builder-parity; the hub is in base so KS-01 resolves);
- H-A13 -> H-C4;
- T38 -> T40;
- T11 -> T12 -> H-C8 (T11 and T12 merged; H-C8 waits for the A4 ack on REQ-C-022);
- H-C7 after R1E2E-05b (both merged, BASE-28 and BASE-30);
- API before the FE that calls it; CI off PoC (merged, BASE-25) before T36.

What is unmerged at BASE-60 and the owner action each one waits for:

| Unit | Waits for |
|---|---|
| T34 `7bc3419e` -> T31 `b3501db9` -> REQ-A-008 `7e2e4392` | A3 fixes the B2 findings (override vs structural blockers, T33 cognitiveLevel fixtures), merges the base (`questions.module.ts` and the deviations doc conflict as union); B2 re-review |
| T10 `930bcbf5` -> hc-builder-parity `0d42619e` | T34 in base; C1 fixes the two TS18048 sites; design doc union |
| T48 `bdc70de4`, T43 `89d30dab`, T43b `92866aa8` | T34 follow-up; B2 CHANGES-REQUESTED on T48 and T43 |
| T44 `2d9c100d` (contains H-A15 `7e5d637e`) -> Kontrak parity `3ef624c8` | A3 fixes T33 fixtures and the REQ-B-028 pool; X1 lead decision |
| H-A13 `3979e212` -> H-C4 `44a5f592` | A1: base merge and `contract:emit` |
| H-C8 `0cb54933` | A4 ack on REQ-C-022 and B3 re-check |
| T38 `662e602f` -> T40 `90973d72` | A1 fixes (choose-N overpay) |
| T36 `5bc34543` | B2 CHANGES-REQUESTED (REQ-B-029); REQ-B-003 is delivered on `r1/t26b-e2e-seed` |
| T42b `bca92f3d` | A2 merges the base (`review.service.ts`) |

### 4.1 Two cross-branch hazards

- **X1 (T26 seed with H-A15).** After H-A15, real Sahkan refuses 3472/2 while the e2e seed sets it Disahkan. T26 is in base (BASE-24); T26b `5cfd6ea5` (admin-origin evidence in the seed, REQ-B-003 delivered) is B3 Pass and waits for the lead decision. Until then H-A15 should not merge.
- **T36 with e2e.** After T36 the PoC papers (ids 2 to 4) return 403 and must not be listed (REQ-B-029). The structured Kertas 2 bank paper for `e2e/api/bijak-part-input.spec.ts` comes from T26b.

## 5. What B4 can run now, and what it still needs

At BASE-60 the numbered flow runs up to the point where it needs T34-stacked units. The first version's "smallest set" is therefore reduced to the units in the table below; everything else in that set is already in base.

| Still needed | Gives |
|---|---|
| T34 (fixed) | Terbit gates and override, builder routes (S3c) |
| T10 `f08-builder-ui` (after T34) | Set Builder UI (S3a), Semak Kertas, Terbit UI |
| H-A13 then H-C4 | "Arkib" on the report row (step 7); archived-paper refusal |
| T26b and the X1 decision | structured Kertas 2 paper and Disahkan blueprint that survive H-A15 |

What stays outside the run on purpose: T31 wire, T36, T38/T40, T42b, H-C8, hc-builder-parity, Kontrak parity.

Owner actions: A3 (T34 and its stack), C1 (T10 type fixes), A1 (H-A13 contract:emit; T38; X1 decision), A4 (REQ-C-022 ack), B2 (re-reviews).

## 6. Blockers that had no branch on BASE-19

| Blocker | Status at BASE-60 | Tracked as |
|---|---|---|
| Intake DSKP unit picker used a stand-in list | **Fixed:** `r1/reqb001-intake-dskp` merged, BASE-47 | R1E2E-02, REQ-B-001 |
| Legacy question detail "Hantar untuk Semakan" sent a numeric id | **Fixed:** `r1/reqb002-detail-submit` merged, BASE-48 (Studio status buttons from T13b, BASE-55, also give the path) | R1E2E-04, REQ-B-002 |
| Pupil "Lapor" control on Bijak attempt and Semakan | Branch `r1/reqa005-bijak-lapor` exists; **held** by B1 (REQ-B-031: report only from an owned context, D98, A1 building `r1/reqb031-report-guard`) | REQ-A-005, REQ-B-031 |
| Structured blockers and `canOverride` on review and publish 422 | Delivered in the T34 follow-up (`blockerDetails[]`, `canOverride`; REQ-C-002 DONE); T34 is still CHANGES-REQUESTED | REQ-C-002 |
| Bab empty state | Not re-checked in this refresh (unconfirmed); `r1/hc1-chapter-empty` is not on origin | H-C1, B-01 |
| Playable structured Kertas 2 bank paper for e2e after T36 | Delivered on `r1/t26b-e2e-seed` @ 5cfd6ea5, not in base (X1) | REQ-B-003 |
| `pinned` per placed question | T48 `bdc70de4`, CHANGES-REQUESTED, not in base | T48 |
| Boleh tanda auto in the Kontrak write schema | T44 `2d9c100d`, CHANGES-REQUESTED, not in base | T44 |
| Chain upgrade and builder publish specs | T43 `89d30dab` and T43b `92866aa8`, CHANGES-REQUESTED / pushed, not in base | T43 |
| Bank filters Tahun/Negeri/Kertas/Jenis and filter-based bulk approve | T47 merged, BASE-33 | T47 |
| Stimulus group and stimulus list endpoints | T49 merged, BASE-32 | T49, REQ-C-004/005 |
| Bab tile counts all subject questions, not chaptered ones | `r1/t04-minors` is B2 CHANGES-REQUESTED, not in base | R1E2E-09 |
| Reward rule for repeated attempts | **Decided** (Q5, D93 second part): every submitted attempt earns; T28 already in base | REQ-B-004 |

## 7. CI note (REQ-A-001)

- The tracker request is REQ-A-001 (A to B1): switch the e2e workflows off PoC before T36. Places named: `compose.http.yaml:31`, `render.yaml:27`, `.github/workflows/e2e-http.yml:74`, `frontend.yml:102`.
- Delivered on `r1/b1-e2e-off-poc` b209b4ff: compose seeds the e2e profile behind `E2E_SEED=1` with a production guard, `BIJAK_POC_QUESTIONS` false, the workflows look up the bank demo paper by title and pass `BIJAK_PAPER_ID`. `render.yaml` is left untouched; `deploy/demo/redeploy-demo-migration-aware.sh` still requires the flag (B3 info on T36).
- Not run: Playwright suite and the docker stack (no daemon in that lane).

## 8. Limits

- No test, build or browser run in this unit. Conflict results are from virtual merges against BASE-60 (`a3e92b06`) and say nothing about type checks or specs.
- Verdicts are copied from the board status files; several heads have moved since those verdicts; sections 2 and 4 show the current head. Step tables in section 3 are BASE-19 text with a refresh note.
- "Expected to pass" for steps 6 and 7 rests on the BASE-19 code and the T04/T05/T35 specs, not on a T23 re-run.
