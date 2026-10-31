# ADR-0029: One question store; remove the SPM pool tag, the PoC fixture and module-own pools

Status: Proposed
Date: 2026-10-30

## Context
Gap analysis: the admin create path hard-codes `spmPool=false` and only the migration loader writes the `pool` tag, so Latih Tubi SPM, Databank, Mock K1, Misi fallback and Battle SPM never see admin questions. Bijak "Percubaan" papers come from a code fixture (`bijak/papers/poc`, `poc-question-source.ts`, `bijak/question-bridge/composite.ts`, `exam/builder/composite.source.ts`) behind `BIJAK_POC_QUESTIONS` with reserved ids. D11/D12 require one owner per store (questions -> M04).

## Decision
1. **spmPool removed as a concept.** SPM activities select by subject, level, kertas/paper code and DSKP tags through `servable(activity)` (ADR-0028). `QuestionFilter.spmPool`, `PracticeSelection.spmPool`, `QuestionRecord.spmPool`, the create-input flag and the `question_tags kind='pool'` writes are deleted. Migration 0106 deletes existing `question_tags` rows with kind `pool` and narrows the check constraint to `pksk_domain, pksk_level`. Behaviour mapping: "SPM pool" activities (A01 SPM mode, A02, A04, A21 SPM mode, Misi fallback) read approved MCQ of the subject, as .cloud does.
2. **PoC fixture removed.** Delete `poc-bank`, `poc-question-source`, the PoC branch of `composite.ts` and `composite.source.ts`, reserved-id handling, the `BIJAK_POC_QUESTIONS` env key and its docs. Bijak candidates, attempts and builder read only the bank (`be09-question-source`, `question-bank.source`). Production never had PoC rows (flag false); dev/demo databases are purged by a guarded cleanup script (aborts if it finds attempts on non-demo users).
3. **Module-own pools removed.** `spm/pool.service.ts`, `battle.deps` pool counts, `games/core/game-questions.service`, `classes/missions/question-pool.ts`, `practice start.planner` samplers and `exam/builder/question-bank.source` become thin callers of `ServabilityService.where()`. Audio KBAT stays its own content type (admin-authored audio sets), not a question store; listed as A20 follow-up.
4. **Seeds.** Seed data exists only in `seed:dev` (local/test) and never in production. The 768 D1-D4 PoC MCQs (deviation row 735) are dropped from the seed because primary levels are inactive (D72); dev seeds use T4/T5 questions via the same approved path. Tests and e2e create their own content through the admin API.
5. **Tracking A** gets an admin writer (ADR-0032).

## Consequences
- AC-01.1, AC-01.3, AC-08.3 hold by construction; the PoC env flag cannot change visibility.
- Existing PoC-era e2e (`e2e/bijak/admin-publish-http.spec.ts`) is rewritten against bank questions.
- Teacher "Misi" draws and "Set Soalan Guru" keep their id lists but verify through `servable` at serve time.
