# R1 release notes (Bijak SPM): operator-facing changes

Documentation only. No server action is taken by agents; DevOps decides when to apply.

## Migration 0092 `bijak_standards`: existing Disahkan blueprints become Spec

- Migration `0092_bijak_standards` downgrades every existing blueprint with `source = 'verified'` to `'spec'`. The old "Disahkan" value carried no verifier or evidence, so it cannot be kept under the D76 rule (a human verification with a recorded verifier and an evidence check).
- The new column `blueprints.serves_students` defaults to `false`, and the CHECK `ck_blueprints_serves_students` allows `true` only for `source = 'verified'`.
- Consequence: after the upgrade no blueprint serves students. `POST /api/bijak/papers/generate` answers 422 `NO_BLUEPRINT` for a pupil until an Admin Pusat verifies the blueprint in Pentadbiran (Kontrak, tab Pengesahan, `Sahkan`). Re-verify every blueprint that pupils need before announcing Jana Kertas. Curated Kertas Pilihan papers are not affected.
- Admin Pusat in Mod Pelajar may still generate from a Spec head (test data); Admin Sekolah follows the pupil rule.

## Migration numbering

- `0092_bijak_standards` and `0093_part_options_image_file_index` (renamed from an earlier 0092). UAT is at 0091, so a fresh `migrate deploy` applies both in order. See the deviations note of 2026-10-31 for local databases that recorded the old folder name.
