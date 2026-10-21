<script setup lang="ts">
/**
 * A panel of S2: a raised card with a tinted icon chip and the heading (FR-M17-33). It fills its grid
 * cell (`h-full`) and the content flows from the top, tight under the heading.
 */
import { DsIconChip } from '@/ds'

import { accentFor } from '../command-center/cc-format'

defineProps<{ icon: string; title: string; testid: string }>()
</script>

<template>
  <UCard
    class="h-full min-w-0"
    :ui="{
      root: 'flex h-full flex-col',
      header: 'pb-0 sm:pb-0',
      body: 'flex min-h-0 flex-1 flex-col pt-3 sm:pt-3',
    }"
    :data-testid="testid"
  >
    <template #header>
      <div class="flex min-w-0 items-center gap-2">
        <DsIconChip :icon="icon" :accent="accentFor(icon)" size="sm" />
        <h2 class="min-w-0 text-subheading text-highlighted" data-testid="board-panel-title">
          {{ title }}
        </h2>
      </div>
    </template>
    <slot />
  </UCard>
</template>
