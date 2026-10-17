import type { DsAccent } from '@/ds'

import type { Bahagian, PkskLevel } from '../api/types'

export const TAB_TITLE = 'PRESTASIPLUS - Platform Latih Tubi Nasional'

/** Hub copy per level (URS FN-M07-1.1.4). */
export const LEVEL_CARDS: {
  level: PkskLevel
  name: string
  text: string
  accent: DsAccent
}[] = [
  {
    level: 'T1',
    name: 'Tingkatan 1',
    text: 'Persediaan untuk kemasukan ke tingkatan 1 di SBP/MRSM/SMKA',
    accent: 'action',
  },
  {
    level: 'T4',
    name: 'Tingkatan 4',
    text: 'Persediaan untuk kemasukan ke tingkatan 4 di SBP/MRSM/SMKA',
    accent: 'trial',
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
  accent: DsAccent
}[] = [
  {
    bahagian: 'A',
    name: 'Kecerdasan Insaniah',
    count: 30,
    unit: 'soalan',
    weight: 20,
    chip: 'Nilai, akhlak & sahsiah',
    icon: 'i-ph-heart-duotone',
    accent: 'action',
  },
  {
    bahagian: 'B',
    name: 'Kecerdasan Intelek',
    count: 70,
    unit: 'soalan',
    weight: 70,
    chip: 'Kognitif & penaakulan',
    icon: 'i-ph-brain-duotone',
    accent: 'trial',
  },
  {
    bahagian: 'C',
    name: 'Artikulasi Penulisan',
    count: 1,
    unit: 'esei',
    weight: 10,
    chip: 'Penulisan kreatif',
    icon: 'i-ph-pen-nib-duotone',
    accent: 'heat',
  },
]

/** Section accent of S3 (URS FN-M07-1.3.3, 1.3.4). */
export const SECTION_STYLE: Record<Bahagian, { accent: DsAccent }> = {
  A: { accent: 'action' },
  B: { accent: 'trial' },
  C: { accent: 'heat' },
}
