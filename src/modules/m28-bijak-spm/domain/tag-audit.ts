/**
 * Tag audit (v2-dskp-integration 2.7, AC-10.x): the `TagChange[]` that goes into a history entry.
 * Pure and types-only, like the rest of the tag domain. The person is the entry's own `by`.
 *
 * A field is recorded when its final value differs from the value before (an untagged question
 * counts as empty), or when the AI suggested a value that the person did not keep. A first tagging
 * has no `before`; a field the AI never mentioned has no `ai` (AC-10.2).
 */
import type { Confidence, TagChange, TagSuggestion } from './admin-types'
import type { CurriculumTag } from './types'

type Field = TagChange['field']

/** The value of each audited field of a tag; unit and SP are catalogue ids, resolved to codes at render. */
function valueOf(tag: CurriculumTag, field: Field): unknown {
  switch (field) {
    case 'formOrigin':
      return tag.formOrigin
    case 'unit':
      return tag.unitId
    case 'sp':
      return [...tag.spIds]
    case 'tp':
      return tag.tp
    case 'kbat':
      return tag.kbat
  }
}

/** What the AI suggested for a field; `undefined` when it said nothing about it. */
function suggestedOf(s: TagSuggestion | undefined, field: Field): unknown {
  if (!s) return undefined
  switch (field) {
    case 'formOrigin':
      return s.formOrigin
    case 'unit':
      return s.unitId
    case 'sp':
      return s.spIds ? [...s.spIds] : undefined
    case 'tp':
      return s.tp
    case 'kbat':
      return s.kbat
  }
}

const FIELDS: readonly { field: Field; confidence?: 'unit' | 'sp' | 'tp' | 'kbat' }[] = [
  { field: 'formOrigin' },
  { field: 'unit', confidence: 'unit' },
  { field: 'sp', confidence: 'sp' },
  { field: 'tp', confidence: 'tp' },
  { field: 'kbat', confidence: 'kbat' },
]

/**
 * An unset scalar and "no tag yet" are the same empty value. Lists (SP) compare as sorted copies:
 * choosing the same SP in another order is not a change of the tag.
 */
const key = (v: unknown): string =>
  JSON.stringify(Array.isArray(v) ? ([...v] as unknown[]).sort() : (v ?? null))

/**
 * The audit lines for a tag that goes from `before` (undefined = first tagging) to `after`, with the
 * AI `suggestion` that was on the question, if any.
 */
export function tagChanges(
  before: CurriculumTag | undefined,
  after: CurriculumTag,
  suggestion?: TagSuggestion,
): TagChange[] {
  const out: TagChange[] = []
  for (const { field, confidence } of FIELDS) {
    const final = valueOf(after, field)
    const was = before ? valueOf(before, field) : field === 'sp' ? [] : null
    const ai = suggestedOf(suggestion, field)
    const changed = key(was) !== key(final)
    const rejected = ai !== undefined && key(ai) !== key(final)
    if (!changed && !rejected) continue
    const conf: Confidence | undefined =
      ai !== undefined && confidence ? suggestion?.confidence[confidence] : undefined
    out.push({
      field,
      ...(before ? { before: was } : {}),
      after: final,
      ...(ai !== undefined ? { ai } : {}),
      ...(conf ? { confidence: conf } : {}),
    })
  }
  return out
}
