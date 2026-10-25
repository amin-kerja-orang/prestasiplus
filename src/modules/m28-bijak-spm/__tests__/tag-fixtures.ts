/**
 * Shared fixtures for the DSKP tag tests: real catalogue ids (M03 is the owner, so the tests read
 * the catalogue through `dskp-source` and never copy its schema) and tag builders.
 */
import type { TagLookup } from '../domain/tag-rule'
import type { CurriculumTag, DskpSpId, DskpUnitId } from '../domain/types'
import { catalogueVersion, tagLookupFor } from '../lib/dskp-source'

/** Matematik Tingkatan 4, unit 1.0 "Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah". */
export const MAT_T4_UNIT = 'MAT:T4:u:1.0' as DskpUnitId
export const MAT_T4_SP = 'MAT:T4:sp:1.1.6' as DskpSpId
export const MAT_T4_SP2 = 'MAT:T4:sp:1.1.5' as DskpSpId
/** Matematik Tingkatan 4, unit 2.0 "Asas Nombor" (another unit of the same subject and tingkatan). */
export const MAT_T4_OTHER_UNIT = 'MAT:T4:u:2.0' as DskpUnitId
export const MAT_T4_OTHER_SP = 'MAT:T4:sp:2.1.1' as DskpSpId
/** Matematik Tingkatan 5, unit 1.0 "Ubahan". */
export const MAT_T5_UNIT = 'MAT:T5:u:1.0' as DskpUnitId
export const MAT_T5_SP = 'MAT:T5:sp:1.1.1' as DskpSpId
/** Sains Tingkatan 4, unit 1.0 (another subject). */
export const SN_T4_UNIT = 'SN:T4:u:1.0' as DskpUnitId
/** A printed "No learning standard" slot of Bahasa Inggeris: in the catalogue but not selectable. */
export const BI_T4_SLOT = 'BI:T4:sp:1.1.4' as DskpSpId

/** A lookup over the real catalogue with Matematik, Sains and Bahasa Inggeris loaded. */
export const loadTagLookup = (): Promise<TagLookup> => tagLookupFor(['MAT', 'SN', 'BI'])

/** A complete Matematik T4 tag (passes the rule). */
export function matTag(over: Partial<CurriculumTag> = {}): CurriculumTag {
  return {
    subject: 'MAT',
    formOrigin: 'T4',
    unitId: MAT_T4_UNIT,
    spIds: [MAT_T4_SP],
    tp: 3,
    kbat: null,
    catalogueVersion: catalogueVersion(),
    ...over,
  }
}

/** A T1-T3 tag (outside DSKP, passes the rule with its TP). */
export function t13Tag(over: Partial<CurriculumTag> = {}): CurriculumTag {
  return {
    subject: 'MAT',
    formOrigin: 'T1-T3',
    unitId: null,
    spIds: [],
    tp: 2,
    kbat: null,
    catalogueVersion: null,
    ...over,
  }
}
