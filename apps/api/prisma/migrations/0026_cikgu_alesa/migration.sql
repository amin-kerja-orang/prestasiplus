-- 0026_cikgu_alesa (BE-43): chat_threads, chat_messages, rph_plans, essay_markings, pbd_tags (M13 Cikgu Alesa).
-- RENUMBER AT MERGE: 0019 to 0025 are taken by open pull requests. The LEAD renumbers this folder to the next free
-- number when the card merges (the content does not depend on its number; it only needs users and classrooms, which exist
-- since 0002 and 0015).
-- Hand-written in the style of `prisma migrate diff` output: identity columns (GENERATED ALWAYS), CHECK constraints
-- (enums are text + check), the partial index on pending PBD tags and the foreign keys to tables of other owners
-- (users, classrooms), which the Prisma schema does not declare as relations (see cikgu.prisma). Plan 14.2, data model 3.13.
-- chat_threads and chat_messages carry the legacy_* pair (the v2 side of .cloud chatbot_conversations / chatbot_messages,
-- nothing is loaded in B1); rph_plans, essay_markings and pbd_tags are born in v2 and have no source.

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "thread_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tool" TEXT,
    "tool_hops" SMALLINT NOT NULL DEFAULT 0,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "legacy_source" TEXT,
    "legacy_id" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rph_plans" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "tajuk" TEXT NOT NULL,
    "class_name" TEXT,
    "lesson_date" DATE NOT NULL,
    "duration_minutes" SMALLINT NOT NULL DEFAULT 60,
    "time_slot" TEXT,
    "tema" TEXT,
    "pengajaran_keperluan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "thread_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rph_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_markings" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "rubric_key" TEXT NOT NULL,
    "subject_name" TEXT,
    "level" TEXT,
    "student_name" TEXT,
    "essay_title" TEXT,
    "essay_text" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "max_marks" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "thread_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_test" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "essay_markings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pbd_tags" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "classroom_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "sp" TEXT NOT NULL,
    "skor" DECIMAL(4,1) NOT NULL,
    "tp" SMALLINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "is_test" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pbd_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_chat_threads_legacy" ON "chat_threads"("legacy_source", "legacy_id");

-- CreateIndex
CREATE INDEX "ix_chat_threads_user_id_updated_at" ON "chat_threads"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_chat_messages_legacy" ON "chat_messages"("legacy_source", "legacy_id");

