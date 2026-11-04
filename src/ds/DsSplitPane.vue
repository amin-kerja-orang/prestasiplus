<script setup lang="ts">
/**
 * Two panes: side by side like `DsSplit` from `breakpoint` up, a segmented tab switch below it
 * (one pane visible, both stay mounted so form state survives a switch). Exactly two panes are
 * supported: `panes[0]` is the main pane, `panes[1]` the aside. Content goes in the named slots
 * `pane-{id}`. The last chosen pane is kept in memory per instance (no storage); `v-model:pane`
 * is optional and emits `update:pane`. `ratio`, `gap`, `stickyAside`, `scrollAside` and `align`
 * go to `DsSplit`, which stays the one rendered tree in both modes (a resize across the
 * breakpoint never remounts the panes). `breakpoint` is read once: it is static per instance. Tabs follow the WAI-ARIA tabs pattern: roving tabindex, Left / Right / Home / End.
 */
import { computed, nextTick, ref, useId, watch } from 'vue'

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
const tabbed = computed(() => !wide.value && props.panes.length >= 2)

const uid = `dsp-${useId()}`
const current = computed(() => {
  const id = pane.value ?? props.defaultPane ?? props.panes[0]?.id
  return props.panes.some((p) => p.id === id) ? id : props.panes[0]?.id
})
const tabId = (id: string): string => `${uid}-tab-${id}`
const panelId = (id: string): string => `${uid}-panel-${id}`

const tabs = ref<HTMLElement[]>([])
watch(
  () => props.panes.length,
  (n) => {
    tabs.value.length = Math.min(tabs.value.length, n)
  },
)
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
  <div class="flex min-w-0 flex-col gap-4" data-ds="split-pane" :data-mode="tabbed ? 'tabs' : 'split'">
    <div
      v-if="tabbed"
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
    <!-- One tree in both modes: the same two panes, so a resize never remounts them. Stacked, the
         tab switch hides one pane by class and the grid gap drops so no empty row is left. -->
    <DsSplit
      :ratio="ratio"
      :stack-below="breakpoint"
      :gap="tabbed ? 'none' : gap"
      :sticky-aside="stickyAside"
      :scroll-aside="scrollAside"
      :align="align"
      data-ds="split"
    >
      <div
        v-if="panes[0]"
        :id="panelId(panes[0].id)"
        :role="tabbed ? 'tabpanel' : undefined"
        :aria-labelledby="tabbed ? tabId(panes[0].id) : undefined"
        :tabindex="tabbed ? 0 : undefined"
        :class="tabbed && panes[0].id !== current ? 'hidden' : ''"
        :data-pane="panes[0].id"
      >
        <slot :name="`pane-${panes[0].id}`" />
      </div>
      <template v-if="panes[1]" #aside>
        <div
          :id="panelId(panes[1].id)"
          :role="tabbed ? 'tabpanel' : undefined"
          :aria-labelledby="tabbed ? tabId(panes[1].id) : undefined"
          :tabindex="tabbed ? 0 : undefined"
          :class="tabbed && panes[1].id !== current ? 'hidden' : ''"
          :data-pane="panes[1].id"
        >
          <slot :name="`pane-${panes[1].id}`" />
        </div>
      </template>
    </DsSplit>
  </div>
</template>
