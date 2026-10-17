<script setup lang="ts">
/** Empty state (FR-M25-20; SERVER template, D24): shown when the viewer has no shown cell. */
import { DsEmptyState } from '@/ds'

import { EMPTY_HREF, HEATMAP_COPY } from './heatmap-copy'
</script>

<template>
  <section class="rounded-card bg-default p-4 shadow-lift" data-testid="heatmap-empty">
    <DsEmptyState
      icon="i-ph-fire-duotone"
      :title="HEATMAP_COPY.emptyTitle"
      :description="HEATMAP_COPY.emptyHint"
    >
      <template #actions>
        <UButton
          :to="EMPTY_HREF"
          size="xl"
          class="min-h-11 justify-center"
          data-testid="heatmap-empty-button"
          >{{ HEATMAP_COPY.emptyButton }}</UButton
        >
      </template>
    </DsEmptyState>
  </section>
</template>
