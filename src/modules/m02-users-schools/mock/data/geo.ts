/**
 * JPN (state education departments) and PPD (district offices): M02 DATA-M02-04 / DATA-M02-05,
 * SRS v1.18 §6.4, §6.14 "JPN / PPD" (16 JPN; Selangor with the 10 observed PPDs; every other JPN
 * ≥ 1 PPD).
 *
 * Sources:
 * - JPN names and their order: OBSERVED (`/api/jpn` list on S2, discovery §B.C). JPN ids 1–16 in
 *   that order and the codes other than JHR, KDH, KTN: INFERRED.
 * - Selangor PPDs (codes, names, ids 127–136): OBSERVED.
 * - Johor PPDs (11): OBSERVED on M18 `/jpn/dashboard` (M18 §6.10). PPD BATANG PADANG (Perak): OBSERVED.
 * - Every other PPD, and every id outside 127–136: INFERRED (the state's district offices). School
 *   `district` values "PPW SENTUL" (Kuala Lumpur) and "JPN PERLIS" (Perlis) are OBSERVED labels, so
 *   those JPNs use them as district codes.
 *
 * `name` = the code with every word after the prefix in title case ("PPD GOMBAK" → "PPD Gombak").
 */

export interface JpnDef {
  id: number
  code: string
  /** Full state name, as `School.state` and `User.ppdState`. */
  name: string
}

export interface PpdDef {
  id: number
  jpnId: number
  /** e.g. "PPD GOMBAK" = `School.district` / `User.ppdDistrict`. */
  code: string
  /** e.g. "PPD Gombak". */
  name: string
}

/** The 16 JPN in the observed list order. */
export const JPN_LIST: readonly JpnDef[] = Object.freeze([
  { id: 1, code: 'JHR', name: 'Johor' },
  { id: 2, code: 'KDH', name: 'Kedah' },
  { id: 3, code: 'KTN', name: 'Kelantan' },
  { id: 4, code: 'WPKL', name: 'Kuala Lumpur' },
  { id: 5, code: 'WPL', name: 'Labuan' },
  { id: 6, code: 'MLK', name: 'Melaka' },
  { id: 7, code: 'NSN', name: 'Negeri Sembilan' },
  { id: 8, code: 'PHG', name: 'Pahang' },
  { id: 9, code: 'PRK', name: 'Perak' },
  { id: 10, code: 'PLS', name: 'Perlis' },
  { id: 11, code: 'PNG', name: 'Pulau Pinang' },
  { id: 12, code: 'WPP', name: 'Putrajaya' },
  { id: 13, code: 'SBH', name: 'Sabah' },
  { id: 14, code: 'SWK', name: 'Sarawak' },
  { id: 15, code: 'SGR', name: 'Selangor' },
  { id: 16, code: 'TRG', name: 'Terengganu' },
])

export type StateName = (typeof JPN_LIST)[number]['name']

