-- 0227_s7_draw_status (S7-T07, DM-65, FR-GM-22.*): a Cabutan Bertuah draw gains the states `drawn` (winners picked) and `cancelled`
-- (48 GAME-22 state diagram), and `draws.cancelled_at` records when a draw was cancelled.
-- Additive (expand only): `ck_draws_status` only gets two more allowed values, so every existing row (`draft`, `open`, `closed`) still
-- satisfies it. No status is remapped and there is no backfill; `cancelled_at` is nullable and stays NULL on existing rows.
-- The new check is added NOT VALID, then VALIDATEd (the order of 0137); the old one is dropped first, as in 0225.
-- Reversible, in this order (a rollback loses only rows written after the deploy):
--   UPDATE "draws" SET "status" = 'closed' WHERE "status" IN ('drawn', 'cancelled');   -- move them first, else the old check refuses
--   ALTER TABLE "draws" DROP CONSTRAINT "ck_draws_status";
--   ALTER TABLE "draws" ADD CONSTRAINT "ck_draws_status" CHECK ("status" IN ('draft', 'open', 'closed'));
--   ALTER TABLE "draws" DROP COLUMN "cancelled_at";
--   then `prisma migrate resolve --rolled-back 0227_s7_draw_status`, or a later deploy skips this file.
-- Order: the number sorts before 0230 (merged); it touches only `draws` (0019), so it does not depend on any later number.

-- AlterTable
ALTER TABLE "draws" ADD COLUMN "cancelled_at" TIMESTAMPTZ(6);

-- Replace ck_draws_status (0019_gamification_shop): the same three values plus `drawn` and `cancelled` (widening).
ALTER TABLE "draws" DROP CONSTRAINT "ck_draws_status";
ALTER TABLE "draws" ADD CONSTRAINT "ck_draws_status" CHECK ("status" IN ('draft', 'open', 'closed', 'drawn', 'cancelled')) NOT VALID;
ALTER TABLE "draws" VALIDATE CONSTRAINT "ck_draws_status";
