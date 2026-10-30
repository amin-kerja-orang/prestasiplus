-- 0092_bijak_standards (BJS-02, bijak-spm): the SPM blueprint standard model. Written by hand in the
-- style of 0012_bijak_papers (identity columns, enums as text + CHECK, the partial unique indexes and
-- foreign keys to other cards that Prisma cannot express). Design: docs/architecture/v2-bijak-spm-standards.md
-- section 3 and ADR-0023.
--
-- Order matters: (1) leaf-part columns, (2) blueprints (downgrade, add, backfill hash, NOT NULL),
-- (3) blueprint_sections (assert, add, DROP topic_weights), (4) new tables, (5) papers, (6) constraints.
--
-- Backup note (BJS-D1): the only destructive step is DROP COLUMN blueprint_sections.topic_weights. A
-- guard below aborts the migration if any row holds a non-null value, so nothing is lost silently. Take a
-- pg_dump (or table copy of blueprint_sections) before running it on staging/production as usual.
--
-- Reversibility (Prisma has no down migrations; manual rollback, in this order):
--   DROP TRIGGER trg_blueprint_verifications_insert_only ON blueprint_verifications;
--   DROP FUNCTION fn_blueprint_verifications_insert_only();
--   ALTER TABLE blueprints DROP CONSTRAINT fk_blueprints_verification_id;
--   DROP TABLE blueprint_verifications; DROP TABLE blueprint_evidence;
--   ALTER TABLE papers DROP COLUMN standard_report;
--   ALTER TABLE blueprint_sections DROP COLUMN profile, DROP COLUMN quota, DROP COLUMN kbat_marks,
--     DROP COLUMN kbat_reviewed, ADD COLUMN topic_weights JSONB;   -- the column was empty (asserted)
--   ALTER TABLE blueprints DROP COLUMN notes, sub_part_ramp, kbat_marks, level_share, serves_students,
--     structure_hash, verification_id;                              -- the verified -> spec downgrade is not undone
--   ALTER TABLE question_parts DROP COLUMN difficulty_tp, kbat, unit_node_id, form_origin;
--   ALTER TABLE question_versions DROP COLUMN kbat, tag_review, catalogue_version, ADD COLUMN cognitive_level SMALLINT
--     (+ ck_question_versions_cognitive_level 1..6); the copy back is lossy: only 3..6 were kept, and the numbers 1 and 2 are gone.
-- (the indexes and CHECKs go with their tables/columns except uq_blueprints_serving, ix_blueprints_verification_id,
-- ck_blueprints_*: drop those first.)

-- ============================================================================
-- 1. question_parts: TP, KBAT, unit and form per LEAF part (3.1, 3.1a). NULL = inherit the
--    question_versions value; 'bukan' on a part = explicitly not KBAT. No backfill: every existing row inherits.
--    question_versions: the KBAT enum (decision A9, design 14.2) replaces the 1..6 cognitive_level.
-- ============================================================================
ALTER TABLE "question_parts"
  ADD COLUMN "difficulty_tp" SMALLINT,
  ADD COLUMN "kbat" TEXT,
  ADD COLUMN "unit_node_id" BIGINT,
  ADD COLUMN "form_origin" TEXT;

ALTER TABLE "question_versions"
  ADD COLUMN "kbat" TEXT,
  ADD COLUMN "tag_review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "catalogue_version" TEXT;

-- Guard: rows migrated from .cloud/.my never carry a cognitive_level (the ETL leaves it empty). Abort rather than
-- lose a value on such a row; dev/seed rows (no legacy pair) are converted below.
DO $$
DECLARE
  n BIGINT;
BEGIN
  SELECT count(*) INTO n FROM "question_versions" v JOIN "questions" q ON q."id" = v."question_id"
   WHERE v."cognitive_level" IS NOT NULL AND q."legacy_source" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '0092_bijak_standards: % migrated question_versions row(s) hold cognitive_level; review before dropping the column', n;
  END IF;
END
$$;

-- 3 Mengaplikasi, 4 Menganalisis, 5 Menilai, 6 Mencipta become kbat; 1 and 2 (Mengingat, Memahami) were never
-- KBAT and become NULL (= Bukan KBAT).
UPDATE "question_versions" SET "kbat" = CASE "cognitive_level"
  WHEN 3 THEN 'mengaplikasi' WHEN 4 THEN 'menganalisis' WHEN 5 THEN 'menilai' WHEN 6 THEN 'mencipta' END
 WHERE "cognitive_level" >= 3;
ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_cognitive_level";
ALTER TABLE "question_versions" DROP COLUMN "cognitive_level";

