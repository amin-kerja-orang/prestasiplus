/** Exact BM copy of S20 / S21 / S22 (SRS M16 v1.6 §8.1; URS FN-M16-7.3.1 ... 7.5.1). */

export const SUBTITLE = 'Selamat datang kembali'

export const LOAD_COPY = {
  failed: 'Maaf, berlaku ralat. Sila cuba semula.',
  retry: 'Cuba Semula',
} as const

export const BACK_LINK = { label: 'Permainan', to: '/permainan' } as const

export const PERTANDINGAN_COPY = {
  heading: '🏆 Pertandingan Mingguan',
  sub: 'Lumba dengan semua pelajar! 3 teratas dapat Syiling bonus.',
  weekLabel: '📅 Minggu Ini',
  countdownLabel: '⏳ Tamat dalam',
  countdownBefore: '-',
  countdownEnded: 'Tamat!',
  prizes: [
    { medal: '🥇', label: 'Juara' },
    { medal: '🥈', label: 'Naib Juara' },
    { medal: '🥉', label: 'Tempat Ketiga' },
  ],
  notStarted: 'Belum mula lagi minggu ini!',
  notStartedHint: 'Buat Latih Tubi untuk masuk kedudukan.',
  startPractice: 'Mula Latih Tubi',
  startPracticeTo: '/practice',
  boardHeading: '📊 Papan Ranking Mingguan',
  sessions: 'sesi',
  correct: 'betul',
  accuracy: 'tepat',
  /** PROPOSED copy (FN-M16-7.3.3), unobservable. */
  myRank: (rank: number, betul: number): string =>
    `📊 Kedudukan kamu: #${String(rank)} · ${String(betul)} betul`,
} as const

export const MEDALS = ['🥇', '🥈', '🥉'] as const

export const UJI_MINDA_COPY = {
  heading: 'Uji Minda',
  emoji: '🧠',
  sub: 'Cabaran khas dari ibu/bapa kamu! Tapi ibu/bapa kamu belum tetapkan cabaran lagi.',
  howTitle: 'Bagaimana nak mula?',
  howBefore: 'Minta ibu atau bapa kamu log masuk ke PRESTASIPLUS, pergi ke',
  howLink: '"Cabaran Uji Minda"',
  howAfter: 'di dashboard mereka, dan tetapkan cabaran + hadiah untuk kamu!',
  setHeading: '📋 Apa Ibu/Bapa boleh tetap:',
  setItems: [
    '✅ Bilangan soalan setiap set',
    '✅ Syiling bagi setiap jawapan betul',
    '✅ Hadiah custom (cth: buku, jajan, trip)',
    '✅ Syiling minimum untuk menuntut hadiah',
  ],
} as const

export const SERVER_ERROR_COPY = {
  code: '500',
  emoji: '⚙️',
  heading: 'Ralat Pelayan',
  message:
    'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.',
  home: 'Halaman Utama',
  retry: 'Cuba Semula',
  caption: 'PRESTASIPLUS',
} as const
