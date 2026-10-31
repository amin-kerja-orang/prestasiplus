/**
 * Blockers of the review in both server shapes: `blockers` as `string[]` (the BM lines Terbit refuses)
 * and, from A3 (REQ-C-002), `blockerDetails: { code, message, overridable, section?, questionId? }[]`
 * with `canOverride`. The override offer reads the flags when present and falls back to the text heuristic
 * ("Soalan {id} tidak layak: ..." lines, the structural blueprint lines) only for plain strings.
 */
export interface RawBlocker {
  code?: string
  message: string
  overridable?: boolean
  section?: string
  questionId?: string
}

export interface BlockerInfo {
  message: string
  /** `undefined` when the server did not say (old string shape). */
  overridable: boolean | undefined
}

export const isBlueprintLine = (message: string): boolean => /tidak layak/i.test(message)

export function normalizeBlockers(raw: readonly (string | RawBlocker)[]): BlockerInfo[] {
  return raw.map((b) =>
    typeof b === 'string'
      ? { message: b, overridable: undefined }
      : { message: b.message, overridable: b.overridable },
  )
}

/**
 * The blockers of a review answer: `blockerDetails` (A3, REQ-C-002: code, message, overridable) when
 * present, else the plain `blockers` lines (no flags, so the text heuristic applies).
 */
export function blockersOf(r: { blockers: readonly string[]; blockerDetails?: readonly RawBlocker[] }): BlockerInfo[] {
  return r.blockerDetails ? normalizeBlockers(r.blockerDetails) : normalizeBlockers(r.blockers)
}

/** Whether the "Terbitkan walaupun tidak memenuhi kontrak" tick is offered. */
export function overrideOffered(blockers: readonly BlockerInfo[], canOverride?: boolean): boolean {
  if (!blockers.length) return false
  if (canOverride !== undefined) return canOverride
  if (blockers.every((b) => b.overridable !== undefined)) return blockers.every((b) => b.overridable === true)
  return blockers.every((b) => b.overridable ?? isBlueprintLine(b.message))
}
