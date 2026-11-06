-- S6-T20 (DM-43, FR-GUR-44e-3, FR-GUR-44e-4): question_sets.kind separates a teacher paper ('kertas') from a normal question set ('set').
-- Additive, no backfill: every existing row takes the default 'set'. The check constraint allows only 'set' or 'kertas'.
-- rollback: ALTER TABLE question_sets DROP CONSTRAINT ck_question_sets_kind; ALTER TABLE question_sets DROP COLUMN kind;

ALTER TABLE "question_sets" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'set';
ALTER TABLE "question_sets" ADD CONSTRAINT "ck_question_sets_kind" CHECK ("kind" IN ('set', 'kertas'));
