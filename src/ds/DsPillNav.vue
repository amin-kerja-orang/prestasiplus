<script setup lang="ts" generic="K extends string | number">
/**
 * Segmented navigation: the look of the themed `UTabs` (elevated track, raised active segment;
 * gradient in the learner personality) but a plain `nav`. An item with `to` is a link (the filter
 * lives in the URL, `aria-current="page"`); without it the items are buttons that emit `select`
 * (`aria-pressed`). Every item carries `data-active` and the test id `<prefix>-<key>`. It is not a
 * `UTabs` tablist on purpose: Nuxt UI triggers cannot be links or carry per-item test ids.
 * States per item: hover, focus-visible ring, pressed, selected, disabled.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import './states.css'

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
}

withDefaults(
  defineProps<{
    items: readonly PillItem<K>[]
    active: K | null
    /** Accessible name of the nav. */
    label: string
    testidPrefix?: string
    size?: 'md' | 'lg'
    /** Opt-in: the pills wrap onto further lines instead of a horizontal swipe strip. */
    wrap?: boolean
  }>(),
  { testidPrefix: undefined, size: 'md', wrap: false },
)
const emit = defineEmits<{ select: [key: K] }>()

const personality = usePersonality()
</script>

<template>
  <nav :aria-label="label" class="max-w-full min-w-0" data-ds="pill-nav">
    <div
      :class="
        wrap
          ? 'flex w-fit max-w-full flex-wrap gap-1 rounded-md bg-elevated p-1'
          : 'flex w-fit max-w-full gap-1 overflow-x-auto rounded-md bg-elevated p-1'
      "
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
        class="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-3.5 text-label whitespace-nowrap transition active:opacity-80"
        :class="[
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
      </component>
    </div>
  </nav>
</template>
