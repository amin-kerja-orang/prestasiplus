-- 0189_s5_pksk_served_ids (S5-T13, DM-89): the practice load row also remembers which question ids were served, so a submit is
-- accepted only for that served set and only once (anti-cheat: no key or explanation for guessed ids).
-- Additive: existing rows get an empty list, so a submit against an old load is refused (the pupil reloads the set).
-- Reversible: ALTER TABLE "pksk_practice_loads" DROP COLUMN "served_ids";

-- AlterTable
ALTER TABLE "pksk_practice_loads" ADD COLUMN "served_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
