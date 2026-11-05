-- 0129_s1_stimulus_caption_en (S1-T09b, DM-50, FR-QA-17): the English twin of the stimulus caption.
-- `stem_en`, `stimuli.body_en` and the option `body_en` columns exist since 0011; only `caption_en` is new.
-- Additive, nullable, no backfill, no CHECK change (`ck_question_versions_language` already allows ms, en, ms_en, ar, jawi).
-- Reversible: ALTER TABLE "stimuli" DROP COLUMN "caption_en".

-- AlterTable
ALTER TABLE "stimuli" ADD COLUMN "caption_en" TEXT;
