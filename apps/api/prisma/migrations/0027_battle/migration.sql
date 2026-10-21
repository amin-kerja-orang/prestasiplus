-- 0027_battle (BE-44): battles, battle_participants, battle_questions, battle_answers, battle_queues,
-- battle_invitations, tournaments, tournament_subjects (M16 battle part).
-- Number 0027 is a placeholder ("renumber-at-merge, LEAD to confirm"). Hand-written in the style of `prisma migrate diff`
-- output: identity columns (GENERATED ALWAYS), CHECK constraints (enums are text + check), and the foreign keys to tables
-- of other owners (users, schools, subjects, education_levels, questions), which battle.prisma does not declare as relations.
-- Plan 14.2, 14.9. Only battles and battle_participants carry the LEG columns.

-- CreateTable
CREATE TABLE "battles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mode" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "subject_id" BIGINT,
    "pksk_domain_id" BIGINT,
    "pksk_target_level" TEXT,
    "level_id" BIGINT,
    "answered" SMALLINT NOT NULL DEFAULT 0,
    "winner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "finished_at" TIMESTAMPTZ(6),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    "legacy_hash" TEXT,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_participants" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "battle_id" UUID NOT NULL,
    "side" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "school_id" BIGINT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct" SMALLINT NOT NULL DEFAULT 0,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "battle_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_questions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "battle_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" BIGINT NOT NULL,

    CONSTRAINT "battle_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_answers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "battle_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "option_id" SMALLINT,
    "correct" BOOLEAN NOT NULL,
    "seconds" SMALLINT NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_queues" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "mode" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "subject_id" BIGINT,
    "pksk_domain_id" BIGINT,
    "pksk_target_level" TEXT,
    "open_to_all" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "challenger_user_id" BIGINT,
    "battle_id" UUID,
    "polls" INTEGER NOT NULL DEFAULT 0,
    "wait_polls" INTEGER NOT NULL DEFAULT 0,
    "last_polled_at" TIMESTAMPTZ(6),
    "joiner_user_id" BIGINT,
    "joiner_outcome" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_id" BIGINT NOT NULL,
    "receiver_id" BIGINT NOT NULL,
    "question_type" TEXT NOT NULL,
    "subject_id" BIGINT,
    "pksk_domain_id" BIGINT,
    "pksk_target_level" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "education_level_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "groups_count" SMALLINT,
    "question_mode" TEXT NOT NULL,
    "subject_id" BIGINT,
    "exam_paper_id" BIGINT,
    "total_questions" SMALLINT NOT NULL,
    "time_window_minutes" SMALLINT NOT NULL,
    "top_n_scoring" SMALLINT NOT NULL,
    "min_participants" SMALLINT NOT NULL,
    "registration_opens_at" TIMESTAMPTZ(6),
    "registration_closes_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" BIGINT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_subjects" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "tournament_id" UUID NOT NULL,
    "subject_id" BIGINT NOT NULL,

    CONSTRAINT "tournament_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_battles_legacy" ON "battles"("legacy_source", "legacy_id");
CREATE INDEX "ix_battles_status_created_at" ON "battles"("status", "created_at");
CREATE UNIQUE INDEX "uq_battle_participants_battle_id_side" ON "battle_participants"("battle_id", "side");
CREATE UNIQUE INDEX "uq_battle_participants_legacy" ON "battle_participants"("legacy_source", "legacy_id");
CREATE INDEX "ix_battle_participants_user_id" ON "battle_participants"("user_id");
CREATE INDEX "ix_battle_participants_school_id" ON "battle_participants"("school_id");
CREATE UNIQUE INDEX "uq_battle_questions_battle_id_position" ON "battle_questions"("battle_id", "position");
CREATE UNIQUE INDEX "uq_battle_answers_battle_id_user_id_position" ON "battle_answers"("battle_id", "user_id", "position");
CREATE INDEX "ix_battle_queues_owner_id" ON "battle_queues"("owner_id");
CREATE INDEX "ix_battle_invitations_receiver_id_status" ON "battle_invitations"("receiver_id", "status");
CREATE INDEX "ix_tournaments_status_registration_opens_at" ON "tournaments"("status", "registration_opens_at");
CREATE UNIQUE INDEX "uq_tournament_subjects_tournament_id_subject_id" ON "tournament_subjects"("tournament_id", "subject_id");

