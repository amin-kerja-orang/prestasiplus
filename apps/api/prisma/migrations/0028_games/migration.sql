-- 0028_games (BE-45, owner module M16 part 2: games hub, room games, solo games, Roda Nasib, Jutawan Ilmu,
-- leagues, Sekolah Bersaing, game settings). PROPOSED NUMBER: renumber at merge, LEAD to confirm.
-- Hand-written in the style of 0014: identity columns (GENERATED ALWAYS), CHECK constraints (enums are text +
-- check, English codes), explicit constraint and index names.
--
-- Foreign keys point only at tables on the base: users, schools, subjects, questions (plus this migration's own
-- tables). ON DELETE: users CASCADE (a pupil's own game data goes with the account); curriculum / questions
-- parents of served items CASCADE (items go with the question); optional dimensions SET NULL.
-- legacy_source / legacy_id (+ unique + check) only on game_rooms, game_room_players and game_sessions: the only
-- tables that may receive migrated .cloud rows (BE-45 card, Migration-first).
-- G-11 exception: game_rooms.state is the transient room engine document (written whole, never queried);
-- game_rooms.result is the settled result snapshot (written once with settled_at, settle-once guard).
-- D58a: game_session_items and the extra game_sessions columns hold the server-side checks of the solo games
-- (keyless payloads; the server computes score, streak, combo, level and coins at submit from stored checks).
--
-- Reversible: DROP TABLE sekolah_bersaing_weeks, league_standings, league_schools, league_class_levels, leagues,
-- game_settings, pb_searches, spin_stats, spins, jutawan_stats, personal_bests, game_session_items,
-- game_sessions, game_standings, game_room_players, game_rooms CASCADE.

-- CreateTable
CREATE TABLE "game_rooms" (
    "code" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade_level" TEXT NOT NULL,
    "match_mode" TEXT NOT NULL,
    "grade_min" SMALLINT,
    "grade_max" SMALLINT,
    "max_players" SMALLINT NOT NULL,
    "host_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "state" JSONB,
    "result" JSONB,
    "settled_at" TIMESTAMPTZ(6),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    CONSTRAINT "game_rooms_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "ck_game_rooms_code" CHECK ("code" ~ '^[A-Z0-9]{6}$'),
    CONSTRAINT "ck_game_rooms_game" CHECK ("game" IN ('papan-bijak','perang-fakta','benteng-ilmu','perlumbaan-matematik','kuiz-relay','teka-silang-kata')),
    CONSTRAINT "ck_game_rooms_subject" CHECK ("subject" IN ('MATEMATIK','BAHASA_MELAYU','BAHASA_INGGERIS','SAINS','SEJARAH')),
    CONSTRAINT "ck_game_rooms_grade_level" CHECK ("grade_level" IN ('DARJAH_1','DARJAH_2','DARJAH_3','DARJAH_4','DARJAH_5','DARJAH_6','TINGKATAN_1','TINGKATAN_2','TINGKATAN_3','TINGKATAN_4','TINGKATAN_5')),
    CONSTRAINT "ck_game_rooms_match_mode" CHECK ("match_mode" IN ('same_grade','same_level','custom')),
    CONSTRAINT "ck_game_rooms_grade_range" CHECK (("grade_min" IS NULL OR "grade_min" BETWEEN 1 AND 11) AND ("grade_max" IS NULL OR "grade_max" BETWEEN 1 AND 11) AND ("grade_min" IS NULL OR "grade_max" IS NULL OR "grade_min" <= "grade_max")),
    CONSTRAINT "ck_game_rooms_max_players" CHECK ("max_players" BETWEEN 2 AND 8),
    CONSTRAINT "ck_game_rooms_status" CHECK ("status" IN ('waiting','playing','finished','closed')),
    CONSTRAINT "ck_game_rooms_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);
CREATE UNIQUE INDEX "uq_game_rooms_legacy" ON "game_rooms"("legacy_source", "legacy_id");
CREATE INDEX "ix_game_rooms_status_created_at" ON "game_rooms"("status", "created_at");
CREATE INDEX "ix_game_rooms_host_id" ON "game_rooms"("host_id");

-- CreateTable
CREATE TABLE "game_room_players" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "room_code" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "team" SMALLINT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "correct" SMALLINT NOT NULL DEFAULT 0,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    CONSTRAINT "game_room_players_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_game_room_players_correct" CHECK ("correct" >= 0),
    CONSTRAINT "ck_game_room_players_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);
CREATE UNIQUE INDEX "uq_game_room_players_room_code_user_id" ON "game_room_players"("room_code", "user_id");
CREATE UNIQUE INDEX "uq_game_room_players_legacy" ON "game_room_players"("legacy_source", "legacy_id");
CREATE INDEX "ix_game_room_players_user_id" ON "game_room_players"("user_id");

-- CreateTable
CREATE TABLE "game_standings" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "game" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "jumlah" INTEGER NOT NULL DEFAULT 0,
    "skor" INTEGER NOT NULL DEFAULT 0,
    "betul" INTEGER NOT NULL DEFAULT 0,
    "reached_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_standings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_game_standings_game" CHECK ("game" IN ('papan-bijak','perang-fakta','benteng-ilmu','perlumbaan-matematik','kuiz-relay','teka-silang-kata')),
    CONSTRAINT "ck_game_standings_counts" CHECK ("wins" >= 0 AND "jumlah" >= 0 AND "skor" >= 0 AND "betul" >= 0)
);
CREATE UNIQUE INDEX "uq_game_standings_game_user_id" ON "game_standings"("game", "user_id");
CREATE INDEX "ix_game_standings_user_id" ON "game_standings"("user_id");

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "game" TEXT NOT NULL,
    "darjah" SMALLINT,
    "item_count" SMALLINT,
    "max_score" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "coins_computed" INTEGER NOT NULL DEFAULT 0,
    "coins_credited" INTEGER NOT NULL DEFAULT 0,
    "is_new_record" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(6),
    -- D58a stored checks (solo games)
    "moves" INTEGER NOT NULL DEFAULT 0,
    "fast_moves" INTEGER NOT NULL DEFAULT 0,
    "open_card_id" TEXT,
    "checks" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    -- Jutawan Ilmu
    "jutawan_subject_id" BIGINT,
    "jutawan_level" SMALLINT,
    "jutawan_lifelines" SMALLINT,
    "jutawan_removed_options" SMALLINT[] NOT NULL DEFAULT ARRAY[]::SMALLINT[],
    "jutawan_over" BOOLEAN NOT NULL DEFAULT false,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_game_sessions_game" CHECK ("game" IN ('betul-salah','cabaran-kilat','tembak-jawapan','susun-jawapan','kad-memori','jutawan')),
    CONSTRAINT "ck_game_sessions_darjah" CHECK ("darjah" IS NULL OR "darjah" BETWEEN 1 AND 11),
    CONSTRAINT "ck_game_sessions_counts" CHECK ("score" >= 0 AND "coins_computed" >= 0 AND "coins_credited" >= 0 AND "moves" >= 0 AND "fast_moves" >= 0 AND "checks" >= 0 AND "correct_count" >= 0),
    CONSTRAINT "ck_game_sessions_jutawan_level" CHECK ("jutawan_level" IS NULL OR "jutawan_level" BETWEEN 0 AND 15),
    CONSTRAINT "ck_game_sessions_jutawan_lifelines" CHECK ("jutawan_lifelines" IS NULL OR "jutawan_lifelines" BETWEEN 0 AND 3),
    CONSTRAINT "ck_game_sessions_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);
CREATE UNIQUE INDEX "uq_game_sessions_legacy" ON "game_sessions"("legacy_source", "legacy_id");
CREATE INDEX "ix_game_sessions_user_id_game" ON "game_sessions"("user_id", "game");
CREATE INDEX "ix_game_sessions_user_id_submitted_at" ON "game_sessions"("user_id", "submitted_at") WHERE "submitted_at" IS NOT NULL;

-- CreateTable
CREATE TABLE "game_session_items" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "session_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    -- Kad Memori (opaque card id, which face of the pair, server-only pair index)
    "card_id" TEXT,
    "face" TEXT,
    "pair_key" SMALLINT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    -- served-item facts needed to check later (key as served, so a later question edit never changes grading)
    "key_index" SMALLINT,
    "statement_true" BOOLEAN,
    "difficulty" SMALLINT,
    "points" SMALLINT,
    -- the stored check (one per item; Kad Memori: the latest pair check naming the card)
    "checked_seq" SMALLINT,
    "correct" BOOLEAN,
    "answer" TEXT,
    "checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_session_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_game_session_items_face" CHECK ("face" IS NULL OR "face" IN ('question','answer')),
    CONSTRAINT "ck_game_session_items_key_index" CHECK ("key_index" IS NULL OR "key_index" BETWEEN 0 AND 3)
);
CREATE UNIQUE INDEX "uq_game_session_items_session_id_position" ON "game_session_items"("session_id", "position");
CREATE UNIQUE INDEX "uq_game_session_items_session_id_card_id" ON "game_session_items"("session_id", "card_id") WHERE "card_id" IS NOT NULL;
CREATE INDEX "ix_game_session_items_question_id" ON "game_session_items"("question_id");

