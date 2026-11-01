# R1 B4 QA hand-off pack: the admin-to-pupil chain

For B4 (manual and e2e QA of the R1 flow). Written 2026-11-02 on `r1/ac-gaps-a1b`, which owns the QA docs.

The flow: admin uploads questions -> approves -> builds a paper -> Terbit -> the pupil sits -> submits -> self-marks -> Cuba Lagi; also Tarik balik (withdraw) and Arkib (archive).

## 0. How to read this pack

- **Sources.** Step to spec map: `docs/qa/r1-chain-step-map.md` on `origin/r1/r1-chain-qa-a3` @ 9b70ae39. Proof rows: `docs/qa/r1-backend-ac-coverage.md` (this branch). UAT SELECTs: `docs/ops/r1-runbook.md` (this branch). Seeds: `apps/api/prisma/seed`. FE routes: `src/modules/m28-bijak-spm/routes*`, `src/modules/m04-question-bank/routes/*`.
- **BM messages are copied from code or contract constants** and carry `file:line` on the branch named beside them. A line number is only valid on that branch (or on base when the branch column says "base"). Where a screen shows a text that is not a constant (a flash), the source file is cited the same way.
- **Nothing here was run for this pack.** Heads were read with `git ls-remote` on the day of writing; specs are named, not executed. The step map reports its own counts (section 2.3).
- **Never put a real name, a secret or a production login in a bug report.** Use the seeded fictitious accounts below.
- "Base" means `origin/feature/v3-bijak-r1` @ 7ea2208c (BASE-105).

## 1. Accounts, seeds and the environment

All seeded accounts use the documented demo password `Demo1234` (`apps/api/prisma/seed/core/identity.ts`, `core/demo-password.ts`). They are fictitious.

| Role | Login | Use it for |
|---|---|---|
| Admin Pusat | `admin@demo.test` | everything under `/admin/spm/*`, `/admin/questions*`, `/admin/question-reports`; also "Mod Pelajar" (an admin sitting a paper is stamped `is_test`: no reward, no streak; `docs/requirements/v2-bijak-spm.md` AC-20.3) |
| Guru | `guru@demo.test` | intake upload (a Guru sees own batches), Guru-owned questions |
| Pupil (Murid) | `pelajar@demo.test` (also `pelajar2@demo.test`, `pelajarmaju@demo.test`) | the whole pupil side: `/spm/bijak*`, `/simulasi/*` |
| other | `adminsekolah@demo.test` (school admin), `guruadmin@demo.test` (teacher + school admin), `tidakaktif@demo.test`, `digantung@demo.test` | negatives only (role refusals, inactive and suspended logins) |

- **Seed profiles.** The default `poc` profile (28 modules) gives: the curriculum (2,844 DSKP nodes at T4 and T5), the question bank (1,271 versions), the six launch Kontrak blueprints `1449/1, 1449/2, 3472/1, 3472/2, 4531/2, 1249/2` as **Spec, nothing Disahkan** (`prisma/seed/exam-launch-blueprints.ts` header), one demo bank paper "Latihan Demo Matematik Bank Soalan (Contoh)" sat by 6 pupils, and the four seeded PoC papers **withdrawn** (`exam-retire-poc`, `prisma/seed/exam.ts`). A server run needs `ALLOW_DEMO_SEED=1` for the demo modules outside tests.
- **Profile `e2e`** (`--profile=e2e` with `E2E_SEED=1`, never on a server): adds a Disahkan Kontrak `3472/2` (Matematik Tambahan Kertas 2) and a small structured question pool (`prisma/seed/e2e.ts`, `e2e-k2.ts`; in base via T26). Use it when you need a Kontrak that is already Disahkan. Known hazard X1 (coverage doc, "Open decisions"): after H-A15 the e2e seed sets 3472/2 Disahkan while the real "Sahkan" action refuses it (`NO_EVIDENCE_BODIES`).
- **Wallet tiers precondition (reference data).** The QA database must have exactly **4** wallet tiers, or every practice submit and student dashboard answers 500. Check with `select count(*) from tiers;` (it must be 4). If it is 0, load the reference data (`deploy/vps/deploy.sh --seed-reference`: reference modules only, safe to repeat). Source: `docs/ops/r1-runbook.md` section 0 item 6 (line 38 on `r1/ac-gaps-a1b`); the same rule is in `docs/ops/go-live-bijak-spm.md:300` ("the 4 M14 tiers, without which every student dashboard answers 500"). The `poc` seed profile already includes the `core-wallet-tiers` module.
- **No intake batch is seeded.** The upload step needs the extractor. On a stack without a configured AI provider, use the manual route (`/admin/spm/soalan/manual`), Studio create (`/admin/questions/create`) or CSV import (`/admin/questions/import`) and treat step 1 as covered by the specs only.
- **Question ids and Kontrak codes in the specs** (`MAT` kertas 2, section pools `MAT2-A`, `MAT2-B`, `MAT2-C`, SAINS K2 Bahagian B) come from the seeds above; the chain specs create their own questions, so a manual run should do the same.

## 2. Branch map: what delivers each part, and what it needs

Heads from `git ls-remote origin refs/heads/r1/<branch>` on the day of writing. "In base" = already merged into BASE-105.

### 2.1 In base (no branch needed)

| Part | Where it is | Evidence |
|---|---|---|
| Builder review, structured blockers, D93, R1E2E-06/07 | T34 `r1/t34-builder-review-c` @ 05451810, BASE-101 | `exam-builder/builder-review.spec.ts`, `builder-blockers.spec.ts` |
| T33 DSKP approve gate (cognitive level per leaf, kertas) | `r1/t33-leaf-tags` @ 95cea5be, migration 0102 | `questions-workflow/dskp-gate.spec.ts` |
| Reward on submit, XP, streak (kombo), Mod Pelajar none | T28 `r1/t28-bijak-rewards` @ 54c17c4d, BASE-11 | `bijak-integration/flow.spec.ts` 3, 3b |
| Archived question refuses a new sitting (H-A13) | `r1/ha13-archived-paper` @ 61b8851d | `bijak-integration/report-archive.spec.ts` 4, 5c (5c added on `r1/ac-gaps-a1b`) |
| E2E seed | `r1/t26-e2e-seed` @ d474227d | `seed/e2e.spec.ts` |
| No progressive chapter lock (REQ-C-021, D98) | BASE-102 | `questions/chapter-practice.spec.ts` |

