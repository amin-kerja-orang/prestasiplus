<script setup lang="ts">
/**
 * A panel of the Kirkpatrick screens: a raised staff card with an optional icon chip, an `h2` and a muted
 * sub-line in its header. Layers separate the panels, never lines (v2 staff theme).
 */
import { DsIconChip } from '@/ds'

defineProps<{ title?: string; subtitle?: string; icon?: string }>()
</script>

<template>
  <UCard as="section" class="min-w-0">
    <template v-if="title" #header>
      <div class="flex min-w-0 items-center gap-3">
        <DsIconChip v-if="icon" :icon="icon" size="sm" />
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="text-subheading text-highlighted">{{ title }}</h2>
          <p v-if="subtitle" class="text-caption text-muted">{{ subtitle }}</p>
        </div>
      </div>
    </template>
    <slot />
  </UCard>
</template>
