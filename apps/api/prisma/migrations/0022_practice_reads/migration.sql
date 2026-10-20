-- PROPOSED number 0022 - renumber-at-merge, LEAD to confirm; needed because BE-13 card Outputs require spm_targets and structured_attempts, which BE-12 did not create.
--
-- 0022_practice_reads (BE-13, owner module M05): spm_targets (DATA-M05-04) and structured_attempts
-- (DATA-M05-06). Hand-written in the style of 0014: identity columns (GENERATED ALWAYS), CHECK
-- constraints (enums are text + check), migration-first columns (legacy_source, legacy_id, unique pair).
--
-- Foreign keys: user_id -> users ON DELETE CASCADE (the learner's own data goes with the account);
-- spm_targets.subject_id -> subjects ON DELETE CASCADE. structured_attempts.question_id has NO foreign
-- key (BE-09 owns `questions`; same choice as BE-12's practice_answers).
--
-- Reversible: DROP TABLE structured_attempts, spm_targets;

-- CreateTable
CREATE TABLE "spm_targets" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "target_grade" TEXT NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "spm_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_spm_targets_target_grade" CHECK ("target_grade" IN ('A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E')),
    CONSTRAINT "ck_spm_targets_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateTable
CREATE TABLE "structured_attempts" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "question_id" BIGINT NOT NULL,
    "question_version_no" INTEGER NOT NULL,
    "scope" TEXT,
    "track" TEXT,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "marks" JSONB NOT NULL DEFAULT '[]',
    "total_awarded" INTEGER NOT NULL,
    "total_max" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "structured_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_structured_attempts_scope" CHECK ("scope" IS NULL OR "scope" = 'spm'),
    CONSTRAINT "ck_structured_attempts_track" CHECK ("track" IS NULL OR ("track" = 'bahasa' AND "scope" IS NOT NULL AND "scope" = 'spm')),
    CONSTRAINT "ck_structured_attempts_version" CHECK ("question_version_no" >= 1),
    CONSTRAINT "ck_structured_attempts_totals" CHECK ("total_awarded" >= 0 AND "total_max" >= 0 AND "total_awarded" <= "total_max"),
    CONSTRAINT "ck_structured_attempts_json" CHECK (jsonb_typeof("answers") = 'array' AND jsonb_typeof("marks") = 'array'),
    CONSTRAINT "ck_structured_attempts_legacy_source" CHECK ("legacy_source" IS NULL OR "legacy_source" IN ('cloud', 'my'))
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_spm_targets_user_id_subject_id" ON "spm_targets"("user_id", "subject_id");
CREATE UNIQUE INDEX "uq_spm_targets_legacy" ON "spm_targets"("legacy_source", "legacy_id");
CREATE INDEX "ix_spm_targets_subject_id" ON "spm_targets"("subject_id");
CREATE UNIQUE INDEX "uq_structured_attempts_legacy" ON "structured_attempts"("legacy_source", "legacy_id");
CREATE INDEX "ix_structured_attempts_user_id_submitted_at" ON "structured_attempts"("user_id", "submitted_at" DESC);
CREATE INDEX "ix_structured_attempts_question_id" ON "structured_attempts"("question_id");

-- AddForeignKey
ALTER TABLE "spm_targets" ADD CONSTRAINT "fk_spm_targets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spm_targets" ADD CONSTRAINT "fk_spm_targets_subject_id" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "structured_attempts" ADD CONSTRAINT "fk_structured_attempts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
