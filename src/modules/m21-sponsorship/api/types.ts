/**
 * M21 contract types (SRS M21 v1.2 §6.2–§6.6, §7 #15; student slice S6). Shared by the mock handler and
 * the screen S6 (M21-T2). JSON is camelCase; ids are integers; dates are ISO 8601 (+08:00).
 */

/** The 13 sponsor category codes (§6.5). */
export const SPONSOR_CATEGORY_CODES = [
  'INDIVIDU',
  'SYARIKAT_SWASTA',
  'GLC',
  'NGO',
  'BADAN_KERAJAAN',
  'BANK',
  'UNIVERSITI',
  'PERSATUAN',
  'KOPERASI',
  'KEDAI_BUKU',
  'RESTORAN',
  'TEKNOLOGI',
  'PENDIDIKAN',
] as const
export type SponsorCategoryCode = (typeof SPONSOR_CATEGORY_CODES)[number]

/** Sponsor category code to BM label (§6.5, BR-M21-16). */
export const SPONSOR_CATEGORY_LABELS: Readonly<Record<SponsorCategoryCode, string>> = {
  INDIVIDU: 'Individu / Peribadi',
  SYARIKAT_SWASTA: 'Syarikat Swasta',
  GLC: 'Syarikat Berkaitan Kerajaan',
  NGO: 'Pertubuhan Bukan Kerajaan',
  BADAN_KERAJAAN: 'Badan / Agensi Kerajaan',
  BANK: 'Bank / Institusi Kewangan',
  UNIVERSITI: 'Universiti / IPT',
  PERSATUAN: 'Persatuan / Kesatuan',
  KOPERASI: 'Koperasi',
  KEDAI_BUKU: 'Kedai Buku / Alat Tulis',
  RESTORAN: 'Restoran / F&B',
  TEKNOLOGI: 'Syarikat Teknologi',
  PENDIDIKAN: 'Penyedia Pendidikan',
}

/** Sponsor status labels (BR-M21-16). */
export const SPONSOR_STATUS_LABELS = {
  PENDING: 'Menunggu',
  APPROVED: 'Diluluskan',
  REJECTED: 'Ditolak',
  SUSPENDED: 'Digantung',
} as const

export const ANAK_ANGKAT_CHANNELS = ['direct', 'mlm'] as const
export type AnakAngkatChannel = (typeof ANAK_ANGKAT_CHANNELS)[number]

export const ANAK_ANGKAT_STATUSES = ['active', 'graduated', 'withdrawn', 'expired'] as const
export type AnakAngkatStatus = (typeof ANAK_ANGKAT_STATUSES)[number]

export const APPLICATION_STATUSES = ['pending', 'approved', 'matched', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** The five S6 category values (§6.4); value to label (§6.5). */
export const APPLICATION_CATEGORIES = ['B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain'] as const
export type ApplicationCategory = (typeof APPLICATION_CATEGORIES)[number]
export const APPLICATION_CATEGORY_LABELS: Readonly<Record<ApplicationCategory, string>> = {
  B40: 'B40 — Pendapatan rendah',
  Asnaf: 'Asnaf — Layak bantuan zakat',
  Yatim: 'Yatim — Tiada ibu/bapa',
  OKU: 'OKU — Orang kurang upaya',
  'Lain-lain': 'Lain-lain',
}

/** The four S6 income values (§6.4); value to label (§6.5). */
export const FAMILY_INCOME_RANGES = [
  '< RM1,000',
  'RM1,000 - RM2,500',
  'RM2,500 - RM4,000',
  '> RM4,000',
] as const
export type FamilyIncomeRange = (typeof FAMILY_INCOME_RANGES)[number]
export const FAMILY_INCOME_LABELS: Readonly<Record<FamilyIncomeRange, string>> = {
  '< RM1,000': 'Bawah RM1,000',
  'RM1,000 - RM2,500': 'RM1,000 - RM2,500',
  'RM2,500 - RM4,000': 'RM2,500 - RM4,000',
  '> RM4,000': 'Atas RM4,000',
}

/** Request body of #15 `POST /api/mohon-keluarga-angkat` (V-M21-03). */
export interface FosterApplicationInput {
  studentEmail: string
  studentCategory: ApplicationCategory
  /** Optional; an empty string is taken as "not given". */
  familyIncomeRange?: FamilyIncomeRange | '' | null
  reason: string
}

/** Response data of #15 (201). */
export interface FosterApplicationCreated {
  id: number
}

/** Field names of the 422 `fields` map of #15. */
export type FosterApplicationField =
  | 'studentEmail'
  | 'studentCategory'
  | 'familyIncomeRange'
  | 'reason'

/** PROPOSED copy of #15 (SRS §5 V-M21-03, §8.2). */
export const FOSTER_APPLICATION_MESSAGES = {
  required: 'Sila isi ruangan ini.',
  invalidEmail: 'Format e-mel tidak sah.',
  invalidChoice: 'Pilihan tidak sah.',
  studentNotFound: 'Email pelajar tidak dijumpai dalam PrestasiPlus.',
  success: 'Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja.',
} as const

/** `sponsorship.sponsorSummary()` (§6.7): the M17 "Kad Penaja" figures; `active` = `APPROVED`. */
export interface SponsorSummary {
  total: number
  active: number
  pending: number
  rejected: number
  suspended: number
}
