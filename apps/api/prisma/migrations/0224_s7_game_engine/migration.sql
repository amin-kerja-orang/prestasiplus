-- 0224_s7_game_engine (S7-T01 part 1): the game engine schema and the settings rows every game reads.
--   DM-60: `battles.counts_for_ranking` (false for a robot battle); nullable `battle_participants.user_id` (a robot has none).
--          With the columns 48 GAME-01 needs (ruling 5 on #497, no new DM id): `battles.round_started_at` (48 3.3); `question_count`
--          on `battles`, `battle_queues` and `battle_invitations` (the chips 5, 10, 15, 20; every existing row drew 10);
--          `battle_participants.last_polled_at` and `consecutive_timeouts` (absent player, forfeit); `cancelled` in
--          `ck_battle_queues_status` and `ck_battle_invitations_status` (a battle is never `cancelled`: `BATTLE_STATUSES` is kept);
--          nullable `battle_answers.user_id`, with one robot answer per battle and position in a partial unique index (NULLs do not
--          collide in `uq_battle_answers_battle_id_user_id_position`, which still protects every human answer); position, answered
--          and correct up to 20 (the largest chip); `option_id` 0..7 (48 3.2: an MCQ has 2-8 options).
--   DM-64: `spin_segments` with the 8 rows of 48 GAME-14.
--   DM-38: `ck_gamification_settings_key` allows the ten existing keys plus every key of 48 section 2, and one row
--          (BM label, default) is inserted for every key of 48 section 2 that is not stored in `reward_settings`.
-- The four `reward_settings` keys (flat_quiz_reward, games_award_syiling, reward_budget_sen_session, current_session_year,
-- DM-48) stay in the check and out of the INSERT, so this file works whether or not they have been moved.
-- The rows of 48 section 2 named `tier`, mystery prize and `spin_segments` are table rows, not keys.
-- `boardgame_quiz_tiles` stays in `game_settings` and is not a key here (ruling 5 on #499).
-- `game_enabled_<game_key>`, default 1: one per game on the hub, with its hub name as the label (D-G, ruling 2 on #499).
--
-- Additive (expand only): nothing is removed, existing battles count for ranking, and every existing row is valid.
-- Reversible, in this order (assumes no robot participant, robot answer, cancelled queue entry or invitation, battle over 10 questions, answer on an option past the fourth, or row with a new key needs keeping):
--   DELETE FROM "gamification_settings" WHERE "key" NOT IN ('coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled', 'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling');
--   ALTER TABLE "gamification_settings" DROP CONSTRAINT "ck_gamification_settings_key";
--   ALTER TABLE "gamification_settings" ADD CONSTRAINT "ck_gamification_settings_key" CHECK ("key" IN ('coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled', 'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling'));
--   DROP TABLE "spin_segments";
--   DELETE FROM "battle_participants" WHERE "user_id" IS NULL;
--   ALTER TABLE "battle_participants" ALTER COLUMN "user_id" SET NOT NULL;
--   ALTER TABLE "battles" DROP COLUMN "counts_for_ranking";
--   DROP INDEX "uq_battle_answers_robot_battle_id_position";
--   DELETE FROM "battle_answers" WHERE "user_id" IS NULL;
--   ALTER TABLE "battle_answers" ALTER COLUMN "user_id" SET NOT NULL;
--   DELETE FROM "battle_queues" WHERE "status" = 'cancelled';
--   ALTER TABLE "battle_queues" DROP CONSTRAINT "ck_battle_queues_status";
--   ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_status" CHECK ("status" IN ('waiting', 'incoming_challenge', 'matched', 'expired', 'abandoned'));
--   DELETE FROM "battle_invitations" WHERE "status" = 'cancelled';
--   ALTER TABLE "battle_invitations" DROP CONSTRAINT "ck_battle_invitations_status";
--   ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_status" CHECK ("status" IN ('pending', 'accepted', 'declined', 'expired'));
--   DELETE FROM "battles" WHERE "question_count" > 10 OR "answered" > 10;
--   DELETE FROM "battle_participants" WHERE "correct" > 10;
--   DELETE FROM "battle_questions" WHERE "position" > 10;
--   DELETE FROM "battle_answers" WHERE "position" > 10 OR "option_id" > 3;
--   ALTER TABLE "battles" DROP CONSTRAINT "ck_battles_answered";
--   ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_answered" CHECK ("answered" BETWEEN 0 AND 10);
--   ALTER TABLE "battle_participants" DROP CONSTRAINT "ck_battle_participants_correct";
--   ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_correct" CHECK ("correct" BETWEEN 0 AND 10);
--   ALTER TABLE "battle_questions" DROP CONSTRAINT "ck_battle_questions_position";
--   ALTER TABLE "battle_questions" ADD CONSTRAINT "ck_battle_questions_position" CHECK ("position" BETWEEN 1 AND 10);
--   ALTER TABLE "battle_answers" DROP CONSTRAINT "ck_battle_answers_position";
--   ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_position" CHECK ("position" BETWEEN 1 AND 10);
--   ALTER TABLE "battle_answers" DROP CONSTRAINT "ck_battle_answers_option_id";
--   ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_option_id" CHECK ("option_id" IS NULL OR "option_id" BETWEEN 0 AND 3);
--   ALTER TABLE "battle_participants" DROP COLUMN "consecutive_timeouts";
--   ALTER TABLE "battle_participants" DROP COLUMN "last_polled_at";
--   ALTER TABLE "battle_invitations" DROP COLUMN "question_count";
--   ALTER TABLE "battle_queues" DROP COLUMN "question_count";
--   ALTER TABLE "battles" DROP COLUMN "question_count";
--   ALTER TABLE "battles" DROP COLUMN "round_started_at";

-- DM-60
ALTER TABLE "battles" ADD COLUMN "counts_for_ranking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "battle_participants" ALTER COLUMN "user_id" DROP NOT NULL;

-- DM-60, the columns of 48 GAME-01 (ruling 5 on #497)
ALTER TABLE "battles" ADD COLUMN "round_started_at" TIMESTAMPTZ(6);
ALTER TABLE "battles" ADD COLUMN "question_count" SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_question_count" CHECK ("question_count" IN (5, 10, 15, 20));
ALTER TABLE "battle_queues" ADD COLUMN "question_count" SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_question_count" CHECK ("question_count" IN (5, 10, 15, 20));
ALTER TABLE "battle_invitations" ADD COLUMN "question_count" SMALLINT NOT NULL DEFAULT 10;
ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_question_count" CHECK ("question_count" IN (5, 10, 15, 20));
ALTER TABLE "battle_participants" ADD COLUMN "last_polled_at" TIMESTAMPTZ(6);
ALTER TABLE "battle_participants" ADD COLUMN "consecutive_timeouts" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_consecutive_timeouts" CHECK ("consecutive_timeouts" >= 0);
ALTER TABLE "battle_queues" DROP CONSTRAINT "ck_battle_queues_status";
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_status" CHECK ("status" IN ('waiting', 'incoming_challenge', 'matched', 'expired', 'abandoned', 'cancelled'));
ALTER TABLE "battle_invitations" DROP CONSTRAINT "ck_battle_invitations_status";
ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_status" CHECK ("status" IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));
ALTER TABLE "battle_answers" ALTER COLUMN "user_id" DROP NOT NULL;
CREATE UNIQUE INDEX "uq_battle_answers_robot_battle_id_position" ON "battle_answers"("battle_id", "position") WHERE "user_id" IS NULL;
ALTER TABLE "battles" DROP CONSTRAINT "ck_battles_answered";
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_answered" CHECK ("answered" BETWEEN 0 AND 20);
ALTER TABLE "battle_participants" DROP CONSTRAINT "ck_battle_participants_correct";
ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_correct" CHECK ("correct" BETWEEN 0 AND 20);
ALTER TABLE "battle_questions" DROP CONSTRAINT "ck_battle_questions_position";
ALTER TABLE "battle_questions" ADD CONSTRAINT "ck_battle_questions_position" CHECK ("position" BETWEEN 1 AND 20);
ALTER TABLE "battle_answers" DROP CONSTRAINT "ck_battle_answers_position";
ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_position" CHECK ("position" BETWEEN 1 AND 20);
ALTER TABLE "battle_answers" DROP CONSTRAINT "ck_battle_answers_option_id";
ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_option_id" CHECK ("option_id" IS NULL OR "option_id" BETWEEN 0 AND 7);

-- DM-64
CREATE TABLE "spin_segments" (
    "position" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "syiling" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "spin_segments_pkey" PRIMARY KEY ("position"),
    CONSTRAINT "ck_spin_segments_position" CHECK ("position" BETWEEN 1 AND 8),
    CONSTRAINT "ck_spin_segments_label" CHECK (char_length("label") BETWEEN 1 AND 20),
    CONSTRAINT "ck_spin_segments_syiling" CHECK ("syiling" BETWEEN 0 AND 100),
    CONSTRAINT "ck_spin_segments_weight" CHECK ("weight" BETWEEN 0 AND 100)
);

INSERT INTO "spin_segments" ("position", "label", "syiling", "weight") VALUES
    (1, '1 Syiling', 1, 25),
    (2, '3 Syiling', 3, 20),
    (3, '5 Syiling', 5, 15),
    (4, '10 Syiling', 10, 8),
    (5, '20 Syiling', 20, 3),
    (6, 'Cuba Lagi', 0, 15),
    (7, '2 Syiling', 2, 10),
    (8, '7 Syiling', 7, 4)
ON CONFLICT ("position") DO NOTHING;

-- DM-38
ALTER TABLE "gamification_settings" DROP CONSTRAINT "ck_gamification_settings_key";
ALTER TABLE "gamification_settings" ADD CONSTRAINT "ck_gamification_settings_key" CHECK ("key" IN (
    'coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled',
    'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling',
    'xp_per_correct', 'xp_level_size', 'games_daily_syiling_cap', 'games_daily_xp_cap', 'game_win_xp', 'game_draw_xp', 'game_play_xp',
    'game_win_bonus_syiling', 'games_min_ms_per_answer', 'jutawan_min_ms_per_answer', 'jutawan_question_seconds',
    'battle_questions_default', 'battle_question_seconds', 'battle_grace_seconds', 'battle_queue_seconds',
    'battle_bot_fallback_seconds', 'battle_bot_accuracy_pct', 'battle_invitation_hours', 'battle_daily_max',
    'games_room_bots_enabled', 'games_absent_seconds', 'room_waiting_minutes',
    'challenge_accuracy_min_questions', 'daily_login_syiling', 'spm_first_session_syiling',
    'mystery_box_cost', 'mystery_box_daily_max', 'draw_max_tickets_per_pupil',
    'referral_referrer_syiling', 'referral_referee_syiling', 'referral_max_rewarded', 'mission_reward_max',
    'sekolah_bersaing_min_pupils', 'sekolah_bersaing_top_n',
    'game_enabled_papan-bijak', 'game_enabled_battle', 'game_enabled_perang-fakta', 'game_enabled_benteng-ilmu',
    'game_enabled_perlumbaan-matematik', 'game_enabled_kuiz-relay', 'game_enabled_teka-silang-kata', 'game_enabled_betul-salah',
    'game_enabled_cabaran-kilat', 'game_enabled_tembak-jawapan', 'game_enabled_susun-jawapan', 'game_enabled_sambung-kata',
    'game_enabled_kad-memori', 'game_enabled_jutawan', 'game_enabled_roda-nasib'));

INSERT INTO "gamification_settings" ("key", "value", "label") VALUES
    ('xp_per_correct', 10, 'Mata (XP) setiap jawapan betul'),
    ('xp_level_size', 1000, 'Saiz tahap (mata)'),
    ('games_daily_syiling_cap', 100, 'Had syiling permainan sehari'),
    ('games_daily_xp_cap', 500, 'Had mata permainan sehari'),
    ('game_win_xp', 20, 'Mata untuk menang'),
    ('game_draw_xp', 10, 'Mata untuk seri'),
    ('game_play_xp', 5, 'Mata untuk bermain'),
    ('game_win_bonus_syiling', 5, 'Bonus syiling untuk menang'),
    ('games_min_ms_per_answer', 1000, 'Masa minimum setiap jawapan (ms)'),
    ('jutawan_min_ms_per_answer', 2000, 'Masa minimum setiap jawapan Jutawan (ms)'),
    ('jutawan_question_seconds', 60, 'Masa setiap soalan Jutawan (saat)'),
    ('battle_questions_default', 10, 'Bilangan soalan Battle (lalai)'),
    ('battle_question_seconds', 15, 'Masa setiap soalan Battle (saat)'),
    ('battle_grace_seconds', 3, 'Masa tambahan Battle (saat)'),
    ('battle_queue_seconds', 120, 'Tempoh menunggu lawan (saat)'),
    ('battle_bot_fallback_seconds', 30, 'Saat sebelum Robot PrestasiPlus'),
    ('battle_bot_accuracy_pct', 60, 'Ketepatan Robot PrestasiPlus (%)'),
    ('battle_invitation_hours', 24, 'Tempoh cabaran kawan (jam)'),
    ('battle_daily_max', 20, 'Had Battle sehari'),
    ('games_room_bots_enabled', 1, 'Robot dalam bilik permainan'),
    ('games_absent_seconds', 30, 'Saat sebelum pemain dianggap tiada'),
    ('room_waiting_minutes', 15, 'Tempoh bilik menunggu (minit)'),
    ('challenge_accuracy_min_questions', 5, 'Soalan minimum untuk cabaran ketepatan'),
    ('daily_login_syiling', 2, 'Syiling log masuk harian'),
    ('spm_first_session_syiling', 7, 'Syiling sesi SPM pertama sehari'),
    ('mystery_box_cost', 50, 'Kos satu kotak (syiling)'),
    ('mystery_box_daily_max', 5, 'Had kotak sehari'),
    ('draw_max_tickets_per_pupil', 10, 'Max tiket / pelajar'),
    ('referral_referrer_syiling', 100, 'Syiling untuk pemberi rujukan'),
    ('referral_referee_syiling', 0, 'Syiling untuk kawan yang dirujuk'),
    ('referral_max_rewarded', 20, 'Had kawan berganjaran setiap pelajar'),
    ('mission_reward_max', 100, 'Had ganjaran misi (syiling)'),
    ('sekolah_bersaing_min_pupils', 1, 'Pelajar minimum setiap sekolah'),
    ('sekolah_bersaing_top_n', 30, 'Bilangan sekolah dipaparkan'),
    ('game_enabled_papan-bijak', 1, 'Papan Bijak'),
    ('game_enabled_battle', 1, 'Battle Arena'),
    ('game_enabled_perang-fakta', 1, 'Perang Fakta'),
    ('game_enabled_benteng-ilmu', 1, 'Benteng Ilmu'),
    ('game_enabled_perlumbaan-matematik', 1, 'Perlumbaan Matematik'),
    ('game_enabled_kuiz-relay', 1, 'Kuiz Relay'),
    ('game_enabled_teka-silang-kata', 1, 'Teka Silang Kata'),
    ('game_enabled_betul-salah', 1, 'Betul atau Salah'),
    ('game_enabled_cabaran-kilat', 1, 'Cabaran Kilat'),
    ('game_enabled_tembak-jawapan', 1, 'Tembak Jawapan'),
    ('game_enabled_susun-jawapan', 1, 'Susun Jawapan'),
    ('game_enabled_sambung-kata', 1, 'Sambung Kata'),
    ('game_enabled_kad-memori', 1, 'Kad Memori'),
    ('game_enabled_jutawan', 1, 'Jutawan Ilmu'),
    ('game_enabled_roda-nasib', 1, 'Roda Nasib')
ON CONFLICT ("key") DO NOTHING;
