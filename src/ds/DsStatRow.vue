<script setup lang="ts">
/**
 * KPI strip (design language 9.2, 9.5): a responsive grid of `DsStatTile`. `cols="auto"` picks the
 * column count from the item count: 2 at 375, 3 at 768, up to 5 at 1280. Test ids follow the M27
 * `StatRow` convention: `${prefix}-${key}` on the cell.
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import DsStatTile, { type StatDelta } from './DsStatTile.vue'
import type { DsAccent } from './types'

export interface StatItem {
  key: string
  label: string
  value: string | number
  icon?: string
  accent?: DsAccent
  tone?: 'success' | 'warning' | 'error' | 'info'
  sub?: string
  to?: RouteLocationRaw
  delta?: StatDelta
}

const props = withDefaults(
  defineProps<{
    items: StatItem[]
    /** Test-id prefix. */
    prefix?: string
    cols?: 'auto' | 2 | 3 | 4 | 5
    roomy?: boolean
    loading?: boolean
  }>(),
  { prefix: undefined, cols: 'auto', roomy: false, loading: false },
)

const GRID: Record<string, string> = {
  '2': 'grid-cols-2',
  '3': 'grid-cols-2 md:grid-cols-3',
  '4': 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
  '5': 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
}
const grid = computed(() => {
  const n = props.cols === 'auto' ? Math.min(Math.max(props.items.length, 2), 5) : props.cols
  return GRID[String(n)]
})

function id(key: string): string | undefined {
  return props.prefix ? `${props.prefix}-${key}` : undefined
}
</script>

<template>
  <ul class="grid min-w-0 gap-3 md:gap-4" :class="grid" data-ds="stat-row">
    <li v-for="item in items" :key="item.key" class="flex min-w-0" :data-testid="id(item.key)">
      <DsStatTile
        class="w-full"
        :value="item.value"
        :unit="item.label"
        :sub="item.sub"
        :icon="item.icon"
        :accent="item.accent"
        :tone="item.tone"
        :to="item.to"
        :delta="item.delta"
        :roomy="roomy"
        :loading="loading"
      />
    </li>
  </ul>
</template>