-- CreateTable
CREATE TABLE "personal_bests" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "game" TEXT NOT NULL,
    "best_score" INTEGER NOT NULL DEFAULT 0,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personal_bests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_personal_bests_game" CHECK ("game" IN ('betul-salah','cabaran-kilat','tembak-jawapan','susun-jawapan','kad-memori','jutawan')),
    CONSTRAINT "ck_personal_bests_best_score" CHECK ("best_score" >= 0)
);
CREATE UNIQUE INDEX "uq_personal_bests_user_id_game" ON "personal_bests"("user_id", "game");

-- CreateTable
CREATE TABLE "jutawan_stats" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "best_level" SMALLINT NOT NULL DEFAULT 0,
    "games" INTEGER NOT NULL DEFAULT 0,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "jutawan_stats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_jutawan_stats_best_level" CHECK ("best_level" BETWEEN 0 AND 15),
    CONSTRAINT "ck_jutawan_stats_games" CHECK ("games" >= 0)
);
CREATE UNIQUE INDEX "uq_jutawan_stats_user_id" ON "jutawan_stats"("user_id");

-- CreateTable
CREATE TABLE "spins" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "spin_date" DATE NOT NULL,
    "segment_index" SMALLINT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "credited" INTEGER NOT NULL DEFAULT 0,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spins_segment_index" CHECK ("segment_index" BETWEEN 0 AND 7),
    CONSTRAINT "ck_spins_type" CHECK ("type" IN ('syiling','nothing')),
    CONSTRAINT "ck_spins_amounts" CHECK ("value" >= 0 AND "credited" >= 0)
);
CREATE UNIQUE INDEX "uq_spins_user_id_spin_date" ON "spins"("user_id", "spin_date");

