-- 0231_s7_ledger_idempotency (S7-T04, DM-79, FR-GM-17.3, INV-37): a repeated Tukar Token or challenge claim with the same `client_uuid`
-- from one user credits once and returns the first result. Ledger rows are append-only, so the key is set at insert. Nothing reads it yet.
-- Additive (expand only), no backfill: existing rows and requests without a key stay NULL, and the partial index ignores NULL.
-- Reversible: DROP INDEX "uq_coin_ledger_user_id_client_uuid"; then ALTER TABLE "coin_ledger" DROP COLUMN "client_uuid";

-- AlterTable
ALTER TABLE "coin_ledger" ADD COLUMN "client_uuid" UUID;

-- CreateIndex (partial: Prisma cannot express it, so it lives here only)
CREATE UNIQUE INDEX "uq_coin_ledger_user_id_client_uuid" ON "coin_ledger"("user_id", "client_uuid") WHERE "client_uuid" IS NOT NULL;
