/** Copy and labels of S23 and the provisional tournament detail (SRS M16 v1.6 §8.1, §8.2; URS FN-M16-8.1.x, 8.3.1). */

export const SUBTITLE = 'Senarai kejohanan antara sekolah'

export const LIST_COPY = {
  heading: 'Liga & Kejohanan',
  sub: 'Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!',
  create: 'Cipta Kejohanan Baharu',
  createTo: '/tournament/admin/create',
  empty: 'Tiada kejohanan aktif buat masa ini.',
} as const

/** The banner line of a tournament (FN-M16-1.3.2 / 1.3.3). */
export const STATUS_LINE = {
  registration: 'Pendaftaran dibuka',
  ongoing: 'Sedang berlangsung',
  draft: 'Draf',
  completed: 'Tamat',
} as const

export const DETAIL_LABELS = {
  description: 'Penerangan',
  educationLevel: 'Tahap Pendidikan',
  format: 'Format',
  groups: 'Bilangan Kumpulan',
  questionSource: 'Sumber Soalan',
  subject: 'Mata Pelajaran',
  mixedSubjects: 'Mata Pelajaran Campuran',
  totalQuestions: 'Jumlah Soalan',
  timeWindow: 'Tetingkap Masa (minit)',
  topN: 'Top-N Pelajar (untuk skor sekolah)',
  minParticipants: 'Minimum Peserta',
  opens: 'Tarikh Buka Pendaftaran',
  closes: 'Tarikh Tutup Pendaftaran',
  notSet: '-',
} as const

export const EDUCATION_LEVELS: Record<string, string> = {
  tingkatan4: 'Tingkatan 4',
  tingkatan5: 'Tingkatan 5',
  spm: 'SPM (Tingkatan 4 & 5)',
}

export const FORMATS: Record<string, string> = {
  single_match: 'Perlawanan Tunggal',
  knockout: 'Kalah Mati',
  league: 'Liga',
  hybrid: 'Hibrid (Liga + Kalah Mati)',
}

export const QUESTION_MODES: Record<string, string> = {
  subject: 'Mengikut Mata Pelajaran',
  exam_paper: 'Mengikut Kertas Peperiksaan',
  random_mix: 'Campuran Rawak',
}
