-- 0010_wallet_streak (BE-11): tiers, wallets, coin_ledger, streaks, session_credits, daily_login_marks,
-- token_movements. (0008 = BE-08 curriculum and 0009 = BE-24 are on other branches; this file depends on
-- neither: its only parent table is users.)
-- Written to match wallet.prisma (the Prisma `migrate diff` shape), then edited by hand: identity columns
-- (GENERATED ALWAYS), CHECK constraints (enums are text + check), the partial unique index that makes
-- credits idempotent, and the trigger that keeps coin_ledger append-only. Plan 14.2, data model 3.7.
-- coin_ledger carries the full legacy trio (legacy_source, legacy_id, legacy_hash: big activity table).
-- session_credits, daily_login_marks and token_movements have no .cloud source and no legacy columns.

-- CreateTable
CREATE TABLE "tiers" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "tier_name" TEXT NOT NULL,
    "label_ms" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "min_syiling" INTEGER NOT NULL,
    "conversion_rate" DECIMAL(10,4) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "perks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "quiz_reward_l1" INTEGER NOT NULL DEFAULT 0,
    "quiz_reward_l2" INTEGER NOT NULL DEFAULT 0,
    "quiz_reward_l3" INTEGER NOT NULL DEFAULT 0,
    "quiz_reward_l4" INTEGER NOT NULL DEFAULT 0,
    "quiz_reward_l5" INTEGER NOT NULL DEFAULT 0,
    "pksk_reward_correct" INTEGER NOT NULL DEFAULT 0,
    "board_game_reward_correct" INTEGER NOT NULL DEFAULT 0,
    "board_game_reward_win" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "tier_id" BIGINT,
    "current_syiling" INTEGER NOT NULL DEFAULT 0,
    "total_syiling_earned" INTEGER NOT NULL DEFAULT 0,
    "token_balance" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_ledger" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "tokens" INTEGER,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,
    "legacy_hash" TEXT,

    CONSTRAINT "coin_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streaks" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATE,
    "total_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_credits" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "coins_earned" INTEGER NOT NULL,
    "points_earned" INTEGER NOT NULL,
    "streak_count" INTEGER NOT NULL,
    "total_balance" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_login_marks" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "mark_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_login_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_movements" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "delta" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "ref_id" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tiers_tier_name" ON "tiers"("tier_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tiers_legacy" ON "tiers"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_tiers_is_active_min_syiling" ON "tiers"("is_active", "min_syiling");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallets_user_id" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallets_legacy" ON "wallets"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_wallets_tier_id" ON "wallets"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_coin_ledger_legacy" ON "coin_ledger"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_coin_ledger_user_id_created_at_id" ON "coin_ledger"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_streaks_user_id" ON "streaks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_streaks_legacy" ON "streaks"("legacy_source", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_session_credits_session_id" ON "session_credits"("session_id");

-- CreateIndex
CREATE INDEX "ix_session_credits_user_id_completed_at" ON "session_credits"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_daily_login_marks_user_date" ON "daily_login_marks"("user_id", "mark_date");

-- CreateIndex
CREATE INDEX "ix_token_movements_user_id_created_at" ON "token_movements"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "fk_wallets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "fk_wallets_tier_id" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "fk_coin_ledger_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "fk_streaks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_credits" ADD CONSTRAINT "fk_session_credits_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_login_marks" ADD CONSTRAINT "fk_daily_login_marks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_movements" ADD CONSTRAINT "fk_token_movements_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Idempotent credits: one ledger row per (user, source, source_id). Rows without a source_id (the
-- migrated ones and rows with no natural key) sit outside the index. A partial index cannot be
-- written in Prisma, so it lives here only (like ix_notifications_user_id_unread).
CREATE UNIQUE INDEX "uq_coin_ledger_user_source_source_id" ON "coin_ledger"("user_id", "source", "source_id") WHERE "source_id" IS NOT NULL;

