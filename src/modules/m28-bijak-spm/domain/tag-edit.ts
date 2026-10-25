/**
 * Pure helpers the Tag DSKP editor and the server use to change a `CurriculumTag` (v2-dskp-integration
 * 5.1). They never mutate their input and never decide validity: the one rule is `tagIssues`
 * (`tag-rule.ts`). Like the rule, this file imports types only, so it can move to exam-core.
 */
import { MAX_SP_PER_QUESTION, tagIssues } from './tag-rule'
import type { TagLookup } from './tag-rule'
import type { CurriculumTag, DskpSpId, DskpUnitId, FormOrigin, SubjectCode } from './types'

/** A new, untagged tag: nothing chosen and no default (AC-04.1). */
export function emptyTag(subject: SubjectCode): CurriculumTag {
  return {
    subject,
    formOrigin: null,
    unitId: null,
    spIds: [],
    tp: null,
    kbat: null,
    catalogueVersion: null,
  }
}

/** Whether changing the tingkatan to `origin` would clear a chosen unit or SP (for the notice). */
export function willClearOnFormOrigin(tag: CurriculumTag, origin: FormOrigin | null): boolean {
  return origin !== tag.formOrigin && (tag.unitId !== null || tag.spIds.length > 0)
}

/**
 * Change the tingkatan. A different tingkatan clears unit and SP, because a unit belongs to one
 * tingkatan (AC-04.5); TP and KBAT are kept.
 */
export function setFormOrigin(tag: CurriculumTag, origin: FormOrigin | null): CurriculumTag {
  if (origin === tag.formOrigin) return tag
  return { ...tag, formOrigin: origin, unitId: null, spIds: [], catalogueVersion: null }
}

/** Choose a unit. SP that do not belong to the new unit are dropped (AC-04.4). */
export function setUnit(
  tag: CurriculumTag,
  unitId: DskpUnitId | null,
  lookup: Pick<TagLookup, 'sp'>,
): CurriculumTag {
  if (unitId === tag.unitId) return tag
  const spIds =
    unitId === null ? [] : tag.spIds.filter((id) => lookup.sp(id)?.unitId === unitId)
  return { ...tag, unitId, spIds, catalogueVersion: null }
}

/**
 * Add or remove one SP (`on` forces the direction; without it the SP is toggled). Adding is refused
 * silently once `MAX_SP_PER_QUESTION` is reached; with no cap (Q-D6) it never is.
 */
export function toggleSp(tag: CurriculumTag, spId: DskpSpId, on?: boolean): CurriculumTag {
  const has = tag.spIds.includes(spId)
  const want = on ?? !has
  if (want === has) return tag
  if (!want) return { ...tag, spIds: tag.spIds.filter((id) => id !== spId), catalogueVersion: null }
  if (MAX_SP_PER_QUESTION !== null && tag.spIds.length >= MAX_SP_PER_QUESTION) return tag
  return { ...tag, spIds: [...tag.spIds, spId], catalogueVersion: null }
}

/**
 * Bring a tag into a consistent shape after an edit:
 * - T1-T3 (outside DSKP) carries no unit and no SP;
 * - SP outside the chosen unit (or with no unit) and repeated SP are dropped;
 * - `catalogueVersion` is stamped when a unit is chosen and null otherwise;
 * - the `perlu-semakan` marker is cleared once the tag passes the rule.
 * `lookup` must already know the tag's subject (the caller has loaded it); an unknown SP is treated
 * as outside the unit.
 */
export function normaliseTag(
  tag: CurriculumTag,
  lookup: TagLookup,
  catalogueVersion: string,
): CurriculumTag {
  const outside = tag.formOrigin === 'T1-T3'
  const unitId = outside ? null : tag.unitId
  const spIds: DskpSpId[] = []
  if (unitId !== null)
    for (const id of tag.spIds)
      if (!spIds.includes(id) && lookup.sp(id)?.unitId === unitId) spIds.push(id)
  const hasNode = unitId !== null || spIds.length > 0
  const next: CurriculumTag = {
    ...tag,
    unitId,
    spIds,
    catalogueVersion: hasNode ? (tag.catalogueVersion ?? catalogueVersion) : null,
  }
  if (next.review !== undefined && tagIssues(next, lookup).length === 0) delete next.review
  return next
}
