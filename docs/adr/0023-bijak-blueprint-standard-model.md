# ADR-0023: Blueprint standard model: JSONB documents, per-leaf TP, serving flag

- **Status:** Accepted (G2 of `bijak-spm`, approved by the user 2026-10-29)
- **Date:** 2026-10-29
- **Related:** `docs/architecture/v2-bijak-spm-standards.md` section 3, `v2-exam-schema.md` D2/D8/D9 (aligned today), D76, requirements AC-25.x, AC-36.x, AC-37.x, AC-39.x, Q-B22.

## Context
The blueprint must carry an exact topic quota, a difficulty profile with slot groups, a KBAT quota and a verification record; TP and cognitive level are needed per leaf part; the last verified blueprint must keep serving students while a new Spec version is edited. The existing model has one `active` row per subject and kertas, `topic_weights` (never used) and `cognitive_mix`.

## Decision
1. **Quota and profile are JSONB documents** on `blueprint_sections` (`profile`, `quota`) plus a `kbat_marks` column, validated by the zod schemas in `@pp/contract` on write and on read. Rejected: child tables for slot groups and quota lines. They are never queried across blueprints, always read and written with their section, and the repo already stores `reference_sheets` the same way. Unit references are `curriculum_nodes.id` (stable) with `t1_t3` as a bucket.
2. **TP and cognitive level per leaf part** are nullable overrides on `question_parts`; `question_versions.difficulty_tp` / `cognitive_level` become the inherited default. Question TP (max) and KBAT marks (sum over leaves with level >= 3) are computed, not stored. Rejected: storing derived question-level values (they drift) and moving the data to a new table.
3. **Verification** is insert-only (`blueprint_verifications`) with a frozen check result and evidence snapshot; evidence lives in `blueprint_evidence` per version. `source = verified` is written only by the verify service; the client enum is `Draf | Spec`.
4. **Serving** is an explicit flag `serves_students` with a partial unique index per subject and kertas, separate from `status = active` (the editing head). Cosmetic edits (hash unchanged) carry the verification and the flag to the new version; structural edits create a Spec head and leave the flag on the old version until the new one is verified. Rejected: letting two rows be `active`, or inferring "last verified" from history (an explicit retire could not stop serving).
5. `topic_weights` is dropped and `cognitive_mix` is left unused; both are superseded.

## Consequences
- One migration with hand-written CHECKs and partial indexes; every addition is nullable or defaulted; the only destructive step is dropping an unused column after a zero-row assertion.
- The editor, the API and the solver share one schema definition and one `validateBlueprint`.
- Jsonb content cannot be constrained by foreign keys: the validator checks that every unit belongs to the subject, and a DSKP edition change needs a re-mapping step (risk R-B6).
- Legacy MOTS-3 questions become KBAT under the new level encoding; their migrated levels need review (open point O-3).

## Revision 2026-10-29 (O-1)
Unit attribution moves from the question to the **leaf part**: `question_parts.unit_node_id` and `form_origin` are nullable overrides of the question's primary unit (same inheritance as TP and cognitive level). Marks-basis quota lines count leaf marks per effective unit; questions-basis lines count a question once under its primary unit. Reason: the layer-2 data files showed multi-topic questions (Matematik 1449/2 Bahagian C, Sejarah 1249/2 Bahagian B) that one primary unit cannot represent. Cost: two nullable columns and a unit signature in the solver's question types (`v2-bijak-spm-standards.md` 3.1a, 5.3).
