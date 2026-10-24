import { DSKP_FLAGS, type DskpFlag } from './types.ts'

/**
 * Flag labels (Bahasa Melayu, [PROPOSED] by the design, section 2.3) and ordering. The reviewed
 * table that says which node carries which flag lives in the generator
 * (`scripts/fixtures/build-m03-dskp.ts`, `FLAG_TABLE`), each entry citing its source.
 */

export const DSKP_FLAG_LABELS: Readonly<Record<DskpFlag, string>> = {
  perluSemakanEjaan: 'perlu semakan ejaan',
  reconstructed: 'teks dibina semula',
  inferred: 'pemetaan disimpulkan',
  tpUnaligned: 'baris TP tidak sejajar',
  noStandard: 'tiada standard pembelajaran',
  draftEdition: 'edisi draf',
  textDefect: 'teks rosak atau tidak lengkap',
  codeQuirk: 'nombor kod berbeza daripada cetakan',
}

/** Display and storage order of flags on a node. */
export const DSKP_FLAG_ORDER: readonly DskpFlag[] = DSKP_FLAGS

/** Flags that render as the single "perlu semakan" badge (the label becomes its tooltip). */
export const DSKP_REVIEW_BADGE_FLAGS: readonly DskpFlag[] = [
  'perluSemakanEjaan',
  'reconstructed',
  'inferred',
  'tpUnaligned',
  'draftEdition',
  'textDefect',
]

/** A node with one of these flags cannot be chosen in a tag (a printed "No learning standard" slot). */
export const DSKP_NON_SELECTABLE_FLAGS: readonly DskpFlag[] = ['noStandard']

/** Informational flags: carried in the data, no badge. */
export const DSKP_INFO_FLAGS: readonly DskpFlag[] = ['codeQuirk']

/** Sorts and de-duplicates flags into the canonical order. */
export function sortFlags(flags: readonly DskpFlag[]): DskpFlag[] {
  return DSKP_FLAG_ORDER.filter((f) => flags.includes(f))
}
