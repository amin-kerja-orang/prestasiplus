/**
 * The own-stimulus map of a set of questions for `resolveStimuli` (R1E2E-05b, H-C8). It is a thin layer over THE one reader of a
 * version's own stimuli, `outsideStimuliOf` (`question-bridge/outside-media.ts`: versionStimuli + stimulusUseCounts): the bridge,
 * the kuiz and the admin servability facts all start from it, so what is served and what the admin is told cannot disagree.
 * The only thing added here is a stimulus linked to a LEAF part only: it is not in the version links, so its picture comes from
 * the asset row (no text of its own).
 */
import type { QuestionsRepository } from '../../questions/questions.repository'
import type { QuestionRecord, StimulusGroupRecord } from '../../questions/types'
import type { OutsideStimulus } from '../question-bridge/be09-mapping'
import { type OutsideStimulusReads, outsideStimuliOf } from '../question-bridge/outside-media'
import { leavesOf, type OwnStimulus } from './kuiz.mapper'

export type LeafReads = Pick<QuestionsRepository, 'stimulusUseCounts' | 'stimulusAssets'>

/**
 * `outside` (from `outsideStimuliOf`) plus the pictures that are linked to a leaf of one of `records` and nowhere else. Reads
 * nothing when no leaf links a stimulus outside `outside` and the groups.
 */
export async function withLeafStimuli(
  reads: LeafReads,
  records: readonly QuestionRecord[],
  outside: ReadonlyMap<string, OutsideStimulus>,
  groups: ReadonlyMap<string, StimulusGroupRecord | null>,
): Promise<Map<string, OwnStimulus>> {
  // `sharedBy` is optional on the bridge type; here it is required. A producer that left it out is treated as shared by many
  // (fail closed: the question is not served) rather than as the question's own.
  const out = new Map<string, OwnStimulus>()
  for (const [id, s] of outside) out.set(id, { ...s, sharedBy: s.sharedBy ?? Number.POSITIVE_INFINITY })
  const leafOnly = new Set<string>()
  for (const r of records) {
    const inGroup = new Set((r.groupId ? (groups.get(r.groupId)?.stimuli ?? []) : []).map((s) => s.id))
    for (const l of leavesOf(r.id, r.version.parts)) {
      const id = l.leaf.stimulusId
      if (id && !outside.has(id) && !inGroup.has(id) && !r.version.stimulusIds.includes(id)) leafOnly.add(id)
    }
  }
  if (leafOnly.size === 0) return out
  const [uses, rows] = await Promise.all([reads.stimulusUseCounts([...leafOnly]), reads.stimulusAssets([...leafOnly])])
  for (const a of rows) {
    // Leaf path: absent from `uses` means no other question links it (the count query is keyed by stimulus), so 1 = its own; the outside path above fails closed because a missing count there means an unknown producer.
    if (a.assetFileId) out.set(a.id, { kind: a.kind, assetFileId: a.assetFileId, sharedBy: uses.get(a.id) ?? 1 })
  }
  return out
}

/**
 * The kuiz's map: the bridge reader, then the leaf-only pictures. Servability does not call this; it calls `outsideStimuliOf`
 * itself (it also needs `outside` on its own for the bridge facts) and then `withLeafStimuli` on that result.
 */
export async function ownStimuliOf(
  reads: OutsideStimulusReads & LeafReads,
  records: readonly QuestionRecord[],
  groups: ReadonlyMap<string, StimulusGroupRecord | null>,
): Promise<Map<string, OwnStimulus>> {
  const { outside } = await outsideStimuliOf(reads, records, groups)
  return withLeafStimuli(reads, records, outside, groups)
}
