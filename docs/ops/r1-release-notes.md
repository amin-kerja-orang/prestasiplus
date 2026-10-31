# R1 release notes (Bijak SPM): operator-facing changes

Documentation only. No server action is taken by agents; DevOps decides when to apply.

## Migration 0092 `bijak_standards`: existing Disahkan blueprints become Spec

- Migration `0092_bijak_standards` downgrades every existing blueprint with `source = 'verified'` to `'spec'`. The old "Disahkan" value carried no verifier or evidence, so it cannot be kept under the D76 rule (a human verification with a recorded verifier and an evidence check).
- The new column `blueprints.serves_students` defaults to `false`, and the CHECK `ck_blueprints_serves_students` allows `true` only for `source = 'verified'`.
- Consequence: after the upgrade no blueprint serves students. `POST /api/bijak/papers/generate` answers 422 `NO_BLUEPRINT` for a pupil until an Admin Pusat verifies the blueprint in Pentadbiran (Kontrak, tab Pengesahan, `Sahkan`). Re-verify every blueprint that pupils need before announcing Jana Kertas. Curated Kertas Pilihan papers are not affected.
- Admin Pusat in Mod Pelajar may still generate from a Spec head (test data); Admin Sekolah follows the pupil rule.

## Migration numbering

- `0092_bijak_standards` and `0093_part_options_image_file_index` (renamed from an earlier 0092). UAT is at 0091, so a fresh `migrate deploy` applies both in order. See the deviations note of 2026-10-31 for local databases that recorded the old folder name.

## Migration 0101 `essay_choice`: new part mode and topics column

- `0101_essay_choice` (R1-T25) adds the `essay_choice` value to the `question_parts.mode` CHECK and a nullable `question_parts.topics` jsonb column (2 to 6 topics `{ id, label }`, enforced by `ck_question_parts_topics`). Additive only: no existing row changes, and the file does not read any status value, so it is independent of 0100 (lifecycle).
- Order on a fresh `migrate deploy`: 0092, 0093, 0100, 0101. Planned numbers above 0101 are in `docs/architecture/v2-admin-student-pipeline.md` (section 2, "Numbering").
- Effect: the admin question routes now accept and store an `essay_choice` leaf (before this, such a leaf was refused with 422). Reverse SQL is in the migration header (only after deleting essay_choice parts).
