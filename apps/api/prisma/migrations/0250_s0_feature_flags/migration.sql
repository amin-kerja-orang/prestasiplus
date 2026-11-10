-- 0250_s0_feature_flags (S0-T10, DM-34): the server-side feature flags behind Kawalan Ciri and the API FeatureGuard.
-- Seeds 32 rows: the 4 S0-T10 keys (`permainan` and `latih-tubi` ON; the locked-OFF `cikgu-alesa` and `keluarga-angkat`, D102)
-- plus the 28 S0-T11 keys of N-06 / P2-19 (folded in per #417 D-1). A key with no row is ON (fail-open).
-- Both INSERTs are ON CONFLICT DO NOTHING, so a re-run after a partial apply is safe.
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
    ('keluarga-angkat', 'Mohon Keluarga Angkat', 'pelajar', false, true, 910)
ON CONFLICT ("key") DO NOTHING;

-- The other 28 keys of the N-06 / P2-19 list (S0-T11 rows, folded into 0250 by the team-aa and team-dd lead ruling
-- on #417 D-1, so there is one migration). All ON except `tiket-bantuan` (Delivery B: OFF until S7-T10 passes, D-2).
-- Their route prefixes and nav ids are S0-T11's. Rows with no prefix yet only list on the page; no row = ON (FR-ADM-N06.4).
INSERT INTO "feature_flags" ("key", "label_ms", "audience", "enabled", "locked", "sort_order") VALUES
    ('misi-harian', 'Misi Harian', 'pelajar', true, false, 20),
    ('kombo', 'Kombo', 'pelajar', true, false, 30),
    ('leaderboard', 'Leaderboard', 'pelajar', true, false, 40),
    ('remedial', 'Remedial', 'pelajar', true, false, 50),
    ('cita-cita', 'Cita-Cita', 'pelajar', true, false, 60),
    ('universiti', 'Universiti', 'pelajar', true, false, 70),
    ('biasiswa', 'Biasiswa', 'pelajar', true, false, 80),
    ('target-spm', 'Target SPM', 'pelajar', true, false, 90),
    ('analisa-item', 'Analisa Item', 'pelajar', true, false, 100),
    ('prestasi', 'Prestasi', 'pelajar', true, false, 110),
    ('psikometrik', 'Psikometrik', 'pelajar', true, false, 120),
    ('profil-cerah', 'Profil Cerah', 'pelajar', true, false, 130),
    ('kemajuan-saya', 'Kemajuan Saya', 'pelajar', true, false, 140),
    ('sejarah-latihan', 'Sejarah Latihan', 'pelajar', true, false, 150),
    ('video-pembelajaran', 'Video Pembelajaran', 'pelajar', true, false, 160),
    ('perutusan', 'Perutusan', 'pelajar', true, false, 170),
    ('panduan-pengguna', 'Panduan Pengguna', 'pelajar', true, false, 180),
    ('tiket-bantuan', 'Tiket Bantuan', 'pelajar', false, false, 190),
    ('guru.headcount', 'Headcount', 'guru', true, false, 300),
    ('guru.misi-harian', 'Misi Harian', 'guru', true, false, 310),
    ('guru.kelas', 'Kelas', 'guru', true, false, 320),
    ('guru.prestasi', 'Prestasi', 'guru', true, false, 330),
    ('guru.monitoring', 'Monitoring', 'guru', true, false, 340),
    ('guru.analisis-item', 'Analisis Item', 'guru', true, false, 350),
    ('guru.gamifikasi', 'Gamifikasi', 'guru', true, false, 360),
    ('guru.broadcast', 'Broadcast', 'guru', true, false, 370),
    ('guru.databank', 'Databank', 'guru', true, false, 380),
    ('guru.sumbang-soalan', 'Sumbang Soalan', 'guru', true, false, 390)
ON CONFLICT ("key") DO NOTHING;
