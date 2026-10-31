-- 0104_paper_section_admin_created (R1-T48, builder parity with the V2 Panel "Semak Kertas Simulasi": "Tambah bahagian" / "Tambah soalan").
-- Number 0104 is in team A's range 0104-0109.
--
--   paper_sections.admin_created  boolean NOT NULL DEFAULT false
--
-- V2 lets an admin add a Bahagian that the blueprint (Kontrak) does not have; only such a Bahagian takes "Tambah soalan" (a question created
-- inside the paper). The flag tells a Kontrak Bahagian (false: every existing row) from an admin-added one (true). The question count and the
-- mark budget of an admin-added Bahagian follow its placements (no Kontrak value exists for them); a Terbit paper freezes them.
-- ADDITIVE ONLY: one NOT NULL column with a constant default, no table rewrite problem for the paper_sections volume.
--
-- Reversible:
--   ALTER TABLE "paper_sections" DROP COLUMN "admin_created";

ALTER TABLE "paper_sections" ADD COLUMN "admin_created" BOOLEAN NOT NULL DEFAULT false;
