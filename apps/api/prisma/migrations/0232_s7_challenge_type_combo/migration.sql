-- 0232_s7_challenge_type_combo (S7-T04, DM-81, FR-ADM-P2-03.3): challenge type `combo` with metric `best_combo`, the longest run of correct
-- answers in one session today (ruling 4 on #500: both checks widen). Nothing selects it yet: `combo` stays closed in admin until its evaluator exists.
-- Additive (expand only): both checks only gain a value, and every existing row stays valid.
-- Reversible: move any row with type `combo` or metric `best_combo` off them, then re-create both checks with the lists of 0019_gamification_shop.

-- AlterTable
ALTER TABLE "challenges" DROP CONSTRAINT "ck_challenges_challenge_type";
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_challenge_type" CHECK ("challenge_type" IN ('quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent', 'combo'));
ALTER TABLE "challenges" DROP CONSTRAINT "ck_challenges_metric";
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_metric" CHECK ("metric" IS NULL OR "metric" IN ('sessions', 'correct', 'best_accuracy', 'best_correct_in_session', 'chapters', 'minutes', 'streak', 'best_combo'));
