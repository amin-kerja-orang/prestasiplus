-- R1-H-A18: the approve/submit gate reads real facts instead of satisfied defaults.
-- Two additive columns on question_versions; every other gate fact (open duplicate, unconfirmed low-confidence fields, media, source
-- declaration, required fields) is derived at read time from rows that already exist.
--
--   last_editor     'person' | 'ai'. 'ai' = the last content written to this version was written by the AI service (an AI variant, or the
--                   canned AI explanation) and no person has acted on it since. The approve gate refuses it ("Penyemak tidak boleh
--                   perkhidmatan AI."). A person's edit or ANY status transition by a person sets it back to 'person'.
--   declared_marks  smallint, null = not declared. The question total declared at intake accept; the approve gate compares it with the sum
--                   of the leaf marks. A person's edit sets it to null (the person now owns the marks).
--
-- Backfill:
--   last_editor = 'ai'  only for ai_variant questions whose version is draft or review and has no status transition made by a person;
--   last_editor = 'person' (the default) for everything else, approved and archived rows included. The gate runs only on a NEW approval, so a
--   question that is already approved is never re-checked (D80 DEC-2).
--   declared_marks from intake_items.payload->>'marks' where the version came from an intake item, the item has NO parts and the value is a whole
--   number 1..999 (a parted item's total is 0 in the intake payload: its marks are the parts', so nothing is declared for it).
--
-- Additive; no existing row changes meaning. Reversible:
--   ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_declared_marks", DROP CONSTRAINT "ck_question_versions_last_editor",
--     DROP COLUMN "declared_marks", DROP COLUMN "last_editor";

ALTER TABLE "question_versions" ADD COLUMN "last_editor" TEXT NOT NULL DEFAULT 'person';
ALTER TABLE "question_versions" ADD COLUMN "declared_marks" SMALLINT;

-- NOT VALID, then VALIDATE (as 0103 does for its FK): adding a CHECK validated in one step scans the table under ACCESS EXCLUSIVE; the
-- VALIDATE below runs after the backfill and takes only SHARE UPDATE EXCLUSIVE (reads and writes continue).
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_last_editor" CHECK ("last_editor" IN ('person', 'ai')) NOT VALID;
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_declared_marks" CHECK ("declared_marks" IS NULL OR "declared_marks" >= 0) NOT VALID;

DO $$
DECLARE
  n_ai int; n_marks int;
BEGIN
  UPDATE "question_versions" v SET "last_editor" = 'ai'
   WHERE v."status" IN ('draft', 'review')
     AND EXISTS (SELECT 1 FROM "questions" q WHERE q."id" = v."question_id" AND q."source_type" = 'ai_variant')
     AND NOT EXISTS (SELECT 1 FROM "question_status_events" e
                      WHERE e."question_id" = v."question_id" AND e."version_no" = v."version_no" AND e."from_status" IS NOT NULL AND e."actor_user_id" IS NOT NULL);
  GET DIAGNOSTICS n_ai = ROW_COUNT;

  UPDATE "question_versions" v SET "declared_marks" = (i."payload"->>'marks')::smallint
    FROM "intake_items" i
   WHERE v."intake_item_id" = i."id" AND jsonb_typeof(i."payload"->'marks') = 'number' AND (i."payload"->>'marks') ~ '^[1-9][0-9]{0,2}$'
     AND jsonb_array_length(CASE WHEN jsonb_typeof(i."payload"->'parts') = 'array' THEN i."payload"->'parts' ELSE '[]'::jsonb END) = 0;
  GET DIAGNOSTICS n_marks = ROW_COUNT;

  RAISE NOTICE '0105 backfill: last_editor=ai on % versions, declared_marks set on % versions', n_ai, n_marks;
END $$;

ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_last_editor";
ALTER TABLE "question_versions" VALIDATE CONSTRAINT "ck_question_versions_declared_marks";