### 2.2 READY branches not in base (merge order and prerequisites)

| Branch | Head | Delivers in this flow | Prerequisite / pairing |
|---|---|---|---|
| `r1/ha18-gate-facts` | fc409ae1 | **Bab gate** at Semakan ("Sila pilih bab."), submit and approve gates in one place; migration 0105 | none. Everything that sends questions to Semakan in a chain spec needs `giveBab` (`test/support/bab.ts`, byte-identical in T48 and H-A18). **Without H-A18 the Bab refusal does not exist.** |
| `r1/t48-builder-parity` | 6c5ae3a8 | Semak Kertas parity: cover code, Pilih N, Tambah bahagian / soalan, Padam soalan, `pinned`, stimulus edit; migration 0104 | first of the stack: T48 -> T31 -> T43 -> T51 |
| `r1/t31-builder-wire` | eb0346d2 | builder wire for the group stimuli (`stimuli`), shared table reader | **pairs with REQ-A-008** `r1/reqa008-group-stimulus` @ 29d24be9. Alone it is `vue-tsc` red (`src/modules/m28-bijak-spm/server/http-admin.ts:202` TS2322, `stimulus` optional in the contract). B1 has recorded: T31 merges only with REQ-A-008 |
| `r1/t43-chain-publish` | 238eb6eb | chain spec: Kontrak made Disahkan over the API, plain Terbit, T5 pupil, Jana Kertas, SHORTAGE | contains T31; same pairing with REQ-A-008 |
| `r1/t51-partial-acs-a3` | 61c1b077 | chain steps for the partial ACs; A11 paper quiz view | contains T43 and T31; same pairing; merge **after** T43 |
| `r1/t43b-publish-acs` | 7a14581a | PIPE AC-07.4 to 07.9 (publish checks, withdraw keeps attempts, pinned snapshot) | independent leaf on T48; needs T48 6c5ae3a8 |
| `r1/t44-blueprint-fields` | 072d8f4b | Kontrak admin fields (autoMarkable, origin filter, note gate, Markah skema); contains H-A15 | none |
| `r1/reqb032-pinned-rule` / `r1/reqb052-archived-edit` | a2cb5bb4 / f3a2448f | REQ-B-032: a sitting is served the version its paper pinned, and grades against it; REQ-B-052: an archived or restored question is never rewritten in place when a Terbit paper pins it | reqb052 contains reqb032 and H-A18 fc409ae1 |
| `r1/t45-servability-acs` | 954614c6 | Terbitkan notice and refusal when a question is unservable (AC-05.3), indicators fresh (AC-04.5), paper servability (AC-04.3) | none; `r1/reqa018-paper-servability-route` @ b7fe6fbc merges after it |
| `r1/reqa018-paper-servability-route` | b7fe6fbc | `GET /api/admin/questions/{id}/paper-servability`: the published papers that carry a question and whether pupils can open each (AC-04.3, AC-04.4); route fix: admin papers only (kind `pilihan`; a pupil's generated paper is never listed), at most 200 papers, one servability read | merges after `r1/t45-servability-acs` |
| `r1/delete-served-guard` | 7e5d82e6 | the delete rules of the question bank (Step 3b); the AI explanation writes a new draft version | none |
| `r1/t48-label-move-fix` | 9783849c | the Nombor soalan of an added question follows it when it is moved to another Bahagian | needs `r1/t48-builder-parity` 6c5ae3a8 |
| `r1/a4chain-minors` | 6f2fb793 | exact BM reasons and the HTTP route case for the Terbitkan refusal | contains the T45 specs |
| `r1/t52-examiner-grid` | 5a0d7bd0 | cover "Untuk Kegunaan Pemeriksa" only when a part is marked by a person (AC-20.3) | none |
| `r1/t38-selfmark-reward` / `r1/t40-attempts-acs` | 13134ced / 31a684ed | **the self-mark reward** (D94: 2 Syiling + 10 XP per mark gained, once per level, never above the part's marks) and the attempts ACs (pick cap advisory, best N, band midpoint) | t40 contains t38 |
| `r1/chain-qa-bab-3a-a3` | 0efba36c | chain spec for the Bab gate: Semakan without a Bab is refused per row and nothing moves, then passes once the Bab is given (`ci` 3a) | merges after `r1/ha18-gate-facts` fc409ae1 and `r1/chain-qa-selfmark-a3`; it contains both |
| `r1/chain-qa-selfmark-a3` | 5b93da43 | chain spec: a self-marked structured question earns the self-mark reward once per level | needs T38 |
| `r1/r1-chain-qa-a3` | 9b70ae39 | `test/r1/chain-intake-to-pupil.spec.ts` (intake figure group -> approve -> builder -> Terbit -> pupil -> Cuba Lagi) and the step map; based on BASE-105 alone | none |
| `r1/intake-reqs-a2` | 8c1964a6 | intake: an unknown SP code is refused at accept; review-queue group badge | none |
| `r1/reqb049-report-visible` | 9ece8d76 | Lapor before the first submit on a structured question (Q11) | none |
| `r1/t49-served-now` + `r1/stimulus-list-d72` | 8cb9fa5f / b45ce519 | Studio stimulus and group lists (D72 hiding, `joinable`, Negeri options) | d72 already contains t49; they merge cleanly in either order |
| `r1/admin-list-perf` | 2cd7889a | admin question list speed; migrations 0106 and 0107 (maintenance window); per-user limit of 60 calls a minute on `GET /api/questions` (429 above, see section 4.4) | REQ-B-050 and 0107 ship together |
| `r1/t04-minors` | 8ae70d6e | Bab card and "Soalan by Chapter" tile count ungrouped, chaptered, approved questions only (FD-11) | none |
| `r1/mock-known-mismatches` | a279e68c | frontend-mock conformance check green | none |

- **`r1/chain-qa-bab-3a-a3` @ 0efba36c** is the chain step for the Bab gate: `chain-qa-selfmark-a3` 5b93da43 plus H-A18 fc409ae1 (`--no-ff`), and the test `ci :: "3a. H-A18: Semakan without a Bab is refused per row with \"Sila pilih bab.\" and nothing moves (step 3 then gives the Bab and the same Semakan passes)"` in `apps/api/test/r1/chain-intake-to-pupil.spec.ts`. It merges **after H-A18 and `chain-qa-selfmark-a3`**. A3 reports 642 passed, 0 failed on it, and the chain spec 11/11 (not re-run for this pack). The per-row Bab specs remain (`gate-facts.spec.ts` 9, `lifecycle-bulk.spec.ts`).
- **Recommended test stack** (the one the A3 chain QA verified, merge order, all `--no-ff`): `reqc021-followup` -> `ha18-gate-facts` -> `req-c012-a2` -> `reqb032-pinned-rule` -> `reqb052-archived-edit` -> T48 -> T43b -> `builder-search-perf` -> T51. The heads in the step map were older for some of these than in the table above; re-read section 2.2 when you build. **T51:** the chain QA took T51 at 54f63116; T51 is now **61c1b077** (restacked on T43 238eb6eb and T31 eb0346d2) and pairs with REQ-A-008 `r1/reqa008-group-stimulus` @ 29d24be9, like T31 and T43.
- **T31, T43 and T51 do not go in without REQ-A-008.** Do not report the `http-admin.ts:202` type error as a defect of the flow.

### 2.3 What the specs already prove on that stack (from the step map)

`test/r1` + `test/bijak-integration` 15 files, 165 passed, 2 todo; `test/exam-builder` + `test/bijak-kuiz` 27 files, 465 passed; `test/bijak-attempts` + `test/questions-workflow` 35 files, 478 passed; the new chain spec alone 10/10. These are the A3 numbers, not re-run here.

## 3. The chain, step by step

Legend. **FE** = screen route (the SPA). **API** = `/api/...` route. **Msg** = exact BM text. **Spec** = `path under apps/api/test :: test title`. Abbreviations: `pc` = `r1/pipeline-chain.spec.ts`, `ci` = `r1/chain-intake-to-pupil.spec.ts`, `br` = `exam-builder/builder-review.spec.ts`, `bb` = `builder-blockers.spec.ts`, `bp` = `builder-placements.spec.ts`, `pa` = `publish-acs.spec.ts`.

### Step 1. Questions enter (admin or Guru)

- **Account:** `guru@demo.test` (own batches) or `admin@demo.test` (all).
- **FE:** `/admin/spm/soalan/muat-naik` (upload), `/admin/spm/soalan/ekstrak` (list), `/admin/spm/soalan/ekstrak/:batchId` (review), `/admin/spm/soalan/manual` (blank item). Also Studio: `/admin/questions/create`, `/admin/questions/import`.
- **API:** `POST /api/intake/batches`, `POST /api/intake/batches/{id}/files`, `POST /api/intake/batches/{id}/extract`, `GET /api/intake/items`, `PATCH /api/intake/items/{id}`, `POST /api/intake/items/{id}/accept` (creates a Draf question); `POST /api/questions` (Studio).
- **Msg (accept gate, 422 with `details.issues`):**
  - `Unit DSKP tiada dalam senarai kurikulum.` `packages/contract/src/intake/question.ts:431`
  - `Teks alternatif (alt) bagi rajah diperlukan.` `question.ts:429`
  - `Rajah belum mempunyai imej tersimpan.` `question.ts:433`
  - `SP "<kod>" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.` `question.ts:433` on `r1/intake-reqs-a2` @ 8c1964a6 only
- **Delivered by:** base (accept gate); the SP message and the group badge need `r1/intake-reqs-a2`.
- **Spec:** `intake-workflow/flow.spec.ts :: "upload, extract, review, edit, accept: a Draf question exists with provenance"`; `intake-workflow/figure-image.spec.ts :: "accept stores a question_image copy of the crop, linked to the one stimulus the two questions share"`; `ci :: "1. the teacher uploads a PDF and the extraction yields six drafts, two of them sharing one figure"` and `"2. accept made ONE stimulus group with its own question_image …"`; `intake-workflow/sp-gate.spec.ts` (intake-reqs-a2).

### Step 2. Tag DSKP and Bab, then Semakan (draft -> review)

- **Account:** `admin@demo.test`.
- **FE:** `/admin/questions/:id/edit` (Studio form), list `/admin/questions`.
- **API:** `PUT /api/questions/{id}`; `POST /api/questions/bulk-action` `{action:'review', ids}`; `POST /api/questions/{id}/status` `{to:'review'}`.
- **Msg (Semakan / submit gate, per row in `failed[]`, `fields.<name>`):**
  - `Sila pilih bab.` `apps/api/src/modules/questions/workflow/lifecycle/gates.ts:21` on `r1/ha18-gate-facts` @ fc409ae1
  - `Sila pilih subjek.` (:19) and `Sila pilih tahap pendidikan.` (:20), same file
  - summary `Soalan belum memenuhi syarat untuk dihantar semakan.` (`GATE_SUMMARY.submit`, same file :29)
- **Delivered by:** `r1/ha18-gate-facts` (chain proof: `r1/chain-qa-bab-3a-a3`). **On base alone, Semakan does not ask for a Bab.**
- **Spec:** `questions-workflow/gate-facts.spec.ts :: "9. the bulk Semakan runs the submit gate per row: a refused draft is a failed[] entry, a clean one moves"` (noChapter case); `questions-workflow/lifecycle-bulk.spec.ts :: "moves the passing questions and reports the rest with code and fields"`; `gates.spec.ts` "chapter set" row (all on H-A18). Chain: `ci :: "3a. H-A18: Semakan without a Bab is refused per row with \"Sila pilih bab.\" and nothing moves (step 3 then gives the Bab and the same Semakan passes)"` on `r1/chain-qa-bab-3a-a3` @ 0efba36c, then `ci :: "3. the admin approves them: Semakan then Terbit pass the gates (T33 …; the Bab is given where the H-A18 gate asks for it)"`.

### Step 3. Terbitkan (review -> approved)

- **Account:** `admin@demo.test`.
- **FE:** the Studio status action on `/admin/questions/:id`; flash on success: `Soalan diterbitkan — kini boleh dijawab oleh pelajar.` (`src/modules/m04-question-bank/lib/studio/status.ts:48`; the AC text writes a hyphen, the code an em dash: check by hand, section 4).
- **API:** `POST /api/questions/{id}/status` `{to:'approved'}`; `POST /api/questions/bulk-action` `{action:'approved'}`; report of where it is served: `GET /api/admin/servability/questions/{id}`; the papers that carry the question: `GET /api/admin/questions/{id}/paper-servability` (`r1/reqa018-paper-servability-route` @ b7fe6fbc). That route answers `{ data: [{ paperId, title, served, reasons }], meta: { total, truncated } }`: only published admin papers (kind `pilihan`), by paper id, **at most the first 200**; `meta.total` counts all of them and `meta.truncated` is true when the list is cut (`packages/contract/src/servability/reads.ts:185-190`). `[]` when the question is on no such paper; 404 when the bank holds no such question.
- **Msg (T33 gate, in `fields`):**
  - `Bahagian (1) belum ada aras pemikiran.` (the label is the part label) `apps/api/src/modules/questions/dskp-gate.ts:19`
  - `Sila pilih kertas untuk soalan SPM.` `dskp-gate.ts:21`
- **Msg (servability refusal, 422 `VALIDATION_ERROR`, one `servability.<activity>` line each):** `Soalan ini tidak boleh dipaparkan di mana-mana aktiviti murid, jadi belum boleh diterbitkan.` `apps/api/src/modules/questions/serving/approval-check.ts:15` on `r1/t45-servability-acs` @ 954614c6. Example lines (pinned by `a4chain-minors` @ 6f2fb793): `Latihan Bab: Belum dipautkan kepada bab — pilih Bab di borang soalan.`, `Simulasi (kertas): Tidak dihidangkan kerana mod isi jadual (table_fill) belum disokong.`
- **Delivered by:** base (T33); `r1/t45-servability-acs` (+ `r1/a4chain-minors` for the exact lines and the HTTP case).
- **Spec:** `questions-workflow/dskp-gate.spec.ts :: "gate-check lists the missing cognitive level (Bahagian copy, step 3) and the kertas (step 1) …"`; `bulk-approve-gate.spec.ts :: "a DSKP-incomplete question … is refused per row"`; `pc :: "a question without the DSKP-complete data cannot be approved: it stays in review with the BM reasons, and is not served anywhere"`; `questions-workflow/t45-approve-everywhere.spec.ts :: "unservable everywhere: approval is refused (422, BM reasons per activity) and nothing changes"` and `"POST /api/questions/:id/status {to: approved} on a question unservable everywhere: 422 …"`.

### Step 3b. Padam (delete) a question

- **Account:** `admin@demo.test` (and `guru@demo.test` for the Guru route).
- **FE:** `/admin/questions` (bulk "Padam") and `/admin/questions/:id`.
- **API:** `DELETE /api/questions/{id}`, `POST /api/questions/bulk-action` `{action:'delete'}` (a refused row is a `failed[]` entry), `DELETE /api/guru/questions/{id}`.
- **Rule (A2, `r1/delete-served-guard` @ 7e5d82e6): only a held paper blocks a delete.** A held paper is a Terbit paper, or a withdrawn paper that has had sittings. Every other delete follows V2: a Draf, a question in Semakan, an archived one, and an approved one that no held paper places are deleted.
- **Msg (both [PROPOSED], `packages/contract/src/questions/schema.ts` on that head):**
  - held paper -> 409 `CONFLICT`, `details.reason` `served` or `pinned`: `Soalan ini tidak boleh dipadam kerana ia terdapat pada kertas yang masih dipaparkan kepada murid atau yang sedang diduduki.` (`schema.ts:33`)
  - a set, remedial test or battle still uses it -> 409, `details.reason` `in_use`: `Soalan ini sedang digunakan dalam set, ujian pemulihan atau pertandingan dan tidak boleh dipadam.` (`schema.ts:35`)
  - **mid-practice is allowed:** a question held by a running Latih Tubi or Kuiz session is not blocked; an answer to the deleted question is 422, the rest of the session and its submit work, and a finished session keeps its result.
- **Check by hand:** delete a question that sits on a Terbit paper (refused, text above), delete one that only a draft paper places (allowed; that paper's review then reports the missing question), and delete a question during a pupil's open practice session (allowed).
- **Spec:** `r1/delete-served-guard.spec.ts` (delete guard, served rule, AI explanation) and `practice-question-source/delete-in-session.spec.ts` (mid-practice).

### Step 4. Kontrak made Disahkan, section pools tagged

- **Account:** `admin@demo.test`.
- **FE:** `/admin/spm/kontrak` (list), `/admin/spm/kontrak/:subjek/:kertas` (edit and Sahkan), `/admin/spm/kontrak/:subjek/:kertas/kolam` (Pratonton kolam).
- **API:** `GET /api/admin/blueprints`, `GET .../{subject}/{kertas}/evidence`, `POST .../evidence`, `POST /api/admin/blueprints/{subject}/{kertas}/verify` (the only way to write Disahkan), `PUT /api/admin/section-pools/{questionId}`.
- **Msg:** `Kontrak tidak ditemui` (`packages/contract/src/bijak/builder/schema.ts:71`); the verify refusal without evidence is asserted in `pc` (no constant to copy here: read the 422 body).
- **Delivered by:** base for the verify route; `r1/t43-chain-publish` @ 238eb6eb (with T31 and REQ-A-008) for the chain spec; `r1/t44-blueprint-fields` for the editor fields.
- **Spec:** `pc :: "verify is refused without evidence, then Disahkan with a body-format (LPM) evidence item that states every compared value"`; `pc :: "tags the section pools of the questions"`; `br :: "once tagged, Terbit no longer reports 'bukan dalam kolam bahagian ini'"`.

### Step 5. Build the paper

- **Account:** `admin@demo.test`.
- **FE:** `/admin/spm/kertas` (list), `/admin/spm/kertas/baharu`, `/admin/spm/kertas/:id` (Semak Kertas Simulasi editor).
- **API:** `POST /api/admin/papers`, `GET /api/admin/papers/{id}`, `GET /api/admin/papers/{id}/sections/{sid}/pool`, `POST /api/admin/papers/{id}/placements`, `DELETE .../placements/{questionId}`, `PUT .../sections/{sid}/order`, `PUT /api/admin/papers/{id}` (edits), `POST .../copy` (Salin set); T48: `POST /api/admin/papers/{id}/sections`, `POST .../sections/{sid}/questions`, `DELETE .../questions/{questionId}`.
- **Msg:** `Kertas Terbit tidak boleh disunting. Tarik balik dahulu.` (`schema.ts:62`); `Soalan tidak sah untuk kertas ini` and `Bahagian tidak sah` (same block); D93 `Kumpulan perlu sekurang-kurangnya 2 soalan.` (`apps/api/src/modules/exam/builder/builder.constants.ts:40`, `packages/contract/src/questions/stimuli.ts:41`); placing one member of a stimulus group places the whole group (D90).
- **Delivered by:** base (T34); `r1/t48-builder-parity` for the T48 operations; `r1/t31-builder-wire` + REQ-A-008 for the group stimuli in the builder wire.
- **Spec:** `bp :: "builds a paper from approved questions, reviews it, Terbit; the student lists, opens and can sit it"`; `bp :: "placing ONE member places the whole group, contiguous in group order"`; `bp :: "the section pool offers a group as ONE unit with the stimulus once"`; `bb :: "D93: a one-member group is a hard GROUP_MIN_MEMBERS"`; `builder-parity.spec.ts` (T48); `pc :: "places the passage group as ONE unit"`.

### Step 6. Review and Terbit

- **Account:** `admin@demo.test`.
- **FE:** the same editor `/admin/spm/kertas/:id` (button "Terbitkan", `PaperEditorPage.vue:384`).
- **API:** `GET /api/admin/papers/{id}/review` (blockers with `code`, `message`, `overridable`), `POST /api/admin/papers/{id}/publish` (optional `{override, reason}`), `GET .../student-view`.
- **Msg (blockers, `builder.constants.ts`):**
  - `Kontrak Simulasi <kod> (versi <n>) belum Disahkan (status: <Spec|Draf>); Terbit memerlukan kontrak Disahkan.` `:49-50`; `BLUEPRINT_NOT_VERIFIED` is overridable (audited reason required: `Sebab diperlukan untuk menerbitkan walaupun tidak memenuhi kontrak blueprint`, `schema.ts:77`).
  - `Soalan <id> tidak dapat dihidangkan kepada murid: <sebab>` `:43` (hard `NOT_SERVABLE`, R1E2E-06).
  - `Soalan <id> tidak dapat disemak untuk murid; cuba lagi.` `:56` (hard).
  - `Kumpulan perlu sekurang-kurangnya 2 soalan.` `:40` (hard, D93).
  - `Kertas ini tiada soalan — tidak boleh diterbitkan.` `packages/contract/src/bijak/builder/schema.ts:141` on `r1/t43b-publish-acs` @ 7a14581a.
  - Only `BLUEPRINT_NOT_VERIFIED` and `INELIGIBLE` can be overridden; `NO_KEY`, `NO_MARKS`, `MODE_NOT_ALLOWED`, `GROUP_BROKEN`, `NOT_SERVABLE`, `UNKNOWN_QUESTION` are hard (`BIJAK_BUILDER_BLOCKER_OVERRIDABLE`, `schema.ts:177`).
- **Delivered by:** base (T34); `r1/t43b-publish-acs` for the empty-paper and mark checks.
- **Spec:** `br :: "R1E2E-07 / AC-R1-16.2 … a paper on a Spec contract is refused …; the audited override publishes it"`; `pa :: "the blueprint gate: a contract that is not Disahkan is BLUEPRINT_NOT_VERIFIED (overridable) …"`; `bb :: "R1E2E-06: a question pupils cannot be served is a hard NOT_SERVABLE"`; `pc :: "Terbit: the publish answers ok and the paper is Terbit"`; `pa :: "at least one question: an empty paper is refused with 'Kertas ini tiada soalan' first …"`.

### Step 7. The pupil finds the paper and opens the cover

- **Account:** `pelajar@demo.test`.
- **FE:** `/spm/bijak` (hub and Kertas Pilihan list), `/spm/bijak/kertas/:paperId` (cover).
- **API:** `GET /api/bijak/papers`, `GET /api/bijak/papers/{id}`.
- **Msg:** unknown, draft, withdrawn or another user's Jana paper: 404 `Kertas tidak ditemui` (`packages/contract/src/bijak/attempts/schema.ts:34`). The cover prints "Untuk Kegunaan Pemeriksa" only when a part is marked by a person (`r1/t52-examiner-grid` @ 5a0d7bd0).
- **Spec:** `pc :: "sees the paper in the Bijak SPM list and on its cover"`; `pc :: "a draft paper is not visible to a pupil; a withdrawn paper is gone …"`; `bijak-papers/examiner-grid.spec.ts :: "a Kertas 1 paper of objective questions only: false"` (T52).

### Step 8. The pupil sits

- **Account:** `pelajar@demo.test`.
- **FE:** `/spm/bijak/percubaan/:attemptId`.
- **API:** `POST /api/bijak/attempts` `{paperId, mode:'exam'}`, `GET /api/bijak/attempts/{id}`, `PUT /api/bijak/attempts/{id}/answers` (autosave), `GET /api/bijak/papers/{paperId}/in-progress`.
- **Msg:** `Percubaan tidak ditemui` (`attempts/schema.ts:33`); a new sitting of a paper that places an archived question: 403 `Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.` (`attempts/schema.ts:51`).
- **Rules to eyeball:** the group stimulus appears once above both members, on the group and never on a question; the image file is readable by the pupil only once its question is live.
- **No key leaks, as the chain spec now proves it (an allow-list, `ci` 7):**
  - a served question may carry only the keys `formOrigin`, `id`, `marks`, `mcq`, `number`, `sectionId`, `stem`, `topic`, plus `groupId` on a member of a stimulus group; `mcq` holds only `options`;
  - an option may carry only `{id, text, image}`;
  - a recursive scan of the whole payload finds no key named like `correct`, `answer`, `key`, `scheme`, `reason`, `solution`, `model`, `explain` or `rubric` (the pupil's own `answers` is excluded), the correct option id appears only as an option `id`, and the scheme's reason text is absent.
  A new field on a pupil question, or a renamed answer key, fails that test.
- **Spec:** `pc :: "starts an attempt: the group stimulus is served ONCE with both members; no answer key leaks"`; `pc :: "the group image file is readable by the pupil once its member question is live (R1-B20) …"`; `ci :: "7. the pupil sees the paper and starts it: the figure stimulus is served ONCE with both members and a readable image; no key leaks"`; `r1/pinned-version-rule.spec.ts :: "a new version is approved (version 1 is superseded): the sitting keeps version 1, and so does its grading"` (REQ-B-032, `r1/reqb032-pinned-rule` @ a2cb5bb4).

### Step 9. Hantar (submit) and the result

- **Account:** `pelajar@demo.test`.
- **FE:** button "Hantar" (`AttemptPage.vue:663`), result `/spm/bijak/percubaan/:attemptId/keputusan`.
- **API:** `POST /api/bijak/attempts/{id}/submit` (idempotent), `GET /api/bijak/attempts/{id}/result`.
- **Msg:** before Hantar the scheme is hidden: `Skema hanya didedahkan selepas Hantar` (`attempts/schema.ts:37`); `Percubaan sudah tamat` (:38).
- **Reward:** one `quiz_spm` ledger row per attempt (2 Syiling per mark), XP 10 per mark once, streak (kombo) touched. On the chain paper (6 marks) `ci` 8b asserts exactly **12 Syiling in one ledger row** and an **XP delta of 60**, and that a replay of the same key, or another key, adds nothing; none for `latihan`, an abandoned attempt, or the admin in Mod Pelajar. **The amounts for Latih Tubi and Databank sessions are still open (section 5).**
- **Spec:** `pc :: "answers every question and submits"`; `pc :: "sees the result: MCQs auto-marked, the structured part waits for self-mark with a suggestion"`; `bijak-integration/flow.spec.ts :: "3. credits the wallet once …"` and `"3b. adds the XP … touches the streak"`; `ci :: "8. …"` and `"8b. the submit paid the reward ONCE on this bank paper …"`.

### Step 10. Semakan: Markah kendiri (self-mark)

- **Account:** `pelajar@demo.test` (the owner, after Hantar only).
- **FE:** result page, part card (`src/modules/m28-bijak-spm/components/PartResultCard.vue`, `SelfMarkControl.vue`). Texts: `Belum dimarkah — perlu semakan` (`PartResultCard.vue:22`), `Markah kendiri disimpan` (`SelfMarkControl.vue:77`).
- **API:** `POST /api/bijak/attempts/{id}/self-mark` `{partId, mark, band?}`.
- **Msg:** `Bahagian ini tiada dalam kertas ini.` (`attempts/schema.ts:42`), `Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.` (:43), `Band tidak sah untuk bahagian ini.` (:44), `Bahagian ini tidak menggunakan band.` (:45); before Hantar: 409 `NOT_SUBMITTED` with `Skema hanya didedahkan selepas Hantar`.
- **Reward:** a later self-mark that raises the score pays 2 Syiling + 10 XP per mark gained, once per level, never above the part's marks (D94). **This needs `r1/t38-selfmark-reward` @ 13134ced. On base (and on the A3 stack) a self-mark pays nothing extra.**
- **Spec:** `pc :: "self-marks the structured part (b12) and the total is recomputed"`; `bijak-attempts/self-mark.spec.ts` (R1-B12 cases; "records the change to the performance aggregate (regraded) … without a second reward" is the base behaviour); with T38: `r1/chain-qa-selfmark-a3` @ 5b93da43 `pc :: "T38: a self-marked structured question earns the self-mark reward once per level; a replayed or lower self-mark adds nothing"`; `bijak-integration/rewards.spec.ts` (D94).

### Step 11. Cuba Lagi

- **Account:** `pelajar@demo.test`.
- **FE:** "Cuba Lagi" on the result page (`ResultPage.vue:195`, `retrySamePaper`); on Simulasi Kuiz the label is `↻ Cuba Lagi` (`src/modules/m28-bijak-spm/lib/kuiz.ts:20`).
- **API:** `POST /api/bijak/attempts/{id}/retry`.
- **Msg:** `Hantar percubaan ini dahulu sebelum mencuba semula.` (`attempts/schema.ts:49`); `Kertas ini sudah tidak tersedia untuk dicuba semula.` (:47); archived question on the paper: `Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.` (:51).
- **Rule:** a new attempt and a new reward key; the old attempt, result and history row stay (D93, second part).
- **Spec:** `pc :: "Cuba Lagi: a NEW attempt on the same paper; the old attempt, its result and its history row stay"`; `bijak-attempts/self-mark.spec.ts :: "R1-B15 Cuba Lagi"`; `ci :: "9. Cuba Lagi: a NEW attempt on the same paper; the old attempt and its result stay"`; `bijak-integration/cuba-lagi-rewards.spec.ts` (T38/T40).

### Step 12. Tarik balik (withdraw)

- **Account:** `admin@demo.test`.
- **FE:** button "Tarik balik" (`PaperEditorPage.vue:403`). The AC confirm text is `Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.` (`docs/requirements/v2-admin-student-pipeline.md`, AC-07.7); **I did not find it in `src/`: check by hand that the confirm appears** (section 4).
- **API:** `POST /api/admin/papers/{id}/withdraw`.
- **Rule (as deviated, T43b row of `docs/architecture/v2-backend-deviations.md`):** only the paper goes back (status `withdrawn`); its questions stay approved. Past attempts, answers and results remain; the pupil no longer lists, starts or retries it.
- **Msg:** `Kertas Terbit tidak boleh disunting. Tarik balik dahulu.` (an edit while Terbit); `Tarik balik kertas Terbit sebelum memadam` (delete while Terbit, `schema.ts:63`); retry on a withdrawn paper: `Kertas ini sudah tidak tersedia untuk dicuba semula.`
- **Delivered by:** base (withdraw); `r1/t43b-publish-acs` for the AC-07.7 spec.
- **Spec:** `pa :: "a submitted attempt and its result, and an in-progress retry, survive a withdraw; the pupil no longer sees the paper nor starts or retries it"`; `pc :: "a draft paper is not visible to a pupil; a withdrawn paper is gone for the pupil and cannot be retried, but the past attempt and its result stay (R1-20.3)"`.

### Step 13. Lapor and Arkib (optional branch of the flow)

- **Accounts:** pupil `pelajar@demo.test` files the report; `admin@demo.test` triages.
- **FE:** `/admin/question-reports` (admin triage, "Arkib" on a report row).
- **API:** `POST /api/question-reports`, `GET /api/question-reports`, `PATCH /api/question-reports/{id}` `{status, adminNotes, archive:true}`.
- **Msg:** after Arkib on a question that sits on a Terbit paper the answer carries `papers` and `warning`: `Soalan ini ada dalam kertas yang telah diterbitkan. Murid tidak boleh memulakan percubaan baharu pada kertas itu sehingga soalan diganti.` (`packages/contract/src/question-workflow/reports.ts:46`). After Arkib, a new sitting and the per-paper Kuiz (`GET /api/bijak/kuiz/papers/{id}` and `POST …/check`, FE `/simulasi/:paperId/kuiz`) are refused with `Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.` (403); a sitting started earlier keeps its pinned version.
- **Delivered by:** base (H-A13); Lapor before the first submit on a structured question needs `r1/reqb049-report-visible` @ 9ece8d76.
- **Spec:** `bijak-integration/report-archive.spec.ts :: "4. \"Arkib\" on the report row archives through the lifecycle …"` and `"5c. archived: the per-paper Kuiz of the Terbit paper is refused for the page and the check (403, BM line); a sitting started before still reads"`.

## 4. Check by hand (no backend proof)

### 4.1 FE-only and partial ACs

From the coverage doc (`docs/qa/r1-backend-ac-coverage.md`, status "FE only" or "partial"). The API side, where there is one, is named in that row.

| AC | What to check on screen |
|---|---|
| AC-02.2 | the wizard path in four clicks and the exact flash `Soalan diterbitkan — kini boleh dijawab oleh pelajar.` (the AC spells it with a hyphen; the code `status.ts:48` has an em dash: decide which is right and report) |
| AC-10.6 | Pilih N Bahagian: the header, the checkbox, the cap and dimming of the other questions (the server accepts ticks above N and scores the best N; the cap is screen only) |
| AC-R1-02.1 | the (N+1)th tick is refused on the screen with the plain BM message (D9 row, T40) |
| AC-20.3 (cover) | the words `SULIT`, the paper code, subject, `{code} · Kertas {k}`, `{duration} minit`, the numbered instructions, and that the stored title and year are **not** printed. The API still sends `title` and `year`; the examiner grid is conditional (T52) |
| AC-R1-01.1, AC-01.2 | the hub composition (Kertas Pilihan, Jana Kertas, Sejarah, Databank; R2/KIV hidden) and the empty state with zero Terbit papers |
| AC-R1-08.4, AC-20.8 | the result page and every question reachable at 375 px |
| AC-R1-20.5 | the real API (http mode, no mock transport) at 375/768/1280 |
| AC-02.5, AC-03.1, AC-03.7, AC-07.3, AC-14.7 | intake action names state the real result; DSKP tagging inside the wizard; Kesukaran unchanged; a generated set publishes in two clicks; navigation shows only enabled activities |
| AC-10.1 to 10.5 | the widgets: mcq, short_text, numeric, extended_essay, essay_choice (marking is proven by `bijak-question-bridge/mapping.spec.ts`) |
| AC-11.1 to 11.4, 11.6, 11.8, 11.9, 11.10 | stimulus rendering: passage, image, diagram/map/graph, table (own scroll container), tappable option images, mobile persistence of a shared stimulus, the load failure text `Rajah tidak dapat dimuatkan.` + Cuba lagi + Lapor, no layout shift |
| AC-20.5, AC-20.6 | paging, hidden questions keep answers, autosave debounce 1 s; the question map rail and flags |
| AC-17.1 to 17.5, AC-18.7 | the responsive rules below, and the journeys at three widths |

**Moving an added question across Bahagian (`r1/t48-label-move-fix` @ 9783849c, needs T48).** In the paper editor `/admin/spm/kertas/:id`: add a question with `Tambah soalan` in an added Bahagian (give it a Nombor soalan, for example `21`), then move it to another added Bahagian. Check that it **keeps its Nombor soalan** (21), that `Padam soalan` still deletes it, and that a **second `Tambah soalan` with the same number is refused**: 422, `fields.number`, `Nombor soalan 21 sudah digunakan dalam kertas ini.` (`packages/contract/src/bijak/builder/schema.ts:124` on that head). Spec: `exam-builder/builder-parity.spec.ts :: "the Nombor soalan follows an added question that a PUT moves to another Bahagian: Padam soalan still deletes it, and the number stays used"`.

Other texts worth a manual read because only the constant is pinned, not the screen: the withdraw confirm (step 12), `Belum dimarkah — perlu semakan` and `Markah kendiri disimpan` (step 10).

### 4.2 Responsive checks

For **every** screen below, open it at **375, 768 and 1280 px** and confirm: no horizontal scroll of the page; tables and images scroll inside their own container (AC-17.2); touch targets are at least 44 px (AC-17.3); the question map rail is placed correctly (AC-17.4). Use the accounts of section 1.

| Screen | Route | Account |
|---|---|---|
| Intake upload | `/admin/spm/soalan/muat-naik` | guru / admin |
| Intake list | `/admin/spm/soalan/ekstrak` | guru / admin |
| Intake review | `/admin/spm/soalan/ekstrak/:batchId` | guru / admin |
| Intake manual item | `/admin/spm/soalan/manual` | admin |
| Studio list, form, detail | `/admin/questions`, `/admin/questions/create`, `/admin/questions/:id/edit`, `/admin/questions/:id` | admin |
| Laporan Soalan | `/admin/question-reports` | admin |
| Kandungan SPM hub, Databank, Simulasi lanes | `/admin/spm`, `/admin/spm/databank`, `/admin/spm/simulasi` | admin |
| Kontrak list, edit, Pratonton kolam | `/admin/spm/kontrak`, `/admin/spm/kontrak/:subjek/:kertas`, `/admin/spm/kontrak/:subjek/:kertas/kolam` | admin |
| Papers list, new, editor | `/admin/spm/kertas`, `/admin/spm/kertas/baharu`, `/admin/spm/kertas/:id` | admin |
| Semakan queue and item | `/admin/spm/semakan`, `/admin/spm/semakan/:key` | admin |
| Bank (Soalan) and its editor | `/admin/spm/soalan`, `/admin/spm/soalan/:qid/sunting` | admin |
| Bijak hub, history | `/spm/bijak`, `/spm/bijak/sejarah` | pupil |
| Paper cover | `/spm/bijak/kertas/:paperId` | pupil |
| Attempt (exam and latihan) | `/spm/bijak/percubaan/:attemptId` | pupil |
| Result and Semakan | `/spm/bijak/percubaan/:attemptId/keputusan` | pupil |
| Simulasi Kuiz | `/simulasi/kuiz`, `/simulasi/:paperId/kuiz` | pupil |

### 4.3 UAT SELECTs (read-only)

Both are in `docs/ops/r1-runbook.md` on this branch. They contain no INSERT, UPDATE, DELETE or locking clause; they were run inside `BEGIN READ ONLY … ROLLBACK` against a database migrated to the branch tip with the demo seed.

- **AC-R1-11.4 (legacy questions still appear, image-held items stay excluded):** runbook section 3.6b (and the login count and cards of 3.6). Record the identity SELECT **before** the migrations and again after 0100 and after the legacy loader. Expected: `live_questions = servable + live_approved_inactive + live_not_approved`; `held_image_but_served` = 0; `servable` after is not below the value recorded before. On the full demo seed: live 1,268, servable 1,268, held-image 0, login count 493 = sum of the card counts.
- **AC-R1-12.6 (DSKP nodes per in-scope subject):** runbook section 4, "R1-12.6 read-only check". Expected after a real `dskp:load`: every one of the 13 subjects has `nodes > 0`, the "subject without nodes" SELECT returns 0 rows, the total is 2,844, levels T4 and T5 only. Before the load every subject shows 0.

The UAT before/after numbers themselves are ops evidence; the runbook only fixes the queries.

### 4.4 Expected behaviour that looks like a bug: 429 on the admin question list

On `r1/admin-list-perf` @ 2cd7889a the admin question list `GET /api/questions` is limited **per user**: **60 calls a minute**; above that the answer is 429 `RATE_LIMITED` with a `Retry-After` header (`apps/api/src/modules/questions/http/admin.controller.ts:25-30`; spec `test/questions/list-rate-limit.spec.ts`). Searching or paging the list rapidly in `/admin/questions` can hit it. **That is expected, not a defect**: wait for the `Retry-After` seconds. The limit is the environment variable `THROTTLE_QUESTIONS_LIST_PER_MINUTE` (blank = 60; `.env.api.example:86`, `apps/api/src/common/config/env.schema.ts:149`); the question writes have their own `THROTTLE_QUESTIONS_WRITE_PER_MINUTE` (60). Another user is not affected. Report a 429 only if it appears well below 60 calls a minute.

## 5. Known open items

- **R1-10.1 rates are pending the user (Q1 to Q3).** The repo documents only that V2's `PracticeRecorder` pays 2 Syiling and 10 XP per correct unit on a paper submit (`docs/discovery/BIJAK-SPM-cloud.md:347`). Still unknown: the V2 rate for Latih Tubi and Databank sessions (ours is 1 per correct, `practice/rules.ts:60`; V1 observed 1), and the V2 kombo step. Do not file the Latih Tubi / Databank syiling amount as a defect until the answers are in; coverage row `AC-R1-10.1` stays `partial`.
- **The self-mark reward needs T38** (`r1/t38-selfmark-reward` @ 13134ced; `r1/t40-attempts-acs` contains it). Without it a later self-mark changes the score but pays nothing.
- **The Bab gate needs H-A18** (`r1/ha18-gate-facts` @ fc409ae1). Without it Semakan does not ask for a Bab and "Sila pilih bab." never appears. The chain spec for it is `ci :: "3a. …"` on `r1/chain-qa-bab-3a-a3` @ 0efba36c (merge after H-A18 and `chain-qa-selfmark-a3`).
- **T31, T43 and T51 merge only with REQ-A-008** (`r1/reqa008-group-stimulus` @ 29d24be9); order T48 -> T31 -> T43 -> T51; T43b is an independent leaf after T48.
- **AC-R1-18.1 stays partial:** the Latihan Bab step is named (`questions/chapter-practice.spec.ts :: "AC-18.1 Latihan Bab: …"`) but the full clean-DB chain with the Bab activity is not one spec.
- **AC-R1-11.4 and AC-R1-12.6 are partial** until the UAT run (section 4.3).
- **AC-07.7 and AC-07.9 are proven as deviated** (T43b row of `docs/architecture/v2-backend-deviations.md`): the paper's own questions stay approved on withdraw, and a member added after Terbit is refused instead of flagged. Do not report either as a defect.
- **R1-06.3 is skipped by decision** (no R1 paper has a Bahagian marked as a whole); **AC-R1-13.2, PIPE AC-11.12 and AC-12.1** are deferred to R2 (D87 U2, D92): Databank and Latih Tubi SPM serve text-only MCQs in R1.
- **Migrations to expect** on a full stack: 0104 (T48), 0105 (H-A18), 0106 and 0107 (admin-list-perf, maintenance window, `pg_trgm`), 0110 (team C). See `docs/ops/r1-runbook.md` sections 2 and 3.

## 6. If a step cannot be run

Say which branch heads the stack had (the table in section 2.2), which account you used, the route, and paste the response body verbatim (the BM `message` and `fields`). A bug that quotes a text different from the one in section 3 is either a stale build or a real defect: the `file:line` in section 3 tells the developer where to look.
