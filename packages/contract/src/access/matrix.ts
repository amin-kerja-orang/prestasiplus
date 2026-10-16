import type { AccessGroup, AccessGroupId, LearningMenuGroup, MatrixItem, RoleModes } from './schema'

/**
 * Portal Pentadbiran access matrix: docs/requirements/v2-portals.md sections 5 and 6 (94 items).
 * Cell codes: F full, R read-only, S scoped (own school), D district/state read-only, '-' hidden.
 * Menu visibility = any non-hidden mode (4.2). Routes are PROPOSED (`/admin/<group>/<item>`); the
 * route mapping is owned by V2-T14. Capability key = `admin.<group>.<item-slug>.read`.
 * Bank Soalan (D40a): Admin Pusat approves/publishes; no Sekolah/PPD access (Guru verifies own
 * uploads on the learning side). Question-bank screens are held (D39a) but still listed.
 */
export const ACCESS_GROUPS: readonly AccessGroup[] = [
  { id: 'papan-pemuka', order: 1, labelBm: 'Papan Pemuka' },
  { id: 'pemantauan', order: 2, labelBm: 'Pemantauan' },
  { id: 'bank-soalan', order: 3, labelBm: 'Bank Soalan' },
  { id: 'kertas-spm', order: 4, labelBm: 'Kertas & SPM' },
  { id: 'kurikulum-kandungan', order: 5, labelBm: 'Kurikulum & Kandungan' },
  { id: 'pengguna-sekolah', order: 6, labelBm: 'Pengguna & Sekolah' },
  { id: 'penglibatan', order: 7, labelBm: 'Penglibatan' },
  { id: 'kewangan', order: 8, labelBm: 'Kewangan' },
  { id: 'sistem', order: 9, labelBm: 'Sistem' },
]

type Cell = 'F' | 'R' | 'S' | 'D' | '-'
/** [id, labelBm, admin, ppd_officer, school_admin, ppdOnly?] in doc order. */
type Row = readonly [string, string, Cell, Cell, Cell, boolean?]

