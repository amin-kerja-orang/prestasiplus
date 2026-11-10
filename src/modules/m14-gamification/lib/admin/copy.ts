/**
 * M14 admin screens, exact BM copy of the V2 blades (`admin/gamification/*.blade.php`,
 * `admin/reward-control.blade.php`). Titles and subtitles are V2's; the six screens follow the V2
 * sidebar group "Gamifikasi" (Overview, Tier Config, Cabaran, Pelajar, Transaksi, Kawalan Reward).
 */
import type { LedgerType } from '../../api/types'

export const ADMIN_TITLES = {
  overview: { title: '🎮 Gamifikasi Overview', subtitle: 'Pantau sistem gamifikasi PRESTASIPLUS' },
  tiers: {
    title: '👑 Tier Configuration',
    subtitle: 'Urus tier sistem gamifikasi — termasuk ganjaran Syiling per soalan',
  },
  challenges: { title: '🎯 Cabaran Harian', subtitle: 'Urus cabaran harian untuk pelajar' },
  students: { title: '👥 Pelajar Gamifikasi', subtitle: 'Pantau progress pelajar & baki syiling / token' },
  transactions: { title: '📋 Transaksi Syiling', subtitle: 'Log semua transaksi syiling dalam sistem' },
  rewardControl: { title: '🛡️ Kawalan Reward', subtitle: 'Kawalan kewangan ekonomi ganjaran' },
} as const

export const ADMIN_COMMON = {
  loadFailed: 'Tidak dapat memuatkan data. Sila cuba semula.',
} as const

export const OVERVIEW_COPY = {
  cards: {
    activeStudents: 'Pelajar Aktif',
    syilingGenerated: 'Syiling Dijana',
    tokensConverted: 'Token Terkumpul',
    conversions: 'Penukaran',
    activeChallenges: 'Cabaran Aktif',
    completedToday: 'Siap Hari Ini',
  },
  tierTitle: 'Taburan Tier',
  tierEmpty: 'Tiada tier dikonfigurasi.',
  noTier: (n: string) => `${n} pelajar belum ditetapkan tier.`,
  topTitle: 'Top 10 Pelajar',
  topEmpty: 'Tiada data pelajar.',
  syiling: 'syiling',
  recentTitle: 'Transaksi Terkini',
  recentMore: 'Lihat semua',
  recentEmpty: 'Tiada transaksi lagi.',
  columns: { student: 'Pelajar', type: 'Jenis', amount: 'Jumlah', source: 'Sumber', time: 'Masa' },
} as const

export const TIERS_COPY = {
  note: 'Paparan konfigurasi tier (baca sahaja). Ganjaran Syiling ditetapkan mengikut tier & level soalan.',
  empty: 'Tiada tier dikonfigurasi lagi.',
  order: (n: number, pupils: string) => `Urutan #${String(n)} · ${pupils} pelajar`,
  minSyiling: 'Min Syiling',
  rate: 'Kadar Tukar',
  quizTitle: '📝 Latih Tubi — Syiling / Betul',
  pkskTitle: '🛡️ PKSK — Syiling / Betul',
  pkskNote: 'Semua soalan PKSK (tiada level)',
  boardTitle: '🎲 Papan Bijak — Syiling',
  boardNote: 'Menang',
} as const

export const CHALLENGES_COPY = {
  listTitle: (n: number) => `Senarai Cabaran (${String(n)})`,
  activeCount: (n: number) => `${String(n)} Aktif`,
  active: 'Aktif',
  inactive: 'Nyahaktif',
  target: (n: string) => `Sasaran: ${n}`,
  empty: 'Tiada cabaran dikonfigurasi lagi.',
  enrolled: (n: string) => `${n} sertai`,
  completed: (n: string) => `${n} siap`,
  noDescription: '—',
  difficulty: { easy: 'Mudah', medium: 'Sederhana', hard: 'Susah' },
} as const

export const STUDENTS_COPY = {
  searchPlaceholder: 'Cari pelajar…',
  searchLabel: 'Cari (nama / emel)',
  allTiers: 'Semua Tier',
  tierLabel: 'Tier',
  empty: 'Tiada pelajar sepadan.',
  caption: 'Senarai pelajar gamifikasi',
  columns: {
    student: 'Pelajar',
    tier: 'Tier',
    level: 'Level',
    balance: 'Baki Syiling',
    token: 'Token',
    lifetime: 'Jumlah Syiling',
    xp: 'XP',
    streak: 'Streak',
  },
} as const

export const TRANSACTIONS_COPY = {
  pillsLabel: 'Jenis transaksi',
  caption: 'Log transaksi syiling',
  empty: 'Tiada transaksi dalam log.',
  emptyForType: 'Tiada transaksi dalam log untuk jenis ini.',
  columns: {
    id: 'ID',
    student: 'Pelajar',
    type: 'Jenis',
    amount: 'Jumlah',
    balanceAfter: 'Baki Selepas',
    source: 'Sumber',
    description: 'Keterangan',
    date: 'Tarikh',
  },
} as const

export const TYPE_PILLS: readonly { key: LedgerType | ''; label: string }[] = [
  { key: '', label: 'Semua Jenis' },
  { key: 'earn', label: '💰 Dapat' },
  { key: 'spend', label: '🛍️ Belanja' },
  { key: 'convert', label: '🔄 Tukar' },
  { key: 'bonus', label: '🎁 Bonus' },
  { key: 'refund', label: '↩️ Refund' },
]

export const REWARD_CONTROL_COPY = {
  liability: (year: number) => `Liabiliti sesi ${String(year)}`,
  liabilitySub: 'jumlah kos hadiah ditebus',
  students: 'Pelajar Menebus',
  claims: 'Jumlah Tebusan',
  settingsTitle: '⚙️ Tetapan Kewangan',
  settingsEmpty: 'Tetapan reward belum dikonfigurasi.',
  budget: 'Bajet tebus / sesi',
  flat: 'Syiling flat / soalan betul',
  sessionYear: 'Tahun sesi semasa',
  games: 'Mini-games beri syiling?',
  gamesYes: 'Ya',
  gamesNo: 'Tidak (XP sahaja)',
  giftsTitle: '🎁 Kos Sebenar Hadiah — digital = RM0, tidak makan bajet',
  giftsEmpty: 'Tiada hadiah dalam katalog.',
  giftColumns: { gift: 'Hadiah', category: 'Kategori', price: 'Harga Token', cost: 'Kos Sebenar', status: 'Status' },
  giftActive: 'Aktif',
  drawsTitle: '🎟️ Cabutan Bertuah',
  drawsEmpty: 'Tiada cabutan lagi.',
  drawColumns: { id: '#', title: 'Tajuk', status: 'Status', ticket: 'Harga Tiket', winner: 'Pemenang' },
} as const
