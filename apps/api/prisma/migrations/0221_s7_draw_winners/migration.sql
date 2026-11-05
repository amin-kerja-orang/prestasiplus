-- 0221_s7_draw_winners (S7-T07, DM-36, FR-GM-22.2, AC-GM-22.4, AC-GM-22.5): the winners of a Cabutan Bertuah draw, one row per prize slot.
-- With the columns of ruling 4 on #505: `ticket_id` (the ticket that won, FK `draw_tickets`), `delivered_at` and `delivered_by_id`
-- ("Tandakan Dihantar": the prize was handed over outside the app). `draws.winner_user_id` is kept and holds the first winner.
-- `slot` counts the winners of one prize line from 0 (a line with qty 3 has the slots 0, 1 and 2), as `draw_prizes.position` counts from 0.
-- Constraints: `(draw_prize_id, slot)` unique, so a second draw run cannot record a second winner (INV-28); `(draw_id, user_id)` unique,
-- one prize per pupil per draw (48 GAME-22); `ticket_id` unique, a ticket wins once.
-- Additive (expand only): a new table. Nothing existing is changed, so every existing row stays valid; there is no backfill, and a draw
-- that already has a stored winner (`draws.winner_user_id`) gets no row here.
-- FKs: draw and prize RESTRICT (a drawn result is a record); ticket and user CASCADE (erasing a pupil removes the pupil's ticket, and with it
-- the pupil's winner row); `drawn_by_id` and `delivered_by_id` SET NULL (erasing an admin keeps the row).
-- Reversible, in this order (a rollback loses the winners recorded after the deploy; draws set to `drawn` keep that status and their
-- `winner_user_id`):
--   DROP TABLE "draw_winners";
--   then `prisma migrate resolve --rolled-back 0221_s7_draw_winners`, or a later deploy skips this file.
-- Order: the number sorts before 0223, 0224, 0227 and 0230 (merged); it needs `draws`, `draw_prizes`, `draw_tickets` (0019) and nothing later.

-- CreateTable
CREATE TABLE "draw_winners" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "draw_id" BIGINT NOT NULL,
    "draw_prize_id" BIGINT NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "slot" SMALLINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "drawn_at" TIMESTAMPTZ(6) NOT NULL,
    "drawn_by_id" BIGINT,
    "delivered_at" TIMESTAMPTZ(6),
    "delivered_by_id" BIGINT,

    CONSTRAINT "draw_winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_draw_winners_ticket_id" ON "draw_winners"("ticket_id");

-- CreateIndex
CREATE INDEX "ix_draw_winners_user_id" ON "draw_winners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_draw_winners_draw_prize_id_slot" ON "draw_winners"("draw_prize_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "uq_draw_winners_draw_id_user_id" ON "draw_winners"("draw_id", "user_id");

-- AddForeignKey
ALTER TABLE "draw_winners" ADD CONSTRAINT "fk_draw_winners_draw_id" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_winners" ADD CONSTRAINT "fk_draw_winners_draw_prize_id" FOREIGN KEY ("draw_prize_id") REFERENCES "draw_prizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_winners" ADD CONSTRAINT "fk_draw_winners_ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "draw_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_winners" ADD CONSTRAINT "fk_draw_winners_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_winners" ADD CONSTRAINT "fk_draw_winners_drawn_by_id" FOREIGN KEY ("drawn_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_winners" ADD CONSTRAINT "fk_draw_winners_delivered_by_id" FOREIGN KEY ("delivered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checks (the 0019 style: no Prisma form)
ALTER TABLE "draw_winners" ADD CONSTRAINT "ck_draw_winners_slot" CHECK ("slot" >= 0);
ALTER TABLE "draw_winners" ADD CONSTRAINT "ck_draw_winners_delivered" CHECK ("delivered_by_id" IS NULL OR "delivered_at" IS NOT NULL);
