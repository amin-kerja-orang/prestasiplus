/**
 * Adapters from the served Bijak shapes (`StimulusDef`, `McqOption`) to the shared display library
 * (`@/components/question-display`, P5). Display only: no store, no fetch.
 */
import type { McqOptionData, StimulusData } from '../../../components/question-display'

import type { GroupView, McqOption, StimulusDef } from '../domain/types'

export function toStimulusData(s: StimulusDef): StimulusData {
  return {
    id: s.id,
    kind: s.kind,
    ...(s.label ? { label: s.label } : {}),
    ...(s.title ? { title: s.title } : {}),
    ...(s.text ? { text: s.text } : {}),
    ...(s.source ? { source: s.source } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    alt: s.alt,
    ...(s.image ? { src: s.image.url, width: s.image.width, height: s.image.height } : {}),
    ...(s.svg ? { svg: s.svg } : {}),
    ...(s.table ? { table: { head: s.table.head, rows: s.table.rows } } : {}),
  }
}

export function toOptionData(o: McqOption, index: number): McqOptionData {
  return {
    id: o.id,
    letter: String.fromCharCode(65 + index),
    text: o.text,
    ...(o.image
      ? {
          imageSrc: o.image.url,
          imageAlt: o.image.alt ?? o.text,
          imageWidth: o.image.width,
          imageHeight: o.image.height,
        }
      : {}),
  }
}

/** Every stimulus of a group in order; an older server sends only `stimulus`. */
export const stimuliOf = (g: Pick<GroupView, 'stimulus' | 'stimuli'>): StimulusDef[] =>
  g.stimuli && g.stimuli.length > 0 ? g.stimuli : [g.stimulus]

/** "Rajah 1" or "Rajah 1 dan Petikan A" (chip text and sheet title of a multi-stimulus group). */
export function groupLabel(stimuli: readonly StimulusDef[]): string {
  const labels = stimuli.map((s) => s.label).filter((l) => l !== '')
  return labels.length > 0 ? labels.join(' dan ') : 'Rajah'
}
