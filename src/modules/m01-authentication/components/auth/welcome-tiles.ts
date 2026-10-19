/** Welcome-panel tiles of S1 (FR-M01-02) and S2 (FR-M01-15), with the live pastel tints. */
export interface WelcomeTile {
  emoji: string
  title: string
  text: string
  /** Tint classes: background + heading colour. */
  tint: string
}

export const LOGIN_TILES: readonly WelcomeTile[] = [
  {
    emoji: '🏆',
    title: 'Pencapaian Terbuka',
    text: 'Kumpul lencana dan skor tertinggi',
    tint: 'bg-blue-50 text-blue-700',
  },
  {
    emoji: '📈',
    title: 'Jejak Kemajuan',
    text: 'Lihat statistik pembelajaran anda',
    tint: 'bg-green-50 text-green-700',
  },
  {
    emoji: '🎯',
    title: 'Latihan Tersusun',
    text: 'Dari mudah hingga mencabar',
    tint: 'bg-yellow-50 text-yellow-700',
  },
]

export const REGISTER_TILES: readonly WelcomeTile[] = [
  {
    emoji: '🎮',
    title: 'Pembelajaran Gamifikasi',
    text: 'Belajar sambil bermain',
    tint: 'bg-pink-50 text-pink-700',
  },
  {
    emoji: '👥',
    title: 'Komuniti Aktif',
    text: 'Belajar bersama rakan',
    tint: 'bg-purple-50 text-purple-700',
  },
  {
    emoji: '📊',
    title: 'Laporan Terperinci',
    text: 'Pantau prestasi anda',
    tint: 'bg-orange-50 text-orange-700',
  },
]
