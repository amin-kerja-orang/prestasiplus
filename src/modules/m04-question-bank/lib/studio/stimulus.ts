/**
 * The stimulus form of the Studio (V2 Langkah 2 "Rangsangan"): kinds and their BM labels, the form state, and how it maps to
 * the group endpoints. Kept equal to the contract's `STUDIO_STIMULUS_KINDS` by a test.
 */
import type { StudioStimulus, StudioStimulusInput } from '@pp/contract'

export const STIMULUS_KINDS = [
  { value: 'passage', label: 'Petikan' },
  { value: 'image', label: 'Gambar' },
  { value: 'diagram', label: 'Rajah' },
  { value: 'table', label: 'Jadual' },
  { value: 'map', label: 'Peta' },
  { value: 'infographic', label: 'Infografik' },
  { value: 'graph', label: 'Graf' },
] as const

export type StimulusKind = (typeof STIMULUS_KINDS)[number]['value']

export interface StimulusForm {
  kind: StimulusKind
  label: string
  caption: string
  alt: string
  body: string
  sourceCitation: string
  imageToken: string | null
}

export const STIMULUS_EMPTY = 'Rangsangan mesti ada teks, jadual atau gambar.'

export function blankStimulus(kind: StimulusKind = 'diagram'): StimulusForm {
  return { kind, label: '', caption: '', alt: '', body: '', sourceCitation: '', imageToken: null }
}

export function stimulusFormOf(s: StudioStimulus): StimulusForm {
  return {
    kind: s.kind,
    label: s.label ?? '',
    caption: s.caption ?? '',
    alt: s.alt ?? '',
    body: s.body ?? '',
    sourceCitation: s.sourceCitation ?? '',
    imageToken: s.imageId,
  }
}

/** A stimulus is saved when it has text or a picture (a table stored earlier is kept by the server). */
export const stimulusHasContent = (f: StimulusForm): boolean => f.body.trim() !== '' || f.imageToken !== null

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

export function toStimulusInput(f: StimulusForm): StudioStimulusInput {
  return {
    kind: f.kind,
    label: orNull(f.label),
    caption: orNull(f.caption),
    alt: orNull(f.alt),
    body: f.body.trim() === '' ? null : f.body,
    sourceCitation: orNull(f.sourceCitation),
    imageFileId: f.imageToken,
  }
}
