<script setup lang="ts">
/**
 * Main + aside (v2-ds-hardening 3.6): a 12-column split that stacks below `stackBelow`. Slots:
 * default (main) and `aside`.
 */
import { computed } from 'vue'

import { gapAll } from './layout'
import type { DsSpace } from './types'

type Ratio = '1-1' | '2-1' | '3-1' | '1-2' | '8-4'
type StackBelow = 'md' | 'lg' | 'xl'

const props = withDefaults(
  defineProps<{
    ratio?: Ratio
    stackBelow?: StackBelow
    gap?: DsSpace
    asideFirstWhenStacked?: boolean
    stickyAside?: boolean
    align?: 'start' | 'stretch'
  }>(),
  { ratio: '8-4', stackBelow: 'xl', gap: 'lg', asideFirstWhenStacked: false, stickyAside: false, align: 'start' },
)

const GRID: Record<StackBelow, string> = {
  md: 'grid-cols-1 md:grid-cols-12',
  lg: 'grid-cols-1 lg:grid-cols-12',
  xl: 'grid-cols-1 xl:grid-cols-12',
}
const MAIN: Record<StackBelow, Record<Ratio, string>> = {
  md: { '1-1': 'md:col-span-6', '2-1': 'md:col-span-8', '3-1': 'md:col-span-9', '1-2': 'md:col-span-4', '8-4': 'md:col-span-8' },
  lg: { '1-1': 'lg:col-span-6', '2-1': 'lg:col-span-8', '3-1': 'lg:col-span-9', '1-2': 'lg:col-span-4', '8-4': 'lg:col-span-8' },
  xl: { '1-1': 'xl:col-span-6', '2-1': 'xl:col-span-8', '3-1': 'xl:col-span-9', '1-2': 'xl:col-span-4', '8-4': 'xl:col-span-8' },
}
const ASIDE: Record<StackBelow, Record<Ratio, string>> = {
  md: { '1-1': 'md:col-span-6', '2-1': 'md:col-span-4', '3-1': 'md:col-span-3', '1-2': 'md:col-span-8', '8-4': 'md:col-span-4' },
  lg: { '1-1': 'lg:col-span-6', '2-1': 'lg:col-span-4', '3-1': 'lg:col-span-3', '1-2': 'lg:col-span-8', '8-4': 'lg:col-span-4' },
  xl: { '1-1': 'xl:col-span-6', '2-1': 'xl:col-span-4', '3-1': 'xl:col-span-3', '1-2': 'xl:col-span-8', '8-4': 'xl:col-span-4' },
}
const ORDER: Record<StackBelow, string> = {
  md: 'order-first md:order-none',
  lg: 'order-first lg:order-none',
  xl: 'order-first xl:order-none',
}
const STICKY: Record<StackBelow, string> = {
  md: 'md:sticky md:top-4 md:self-start',
  lg: 'lg:sticky lg:top-4 lg:self-start',
  xl: 'xl:sticky xl:top-4 xl:self-start',
}

const gridClass = computed(() => [
  'grid min-w-0',
  GRID[props.stackBelow],
  gapAll[props.gap],
  props.align === 'start' ? 'items-start' : 'items-stretch',
])
const mainClass = computed(() => ['min-w-0', MAIN[props.stackBelow][props.ratio]])
const asideClass = computed(() => [
  'min-w-0',
  ASIDE[props.stackBelow][props.ratio],
  props.asideFirstWhenStacked ? ORDER[props.stackBelow] : '',
  props.stickyAside ? STICKY[props.stackBelow] : '',
])
</script>

<template>
  <div :class="gridClass" data-ds="split">
    <div :class="mainClass" data-ds="split-main"><slot /></div>
    <aside v-if="$slots.aside" :class="asideClass" data-ds="split-aside"><slot name="aside" /></aside>
  </div>
</template>
