/**
 * The 15 live PKSK domains (SRS M07 v1.7 §6.1 and §6.8, OBSERVED; ids 1-15, `order` = id) and the
 * 3 packages (§6.3, M19-owned; fixture here until M19), plus the Bahagian section copy of S3
 * (URS FN-M07-1.3.3, OBSERVED).
 */

import type { Bahagian, PkskDomain, PkskPackage } from '../repository/types'

const STAMP = '2026-02-07T00:57:33+08:00'

type Row = readonly [number, Bahagian, string, string, string, string, string]

const ROWS: readonly Row[] = [
  [
    1,
    'A',
    'Kecerdasan Insaniah',
    'Soft Skills Intelligence',
    'PKSK_INSANIAH',
    'fa-brain',
    '#8b5cf6',
  ],
  [2, 'B', 'Matematik', 'Mathematics', 'PKSK_MATH', 'fa-calculator', '#3b82f6'],
  [3, 'B', 'Sains', 'Science', 'PKSK_SCI', 'fa-flask', '#10b981'],
  [4, 'B', 'Bahasa Inggeris', 'English Language', 'PKSK_ENG', 'fa-language', '#ef4444'],
  [5, 'B', 'Sejarah Malaysia', 'Malaysian History', 'PKSK_SEJ', 'fa-landmark', '#f59e0b'],
  [6, 'B', 'Geografi', 'Geography', 'PKSK_GEO', 'fa-globe-asia', '#06b6d4'],
  [7, 'B', 'Kebudayaan Kaum', 'Cultural Heritage', 'PKSK_BUDAYA', 'fa-users', '#ec4899'],
  [8, 'B', 'Sukan & Pencapaian', 'Sports & Achievements', 'PKSK_SUKAN', 'fa-futbol', '#84cc16'],
  [9, 'B', 'Mercu Tanda Malaysia', 'Malaysian Landmarks', 'PKSK_MERCU', 'fa-monument', '#f97316'],
  [10, 'B', 'Alam Sekitar', 'Environment', 'PKSK_ALAM', 'fa-leaf', '#22c55e'],
  [11, 'B', 'Teknologi & IT', 'Technology & IT', 'PKSK_TECH', 'fa-laptop-code', '#6366f1'],
  [12, 'B', 'Ekonomi Malaysia', 'Malaysian Economy', 'PKSK_EKON', 'fa-chart-line', '#14b8a6'],
  [13, 'B', 'Inovasi & Pencipta', 'Innovation & Inventors', 'PKSK_INOV', 'fa-lightbulb', '#eab308'],
  [14, 'B', 'Isu Global', 'Global Issues', 'PKSK_GLOBAL', 'fa-earth-asia', '#0ea5e9'],
  [
    15,
    'C',
    'Artikulasi Penulisan',
    'Writing Articulation',
    'PKSK_ESSAY',
    'fa-pen-fancy',
    '#a855f7',
  ],
]

export const SEED_DOMAINS: readonly PkskDomain[] = ROWS.map(
  ([id, bahagian, name, nameEn, code, icon, color]) => ({
    id,
    bahagian,
    name,
    nameEn,
    code,
    icon,
    color,
    order: id,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  }),
)

export const SEED_PACKAGES: readonly PkskPackage[] = [
  { id: 1, name: 'PKSK Tingkatan 1 (SBP/MRSM)', level: 'T1' },
  { id: 2, name: 'PKSK Tingkatan 4 (SBP/MRSM)', level: 'T4' },
  { id: 3, name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
]

/** S3 sections (URS FN-M07-1.3.3, OBSERVED). */
export const BAHAGIAN_SECTIONS: Readonly<Record<Bahagian, { name: string; subtitle: string }>> = {
  A: { name: 'Kecerdasan Insaniah', subtitle: 'Nilai, akhlak & sahsiah' },
  B: { name: 'Kecerdasan Intelek', subtitle: 'Kognitif & penaakulan' },
  C: { name: 'Artikulasi Penulisan', subtitle: 'Penulisan kreatif' },
}

/** Full-exam composition and weights (BR-M07-13, BR-M07-09; SOURCE-DERIVED from the S1 copy). */
export const EXAM_PLAN: readonly { bahagian: Bahagian; count: number; weightPct: number }[] = [
  { bahagian: 'A', count: 30, weightPct: 20 },
  { bahagian: 'B', count: 70, weightPct: 70 },
  { bahagian: 'C', count: 1, weightPct: 10 },
]

/** Practice session size (BR-M07-25, prototype choice). */
export const PRACTICE_SIZE = 10

/** Domain x level question totals (§6.8; the M04 `PKSK_DOMAINS` figures): `[T1, T4]`. */
export const DOMAIN_LEVEL_TOTALS: Readonly<Record<number, readonly [number, number]>> = {
  1: [80, 80],
  2: [27, 27],
  3: [27, 27],
  4: [27, 27],
  5: [27, 24],
  6: [20, 20],
  7: [20, 20],
  8: [20, 20],
  9: [20, 20],
  10: [20, 20],
  11: [20, 20],
  12: [20, 20],
  13: [20, 20],
  14: [20, 20],
  15: [15, 15],
}
