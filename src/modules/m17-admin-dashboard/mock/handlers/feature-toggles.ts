/**
 * `GET /api/admin/feature-toggles` (API-ADM-09, S0-T10): the Kawalan Ciri rows in `sort_order`, Admin Pusat only
 * (401 without a session, 403 for any other role). Read-only in the mock.
 *
 * Rows: the 32 keys the V3 migration `apps/api/prisma/migrations/0250_s0_feature_flags` seeds (labels of the
 * N-06 field spec; the pelajar and guru labels follow V2 `backend/config/features.php`). No row is invented here.
 */

import type { FeatureToggle } from '@pp/contract'

import { ok, requireRole, route, type RouteDef } from '@/mock/define'

type Row = readonly [key: string, label: string, audience: 'pelajar' | 'guru', enabled: boolean, locked: boolean]

/** In `sort_order` (10, 20, 30 ... 910) as the migration seeds them. */
const SEED: readonly Row[] = [
  ['permainan', 'Zona Permainan', 'pelajar', true, false],
  ['misi-harian', 'Misi Harian', 'pelajar', true, false],
  ['kombo', 'Kombo', 'pelajar', true, false],
  ['leaderboard', 'Leaderboard', 'pelajar', true, false],
  ['remedial', 'Remedial', 'pelajar', true, false],
  ['cita-cita', 'Cita-Cita', 'pelajar', true, false],
  ['universiti', 'Universiti', 'pelajar', true, false],
  ['biasiswa', 'Biasiswa', 'pelajar', true, false],
  ['target-spm', 'Target SPM', 'pelajar', true, false],
  ['analisa-item', 'Analisa Item', 'pelajar', true, false],
  ['prestasi', 'Prestasi', 'pelajar', true, false],
  ['psikometrik', 'Psikometrik', 'pelajar', true, false],
  ['profil-cerah', 'Profil Cerah', 'pelajar', true, false],
  ['kemajuan-saya', 'Kemajuan Saya', 'pelajar', true, false],
  ['sejarah-latihan', 'Sejarah Latihan', 'pelajar', true, false],
  ['video-pembelajaran', 'Video Pembelajaran', 'pelajar', true, false],
  ['perutusan', 'Perutusan', 'pelajar', true, false],
  ['panduan-pengguna', 'Panduan Pengguna', 'pelajar', true, false],
  ['tiket-bantuan', 'Tiket Bantuan', 'pelajar', false, false],
  ['latih-tubi', 'Latih Tubi', 'pelajar', true, false],
  ['guru.headcount', 'Headcount', 'guru', true, false],
  ['guru.misi-harian', 'Misi Harian', 'guru', true, false],
  ['guru.kelas', 'Kelas', 'guru', true, false],
  ['guru.prestasi', 'Prestasi', 'guru', true, false],
  ['guru.monitoring', 'Monitoring', 'guru', true, false],
  ['guru.analisis-item', 'Analisis Item', 'guru', true, false],
  ['guru.gamifikasi', 'Gamifikasi', 'guru', true, false],
  ['guru.broadcast', 'Broadcast', 'guru', true, false],
  ['guru.databank', 'Databank', 'guru', true, false],
  ['guru.sumbang-soalan', 'Sumbang Soalan', 'guru', true, false],
  ['cikgu-alesa', 'Cikgu Alesa', 'pelajar', false, true],
  ['keluarga-angkat', 'Mohon Keluarga Angkat', 'pelajar', false, true],
]

const toggles = (): FeatureToggle[] =>
  SEED.map(([key, labelMs, audience, enabled, locked]) => ({ key, labelMs, audience, enabled, locked }))

export const featureToggleRoutes: RouteDef[] = [
  route('GET', '/api/admin/feature-toggles', [requireRole('admin')], () => ok(toggles())),
]
