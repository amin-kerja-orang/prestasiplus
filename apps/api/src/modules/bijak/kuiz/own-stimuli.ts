/**
 * The own-stimulus map of a set of questions, for `resolveStimuli` (R1E2E-05b, H-C8). ONE reader, used by the kuiz service
 * (what is served) and by the servability facts (what the admin is told is served), so the two cannot disagree.
 */
import type { QuestionsRepository } from '../../questions/questions.repository'
import type { QuestionRecord } from '../../questions/types'
import { leavesOf, type OwnStimulus } from './kuiz.mapper'

type Reader = Pick<QuestionsRepository, 'versionStimuli' | 'stimulusUseCounts' | 'stimulusAssets'>

/**
 * Every stimulus linked to the versions of `records` (version links and leaf links) with its full content in link order and how
 * many questions link it (D90: more than one means it must be a stimulus group). A stimulus linked only to a leaf is not in the
 * version links: its picture is read from the asset row (no text of its own).
 */
export async function ownStimuliOf(questions: Reader, records: readonly QuestionRecord[]): Promise<Map<string, OwnStimulus>> {
  const linked = new Set<string>()
  for (const r of records) {
    for (const id of r.version.stimulusIds) linked.add(id)
    for (const l of leavesOf(r.id, r.version.parts)) if (l.leaf.stimulusId) linked.add(l.leaf.stimulusId)
  }
  const [versioned, uses, assetRows] = await Promise.all([
    questions.versionStimuli(records.map((r) => ({ questionId: r.id, versionNo: r.version.versionNo }))),
    questions.stimulusUseCounts([...linked]),
    questions.stimulusAssets([...linked]),
  ])
  const out = new Map<string, OwnStimulus>()
  for (const a of assetRows) {
    if (a.assetFileId) out.set(a.id, { kind: a.kind, label: '', bodyMs: null, alt: null, caption: null, sourceCitation: null, tableData: null, assetFileId: a.assetFileId, sharedBy: uses.get(a.id) ?? 1 })
  }
  for (const list of versioned.values()) {
    for (const st of list) {
      out.set(st.id, {
        kind: st.kind,
        label: st.label,
        bodyMs: st.bodyMs,
        alt: st.alt,
        caption: st.caption ?? null,
        sourceCitation: st.sourceCitation ?? null,
        tableData: st.tableData ?? null,
        assetFileId: st.assetFileId,
        sharedBy: uses.get(st.id) ?? 1,
      })
    }
  }
  return out
}
