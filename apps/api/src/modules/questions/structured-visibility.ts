/**
 * Which structured questions a pupil can open (BR-M04-03): the LIVE version is approved, the question is active, its type is
 * `structured` and its level is one of `STRUCTURED_LEVEL_CODES`. One predicate for the structured practice (`getVisible`) and the
 * report guard (REQ-B-049), so a question a pupil cannot open can not be reported either.
 */
export const STRUCTURED_LEVEL_CODES: readonly string[] = ['T4', 'T5']

export interface StructuredVisibilityFacts {
  isActive: boolean
  version: { status: string; type: string; educationLevelId: string | null }
}

/** `levelIds` holds the ids of the levels in `STRUCTURED_LEVEL_CODES` (a Set or the Map the practice keeps). */
export function isStructuredVisible(r: StructuredVisibilityFacts, levelIds: { has(id: string): boolean }): boolean {
  if (!r.isActive || r.version.status !== 'approved' || r.version.type !== 'structured') return false
  return r.version.educationLevelId !== null && levelIds.has(r.version.educationLevelId)
}
