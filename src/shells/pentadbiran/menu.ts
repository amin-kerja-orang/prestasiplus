/**
 * Menu of the Portal Pentadbiran (D30, D107; `docs/prd/r1/30-admin-pusat.md` section 3) for Admin
 * Pusat only: the V2 groups and order, one `PentadbiranGroup` per V2 group (V2 section headings are
 * not rendered). `PENTADBIRAN_FULL_MENU` keeps the whole definition as data; `PENTADBIRAN_MENU`
 * (rendered) holds built screens only and drops empty groups (FR-ADM-H0.2). Unbuilt items are listed
 * in `docs/requirements/v2-pentadbiran-backlog.md`.
 *
 * Hidden or merged out of the definition (routes stay reachable by link or button): KS-02, KS-08,
 * KS-13, KS-14, KS-15, KS-16 (hidden); BS-04, BS-05 (tabs of Senarai Soalan); KS-09 (Set Builder);
 * KS-06 (hub lane card). Removed: KK-03, KS-10, KS-11, KS-12.
 */

export interface PentadbiranItem {
  /** Doc id, for example `PM-04`. */
  id: string
  label: string
  /**
   * Optional second-level heading inside the group. Items that share a folded heading (Kirkpatrick)
   * are one sidebar row; items of a nested heading (`Bank Lama (Legasi)`) are indented rows under a
   * heading row.
   */
  sub?: string
  /** `true` when `sub` is a visible sub-group heading (not a folded row). */
  nested?: boolean
  /** Small pill after the label, for example `LIVE`. */
  badge?: string
  to: string
  /** `false` = placeholder route. */
  built: boolean
}

export interface PentadbiranGroup {
  key: string
  /** Sidebar heading; omitted = no heading (the top shortcuts, 30 §3.1 row 0 names none). */
  label?: string
  /** Phosphor base name (listed in `src/theme/ds-icons.ts`). */
  icon: string
  items: readonly PentadbiranItem[]
}

/** Internal key of an item that is not built (never rendered, never routed). */
export const placeholderPath = (id: string): string => `/admin/p/${id.toLowerCase()}`

type Row = readonly [id: string, label: string, to?: string, sub?: string]

const NESTED_SUBS: ReadonlySet<string> = new Set(['Bank Lama (Legasi)'])
const BADGES: Readonly<Record<string, string>> = { 'PM-01': 'LIVE' }

function items(rows: readonly Row[]): PentadbiranItem[] {
  return rows.map(([id, label, to, sub]) => ({
    id,
    label,
    ...(sub ? { sub } : {}),
    ...(sub && NESTED_SUBS.has(sub) ? { nested: true } : {}),
    ...(BADGES[id] ? { badge: BADGES[id] } : {}),
    to: to ?? placeholderPath(id),
    built: to !== undefined,
  }))
}

const K = 'Kirkpatrick'
const L = 'Bank Lama (Legasi)'

