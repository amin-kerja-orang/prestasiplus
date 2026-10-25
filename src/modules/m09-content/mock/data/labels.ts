/** Code to label maps of M09 (BR-M09-01, BR-M09-11, BR-M09-17, §6.5). */

import type { ArticleCategory, GradeLevel, VideoCategory } from '../types'

export const CATEGORY_LABELS: Readonly<Record<ArticleCategory, string>> = {
  TIPS_BELAJAR: 'Tips Belajar',
  BERITA: 'Berita',
  MOTIVASI: 'Motivasi',
  PANDUAN_IBU_BAPA: 'Panduan Ibu Bapa',
  PANDUAN_GURU: 'Panduan Guru',
  KEJAYAAN: 'Kejayaan',
  UMUM: 'Umum',
}

export const GRADE_LABELS: Readonly<Record<GradeLevel, string>> = {
  SEMUA: 'Semua',
  TINGKATAN_4: 'Tingkatan 4',
  TINGKATAN_5: 'Tingkatan 5',
}

export const VIDEO_CATEGORY_LABELS: Readonly<Record<VideoCategory, string>> = {
  motivasi: 'Motivasi',
  tutorial: 'Tutorial',
  'tips-spm': 'Tips SPM',
  ceramah: 'Ceramah',
  'lain-lain': 'Lain-lain',
}

export const VIDEO_CATEGORIES: readonly VideoCategory[] = [
  'motivasi',
  'tutorial',
  'tips-spm',
  'ceramah',
  'lain-lain',
]

/** BR-M09-17: stored spelling to chip label. */
export const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  Youtube: 'YouTube',
  Vimeo: 'Vimeo',
  Dailymotion: 'Dailymotion',
  TikTok: 'TikTok',
  Facebook: 'Facebook',
  Other: 'Lain-lain',
}

/** Role label shown on video cards (`uploader.roleLabel`, INFERRED from the M01 roles). */
export const ROLE_LABELS: Readonly<Record<string, string>> = {
  admin: 'Admin',
  teacher: 'Guru',
  school_admin: 'Pengetua',
  student: 'Pelajar',
  parent: 'Ibu Bapa',
  ppd_officer: 'Pegawai PPD',
  sponsor: 'Penaja',
}

/** M03 subject names used in the generated video titles (§6.9: subjects 3, 5, 8, 9, 10). */
export const VIDEO_SUBJECT_NAMES: Readonly<Record<number, string>> = {
  3: 'Matematik',
  5: 'Sejarah',
  8: 'Matematik Tambahan',
  9: 'Fizik',
  10: 'Kimia',
}

/** Laravel `Str::slug` (BR-M09-08): lower case, accents stripped, non-alphanumerics to "-". */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** First letter of the name, upper case (BR-M09-29). */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

/** First letters of the first two words (perutusan initials, BR-M09-29). */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}
