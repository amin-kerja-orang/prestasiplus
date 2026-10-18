/**
 * Stat items of the M08 pages as `DsStatRow` items. The pages describe a tile with a Phosphor
 * name (`icon`); this maps it to the personality icon and gives every tile without an explicit accent
 * a different categorical one (design language 9.5: varied accents, never a single colour).
 */
import { computed, type ComputedRef } from 'vue'

import type { DsAccent, StatItem as DsStatItem } from '@/ds'

import { usePhIcon, type PhIcon } from './icons'

export interface StatSpec {
  id: string
  label: string
  value: string | number
  icon: PhIcon
  accent?: DsAccent
}

const CYCLE: readonly DsAccent[] = ['action', 'heat', 'win', 'friend', 'trial']

export function useStatItems(): ComputedRef<(specs: readonly StatSpec[]) => DsStatItem[]> {
  const icon = usePhIcon()
  return computed(() => (specs) =>
    specs.map((s, i) => ({
      key: s.id,
      label: s.label,
      value: s.value,
      icon: icon.value(s.icon),
      accent: s.accent ?? CYCLE[i % CYCLE.length],
    })),
  )
}
