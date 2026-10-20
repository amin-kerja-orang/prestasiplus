-- 0019_gamification_shop (BE-23, phase 1: data layer): challenges, challenge_completions, achievements,
-- user_achievements, learner_badges, learner_badge_holdings, referral_codes, referrals, draws, draw_prizes,
-- draw_tickets, syiling_rewards, reward_claims, rewards, reward_redemptions, mystery_box_openings,
-- gamification_settings. Data model 3.7, plan 14.2, OD-28 (draw_prizes).
-- Written to match gamification.prisma (the Prisma `migrate diff` shape), then edited by hand: identity
-- columns (GENERATED ALWAYS), CHECK constraints (enums are text + check, no Postgres enum types) and the
-- foreign keys to users and files, which have no Prisma relation field.
-- Depends on 0002_identity (users) and 0005_files (files) only. Money and coin amounts are integers
-- (value_sen is integer sen); rewards.denomination_rm is numeric(10,2) as the data model says.
-- Not built here (D53/OWN-10): teacher wallets, ledger, rewards, redemptions, cash withdrawals, teacher badges.
-- Mystery boxes have no table: the four boxes are constants in code (mock DATA-M15-03).
-- Legacy columns (legacy_source, legacy_id, unique pair) on every table the data model marks LEG; none on
-- learner_badges, learner_badge_holdings, draw_prizes, draw_tickets, mystery_box_openings.

