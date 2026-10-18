<script setup lang="ts">
/**
 * Raised panel of the admin pattern (`docs/design/v2-admin-pages.md`): the surface that holds a
 * toolbar, a table or a summary on the page layer. `flush` drops the padding (tables go edge to
 * edge), `tone="bulk"` is the sticky selection bar. Surface, radius and shadow live here, so pages
 * never name them. `title` (with optional `description` / `icon`) and the `actions` slot print the
 * standard panel header.
 */
import DsIconChip from './DsIconChip.vue'
import type { DsAccent } from './types'

withDefaults(
  defineProps<{
    /** `raised` = page-layer card; `bulk` = sticky selection bar on the elevated layer; `bar` = sticky bottom action bar of a form. */
    tone?: 'raised' | 'bulk' | 'bar'
    flush?: boolean
    /** Sticky positioning of the `bulk` and `bar` tones. */
    sticky?: boolean
    title?: string
    description?: string
    /** Phosphor icon class for the header chip. */
    icon?: string
    accent?: DsAccent
  }>(),
  {
    tone: 'raised',
    flush: false,
    sticky: true,
    title: undefined,
    description: undefined,
    icon: undefined,
    accent: 'action',
  },
)
</script>

<template>
  <div
    class="min-w-0 overflow-clip rounded-card"
    :class="[
      tone === 'raised' ? 'bg-default shadow-ds-xs' : 'bg-elevated shadow-lift',
      sticky && tone === 'bulk' ? 'sticky top-2 z-20' : '',
      sticky && tone === 'bar' ? 'sticky bottom-2 z-20' : '',
      flush || title || $slots.actions ? '' : 'p-3 sm:p-4',
    ]"
    :data-tone="tone"
    data-ds="panel"
  >
    <header
      v-if="title || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"
      data-ds="panel-header"
    >
      <div v-if="title" class="flex min-w-0 items-center gap-3">
        <DsIconChip v-if="icon" :icon="icon" :accent="accent" size="sm" />
        <div class="min-w-0">
          <h2 class="text-subheading text-highlighted">{{ title }}</h2>
          <p v-if="description" class="text-caption text-muted">{{ description }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div :class="!flush && (title || $slots.actions) ? 'px-3 pb-3 sm:px-4 sm:pb-4' : ''">
      <slot />
    </div>
  </div>
</template>
