/**
 * Generated (non-observed) school fields: pure functions of the id and the facets, so they can be
 * cheap fields of the schools dataset (overview §6.6 "cheap fields"). Every generated value is
 * `observed:false` and fictitious: names read "SEKOLAH KEBANGSAAN DEMO {id}" /
 * "SEKOLAH MENENGAH KEBANGSAAN DEMO {id}", so a search for a real school name only finds the
 * observed anchors.
 */

import { toIsoMyt } from '@/lib/time'

import { districtsOf } from '../data/geo'
import type { SchoolFacets, SchoolType } from '../repository/types'

/** First letter of KPM codes per state (live codes: B Selangor, J Johor, A Perak; others INFERRED). */
const STATE_LETTER: Readonly<Record<string, string>> = {
  Johor: 'J',
  Kedah: 'K',
  Kelantan: 'D',
  'Kuala Lumpur': 'W',
  Labuan: 'L',
  Melaka: 'M',
  'Negeri Sembilan': 'N',
  Pahang: 'C',
  Perak: 'A',
  Perlis: 'R',
  'Pulau Pinang': 'P',
  Putrajaya: 'W',
  Sabah: 'X',
  Sarawak: 'Y',
  Selangor: 'B',
  Terengganu: 'T',
}

const LONG_TYPE: Readonly<Record<SchoolType, string>> = {
  SK: 'SEKOLAH KEBANGSAAN',
  SMK: 'SEKOLAH MENENGAH KEBANGSAAN',
  'SJK(C)': 'SEKOLAH JENIS KEBANGSAAN (CINA)',
  'SJK(T)': 'SEKOLAH JENIS KEBANGSAAN (TAMIL)',
  MRSM: 'MAKTAB RENDAH SAINS MARA',
  SBP: 'SEKOLAH BERASRAMA PENUH',
}

/** Generated school name (fictitious). */
export function generatedSchoolName(id: number, type: SchoolType): string {
  return `${LONG_TYPE[type]} DEMO ${String(id)}`
}

/**
 * Generated KPM-style code: state letter, type letter (SK "B", SMK "E", as the live BBD / BEA
 * codes), district letter, then the zero-padded id (5 digits, so a generated code never equals an
 * observed 7-character code). Unique per id.
 */
export function generatedSchoolCode(
  id: number,
  facets: Pick<SchoolFacets, 'state' | 'district' | 'type'>,
): string {
  const s = STATE_LETTER[facets.state] ?? 'Z'
  const t = facets.type === 'SK' ? 'B' : 'E'
  const idx = facets.district === null ? -1 : districtsOf(facets.state).indexOf(facets.district)
  const d = idx < 0 ? 'Z' : String.fromCharCode(65 + (idx % 26))
  return `${s}${t}${d}${String(id).padStart(5, '0')}`
}

/** Designed creation time of generated schools: increasing with id (live auto-increment). */
const CREATED_BASE_MS = Date.parse('2025-01-06T09:00:00+08:00')
const CREATED_STEP_MS = 30 * 60_000

export function generatedSchoolCreatedAtMs(id: number): number {
  return CREATED_BASE_MS + id * CREATED_STEP_MS
}

export function generatedSchoolCreatedAt(id: number): string {
  return toIsoMyt(generatedSchoolCreatedAtMs(id))
}
