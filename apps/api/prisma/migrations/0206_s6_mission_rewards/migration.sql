
-- S6-T07 (DM-88, FR-GM-20.2, AC-GUR-2b-7, issue #483): the once-only mission target reward. One row records the coins paid to a pupil
-- for a mission; UNIQUE (mission_id, student_id) means a second completion pays nothing. Expand-only: a new table, nothing existing changes.
-- Written inside the practice submit transaction (ON CONFLICT DO NOTHING); the wallet credit itself is the rewards service's.
-- rollback: DROP TABLE mission_rewards;

CREATE TABLE IF NOT EXISTS "mission_rewards" (
    "id" BIGSERIAL NOT NULL,
    "mission_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "coins" SMALLINT NOT NULL,
    "session_id" UUID NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "mission_rewards_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mission_rewards" DROP CONSTRAINT IF EXISTS "ck_mission_rewards_coins";
ALTER TABLE "mission_rewards" ADD CONSTRAINT "ck_mission_rewards_coins" CHECK ("coins" >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_mission_rewards_mission_id_student_id" ON "mission_rewards"("mission_id", "student_id");
CREATE INDEX IF NOT EXISTS "ix_mission_rewards_student_id" ON "mission_rewards"("student_id");

ALTER TABLE "mission_rewards" DROP CONSTRAINT IF EXISTS "fk_mission_rewards_mission_id";
ALTER TABLE "mission_rewards" ADD CONSTRAINT "fk_mission_rewards_mission_id" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "mission_rewards" DROP CONSTRAINT IF EXISTS "fk_mission_rewards_student_id";
ALTER TABLE "mission_rewards" ADD CONSTRAINT "fk_mission_rewards_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "mission_rewards" DROP CONSTRAINT IF EXISTS "fk_mission_rewards_session_id";
ALTER TABLE "mission_rewards" ADD CONSTRAINT "fk_mission_rewards_session_id" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
