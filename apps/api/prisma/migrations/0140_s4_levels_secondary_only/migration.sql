-- R1 S4-T05 (DM-13, FR-X3-1, FR-ADM-C03.3): only Tingkatan 1-5 are active education levels; a primary (Darjah) level is never active.
-- Additive only (one check constraint, no data change).
--
-- NOT VALID: Postgres checks every new INSERT and UPDATE against the constraint at once, but does not scan the existing rows.
-- The repository seed already has D1-D6 inactive (prisma/seed/curriculum-data/levels.json); the UAT clone of V2 production data
-- still holds active Darjah rows (DM-12) until the admin deactivates them in `Tahap Pendidikan` (U-OP-03). The validation is
-- therefore a separate operator step after U-OP-03 (S4-T08 pack), never part of this migration:
--   ALTER TABLE "education_levels" VALIDATE CONSTRAINT "ck_education_levels_no_active_primary";
--
-- Depends on: the ETL level step (`apps/api/src/migration/load/reference-steps.ts`, `educationLevelsStep`, S0) loading primary
-- rows inactive; otherwise an ETL replay of a Darjah row is rejected by this constraint.
--
-- Reversible:
--   ALTER TABLE "education_levels" DROP CONSTRAINT "ck_education_levels_no_active_primary";

ALTER TABLE "education_levels"
  ADD CONSTRAINT "ck_education_levels_no_active_primary" CHECK ("stage" <> 'primary' OR "is_active" = false) NOT VALID;
