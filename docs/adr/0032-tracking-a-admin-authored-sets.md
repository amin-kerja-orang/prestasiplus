# ADR-0032: Tracking A sets are admin-authored, with student visibility computed from approved members

Status: Proposed
Date: 2026-10-30

## Context
`spm_tracking_sets` / `spm_tracking_set_questions` exist but the only writer is the seed (`prisma/seed/spm.ts`). .cloud: the admin edits sets in Panel `Kandungan SPM > Tracking A > Sunting`, set status is `locked` below `target_count` (default 40), `bersih` at target, `bank_besar` above; a locked set 404s for students; a question may not be in two sibling sets (same subject and year).

## Decision
1. Reuse the two tables. Add `target_count smallint default 40`, `created_by`, `updated_by` to the set, and denormalised `subject_id`, `year` onto the set-question rows with a unique index `(subject_id, year, question_id)` (the sibling-set rule is then enforced by the database; the service copies the values from the set, which is immutable in subject/year).
2. Status is never stored. Student count = members that pass `servable('tracking_a')` NOW (approved, active, MCQ, key present). `< target` -> locked, `= target` -> bersih, `> target` -> bank_besar. An archived member therefore re-locks a set automatically (no job).
3. `PUT /api/admin/spm/tracking-a/:id` replaces the member list atomically on `Simpan`; `fill` and `swap` are read-only suggestion endpoints so nothing is committed before `Simpan` (AC-09.1).
4. Creating a set (`POST`) is added because .cloud sets are created outside the UI (CLI) and DEC-4 forbids seeds. UX gap: a `Tambah Set` control on the Tracking A list is needed (user decision U3 in the architecture doc).
5. No seed data in production (AC-09.6). Language lane (BM/BI) remains served by Latihan Berstruktur as today.

## Consequences
- Migration 0103 backfills `subject_id/year` of existing seed rows and fails if the unique index would be violated (dev data only).
- Student endpoints (`/api/spm/tracking-a`) change from "seed sets" to "sets with count >= target"; a direct read of a locked set answers 404.