-- CreateIndex (the daily quota count, BR-M13-06)
CREATE INDEX "ix_chat_messages_user_id_created_at" ON "chat_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_chat_messages_thread_id_created_at" ON "chat_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_rph_plans_user_id_lesson_date_id" ON "rph_plans"("user_id", "lesson_date" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ix_rph_plans_thread_id" ON "rph_plans"("thread_id");

-- CreateIndex
CREATE INDEX "ix_essay_markings_user_id_created_at_id" ON "essay_markings"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ix_essay_markings_thread_id" ON "essay_markings"("thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pbd_tags_user_id_classroom_id_student_id_sp" ON "pbd_tags"("user_id", "classroom_id", "student_id", "sp");

-- CreateIndex
CREATE INDEX "ix_pbd_tags_classroom_id" ON "pbd_tags"("classroom_id");

-- CreateIndex
CREATE INDEX "ix_pbd_tags_student_id" ON "pbd_tags"("student_id");

-- The approval queue: pending tags of a teacher, newest roll-up first (partial index, not expressible in Prisma).
CREATE INDEX "ix_pbd_tags_pending" ON "pbd_tags"("user_id", "created_at" DESC) WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "fk_chat_messages_thread_id" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A marking belongs to the thread that produced it; an RPH made on the form has no thread, one made in the chat keeps a
-- link that is cleared (not the plan) if the thread is ever deleted.
ALTER TABLE "rph_plans" ADD CONSTRAINT "fk_rph_plans_thread_id" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "essay_markings" ADD CONSTRAINT "fk_essay_markings_thread_id" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys to tables of other owners (not Prisma relations, see cikgu.prisma). The records are personal to their
-- owner, so they go with the user; a deleted class or student removes its tags.
ALTER TABLE "chat_threads" ADD CONSTRAINT "fk_chat_threads_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "fk_chat_messages_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rph_plans" ADD CONSTRAINT "fk_rph_plans_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "essay_markings" ADD CONSTRAINT "fk_essay_markings_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pbd_tags" ADD CONSTRAINT "fk_pbd_tags_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pbd_tags" ADD CONSTRAINT "fk_pbd_tags_classroom_id" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pbd_tags" ADD CONSTRAINT "fk_pbd_tags_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row convention checks (plan 14.2): legacy_source, on the two tables that carry the pair. NULL passes a CHECK.
ALTER TABLE "chat_threads" ADD CONSTRAINT "ck_chat_threads_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));
ALTER TABLE "chat_messages" ADD CONSTRAINT "ck_chat_messages_legacy_source" CHECK ("legacy_source" IN ('cloud', 'my'));

-- Enums as text + check (English codes of @pp/contract: CikguChatTool, CikguRubricKey, CikguLevelCode, rph status and source).
ALTER TABLE "chat_messages" ADD CONSTRAINT "ck_chat_messages_role" CHECK ("role" IN ('user', 'bot'));
ALTER TABLE "chat_messages" ADD CONSTRAINT "ck_chat_messages_tool" CHECK ("tool" IS NULL OR "tool" IN ('mark_essay', 'rph', 'practice'));
ALTER TABLE "chat_messages" ADD CONSTRAINT "ck_chat_messages_tool_hops" CHECK ("tool_hops" IN (0, 1));
ALTER TABLE "chat_messages" ADD CONSTRAINT "ck_chat_messages_tokens" CHECK ("tokens_in" >= 0 AND "tokens_out" >= 0);
ALTER TABLE "rph_plans" ADD CONSTRAINT "ck_rph_plans_level" CHECK ("level" IN ('D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5'));
ALTER TABLE "rph_plans" ADD CONSTRAINT "ck_rph_plans_status" CHECK ("status" IN ('generated'));
ALTER TABLE "rph_plans" ADD CONSTRAINT "ck_rph_plans_source" CHECK ("source" IN ('form', 'chat'));
ALTER TABLE "rph_plans" ADD CONSTRAINT "ck_rph_plans_duration_minutes" CHECK ("duration_minutes" BETWEEN 15 AND 240);
ALTER TABLE "rph_plans" ADD CONSTRAINT "ck_rph_plans_subject_name" CHECK (char_length(btrim("subject_name")) BETWEEN 1 AND 100);
ALTER TABLE "rph_plans" ADD CONSTRAINT "ck_rph_plans_tajuk" CHECK (char_length(btrim("tajuk")) BETWEEN 1 AND 200);
ALTER TABLE "essay_markings" ADD CONSTRAINT "ck_essay_markings_rubric_key" CHECK ("rubric_key" IN ('spm_bm_karangan', 'spm_bi_continuous_writing', 'pt3_bm_karangan', 'pt3_bi_essay', 'sejarah_essay', 'general'));
ALTER TABLE "essay_markings" ADD CONSTRAINT "ck_essay_markings_marks" CHECK ("marks" >= 0 AND "max_marks" >= 1 AND "marks" <= "max_marks");
ALTER TABLE "pbd_tags" ADD CONSTRAINT "ck_pbd_tags_status" CHECK ("status" IN ('pending', 'approved'));
ALTER TABLE "pbd_tags" ADD CONSTRAINT "ck_pbd_tags_tp" CHECK ("tp" BETWEEN 1 AND 6);
ALTER TABLE "pbd_tags" ADD CONSTRAINT "ck_pbd_tags_skor" CHECK ("skor" BETWEEN 0 AND 100);
