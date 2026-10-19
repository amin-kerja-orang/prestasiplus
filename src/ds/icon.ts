/**
 * Icon names of the composites. A base name (`funnel`) resolves to the Phosphor class of the active
 * personality (learner Duotone, staff Regular, design language 6.1); a full class (`i-ph-fire-duotone`)
 * is still accepted for one release and used as given. Base names must be listed in
 * `src/theme/ds-icons.ts` so they are bundled offline.
 */
import { dsIconWeightSuffix, type DsIconWeight } from '@/theme/ds-icons'
import type { Personality } from '@/theme/color-mode'

export function resolveIcon(name: string, personality: Personality, weight?: DsIconWeight): string {
  if (name.startsWith('i-')) return name
  const w: DsIconWeight = weight ?? (personality === 'learner' ? 'duotone' : 'regular')
  return `i-ph-${name}${dsIconWeightSuffix[w]}`
}
