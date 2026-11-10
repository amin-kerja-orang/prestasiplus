-- 0264_essay_review_proposals (panel-parity / Tanda Karangan; V2 Panel `/spm/tanda-karangan`, part_responses.ai_grade + graded_by).
-- The queue of AI mark PROPOSALS for essay answers: a school staff member sees the question, the scheme, the pupil's answer and the
-- AI's proposed mark, then confirms or adjusts it ("Sahkan"). The final mark exists only after a person confirmed it
-- (final_marks / confirmed_by / confirmed_at stay NULL while the row is pending). `school_id` is a snapshot of the pupil's school at
-- proposal time, so the school scope of the list is one indexed predicate. The essay text is child data: never logged.
-- Additive: a new table, no existing row changes.
-- Reversible: DROP TABLE "essay_review_proposals";

-- CreateTable
CREATE TABLE "essay_review_proposals" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "school_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "attempt_id" UUID,
    "part_id" TEXT,
    "question_label" TEXT,
    "stem" TEXT NOT NULL DEFAULT '',
    "scheme" JSONB NOT NULL DEFAULT '[]',
    "essay_text" TEXT NOT NULL,
    "max_marks" SMALLINT NOT NULL,
    "proposed_marks" SMALLINT,
    "rationale" TEXT NOT NULL DEFAULT '',
    "points" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "final_marks" SMALLINT,
    "confirmed_by" BIGINT,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "essay_review_proposals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_essay_review_proposals_status" CHECK ("status" IN ('pending', 'confirmed')),
    CONSTRAINT "ck_essay_review_proposals_max_marks" CHECK ("max_marks" >= 0),
    CONSTRAINT "ck_essay_review_proposals_proposed" CHECK ("proposed_marks" IS NULL OR ("proposed_marks" >= 0 AND "proposed_marks" <= "max_marks")),
    CONSTRAINT "ck_essay_review_proposals_confirmed" CHECK (
        ("status" = 'pending' AND "final_marks" IS NULL AND "confirmed_by" IS NULL AND "confirmed_at" IS NULL)
        OR ("status" = 'confirmed' AND "final_marks" IS NOT NULL AND "final_marks" >= 0 AND "final_marks" <= "max_marks" AND "confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "ix_essay_review_proposals_school_id_status_id" ON "essay_review_proposals"("school_id", "status", "id" DESC);

-- CreateIndex
CREATE INDEX "ix_essay_review_proposals_status_id" ON "essay_review_proposals"("status", "id" DESC);

-- AddForeignKey
ALTER TABLE "essay_review_proposals" ADD CONSTRAINT "fk_essay_review_proposals_school_id" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_review_proposals" ADD CONSTRAINT "fk_essay_review_proposals_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_review_proposals" ADD CONSTRAINT "fk_essay_review_proposals_confirmed_by" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