-- CreateTable
CREATE TABLE "challenges" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "challenge_type" TEXT NOT NULL,
    "metric" TEXT,
    "target_value" INTEGER NOT NULL,
    "reward_syiling" INTEGER NOT NULL DEFAULT 0,
    "reward_xp" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_completions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "completion_date" DATE NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "challenge_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "reward_syiling" INTEGER NOT NULL DEFAULT 0,
    "reward_xp" INTEGER NOT NULL DEFAULT 0,
    "criterion_kind" TEXT,
    "criterion_min" INTEGER,
    "criterion_accuracy" DECIMAL(5,2),
    "progress_target" INTEGER,
    "legacy_criteria_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "achievement_id" BIGINT NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_badges" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "rarity_label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_badge_holdings" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "badge_id" BIGINT NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_badge_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "referrer_id" BIGINT NOT NULL,
    "referee_id" BIGINT NOT NULL,
    "code_used" TEXT NOT NULL,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draws" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ticket_cost_syiling" INTEGER NOT NULL,
    "max_tickets_per_student" INTEGER NOT NULL,
    "closes_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "winner_user_id" BIGINT,
    "drawn_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_prizes" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "draw_id" BIGINT NOT NULL,
    "label" TEXT NOT NULL,
    "value_sen" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draw_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_tickets" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "draw_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draw_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syiling_rewards" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price_syiling" INTEGER NOT NULL,
    "cost_value_sen" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "syiling_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_claims" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "reward_id" BIGINT NOT NULL,
    "cost_value_sen" INTEGER NOT NULL,
    "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "category" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "denomination_rm" DECIMAL(10,2) NOT NULL,
    "token_cost" INTEGER NOT NULL,
    "icon_emoji" TEXT,
    "stock_quantity" INTEGER,
    "max_per_month_per_student" SMALLINT,
    "voucher_validity_days" SMALLINT NOT NULL DEFAULT 365,
    "delivery_method" TEXT NOT NULL DEFAULT 'manual',
    "vendor_sku" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "image_file_id" BIGINT,
    "image_url" TEXT,
    "terms_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_parent_consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "reward_id" BIGINT,
    "reward_title" TEXT NOT NULL,
    "reward_vendor" TEXT NOT NULL,
    "reward_icon" TEXT,
    "denomination_rm" DECIMAL(10,2) NOT NULL,
    "token_cost" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "stock_reserved" BOOLEAN NOT NULL DEFAULT false,
    "parent_decision_by_id" BIGINT,
    "parent_decided_at" TIMESTAMPTZ(6),
    "voucher_code" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mystery_box_openings" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "box_id" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mystery_box_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_settings" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "gamification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_challenges_legacy" ON "challenges"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_challenges_is_active_sort_order" ON "challenges"("is_active", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_challenge_completions_user_challenge_date" ON "challenge_completions"("user_id", "challenge_id", "completion_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_challenge_completions_legacy" ON "challenge_completions"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_challenge_completions_user_id_completion_date" ON "challenge_completions"("user_id", "completion_date");

-- CreateIndex
CREATE INDEX "ix_challenge_completions_challenge_id" ON "challenge_completions"("challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_achievements_legacy" ON "achievements"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_achievements_name" ON "achievements"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_achievements_user_achievement" ON "user_achievements"("user_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_achievements_legacy" ON "user_achievements"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_user_achievements_achievement_id" ON "user_achievements"("achievement_id");

-- CreateIndex
CREATE INDEX "ix_learner_badges_name" ON "learner_badges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learner_badge_holdings_user_badge" ON "learner_badge_holdings"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "ix_learner_badge_holdings_badge_id" ON "learner_badge_holdings"("badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_codes_user_id" ON "referral_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_codes_code" ON "referral_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referral_codes_legacy" ON "referral_codes"("legacy_source", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referrals_referee_id" ON "referrals"("referee_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referrals_legacy" ON "referrals"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_referrals_referrer_id" ON "referrals"("referrer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_draws_legacy" ON "draws"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_draws_status_closes_at" ON "draws"("status", "closes_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_draw_prizes_draw_position" ON "draw_prizes"("draw_id", "position");

-- CreateIndex
CREATE INDEX "ix_draw_tickets_draw_id_user_id" ON "draw_tickets"("draw_id", "user_id");

-- CreateIndex
CREATE INDEX "ix_draw_tickets_user_id_created_at" ON "draw_tickets"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_syiling_rewards_legacy" ON "syiling_rewards"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_syiling_rewards_name" ON "syiling_rewards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_reward_claims_legacy" ON "reward_claims"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_reward_claims_user_id_claimed_at" ON "reward_claims"("user_id", "claimed_at");

-- CreateIndex
CREATE INDEX "ix_reward_claims_reward_id" ON "reward_claims"("reward_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rewards_legacy" ON "rewards"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_rewards_category_is_active_display_order" ON "rewards"("category", "is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_reward_redemptions_legacy" ON "reward_redemptions"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_reward_redemptions_user_id_created_at" ON "reward_redemptions"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ix_reward_redemptions_user_id_reward_id_created_at" ON "reward_redemptions"("user_id", "reward_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_reward_redemptions_status_created_at" ON "reward_redemptions"("status", "created_at");

-- CreateIndex
CREATE INDEX "ix_reward_redemptions_reward_id" ON "reward_redemptions"("reward_id");

-- CreateIndex
CREATE INDEX "ix_mystery_box_openings_user_id_created_at" ON "mystery_box_openings"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gamification_settings_key" ON "gamification_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_gamification_settings_legacy" ON "gamification_settings"("legacy_source", "legacy_id");

-- AddForeignKey
ALTER TABLE "challenge_completions" ADD CONSTRAINT "fk_challenge_completions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_completions" ADD CONSTRAINT "fk_challenge_completions_challenge_id" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "fk_user_achievements_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "fk_user_achievements_achievement_id" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_badge_holdings" ADD CONSTRAINT "fk_learner_badge_holdings_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_badge_holdings" ADD CONSTRAINT "fk_learner_badge_holdings_badge_id" FOREIGN KEY ("badge_id") REFERENCES "learner_badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "fk_referral_codes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "fk_referrals_referrer_id" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "fk_referrals_referee_id" FOREIGN KEY ("referee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "fk_draws_winner_user_id" FOREIGN KEY ("winner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_prizes" ADD CONSTRAINT "fk_draw_prizes_draw_id" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_tickets" ADD CONSTRAINT "fk_draw_tickets_draw_id" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_tickets" ADD CONSTRAINT "fk_draw_tickets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "fk_reward_claims_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claims" ADD CONSTRAINT "fk_reward_claims_reward_id" FOREIGN KEY ("reward_id") REFERENCES "syiling_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "fk_rewards_image_file_id" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_reward_id" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_parent_decision_by_id" FOREIGN KEY ("parent_decision_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mystery_box_openings" ADD CONSTRAINT "fk_mystery_box_openings_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Legacy source values, as in the other migratable tables.
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "challenge_completions" ADD CONSTRAINT "ck_challenge_completions_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "user_achievements" ADD CONSTRAINT "ck_user_achievements_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "referral_codes" ADD CONSTRAINT "ck_referral_codes_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "referrals" ADD CONSTRAINT "ck_referrals_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "draws" ADD CONSTRAINT "ck_draws_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "syiling_rewards" ADD CONSTRAINT "ck_syiling_rewards_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "reward_claims" ADD CONSTRAINT "ck_reward_claims_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "ck_reward_redemptions_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));
ALTER TABLE "gamification_settings" ADD CONSTRAINT "ck_gamification_settings_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes; E-challenge_type, E-challenge_metric, E-difficulty, E-rarity,
-- E-criterion_kind, E-draw_status, E-syiling_reward_type, E-hadiah_category, E-delivery_method,
-- E-hadiah_redemption_status, E-cancelled_by, E-setting_key of the data model).
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_challenge_type" CHECK ("challenge_type" IN ('quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent'));
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_metric" CHECK ("metric" IS NULL OR "metric" IN ('sessions', 'correct', 'best_accuracy', 'best_correct_in_session', 'chapters', 'minutes', 'streak'));
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_difficulty" CHECK ("difficulty" IN ('easy', 'medium', 'hard'));
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_amounts" CHECK ("target_value" >= 1 AND "reward_syiling" >= 0 AND "reward_xp" >= 0);
ALTER TABLE "challenges" ADD CONSTRAINT "ck_challenges_title" CHECK (char_length("title") BETWEEN 1 AND 200);

ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_rarity" CHECK ("rarity" IN ('common', 'rare', 'epic', 'legendary'));
ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_criterion_kind" CHECK ("criterion_kind" IS NULL OR "criterion_kind" IN (
    'practice_sessions', 'streak', 'lifetime_syiling', 'accurate_sessions', 'subjects', 'mystery_openings', 'completions',
    'math_correct', 'science_correct', 'fast_answers', 'referrals', 'unlocked', 'answers_accuracy', 'perfect_days'));
-- A structured criterion has a kind and a minimum together; a migrated legacy row has neither (no auto-unlock).
ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_criterion_pair" CHECK (("criterion_kind" IS NULL) = ("criterion_min" IS NULL));
ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_criterion_accuracy" CHECK (
    "criterion_accuracy" IS NULL OR ("criterion_kind" = 'answers_accuracy' AND "criterion_accuracy" BETWEEN 0 AND 100));
ALTER TABLE "achievements" ADD CONSTRAINT "ck_achievements_amounts" CHECK (
    "reward_syiling" >= 0 AND "reward_xp" >= 0 AND ("criterion_min" IS NULL OR "criterion_min" >= 0) AND ("progress_target" IS NULL OR "progress_target" >= 1));

ALTER TABLE "referral_codes" ADD CONSTRAINT "ck_referral_codes_code" CHECK (char_length("code") BETWEEN 1 AND 50);
ALTER TABLE "referrals" ADD CONSTRAINT "ck_referrals_not_self" CHECK ("referrer_id" <> "referee_id");

ALTER TABLE "draws" ADD CONSTRAINT "ck_draws_status" CHECK ("status" IN ('draft', 'open', 'closed'));
ALTER TABLE "draws" ADD CONSTRAINT "ck_draws_amounts" CHECK ("ticket_cost_syiling" >= 0 AND "max_tickets_per_student" >= 1);
ALTER TABLE "draw_prizes" ADD CONSTRAINT "ck_draw_prizes_amounts" CHECK ("value_sen" >= 0 AND "qty" >= 1 AND "position" >= 0);

ALTER TABLE "syiling_rewards" ADD CONSTRAINT "ck_syiling_rewards_type" CHECK ("type" IN ('voucher', 'physical', 'experience', 'digital', 'subscription'));
ALTER TABLE "syiling_rewards" ADD CONSTRAINT "ck_syiling_rewards_amounts" CHECK ("price_syiling" >= 0 AND "cost_value_sen" >= 0);
ALTER TABLE "reward_claims" ADD CONSTRAINT "ck_reward_claims_cost_value_sen" CHECK ("cost_value_sen" >= 0);

ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_category" CHECK ("category" IN ('flagship', 'ewallet', 'telco', 'gaming', 'streaming', 'food_beverage', 'ecommerce', 'education', 'entertainment'));
ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_delivery_method" CHECK ("delivery_method" IN ('manual', 'api', 'instant'));
ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_image_url" CHECK ("image_url" IS NULL OR "image_url" ~* '^https?://');
-- Stock and limits: stock_quantity null = unlimited; the conditional decrement
-- (WHERE stock_quantity IS NULL OR stock_quantity > 0) plus this check make the stock race-safe.
ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_stock_quantity" CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0);
ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_max_per_month" CHECK ("max_per_month_per_student" IS NULL OR "max_per_month_per_student" >= 0);
ALTER TABLE "rewards" ADD CONSTRAINT "ck_rewards_amounts" CHECK ("denomination_rm" >= 0 AND "token_cost" >= 0 AND "voucher_validity_days" >= 0);

ALTER TABLE "reward_redemptions" ADD CONSTRAINT "ck_reward_redemptions_status" CHECK ("status" IN ('pending_parent_consent', 'pending_admin', 'delivered', 'cancelled'));
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "ck_reward_redemptions_cancelled_by" CHECK ("cancelled_by" IS NULL OR "cancelled_by" IN ('admin', 'parent'));
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "ck_reward_redemptions_amounts" CHECK ("denomination_rm" >= 0 AND "token_cost" >= 0);

ALTER TABLE "mystery_box_openings" ADD CONSTRAINT "ck_mystery_box_openings_amounts" CHECK ("box_id" >= 1 AND "coins" >= 0 AND "xp" >= 0);

ALTER TABLE "gamification_settings" ADD CONSTRAINT "ck_gamification_settings_key" CHECK ("key" IN (
    'coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal', 'cash_withdrawal_enabled',
    'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling'));
