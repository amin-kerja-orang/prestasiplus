<script setup lang="ts">
/**
 * KPI strip (design language 9.2, 9.5): a responsive grid of `DsStatTile`. `cols="auto"` picks the
 * column count from the item count: 2 at 375, 3 at 768, up to 5 at 1280. Test ids follow the M27
 * `StatRow` convention: `${prefix}-${key}` on the cell.
 */
import { computed } from 'vue'

import type { RouteLocationRaw } from 'vue-router'

import { warnDeprecated } from './deprecate'
import DsStatTile, { type StatDelta } from './DsStatTile.vue'
import type { DsAccent, DsIconProp, DsTileDensity, DsTone, DsValueTone } from './types'

export interface StatItem {
  key: string
  label: string
  value: string | number
  icon?: DsIconProp
  accent?: DsAccent
  tone?: DsTone
  sub?: string
  to?: RouteLocationRaw
  delta?: StatDelta
  /** The tile of the applied filter: framed with a primary layer, `data-active="true"`. */
  active?: boolean
  /** Colour of the number (a focus point). */
  valueTone?: DsValueTone
  /** @deprecated use `valueTone`. */
  valueClass?: string
  /** Not available: dimmed and inert. */
  disabled?: boolean
  /** Makes the tile a button (a drill-down that is not a route); `clickTitle` is its `title`. */
  onClick?: () => void
  clickTitle?: string
}

const props = withDefaults(
  defineProps<{
    items: StatItem[]
    /** Test-id prefix. */
    prefix?: string
    cols?: 'auto' | 2 | 3 | 4 | 5
    /** `compact` = horizontal tiles (chip beside value) for dense admin lists; `roomy` = report size. */
    density?: DsTileDensity
    /** @deprecated use `density="roomy"`. */
    roomy?: boolean
    /** @deprecated use `density="compact"`. */
    compact?: boolean
    loading?: boolean
    /** Test-id prefix of the tile parts (`-value`, `-label`, `-sub`). */
    partPrefix?: string
  }>(),
  {
    partPrefix: undefined,
    prefix: undefined,
    cols: 'auto',
    density: undefined,
    roomy: false,
    compact: false,
    loading: false,
  },
)

if (props.roomy) warnDeprecated('DsStatRow', 'roomy', 'density="roomy"')
if (props.compact) warnDeprecated('DsStatRow', 'compact', 'density="compact"')
const tileDensity = computed<DsTileDensity>(
  () => props.density ?? (props.compact ? 'compact' : props.roomy ? 'roomy' : 'default'),
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

// Staff: a strip of 2-3 tiles is capped (~22rem per tile) so it does not spread over a 1600px page.
const CAP: Record<string, string> = { '2': 'staff:max-w-3xl', '3': 'staff:max-w-6xl' }
const cap = computed(() => CAP[String(Math.min(Math.max(props.items.length, 2), 5))] ?? '')

function id(key: string): string | undefined {
  return props.prefix ? `${props.prefix}-${key}` : undefined
}
</script>

<template>
  <ul class="grid min-w-0 gap-3 md:gap-4" :class="[grid, cap]" data-ds="stat-row">
    <li
      v-for="item in items"
      :key="item.key"
      class="flex min-w-0"
      :data-testid="id(item.key)"
      :data-active="item.active ? 'true' : undefined"
    >
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
        :value-tone="item.valueTone"
        :value-class="item.valueClass"
        :selected="item.active"
        :disabled="item.disabled"
        :clickable="item.onClick !== undefined"
        :title="item.clickTitle"
        :density="tileDensity"
        :loading="loading"
        :part-prefix="partPrefix"
        @click="item.onClick?.()"
      />
    </li>
  </ul>
</template>
