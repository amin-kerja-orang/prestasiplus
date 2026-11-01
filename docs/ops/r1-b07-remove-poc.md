# R1-B07 (T36): the PoC question fixture is gone

Spec: R1-B07, REQ-B-019, REQ-B-029, REQ-A-009.

## What changed

- The API serves the question bank only (`bijak/question-bridge/bank-sources.ts`). The PoC fixture and the PoC/bank composite split were removed from `apps/api/src`. The PoC export lives in `apps/api/prisma/seed/poc/export`; the test doubles in `apps/api/test/support/poc`.
- `BIJAK_POC_QUESTIONS` is a deprecated no-op. The key is still accepted so an old environment file does not break start-up; `true` makes the API log one warning at start. Remove it from environments.
- The four seeded PoC papers (reserved question ids, loaded into no table) are no longer playable outside tests. Starting one answers 403 "not eligible", Jana Kertas has no PoC pool (422 SHORTAGE), and the paper builder does not offer their questions.

## REQ-B-029: no PoC paper is listed or startable outside tests

The exam seed still creates the PoC papers as `published` (the tests plug the double on them and exercise stimulus groups, maths input and equivalence marking). On a runtime database that made the pupil hub list them with "0 markah", and "Mula" gave 403.

New seed step `exam-retire-poc` (`prisma/seed/exam.ts`, in `seedModules` before `gamification`, and in the poc profile order): it **withdraws** a published paper only when EVERY placement points at the reserved PoC id block (`POC_QUESTION_ID_BASE` and up) and no `questions` row has that id. A paper with any bank question (the bank demo paper, an admin-made paper, a generated Jana paper), a paper without placements and a draft are never touched. It is idempotent and never deletes: attempts and results of the seeded sittings (`poc-bijak-sittings`, which keep their dashboard and report data) still reference the paper. The tests that need the PoC papers seed `examSeed` alone, so they are unaffected.

Why withdraw instead of not seeding: the school-admin and performance reports are driven by seeded sittings on the PoC paper; not seeding the paper would change those figures and many test fixtures. A guarded withdraw fixes both a fresh seed and an already seeded host (a reseed over it).

## Demo host plan

The demo host must offer papers made of bank questions:

1. **Bank demo paper** "Latihan Demo Matematik Bank Soalan (Contoh)" (K1, 6 MCQ, from `poc/bijak-sittings.ts`), created by the demo seed. This is the paper the e2e specs use (`BIJAK_PAPER_ID`).
2. Papers published from the **paper builder** (Pembina Kertas) on approved bank questions (the e2e seed, T26, and the demo seed's bank questions).

Steps for an existing demo host:

1. Deploy the API and the migrations of this release (no schema change in T36).
2. Run the demo seed (`be:db:seed`, the laptop one-off of the demo runbook). `exam-retire-poc` withdraws the four PoC papers; the bank demo paper stays published.
3. Remove `BIJAK_POC_QUESTIONS` from the Render service (`render.yaml` no longer sets it; an existing service keeps its stored value, harmless and ignored).
4. `deploy/demo/redeploy-demo-migration-aware.sh` no longer stops when `BIJAK_POC_QUESTIONS` is not `true`. Its read-only target check now reports (warning, not a stop) how many published papers have only bank questions.

Verify after the deploy:

- `select title, status from papers where kind = 'pilihan' order by id;` : the four PoC titles are `withdrawn`; "Latihan Demo Matematik Bank Soalan (Contoh)" is `published`.
- As the demo pupil: `/spm/bijak` lists only playable papers (no "0 markah" card); "Mula" on the bank demo paper starts an attempt (no 403).
- `scripts/demo-smoke.sh` step 3 starts an attempt on the first listed paper; it fails (never passes) when that paper is not playable.
- The API log shows no `BIJAK_POC_QUESTIONS is deprecated` warning once the variable is removed.

## Release notes input

Bijak papers, attempts, Jana Kertas, the kuiz and the paper builder now read the question bank only; the PoC question fixture is removed and `BIJAK_POC_QUESTIONS` is a deprecated no-op. The four seeded PoC papers are withdrawn by the seed (`exam-retire-poc`) and are not playable outside tests; the demo host offers the bank demo paper and builder-made papers instead. Remove `BIJAK_POC_QUESTIONS` from every environment.

## Not done here

- `e2e/api/bijak-part-input.spec.ts` needs a playable structured Kertas 2 paper; the only seeded K2 papers are PoC papers (withdrawn now, 403 on start). Left as it is: it depends on T26c (a structured K2 pool and a Terbit paper in the e2e seed, A1, `r1/t26c-e2e-k2`); B1 merges T26c with T36.
- `e2e/bijak/admin-publish-http.spec.ts` (create + publish a K1 paper) needs enough approved bank Matematik K1 questions for the "Objektif" blueprint (1449/1: 40) on the stack; T26b (REQ-B-028) makes the e2e profile's builder pool reach Sepadan from the bank. Not run here.
