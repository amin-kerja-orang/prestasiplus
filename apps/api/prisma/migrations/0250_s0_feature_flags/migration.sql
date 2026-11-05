-- 0250_s0_feature_flags (S0-T10, DM-34): the server-side feature flags behind Kawalan Ciri and the API FeatureGuard.
-- Seeds 4 rows: `permainan` and `latih-tubi` (ON) and the locked-OFF `cikgu-alesa` and `keluarga-angkat` (D102).
-- The other 28 keys of N-06 / P2-19 are inserted by S0-T11. A key with no row is ON (fail-open).
--
-- Additive (expand only): no existing table is touched.
-- Reversible: DROP TABLE "feature_flags";

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "label_ms" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "ck_feature_flags_audience" CHECK ("audience" IN ('pelajar', 'guru')),
    -- INV-29: a locked flag is never ON.
    CONSTRAINT "ck_feature_flags_locked_off" CHECK (NOT ("locked" AND "enabled"))
);

-- CreateIndex
CREATE INDEX "ix_feature_flags_audience_sort_order" ON "feature_flags"("audience", "sort_order");

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "fk_feature_flags_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed (labels of the N-06 field spec)
INSERT INTO "feature_flags" ("key", "label_ms", "audience", "enabled", "locked", "sort_order") VALUES
    ('permainan', 'Zona Permainan', 'pelajar', true, false, 10),
    ('latih-tubi', 'Latih Tubi', 'pelajar', true, false, 200),
    ('cikgu-alesa', 'Cikgu Alesa', 'pelajar', false, true, 900),
    ('keluarga-angkat', 'Mohon Keluarga Angkat', 'pelajar', false, true, 910);
