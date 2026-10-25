/**
 * Pure rules for the AI tag suggestion on an intake question (v2-dskp-integration 2.7 and 5.3). The
 * extractor (`ai/mock-extractor.ts`) uses `suggestionLowFields` to fill `lowFields`; the gate and the
 * editor use `tagFieldResolved` / `pendingTagFields` to decide what still waits for a person. Types
 * only, no catalogue access.
 */
import type { TagSuggestion } from '../../../domain/admin-types'
import type { CurriculumTag } from '../../../domain/types'
import type { IntakeQuestion } from '../types'

export type TagField = 'unit' | 'sp' | 'tp' | 'kbat'

/** The `lowFields` / `confirmed` path of a tag field. */
export const tagFieldPath = (f: TagField): string => `tag.${f}`

/**
 * Tag fields that need a person to confirm (AC-05.2, AC-05.3, AC-06.4):
 * - `tp` and `kbat` whenever the AI suggested a value, at any confidence;
 * - `unit` and `sp` when the suggestion carries confidence `rendah`;
 * - `unit` when the AI found no catalogue node (nothing was filled, AC-04.9).
 */
export function suggestionLowFields(s: TagSuggestion | undefined): string[] {
  const out: string[] = []
  if (!s || !s.unitId) out.push(tagFieldPath('unit'))
  else {
    if (s.confidence.unit === 'rendah') out.push(tagFieldPath('unit'))
    if ((s.spIds?.length ?? 0) > 0 && s.confidence.sp === 'rendah') out.push(tagFieldPath('sp'))
  }
  if (s?.tp != null) out.push(tagFieldPath('tp'))
  if (s?.kbat != null) out.push(tagFieldPath('kbat'))
  return out
}

function valueOf(tag: CurriculumTag, f: TagField): unknown {
  switch (f) {
    case 'unit':
      return tag.unitId
    case 'sp':
      return tag.spIds
    case 'tp':
      return tag.tp
    case 'kbat':
      return tag.kbat
  }
}

function suggestedOf(s: TagSuggestion | undefined, f: TagField): unknown {
  switch (f) {
    case 'unit':
      return s?.unitId ?? null
    case 'sp':
      return s?.spIds ?? []
    case 'tp':
      return s?.tp ?? null
    case 'kbat':
      return s?.kbat ?? null
  }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Whether the person has changed the field away from what the AI suggested (or filled an empty one). */
export function changedFromSuggestion(
  tag: CurriculumTag,
  s: TagSuggestion | undefined,
  f: TagField,
): boolean {
  return !same(valueOf(tag, f), suggestedOf(s, f))
}

/** Resolved = ticked, or changed away from the suggestion (QB "confirmed or edited"). */
export function tagFieldResolved(q: IntakeQuestion, f: TagField): boolean {
  return q.confirmed.includes(tagFieldPath(f)) || changedFromSuggestion(q.tag, q.tagSuggestion, f)
}

/** Tag fields of `q` that are in `lowFields` and not yet resolved. */
export function pendingTagFields(q: IntakeQuestion): TagField[] {
  return (['unit', 'sp', 'tp', 'kbat'] as const).filter(
    (f) => q.lowFields.includes(tagFieldPath(f)) && !tagFieldResolved(q, f),
  )
}
