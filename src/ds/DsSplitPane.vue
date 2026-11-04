<script setup lang="ts">
/**
 * Two panes: side by side like `DsSplit` from `breakpoint` up, a segmented tab switch below it
 * (one pane visible, both stay mounted so form state survives a switch). Exactly two panes are
 * supported: `panes[0]` is the main pane, `panes[1]` the aside. Content goes in the named slots
 * `pane-{id}`. The last chosen pane is kept in memory per instance (no storage); `v-model:pane`
 * is optional and emits `update:pane`. `ratio`, `gap`, `stickyAside`, `scrollAside` and `align`
 * go to `DsSplit`. Tabs follow the WAI-ARIA tabs pattern: roving tabindex, Left / Right / Home / End.
 */
import { computed, nextTick, ref } from 'vue'

import './states.css'

import DsSplit from './DsSplit.vue'
import type { DsSpace } from './types'
import { useMedia } from './useMedia'

export interface SplitPaneItem {
  id: string
  label: string
}

type Ratio = '1-1' | '2-1' | '3-1' | '1-2' | '8-4' | '5-7' | '7-5'
type Breakpoint = 'md' | 'lg' | 'xl'

const props = withDefaults(
  defineProps<{
    /** Exactly two panes: first = main, second = aside. */
    panes: SplitPaneItem[]
    breakpoint?: Breakpoint
    /** Pane shown first below the breakpoint; default the first pane. */
    defaultPane?: string
    /** Accessible name of the tablist. */
    ariaLabel: string
    ratio?: Ratio
    gap?: DsSpace
    stickyAside?: boolean
    scrollAside?: boolean
    align?: 'start' | 'stretch'
  }>(),
  {
    breakpoint: 'md',
    defaultPane: undefined,
    ratio: '8-4',
    gap: 'lg',
    stickyAside: false,
    scrollAside: false,
    align: 'start',
  },
)

const pane = defineModel<string>('pane')

const WIDTH: Record<Breakpoint, string> = {
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
}
const wide = useMedia(WIDTH[props.breakpoint])

const uid = `dsp-${Math.random().toString(36).slice(2, 8)}`
const current = computed(() => {
  const id = pane.value ?? props.defaultPane ?? props.panes[0]?.id
  return props.panes.some((p) => p.id === id) ? id : props.panes[0]?.id
})
const tabId = (id: string): string => `${uid}-tab-${id}`
const panelId = (id: string): string => `${uid}-panel-${id}`

const tabs = ref<HTMLElement[]>([])
function onKey(e: KeyboardEvent, index: number): void {
  const last = props.panes.length - 1
  const next =
    e.key === 'ArrowRight' ? (index + 1 > last ? 0 : index + 1)
    : e.key === 'ArrowLeft' ? (index - 1 < 0 ? last : index - 1)
    : e.key === 'Home' ? 0
    : e.key === 'End' ? last
    : -1
  if (next < 0) return
  e.preventDefault()
  pane.value = props.panes[next]!.id
  void nextTick(() => tabs.value[next]?.focus())
}
</script>

<template>
  <DsSplit
    v-if="wide && panes.length >= 2"
    :ratio="ratio"
    :stack-below="breakpoint"
    :gap="gap"
    :sticky-aside="stickyAside"
    :scroll-aside="scrollAside"
    :align="align"
    data-ds="split-pane"
    data-mode="split"
  >
    <slot :name="`pane-${panes[0]!.id}`" />
    <template #aside><slot :name="`pane-${panes[1]!.id}`" /></template>
  </DsSplit>
  <div v-else class="flex min-w-0 flex-col gap-4" data-ds="split-pane" data-mode="tabs">
    <div
      role="tablist"
      :aria-label="ariaLabel"
      class="flex w-fit max-w-full gap-1 rounded-md bg-elevated p-1"
    >
      <component
        :is="'button'"
        v-for="(p, i) in panes"
        :id="tabId(p.id)"
        :key="p.id"
        :ref="(el: unknown) => { if (el) tabs[i] = el as HTMLElement }"
        type="button"
        role="tab"
        :aria-selected="p.id === current"
        :aria-controls="panelId(p.id)"
        :tabindex="p.id === current ? 0 : -1"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-3.5 text-label whitespace-nowrap transition active:opacity-80"
        :class="
          p.id === current
            ? 'bg-seg-active text-highlighted shadow-ds-xs learner:bg-gradient-primary learner:text-primary-on'
            : 'text-muted hover:text-highlighted'
        "
        :data-active="p.id === current ? 'true' : 'false'"
        @click="pane = p.id"
        @keydown="onKey($event, i)"
      >
        {{ p.label }}
      </component>
    </div>
    <div
      v-for="p in panes"
      :id="panelId(p.id)"
      :key="p.id"
      role="tabpanel"
      :aria-labelledby="tabId(p.id)"
      class="min-w-0"
      :class="p.id === current ? '' : 'hidden'"
      :data-pane="p.id"
    >
      <slot :name="`pane-${p.id}`" />
    </div>
  </div>
</template>
