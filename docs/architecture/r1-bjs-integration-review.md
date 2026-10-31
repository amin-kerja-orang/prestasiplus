# R1-L1: Bijak "standards" work reviewed against V2, integrated into the R1 base

Slug `admin-student-pipeline`, release R1 (Bijak SPM). Task R1-L1. Date 2026-10-30. Branch `r1/integrate-bjs` (from `feature/v3-bijak-r1` @ 6f92e350).
Naming: V1 = prestasiplus.my, V2 = prestasiplus.cloud + admin.prestasiplus.cloud, V3 = this system (repo "v2").
Bar (TRACKER D86-D88): V3 must match V2 (and V1); anything not in V2 is KIV unless the user approved it.

## 1. Result in one table

| # | Item | Class | One-line reason |
|---|---|---|---|
| 1 | BJS-01 contract (`packages/contract/src/bijak/standards/*`, canGenerate on contract rows, leaf fields in `questions/parts.ts`) | REUSE | Extends the V2 blueprint (A20) with the exam standard the user approved (D75, D76, D78); V2 fields are a subset. |
| 2 | BJS-02 migration `0092_bijak_standards` | REUSE | Additive, nullable or defaulted; drops only unused `topic_weights` after a zero-row assertion. Keeps number 0092. |
| 3 | BJS-03..05 exam-core standard model, solver, `composeStandardPaper`, oracle | REUSE | Admin-time "Jana set" is exact-or-refuse in V2 (PIPE AC-07.2); D32 asks for Jana Kertas under the Kontrak. Pure TS, no new dependency (ADR-0025). |
| 4 | BJS-06 per-leaf TP, KBAT, unit, form origin and bank filters | ADAPT | Matches R1-B02/B05 "leaf tp / cognitive level", but the encoding is the D80 `kbat` enum, not a 1..6 cognitive level. R1 plan wording must follow (section 5). |
| 5 | F1-F4 Kontrak list, editor, Pengesahan, Pratonton kolam | ADAPT | Behaviour approved (D78). Labels and copy must become V2's: "Kontrak Simulasi", "Senarai Kontrak", "Baharu", `Kod Kertas`, `Jumlah Markah`, `Sumber`, `Boleh tanda auto`, duplicate text "Kontrak untuk subjek/kertas ini sudah wujud." (F06, F01). |
| 6 | F5 student Jana Kertas states (`BijakHubPage` tab, `GenerateShortageAlert`, `ResultPage` retry) | REUSE (not KIV) | See section 3: the brief expected KIV, but D32 and R1 scope AC-R1-01.1 / AC-R1-15.3 put student Jana Kertas inside R1. Kept visible and routed. |
| 7 | fb124946 BJS-07 pool source (`questions/bijak-pool.ts`) | REUSE | Needed by B09a and by admin pool preview. |
| 8 | b40eb831 (and its two parents) BJS-08/09 blueprint admin, versions, evidence, verify, DSKP units and subjects routes | REUSE | Disahkan gate (A20, D76); `source = verified` only through the verify service. R1-B10 is largely done by this. |
| 9 | 2c5caec0 (and parent) BJS-12/13 seeds, 6 launch blueprints | ADAPT | Seeds are "Spec" until verified; hash helper de-duplicated; they must not be shown as Disahkan. R1-B19 reuses them for the demo. |
| 10 | a3216b78 contract section-review route | REUSE | AC-39.9 review stamp; service now validates with the contract's `BijakSectionReviewInput`. |
| 11 | 35b8cc0b F1-F4 lint fix | REUSE | Applied (also renames `server/mock.ts` to `server/memory.ts`). |
| 12 | BJS-10/11 (generate and pool preview wiring in the API) | NOT WRITTEN | Belongs to R1-B09a. `papers.service.ts:206` still calls the legacy `composeFromBlueprint`. |
| 13 | BJS-17/18 DSKP-aware intake | LATER | Depends on branch `claude/determined-dijkstra-ju5q60`; not merged in L1. |

No item is DROP. Nothing needed hiding (section 3).

## 2. Evidence per item

V2 anchors used:
- `docs/discovery/cloud-student-mechanism.md` lines 117-119 (blueprint model: per subject and kertas, `Sumber` draft/spec/confirmed, NULL never fails), 131 (Simulasi papers are fixed compositions), 381-390 (Jana set: exact-or-refuse, 2 clicks), 411-415 (Flow 7: Kontrak Simulasi screen, fields, texts).
- `docs/discovery/v2-parity/admin.md` A20 (line 59), A18 (57), C04 (77); `student.md` B21 (line 45: "D32: V3 Jana Kertas tab ... under Kontrak Blueprint, shortage line").
- `docs/requirements/v3-bijak-spm-scope.md` AC-R1-01.1 (line 69), AC-R1-15.1 to 15.3 (lines 177-179), R1-16 (line 181).
- TRACKER D32 (line 37), D75, D76, D78 (lines 83-86), D80 (line 166), D86-D88.

