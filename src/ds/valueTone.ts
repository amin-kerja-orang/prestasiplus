/** Number colour of a stat tile (R2): the typed replacement of the `valueClass` escape hatch. */
import type { DsValueTone } from './types'

export const valueToneText: Record<DsValueTone, string> = {
  highlighted: 'text-highlighted',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
  muted: 'text-muted',
  dimmed: 'text-dimmed',
}

/** Deprecated `valueClass` strings map one-to-one onto a tone (codemod table). */
export function toneFromValueClass(cls: string | undefined): DsValueTone | undefined {
  if (!cls) return undefined
  return (Object.keys(valueToneText) as DsValueTone[]).find((t) => valueToneText[t] === cls)
}

/** Class of the number: `valueTone` wins; the deprecated class passes through when it has no tone. */
export function resolveValueClass(tone: DsValueTone | undefined, legacyClass: string | undefined): string {
  if (tone) return valueToneText[tone]
  const mapped = toneFromValueClass(legacyClass)
  if (mapped) return valueToneText[mapped]
  return legacyClass ?? valueToneText.highlighted
}
