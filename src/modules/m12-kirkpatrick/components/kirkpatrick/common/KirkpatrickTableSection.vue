<script setup lang="ts">
/**
 * A titled table block of the Kirkpatrick screens: icon chip + `h2` (+ optional sub-line) above a staff
 * table (`DsDataTable` goes in the default slot) and an optional footnote below it.
 */
import { DsIconChip } from '@/ds'

defineProps<{ title: string; subtitle?: string; icon: string; footnote?: string }>()
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3">
    <div class="flex min-w-0 items-center gap-3">
      <DsIconChip :icon="icon" size="sm" />
      <div class="flex min-w-0 flex-col gap-1">
        <h2 class="text-subheading text-highlighted">{{ title }}</h2>
        <p v-if="subtitle" class="text-caption text-muted">{{ subtitle }}</p>
      </div>
    </div>
    <slot />
    <p v-if="footnote" class="flex items-start gap-2 text-caption text-muted">
      <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" />{{ footnote }}
    </p>
  </section>
</template>
