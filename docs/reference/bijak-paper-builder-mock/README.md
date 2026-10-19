# Bijak SPM paper-builder mock (read-only reference for BE-39)

This is a snapshot of the prototype's paper-builder mock, taken from `feature/student-prototype` at f9eeded5. That branch is not on this backend branch yet. **This mock is the behavioural spec for BE-39** (and BE-38 for intake). Copy its field names, statuses, result shapes and BM strings exactly.

The files are `.txt`, so they are never compiled, linted or imported. Do not edit them. The LEAD refreshes the snapshot when the prototype changes.

| File | Source | What to take from it |
|---|---|---|
| server_admin.ts.txt | src/modules/m28-bijak-spm/server/admin.ts | Operations: createPaper, savePaper (PaperPatch), publishPaper ({ok, errors[]}), unpublishPaper, deletePaper (idempotent), getPaperEditor, previewQuestions, listAdminPapers, listBlueprints; BM error strings |
| domain_admin-types.ts.txt | src/modules/m28-bijak-spm/domain/admin-types.ts | AdminPaper, AdminPaperStatus ('draf' / 'terbit'), AdminPaperSummary, BuilderQuestion, BuilderGroup, PaperEditorData, BlueprintView |
| domain_paper-builder.ts.txt | src/modules/m28-bijak-spm/domain/paper-builder.ts | checkPaper rules and the BM lines of the publish gate |
| domain_blueprint.ts.txt | src/modules/m28-bijak-spm/domain/blueprint.ts | Blueprint sections, compulsory, choose-N, marks |

When the contract differs from this mock on purpose (UD-1 decimal-string ids, D57 429/no-store), add a dated row to docs/architecture/v2-backend-deviations.md.