| Item | Evidence in code | Evidence against V2 / R1 |
|---|---|---|
| BJS-01 | `packages/contract/src/bijak/standards/schema.ts:19-35` (BM copy), `admin.ts:175` (`BijakSectionReviewInputSchema`), `bijak/papers/schema.ts:176-195` (`canGenerate`, `unavailableReason`) | A20 lists the V2 blueprint fields; BJS adds profile, quota, KBAT, verification, all approved by D75/D78. AC-R1-15.3 "only Disahkan contracts are offered" = `canGenerate` rule. |
| BJS-02 | `apps/api/prisma/migrations/0092_bijak_standards/migration.sql:63-64` (`serves_students`, `structure_hash`), `:213-220` (serving CHECK and unique index), `:41-42` (`tag_review`, `catalogue_version`) | R1 plan 13.3 reserves 0100-0110; 0092 is below it and undeployed (UAT at 0091). |
| BJS-03..05 | `packages/exam-core/src/compose.ts:185` (`composeStandardPaper`), `standard-model.ts:63` (`StandardSection`), `verify.ts` (oracle) | Mechanism line 385: Jana set refuses on an insufficient pool. ADR-0025 no external solver. |
| BJS-06 | `apps/api/src/modules/questions/effective-leaf.ts`, `apps/api/test/questions/leaf-curriculum.spec.ts` | D80 / ADR-0026 revision 2026-10-30: `kbat` enum replaces 1..6 level; `cognitive_level` kept for M05/M04 filters. R1-B02 text says `tp/cognitiveLevel`. |
| F1-F4 | `src/modules/m28-bijak-spm/admin/kontrak/**`, routes `routes/admin-kontrak.ts:21-47` | Route titles say "Kontrak Blueprint" (`routes/admin-kontrak.ts:24-25`, `src/shells/pentadbiran/menu.ts:120`); V2 says "Kontrak Simulasi". Duplicate text at `server/memory.ts:316` and `pages/KontrakListPage.vue:348` is "...subjek dan kertas ini sudah wujud." (V2: "Kontrak untuk subjek/kertas ini sudah wujud."). The API text `BIJAK_BUILDER_MESSAGES.blueprintExists` (`packages/contract/src/bijak/builder/schema.ts:71`) has a different suffix again. |
| F5 | `pages/BijakHubPage.vue:27-31` (tabs), `:251` (Jana section), `components/GenerateShortageAlert.vue`, `lib/shortage-lines.ts` | D32 (a), parity B21, AC-R1-01.1, AC-R1-15.3. |
| BJS-07 | `apps/api/src/modules/questions/bijak-pool.ts`, `apps/api/test/questions/bijak-pool.spec.ts` | Pool = servable questions; compatible with R1-B03 servability (rule keys `jana_kertas`, `simulasi_paper`). |
| BJS-08/09 | `apps/api/src/modules/exam/blueprints/blueprints.service.ts` (create, versions, retire, `reviewSection`), `blueprint-verification.service.ts`, `blueprints.controller.ts` | R1-B10 "Disahkan is the only source Jana Kertas trusts"; A20; D76 (verified by Admin Pusat only). |
| BJS-12/13 | `apps/api/prisma/seed/exam-launch-blueprints.ts`, `seed/bijak-standards/{layer1,layer2,evidence,build}.ts`, specs under `apps/api/test/seed/` | Seeds mirror observed exam papers (D75); not invented. |

## 3. Why F5 is not KIV

The brief marked "F5 student self-service Jana Kertas" as KIV because V2 production has fixed published papers. Three approved sources say otherwise:
1. D32 (user, 2026-10-16): Bijak SPM has two starts, "Kertas Pilihan" and "Jana Kertas" (random paper = V2 `/spm-mock`, generated under the Kontrak Blueprint).
2. `v2-parity/student.md` B21 maps V2 `/spm-mock` to the V3 Jana Kertas tab.
3. R1 scope (approved D87): AC-R1-01.1 lists "Bijak SPM (Kertas Pilihan, Jana Kertas, Sejarah)"; AC-R1-15.3 "Jana Kertas and student-generated papers: only Disahkan contracts are offered".

So F5 stays routed and visible. A first attempt to hide it behind `VITE_BIJAK_STUDENT_JANA` was written and then reverted before any commit. If the user later removes the student Jana Kertas tab from R1, the single place to gate is `pages/BijakHubPage.vue` (tab list at line 27, section at line 251); the API route `POST /api/bijak/papers/generate` and `canGenerate` need no change.
Result: no student surface was hidden. KIV pieces in this integration are only the not-yet-built BJS-10/11 and BJS-17/18 (section 6).

## 4. Integration steps and fixes

