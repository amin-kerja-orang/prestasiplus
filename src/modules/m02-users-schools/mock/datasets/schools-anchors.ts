/**
 * Anchors of the schools dataset (M02 SRS v1.23 §6.14 "Schools", §6.15 A; M18 §6.11 A; M16
 * XR-04; M11 §6.7): observed public school records at their live ids. Each anchor claims a slot of
 * its own cell, so no total changes (overview §6.6 step 3).
 *
 * The four fictitious **fixture schools** of the reserved range 900001–900099 are **not** anchors
 * (v1.21, DV-M02-15 / F-23): they are stored rows outside every register count (S9 list and stats,
 * the state / PPD / type facets, the school search, `options()`, M11 / M17 / M18 rollups), held
 * in the separate table `schools.fixtures` and read only where a user's school is shown.
 *
 * Value sources (per field): id and name OBSERVED everywhere (S1 filter options, M18 snapshot,
 * M11 register). State OBSERVED for the M11 schools (M11 §6.7) and for the Johor / Perak register
 * (M18); district OBSERVED for PPD HULU LANGAT (8078, 8080, 8082, 8088, 8090, 8102, 8106, 8277),
 * PPD SABAK BERNAM (8284), PPD KUALA LANGAT (900), PPD KLUANG and PPD BATANG PADANG; code OBSERVED
 * where given (BEA4628, BFT4001, BEA4632, BBD4051, JEB2037, the KLUANG benchmark codes, "Tiada kod"
 * for 9681, 9801, 8784, 8910). Every other state, district and code is INFERRED (a code is then
 * generated). Type SK / SMK is read from the name (INFERRED; live uses only SK and SMK).
 */

import registerText from '../data/schools-register.json?raw'
import type { School, SchoolType } from '../repository/types'
import {
  generatedSchoolCode,
  generatedSchoolCreatedAt,
  generatedSchoolName,
} from './schools-derive'

/** The fixture schools (fictitious, reserved range 900001–900099). */
export const FIXTURE_SCHOOL_IDS = {
  smkDemo: 900_001,
  skDemo: 900_002,
  smkDemoSeriPutra: 900_003,
  skDemoBestari: 900_004,
} as const

export const SCHOOLS_RESERVED_RANGE = { min: 900_001, max: 900_099 } as const

export function isFixtureSchoolId(id: number): boolean {
  return id >= SCHOOLS_RESERVED_RANGE.min && id <= SCHOOLS_RESERVED_RANGE.max
}

/** Inactive observed schools (M02 §6.15 A: 8277, 8880, 2710; the other 5 are generated). */
export const INACTIVE_ANCHOR_SCHOOL_IDS: readonly number[] = [8277, 8880, 2710]

interface AnchorSpec {
  id: number
  /** `undefined` → generated fictitious name (unobserved). */
  name?: string
  /** `undefined` → generated code; `''` → no code (observed "Tiada kod"). */
  code?: string
  type: SchoolType
  state: string
  district: string | null
  isActive?: boolean
  createdAt?: string
}

/** Designed creation time of the fixture schools (same as the canonical accounts, M01). */
const FIXTURE_CREATED_AT = '2026-02-06T09:00:00+08:00'

/** The fixture schools (M02 §6.15 A; M01 v1.11; M09 v1.1): stored rows, outside every count. */
const FIXTURE_SPECS: readonly AnchorSpec[] = [
  {
    id: 900_001,
    name: 'SMK DEMO',
    code: 'BEA4001',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD PETALING UTAMA',
    createdAt: FIXTURE_CREATED_AT,
  },
  {
    id: 900_002,
    name: 'SK Demo',
    code: '',
    type: 'SK',
    state: 'Johor',
    district: null,
    createdAt: FIXTURE_CREATED_AT,
  },
  {
    id: 900_003,
    name: 'SMK Demo Seri Putra',
    code: 'DMO0003',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
    createdAt: FIXTURE_CREATED_AT,
  },
  {
    id: 900_004,
    name: 'SK Demo Bestari',
    code: '',
    type: 'SK',
    state: 'Johor',
    district: null,
    createdAt: FIXTURE_CREATED_AT,
  },
]

