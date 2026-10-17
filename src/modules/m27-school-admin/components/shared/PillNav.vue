<script setup lang="ts" generic="K extends string | number">
/**
 * Segmented pill row of the M27 report screens (restyle spec AS-46/48/49): the active item is a solid
 * kobalt button, the others are soft neutral ones. An item with `to` is a link (the filter lives in the
 * URL); without it the row is a button group that emits `select`. Test ids are `<prefix>-<key>` and every
 * item carries `data-active`.
 */
import type { RouteLocationRaw } from 'vue-router'

export interface PillItem<T extends string | number> {
  key: T
  label: string
  /** Phosphor icon class, spelled out by the caller. */
  icon?: string
  to?: RouteLocationRaw
  /** Overrides the key in the test id. */
  testid?: string
}

defineProps<{
  items: readonly PillItem<K>[]
  active: K | null
  navId: string
  prefix: string
  label: string
}>()
const emit = defineEmits<{ select: [key: K] }>()
</script>

<template>
  <nav class="flex min-w-0 flex-wrap items-center gap-2" :aria-label="label" :data-testid="navId">
    <UButton
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      :type="item.to ? undefined : 'button'"
      size="lg"
      :color="item.key === active ? 'primary' : 'neutral'"
      :variant="item.key === active ? 'solid' : 'soft'"
      :icon="item.icon"
      :label="item.label"
      :aria-current="item.to && item.key === active ? 'page' : undefined"
      :aria-pressed="item.to ? undefined : item.key === active"
      :data-testid="`${prefix}-${item.testid ?? String(item.key)}`"
      :data-active="item.key === active ? 'true' : 'false'"
      @click="item.to ? undefined : emit('select', item.key)"
    />
  </nav>
</template>
