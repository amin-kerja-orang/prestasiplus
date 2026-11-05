/** S1 `/guru/laporan` copy (SRS M11 §8.1, exact BM). */
export const LAPORAN_COPY = {
  filterLabel: 'Tapis:',
  allClasses: 'Semua Kelas',
  loginTitle: 'Pernah Login',
  practiseTitle: 'Pernah Buat Latihan',
  activityTitle: 'Jumlah Aktiviti',
  scoreTitle: 'Pecahan Skor Purata',
  clickList: 'Klik untuk lihat senarai',
  clickBreakdown: 'Klik untuk lihat pecahan',
  allLoggedIn: 'Semua pelajar sudah pernah login!',
  allPractised: 'Semua pelajar sudah aktif buat latihan!',
  scoreBreakdown: 'Pecahan Skor Purata',
  trendTitle: 'Trend Aktiviti',
  mostActiveTitle: 'Paling Aktif',
  noActivity: 'Tiada aktiviti dalam tempoh ini.',
  noTrend: 'Tiada aktiviti direkodkan dalam tempoh ini.',
  noPupils: 'Belum ada pelajar dalam kelas anda.',
  noLoginRecord: 'Tiada rekod login sejak penjejakan dimulakan.',
  notPractisedTitle: 'Belum Pernah Buat Latihan',
  neverLoggedIn: 'Belum pernah login',
  noScore: '-%',
  /** The "Pecahan Skor Purata" card when no session has an accuracy (FR-GUR-42-2). */
  noScoreCard: '—',
} as const

export const RANGE_PILLS = [
  { range: 7, label: '7 Hari' },
  { range: 30, label: '30 Hari' },
  { range: 90, label: '3 Bulan' },
] as const

export type ExpandKey = 'login' | 'latihan' | 'aktiviti' | 'skor'

export const loginPanelTitle = (n: number): string => `Pelajar Belum Pernah Login (${n})`
export const practisePanelTitle = (n: number): string => `Pelajar Belum Pernah Buat Latihan (${n})`
export const activityPanelTitle = (range: number): string =>
  `Pecahan Aktiviti (${range} Hari Lepas)`
export const neverLoggedCount = (n: number): string => `${n} belum pernah login`
/** AC-GUR-42-7: the expander of a pupil list longer than 10. */
export const moreCount = (n: number): string => `+ ${n} lagi`
export const LIST_LIMIT = 10
export const rangeAgo = (range: number): string => `${range} hari lepas`
export const activityCount = (n: number): string => `${n} aktiviti`
