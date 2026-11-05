-- 0230_s7_redemption_idempotency (S7-T05, DM-78, FR-ERR-9): a repeated redeem or Cabutan ticket purchase with the same `client_uuid`
-- from one user returns the first result. This is the only idempotency mechanism of a redeem (N-7): no header and no time window.
-- Additive, no backfill: existing rows and requests without a key stay NULL, and the partial indexes ignore NULL.
-- Reversible: DROP INDEX both indexes, then DROP COLUMN "client_uuid" on both tables.

-- AlterTable
ALTER TABLE "reward_redemptions" ADD COLUMN "client_uuid" UUID;
ALTER TABLE "draw_tickets" ADD COLUMN "client_uuid" UUID;

-- CreateIndex (partial: Prisma cannot express these, so they live here only)
CREATE UNIQUE INDEX "uq_reward_redemptions_user_id_client_uuid" ON "reward_redemptions"("user_id", "client_uuid") WHERE "client_uuid" IS NOT NULL;
CREATE UNIQUE INDEX "uq_draw_tickets_user_id_client_uuid" ON "draw_tickets"("user_id", "client_uuid") WHERE "client_uuid" IS NOT NULL;
