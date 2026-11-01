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
  const out = new Map<string, OwnStimulus>(outside)
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
    if (a.assetFileId) out.set(a.id, { kind: a.kind, assetFileId: a.assetFileId, sharedBy: uses.get(a.id) ?? 1 })
  }
  return out
}

/** The whole map in one call: the bridge reader, then the leaf-only pictures. */
export async function ownStimuliOf(
  reads: OutsideStimulusReads & LeafReads,
  records: readonly QuestionRecord[],
  groups: ReadonlyMap<string, StimulusGroupRecord | null>,
): Promise<Map<string, OwnStimulus>> {
  const { outside } = await outsideStimuliOf(reads, records, groups)
  return withLeafStimuli(reads, records, outside, groups)
}