-- CreateTable
CREATE TABLE "spin_stats" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "spins" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "last_spin_date" DATE,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "spin_stats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spin_stats_counts" CHECK ("spins" >= 0 AND "won" >= 0)
);
CREATE UNIQUE INDEX "uq_spin_stats_user_id" ON "spin_stats"("user_id");

-- CreateTable
CREATE TABLE "pb_searches" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "subject" TEXT NOT NULL,
    "match_mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'searching',
    "polls" INTEGER NOT NULL DEFAULT 0,
    "room_code" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pb_searches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_pb_searches_subject" CHECK ("subject" IN ('MATEMATIK','BAHASA_MELAYU','BAHASA_INGGERIS','SAINS')),
    CONSTRAINT "ck_pb_searches_match_mode" CHECK ("match_mode" IN ('same_grade','same_level')),
    CONSTRAINT "ck_pb_searches_status" CHECK ("status" IN ('searching','matched','expired','cancelled')),
    CONSTRAINT "ck_pb_searches_polls" CHECK ("polls" >= 0)
);
CREATE INDEX "ix_pb_searches_user_id_created_at" ON "pb_searches"("user_id", "created_at");

-- CreateTable
CREATE TABLE "game_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "boardgame_quiz_tiles" SMALLINT NOT NULL DEFAULT 35,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_game_settings_single_row" CHECK ("id" = 1),
    CONSTRAINT "ck_game_settings_boardgame_quiz_tiles" CHECK ("boardgame_quiz_tiles" BETWEEN 0 AND 38)
);
-- The one settings row (mock SEED_QUIZ_TILES = 35); reference data, idempotent.
INSERT INTO "game_settings" ("id", "boardgame_quiz_tiles") VALUES (1, 35) ON CONFLICT ("id") DO NOTHING;

-- CreateTable
CREATE TABLE "leagues" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "subject_id" BIGINT,
    "game_mode" TEXT NOT NULL,
    "scoring_method" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "max_schools" SMALLINT,
    "invite_code" TEXT NOT NULL,
    "creator_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_leagues_name" CHECK (char_length("name") BETWEEN 1 AND 255),
    CONSTRAINT "ck_leagues_type" CHECK ("type" IN ('friendly','tournament','league')),
    CONSTRAINT "ck_leagues_scope" CHECK ("scope" IN ('school','district','state','national')),
    CONSTRAINT "ck_leagues_game_mode" CHECK ("game_mode" IN ('mixed','quiz','multiplayer')),
    CONSTRAINT "ck_leagues_scoring_method" CHECK ("scoring_method" IN ('total_score','avg_accuracy','wins')),
    CONSTRAINT "ck_leagues_status" CHECK ("status" IN ('upcoming','ongoing','ended')),
    CONSTRAINT "ck_leagues_max_schools" CHECK ("max_schools" IS NULL OR "max_schools" BETWEEN 2 AND 500),
    CONSTRAINT "ck_leagues_invite_code" CHECK ("invite_code" ~ '^[A-Z0-9]{8}$')
);
CREATE UNIQUE INDEX "uq_leagues_invite_code" ON "leagues"("invite_code");
CREATE INDEX "ix_leagues_status" ON "leagues"("status");

