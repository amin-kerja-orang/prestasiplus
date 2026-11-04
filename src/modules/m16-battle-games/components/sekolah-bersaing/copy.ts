/** Exact BM copy of the live board (R1-AS-45, FR-AS-45-2, FR-AS-45-3). */

export const SB_COPY = {
  heading: 'Sekolah Bersaing',
  label: 'Papan Pemimpin',
  sub: 'Kedudukan sekolah teratas berdasarkan purata ketepatan latihan pelajar.',
  headers: ['#', 'Sekolah', 'Negeri', 'Ketepatan', 'Pelajar'],
  emptyTitle: 'Belum ada data',
  emptyHint: 'Tiada rekod latihan sekolah lagi.',
} as const

export const SB_MEDALS = ['🥇', '🥈', '🥉'] as const
