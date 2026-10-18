/**
 * Class maps per meaning colour (design system 3.3). Solid fills take the accent's own "on" colour:
 * ink on lime, orange and amber, white on blue and violet. Written as full literals so the class
 * allowlist and Tailwind both see them. The `staff:` variant keeps the solid, meaning-coloured chip
 * (staff action chip uses the A1 gradient; heat takes the on-primary glyph on the darker staff orange).
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
  action: 'bg-primary text-primary-on staff:bg-gradient-primary',
  win: 'bg-highlight text-on-highlight',
  heat: 'bg-heat text-on-highlight staff:text-primary-on',
  friend: 'bg-friend text-primary-on',
  trial: 'bg-trial text-on-highlight',
}

/** Low-mix surface tint laid over a `bg-default` card (meaning-coloured character cards). */
export const accentTint: Record<DsAccent, string> = {
  action: 'bg-primary/12',
  win: 'bg-highlight/12',
  heat: 'bg-heat/15',
  friend: 'bg-friend/16',
  trial: 'bg-trial/15',
}