export const PENTADBIRAN_FULL_MENU: readonly PentadbiranGroup[] = [
  {
    // V2 top shortcuts (30 §3.1 row 0).
    key: 'pintasan',
    icon: 'pulse',
    items: items([
      ['PM-01', 'Command Center', '/admin/command-center'],
      ['PM-02', 'Aktiviti Harian', '/admin/command-center/daily-activity'],
      ['BS-07', 'Audio KBAT', '/admin/audio-kbat'],
    ]),
  },
  {
    // V2 section HARIAN. `/admin` redirects to Command Center outside the dev hub, so no route here.
    key: 'harian',
    label: 'Harian',
    icon: 'squares-four',
    items: items([
      ['PP-01', 'Dashboard'],
      ['PP-02', 'Laporan Eksekutif'],
    ]),
  },
  {
    // V2 section ANALITIK. The seven Kirkpatrick pages fold into one row (tabs inside the section).
    key: 'analitik',
    label: 'Analitik',
    icon: 'chart-line-up',
    items: items([
      ['PM-04', 'Analitik'],
      ['PM-03', 'Monitoring', '/admin/monitoring'],
      ['PM-05', 'Overview', '/admin/kirkpatrick', K],
      ['PM-06', 'T1: Reaksi', '/admin/kirkpatrick/reaction', K],
      ['PM-07', 'T2: Pembelajaran', '/admin/kirkpatrick/learning', K],
      ['PM-08', 'T3: Tingkah Laku', '/admin/kirkpatrick/behavior', K],
      ['PM-09', 'T4: Hasil', '/admin/kirkpatrick/results', K],
      ['PM-10', 'Rantaian Impak', '/admin/kirkpatrick/chain', K],
      ['PM-11', 'Intervensi', '/admin/kirkpatrick/interventions', K],
      ['PM-29', 'Laporan'],
    ]),
  },
  {
    key: 'kurikulum',
    label: 'Kurikulum',
    icon: 'book-open',
    items: items([
      ['KK-01', 'Kurikulum', '/admin/curriculum'],
      ['KK-02', 'Subjek', '/admin/subjects'],
      ['KK-04', 'Tahap Pendidikan', '/admin/education-levels'],
    ]),
  },
  {
    // 30 §3.2: nine definitions. Sumber Kertas and Kertas Subjektif stay unrendered until S3.
    key: 'soalan',
    label: 'Soalan',
    icon: 'books',
    items: items([
      ['KS-01', 'SPM', '/admin/spm'],
      ['BS-08', 'Bank Soalan (Studio)', '/admin/studio'],
      ['BS-02', 'Import & Semakan', '/admin/spm/soalan/ekstrak'],
      ['KS-17', 'Set Builder', '/admin/studio/sets'],
      ['BS-03', 'Sumber Kertas'],
      ['KS-07', 'Kertas Subjektif'],
      ['BS-09', 'Audit Rajah', '/admin/soalan-gambar'],
      ['BS-01', 'Senarai Soalan', '/admin/questions', L],
      ['BS-10', 'Soalan Berstruktur', '/admin/structured-questions', L],
    ]),
  },
  {
    key: 'pengguna',
    label: 'Pengguna',
    icon: 'users',
    items: items([
      ['PS-01', 'Senarai Pengguna', '/admin/users'],
      ['PS-02', 'Sekolah', '/admin/schools'],
      ['KW-05', 'Langganan Sekolah', '/admin/school-subscriptions'],
      ['PS-04', 'Import Pelajar', '/admin/import-students'],
      ['PS-06', 'Pelajar Komplimen', '/admin/comp-students'],
      ['PS-05', 'Import Pengguna', '/admin/users/bulk-import'],
      ['PS-03', 'Kelas Sekolah'],
    ]),
  },
  {
    // The four lane pages open the admin lane page (FD-MENU-2); only the databank is built.
    key: 'spm',
    label: 'SPM',
    icon: 'scroll',
    items: items([
      ['KS-18', 'Databank Soalan', '/admin/spm/databank'],
      ['KS-03', 'Latih Tubi'],
      ['KS-04', 'Tracking A'],
      ['KS-05', 'Subjektif'],
    ]),
  },
  {
    key: 'premium',
    label: 'Premium',
    icon: 'star',
    items: items([
      ['BS-06', 'PKSK Soalan', '/admin/pksk/questions'],
      ['KW-06', 'PKSK Akses', '/admin/pksk/access'],
    ]),
  },
  {
    key: 'kawalan-ciri',
    label: 'Sistem',
    icon: 'gear',
    items: items([['SY-02', 'Kawalan Ciri']]),
  },
  {
    // Cabutan (PG-09) and Kotak Misteri are sections of Kawalan Reward, not menu rows.
    key: 'gamifikasi',
    label: 'Gamifikasi',
    icon: 'trophy',
    items: items([
      ['PG-01', 'Overview'],
      ['PG-02', 'Tier Config'],
      ['PG-03', 'Cabaran'],
      ['PG-04', 'Pelajar'],
      ['PG-05', 'Transaksi'],
      ['PG-06', 'Kedai Hadiah'],
      ['PG-10', 'Kawalan Reward'],
    ]),
  },
  {
    key: 'battle-permainan',
    label: 'Battle & Permainan',
    icon: 'game-controller',
    items: items([
      ['PG-12', 'Ranking Sekolah'],
      ['PG-13', 'Leaderboard'],
      ['PG-11', 'Tetapan Permainan'],
      ['PG-23', 'Tournament'],
    ]),
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    icon: 'gift',
    items: items([
      ['PG-14', 'Produk'],
      ['PG-15', 'Penjual'],
    ]),
  },
  {
    key: 'kandungan',
    label: 'Kandungan',
    icon: 'book-open-text',
    items: items([
      ['KK-06', 'Artikel', '/admin/articles'],
      ['KK-05', 'Banner', '/admin/banners'],
      ['KK-07', 'Nota', '/admin/notes'],
      ['SY-05', 'Upload Screenshot', '/admin/tools/screenshots'],
      ['KK-08', 'Video'],
    ]),
  },
  {
    key: 'sistem',
    label: 'Sistem',
    icon: 'gear',
    items: items([
      ['SY-01', 'Tetapan'],
      ['PG-22', 'Tiket Bantuan', '/admin/tiket'],
    ]),
  },
  {
    // Deferred or excluded (30 §3.1 last row, backlog): kept as data, never rendered.
    key: 'ditangguh',
    label: 'Ditangguhkan',
    icon: 'wallet',
    items: items([
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
      ['KK-09', 'Laluan Kerjaya'],
      ['KK-10', 'Universiti'],
      ['KK-11', 'Biasiswa'],
      ['KK-12', 'Video Sekolah'],
      ['PG-07', 'Gamifikasi Guru'],
      ['PG-08', 'Lencana Guru'],
      ['PG-16', 'Penajaan'],
      ['PG-17', 'Anak Angkat'],
      ['PG-18', 'Permohonan Anak Angkat'],
      ['PG-19', 'Permohonan Duta'],
      ['PG-20', 'Push Notifikasi'],
      ['PG-21', 'Chatbot'],
      ['KW-01', 'Pembayaran'],
      ['KW-02', 'Billing Dashboard'],
      ['KW-03', 'Invois'],
      ['KW-04', 'Dunning Log'],
      ['SY-03', 'Prestasi Sistem'],
      ['SY-04', 'Log Audit'],
    ]),
  },
]

/** All items, built or not (backlog data). */
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
