<script setup lang="ts">
/** Horizontal wrapping row (v2-ds-hardening 3.4). `stackBelow` replaces `flex-col md:flex-row`. */
import { computed } from 'vue'

import { alignUtil, gapX, gapY, justifyUtil } from './layout'
import type { DsBreakpoint, DsSpace } from './types'

const props = withDefaults(
  defineProps<{
    as?: 'div' | 'span' | 'ul' | 'ol' | 'nav' | 'header' | 'footer' | 'form' | 'fieldset'
    gap?: DsSpace
    rowGap?: DsSpace
    align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch'
    justify?: 'start' | 'center' | 'end' | 'between'
    wrap?: boolean
    stackBelow?: DsBreakpoint
    reverseBelow?: boolean
  }>(),
  {
    as: 'div',
    gap: 'sm',
    rowGap: undefined,
    align: 'center',
    justify: undefined,
    wrap: true,
    stackBelow: undefined,
    reverseBelow: false,
  },
)

const STACK = {
  sm: 'flex-col items-stretch sm:flex-row',
  md: 'flex-col items-stretch md:flex-row',
  lg: 'flex-col items-stretch lg:flex-row',
  xl: 'flex-col items-stretch xl:flex-row',
} as const
const ALIGN_AT = {
  sm: { start: 'sm:items-start', center: 'sm:items-center', end: 'sm:items-end', baseline: 'sm:items-baseline', stretch: 'sm:items-stretch' },
  md: { start: 'md:items-start', center: 'md:items-center', end: 'md:items-end', baseline: 'md:items-baseline', stretch: 'md:items-stretch' },
  lg: { start: 'lg:items-start', center: 'lg:items-center', end: 'lg:items-end', baseline: 'lg:items-baseline', stretch: 'lg:items-stretch' },
  xl: { start: 'xl:items-start', center: 'xl:items-center', end: 'xl:items-end', baseline: 'xl:items-baseline', stretch: 'xl:items-stretch' },
} as const
const REVERSE = {
  sm: 'flex-col-reverse items-stretch sm:flex-row',
  md: 'flex-col-reverse items-stretch md:flex-row',
  lg: 'flex-col-reverse items-stretch lg:flex-row',
  xl: 'flex-col-reverse items-stretch xl:flex-row',
} as const

const classes = computed(() => {
  const below = props.stackBelow
  return [
    'flex min-w-0',
    gapX[props.gap],
    gapY[props.rowGap ?? props.gap],
    below
      ? [props.reverseBelow ? REVERSE[below] : STACK[below], ALIGN_AT[below][props.align]]
      : alignUtil[props.align],
    props.wrap && !below ? 'flex-wrap' : below ? '' : 'flex-nowrap',
    props.justify ? justifyUtil[props.justify] : '',
    props.as === 'ul' || props.as === 'ol' ? 'list-none' : '',
  ]
})
</script>

<template>
  <component :is="as" :class="classes" data-ds="cluster"><slot /></component>
</template>
