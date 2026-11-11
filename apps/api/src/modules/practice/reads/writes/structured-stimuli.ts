/**
 * KP-15 for the structured answer page: the rajah of a set, where a stimulus that cannot be shown is replaced by the "Gambar tiada" placeholder IN ITS
 * OWN PLACE and every other stimulus (passage, table, a picture that has its token) stays. PURE: no database, no clock.
 *
 * The drills and the quiz refuse the whole question (`practiceMediaOf` is null) and are not changed. Order is as the shared reader has it: the stimuli of the
 * group first, then those linked to the set itself. A stimulus is unshowable when its kind is unknown, it has nothing to show, it is shared by several
 * questions without being a group (D90), it is missing from the read, or its picture has no public token.
 */
import type { PracticeQuizStimulus } from '@pp/contract'

import { type OwnStimulus, linkedStimulusIds, toKuizStimulus } from '../../../bijak/kuiz/kuiz.mapper'
import { fileUrlOf } from '../../../bijak/question-bridge/be09-mapping'
import type { QuestionRecord, StimulusGroupRecord } from '../../../questions/types'
import { placeholderStimulus } from '../../question-bridge/practice-media'

export function structuredStimuliOf(
  record: QuestionRecord,
  group: StimulusGroupRecord | null,
  own: ReadonlyMap<string, OwnStimulus>,
  tokens: ReadonlyMap<string, string>,
): PracticeQuizStimulus[] {
  const scope = record.groupId ?? record.id
  const out: PracticeQuizStimulus[] = []
  const files = new Set<string>()
  const inGroup = new Set<string>()
  const place = (): void => {
    // One placeholder per missing stimulus: the id carries the position so that two of them never share a key.
    out.push({ ...placeholderStimulus(record.id), id: `${record.id}-gambar-tiada-${String(out.length + 1)}` })
  }
  const show = (s: NonNullable<ReturnType<typeof toKuizStimulus>>, file: string | null): void => {
    const token = file === null ? null : (tokens.get(file) ?? null)
    // A stored picture without a public token cannot be loaded: the placeholder, never a broken frame.
    if (file !== null && token === null) return place()
    const label = s.label ?? ''
    out.push({
      id: `${scope}-${String(out.length + 1)}`,
      kind: s.kind,
      label,
      ...(s.caption ? { caption: s.caption } : {}),
      alt: s.alt ?? (label || s.caption || 'Gambar untuk soalan ini'),
      ...(s.body ? { text: s.body } : {}),
      ...(s.source ? { source: s.source } : {}),
      ...(s.table ? { table: { head: s.table.head, rows: s.table.rows } } : {}),
      ...(token ? { image: { url: fileUrlOf(token) } } : {}),
    })
  }
  for (const g of group?.stimuli ?? []) {
    inGroup.add(g.id)
    const w = toKuizStimulus(g)
    if (!w) {
      place()
      continue
    }
    if (g.assetFileId) files.add(g.assetFileId)
    show(w, g.assetFileId)
  }
  for (const id of linkedStimulusIds(record)) {
    if (inGroup.has(id)) continue
    const a = own.get(id)
    const w = a && a.sharedBy <= 1 ? toKuizStimulus(a) : null
    if (!a || !w) {
      place()
      continue
    }
    // The same picture twice is shown once, but only when the duplicate has no label of its own (as the shared reader does).
    if (a.assetFileId) {
      if (files.has(a.assetFileId) && !w.label) continue
      files.add(a.assetFileId)
    }
    show(w, a.assetFileId)
  }
  return out
}
