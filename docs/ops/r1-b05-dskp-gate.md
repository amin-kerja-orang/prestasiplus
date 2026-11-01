# R1-B05: leaf cognitive level and the DSKP-complete approve gate (migration 0102)

Spec: ADR-0031, TRACKER D76, D80 DEC-2, D83 D-4, D85 U4; `docs/architecture/v2-admin-student-pipeline.md` 3.1 and 13.4.

## Database

`apps/api/prisma/migrations/0102_leaf_cognitive_level/migration.sql` (one statement group, reversible by the three statements in its header):

- `question_parts.cognitive_level text` (nullable), CHECK in `mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta`.
- CHECK `cognitive_level IS NULL` on branch parts (`mode IS NULL`), like the other leaf-only columns.
- No data is written: legacy rows keep NULL ("Belum ditanda DSKP"), nothing is invented.

The per-leaf TP is the existing `question_parts.difficulty_tp` (migration 0092, NULL inherits the version TP). ADR-0031 named it `tp`; a second column would hold the same value twice, so none was added (deviation, same wire name `difficultyTp`).

KBAT stays in step: a leaf saved with only a cognitive level gets `kbat` = that level for the four upper levels and `'bukan'` for mengingat and memahami; an explicit `kbat` wins.

## Behaviour

- Approve gate (`review -> approved`, "Terbitkan"; also create as `approved` and `bulk-action approved`): the merged gate of ADR-0027 plus, only for an SPM-bound question (subject in `spm_subject_configs` and level Tingkatan 4 or 5), a cognitive level on every leaf ("Bahagian (b) belum ada aras pemikiran.") and the kertas ("Sila pilih kertas untuk soalan SPM."). Unit, SP and TP are the tag gate every approval already ran.
- Legacy rule (D80 DEC-2): the gate runs only on a transition into `approved`. An approved question that was never tagged stays approved and servable in Latih Tubi, Bab and the games; editing it makes version 2 as a draft and its next approval runs the gate (AC-03.9). Exclusion of untagged legacy MCQs from blueprint papers is the servability rule set (R1-B03), unchanged here.
- `GET /api/questions/:id/gate-check?gate=approve|submit` returns `{ ok, issues: [{ path, code, message, step }] }`, no state change. Admin Pusat, or the owning Guru for their own question (another Guru 404, Admin Sekolah and others 403).
- `POST /api/questions/:id/status { to, reason? }` runs the lifecycle (table, role, reason, gates) and answers `{ question, servability }`; `servability` is the `ServabilityReport` of the approval, null for other targets. A refused gate is 422 `VALIDATION_ERROR` with `fields` keyed by path and `details.gate` (the existing shape of the other gate refusals); a pair outside the table is 409 with the BM message.
- Flat questions: `cognitiveLevel` on the create and update body sets the level of the single leaf; a flat edit that does not send it keeps the stored one.
- Create as `approved` (Admin Pusat, `POST /api/questions` and `POST /api/stimulus-groups/:id/questions`) runs the full approve gate, DSKP included, but not the submit gate: Bab is optional (D89) and the source declaration has no V2 equivalent before Lulus (team A lead decision, 2026-10-31).

## Verification

```sql
-- the column and its checks
SELECT conname FROM pg_constraint WHERE conrelid = 'question_parts'::regclass AND conname LIKE 'ck_question_parts_cognitive_level%';
-- how many leaves are tagged (expect 0 right after the migration, then growing)
SELECT cognitive_level, count(*) FROM question_parts WHERE mode IS NOT NULL GROUP BY 1 ORDER BY 1;
```

New environment variables: none.
