import type { Bahagian, PkskLevel } from '../api/types'

export const TAB_TITLE = 'PRESTASIPLUS - Platform Latih Tubi Nasional'

/** Hub copy per level (URS FN-M07-1.1.4). */
export const LEVEL_CARDS: {
  level: PkskLevel
  name: string
  text: string
  tile: string
  button: string
}[] = [
  {
    level: 'T1',
    name: 'Tingkatan 1',
    text: 'Persediaan untuk kemasukan ke tingkatan 1 di SBP/MRSM/SMKA',
    tile: 'from-indigo-600 to-purple-600',
    button: 'from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/40',
  },
  {
    level: 'T4',
    name: 'Tingkatan 4',
    text: 'Persediaan untuk kemasukan ke tingkatan 4 di SBP/MRSM/SMKA',
    tile: 'from-purple-600 to-pink-600',
    button: 'from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/40',
  },
]

/** Exam format tiles (URS FN-M07-1.1.3). */
export const FORMAT_TILES: {
  bahagian: Bahagian
  name: string
  count: number
  unit: string
  weight: number
  chip: string
  icon: string
  circle: string
}[] = [
  {
    bahagian: 'A',
    name: 'Kecerdasan Insaniah',
    count: 30,
    unit: 'soalan',
    weight: 20,
    chip: 'Nilai, akhlak & sahsiah',
    icon: 'fa-heart',
    circle: 'bg-blue-500',
  },
  {
    bahagian: 'B',
    name: 'Kecerdasan Intelek',
    count: 70,
    unit: 'soalan',
    weight: 70,
    chip: 'Kognitif & penaakulan',
    icon: 'fa-brain',
    circle: 'bg-purple-500',
  },
  {
    bahagian: 'C',
    name: 'Artikulasi Penulisan',
    count: 1,
    unit: 'esei',
    weight: 10,
    chip: 'Penulisan kreatif',
    icon: 'fa-pen-fancy',
    circle: 'bg-pink-500',
  },
]

/** Section badge / hover colours of S3 (URS FN-M07-1.3.3, 1.3.4). */
export const SECTION_STYLE: Record<Bahagian, { badge: string; hover: string }> = {
  A: { badge: 'bg-blue-500', hover: 'hover:border-blue-300' },
  B: { badge: 'bg-purple-500', hover: 'hover:border-purple-300' },
  C: { badge: 'bg-pink-500', hover: 'hover:border-pink-300' },
}

/** `#rrggbb` + 13% alpha (`21` hex) for the icon tile of a domain (FR-M07-09). */
export const tint = (hex: string): string => `${hex}21`
