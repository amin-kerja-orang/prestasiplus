# ADR-0036: R1 slice (Bijak SPM first), DSKP load as a packaged script, Databank text-only until R2

Status: Proposed (with section 13 of `docs/architecture/v2-admin-student-pipeline.md`). Date 2026-10-30. Decision D86.

## Context
D86 narrows the first release to secondary students and Bijak SPM, with the Databank fed by admin questions. UAT has no curriculum nodes, papers, blueprints or stimuli. A DSKP parser and an idempotent dev seed exist, but the source JSON lives under `docs/reference/dskp` (outside the API package) and covers Tingkatan 4 and 5 only. The practice family (Databank, Latih Tubi, Mock) has no UI for stimuli, images or groups.

## Decision
1. R1 contains the student Bijak flow, the admin chain that feeds it, and the Databank fed from the single bank without `spmPool`. Tracking A, Mock/Subjektif upgrades, practice-bridge image support and Heatmap are R2; Kertas Subjektif/OCR, games, unused answer modes and teacher/admin-sekolah features are KIV.
2. The DSKP curriculum is loaded by an idempotent, insert-only script packaged with the API (data copied into `apps/api/prisma/seed-data/dskp`, same code as the dev seed, `--dry-run` and a count report). It is not a migration: the data is large, admin-editable after load, and must not be re-applied by `migrate`. DevOps runs it per environment. R1 loads Tingkatan 4-5; Tingkatan 1-3 DSKP nodes wait for a source (the legacy rule keeps untagged questions servable).
3. To remove `spmPool` completely in R1, all its readers are repointed to `ServabilityService.where()` in one mechanical change. Until the R2 bridge upgrade, questions with images, stimuli or groups are excluded from the practice family by named rule codes that the admin sees in "Dilihat murid di". They are served in Bijak SPM and Simulasi Kuiz.
4. Shared migrations, seeds and contract changes are serialized through one baton per wave; every other task is an additive change with its own tests.

## Consequences
- Plus: the demo path is short (DSKP, Studio, Kontrak, Set Builder, Terbit, sit, self-mark, retry); no half-removed flag; deploy-time DSKP load is repeatable and safe to re-run.
- Minus: the Databank does not show image questions until R2; T1-T3 questions cannot carry DSKP tags in R1; the data copy under `apps/api` must be kept equal to the docs copy (checksum test).