-- AddForeignKey (own tables)
ALTER TABLE "battle_participants" ADD CONSTRAINT "fk_battle_participants_battle_id" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_questions" ADD CONSTRAINT "fk_battle_questions_battle_id" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_answers" ADD CONSTRAINT "fk_battle_answers_battle_id" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_queues" ADD CONSTRAINT "fk_battle_queues_battle_id" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_subjects" ADD CONSTRAINT "fk_tournament_subjects_tournament_id" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys to tables of other owners (not Prisma relations, see battle.prisma).
-- A deleted pupil leaves the battle history (the participant and answer rows go with the user); a school, subject or level in use cannot be deleted
-- unless the column is optional history (SET NULL).
ALTER TABLE "battles" ADD CONSTRAINT "fk_battles_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "fk_battles_level_id" FOREIGN KEY ("level_id") REFERENCES "education_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_participants" ADD CONSTRAINT "fk_battle_participants_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_participants" ADD CONSTRAINT "fk_battle_participants_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_questions" ADD CONSTRAINT "fk_battle_questions_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "battle_answers" ADD CONSTRAINT "fk_battle_answers_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_answers" ADD CONSTRAINT "fk_battle_answers_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "battle_queues" ADD CONSTRAINT "fk_battle_queues_owner_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_queues" ADD CONSTRAINT "fk_battle_queues_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_queues" ADD CONSTRAINT "fk_battle_queues_challenger_user_id" FOREIGN KEY ("challenger_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_queues" ADD CONSTRAINT "fk_battle_queues_joiner_user_id" FOREIGN KEY ("joiner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_invitations" ADD CONSTRAINT "fk_battle_invitations_sender_id" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_invitations" ADD CONSTRAINT "fk_battle_invitations_receiver_id" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_invitations" ADD CONSTRAINT "fk_battle_invitations_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournaments" ADD CONSTRAINT "fk_tournaments_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournaments" ADD CONSTRAINT "fk_tournaments_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tournament_subjects" ADD CONSTRAINT "fk_tournament_subjects_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on every table that carries the pair. NULL passes a CHECK.
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract battle schema).
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_mode" CHECK ("mode" IN ('quick_match', 'school_battle', 'challenge', 'queue_join'));
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_question_type" CHECK ("question_type" IN ('biasa', 'pksk', 'spm'));
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_pksk_target_level" CHECK ("pksk_target_level" IN ('T1', 'T4'));
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_winner" CHECK ("winner" IN ('A', 'B'));
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_status" CHECK ("status" IN ('active', 'finished', 'forfeited', 'abandoned'));
ALTER TABLE "battles" ADD CONSTRAINT "ck_battles_answered" CHECK ("answered" BETWEEN 0 AND 10);
ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_side" CHECK ("side" IN ('A', 'B'));
ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_score" CHECK ("score" >= 0);
ALTER TABLE "battle_participants" ADD CONSTRAINT "ck_battle_participants_correct" CHECK ("correct" BETWEEN 0 AND 10);
ALTER TABLE "battle_questions" ADD CONSTRAINT "ck_battle_questions_position" CHECK ("position" BETWEEN 1 AND 10);
ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_position" CHECK ("position" BETWEEN 1 AND 10);
ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_option_id" CHECK ("option_id" IS NULL OR "option_id" BETWEEN 0 AND 3);
ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_seconds" CHECK ("seconds" BETWEEN 0 AND 15);
ALTER TABLE "battle_answers" ADD CONSTRAINT "ck_battle_answers_points" CHECK ("points" >= 0);
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_mode" CHECK ("mode" IN ('quick_match', 'school_battle'));
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_question_type" CHECK ("question_type" IN ('biasa', 'pksk', 'spm'));
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_pksk_target_level" CHECK ("pksk_target_level" IN ('T1', 'T4'));
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_status" CHECK ("status" IN ('waiting', 'incoming_challenge', 'matched', 'expired', 'abandoned'));
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_joiner_outcome" CHECK ("joiner_outcome" IN ('pending', 'matched', 'rejected', 'expired'));
ALTER TABLE "battle_queues" ADD CONSTRAINT "ck_battle_queues_polls" CHECK ("polls" >= 0 AND "wait_polls" >= 0);
ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_question_type" CHECK ("question_type" IN ('biasa', 'pksk', 'spm'));
ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_pksk_target_level" CHECK ("pksk_target_level" IN ('T1', 'T4'));
ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_status" CHECK ("status" IN ('pending', 'accepted', 'declined', 'expired'));
ALTER TABLE "battle_invitations" ADD CONSTRAINT "ck_battle_invitations_parties" CHECK ("sender_id" <> "receiver_id");
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_title" CHECK (char_length(btrim("title")) BETWEEN 1 AND 255);
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_education_level_id" CHECK ("education_level_id" IN ('tingkatan4', 'tingkatan5', 'spm'));
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_format" CHECK ("format" IN ('single_match', 'knockout', 'league', 'hybrid'));
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_groups_count" CHECK ("groups_count" IS NULL OR "groups_count" BETWEEN 2 AND 8);
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_question_mode" CHECK ("question_mode" IN ('subject', 'exam_paper', 'random_mix'));
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_total_questions" CHECK ("total_questions" BETWEEN 5 AND 100);
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_time_window_minutes" CHECK ("time_window_minutes" BETWEEN 10 AND 180);
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_top_n_scoring" CHECK ("top_n_scoring" BETWEEN 1 AND 50);
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_min_participants" CHECK ("min_participants" BETWEEN 1 AND 100);
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_status" CHECK ("status" IN ('draft', 'registration', 'ongoing', 'completed'));
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_registration_window" CHECK ("registration_opens_at" IS NULL OR "registration_closes_at" IS NULL OR "registration_closes_at" > "registration_opens_at");
