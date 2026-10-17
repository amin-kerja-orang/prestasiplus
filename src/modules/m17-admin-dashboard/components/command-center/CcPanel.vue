<script setup lang="ts">
/** A panel of S4-S7: a raised card with a tinted icon chip and the heading (live S4-S7 panels). */
import { DsIconChip } from '@/ds'

defineProps<{ icon: string; title: string }>()
</script>

<template>
  <UCard class="min-w-0">
    <template #header>
      <div class="flex min-w-0 items-center gap-2">
        <DsIconChip :icon="icon" size="sm" />
        <h2 class="min-w-0 text-subheading text-highlighted" data-testid="cc-panel-title">
          {{ title }}
        </h2>
      </div>
    </template>
    <slot />
  </UCard>
</template>
