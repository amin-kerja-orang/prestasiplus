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
    accent: 'friend',
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
    accent: 'friend',
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
  B: { accent: 'friend' },
  C: { accent: 'heat' },
}

/**
 * "Pakej PKSK" display list of the hub (R1-MUR-19, D115): the five packages as observed on V2.
 * Display only: the prices are never used for billing.
 */
export const PKSK_PACKAGES: readonly { name: string; price: string }[] = [
  { name: 'PKSK Tingkatan 1 (SBP/MRSM)', price: 'RM0.00' },
  { name: 'PKSK Tingkatan 4 (SBP/MRSM)', price: 'RM0.00' },
  { name: 'PKSK Kombo (T1 + T4)', price: 'RM0.00' },
  { name: 'PKSK Asas', price: 'RM39.00' },
  { name: 'PKSK Premium', price: 'RM79.00' },
]

/** The levels in the order the hub offers them (T1 before T4). */
export const LEVEL_ORDER: readonly PkskLevel[] = ['T1', 'T4']

/** How many domains "Domain teratas" lists. */
export const TOP_DOMAIN_COUNT = 12
