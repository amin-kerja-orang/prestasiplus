/**
 * T-C13 (D105, D90): the drill wire stimulus (`PracticeQuizStimulus`) to the display type of the one stimulus component
 * (`@/components/question-display`, the same one the Bijak sitting uses). Display only: no store, no fetch.
 */
import type { StimulusData } from '../../lib/question-display'

import type { QuizStimulus } from '../../api/types'

export function toStimulusData(s: QuizStimulus): StimulusData {
  return {
    id: s.id,
    kind: s.kind,
    ...(s.label ? { label: s.label } : {}),
    ...(s.title ? { title: s.title } : {}),
    ...(s.text ? { text: s.text } : {}),
    ...(s.source ? { source: s.source } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    alt: s.alt,
    ...(s.image ? { src: s.image.url } : {}),
    ...(s.table ? { table: { head: s.table.head, rows: s.table.rows } } : {}),
  }
}

export const toStimuliData = (list: readonly QuizStimulus[] | undefined): StimulusData[] => (list ?? []).map(toStimulusData)
