-- S5-T05 (DM-80, FR-MUR-A1-10): users.aspiration, the student's aspiration shown on Profil Saya (free text, max 255).
-- Additive and nullable: no backfill, no default. `bio` is unchanged (text already holds the 1000 characters the PRD asks for).
-- rollback: ALTER TABLE users DROP COLUMN aspiration;

ALTER TABLE "users" ADD COLUMN "aspiration" VARCHAR(255) NULL;
