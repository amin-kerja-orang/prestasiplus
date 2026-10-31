-- R1-T42 (R1-18.1, 18.3): a question report names the paper (and the attempt) it was filed from.
-- Additive and nullable: existing rows keep NULL, no data change. `attempt_id` (uuid) already exists since 0017 with no FK;
-- it is now written, so it gets an FK to exam_attempts. NOT VALID: rows written before this migration are not checked
-- (nothing wrote the column), every new or updated row is. The server also checks the attempt is the reporter's and holds the question.
-- Reversible: DROP INDEX "ix_question_reports_paper_id";
--             ALTER TABLE "question_reports" DROP CONSTRAINT "fk_question_reports_attempt_id", DROP CONSTRAINT "fk_question_reports_paper_id",
--               DROP CONSTRAINT "ck_question_reports_paper_label", DROP COLUMN "paper_label", DROP COLUMN "paper_id";

ALTER TABLE "question_reports" ADD COLUMN "paper_id" BIGINT;
ALTER TABLE "question_reports" ADD COLUMN "paper_label" TEXT;

ALTER TABLE "question_reports" ADD CONSTRAINT "ck_question_reports_paper_label" CHECK ("paper_label" IS NULL OR char_length("paper_label") <= 200);
ALTER TABLE "question_reports" ADD CONSTRAINT "fk_question_reports_paper_id" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_reports" ADD CONSTRAINT "fk_question_reports_attempt_id" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

CREATE INDEX "ix_question_reports_paper_id" ON "question_reports"("paper_id");
