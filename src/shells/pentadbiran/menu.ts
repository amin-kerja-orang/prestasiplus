/**
 * Menu of the Portal Pentadbiran (D30; `docs/requirements/v2-portals.md` section 6): 9 groups and
 * 104 items for Admin Pusat. `PENTADBIRAN_FULL_MENU` keeps the whole definition as data for the
 * next round; `PENTADBIRAN_MENU` (rendered) holds built screens only and drops empty groups.
 * Unbuilt items are listed in `docs/requirements/v2-pentadbiran-backlog.md`.
 */

export interface PentadbiranItem {
  /** Doc id, for example `PM-04`. */
  id: string
  label: string
  /** Optional second-level heading inside the group (Kirkpatrick, Gamifikasi, ...). */
  sub?: string
  to: string
  /** `false` = placeholder route. */
  built: boolean
}

export interface PentadbiranGroup {
  key: string
  label: string
  /** Phosphor base name (listed in `src/theme/ds-icons.ts`). */
  icon: string
  items: readonly PentadbiranItem[]
}

/** Internal key of an item that is not built (never rendered, never routed). */
export const placeholderPath = (id: string): string => `/admin/p/${id.toLowerCase()}`

type Row = readonly [id: string, label: string, to?: string, sub?: string]

function items(rows: readonly Row[]): PentadbiranItem[] {
  return rows.map(([id, label, to, sub]) => ({
    id,
    label,
    ...(sub ? { sub } : {}),
    to: to ?? placeholderPath(id),
    built: to !== undefined,
  }))
}

const K = 'Kirkpatrick'
const G = 'Gamifikasi'

