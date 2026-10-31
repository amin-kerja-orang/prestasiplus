/**
 * Whether a stimulus has anything to show. A group written without stimulus content (T07 placeholder
 * `{kind: 'passage', label: ''}`) must not render an empty box, a blank label or a blank
 * "Sunting petikan" row.
 */
export interface StimulusLike {
  label?: string
  title?: string
  text?: string
  svg?: string
  table?: unknown
  image?: unknown
}

export function hasStimulus(s: StimulusLike | null | undefined): boolean {
  if (!s) return false
  return !!(s.label?.trim() || s.title?.trim() || s.text?.trim() || s.svg || s.table || s.image)
}

/** The same check for a pool unit's stimulus (contract shape). */
export const hasStimulusOf = (s: unknown): boolean => hasStimulus(s as StimulusLike | null | undefined)

export const validTitle = (t: string): boolean => t.trim().length >= 1 && t.trim().length <= 200
