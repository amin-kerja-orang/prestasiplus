<script setup lang="ts">
/** Grid (v2-ds-hardening 3.5): fixed or responsive `cols`, or auto-fit tracks via `minItem`. */
import { computed } from 'vue'

import { colsClasses, gapAll, minItemUtil } from './layout'
import { tileLayout } from './tile-layout'
import type { DsCols, DsResponsive, DsSpace } from './types'

const props = withDefaults(
  defineProps<{
    as?: 'div' | 'ul' | 'ol' | 'section'
    gap?: DsSpace
    cols?: DsCols | DsResponsive<DsCols>
    /** Number of KPI tiles: orphan-free tracks (see `tileLayout`); give each tile `tileLayout(n).span[i]`. */
    tiles?: number
    /** Card list of any length: 1 / 2 / `balanced` columns (md / xl), the last row always full (`data-ds-fill`). */
    balanced?: 2 | 3
    minItem?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    fit?: 'fit' | 'fill'
    align?: 'start' | 'center' | 'end' | 'stretch'
    equalHeight?: boolean
  }>(),
  { as: 'div', gap: 'md', cols: undefined, tiles: undefined, balanced: undefined, minItem: undefined, fit: 'fit', align: undefined, equalHeight: true },
)

const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const
const classes = computed(() => [
  'grid min-w-0',
  gapAll[props.gap],
  props.balanced
    ? ''
    : props.tiles !== undefined
    ? tileLayout(props.tiles).grid
    : props.minItem
      ? minItemUtil[props.fit][props.minItem]
      : colsClasses(props.cols ?? { base: 1 }),
  props.align ? ALIGN[props.align] : props.equalHeight ? 'items-stretch' : 'items-start',
  props.equalHeight ? '*:data-[ds-grid-item]:h-full' : '',
  props.as === 'ul' || props.as === 'ol' ? 'list-none' : '',
])
</script>

<template>
  <component :is="as" :class="classes" data-ds="grid" :data-ds-fill="balanced"><slot /></component>
</template>