export const PENTADBIRAN_FULL_MENU: readonly PentadbiranGroup[] = [
  {
    key: 'papan-pemuka',
    label: 'Papan Pemuka',
    icon: 'squares-four',
    items: items([
      ['PP-01', 'Dashboard'],
      ['PP-02', 'Laporan Eksekutif'],
    ]),
  },
  {
    key: 'pemantauan',
    label: 'Pemantauan',
    icon: 'pulse',
    items: items([
      ['PM-01', 'Langsung', '/admin/command-center'],
      ['PM-02', 'Aktiviti Harian', '/admin/command-center/daily-activity'],
      ['PM-03', 'Monitoring', '/guru/monitoring'],
      ['PM-04', 'Analitik'],
      ['PM-05', 'Ringkasan', '/admin/kirkpatrick', K],
      ['PM-06', 'Tahap 1: Reaksi', '/admin/kirkpatrick/reaction', K],
      ['PM-07', 'Tahap 2: Pembelajaran', '/admin/kirkpatrick/learning', K],
      ['PM-08', 'Tahap 3: Tingkah Laku', '/admin/kirkpatrick/behavior', K],
      ['PM-09', 'Tahap 4: Hasil', '/admin/kirkpatrick/results', K],
      ['PM-10', 'Rantaian Impak', '/admin/kirkpatrick/chain', K],
      ['PM-11', 'Intervensi', '/admin/kirkpatrick/interventions', K],
      ['PM-12', 'Laporan Aktiviti'],
      ['PM-13', 'Amaran Wellbeing'],
      ['PM-14', 'Papan Pemuka Wilayah'],
      ['PM-15', 'Statistik Penggunaan'],
      ['PM-16', 'Ranking Kebangsaan'],
      ['PM-17', 'Benchmark Sekolah'],
      ['PM-18', 'Leaderboard Sekolah'],
      ['PM-19', 'Peta Haba'],
      ['PM-20', 'Export Laporan'],
      ['PM-21', 'DSKP Heatmap'],
      ['PM-22', 'Amaran Awal'],
      ['PM-23', 'Laporan Bulanan'],
      ['PM-24', 'Headcount'],
      ['PM-25', 'Prestasi'],
      ['PM-26', 'Analitik Adaptif'],
      ['PM-27', 'Analisa Item'],
      ['PM-28', 'Sekolah Bersaing'],
    ]),
  },
  {
    key: 'bank-soalan',
    label: 'Bank Soalan',
    icon: 'books',
    items: items([
      ['BS-01', 'Bank Soalan', '/admin/questions'],
      ['BS-02', 'Import & Semakan', '/admin/questions/import'],
      ['BS-03', 'Sumber Kertas'],
      ['BS-04', 'Kualiti Soalan', '/admin/questions/quality'],
      ['BS-05', 'Laporan Soalan', '/admin/question-reports'],
      ['BS-06', 'Soalan PKSK', '/admin/pksk/questions'],
      ['BS-07', 'Audio KBAT', '/admin/audio-kbat'],
    ]),
  },
  {
    key: 'kertas-spm',
    label: 'Kertas & SPM',
    icon: 'scroll',
    items: items([
      ['KS-01', 'Gambaran SPM'],
      ['KS-13', 'Muat Naik Kertas', '/admin/spm/soalan/muat-naik'],
      ['KS-16', 'Tulis Soalan Manual', '/admin/spm/soalan/manual'],
      ['KS-14', 'Senarai Ekstrak', '/admin/spm/soalan/ekstrak'],
      ['KS-15', 'Baris Gilir Semakan', '/admin/spm/semakan'],
      ['KS-02', 'Bank Soalan SPM', '/admin/spm/soalan'],
      ['KS-03', 'Latih Tubi'],
      ['KS-04', 'Tracking A'],
      ['KS-05', 'Subjektif'],
      ['KS-06', 'Bijak SPM (Simulasi)'],
      ['KS-07', 'Kertas Subjektif'],
      ['KS-08', 'Kontrak Simulasi'],
      ['KS-09', 'Pembina Kertas', '/admin/spm/kertas'],
      ['KS-10', 'Tanda Karangan'],
      ['KS-11', 'Ramalan SPM'],
      ['KS-12', 'Set Soalan'],
    ]),
  },
  {
    key: 'kurikulum-kandungan',
    label: 'Kurikulum & Kandungan',
    icon: 'book-open',
    items: items([
      ['KK-01', 'Kurikulum', '/admin/curriculum'],
      ['KK-02', 'Subjek', '/admin/subjects'],
      ['KK-03', 'Bab'],
      ['KK-04', 'Tahap Pendidikan', '/admin/education-levels'],
      ['KK-05', 'Banner', '/admin/banners'],
      ['KK-06', 'Artikel', '/admin/articles'],
      ['KK-07', 'Nota', '/admin/notes'],
      ['KK-08', 'Video'],
      ['KK-09', 'Laluan Kerjaya'],
      ['KK-10', 'Universiti'],
      ['KK-11', 'Biasiswa'],
      ['KK-12', 'Video Sekolah'],
    ]),
  },
  {
    key: 'pengguna-sekolah',
    label: 'Pengguna & Sekolah',
    icon: 'student',
    items: items([
      ['PS-01', 'Pengguna', '/admin/users'],
      ['PS-02', 'Sekolah', '/admin/schools'],
      ['PS-03', 'Kelas Sekolah'],
      ['PS-04', 'Import Pelajar', '/admin/import-students'],
      ['PS-05', 'Import Pengguna'],
      ['PS-06', 'Pelajar Komplimen', '/admin/comp-students'],
    ]),
  },
  {
    key: 'penglibatan',
    label: 'Penglibatan',
    icon: 'trophy',
    items: items([
      ['PG-01', 'Overview', undefined, G],
      ['PG-02', 'Tier Config (Kadar Tukaran Syiling)', undefined, G],
      ['PG-03', 'Cabaran', undefined, G],
      ['PG-04', 'Pelajar', undefined, G],
      ['PG-05', 'Transaksi', undefined, G],
      ['PG-06', 'Kedai Hadiah', undefined, G],
      ['PG-07', 'Gamifikasi Guru', undefined, G],
      ['PG-08', 'Lencana Guru', undefined, G],
      ['PG-09', 'Cabutan', undefined, G],
      ['PG-10', 'Kawalan Reward', undefined, G],
      ['PG-11', 'Tetapan Permainan', undefined, 'Permainan'],
      ['PG-12', 'Ranking Sekolah (Battle)', undefined, 'Permainan'],
      ['PG-13', 'Leaderboard (Battle)', undefined, 'Permainan'],
      ['PG-14', 'Produk', undefined, 'Marketplace'],
      ['PG-15', 'Penjual', undefined, 'Marketplace'],
      ['PG-16', 'Penajaan'],
      ['PG-17', 'Anak Angkat'],
      ['PG-18', 'Permohonan Anak Angkat'],
      ['PG-19', 'Permohonan Duta'],
      ['PG-20', 'Push Notifikasi'],
      ['PG-21', 'Chatbot'],
      ['PG-22', 'Tiket Bantuan', '/admin/tiket'],
    ]),
  },
  {
    key: 'kewangan',
    label: 'Kewangan',
    icon: 'wallet',
    items: items([
      ['KW-01', 'Pembayaran'],
      ['KW-02', 'Billing Dashboard'],
      ['KW-03', 'Invois'],
      ['KW-04', 'Dunning Log'],
      ['KW-05', 'Langganan Sekolah', '/admin/school-subscriptions'],
      ['KW-06', 'Akses PKSK', '/admin/pksk/access'],
    ]),
  },
  {
    key: 'sistem',
    label: 'Sistem',
    icon: 'gear',
    items: items([
      ['SY-01', 'Tetapan'],
      ['SY-02', 'Kawalan Ciri'],
      ['SY-03', 'Prestasi Sistem'],
      ['SY-04', 'Log Audit'],
      ['SY-05', 'Upload Screenshot', '/admin/tools/screenshots'],
    ]),
  },
]

/** All 103 items, built or not (backlog data). */
export const FULL_ITEMS: readonly PentadbiranItem[] = PENTADBIRAN_FULL_MENU.flatMap((g) => g.items)

/** The rendered menu: built screens only; a group with no built item is dropped. */
export const PENTADBIRAN_MENU: readonly PentadbiranGroup[] = PENTADBIRAN_FULL_MENU.map((g) => ({
  ...g,
  items: g.items.filter((i) => i.built),
})).filter((g) => g.items.length > 0)

export const ALL_ITEMS: readonly PentadbiranItem[] = PENTADBIRAN_MENU.flatMap((g) => g.items)

/** Built item by doc id. */
export function itemById(id: string): PentadbiranItem | undefined {
  const upper = id.toUpperCase()
  return ALL_ITEMS.find((i) => i.id === upper)
}

export function groupOf(itemId: string): PentadbiranGroup | undefined {
  return PENTADBIRAN_MENU.find((g) => g.items.some((i) => i.id === itemId))
}

/** The active item: the longest `to` that equals the path or contains it at a `/` boundary. */
export function activeItem(path: string): PentadbiranItem | undefined {
  let best: PentadbiranItem | undefined
  for (const item of ALL_ITEMS) {
    const hit = path === item.to || path.startsWith(`${item.to}/`)
    if (hit && (!best || item.to.length > best.to.length)) best = item
  }
  return best
}

export const MENU_STORAGE_KEY = 'pentadbiran_menu'
