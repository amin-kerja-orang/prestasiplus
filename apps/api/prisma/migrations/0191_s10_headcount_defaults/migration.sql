-- S10-T02 (DM-49, API-RPT-16): class-level defaults of the headcount config. An entry with a null TOV / ETR reads these
-- ("Simpan Sasaran"); the OTR targets are computed from the resolved TOV and ETR and `headcount_entry_marks.target` is no longer read.
-- Additive and nullable: no backfill. `headcount_entries.rs_recorded_at` already exists and is untouched.
-- rollback: ALTER TABLE headcount_configs DROP CONSTRAINT ck_headcount_configs_default_etr_range, DROP CONSTRAINT ck_headcount_configs_default_tov_range, DROP COLUMN default_etr, DROP COLUMN default_tov;

ALTER TABLE "headcount_configs" ADD COLUMN "default_tov" NUMERIC(5,2) NULL;
ALTER TABLE "headcount_configs" ADD COLUMN "default_etr" NUMERIC(5,2) NULL;
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_default_tov_range" CHECK ("default_tov" IS NULL OR ("default_tov" >= 0 AND "default_tov" <= 100));
ALTER TABLE "headcount_configs" ADD CONSTRAINT "ck_headcount_configs_default_etr_range" CHECK ("default_etr" IS NULL OR ("default_etr" >= 0 AND "default_etr" <= 100));
