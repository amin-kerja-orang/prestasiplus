/** Exact BM copy of S4 and S5 (SRS M10 §8.1; URS FN-M10-3.1, 3.2). */
export const KELAS_COPY = {
  title: 'Kelas Saya',
  create: 'Cipta Kelas Baru',
  createShort: 'Cipta Kelas',
  emptyTitle: 'Belum Ada Kelas',
  emptyBody: 'Cipta kelas pertama anda untuk memulakan pengajaran',
  noSubject: 'Tiada Subjek',
  qrButton: 'Kod QR',
  /** D54/T3: link to the class's student list in Prestasi. */
  studentsButton: 'Lihat Pelajar',
  joinLink: 'Pautan sertai:',
  copied: 'Disalin!',
  print: 'Cetak',
  close: 'Tutup',
  loadFailed: 'Gagal memuatkan senarai kelas. Sila cuba lagi.',
  qrFailed: 'Gagal memuatkan kod QR. Sila cuba lagi.',
  // S5
  back: 'Kembali',
  chooseSchool: 'Pilih Sekolah',
  schoolPlaceholder: 'Taip nama sekolah untuk cari...',
  schoolNone: 'Tiada sekolah dijumpai',
  clearSchool: 'Kosongkan sekolah',
  info: 'Maklumat Kelas',
  name: 'Nama Kumpulan',
  namePlaceholder: 'cth: 5 Bestari',
  nameHelp: 'Nama kumpulan latih tubi anda.',
  subject: 'Subjek',
  subjectPlaceholder: '-- Pilih Subjek --',
  level: 'Tahap Pendidikan',
  description: 'Penerangan (pilihan)',
  descriptionPlaceholder: 'Penerangan ringkas tentang kelas ini...',
  submit: 'Cipta Kelas',
  submitting: 'Mencipta...',
  /** UNVERIFIED COPY (SRS §8.3): the flash after a create. */
  created: 'Kelas berjaya dicipta.',
  createFailed: 'Gagal mencipta kelas. Sila cuba lagi.',
} as const

export const LEVEL_TILES = [
  { slug: 'tahun-1', label: 'Tahun 1' },
  { slug: 'tahun-2', label: 'Tahun 2' },
  { slug: 'tahun-3', label: 'Tahun 3' },
  { slug: 'tahun-4', label: 'Tahun 4' },
  { slug: 'tahun-5', label: 'Tahun 5' },
  { slug: 'tahun-6', label: 'Tahun 6' },
  { slug: 'tingkatan-1', label: 'Ting. 1' },
  { slug: 'tingkatan-2', label: 'Ting. 2' },
  { slug: 'tingkatan-3', label: 'Ting. 3' },
  { slug: 'tingkatan-4', label: 'Ting. 4' },
  { slug: 'tingkatan-5', label: 'Ting. 5' },
] as const

export type LevelTile = (typeof LEVEL_TILES)[number]

/** BR-M10-03: no school → 11 tiles; type `SK` → Tahun only; any other type → Ting. only. */
export function tilesForSchoolType(type: string | null): readonly LevelTile[] {
  if (type === null) return LEVEL_TILES
  const prefix = type === 'SK' ? 'tahun-' : 'tingkatan-'
  return LEVEL_TILES.filter((t) => t.slug.startsWith(prefix))
}

/** "{daerah}, {negeri}" (FN-M10-3.2.2). */
export function schoolPlace(s: { district: string | null; state: string }): string {
  return [s.district, s.state].filter((p): p is string => !!p).join(', ')
}
