-- 0225_s7_league_tournament (S7-T06; DM-61, DM-62, and rulings 2 and 4 of the team-aa lead on issue 504, FR-GM-15.*):
--   tournament rounds, entries and round scores; `tournaments.start_date` and `rounds`; `ck_tournaments_status` gains `cancelled`;
--   `league_standings.recomputed_at`, `leagues.frozen_at`; the new `league_contributions` ("Penyumbang", written by the hourly job).
-- The three old tournament columns `time_window_minutes`, `top_n_scoring`, `min_participants` become nullable: R1 does not use them (their
-- range checks stay and pass for NULL). League statuses upcoming|active|ended are derived by date, so `ck_leagues_status` is not touched.
-- `ck_tournaments_format` is not touched: it stays wide (`knockout` and `hybrid` remain stored values; the API narrows them, not the table).
--
-- Additive (expand only): no row is dropped or rewritten, no backfill, no value changes. The status check only gets one more allowed
-- value, so every existing row still satisfies it. Every new column on an existing table is nullable.
-- Reversible, in this order (a rollback loses only rows written after the deploy):
--   DROP TABLE "league_contributions", "tournament_round_scores", "tournament_entries", "tournament_rounds";
--   ALTER TABLE "league_standings" DROP COLUMN "recomputed_at"; ALTER TABLE "leagues" DROP COLUMN "frozen_at";
--   ALTER TABLE "tournaments" DROP COLUMN "start_date", DROP COLUMN "rounds";
--   restore ck_tournaments_status to ('draft','registration','ongoing','completed') only if no row is `cancelled` (else move them first);
--   SET NOT NULL on the three columns only if no row holds NULL (else give them the old defaults 60, 10, 1 first).
--   then `prisma migrate resolve --rolled-back 0225_s7_league_tournament`, or a later deploy skips this file.

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN "start_date" DATE;
ALTER TABLE "tournaments" ADD COLUMN "rounds" SMALLINT;
ALTER TABLE "tournaments" ALTER COLUMN "time_window_minutes" DROP NOT NULL;
ALTER TABLE "tournaments" ALTER COLUMN "top_n_scoring" DROP NOT NULL;
ALTER TABLE "tournaments" ALTER COLUMN "min_participants" DROP NOT NULL;
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_rounds" CHECK ("rounds" IS NULL OR "rounds" BETWEEN 1 AND 10);

-- Replace ck_tournaments_status (0027_battle): the same four values plus `cancelled` (widening).
ALTER TABLE "tournaments" DROP CONSTRAINT "ck_tournaments_status";
ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_status" CHECK ("status" IN ('draft', 'registration', 'ongoing', 'completed', 'cancelled')) NOT VALID;
ALTER TABLE "tournaments" VALIDATE CONSTRAINT "ck_tournaments_status";

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN "frozen_at" TIMESTAMPTZ(6);
ALTER TABLE "league_standings" ADD COLUMN "recomputed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "tournament_rounds" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "tournament_id" UUID NOT NULL,
    "n" SMALLINT NOT NULL,
    "opens_at" TIMESTAMPTZ(6) NOT NULL,
    "closes_at" TIMESTAMPTZ(6) NOT NULL,
    "question_ids" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],

    CONSTRAINT "tournament_rounds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_tournament_rounds_n" CHECK ("n" BETWEEN 1 AND 10),
    CONSTRAINT "ck_tournament_rounds_window" CHECK ("closes_at" > "opens_at")
);

-- CreateTable
CREATE TABLE "tournament_entries" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "tournament_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "school_id" BIGINT,
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- `attempt_id` is the answer-store attempt_id of the round (part_ref `tournament#<position>`, API-GAME-12).
CREATE TABLE "tournament_round_scores" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "round_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct" SMALLINT NOT NULL DEFAULT 0,
    "answered" SMALLINT NOT NULL DEFAULT 0,
    "total_ms" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "attempt_id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "tournament_round_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_tournament_round_scores_score" CHECK ("score" >= 0),
    CONSTRAINT "ck_tournament_round_scores_answered" CHECK ("correct" >= 0 AND "answered" >= "correct"),
    CONSTRAINT "ck_tournament_round_scores_total_ms" CHECK ("total_ms" >= 0)
);

-- CreateTable
CREATE TABLE "league_contributions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "league_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "league_contributions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_league_contributions_points" CHECK ("points" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tournament_rounds_tournament_id_n" ON "tournament_rounds"("tournament_id", "n");
CREATE UNIQUE INDEX "uq_tournament_entries_tournament_id_user_id" ON "tournament_entries"("tournament_id", "user_id");
CREATE INDEX "ix_tournament_entries_user_id" ON "tournament_entries"("user_id");
CREATE INDEX "ix_tournament_entries_school_id" ON "tournament_entries"("school_id");
CREATE UNIQUE INDEX "uq_tournament_round_scores_round_id_user_id" ON "tournament_round_scores"("round_id", "user_id");
CREATE UNIQUE INDEX "uq_tournament_round_scores_attempt_id" ON "tournament_round_scores"("attempt_id");
CREATE INDEX "ix_tournament_round_scores_user_id" ON "tournament_round_scores"("user_id");
CREATE UNIQUE INDEX "uq_league_contributions_league_id_user_id" ON "league_contributions"("league_id", "user_id");
CREATE INDEX "ix_league_contributions_league_id_school_id" ON "league_contributions"("league_id", "school_id");
CREATE INDEX "ix_league_contributions_school_id" ON "league_contributions"("school_id");
CREATE INDEX "ix_league_contributions_user_id" ON "league_contributions"("user_id");

-- AddForeignKey
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "fk_tournament_rounds_tournament_id" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_entries" ADD CONSTRAINT "fk_tournament_entries_tournament_id" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_entries" ADD CONSTRAINT "fk_tournament_entries_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_entries" ADD CONSTRAINT "fk_tournament_entries_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_round_scores" ADD CONSTRAINT "fk_tournament_round_scores_round_id" FOREIGN KEY ("round_id") REFERENCES "tournament_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_round_scores" ADD CONSTRAINT "fk_tournament_round_scores_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_contributions" ADD CONSTRAINT "fk_league_contributions_league_id" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_contributions" ADD CONSTRAINT "fk_league_contributions_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_contributions" ADD CONSTRAINT "fk_league_contributions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
