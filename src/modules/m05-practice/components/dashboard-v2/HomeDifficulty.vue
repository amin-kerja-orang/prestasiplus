<script setup lang="ts">
/** "Tahap Kesukaran" (FR-M05-27): five rows with a bar scaled to the largest count, plus the total. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { barWidths, DIFFICULTY_BAR_DELAY_MS, DIFFICULTY_ROWS } from '../dashboard/dashboard-lib'

const props = defineProps<{ chart: { level: number; count: number }[] }>()

const rows = computed(() =>
  DIFFICULTY_ROWS.map((row) => ({
    ...row,
    count: props.chart.find((c) => c.level === row.level)?.count ?? 0,
  })),
)
const targets = computed(() => barWidths(rows.value.map((r) => r.count)))
const total = computed(() => rows.value.reduce((sum, r) => sum + r.count, 0))
const BAR_COLORS = ['success', 'success', 'warning', 'warning', 'error'] as const

/** Bars grow one after the other (150 ms apart), unless the visitor prefers reduced motion. */
const widths = ref<number[]>(DIFFICULTY_ROWS.map(() => 0))
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  DIFFICULTY_ROWS.forEach((_, i) => {
    if (reduced) {
      widths.value[i] = targets.value[i] ?? 0
      return
    }
    timers.push(
      setTimeout(
        () => {
          widths.value[i] = targets.value[i] ?? 0
        },
        DIFFICULTY_BAR_DELAY_MS * (i + 1),
      ),
    )
  })
})
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3"
    aria-labelledby="dash-difficulty-h"
    data-testid="dash-difficulty"
  >
    <h2 id="dash-difficulty-h" class="text-heading text-highlighted">📈 Tahap Kesukaran</h2>
    <UCard :ui="{ body: 'flex flex-col gap-4 p-4' }">
      <div
        v-for="(row, i) in rows"
        :key="row.level"
        class="flex flex-col gap-1"
        data-testid="dash-difficulty-row"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-label text-highlighted">
            <span class="flex text-warning" aria-hidden="true">
              <span v-for="n in row.level" :key="n" data-testid="dash-difficulty-star">★</span>
            </span>
            <span>{{ row.label }}</span>
          </span>
          <span class="tabular text-label text-muted" data-testid="dash-difficulty-count">{{
            row.count
          }}</span>
        </div>
        <UProgress
          :model-value="widths[i] ?? 0"
          :max="100"
          size="sm"
          :color="BAR_COLORS[i]"
          :aria-label="`${row.label}: ${row.count}`"
          :data-target="targets[i]"
          data-testid="dash-difficulty-bar"
        />
      </div>
      <div class="flex flex-col items-center">
        <span class="tabular text-title text-highlighted" data-testid="dash-difficulty-total">{{
          total
        }}</span>
        <span class="text-label text-muted">Jumlah Keseluruhan</span>
      </div>
    </UCard>
  </section>
</template>
