/**
 * Adapters from the served Bijak shapes (`StimulusDef`, `McqOption`) to the shared display library
 * (`@/components/question-display`, P5). Display only: no store, no fetch.
 */
import { qdCopy } from '../copy'
import type { McqOptionData, StimulusData } from '../types'

import type { GroupView, McqOption, StimulusDef } from '@/modules/m28-bijak-spm/domain/types'

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

/** Stimuli of an editor group (0 to 3): `stimuli`, else the lone `stimulus`, else none. */
export const editorStimuliOf = (g: { stimulus?: StimulusDef; stimuli?: StimulusDef[] }): StimulusDef[] =>
  g.stimuli && g.stimuli.length > 0 ? g.stimuli : g.stimulus ? [g.stimulus] : []

/** Label of an editor group: the stimulus labels joined, '' when it has none (the unit is still shown). */
export const editorGroupLabel = (g: { stimulus?: StimulusDef; stimuli?: StimulusDef[] }): string =>
  editorStimuliOf(g)
    .map((s) => s.label)
    .filter((l) => l.trim() !== '')
    .join(' dan ')

/** "Rajah 1" or "Rajah 1 dan Petikan A" (chip text and sheet title of a multi-stimulus group). */
export function groupLabel(stimuli: readonly StimulusDef[]): string {
  const labels = stimuli.map((s) => s.label).filter((l) => l !== '')
  return labels.length > 0 ? labels.join(' dan ') : 'Rajah'
}

/** Same rule as `groupLabel`, for the display type: "Rajah 1 dan Petikan A" ('Petikan' / 'Rajah' when unlabelled). */
export function stimuliLabel(stimuli: readonly StimulusData[]): string {
  const labels = stimuli.map((s) => s.label ?? '').filter((l) => l.trim() !== '')
  if (labels.length > 0) return labels.join(' dan ')
  return stimuli[0]?.kind === 'passage' ? qdCopy.passageFallback : 'Rajah'
}

const hasRows = (s: StimulusData): boolean => !!s.table && s.table.rows.length > 0

/**
 * Whether the display can draw a stimulus (R1-04, 46 section 2.4): a passage needs text; a table needs rows
 * or a picture; image, diagram, map, infographic and graph need a picture or a table with rows.
 */
export function canRender(s: StimulusData): boolean {
  // DOC DEFECT (#510): no PRD wording exists for a passage without text, so it is not excluded (today's behaviour).
  if (s.kind === 'passage') return true
  return !!s.src || hasRows(s)
}

/** Reason line text (without the "Tidak dihidangkan kerana" lead) for a stimulus that cannot render, else ''. */
export function unrenderableReason(s: StimulusData): string {
  if (canRender(s)) return ''
  return qdCopy.reasonNoPicture
}
