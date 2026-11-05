-- 0233_s7_support_config_hours
-- Purpose: S7-T09, PO decision 18 on issue 503 (comment 6647916025). `support_config` gains the service hours the
-- admin sets in Tetapan and Panduan shows. Phone stays `whatsapp_number`.
-- Expand only: one nullable column, no default, no rewrite. Old code that ignores it keeps working.
-- Reversible: ALTER TABLE "support_config" DROP COLUMN "hours";

ALTER TABLE "support_config" ADD COLUMN "hours" VARCHAR(120);