1. Merged `feature/bijak-spm-standards` @ 1bc11c8a (clean; 7 overlapping files auto-merged: questions types/views/repository/service, contract questions schema/paths, `openapi.json`).
2. Merged fb124946, a3216b78, b40eb831, 2c5caec0, 35b8cc0b (octopus; `openapi.json` and `seed/exam.ts` auto-merged).
3. Migration collision: `0092_part_options_image_file_index` renamed to `0093_part_options_image_file_index` (git rename, SQL unchanged). BJS keeps `0092_bijak_standards`. Only `docs/qa/question-bank-images-kertas.md` names the old folder; it records a past local run and is left as history. Row added to `docs/architecture/v2-backend-deviations.md`.
4. `apps/api` tsc errors after the merge were 4 (not the 8 known: the other four were fixed by the later branches):
   - `prisma/seed/exam.ts`: the merge kept two `structureHashOf` definitions. One helper remains, `structureHashOf` in `src/modules/exam/blueprints/blueprint-standard.ts`; the seeds import it; `seed/bijak-standards/hash.ts` deleted; the duplicated `structureHash:` key removed.
   - `papers.service.ts` `listContracts`: added `canGenerate: b.servesStudents` and `unavailableReason: 'NO_BLUEPRINT'` when false (minimal; the "show the older serving version while a Spec head is edited" rule is left to B09a).
5. BJS-08 review route aligned (extra input a): contract `BijakSectionReviewInputSchema` replaces the local `z.strictObject({})`; Disahkan head returns 409 "Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu." (`BIJAK_STANDARDS_MESSAGES.evidenceLocked`, the text the contract's OpenAPI already declared for this route); `blueprint-standards-api.spec.ts` extended.
6. F1 "Tandakan sudah disemak" (extra input b): `SectionEditor.vue` bar and button, `KontrakEditorPage.vue` handler (enabled only when saved and not Disahkan), `server/api.ts` + `http.ts` + `memory.ts` `reviewSection` calling `POST /admin/blueprints/{s}/{k}/sections/{pos}/review`; test `__tests__/kontrak-review.test.ts`.
7. Legacy specs inserting blueprints without `structure_hash` (NOT NULL after 0092) fixed: `test/bijak-papers/schema.spec.ts`, `seed.spec.ts`.

## 5. Conflicts with, and updates to, the R1 plan (`v2-admin-student-pipeline.md` section 13)

| Task | Status after L1 | Update the plan to say |
|---|---|---|
| R1-B02 | Partly done | The leaf fields are `tp`, `kbat` (enum mengaplikasi / menganalisis / menilai / mencipta / none), `unit`, `formOrigin` (done in contract and `question_parts`); do NOT add a 1..6 `cognitiveLevel` (D80). Remaining: ServedQuestion, stimulus kinds, self-mark, quiz, retry fields. |
| R1-B05 | Partly done | Persisting leaf `tp`/`kbat`/`unit`, `tag_review`, `catalogue_version` columns and the bank read model exist (BJS-02/06). Remaining: approve gate, `gate-check`, servability in the status response, intake `to-question` carrying tags. Migration number for any new column must not reuse 0092/0093. |
| R1-B09a | Not done, inputs ready | Generate must call `composeStandardPaper` (exam-core) with `bijak-pool.ts` (BJS-07) instead of `composeFromBlueprint` (`papers.service.ts:206`); the pool preview endpoint (`GET /admin/blueprints/{s}/{k}/pool`, F4) exists, the builder-side `pool-preview` placements route does not. Student `generate` and admin `papers/generate` share that code. BJS-10/11 are absorbed here. |
| R1-B10 | Mostly done | Verify service, `serves_students`, structure hash, Disahkan lock, 409 copy, duplicate create rule exist. Remaining: conformance at publish and Jana, "Kontrak untuk subjek/kertas ini sudah wujud." (V2 text) in `BIJAK_BUILDER_MESSAGES.blueprintExists`, `needs_review` flag only if the O-2 signal is wanted in R1 (the migration has no `needs_review`; migration 0121 (team A overflow range) stays optional). |
| R1-F06 | Mostly done, relabel needed | Editor, list, verification, pool preview exist. Remaining: V2 labels and fields (`Senarai Kontrak`, `Baharu`, `Kod Kertas`, `Jumlah Markah`, `Sumber` Draf/Spec/Disahkan, `Boleh tanda auto`, `Padam kontrak ini?`), title "Kontrak Simulasi" (`routes/admin-kontrak.ts:24-25`), the V2 duplicate text. Also remove mock-only seeding from `server/memory.ts` for http mode (D84). |
| R1-F01 | Unchanged | Menu KS-08 label is still "Kontrak Blueprint" (`menu.ts:120`) and must become "Kontrak Simulasi"; `menu.test.ts` must follow. |
| R1-B19 | Easier | The 6 launch blueprints are seeded as Spec (BJS-12/13); the Disahkan demo blueprint needs a verify step or an explicit E2E-only seed. |
| Migration table (13.3) | Note | 0092 `bijak_standards` and 0093 `part_options_image_file_index` are taken; 0094-0099 free; 0100-0102 unchanged. |

## 6. Left for later

- BJS-10/11: no code (see B09a above).
- BJS-17/18 (DSKP-aware intake): depends on branch `claude/determined-dijkstra-ju5q60`; not merged here; schedule after B04/B05.
- Student `generate` still reads the legacy composer until B09a lands; `canGenerate` is head-based.
- API DB specs and the m04 CSV template test result: see the report in the hand-back message.
