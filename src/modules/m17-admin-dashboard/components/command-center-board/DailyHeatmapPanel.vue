<script setup lang="ts">
/**
 * "Heatmap Jam (Hari Ini)" (FR-M17-44, FN-M17-4.4.2): 24 cells by MYT hour of `answeredAt`, tooltip
 * "{h}:00 — {n} soalan"; "Tiada data" when today has none. Rendered on the "Hari Ini" tab only.
 */
import { computed } from 'vue'

import type { CcDailyActivity } from '../../api/command-center-board'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus }>()

const cells = computed(() => {
  const heat = props.data?.hourlyHeatmap ?? {}
  const counts = Array.from({ length: 24 }, (_, h) => heat[String(h)] ?? 0)
  const max = Math.max(...counts)
  return {
    any: max > 0,
    list: counts.map((n, h) => ({
      hour: h,
      count: n,
      opacity: n === 0 ? 0 : 0.35 + 0.65 * (n / max),
    })),
  }
})
</script>

<template>
  <DailyPanel
    title="Heatmap Jam (Hari Ini)"
    dot="bg-amber-500"
    testid="cc-panel-heatmap"
    :state="status"
  >
    <p v-if="!cells.any" class="text-center text-sm text-slate-400" data-testid="cc-empty">
      {{ S3_COPY.noData }}
    </p>
    <ol v-else class="grid grid-cols-12 gap-1 sm:grid-cols-[repeat(24,minmax(0,1fr))]">
      <li
        v-for="c in cells.list"
        :key="c.hour"
        class="h-7 rounded bg-slate-800"
        :title="`${String(c.hour)}:00 — ${String(c.count)} soalan`"
        :data-hour="c.hour"
        :data-count="c.count"
        data-testid="cc-heat-cell"
      >
        <span class="block h-full w-full rounded bg-indigo-500" :style="{ opacity: c.opacity }" />
      </li>
    </ol>
  </DailyPanel>
</template>