/** Anchors outside the Johor / Perak register (hand-written; see the header for sources). */
const OTHER_ANCHORS: readonly AnchorSpec[] = [
  // --- Selangor ---------------------------------------------------------------------------
  {
    id: 8102,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA',
    code: 'BEA4628',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8277,
    name: 'SAM HULU LANGAT',
    code: 'BFT4001',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
    isActive: false,
  },
  {
    id: 8106,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING',
    code: 'BEA4632',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8078,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8080,
    name: 'SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8082,
    name: 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8088,
    name: 'SEKOLAH MENENGAH KEBANGSAAN JALAN TIGA',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8090,
    name: 'SEKOLAH MENENGAH KEBANGSAAN PANDAN INDAH',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8284,
    name: 'SAM MUHAMMADIAH',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD SABAK BERNAM',
  },
  { id: 900, type: 'SK', state: 'Selangor', district: 'PPD KUALA LANGAT' },
  {
    id: 987,
    name: 'SEKOLAH KEBANGSAAN BANDAR BARU BANGI',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  // BBD4051: observed name and code; the live id was not captured (INFERRED id 1003).
  {
    id: 1003,
    name: 'SEKOLAH JENIS KEBANGSAAN (TAMIL) BANGI',
    code: 'BBD4051',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 940,
    name: 'SEKOLAH KEBANGSAAN KUALA SELANGOR',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD KUALA SELANGOR',
  },
  {
    id: 995,
    name: 'SEKOLAH KEBANGSAAN PANDAN INDAH',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 1014,
    name: 'SEKOLAH KEBANGSAAN BANDAR RINCHING',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 977,
    name: 'SEKOLAH KEBANGSAAN KAJANG',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 978,
    name: 'SEKOLAH KEBANGSAAN BERANANG',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 998,
    name: 'SEKOLAH KEBANGSAAN SAUJANA IMPIAN',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 1275,
    name: 'SEKOLAH KEBANGSAAN KHIR JOHARI',
    type: 'SK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8098,
    name: 'SEKOLAH MENENGAH KEBANGSAAN JALAN EMPAT',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8298,
    name: 'KOLEJ VOKASIONAL KAJANG',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8087,
    name: 'SEKOLAH MENENGAH KEBANGSAAN JALAN REKO',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8107,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR SERI PUTRA',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8302,
    name: 'SEKOLAH MENENGAH KEBANGSAAN AGAMA MAAHAD HAMIDIAH',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD HULU LANGAT',
  },
  {
    id: 8030,
    name: 'SEKOLAH MENENGAH KEBANGSAAN RAJA MAHADI',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD KLANG',
  },
  {
    id: 8228,
    name: 'SEKOLAH MENENGAH KEBANGSAAN TINGGI KLANG',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD KLANG',
  },
  {
    id: 8300,
    name: 'KOLEJ ISLAM SULTAN ALAM SHAH',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD KLANG',
  },
  {
    id: 8198,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BUKIT JELUTONG',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD PETALING PERDANA',
  },
  {
    id: 8209,
    name: 'SEKOLAH MENENGAH KEBANGSAAN SUBANG BESTARI',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD PETALING PERDANA',
  },
  {
    id: 8100,
    name: 'SEKOLAH MENENGAH KEBANGSAAN TAMAN JASMIN 2',
    type: 'SMK',
    state: 'Selangor',
    district: 'PPD PETALING PERDANA',
  },
  // S9 first-page row (live id observed, name not captured → generated name).
  { id: 10_124, type: 'SMK', state: 'Selangor', district: 'PPD HULU LANGAT' },
  // --- Kuala Lumpur -------------------------------------------------------------------------
  {
    id: 10_220,
    name: 'SMK Leqoe',
    type: 'SMK',
    state: 'Kuala Lumpur',
    district: 'PPW BANGSAR PUDU',
  },
  {
    id: 9681,
    name: 'SEKOLAH MENENGAH KEBANGSAAN AMINUDDIN BAKI',
    code: '',
    type: 'SMK',
    state: 'Kuala Lumpur',
    district: 'PPW BANGSAR PUDU',
  },
  {
    id: 9801,
    name: 'SMT CHERAS',
    code: '',
    type: 'SMK',
    state: 'Kuala Lumpur',
    district: 'PPW BANGSAR PUDU',
  },
  {
    id: 9726,
    name: 'SEKOLAH MENENGAH SAINS ALAM SHAH',
    type: 'SMK',
    state: 'Kuala Lumpur',
    district: 'PPW BANGSAR PUDU',
  },
  // --- other states (M11 register schools and the S1 filter schools) ------------------------
  // 1267 (M12 XR / M11): its state is not observed. Generation put it in Sarawak, which made an 11th state in the
  // M11 / M12 state selects (live shows exactly 10: no Sarawak). Pinned to Kedah, PPD BALING (INFERRED, D9): a state
  // and a PPD that already hold schools with users, so no select gains an option; it takes one generated Kedah SK
  // slot, so no state, type or total moves.
  {
    id: 1267,
    type: 'SK',
    state: 'Kedah',
    district: 'PPD BALING',
  },
  {
    id: 8308,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BENTONG',
    type: 'SMK',
    state: 'Pahang',
    district: 'PPD BENTONG',
  },
  {
    id: 1712,
    name: 'SEKOLAH KEBANGSAAN TEMAI',
    type: 'SK',
    state: 'Pahang',
    district: 'PPD PEKAN',
  },
  {
    id: 8965,
    name: 'SEKOLAH MENENGAH KEBANGSAAN BALING',
    type: 'SMK',
    state: 'Kedah',
    district: 'PPD BALING',
  },
  {
    id: 3390,
    name: 'SEKOLAH KEBANGSAAN BALING',
    type: 'SK',
    state: 'Kedah',
    district: 'PPD BALING',
  },
  {
    id: 3582,
    name: 'SEKOLAH KEBANGSAAN BANDAR BARU DARULAMAN',
    type: 'SK',
    state: 'Kedah',
    district: 'PPD KUBANG PASU',
  },
  {
    id: 1518,
    name: 'SEKOLAH KEBANGSAAN TUANKU FATIMAH',
    type: 'SK',
    state: 'Kedah',
    district: 'PPD KUALA MUDA/YAN',
  },
  {
    id: 9167,
    name: 'SEKOLAH MENENGAH KEBANGSAAN GHAFAR BABA',
    type: 'SMK',
    state: 'Melaka',
    district: 'PPD JASIN',
  },
  {
    id: 3931,
    name: 'SEKOLAH KEBANGSAAN MASJID TANAH',
    type: 'SK',
    state: 'Melaka',
    district: 'PPD ALOR GAJAH',
  },
  {
    id: 9806,
    name: 'SEKOLAH MENENGAH KEBANGSAAN KENINGAU',
    type: 'SMK',
    state: 'Sabah',
    district: 'PPD KENINGAU',
  },
  {
    id: 9924,
    name: 'SEKOLAH MENENGAH KEBANGSAAN TAMBULION',
    type: 'SMK',
    state: 'Sabah',
    district: 'PPD KOTA BELUD',
  },
  {
    id: 5997,
    name: 'SEKOLAH KEBANGSAAN PEKAN TUARAN',
    type: 'SK',
    state: 'Sabah',
    district: 'PPD TUARAN',
  },
  {
    id: 5441,
    name: 'SEKOLAH KEBANGSAAN AMBUAL',
    type: 'SK',
    state: 'Sabah',
    district: 'PPD KOTA MARUDU',
  },
  {
    id: 5183,
    name: 'SEKOLAH KEBANGSAAN TOK JEMBAL',
    type: 'SK',
    state: 'Terengganu',
    district: 'PPD KUALA NERUS',
  },
  {
    id: 4961,
    name: 'SEKOLAH KEBANGSAAN CHUKAI',
    type: 'SK',
    state: 'Terengganu',
    district: 'PPD KEMAMAN',
  },
  {
    id: 2418,
    name: 'SEKOLAH KEBANGSAAN JELI (1)',
    type: 'SK',
    state: 'Kelantan',
    district: 'PPD JELI',
  },
  {
    id: 8641,
    name: 'SEKOLAH MENENGAH SAINS TENGKU MUHAMMAD FARIS PETRA',
    type: 'SMK',
    state: 'Kelantan',
    district: 'PPD KOTA BHARU',
  },
]

type RegisterEntry = [number, string, string | null, string, 'SK' | 'SMK']

function registerSpecs(): AnchorSpec[] {
  const data = JSON.parse(registerText) as { johor: RegisterEntry[]; perak: RegisterEntry[] }
  const out: AnchorSpec[] = []
  for (const [state, list] of [
    ['Johor', data.johor],
    ['Perak', data.perak],
  ] as const) {
    for (const [id, name, code, district, type] of list) {
      out.push({
        id,
        name,
        ...(code === null ? {} : { code }),
        type,
        state,
        district,
        isActive: !INACTIVE_ANCHOR_SCHOOL_IDS.includes(id),
      })
    }
  }
  return out
}

function toRow(a: AnchorSpec): School {
  const createdAt = a.createdAt ?? generatedSchoolCreatedAt(a.id)
  return Object.freeze({
    id: a.id,
    name: a.name ?? generatedSchoolName(a.id, a.type),
    code: a.code ?? generatedSchoolCode(a.id, a),
    type: a.type,
    state: a.state,
    district: a.district,
    city: null,
    isActive: a.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
  })
}

/** The 4 fixture school rows (table `schools.fixtures`), in id order. */
export const FIXTURE_SCHOOL_ROWS: readonly School[] = Object.freeze(FIXTURE_SPECS.map(toRow))

/** Every literal anchor row, in id order. */
export const SCHOOL_ANCHOR_ROWS: readonly School[] = Object.freeze(
  [...registerSpecs(), ...OTHER_ANCHORS].map(toRow).sort((a, b) => a.id - b.id),
)

/** The register fixture text (hashed into the M02 seed version). */
export const SCHOOLS_REGISTER_TEXT: string = registerText

/** The register anchors per state (M18 §6.11 A; Johor 1,189 and Perak 1,102). */
export const REGISTER_COUNTS = { Johor: 1189, Perak: 1102 } as const
