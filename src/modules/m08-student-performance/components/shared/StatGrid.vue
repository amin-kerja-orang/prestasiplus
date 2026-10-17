<script setup lang="ts">
/**
 * Row of `DsStatTile`s (restyle spec 1.12: 2 across at 375, 3 at 768, 4 at 1280; `columns` 6 / 7 for
 * the wider rows). Each tile keeps its `stat-<id>` test id.
 */
import type { DsAccent } from '@/ds'
import { DsStatTile } from '@/ds'

import { usePhIcon, type PhIcon } from '../../lib/icons'

export interface StatItem {
  id: string
  label: string
  value: string | number
  icon: PhIcon
  accent?: DsAccent
}

withDefaults(defineProps<{ items: StatItem[]; columns?: 4 | 6 | 7; prefix?: string }>(), {
  columns: 4,
  prefix: 'stat',
})

const icon = usePhIcon()
</script>

<template>
  <ul
    class="grid grid-cols-2 gap-3 md:grid-cols-3"
    :class="columns === 7 ? 'xl:grid-cols-7' : columns === 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4'"
    data-testid="stat-cards"
  >
    <li v-for="s in items" :key="s.id" class="min-w-0">
      <DsStatTile
        :value="s.value"
        :unit="s.label"
        :icon="icon(s.icon)"
        :accent="s.accent ?? 'action'"
        class="h-full"
        :data-testid="`${prefix}-${s.id}`"
      />
    </li>
  </ul>
</template>