-- ============================================================================
-- 2. blueprints (3.2)
-- ============================================================================
-- A Disahkan row can only exist under the new verification rule (verification_id is non-null iff
-- verified). Existing rows are PoC/demo Spec data; any 'verified' row is downgraded first.
UPDATE "blueprints" SET "source" = 'spec' WHERE "source" = 'verified';

ALTER TABLE "blueprints"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "sub_part_ramp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "kbat_marks" SMALLINT,
  ADD COLUMN "level_share" JSONB,
  ADD COLUMN "serves_students" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "structure_hash" TEXT,
  ADD COLUMN "verification_id" BIGINT;

-- Structure-hash backfill. Hashes the STRUCTURAL content of design 3.5 (cosmetic notes, instructions,
-- reference_sheets, section label and instruction are excluded) as the canonical text of one jsonb
-- document (jsonb prints keys in a fixed order, so the text is deterministic), sha-256 hex.
-- NOTE for BJS-08: this is a one-time legacy value computed in SQL. The service canonicaliser is the
-- authority for new rows; if its canonical form differs, the first new version of a pre-existing blueprint
-- simply reads as a structural change (source = spec), which is the safe direction.
UPDATE "blueprints" b
SET "structure_hash" = encode(
  sha256(
    convert_to(
      jsonb_build_object(
        'subjectId', b."subject_id"::text,
        'kertas', b."kertas",
        'code', b."code",
        'durationMin', b."duration_min",
        'totalMarks', b."total_marks",
        'kbatMarks', b."kbat_marks",
        'levelShare', b."level_share",
        'subPartRamp', b."sub_part_ramp",
        'sections', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'position', s."position",
              'ruleType', s."rule_type",
              'ruleN', s."rule_n",
              'questionCount', s."question_count",
              'markBudget', s."mark_budget",
              'allowedModes', to_jsonb(s."allowed_modes"),
              'pool', s."pool",
              'compulsory', s."compulsory"
            )
            ORDER BY s."position"
          )
          FROM "blueprint_sections" s
          WHERE s."blueprint_id" = b."id"
        ), '[]'::jsonb)
      )::text,
      'UTF8'
    )
  ),
  'hex'
);
ALTER TABLE "blueprints" ALTER COLUMN "structure_hash" SET NOT NULL;
-- cognitive_mix stays (superseded by sections.profile, no longer read or written; dropped in a later cleanup, design 3.2).

-- ============================================================================
-- 3. blueprint_sections (3.3)
-- ============================================================================
-- Guard: topic_weights is never read or written; abort rather than lose data if a row has a value.
DO $$
DECLARE
  n BIGINT;
BEGIN
  SELECT count(*) INTO n FROM "blueprint_sections" WHERE "topic_weights" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '0092_bijak_standards: % blueprint_sections row(s) hold topic_weights; back them up and review before dropping the column', n;
  END IF;
END
$$;

ALTER TABLE "blueprint_sections"
  ADD COLUMN "profile" JSONB,
  ADD COLUMN "quota" JSONB,
  ADD COLUMN "kbat_marks" SMALLINT,
  ADD COLUMN "kbat_reviewed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "blueprint_sections" DROP COLUMN "topic_weights";

-- ============================================================================
-- 4. blueprint_evidence, blueprint_verifications (3.4)
-- ============================================================================
-- CreateTable
CREATE TABLE "blueprint_evidence" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "blueprint_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "year" SMALLINT NOT NULL,
    "paper_code" TEXT NOT NULL,
    "set_label" TEXT,
    "source_ref" TEXT,
    "values" JSONB NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'admin',
    "note" TEXT,
    "created_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_verifications" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "blueprint_id" BIGINT NOT NULL,
    "verified_by_id" BIGINT NOT NULL,
    "verifier_role" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "structure_hash" TEXT NOT NULL,
    "check_result" JSONB NOT NULL,
    "evidence_snapshot" JSONB NOT NULL,

    CONSTRAINT "blueprint_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_blueprint_evidence_blueprint_id" ON "blueprint_evidence"("blueprint_id");

-- CreateIndex
CREATE INDEX "ix_blueprint_verifications_blueprint_id" ON "blueprint_verifications"("blueprint_id");

-- ============================================================================
-- 5. papers (3.6)
-- ============================================================================
ALTER TABLE "papers" ADD COLUMN "standard_report" JSONB;

