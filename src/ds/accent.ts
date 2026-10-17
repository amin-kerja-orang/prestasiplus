/**
 * Class maps per meaning colour (design system 3.3). Solid fills take the accent's own "on" colour:
 * ink on lime, orange and amber, white on blue and violet. Written as full literals so the class
 * allowlist and Tailwind both see them. The `staff:` variant swaps the learner's solid chip for
 * the staff tint (B+: kobalt glyph on a 12% kobalt chip).
 */
import type { DsAccent } from './types'

/** Solid fill + on-colour (CTA buttons, chips). */
export const accentSolid: Record<DsAccent, string> = {
  action: 'bg-primary text-primary-on',
  win: 'bg-highlight text-on-highlight',
  heat: 'bg-heat text-on-highlight',
  friend: 'bg-friend text-primary-on',
  trial: 'bg-trial text-on-highlight',
}

/** Icon chip fill: solid for the learner, theme tint for staff. */
export const accentChip: Record<DsAccent, string> = {
  action: 'bg-primary text-primary-on staff:bg-ic-theme/12 staff:text-ic-theme',
  win: 'bg-highlight text-on-highlight staff:bg-ic-theme/12 staff:text-ic-theme',
  heat: 'bg-heat text-on-highlight staff:bg-ic-theme/12 staff:text-ic-theme',
  friend: 'bg-friend text-primary-on staff:bg-ic-theme/12 staff:text-ic-theme',
  trial: 'bg-trial text-on-highlight staff:bg-ic-theme/12 staff:text-ic-theme',
}

/** Low-mix surface tint laid over a `bg-default` card (meaning-coloured character cards). */
export const accentTint: Record<DsAccent, string> = {
  action: 'bg-primary/12',
  win: 'bg-highlight/12',
  heat: 'bg-heat/15',
  friend: 'bg-friend/16',
  trial: 'bg-trial/15',
}