-- CreateTable
CREATE TABLE "league_class_levels" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "league_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    CONSTRAINT "league_class_levels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_league_class_levels_level" CHECK ("level" IN ('D1','D2','D3','D4','D5','D6','T1','T2','T3','T4','T5'))
);
CREATE UNIQUE INDEX "uq_league_class_levels_league_id_level" ON "league_class_levels"("league_id", "level");

-- CreateTable
CREATE TABLE "league_schools" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "league_id" BIGINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "league_schools_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_league_schools_league_id_school_id" ON "league_schools"("league_id", "school_id");
CREATE INDEX "ix_league_schools_school_id" ON "league_schools"("school_id");

-- CreateTable
CREATE TABLE "league_standings" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "league_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "peserta" INTEGER NOT NULL DEFAULT 0,
    "skor" NUMERIC(10,1) NOT NULL DEFAULT 0,
    "purata" NUMERIC(5,1) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "league_standings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_league_standings_level" CHECK ("level" IN ('D1','D2','D3','D4','D5','D6','T1','T2','T3','T4','T5'))
);
CREATE UNIQUE INDEX "uq_league_standings_league_id_level_school_id" ON "league_standings"("league_id", "level", "school_id");
CREATE INDEX "ix_league_standings_league_id_level_sort_order" ON "league_standings"("league_id", "level", "sort_order");

-- CreateTable
CREATE TABLE "sekolah_bersaing_weeks" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "week_start" DATE NOT NULL,
    "rank" SMALLINT NOT NULL,
    "school_id" BIGINT NOT NULL,
    "aktif_pct" NUMERIC(5,1) NOT NULL DEFAULT 0,
    "streak_avg" NUMERIC(5,1) NOT NULL DEFAULT 0,
    "nota_per_10" NUMERIC(5,1) NOT NULL DEFAULT 0,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "sekolah_bersaing_weeks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_sekolah_bersaing_weeks_rank" CHECK ("rank" >= 1)
);
CREATE UNIQUE INDEX "uq_sekolah_bersaing_weeks_week_start_rank" ON "sekolah_bersaing_weeks"("week_start", "rank");

-- AddForeignKey
ALTER TABLE "game_rooms" ADD CONSTRAINT "fk_game_rooms_host_id" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_room_players" ADD CONSTRAINT "fk_game_room_players_room_code" FOREIGN KEY ("room_code") REFERENCES "game_rooms"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_room_players" ADD CONSTRAINT "fk_game_room_players_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_standings" ADD CONSTRAINT "fk_game_standings_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "fk_game_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_sessions" ADD CONSTRAINT "fk_game_sessions_jutawan_subject_id" FOREIGN KEY ("jutawan_subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_session_items" ADD CONSTRAINT "fk_game_session_items_session_id" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_session_items" ADD CONSTRAINT "fk_game_session_items_question_id" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personal_bests" ADD CONSTRAINT "fk_personal_bests_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jutawan_stats" ADD CONSTRAINT "fk_jutawan_stats_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spins" ADD CONSTRAINT "fk_spins_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spin_stats" ADD CONSTRAINT "fk_spin_stats_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pb_searches" ADD CONSTRAINT "fk_pb_searches_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pb_searches" ADD CONSTRAINT "fk_pb_searches_room_code" FOREIGN KEY ("room_code") REFERENCES "game_rooms"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leagues" ADD CONSTRAINT "fk_leagues_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leagues" ADD CONSTRAINT "fk_leagues_creator_id" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "league_class_levels" ADD CONSTRAINT "fk_league_class_levels_league_id" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_schools" ADD CONSTRAINT "fk_league_schools_league_id" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_schools" ADD CONSTRAINT "fk_league_schools_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_standings" ADD CONSTRAINT "fk_league_standings_league_id" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_standings" ADD CONSTRAINT "fk_league_standings_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sekolah_bersaing_weeks" ADD CONSTRAINT "fk_sekolah_bersaing_weeks_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
