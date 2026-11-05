-- 0251_s0_feature_flags_full (S0-T11, DM-34): the other 28 Kawalan Ciri rows (R1-ADM-N-06 / R1-ADM-P2-19).
-- 0250 seeded 4 rows (permainan 10, latih-tubi 200, cikgu-alesa 900, keluarga-angkat 910); this adds 18 Pelajar and 10 Guru
-- rows, 32 in all. Every new row is ON except `tiket-bantuan` (Delivery B: OFF until S7-T10 passes, then the admin
-- switches it ON on UAT, no deploy). No key is locked here.
--
-- Data only, no schema change. Idempotent: ON CONFLICT DO NOTHING keeps any row an admin has already switched.
-- Reversible: DELETE FROM "feature_flags" WHERE "key" IN (<the 28 keys below>);

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
