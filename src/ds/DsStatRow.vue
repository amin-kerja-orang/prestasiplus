<script setup lang="ts">
/**
 * KPI strip (design language 9.2, 9.5): a responsive grid of `DsStatTile`. `cols="auto"` picks the
 * column count from the item count: 2 at 375, 3 at 768, up to 5 at 1280. Test ids follow the M27
 * `StatRow` convention: `${prefix}-${key}` on the cell.
 */
import { computed } from 'vue'

import type { RouteLocationRaw } from 'vue-router'

import { warnDeprecated } from './deprecate'
import { tileLayout } from './tile-layout'
import DsStatTile, { type StatDelta } from './DsStatTile.vue'
import type { DsAccent, DsIconProp, DsTileDensity, DsTone, DsValueTone } from './types'

export interface StatItem {
  key: string
  label: string
  /** A number is formatted ("1,271"); a string is shown as given; null prints "-". */
  value: string | number | null
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

/**
 * Orphan-free tracks for any tile count (`tile-layout.ts`): every row is full at every width and the
 * strip uses the full content width (no cap), so its edges match the filter bar and table beside it.
 * `cols` is the most tiles per row at `xl`.
 */
const count = computed(() => props.items.length)
const layout = computed(() => tileLayout(count.value, props.cols === 'auto' ? 5 : props.cols))
const grid = computed(() => layout.value.grid)
function span(i: number): string[] {
  return layout.value.span[i] ?? []
}

function id(key: string): string | undefined {
  return props.prefix ? `${props.prefix}-${key}` : undefined
}
</script>

<template>
  <ul class="grid min-w-0 gap-3 md:gap-4" :class="grid" data-ds="stat-row">
    <li
      v-for="(item, i) in items"
      :key="item.key"
      class="flex min-w-0"
      :class="span(i)"
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
      >
        <template v-if="$slots.sub" #sub><slot name="sub" :item="item" /></template>
      </DsStatTile>
    </li>
  </ul>
</template>
