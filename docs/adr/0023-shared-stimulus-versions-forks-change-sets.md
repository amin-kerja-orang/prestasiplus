# ADR-0023: Shared stimuli are versioned entities; a shared edit is a fork or a change set, never a silent overwrite

- **Status:** Proposed (G2 for `v2-shared-stimulus`; becomes Accepted when the user approves the decisions in `docs/architecture/v2-shared-stimulus.md` section 0)
- **Date:** 2026-10-25
- **Related:** `docs/requirements/v2-shared-stimulus.md` (US-01 to US-10, FB-027 to FB-030); `docs/architecture/v2-shared-stimulus.md`; `docs/requirements/v2-exam-schema.md` D6; ADR-0013/0014 (virtual datasets, one owner per shared store, D12), ADR-0018 (contract-first schemas), ADR-0021 (`@pp/exam-core`, on `feature/v2-backend`), ADR-0022 (DSKP catalogue; same persisted-state migration pattern)

## Context
- Today one stimulus row is shared by every question of a group. `applyLive` in `m28-bijak-spm/server/admin.ts` overwrites `BANK.stimuli[id]` when one member's revision is approved, so all siblings change without review (old defect f, audit FB-027). The old system had the same defect in Studio; the Panel forked only for other papers.
- A published question can be moved in or out of a group only inside an intake batch (FB-030). A question can carry one stimulus, a part none (FB-028). Two of the 15 old kinds exist (FB-029).
- The review queue knows two units: a new-batch group (decided together) and a single-question revision (`v:<qid>`). Neither can carry "N questions change together because their shared stimulus changed".
- The backend (BE-09/BE-10, after the 30 Oct go-live) will store questions as immutable versions and papers pin question versions (Bijak AC-23.5, QB AC-21.5). The design must map onto that without a second rewrite.
- `@pp/exam-core` and `be/bijak-integration` already consume `GroupDef.stimulusId` and `BijakAttemptStimulus` (strict, one stimulus per group). Renaming those fields would break an integration in progress.

## Decision
1. **Identity and versions.** A stimulus has a stable `id` and an integer `version` (starts at 1). A version is immutable once live. The live "head" is what students and admins read. A question version pins the stimulus versions it was approved with (backend: foreign key to the version row; prototype: references by id, all live references always point at the head).
2. **Sharing is computed, not stored.** "Who shares stimulus S" is derived from references (group lists, question lists, part references) by one usage function. No stored counter exists (D11 spirit: counts are computed).
3. **Two outcomes for an edit of a shared stimulus**, chosen by the admin with no default, enforced by the server:
   - **Fork ("Salin untuk soalan ini sahaja")**: a new stimulus id (version 1) is created for this question only; the question leaves the group. The new stimulus lives inside the question's pending revision and is created on approval, so a rejected fork leaves no orphan row.
   - **Change set ("Ubah untuk semua N soalan")**: a new entity `ChangeSet` groups the next stimulus version(s) and the next version of every sharer. It is one review unit (`cs:<id>`), decided atomically: all N versions go live in one step, or none.
4. **Attach and detach on a Terbit question** use the same `ChangeSet` (kinds `attach`, `detach`). Only the moving question gets a new version; the other members keep their version and keep serving; the group membership changes at approval.
5. **Locks.** While a revision or change set is pending on a question or group, any further stimulus operation on any of its sharers is refused with the existing message "Sudah ada versi baharu menunggu semakan" naming the question. A stale-base check (`base` versions sent with the save) refuses a save made on content that has changed since the editor opened.
6. **Additive type evolution.** The exam types keep every existing field. `GroupDef.stimulusId` stays the first stimulus; `GroupDef.extraStimulusIds` carries stimulus 2 and 3. `QuestionDef.stimulusIds` (own list) and `PartDef.stimulusId` are new and optional. The student contract keeps `groups[].stimulus` (the first) and adds `groups[].stimuli`, `questions[].stimulusIds`, `parts[].stimulusId` and a resolved `stimuli` map. The wire/database form is a clean ordered list; the TypeScript shape is the compatible form.
7. **One rules function.** `stimulusIssues(...)` (pure, in the domain folder, movable into `@pp/exam-core` unchanged) is called by intake submit, every revision path, change-set approval, publish and paper publish.
8. **Uploads.** Uploaded figures are stored as assets by id and rendered only through `<img>`. `v-html` stays reserved for the bundled seed `svg`. Raster types only in v2.0 unless the old upload handler (open item Q2) proves otherwise.

## Alternatives considered
- **Keep editing in place, add a notice (status quo plus FB-002 sentence):** the notice does not stop propagation; it fails AC-01.6. Rejected.
- **Copy-on-write embedded in each question version (stimulus content copied into every question):** simplest to pin, but breaks "stored once" (D6 rule 1), makes a shared edit N independent writes, and recreates the 946-orphan problem. Rejected.
- **Always fork on edit (never edit the shared row):** loses the legitimate "correct a typo for everyone" case that the old Studio supported. Rejected; the admin chooses.
- **Generic multi-entity transaction record for every revision (turn single-question revisions into change sets of one):** cleaner in theory, but rewrites the delivered single-revision path (`v:<qid>`), its tests and queue counting for no user-visible gain. Rejected for now; the backend may unify later.
- **Rename `GroupDef.stimulusId` to `stimulusIds[]`:** cleaner shape, but breaks `be/bijak-integration` (`papers.service`, `poc-question-source`) and the strict attempt contract. Rejected; revisit when the integration branches are merged and the contract is versioned.
- **Allow SVG upload and sanitise:** a parser/sanitiser is a new dependency and an attack surface (AC-07.4). Rejected for v2.0.

## Consequences
- `applyLive` stops writing `BANK.stimuli`; stimulus heads change only through `applyChangeSet` or an approved revision that carries stimulus edits. A test pins "no sibling changes unless listed in the approved set".
- The admin slice gains `stimuli`, `groups` (approved deltas over code seeds), `changeSets`, `assets`. Boot applies them after seed hydration, same delta-over-seed pattern already used for `review[*].live`. A one-time idempotent migration (marker `sst`) converts old pending/approved single-stimulus revisions.
- The review queue gets a third unit type (`cs:<id>`). Queue stats count one item per change set and N questions, as revisions are counted today.
- The mock does not pin paper versions (it has no per-version question store). AC-02.5 second clause (a published paper keeps the version it references) is a backend-only guarantee until the paper-version work (Bijak AC-23.5) lands. This is listed as an open question with a recommended default.
- Contract work after go-live: widen `BijakAttemptStimulus.kind`, add the optional fields, version the student view (additive; `contract-diff` classifies a widened enum as additive). `AiStimulusDef` is untouched: the extractor still emits `diagram`, `passage`, `table`.
- Hand-over to BE-09/BE-10: tables `stimulus_versions`, `stimulus_group_versions`, `change_sets` (architecture doc section 4.6). Membership of a group is derived from live question versions in the backend; the prototype keeps `GroupDef.questionIds` and a test asserts they agree.
