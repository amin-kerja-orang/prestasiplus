/**
 * Structured Terbit blockers (R1-T34 follow-up). ONE place decides `overridable` (the contract map `BIJAK_BUILDER_BLOCKER_OVERRIDABLE`), so the
 * review and the publish refusal can never disagree. The plain BM string arrays stay as they were; they are the `message` of each blocker.
 */
import { BIJAK_BUILDER_BLOCKER_OVERRIDABLE, type BijakBuilderBlocker, type BijakBuilderBlockerCode } from '@pp/contract'

/** A blocker before the rule is applied. */
export interface BlockerDraft {
  code: BijakBuilderBlockerCode
  message: string
  section?: string
  questionId?: string
}

/** Applies the rule and drops repeated lines (the first occurrence wins, so a hard code beats an overridable one with the same line). */
export function toBlockers(drafts: readonly BlockerDraft[]): BijakBuilderBlocker[] {
  const byMessage = new Map<string, BijakBuilderBlocker>()
  for (const d of drafts) {
    if (byMessage.has(d.message)) continue
    byMessage.set(d.message, {
      code: d.code,
      message: d.message,
      overridable: BIJAK_BUILDER_BLOCKER_OVERRIDABLE[d.code],
      ...(d.section === undefined ? {} : { section: d.section }),
      ...(d.questionId === undefined ? {} : { questionId: d.questionId }),
    })
  }
  return [...byMessage.values()]
}

/** True when nothing hard stands in the way and at least one blocker is overridable. */
export const canOverrideBlockers = (blockers: readonly BijakBuilderBlocker[]): boolean => blockers.length > 0 && blockers.every((b) => b.overridable)

/** The wire fields shared by the review and the publish refusal. */
export function blockerView(blockers: readonly BijakBuilderBlocker[]): { blockerDetails: BijakBuilderBlocker[]; canOverride: boolean } {
  return { blockerDetails: [...blockers], canOverride: canOverrideBlockers(blockers) }
}
