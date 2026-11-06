-- 0187_s5_mood_checkins (S5-T04, DM-84, FR-MUR-2-12): the pupil's daily mood check-in, one row per pupil per Malaysia calendar day.
-- Stored values follow DM-84 (`gembira`, `okay`, `sedih`, `tertekan`); the Command Center adapter maps them to `happy|okay|sad|stressed`.
-- `checked_on` is the Asia/Kuala_Lumpur calendar day, written by the service. A second submit the same day is refused (409), so the unique
-- (user_id, checked_on) is the last line of defence against a race, never an upsert target. `reason` is never written in R1.
-- `is_test` is stamped while an admin is in Mod Pelajar, as on `practice_answers`; the Command Center reads leave those rows out.
-- Additive (expand only), no backfill.
-- rollback: DROP TABLE "mood_checkins";

-- CreateTable
CREATE TABLE "mood_checkins" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "mood" TEXT NOT NULL,
    "checked_on" DATE NOT NULL,
    "reason" VARCHAR(255),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_checkins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_mood_checkins_mood" CHECK ("mood" IN ('gembira', 'okay', 'sedih', 'tertekan'))
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mood_checkins_user_day" ON "mood_checkins"("user_id", "checked_on");

-- CreateIndex
CREATE INDEX "ix_mood_checkins_checked_on" ON "mood_checkins"("checked_on");

-- AddForeignKey
ALTER TABLE "mood_checkins" ADD CONSTRAINT "fk_mood_checkins_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
