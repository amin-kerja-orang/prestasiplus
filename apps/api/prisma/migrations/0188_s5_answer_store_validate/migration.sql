-- S5-T15 part 3, DM-44 (single answer store): validates ck_practice_answers_mode (added NOT VALID in 0181) and sets
-- practice_answers.mode NOT NULL. Ships once the "no write outside the port" allow-list is empty, so every writer
-- (AnswerLogPort, the legacy ETL loader, the demo seed) sets a valid mode.
--
-- Backfill (PO 5 Nov: no manual U-OP-20 step before this migration): a row still without a mode gets the mode of its
-- practice session as stored (legacy values such as 'random' stay as they are, the 19-value check accepts them), or
-- 'latih_tubi' when it has no session or the session is gone (DM-44). U-OP-20 `--legacy-mode` stays available for
-- an operator who wants to pre-run the same backfill in batches before the deploy window.
--
-- Lock: SET NOT NULL scans practice_answers under ACCESS EXCLUSIVE (the 0181 check lets NULL pass, so Postgres cannot
-- skip the scan); writes to the table wait for the scan. Deploy in a low-traffic window.
--
-- Reversible: `ALTER TABLE "practice_answers" ALTER COLUMN "mode" DROP NOT NULL;` (the validated check stays valid;
-- it still accepts NULL, so the column can be relaxed without touching the constraint).

UPDATE "practice_answers" AS a
   SET "mode" = coalesce((SELECT s."mode" FROM "practice_sessions" s WHERE s."id" = a."session_id"), 'latih_tubi')
 WHERE a."mode" IS NULL;

ALTER TABLE "practice_answers" VALIDATE CONSTRAINT "ck_practice_answers_mode";
ALTER TABLE "practice_answers" ALTER COLUMN "mode" SET NOT NULL;
