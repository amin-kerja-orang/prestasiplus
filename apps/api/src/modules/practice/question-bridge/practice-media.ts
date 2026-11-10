/**
 * T-C13 (S5-T03 Part B, D105, D90): the pictures and stimuli a drill question is shown with. PURE: no database, no clock.
 *
 * A drill question carries (a) the stimuli of its stimulus GROUP, (b) the stimuli linked straight to it (a stem figure, a leaf figure)
 * and (c) the pictures of its options. The content is read by the SAME resolver the Simulasi Kuiz uses (`resolveStimuli`: all seven kinds,
 * caption, source, table grid, D90 shared-stimulus rule), so a drill and a quiz can never disagree about what is showable. A question
 * with a stimulus or option picture that cannot be shown (no file token, empty body, shared but not grouped) is NOT served: `null`.
 */
import type { PracticeQuizStimulus } from '@pp/contract'

import { type OwnStimulus, optionImageIds, resolveStimuli, stimuliWithTokens } from '../../bijak/kuiz/kuiz.mapper'
import { fileUrlOf } from '../../bijak/question-bridge/be09-mapping'
import type { QuestionRecord, StimulusGroupRecord } from '../../questions/types'

export interface PracticeMedia {
  stimuli: PracticeQuizStimulus[]
  /** Option picture URL by internal file id (every option picture of the question has one). */
  optionUrls: ReadonlyMap<string, string>
}

/** The internal file ids a question needs a public token for: group and own stimulus pictures, option pictures. */
export function mediaFileIds(record: QuestionRecord, group: StimulusGroupRecord | null, own: ReadonlyMap<string, OwnStimulus>): string[] {
  const out = new Set<string>(optionImageIds(record))
  for (const s of group?.stimuli ?? []) if (s.assetFileId) out.add(s.assetFileId)
  for (const s of own.values()) if (s.assetFileId) out.add(s.assetFileId)
  return [...out]
}

/** The media of a question, or null when something it must show cannot be shown (the question is then not served). */
export function practiceMediaOf(
  record: QuestionRecord,
  group: StimulusGroupRecord | null,
  own: ReadonlyMap<string, OwnStimulus>,
  tokens: ReadonlyMap<string, string>,
): PracticeMedia | null {
  const resolved = resolveStimuli(record, group, own)
  if (!resolved.complete) return null
  const withTokens = stimuliWithTokens(resolved, tokens)
  const scope = record.groupId ?? record.id
  const stimuli: PracticeQuizStimulus[] = []
  for (const [i, e] of resolved.entries.entries()) {
    const s = withTokens[i]
    if (s === undefined) return null
    // A stored picture without a public token cannot be loaded: refuse the question, never show a broken frame.
    if (e.file !== null && s.imageToken === null) return null
    const label = s.label ?? ''
    stimuli.push({
      id: `${scope}-${String(i + 1)}`,
      kind: s.kind,
      label,
      ...(s.caption ? { caption: s.caption } : {}),
      alt: s.alt ?? (label || s.caption || 'Gambar untuk soalan ini'),
      ...(s.body ? { text: s.body } : {}),
      ...(s.source ? { source: s.source } : {}),
      ...(s.table ? { table: { head: s.table.head, rows: s.table.rows } } : {}),
      ...(s.imageToken ? { image: { url: fileUrlOf(s.imageToken) } } : {}),
    })
  }
  const optionUrls = new Map<string, string>()
  for (const f of optionImageIds(record)) {
    const token = tokens.get(f)
    if (token === undefined) return null
    optionUrls.set(f, fileUrlOf(token))
  }
  return { stimuli, optionUrls }
}
