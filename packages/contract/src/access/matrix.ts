import type {
  AccessGroup,
  AccessGroupId,
  LearningMenuGroup,
  MatrixItem,
  PrototypeItem,
  RoleModes,
} from './schema'

/**
 * Portal Pentadbiran access matrix: docs/requirements/v2-portals.md sections 5 and 6 (100 items).
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
    ['PM-13', 'Amaran Kesejahteraan', 'F', '-', 'S'],
    ['PM-14', 'Papan Pemuka Wilayah', 'F', 'D', '-'],
    ['PM-15', 'Statistik Penggunaan', 'F', 'D', 'S'],
    ['PM-16', 'Ranking Kebangsaan', 'F', 'D', '-'],
    ['PM-17', 'Penanda Aras Sekolah', 'F', 'D', '-', true],
    ['PM-18', 'Papan Pendahulu Sekolah', 'F', 'D', '-', true],
    ['PM-19', 'Peta Haba', 'F', 'D', '-', true],
    ['PM-20', 'Eksport Laporan', 'F', 'D', '-', true],
    ['PM-21', 'Peta Haba DSKP', 'F', '-', 'S'],
    ['PM-22', 'Amaran Awal', 'F', '-', 'S'],
    ['PM-23', 'Laporan Bulanan', 'F', '-', 'S'],
    ['PM-24', 'Headcount', 'F', '-', 'S'],
    ['PM-25', 'Prestasi', 'F', '-', 'S'],
    ['PM-26', 'Analitik Adaptif', 'F', '-', 'S'],
    ['PM-27', 'Analisa Item', 'F', '-', 'S'],
    ['PM-28', 'Sekolah Bersaing', 'F', 'D', 'S'],
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
    ['KK-12', 'Video Sekolah', 'F', '-', 'R'],
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
    ['PG-01', 'Gamifikasi › Gambaran Keseluruhan', 'F', '-', '-'],
    ['PG-02', 'Gamifikasi › Konfigurasi Peringkat (Kadar Tukaran Syiling)', 'F', '-', '-'],
    ['PG-03', 'Gamifikasi › Cabaran', 'F', '-', '-'],
    ['PG-04', 'Gamifikasi › Pelajar', 'F', '-', '-'],
    ['PG-05', 'Gamifikasi › Transaksi', 'F', '-', '-'],
    ['PG-06', 'Gamifikasi › Kedai Hadiah', 'F', '-', '-'],
    ['PG-07', 'Gamifikasi › Gamifikasi Guru', 'F', '-', '-'],
    ['PG-08', 'Gamifikasi › Lencana Guru', 'F', '-', '-'],
    ['PG-09', 'Gamifikasi › Cabutan', 'F', '-', '-'],
    ['PG-10', 'Gamifikasi › Kawalan Ganjaran', 'F', '-', '-'],
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
    ['KW-02', 'Papan Pemuka Pengebilan', 'F', '-', 'S'],
    ['KW-03', 'Invois', 'F', '-', 'S'],
    ['KW-04', 'Log Peringatan Bayaran', 'F', '-', 'S'],
    ['KW-05', 'Langganan Sekolah', 'F', '-', 'S'],
    ['KW-06', 'Akses PKSK', 'F', '-', 'S'],
  ],
  sistem: [
    ['SY-01', 'Tetapan', 'F', '-', '-'],
    ['SY-02', 'Kawalan Ciri', 'F', '-', '-'],
    ['SY-03', 'Prestasi Sistem', 'F', '-', '-'],
    ['SY-04', 'Log Audit', 'F', '-', '-'],
    ['SY-05', 'Muat Naik Tangkapan Skrin', 'F', '-', '-'],
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

/**
 * D43 (docs/requirements/role-access-matrix.md): Admin Sekolah rows mapped to Pentadbiran items.
 * `itemIds: null` = no Pentadbiran item exists for the row (none left since D43/D-RAM-2).
 */
export const SCHOOL_ADMIN_PROTOTYPE_ROWS: readonly {
  row: number
  label: string
  itemIds: readonly string[] | null
}[] = [
  { row: 1, label: 'Command Center', itemIds: ['PM-01'] },
  { row: 2, label: 'Dashboard', itemIds: ['PP-01'] },
  { row: 3, label: 'Headcount', itemIds: ['PM-24'] },
  { row: 4, label: 'Prestasi', itemIds: ['PM-25'] },
  { row: 5, label: 'Analitik Adaptif', itemIds: ['PM-26'] },
  { row: 6, label: 'Analisa Item', itemIds: ['PM-27'] },
  { row: 7, label: 'Video', itemIds: ['KK-12'] },
  { row: 10, label: 'Monitoring', itemIds: ['PM-03'] },
  {
    row: 11,
    label: 'Kirkpatrick',
    itemIds: ['PM-05', 'PM-06', 'PM-07', 'PM-08', 'PM-09', 'PM-10', 'PM-11'],
  },
  { row: 45, label: 'Sekolah Bersaing', itemIds: ['PM-28'] },
  { row: 46, label: 'Statistik Penggunaan', itemIds: ['PM-15'] },
  { row: 47, label: 'Peta Haba DSKP', itemIds: ['PM-21'] },
  { row: 48, label: 'Laporan Aktiviti', itemIds: ['PM-12'] },
  { row: 49, label: 'Amaran Awal', itemIds: ['PM-22'] },
  { row: 50, label: 'Laporan Bulanan', itemIds: ['PM-23'] },
  { row: 51, label: 'Senarai Pelajar', itemIds: ['PS-01'] },
  { row: 52, label: 'Senarai Guru', itemIds: ['PS-01'] },
  { row: 53, label: 'Kelas Sekolah', itemIds: ['PS-03'] },
]

