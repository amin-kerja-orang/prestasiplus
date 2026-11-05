-- 0186_s5_support_hours
-- Purpose: DM-86, S7-T09 (S5 range, requested by S7), PO decision 18 on issue 503 (comment 6647916025). `support_config` gains the service hours the
-- admin sets in Tetapan and Panduan shows. Phone stays `whatsapp_number`.
-- Expand only: one nullable column, no default, no rewrite. Old code that ignores it keeps working.
-- Reversible: ALTER TABLE "support_config" DROP COLUMN "hours";

ALTER TABLE "support_config" ADD COLUMN "hours" VARCHAR(120);
