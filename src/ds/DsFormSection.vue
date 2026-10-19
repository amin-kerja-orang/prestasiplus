<script setup lang="ts">
/**
 * Titled card that groups the fields of one form step: icon chip + h2, optional description and
 * header actions, fields in a gap-5 grid (`columns=2` is two columns from `sm`). `tone="danger"`
 * ("Zon Bahaya") tints the chip with the error colour; the card itself keeps no red line.
 */
import DsIconChip from './DsIconChip.vue'
import DsPanel from './DsPanel.vue'
import type { DsAccent, DsIconProp } from './types'

withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Phosphor base name (full `i-ph-*` classes are deprecated). */
    icon?: DsIconProp
    accent?: DsAccent
    /** `danger` is a deprecated alias of `error`. */
    tone?: 'default' | 'error' | 'danger'
    columns?: 1 | 2
  }>(),
  { description: undefined, icon: undefined, accent: 'action', tone: 'default', columns: 1 },
)
</script>

<template>
  <DsPanel flush data-ds="form-section" :data-tone="tone">
    <header class="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
      <div class="flex min-w-0 items-center gap-3">
        <DsIconChip v-if="icon" :icon="icon" :accent="accent" :tone="tone === 'default' ? undefined : 'error'" />
        <div class="min-w-0">
          <h2 class="text-subheading text-highlighted">{{ title }}</h2>
          <p v-if="description" class="text-caption text-muted">{{ description }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div
      class="grid min-w-0 gap-5 px-4 pb-4 sm:px-6 sm:pb-6"
      :class="columns === 2 ? 'sm:grid-cols-2' : ''"
    >
      <slot />
    </div>
    <footer v-if="$slots.footer" class="px-4 pb-4 sm:px-6 sm:pb-6">
      <slot name="footer" />
    </footer>
  </DsPanel>
</template>
