/**
 * Blockers of the review and of a publish refusal, as the contract sends them (`BijakBuilderBlocker`,
 * R1-T34): `blockerDetails: { code, message, overridable, section?, questionId? }[]` and `canOverride`
 * (no hard blocker and at least one overridable one). The UI reads the server's flags; it never
 * derives overridability from the text.
 */
import type { BijakBuilderBlocker } from '@pp/contract'

export type RawBlocker = BijakBuilderBlocker

export interface BlockerInfo {
  message: string
  overridable: boolean
}

export function normalizeBlockers(raw: readonly BijakBuilderBlocker[]): BlockerInfo[] {
  return raw.map((b) => ({ message: b.message, overridable: b.overridable }))
}

/** The structured blockers of a review answer (`blockerDetails`). */
export function blockersOf(r: { blockerDetails: readonly BijakBuilderBlocker[] }): BlockerInfo[] {
  return normalizeBlockers(r.blockerDetails)
}

/** Whether the "Terbitkan walaupun tidak memenuhi kontrak" tick is offered: the server's `canOverride`, with something to override. */
export function overrideOffered(blockers: readonly BlockerInfo[], canOverride: boolean | undefined): boolean {
  return blockers.length > 0 && canOverride === true
}
