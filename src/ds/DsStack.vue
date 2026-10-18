<script setup lang="ts">
/** Vertical flow (v2-ds-hardening 3.3): `flex-col` with a token gap. Always `min-w-0`. */
import { computed } from 'vue'

import { gapAll, justifyUtil, paddingUtil } from './layout'
import type { DsPadding, DsSpace } from './types'

const props = withDefaults(
  defineProps<{
    as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'aside' | 'nav' | 'form' | 'ul' | 'ol' | 'fieldset'
    gap?: DsSpace
    align?: 'start' | 'center' | 'end' | 'stretch'
    justify?: 'start' | 'center' | 'end' | 'between'
    fill?: boolean
    padding?: DsPadding
  }>(),
  { as: 'div', gap: 'md', align: 'stretch', justify: undefined, fill: false, padding: 'none' },
)

const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const
const classes = computed(() => [
  'flex min-w-0 flex-col',
  gapAll[props.gap],
  ALIGN[props.align],
  props.justify ? justifyUtil[props.justify] : '',
  props.fill ? 'min-h-0 flex-1' : '',
  props.padding === 'none' ? '' : paddingUtil[props.padding],
  props.as === 'ul' || props.as === 'ol' ? 'list-none' : '',
])
</script>

<template>
  <component :is="as" :class="classes" data-ds="stack"><slot /></component>
</template>
