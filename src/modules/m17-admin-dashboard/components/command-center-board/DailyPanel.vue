<script setup lang="ts">
/**
 * A card of S3 with a tinted icon chip and the heading. While the period loads the body shows the
 * spinner and a failed load shows "Gagal memuatkan" (FR-M17-36); the default slot renders when `state` is `ok`.
 */
import { DsIconChip } from '@/ds'

import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'

withDefaults(
  defineProps<{
    title: string
    icon: string
    testid: string
    state?: LoadStatus
    heading?: string
  }>(),
  { state: 'ok', heading: undefined },
)
</script>

<template>
  <UCard class="min-w-0" :data-testid="testid">
    <template #header>
      <div class="flex min-w-0 items-center gap-2">
        <DsIconChip :icon="icon" size="sm" />
        <h2 class="min-w-0 text-subheading text-highlighted" data-testid="daily-panel-title">
          {{ heading ?? title }}
        </h2>
      </div>
    </template>
    <p
      v-if="state === 'loading'"
      class="flex justify-center py-4 text-muted"
      data-testid="daily-loading"
    >
      <UProgress class="w-24" aria-label="Memuatkan" />
    </p>
    <p
      v-else-if="state === 'error'"
      class="py-4 text-center text-body text-error"
      data-testid="daily-error"
    >
      {{ S3_COPY.loadFailed }}
    </p>
    <slot v-else />
  </UCard>
</template>
