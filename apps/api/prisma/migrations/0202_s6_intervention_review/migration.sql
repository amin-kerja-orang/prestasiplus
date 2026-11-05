-- S6-T02 (DM-30, API-RPT-17): interventions.alert_type also accepts 'other'. `after_accuracy` already exists (migration 0023).
-- Drops and recreates the check; no data changes, so no backfill.
-- rollback: ALTER TABLE "interventions" DROP CONSTRAINT "ck_interventions_alert_type"; ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_alert_type" CHECK ("alert_type" IN ('mood','inactive','declining'));

ALTER TABLE "interventions" DROP CONSTRAINT "ck_interventions_alert_type";
ALTER TABLE "interventions" ADD CONSTRAINT "ck_interventions_alert_type" CHECK ("alert_type" IN ('mood','inactive','declining','other'));
