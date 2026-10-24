/** Exact BM copy of S28 (SRS M16 v1.6 §8.1; URS FN-M16-10.1.1 ... 10.1.6). */

export const SB_COPY = {
  heading: 'Sekolah Bersaing',
  sub: 'Papan pendahulu mingguan — bandingkan sekolah-sekolah di Malaysia. Anda rasa bangga? Kongsi.',
  weekPrefix: 'Minggu',
  weekSuffix: 'sekolah dalam pertandingan',
  headers: ['#', 'Sekolah', '% Aktif', 'Streak Avg', 'Nota/Pelajar'],
  aktif: 'aktif',
  hari: 'hari',
  per10: 'setiap 10',
  anonymous: 'Sekolah anonim',
  tipLabel: 'Untuk Cikgu Besar / PIBG:',
  tip: 'Share ranking ini ke parent group WhatsApp. Pelajar nampak sekolah berbangga = lebih semangat. Sekolah yang opt-out akan paparkan sebagai "Sekolah anonim".',
  emptyTitle: 'Data minggu ini belum dijana.',
  emptyHint: 'Penjadual mingguan akan mengira pada Isnin pagi. Tunggu sebentar ya.',
} as const

export const SB_MEDALS = ['🥇', '🥈', '🥉'] as const