/** District codes per state (see the header for sources). */
const PPD_CODES: Readonly<Record<string, readonly string[]>> = {
  Johor: [
    'PPD BATU PAHAT',
    'PPD JOHOR BAHRU',
    'PPD KLUANG',
    'PPD KOTA TINGGI',
    'PPD KULAI',
    'PPD MERSING',
    'PPD MUAR',
    'PPD PASIR GUDANG',
    'PPD PONTIAN',
    'PPD SEGAMAT',
    'PPD TANGKAK',
  ],
  Kedah: [
    'PPD BALING',
    'PPD BANDAR BAHARU',
    'PPD KOTA SETAR',
    'PPD KUALA MUDA/YAN',
    'PPD KUBANG PASU',
    'PPD KULIM',
    'PPD LANGKAWI',
    'PPD PADANG TERAP',
    'PPD PENDANG',
    'PPD SIK',
  ],
  Kelantan: [
    'PPD BACHOK',
    'PPD GUA MUSANG',
    'PPD JELI',
    'PPD KOTA BHARU',
    'PPD KUALA KRAI',
    'PPD MACHANG',
    'PPD PASIR MAS',
    'PPD PASIR PUTEH',
    'PPD TANAH MERAH',
    'PPD TUMPAT',
  ],
  'Kuala Lumpur': ['PPW BANGSAR PUDU', 'PPW KERAMAT', 'PPW SENTUL'],
  Labuan: ['PPW LABUAN'],
  Melaka: ['PPD ALOR GAJAH', 'PPD JASIN', 'PPD MELAKA TENGAH'],
  'Negeri Sembilan': [
    'PPD JELEBU',
    'PPD JEMPOL',
    'PPD KUALA PILAH',
    'PPD PORT DICKSON',
    'PPD REMBAU',
    'PPD SEREMBAN',
    'PPD TAMPIN',
  ],
  Pahang: [
    'PPD BENTONG',
    'PPD BERA',
    'PPD CAMERON HIGHLANDS',
    'PPD JERANTUT',
    'PPD KUANTAN',
    'PPD LIPIS',
    'PPD MARAN',
    'PPD PEKAN',
    'PPD RAUB',
    'PPD ROMPIN',
    'PPD TEMERLOH',
  ],
  Perak: [
    'PPD BAGAN DATUK',
    'PPD BATANG PADANG',
    'PPD HILIR PERAK',
    'PPD HULU PERAK',
    'PPD KERIAN',
    'PPD KINTA SELATAN',
    'PPD KINTA UTARA',
    'PPD KUALA KANGSAR',
    'PPD LARUT MATANG DAN SELAMA',
    'PPD MANJUNG',
    'PPD MUALLIM',
    'PPD PERAK TENGAH',
  ],
  Perlis: ['JPN PERLIS'],
  'Pulau Pinang': [
    'PPD BARAT DAYA',
    'PPD SEBERANG PERAI SELATAN',
    'PPD SEBERANG PERAI TENGAH',
    'PPD SEBERANG PERAI UTARA',
    'PPD TIMUR LAUT',
  ],
  Putrajaya: ['PPW PUTRAJAYA'],
  Sabah: [
    'PPD BEAUFORT',
    'PPD KENINGAU',
    'PPD KOTA BELUD',
    'PPD KOTA KINABALU',
    'PPD KOTA MARUDU',
    'PPD KUDAT',
    'PPD LAHAD DATU',
    'PPD PAPAR',
    'PPD PENAMPANG',
    'PPD RANAU',
    'PPD SANDAKAN',
    'PPD SEMPORNA',
    'PPD TAWAU',
    'PPD TUARAN',
  ],
  Sarawak: [
    'PPD BETONG',
    'PPD BINTULU',
    'PPD KAPIT',
    'PPD KUCHING',
    'PPD LIMBANG',
    'PPD MIRI',
    'PPD MUKAH',
    'PPD PADAWAN',
    'PPD SAMARAHAN',
    'PPD SARIKEI',
    'PPD SERIAN',
    'PPD SIBU',
    'PPD SRI AMAN',
  ],
  Selangor: [
    'PPD GOMBAK',
    'PPD HULU LANGAT',
    'PPD HULU SELANGOR',
    'PPD KLANG',
    'PPD KUALA LANGAT',
    'PPD KUALA SELANGOR',
    'PPD PETALING PERDANA',
    'PPD PETALING UTAMA',
    'PPD SABAK BERNAM',
    'PPD SEPANG',
  ],
  Terengganu: [
    'PPD BESUT',
    'PPD DUNGUN',
    'PPD HULU TERENGGANU',
    'PPD KEMAMAN',
    'PPD KUALA NERUS',
    'PPD KUALA TERENGGANU',
    'PPD MARANG',
    'PPD SETIU',
  ],
}

/** Observed Selangor PPD ids (M02 §6.4). */
const SELANGOR_FIRST_ID = 127

function titleCase(code: string): string {
  const [prefix, ...rest] = code.split(' ')
  const words = rest.map((w) =>
    w
      .toLowerCase()
      .split('/')
      .map((p) => (p ? (p[0] as string).toUpperCase() + p.slice(1) : p))
      .join('/'),
  )
  return [prefix, ...words].join(' ')
}

function buildPpds(): PpdDef[] {
  const out: PpdDef[] = []
  let next = 1
  for (const jpn of JPN_LIST) {
    const codes = PPD_CODES[jpn.name] ?? []
    codes.forEach((code, i) => {
      let id: number
      if (jpn.name === 'Selangor') id = SELANGOR_FIRST_ID + i
      else {
        const selangorEnd = SELANGOR_FIRST_ID + (PPD_CODES.Selangor?.length ?? 0) - 1
        if (next >= SELANGOR_FIRST_ID && next <= selangorEnd) next = selangorEnd + 1
        id = next++
      }
      out.push({ id, jpnId: jpn.id, code, name: titleCase(code) })
    })
  }
  return out
}

/** Every PPD, in JPN order then code order. */
export const PPD_LIST: readonly PpdDef[] = Object.freeze(buildPpds())

/** District codes of a state (empty for an unknown state). */
export function districtsOf(state: string): readonly string[] {
  return PPD_CODES[state] ?? []
}

export const STATE_NAMES: readonly string[] = JPN_LIST.map((j) => j.name)