const ROWS: Record<AccessGroupId, readonly Row[]> = {
  'papan-pemuka': [
    ['PP-01', 'Dashboard', 'F', '-', 'S'],
    ['PP-02', 'Laporan Eksekutif', 'F', '-', 'S'],
  ],
  pemantauan: [
    ['PM-01', 'Langsung', 'F', 'R', 'S', true],
    ['PM-02', 'Aktiviti Harian', 'F', '-', 'S'],
    ['PM-03', 'Monitoring', 'F', '-', 'S'],
    ['PM-04', 'Analitik', 'F', '-', 'S'],
    ['PM-05', 'Kirkpatrick › Ringkasan', 'F', '-', 'S'],
    ['PM-06', 'Kirkpatrick › T1: Reaksi', 'F', '-', 'S'],
    ['PM-07', 'Kirkpatrick › T2: Pembelajaran', 'F', '-', 'S'],
    ['PM-08', 'Kirkpatrick › T3: Tingkah Laku', 'F', '-', 'S'],
    ['PM-09', 'Kirkpatrick › T4: Hasil', 'F', '-', 'S'],
    ['PM-10', 'Kirkpatrick › Rantaian Impak', 'F', '-', 'S'],
    ['PM-11', 'Kirkpatrick › Intervensi', 'F', '-', 'S'],
    ['PM-12', 'Laporan Aktiviti', 'F', '-', 'S'],
    ['PM-13', 'Amaran Wellbeing', 'F', '-', 'S'],
    ['PM-14', 'Papan Pemuka Wilayah', 'F', 'D', '-'],
    ['PM-15', 'Statistik Penggunaan', 'F', 'D', 'S'],
    ['PM-16', 'Ranking Kebangsaan', 'F', 'D', '-'],
    ['PM-17', 'Benchmark Sekolah', 'F', 'D', '-', true],
    ['PM-18', 'Leaderboard Sekolah', 'F', 'D', '-', true],
    ['PM-19', 'Peta Haba', 'F', 'D', '-', true],
    ['PM-20', 'Export Laporan', 'F', 'D', '-', true],
    ['PM-21', 'DSKP Heatmap', 'F', '-', 'S'],
    ['PM-22', 'Amaran Awal', 'F', '-', 'S'],
    ['PM-23', 'Laporan Bulanan', 'F', '-', 'S'],
  ],
  'bank-soalan': [
    ['BS-01', 'Bank Soalan', 'F', '-', '-'],
    ['BS-02', 'Import & Semakan', 'F', '-', '-'],
    ['BS-03', 'Sumber Kertas', 'F', '-', '-'],
    ['BS-04', 'Kualiti Soalan', 'F', '-', '-'],
    ['BS-05', 'Laporan Soalan', 'F', '-', '-'],
    ['BS-06', 'Soalan PKSK', 'F', '-', '-'],
    ['BS-07', 'Audio KBAT', 'F', '-', '-'],
  ],
  'kertas-spm': [
    ['KS-01', 'Gambaran SPM', 'F', '-', '-'],
    ['KS-02', 'Databank Soalan', 'F', '-', '-'],
    ['KS-03', 'Latih Tubi', 'F', '-', '-'],
    ['KS-04', 'Tracking A', 'F', '-', '-'],
    ['KS-05', 'Subjektif', 'F', '-', '-'],
    ['KS-06', 'Bijak SPM (Simulasi)', 'F', '-', '-'],
    ['KS-07', 'Kertas Subjektif', 'F', '-', '-'],
    ['KS-08', 'Kontrak Simulasi', 'F', '-', '-'],
    ['KS-09', 'Set Builder', 'F', '-', '-'],
    ['KS-10', 'Tanda Karangan', 'F', '-', '-'],
    ['KS-11', 'Ramalan SPM', 'F', '-', '-'],
    ['KS-12', 'Set Soalan', 'F', '-', '-'],
  ],
  'kurikulum-kandungan': [
    ['KK-01', 'Kurikulum', 'F', '-', '-'],
    ['KK-02', 'Subjek', 'F', '-', '-'],
    ['KK-03', 'Bab', 'F', '-', '-'],
    ['KK-04', 'Tahap Pendidikan', 'F', '-', '-'],
    ['KK-05', 'Banner', 'F', '-', '-'],
    ['KK-06', 'Artikel', 'F', '-', '-'],
    ['KK-07', 'Nota', 'F', '-', '-'],
    ['KK-08', 'Video', 'F', '-', '-'],
    ['KK-09', 'Laluan Kerjaya', 'F', '-', '-'],
    ['KK-10', 'Universiti', 'F', '-', '-'],
    ['KK-11', 'Biasiswa', 'F', '-', '-'],
  ],
  'pengguna-sekolah': [
    ['PS-01', 'Pengguna', 'F', 'D', 'S'],
    ['PS-02', 'Sekolah', 'F', 'D', 'S'],
    ['PS-03', 'Kelas Sekolah', 'F', 'D', 'S'],
    ['PS-04', 'Import Pelajar', 'F', '-', 'S'],
    ['PS-05', 'Import Pengguna', 'F', '-', 'S'],
    ['PS-06', 'Pelajar Komplimen', 'F', '-', '-'],
  ],
  penglibatan: [
    ['PG-01', 'Gamifikasi › Overview', 'F', '-', '-'],
    ['PG-02', 'Gamifikasi › Tier Config (Kadar Tukaran Syiling)', 'F', '-', '-'],
    ['PG-03', 'Gamifikasi › Cabaran', 'F', '-', '-'],
    ['PG-04', 'Gamifikasi › Pelajar', 'F', '-', '-'],
    ['PG-05', 'Gamifikasi › Transaksi', 'F', '-', '-'],
    ['PG-06', 'Gamifikasi › Kedai Hadiah', 'F', '-', '-'],
    ['PG-07', 'Gamifikasi › Gamifikasi Guru', 'F', '-', '-'],
    ['PG-08', 'Gamifikasi › Lencana Guru', 'F', '-', '-'],
    ['PG-09', 'Gamifikasi › Cabutan', 'F', '-', '-'],
    ['PG-10', 'Gamifikasi › Kawalan Reward', 'F', '-', '-'],
    ['PG-11', 'Permainan › Tetapan Permainan', 'F', '-', '-'],
    ['PG-12', 'Permainan › Ranking Sekolah (Battle)', 'R', '-', '-'],
    ['PG-13', 'Permainan › Leaderboard (Battle)', 'R', '-', '-'],
    ['PG-14', 'Marketplace › Produk', 'F', '-', '-'],
    ['PG-15', 'Marketplace › Penjual', 'F', '-', '-'],
    ['PG-16', 'Penajaan', 'F', '-', '-'],
    ['PG-17', 'Anak Angkat', 'F', '-', '-'],
    ['PG-18', 'Permohonan Anak Angkat', 'F', '-', '-'],
    ['PG-19', 'Permohonan Duta', 'F', '-', '-'],
    ['PG-20', 'Push Notifikasi', 'F', '-', '-'],
    ['PG-21', 'Chatbot', 'F', '-', '-'],
    ['PG-22', 'Tiket Bantuan', 'F', '-', '-'],
  ],
  kewangan: [
    ['KW-01', 'Pembayaran', 'F', '-', 'S'],
    ['KW-02', 'Billing Dashboard', 'F', '-', 'S'],
    ['KW-03', 'Invois', 'F', '-', 'S'],
    ['KW-04', 'Dunning Log', 'F', '-', 'S'],
    ['KW-05', 'Langganan Sekolah', 'F', '-', 'S'],
    ['KW-06', 'Akses PKSK', 'F', '-', 'S'],
  ],
  sistem: [
    ['SY-01', 'Tetapan', 'F', '-', '-'],
    ['SY-02', 'Kawalan Ciri', 'F', '-', '-'],
    ['SY-03', 'Prestasi Sistem', 'F', '-', '-'],
    ['SY-04', 'Log Audit', 'F', '-', '-'],
    ['SY-05', 'Upload Screenshot', 'F', '-', '-'],
  ],
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toModes(admin: Cell, ppd: Cell, school: Cell): RoleModes {
  const modes: RoleModes = {}
  if (admin !== '-') modes.admin = admin
  if (ppd !== '-') modes.ppd_officer = ppd
  if (school !== '-') modes.school_admin = school
  return modes
}

export const ACCESS_MATRIX: readonly MatrixItem[] = ACCESS_GROUPS.flatMap((group) =>
  ROWS[group.id].map(([id, labelBm, admin, ppd, school, ppdOnly]): MatrixItem => {
    const slug = slugify(labelBm)
    return {
      id,
      group: group.id,
      labelBm,
      route: id === 'PP-01' ? '/admin' : `/admin/${group.id}/${slug}`,
      capability: `admin.${group.id}.${slug}.read`,
      modes: toModes(admin, ppd, school),
      ppdOnly: ppdOnly === true,
    }
  }),
)

const lg = (
  role: LearningMenuGroup['role'],
  order: number,
  labelBm: string | null,
  items: string[] = [],
  labelSource: LearningMenuGroup['labelSource'] = 'doc',
): LearningMenuGroup => ({ role, order, labelBm, items, labelSource })

/** Portal Pembelajaran menus at group level (v2-portals section 8), exact BM copy where given. */
export const LEARNING_MENU: readonly LearningMenuGroup[] = [
  lg('student', 1, null, ['Dashboard', 'Target SPM', 'Misi Harian', 'Remedial']),
  lg('student', 2, 'SPM'),
  lg('student', 3, 'Pembelajaran'),
  lg('student', 4, 'Pusat AI', [
    '✨ Cita-Cita Hijrah',
    '🔥 Streak & Syiling',
    '📝 Nota Ringkas',
    '🤖 Cikgu Alesa AI',
    '✨ Visi & Pertandingan',
    '🤖 AI Pintar (Pelajar)',
  ]),
  lg('student', 5, '🏆 Bilik Duta'),
  lg('student', 6, '✨ Visi & Pertandingan'),
  lg('student', 7, '💎 Killer Features'),
  lg('student', 8, 'Akaun & Bantuan', [
    'Profil Saya',
    'Tetapan Peribadi',
    'Panduan',
    'Tiket Bantuan',
    'Log Keluar',
  ]),
  lg('teacher', 1, 'Command Center (LIVE)'),
  lg('teacher', 2, 'HARIAN'),
  lg('teacher', 3, 'PENGAJARAN'),
  lg('teacher', 4, 'PENILAIAN'),
  lg('teacher', 5, 'ANALITIK', ['Monitoring', 'Kirkpatrick']),
  lg('teacher', 6, 'PUSAT AI'),
  lg('teacher', 7, 'BANK SOALAN'),
  lg('teacher', 8, 'AKTIVITI'),
  lg('teacher', 9, 'LAIN-LAIN'),
  lg('teacher', 10, 'Bantuan'),
  lg('parent', 1, 'Dashboard'),
  lg('parent', 2, 'Anak Berpaut & Kelulusan Persetujuan', [], 'proposed'),
  lg('parent', 3, 'Akaun & Bantuan'),
  lg('sponsor', 1, 'Penaja', [], 'proposed'),
  lg('sponsor', 2, 'Akaun & Bantuan'),
]
