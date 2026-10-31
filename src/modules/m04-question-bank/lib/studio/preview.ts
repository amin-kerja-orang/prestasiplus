/**
 * Pratonton (design S1.4, D90): the question as a pupil sees it, with the shared stimulus shown ONCE and every member of the
 * group under it. Maps the Studio group to the shared display library (`src/components/question-display`).
 */
import type { StudioGroup, StudioStimulus } from '@pp/contract'

import type { StimulusData } from '../../../../components/question-display'
import { imageSrc } from '../image-url'
import type { LeafDraft, StudioDraft } from './draft'

export function toStimulusData(s: StudioStimulus): StimulusData {
  return {
    id: s.id,
    kind: s.kind,
    ...(s.label ? { label: s.label } : {}),
    ...(s.body ? { text: s.body } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    ...(s.alt ? { alt: s.alt } : {}),
    ...(s.sourceCitation ? { source: s.sourceCitation } : {}),
    ...(s.imageId ? { src: imageSrc(s.imageId) } : {}),
    ...(s.table ? { table: { head: s.table.head, rows: s.table.rows } } : {}),
  }
}

export interface PreviewItem {
  id: string
  label: string
  stem: string
  /** True for the question being edited (its text is the draft, not the saved one). */
  current: boolean
  leaves: { label: string; prompt: string; options: { letter: string; text: string }[] }[]
}

const leafView = (l: LeafDraft) => ({
  label: l.label,
  prompt: l.prompt,
  options: l.mode === 'mcq' ? l.options.map((o) => ({ letter: o.label, text: o.text })) : [],
})

/**
 * The members in group order. The edited question appears at its place (or last, when it is not yet in the group) with its
 * unsaved text; the others show their saved stem.
 */
export function previewItems(group: StudioGroup | null, draft: StudioDraft, questionId: string | null): PreviewItem[] {
  const mine: PreviewItem = { id: questionId ?? 'baharu', label: '', stem: draft.stem, current: true, leaves: draft.leaves.map(leafView) }
  if (group === null) return [mine]
  const items: PreviewItem[] = group.members.map((m) => ({ id: m.id, label: m.numberLabel ?? '', stem: m.stem, current: m.id === questionId, leaves: [] }))
  const at = items.findIndex((i) => i.current)
  if (at >= 0) items[at] = { ...mine, label: items[at]?.label ?? '' }
  else items.push(mine)
  return items
}
