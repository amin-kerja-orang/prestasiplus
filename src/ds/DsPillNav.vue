<script setup lang="ts" generic="K extends string | number">
/**
 * Segmented navigation: the look of the themed `UTabs` (elevated track, raised active segment;
 * gradient in the learner personality) but a plain `nav`. An item with `to` is a link (the filter
 * lives in the URL, `aria-current="page"`); without it the items are buttons that emit `select`
 * (`aria-pressed`). Every item carries `data-active` and the test id `<prefix>-<key>`. It is not a
 * `UTabs` tablist on purpose: Nuxt UI triggers cannot be links or carry per-item test ids.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export interface PillItem<T extends string | number> {
  key: T
  label: string
  /** Phosphor icon class. */
  icon?: string
  to?: RouteLocationRaw
  /** Overrides the key in the test id. */
  testid?: string
}

defineProps<{
  items: readonly PillItem<K>[]
  active: K | null
  /** Accessible name of the nav. */
  label: string
  testidPrefix?: string
}>()
const emit = defineEmits<{ select: [key: K] }>()
</script>

<template>
  <nav :aria-label="label" class="max-w-full min-w-0" data-ds="pill-nav">
    <div class="flex w-fit max-w-full gap-1 overflow-x-auto rounded-md bg-elevated p-1">
      <component
        :is="item.to ? RouterLink : 'button'"
        v-for="item in items"
        :key="item.key"
        v-bind="item.to ? { to: item.to } : { type: 'button' }"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-3.5 text-label whitespace-nowrap transition"
        :class="
          item.key === active
            ? 'bg-seg-active text-highlighted shadow-ds-xs learner:bg-gradient-primary learner:text-primary-on'
            : 'text-muted hover:text-highlighted'
        "
        :aria-current="item.to && item.key === active ? 'page' : undefined"
        :aria-pressed="item.to ? undefined : item.key === active"
        :data-testid="testidPrefix ? `${testidPrefix}-${item.testid ?? String(item.key)}` : undefined"
        :data-active="item.key === active ? 'true' : 'false'"
        @click="item.to ? undefined : emit('select', item.key)"
      >
        <UIcon v-if="item.icon" :name="item.icon" class="size-5" aria-hidden="true" />
        {{ item.label }}
      </component>
    </div>
  </nav>
</template>