-- Legacy source values, as in the other migratable tables.
ALTER TABLE "tiers" ADD CONSTRAINT "ck_tiers_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "wallets" ADD CONSTRAINT "ck_wallets_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "coin_ledger" ADD CONSTRAINT "ck_coin_ledger_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "streaks" ADD CONSTRAINT "ck_streaks_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract, E-ledger_type of the data model).
ALTER TABLE "coin_ledger" ADD CONSTRAINT "ck_coin_ledger_type" CHECK ("type" IN ('earn', 'spend', 'convert', 'bonus', 'refund'));
-- The sign follows the type: earn/bonus/refund add syiling, spend/convert remove it. Zero is allowed (a migrated row may hold one).
ALTER TABLE "coin_ledger" ADD CONSTRAINT "ck_coin_ledger_amount_sign" CHECK (
    ("type" IN ('earn', 'bonus', 'refund') AND "amount" >= 0) OR ("type" IN ('spend', 'convert') AND "amount" <= 0)
);
ALTER TABLE "coin_ledger" ADD CONSTRAINT "ck_coin_ledger_source" CHECK (char_length("source") BETWEEN 1 AND 100);
ALTER TABLE "coin_ledger" ADD CONSTRAINT "ck_coin_ledger_source_id" CHECK ("source_id" IS NULL OR char_length("source_id") BETWEEN 1 AND 200);

-- Balances and counters. The syiling balance is never negative; the token balance may be (migrated or seeded data, DV-M14-10).
ALTER TABLE "wallets" ADD CONSTRAINT "ck_wallets_current_syiling" CHECK ("current_syiling" >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "ck_wallets_total_syiling_earned" CHECK ("total_syiling_earned" >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "ck_wallets_xp" CHECK ("xp" >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "ck_wallets_level" CHECK ("level" >= 1);
ALTER TABLE "streaks" ADD CONSTRAINT "ck_streaks_counts" CHECK ("current" >= 0 AND "best" >= 0 AND "total_days" >= 0);
ALTER TABLE "tiers" ADD CONSTRAINT "ck_tiers_min_syiling" CHECK ("min_syiling" >= 0);
ALTER TABLE "tiers" ADD CONSTRAINT "ck_tiers_conversion_rate" CHECK ("conversion_rate" > 0);
ALTER TABLE "tiers" ADD CONSTRAINT "ck_tiers_name" CHECK (char_length("tier_name") BETWEEN 1 AND 100);
ALTER TABLE "session_credits" ADD CONSTRAINT "ck_session_credits_counts" CHECK ("coins_earned" >= 0 AND "points_earned" >= 0 AND "streak_count" >= 0 AND "total_balance" >= 0);
ALTER TABLE "token_movements" ADD CONSTRAINT "ck_token_movements_delta" CHECK ("delta" <> 0);
ALTER TABLE "token_movements" ADD CONSTRAINT "ck_token_movements_source" CHECK (char_length("source") BETWEEN 1 AND 100);

-- Append-only ledger: no UPDATE and no DELETE of a coin_ledger row. Two doors stay open, on purpose:
--  1. A DELETE that comes from the foreign key of users (ON DELETE CASCADE) runs inside the RI trigger
--     of users, so pg_trigger_depth() is above 1; deleting a user removes that user's ledger with it.
--  2. An UPDATE of a migrated row (legacy_source set) is allowed, because the ETL upsert
--     (BE-34 upsertByLegacy) rewrites a row whose source changed. Rows born in v2 can never change.
-- The application code has no method that updates or deletes a ledger row either (test/wallet).
CREATE FUNCTION "coin_ledger_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF pg_trigger_depth() > 1 THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'coin_ledger is append-only: a row cannot be deleted' USING ERRCODE = 'restrict_violation';
    END IF;
    IF OLD."legacy_source" IS NOT NULL THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'coin_ledger is append-only: a row cannot be updated' USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "trg_coin_ledger_append_only" BEFORE UPDATE OR DELETE ON "coin_ledger"
    FOR EACH ROW EXECUTE FUNCTION "coin_ledger_append_only"();
