-- 0131_s1_stimulus_kinds (S1-T01 part 4, DM-70)
-- Purpose: one closed vocabulary of 7 stimulus kinds (passage, diagram, table, graph, map, infographic, image) on stimuli.kind
-- and intake_stimuli.kind, plus a presentation hint column stimuli.style (`kotak` on a passage, `mono` for the code block).
-- Lead decision (final, overrides the data-model doc):
--   * stimuli.style is a nullable text with NO check constraint (the set of styles is owned by the application).
--   * 'audio' STAYS allowed in ck_stimuli_kind so existing rows stay valid; ck_stimuli_kind is therefore not touched here
--     (migration 0011 already allows the 7 kinds plus audio). The write contract offers only the 7 kinds.
--   * ck_intake_stimuli_kind is WIDENED from (diagram, passage, table) to the 7 kinds. Additive: every old row stays valid.
-- Reversible: see the rollback note at the end of the file.

ALTER TABLE "stimuli" ADD COLUMN "style" TEXT;

-- Widen ck_intake_stimuli_kind: add the new check NOT VALID under a temporary name, validate, drop the old one, rename.
ALTER TABLE "intake_stimuli" ADD CONSTRAINT "ck_intake_stimuli_kind_new"
  CHECK ("kind" IN ('passage', 'diagram', 'table', 'graph', 'map', 'infographic', 'image')) NOT VALID;
ALTER TABLE "intake_stimuli" VALIDATE CONSTRAINT "ck_intake_stimuli_kind_new";
ALTER TABLE "intake_stimuli" DROP CONSTRAINT "ck_intake_stimuli_kind";
ALTER TABLE "intake_stimuli" RENAME CONSTRAINT "ck_intake_stimuli_kind_new" TO "ck_intake_stimuli_kind";

-- Rollback (manual; rows using the new kinds must be removed or recoded first):
--   ALTER TABLE "intake_stimuli" ADD CONSTRAINT "ck_intake_stimuli_kind_old" CHECK ("kind" IN ('diagram', 'passage', 'table')) NOT VALID;
--   ALTER TABLE "intake_stimuli" VALIDATE CONSTRAINT "ck_intake_stimuli_kind_old";
--   ALTER TABLE "intake_stimuli" DROP CONSTRAINT "ck_intake_stimuli_kind";
--   ALTER TABLE "intake_stimuli" RENAME CONSTRAINT "ck_intake_stimuli_kind_old" TO "ck_intake_stimuli_kind";
--   ALTER TABLE "stimuli" DROP COLUMN "style";