-- ============================================================================
-- 6. Foreign keys, CHECK constraints, partial indexes
-- ============================================================================
-- AddForeignKey
ALTER TABLE "question_parts" ADD CONSTRAINT "fk_question_parts_unit_node_id" FOREIGN KEY ("unit_node_id") REFERENCES "curriculum_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blueprint_evidence" ADD CONSTRAINT "fk_blueprint_evidence_blueprint_id" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blueprint_evidence" ADD CONSTRAINT "fk_blueprint_evidence_created_by_id" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- A verification row is an audit record: its version and its verifier cannot be deleted from under it.
ALTER TABLE "blueprint_verifications" ADD CONSTRAINT "fk_blueprint_verifications_blueprint_id" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blueprint_verifications" ADD CONSTRAINT "fk_blueprint_verifications_verified_by_id" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blueprints" ADD CONSTRAINT "fk_blueprints_verification_id" FOREIGN KEY ("verification_id") REFERENCES "blueprint_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- question_parts: 1..6 values, form codes, and "leaf only" (a branch part, mode IS NULL, never carries them).
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_difficulty_tp"
  CHECK ("difficulty_tp" IS NULL OR "difficulty_tp" BETWEEN 1 AND 6);
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_kbat"
  CHECK ("kbat" IS NULL OR "kbat" IN ('mengaplikasi', 'menganalisis', 'menilai', 'mencipta', 'bukan'));
ALTER TABLE "question_versions" ADD CONSTRAINT "ck_question_versions_kbat"
  CHECK ("kbat" IS NULL OR "kbat" IN ('mengaplikasi', 'menganalisis', 'menilai', 'mencipta'));
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_form_origin"
  CHECK ("form_origin" IS NULL OR "form_origin" IN ('t1_t3', 't4', 't5'));
ALTER TABLE "question_parts" ADD CONSTRAINT "ck_question_parts_standard_leaf_only"
  CHECK ("mode" IS NOT NULL OR ("difficulty_tp" IS NULL AND "kbat" IS NULL AND "unit_node_id" IS NULL AND "form_origin" IS NULL));

-- blueprints: the verification and serving rules (3.2).
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_verification"
  CHECK ("source" <> 'verified' OR "verification_id" IS NOT NULL);
-- Design 3.2 states only the implication verified -> verification_id; the converse ("non-null iff
-- verified", schema comment and 6.3) is enforced here so a spec/draft row never carries a verification.
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_verification_only_verified"
  CHECK ("verification_id" IS NULL OR "source" = 'verified');
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_serves_students"
  CHECK ("serves_students" = false OR "source" = 'verified');
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_kbat_marks"
  CHECK ("kbat_marks" IS NULL OR "kbat_marks" >= 0);
ALTER TABLE "blueprints" ADD CONSTRAINT "ck_blueprints_structure_hash"
  CHECK ("structure_hash" ~ '^[0-9a-f]{64}$');
-- At most one serving row per subject and kertas.
CREATE UNIQUE INDEX "uq_blueprints_serving" ON "blueprints" ("subject_id", "kertas") WHERE "serves_students";
CREATE INDEX "ix_blueprints_verification_id" ON "blueprints" ("verification_id") WHERE "verification_id" IS NOT NULL;

ALTER TABLE "blueprint_sections" ADD CONSTRAINT "ck_blueprint_sections_kbat_marks"
  CHECK ("kbat_marks" IS NULL OR "kbat_marks" >= 0);

ALTER TABLE "blueprint_evidence" ADD CONSTRAINT "ck_blueprint_evidence_kind"
  CHECK ("kind" IN ('trial_paper', 'skema', 'lpm_format'));
ALTER TABLE "blueprint_evidence" ADD CONSTRAINT "ck_blueprint_evidence_body"
  CHECK ("body" ~ '^[a-z0-9_]{1,64}$');
ALTER TABLE "blueprint_evidence" ADD CONSTRAINT "ck_blueprint_evidence_origin"
  CHECK ("origin" IN ('study', 'admin'));
ALTER TABLE "blueprint_evidence" ADD CONSTRAINT "ck_blueprint_evidence_year"
  CHECK ("year" BETWEEN 1990 AND 2100);

ALTER TABLE "blueprint_verifications" ADD CONSTRAINT "ck_blueprint_verifications_verifier_role"
  CHECK ("verifier_role" = 'admin');
ALTER TABLE "blueprint_verifications" ADD CONSTRAINT "ck_blueprint_verifications_structure_hash"
  CHECK ("structure_hash" ~ '^[0-9a-f]{64}$');

-- Insert-only (AC-39.2): a verification is never updated or deleted.
CREATE FUNCTION "fn_blueprint_verifications_insert_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'blueprint_verifications is insert-only (% rejected)', TG_OP USING ERRCODE = 'restrict_violation';
END
$$;
CREATE TRIGGER "trg_blueprint_verifications_insert_only"
  BEFORE UPDATE OR DELETE ON "blueprint_verifications"
  FOR EACH ROW EXECUTE FUNCTION "fn_blueprint_verifications_insert_only"();
