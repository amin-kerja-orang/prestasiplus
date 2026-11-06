-- 0263_s5_pksk_exam_served_ids (S5-T13 part rows; number 0263 assigned by the team-dd lead because the S5 range 0180-0189 is full; DM-90, the counterpart of DM-89 pksk_practice_loads).
-- The PKSK exam is served before any attempt exists, so the served question ids need a row of their own: one open exam set per
-- user and level (the same shape as pksk_practice_loads). A submit takes (deletes) the row, so it is accepted only for that
-- served set and only once (anti-cheat: no key or explanation for guessed ids).
-- Additive: a new table, no existing row changes. An exam submit with no open set is refused (the pupil reloads the exam).
-- Reversible: DROP TABLE "pksk_exam_loads";

-- CreateTable
CREATE TABLE "pksk_exam_loads" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "level" TEXT NOT NULL,
    "loaded_at" TIMESTAMPTZ(6) NOT NULL,
    "served_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "pksk_exam_loads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_pksk_exam_loads_level" CHECK ("level" IN ('T1', 'T4'))
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_pksk_exam_loads_user_id_level" ON "pksk_exam_loads"("user_id", "level");

-- AddForeignKey
ALTER TABLE "pksk_exam_loads" ADD CONSTRAINT "fk_pksk_exam_loads_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
