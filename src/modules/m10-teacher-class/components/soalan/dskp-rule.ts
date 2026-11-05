/**
 * The conditional DSKP rule of the teacher question forms (D112; PRD-20 R1-GUR-44 44-F1, FR-GUR-44-9, FR-GUR-44-11).
 * One pure module so that "Tambah Soalan" (S6-T06) and "Soalan & Rujukan" (S6-T16) share it:
 *
 * - Bab (`chapterId`) is required only when the chosen Subjek + Tingkatan has chapters;
 * - SP (`spIds`, 1 to 3 ids; the single select sends one), TP (`tp`, 1 to 6) and Aras Pemikiran
 *   (`cognitiveLevel`) are required only where DSKP nodes exist for that Subjek + Tingkatan.
 *
 * "Exist" is decided by the caller from the lookups (the Bab list and the SP list of the pair) and handed in as
 * a `DskpContext`. The server applies the same rule and the same texts (422 `VALIDATION_ERROR`, `fields.<name>`).
 */

/** The exact BM texts of 44-F1 (the server sends the same strings). */
export const DSKP_MESSAGES = {
  chapterId: 'Sila pilih bab.',
  spIds: 'Sila pilih Standard Pembelajaran (SP).',
  tp: 'Sila pilih TP.',
  tpRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  cognitiveLevel: 'Sila pilih aras pemikiran.',
  difficultyLevel: 'Sila pilih kesukaran.',
} as const

/** What the lookups found for the chosen Subjek + Tingkatan. */
export interface DskpContext {
  /** The Bab list (API-GUR-08) is not empty. */
  hasChapters: boolean
  /** DSKP nodes exist (the SP list of API-DSKP-07 is not empty). */
  hasDskpNodes: boolean
}

export type DskpField = 'chapterId' | 'spIds' | 'tp' | 'cognitiveLevel'

/** The DSKP values of a form (empty string / null / empty list = not chosen). */
export interface DskpPick {
  chapterId: string | number | null
  spIds: readonly (string | number)[]
  tp: string | number | null
  cognitiveLevel: string | null
}

export const MAX_SP = 3
export const TP_VALUES = [1, 2, 3, 4, 5, 6] as const

/** Empty-list texts under the selects (44-F1: the control shows it and is not required). */
export const DSKP_EMPTY = {
  chapter: 'Tiada bab untuk subjek dan tingkatan ini.',
  sp: 'Tiada SP untuk subjek dan tingkatan ini.',
} as const

/** Which of the four fields are required for this Subjek + Tingkatan (D112). */
export function dskpRequired(ctx: DskpContext): Record<DskpField, boolean> {
  return {
    chapterId: ctx.hasChapters,
    spIds: ctx.hasDskpNodes,
    tp: ctx.hasDskpNodes,
    cognitiveLevel: ctx.hasDskpNodes,
  }
}

const blank = (v: unknown): boolean => v === null || v === undefined || v === ''

/** A TP as a whole number 1 to 6, else `null`. */
export function parseTp(value: string | number | null): number | null {
  if (blank(value)) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : null
}

/**
 * The field errors of a DSKP pick (`{}` = valid). A required field left empty gets its "Sila pilih ..." text; a TP that
 * is sent but outside 1 to 6 gets the range text whether or not it is required; more than 3 SP is refused with the SP text.
 */
export function validateDskp(pick: DskpPick, ctx: DskpContext): Partial<Record<DskpField, string>> {
  const need = dskpRequired(ctx)
  const errors: Partial<Record<DskpField, string>> = {}
  if (need.chapterId && blank(pick.chapterId)) errors.chapterId = DSKP_MESSAGES.chapterId
  if ((need.spIds && pick.spIds.length < 1) || pick.spIds.length > MAX_SP) {
    errors.spIds = DSKP_MESSAGES.spIds
  }
  if (blank(pick.tp)) {
    if (need.tp) errors.tp = DSKP_MESSAGES.tp
  } else if (parseTp(pick.tp) === null) errors.tp = DSKP_MESSAGES.tpRange
  if (need.cognitiveLevel && blank(pick.cognitiveLevel)) {
    errors.cognitiveLevel = DSKP_MESSAGES.cognitiveLevel
  }
  return errors
}

/** The first field with an error, in form order (for focus). */
export const FIELD_ORDER: readonly DskpField[] = ['chapterId', 'spIds', 'tp', 'cognitiveLevel']
