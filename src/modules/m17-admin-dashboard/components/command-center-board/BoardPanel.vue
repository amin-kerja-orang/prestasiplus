<script setup lang="ts">
/** A panel of S2: a raised card with a tinted icon chip and the heading (FR-M17-33). */
import { DsIconChip } from '@/ds'

defineProps<{ icon: string; title: string; testid: string }>()
</script>

<template>
  <UCard class="min-w-0" :data-testid="testid">
    <template #header>
      <div class="flex min-w-0 items-center gap-2">
        <DsIconChip :icon="icon" size="sm" />
        <h2 class="min-w-0 text-subheading text-highlighted" data-testid="board-panel-title">
          {{ title }}
        </h2>
      </div>
    </template>
    <slot />
  </UCard>
</template>
