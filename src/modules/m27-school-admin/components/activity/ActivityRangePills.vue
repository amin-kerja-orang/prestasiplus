<script setup lang="ts">
/**
 * S3 range pills (FR-M27-66; restyle spec AS-48): "Tempoh:" and a segmented row "7 Hari", "30 Hari",
 * "3 Bulan". Every item is a link to `?range=`; the active one is the solid kobalt button.
 */
import { computed } from 'vue'

import PillNav, { type PillItem } from '../shared/PillNav.vue'
import { ACTIVITY_PATH, RANGES, type ActivityRange } from './activity-format'

defineProps<{ active: ActivityRange }>()

const items = computed<PillItem<ActivityRange>[]>(() =>
  RANGES.map((r) => ({
    key: r.range,
    label: r.label,
    to: { path: ACTIVITY_PATH, query: { range: String(r.range) } },
  })),
)
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-2" data-testid="la-pills">
    <span class="inline-flex items-center gap-1 text-label text-muted">
      <UIcon name="i-ph-calendar-dots" class="size-5" aria-hidden="true" />Tempoh:
    </span>
    <PillNav :items="items" :active="active" nav-id="la-pills-nav" prefix="la-pill" label="Tempoh" />
  </div>
</template>
