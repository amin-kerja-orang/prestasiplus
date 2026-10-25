/**
 * The curriculum filter predicate shared by the question bank and the review queue
 * (v2-dskp-integration 5.4). Pure: it reads one stored `CurriculumTag` and never the catalogue, so
 * it works when the catalogue cannot be loaded. "Perlu semakan tag" is not part of it (the bank
 * applies it to its own rows; the queue has no such filter).
 */
import type { TagFilter } from './admin-types'
import type { CurriculumTag, DskpSpId } from './types'

/** Whether `tag` passes every curriculum filter that is set; an empty filter matches everything. */
export function tagMatchesFilter(tag: CurriculumTag, f: TagFilter): boolean {
  return (
    (!f.formOrigin || tag.formOrigin === f.formOrigin) &&
    (!f.unitId || tag.unitId === f.unitId) &&
    (!f.spId || tag.spIds.includes(f.spId as DskpSpId)) &&
    (f.tp === undefined || tag.tp === f.tp) &&
    (!f.kbat ||
      (f.kbat === 'ya'
        ? tag.kbat != null
        : f.kbat === 'tidak'
          ? tag.kbat == null
          : tag.kbat === f.kbat))
  )
}
