import type { QuestionRecord, StimulusGroupRecord } from '../../questions/types'
import type { OutsideStimulus } from './be09-mapping'

/** The two BE-09 reads that give a version's own stimuli (`QuestionsRepository` implements both). */
export interface OutsideStimulusReads {
  versionStimuli(refs: readonly { questionId: string; versionNo: number }[]): Promise<
    Map<
      string,
      {
        id: string
        kind: string
        assetFileId: string | null
        label: string
        bodyMs: string | null
        alt: string | null
        caption?: string | null
        tableData?: unknown
        sourceCitation?: string | null
      }[]
    >
  >
  stimulusUseCounts(ids: readonly string[]): Promise<Map<string, number>>
}

/**
 * THE one reader of "the stimuli linked to a version but not to its group" for the Bijak bridge (R1E2E-05b): the attempt source
 * and the admin servability read both call it, so what the admin is told is what the bridge sees. Returns the stimuli (id ->
 * content, link order within a question, `sharedBy` = questions linking it, D90) and the files whose public tokens the mapper
 * needs. A stimulus that is not returned (unknown, audio) makes the mapper refuse the question.
 */
export async function outsideStimuliOf(
  reads: OutsideStimulusReads,
  records: readonly QuestionRecord[],
  groups: ReadonlyMap<string, StimulusGroupRecord | null>,
): Promise<{ outside: Map<string, OutsideStimulus>; fileIds: Set<string> }> {
  const outsideIds = new Set<string>()
  for (const r of records) {
    const ids = (r.groupId ? (groups.get(r.groupId)?.stimuli ?? []) : []).map((x) => x.id)
    for (const id of r.version.stimulusIds) if (!ids.includes(id)) outsideIds.add(id)
  }
  const outside = new Map<string, OutsideStimulus>()
  const fileIds = new Set<string>()
  if (outsideIds.size === 0) return { outside, fileIds }
  // The question's own stimuli (linked straight to its version, not in its group): full content in link order, how many
  // questions link each (D90: shared means group), and the files whose tokens the pupil's URLs need.
  const [linked, uses] = await Promise.all([
    reads.versionStimuli(records.map((r) => ({ questionId: r.id, versionNo: r.version.versionNo }))),
    reads.stimulusUseCounts([...outsideIds]),
  ])
  for (const list of linked.values()) {
    for (const st of list) {
      if (!outsideIds.has(st.id) || outside.has(st.id)) continue
      outside.set(st.id, {
        kind: st.kind,
        assetFileId: st.assetFileId,
        label: st.label,
        bodyMs: st.bodyMs,
        alt: st.alt,
        caption: st.caption ?? null,
        tableData: st.tableData ?? null,
        sourceCitation: st.sourceCitation ?? null,
        sharedBy: uses.get(st.id) ?? 1,
      })
      if (st.assetFileId) fileIds.add(st.assetFileId)
    }
  }
  return { outside, fileIds }
}
