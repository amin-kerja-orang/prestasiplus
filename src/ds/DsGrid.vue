<script setup lang="ts">
/** Grid (v2-ds-hardening 3.5): fixed or responsive `cols`, or auto-fit tracks via `minItem`. */
import { computed } from 'vue'

import { colsClasses, gapAll, minItemUtil } from './layout'
import type { DsCols, DsResponsive, DsSpace } from './types'

const props = withDefaults(
  defineProps<{
    as?: 'div' | 'ul' | 'ol' | 'section'
    gap?: DsSpace
    cols?: DsCols | DsResponsive<DsCols>
    minItem?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    fit?: 'fit' | 'fill'
    align?: 'start' | 'center' | 'end' | 'stretch'
    equalHeight?: boolean
  }>(),
  { as: 'div', gap: 'md', cols: undefined, minItem: undefined, fit: 'fit', align: undefined, equalHeight: true },
)

const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const
const classes = computed(() => [
  'grid min-w-0',
  gapAll[props.gap],
  props.minItem ? minItemUtil[props.fit][props.minItem] : colsClasses(props.cols ?? { base: 1 }),
  props.align ? ALIGN[props.align] : props.equalHeight ? 'items-stretch' : 'items-start',
  props.equalHeight ? '*:data-[ds-grid-item]:h-full' : '',
  props.as === 'ul' || props.as === 'ol' ? 'list-none' : '',
])
</script>

<template>
  <component :is="as" :class="classes" data-ds="grid"><slot /></component>
</template>
