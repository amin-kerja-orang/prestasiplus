<script setup lang="ts" generic="K extends string | number">
/**
 * Segmented navigation: the look of the themed `UTabs` (elevated track, raised active segment;
 * gradient in the learner personality) but a plain `nav`. An item with `to` is a link (the filter
 * lives in the URL, `aria-current="page"`); without it the items are buttons that emit `select`
 * (`aria-pressed`). Every item carries `data-active` and the test id `<prefix>-<key>`. It is not a
 * `UTabs` tablist on purpose: Nuxt UI triggers cannot be links or carry per-item test ids.
 * States per item: hover, focus-visible ring, pressed, selected, disabled. An item may carry a
 * `count` (formatted "1,271", read after the label). When the strip overflows (375px) the active
 * item is scrolled into view inside the strip, never the page.
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import './states.css'

import { formatCount } from './format'
import { resolveIcon } from './icon'
import { usePersonality } from './personality'
import type { DsIconProp } from './types'

export interface PillItem<T extends string | number> {
  key: T
  label: string
  /** Phosphor base name (full `i-ph-*` classes are deprecated). */
  icon?: DsIconProp
  to?: RouteLocationRaw
  /** Overrides the key in the test id. */
  testid?: string
  /** Not available: dimmed, not focusable, no navigation. */
  disabled?: boolean
  /** A count after the label (tickets per status); formatted with a thousands comma. */
  count?: number
}

const props = withDefaults(
  defineProps<{
    items: readonly PillItem<K>[]
    active: K | null
    /** Accessible name of the nav. */
    label: string
    testidPrefix?: string
    size?: 'md' | 'lg'
    /** Items wrap onto further lines when the strip is too narrow, instead of scrolling sideways. */
    wrap?: boolean
    /** Tighter item padding so a long strip (five labels) fits one row at 1280. */
    compact?: boolean
  }>(),
  { testidPrefix: undefined, size: 'md', wrap: false, compact: false },
)
const emit = defineEmits<{ select: [key: K] }>()

const personality = usePersonality()

const strip = ref<HTMLElement | null>(null)
/** Centres the active item in the scrolling strip (only when the strip overflows). */
function revealActive(): void {
  const el = strip.value
  const on = el?.querySelector<HTMLElement>('[data-active="true"]')
  if (!el || !on || el.scrollWidth <= el.clientWidth) return
  el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2)
}
onMounted(revealActive)
watch(
  () => props.active,
  () => void nextTick(revealActive),
)
</script>

<template>
  <nav :aria-label="label" class="max-w-full min-w-0" data-ds="pill-nav">
    <div
      ref="strip"
      class="flex w-fit max-w-full gap-1 rounded-md bg-elevated p-1"
      :class="wrap ? 'flex-wrap' : 'overflow-x-auto'"
      :data-wrap="wrap || undefined"
    >
      <component
        :is="item.to && !item.disabled ? RouterLink : 'button'"
        v-for="item in items"
        :key="item.key"
        v-bind="
          item.to && !item.disabled
            ? { to: item.to }
            : { type: 'button', disabled: item.disabled || undefined }
        "
        class="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-label whitespace-nowrap transition active:opacity-80"
        :class="[
          compact ? 'px-2' : 'px-3.5',
          wrap ? 'grow justify-center' : '',
          size === 'lg' ? 'min-h-12' : 'min-h-11',
          item.disabled ? 'pointer-events-none opacity-50' : '',
          item.key === active
            ? 'bg-seg-active text-highlighted shadow-ds-xs learner:bg-gradient-primary learner:text-primary-on'
            : 'text-muted hover:text-highlighted',
        ]"
        :aria-current="item.to && item.key === active ? 'page' : undefined"
        :aria-pressed="item.to ? undefined : item.key === active"
        :aria-disabled="item.disabled ? 'true' : undefined"
        :data-testid="testidPrefix ? `${testidPrefix}-${item.testid ?? String(item.key)}` : undefined"
        :data-active="item.key === active ? 'true' : 'false'"
        @click="item.to || item.disabled ? undefined : emit('select', item.key)"
      >
        <UIcon
          v-if="item.icon"
          :name="resolveIcon(item.icon, personality)"
          class="size-5"
          aria-hidden="true"
        />
        {{ item.label }}
        <span
          v-if="item.count !== undefined"
          class="tabular min-w-6 rounded-full px-1.5 text-center text-caption font-semibold"
          :class="item.key === active ? 'bg-default text-primary' : 'bg-default text-muted'"
          data-ds="pill-count"
          >{{ formatCount(item.count) }}</span
        >
      </component>
    </div>
  </nav>
</template>