const SCHOOL_ADMIN_PROTOTYPE_ITEM_IDS: ReadonlySet<string> = new Set(
  SCHOOL_ADMIN_PROTOTYPE_ROWS.flatMap((r) => r.itemIds ?? []),
)

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
      prototypeScope: SCHOOL_ADMIN_PROTOTYPE_ITEM_IDS.has(id),
    }
  }),
)

/** Groups hosting at least one role-access-matrix.md item (D43). Others stay in the data, hidden. */
const PROTOTYPE_GROUPS: Partial<Record<LearningMenuGroup['role'], readonly (string | null)[]>> = {
  student: [null, 'SPM', 'Pembelajaran', 'Pusat AI', 'Akaun & Bantuan'],
  teacher: [
    'Command Center (LIVE)',
    'HARIAN',
    'PENILAIAN',
    'ANALITIK',
    'BANK SOALAN',
    'LAIN-LAIN',
    'Bantuan',
  ],
}

const lg = (
  role: LearningMenuGroup['role'],
  order: number,
  labelBm: string | null,
  items: string[] = [],
  labelSource: LearningMenuGroup['labelSource'] = 'doc',
): LearningMenuGroup => ({
  role,
  order,
  labelBm,
  items,
  labelSource,
  inV2Prototype: PROTOTYPE_GROUPS[role]?.includes(labelBm) ?? false,
})

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
  lg('student', 7, '💎 Ciri Utama'),
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

type ProtoRow = readonly [number, string, string]
const PEMBELAJARAN_LABELS = [
  'Latih Tubi', 'Soalan Berstruktur', 'Kedudukan', 'PKSK', 'Artikel', 'Permainan', 'Cabutan Bertuah',
  'Kejohanan', 'Topik', 'Peta Belajar', 'Set Soalan Guru', 'Audio KBAT', 'Syiling & Token',
  'Tukar Token', 'Cabaran Harian', 'Kedai Hadiah', 'Marketplace', 'Papan Pendahulu', 'Pencapaian',
  'Kotak Misteri', 'Rujuk Kawan', 'Cikgu Alesa', 'Kedai Hadiah 🎁 (DIGITAL)', 'Garis Masa Saya',
  'Jemput Ibu Bapa',
]
const STUDENT_ROWS: readonly ProtoRow[] = [
  [2, 'Harian', 'Dashboard'],
  [3, 'SPM / Harian / Penilaian', 'Headcount'],
  [4, 'SPM / Penilaian', 'Prestasi'],
  [5, 'SPM / Analitik', 'Analitik Adaptif'],
  [6, 'SPM / Analitik / Lain-lain', 'Analisa Item'],
  [7, 'Pembelajaran / Lain-lain', 'Video'],
  [8, 'Pembelajaran / Harian', 'Kelas Saya'],
  [9, 'Pembelajaran / Harian', 'Soalan Mengikut Bab'],
  [12, '(top)', 'Remedial'],
  [13, 'SPM', 'SPM'],
  [14, 'Pusat AI', 'Peta Haba Topik Lemah'],
  [15, '—', 'Mohon Keluarga Angkat'],
  ...PEMBELAJARAN_LABELS.map((label, i): ProtoRow => [16 + i, 'Pembelajaran', label]),
]
const TEACHER_ROWS: readonly ProtoRow[] = [
  [1, '(top)', 'Command Center'],
  [2, 'Harian', 'Dashboard Guru'],
  [3, 'SPM / Harian / Penilaian', 'Headcount'],
  [4, 'SPM / Penilaian', 'Prestasi'],
  [5, 'SPM / Analitik', 'Analitik Adaptif'],
  [6, 'SPM / Analitik / Lain-lain', 'Analisa Item'],
  [7, 'Pembelajaran / Lain-lain', 'Video'],
  [8, 'Pembelajaran / Harian', 'Kelas Saya'],
  [9, 'Pembelajaran / Harian', 'Soalan Mengikut Bab'],
  [10, 'Analitik', 'Monitoring'],
  [11, 'Analitik', 'Kirkpatrick'],
  [41, 'Harian', 'Pelajar Saya'],
  [42, 'Penilaian', 'Laporan'],
  [43, '(Guru sidebar)', 'Laporan Mingguan'],
  [44, 'Bank Soalan', 'Sumbang Soalan'],
]
const ACCOUNT_LABELS = ['Profil Saya', 'Tetapan Peribadi', 'Panduan', 'Tiket Bantuan', 'Log Keluar']

/** Learner and account items of role-access-matrix.md for Murid, Guru and Admin Sekolah (D43). */
export const PROTOTYPE_ITEMS: readonly PrototypeItem[] = [
  ...STUDENT_ROWS.map(
    ([row, section, labelBm]): PrototypeItem => ({ role: 'student', row, section, labelBm, inV2Prototype: true }),
  ),
  ...TEACHER_ROWS.map(
    ([row, section, labelBm]): PrototypeItem => ({ role: 'teacher', row, section, labelBm, inV2Prototype: true }),
  ),
  ...(['student', 'teacher', 'school_admin'] as const).flatMap((role) =>
    ACCOUNT_LABELS.map(
      (labelBm): PrototypeItem => ({ role, row: 0, section: 'A. Account basics', labelBm, inV2Prototype: true }),
    ),
  ),
]
