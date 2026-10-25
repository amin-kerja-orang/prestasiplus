/**
 * The one DSKP tag rule (v2-dskp-integration 5.2, AC-07.x): pure, shared by batch submit, revision
 * and publish so the three entry points can never disagree. It reads the catalogue only through the
 * narrow `TagLookup`, so it moves to `@pp/exam-core` unchanged: this file imports types only (no
 * `src/**`, Vue or `node:` imports).
 */
import type { CurriculumTag } from './types'
import { KBAT_LEVELS } from './types'

/**
 * Most SP one question may carry. null = no cap (Q-D6); D9's "1 to 3" is one constant away. When it
 * is a number, `tagIssues` refuses a tag with more SP than that.
 */
export const MAX_SP_PER_QUESTION: number | null = null

/** The messages of the rule (exact BM copy; the ones marked in the design as existing predate v2). */
export const TAG_MESSAGES = {
  noSubjectOrForm: 'Subjek dan tingkatan perlu ditetapkan.',
  noUnit: 'Unit DSKP belum dipilih.',
  outsideDskpHasUnit: 'Tingkatan 1-3 (di luar DSKP) tidak mempunyai unit atau SP.',
  unitNotInCatalogue: 'Unit DSKP tidak wujud dalam katalog.',
  noSp: 'Standard Pembelajaran (SP) belum dipilih.',
  spNotInUnit: 'SP tidak wujud dalam unit yang dipilih.',
  noTp: 'Tahap Penguasaan (TP) belum dipilih.',
  tpOutOfRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  kbatInvalid: 'Aras KBAT tidak sah.',
  tooManySp: (max: number): string => `Pilih paling banyak ${max} SP.`,
} as const

export interface TagIssue {
  field: 'subject' | 'formOrigin' | 'unit' | 'sp' | 'tp' | 'kbat'
  message: string
}

/**
 * What the rule needs from a catalogue. The catalogue (M03 in the prototype, a database in the
 * backend) supplies it; a lookup answers `undefined`/`false` for anything it does not know, and a
 * lookup that has not loaded a subject therefore reports that subject's ids as missing.
 */
export interface TagLookup {
  subject(code: string): boolean
  /** `title` is the unit title as printed, for display only (`topicOf`); the rule does not read it. */
  unit(id: string): { subject: string; tingkatan: 'T4' | 'T5'; title: string } | undefined
  sp(id: string): { unitId: string; selectable: boolean } | undefined
}

/** Every problem that stops `tag` from being submitted, revised or published (empty = it passes). */
export function tagIssues(tag: CurriculumTag, lookup: TagLookup): TagIssue[] {
  const out: TagIssue[] = []
  const add = (field: TagIssue['field'], message: string): void => {
    out.push({ field, message })
  }

  if (!tag.subject || !lookup.subject(tag.subject)) add('subject', TAG_MESSAGES.noSubjectOrForm)
  else if (tag.formOrigin === null) add('formOrigin', TAG_MESSAGES.noSubjectOrForm)

  if (tag.formOrigin === 'T1-T3') {
    // Outside DSKP: exempt from unit and SP, and they must be empty (AC-04.6).
    if (tag.unitId !== null) add('unit', TAG_MESSAGES.outsideDskpHasUnit)
    else if (tag.spIds.length > 0) add('sp', TAG_MESSAGES.outsideDskpHasUnit)
  } else if (tag.formOrigin === 'T4' || tag.formOrigin === 'T5') {
    let unitOk = false
    if (tag.unitId === null) add('unit', TAG_MESSAGES.noUnit)
    else {
      const u = lookup.unit(tag.unitId)
      if (!u || u.subject !== tag.subject || u.tingkatan !== tag.formOrigin)
        add('unit', TAG_MESSAGES.unitNotInCatalogue)
      else unitOk = true
    }
    if (tag.spIds.length === 0) add('sp', TAG_MESSAGES.noSp)
    else if (unitOk) {
      const unitId = tag.unitId
      const bad = tag.spIds.some((id) => {
        const sp = lookup.sp(id)
        return !sp || !sp.selectable || sp.unitId !== unitId
      })
      if (bad) add('sp', TAG_MESSAGES.spNotInUnit)
    }
    if (MAX_SP_PER_QUESTION !== null && tag.spIds.length > MAX_SP_PER_QUESTION)
      add('sp', TAG_MESSAGES.tooManySp(MAX_SP_PER_QUESTION))
  }

  // TP is required for every tingkatan, T1-T3 included (FB-072). A stale `0` or a fraction from a
  // number input is "out of range", an empty value is "not chosen".
  const tp: unknown = tag.tp
  if (tp === null || tp === undefined) add('tp', TAG_MESSAGES.noTp)
  else if (typeof tp !== 'number' || !Number.isInteger(tp) || tp < 1 || tp > 6)
    add('tp', TAG_MESSAGES.tpOutOfRange)

  // KBAT is optional: empty or one of the four levels.
  const kbat: unknown = tag.kbat
  if (kbat !== null && kbat !== undefined && !(KBAT_LEVELS as readonly unknown[]).includes(kbat))
    add('kbat', TAG_MESSAGES.kbatInvalid)

  return out
}

/**
 * Bulk callers (AC-07.6): the questions that fail are reported and skipped, the rest proceed. The
 * prototype has no bulk action yet; this is the shared entry for the first one.
 */
export function partitionByTagRule<T extends { tag: CurriculumTag }>(
  items: readonly T[],
  lookup: TagLookup,
): { pass: T[]; skipped: { item: T; issues: TagIssue[] }[] } {
  const pass: T[] = []
  const skipped: { item: T; issues: TagIssue[] }[] = []
  for (const item of items) {
    const issues = tagIssues(item.tag, lookup)
    if (issues.length === 0) pass.push(item)
    else skipped.push({ item, issues })
  }
  return { pass, skipped }
}
