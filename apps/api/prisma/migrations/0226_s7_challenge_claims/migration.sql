-- 0226_s7_challenge_claims (S7-T04 part 1, DM-63, 48 GAME-19, INV-37): one claim of a daily challenge reward per user, challenge and Malaysia day.
-- Ruling 20 on #500 (wins over 50 where they differ): the reward columns hold the amounts actually credited (0 syiling when coins are
-- disabled), `client_uuid` makes a repeated claim return the first result (DM-79, N-7), and there is no `is_test` column (Mod Pelajar is refused).
-- Append-only like the ledger: no `updated_at`, no `legacy_*` columns (no source row can land here, so the migration lint only reports it as a warning).
-- Additive (expand only), no backfill.
-- Reversible: DROP TABLE "challenge_claims";

-- CreateTable
CREATE TABLE "challenge_claims" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "myt_date" DATE NOT NULL,
    "reward_syiling" INTEGER NOT NULL,
    "reward_xp" INTEGER NOT NULL,
    "client_uuid" UUID,
    "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_claims_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_challenge_claims_reward_syiling" CHECK ("reward_syiling" >= 0),
    CONSTRAINT "ck_challenge_claims_reward_xp" CHECK ("reward_xp" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_challenge_claims_user_challenge_date" ON "challenge_claims"("user_id", "challenge_id", "myt_date");

-- CreateIndex
CREATE INDEX "ix_challenge_claims_challenge_id" ON "challenge_claims"("challenge_id");

-- CreateIndex (partial: Prisma cannot express this one, so it lives here only)
CREATE UNIQUE INDEX "uq_challenge_claims_user_id_client_uuid" ON "challenge_claims"("user_id", "client_uuid") WHERE "client_uuid" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "challenge_claims" ADD CONSTRAINT "fk_challenge_claims_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_claims" ADD CONSTRAINT "fk_challenge_claims_challenge_id" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
