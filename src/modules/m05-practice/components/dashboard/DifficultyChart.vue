<script setup lang="ts">
/**
 * FR-M05-27: "Tahap Kesukaran" — five rows with a bar that grows, after 150 / 300 / 450 / 600 /
 * 750 ms, to count ÷ max(count) × 100 %; the footer shows the total.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { barWidths, DIFFICULTY_BAR_DELAY_MS, DIFFICULTY_ROWS } from './dashboard-lib'

const props = defineProps<{ chart: { level: number; count: number }[] }>()

const rows = computed(() =>
  DIFFICULTY_ROWS.map((row) => ({
    ...row,
    count: props.chart.find((c) => c.level === row.level)?.count ?? 0,
  })),
)
const targets = computed(() => barWidths(rows.value.map((r) => r.count)))
const total = computed(() => rows.value.reduce((sum, r) => sum + r.count, 0))

/** Bar widths in % as drawn (start at 0, then set after each row's delay). */
const widths = ref<number[]>(DIFFICULTY_ROWS.map(() => 0))
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  rows.value.forEach((_, i) => {
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
  <div class="card min-w-0" data-testid="dash-difficulty">
    <h2
      class="mb-3 text-2xl font-black text-slate-800 sm:mb-6 md:text-3xl"
      style="font-family: 'Outfit', sans-serif"
    >
      📈 Tahap Kesukaran
    </h2>
    <div class="space-y-3 sm:space-y-6">
      <div v-for="(row, i) in rows" :key="row.level" data-testid="dash-difficulty-row">
        <div class="mb-3 flex items-center justify-between gap-2">
          <span
            class="flex flex-wrap items-center text-base font-black text-slate-700"
            style="font-family: 'Outfit', sans-serif"
          >
            <span
              v-for="n in row.level"
              :key="n"
              class="text-sm"
              :style="{ color: row.color }"
              data-testid="dash-difficulty-star"
              >⭐</span
            >
            <span class="ml-3">{{ row.label }}</span>
          </span>
          <span
            class="rounded-full bg-indigo-50 px-3 py-1 text-lg font-black text-indigo-600"
            data-testid="dash-difficulty-count"
            >{{ row.count }}</span
          >
        </div>
        <div class="difficulty-bar-container">
          <div
            class="difficulty-bar-fill"
            :style="{
              background: `linear-gradient(90deg, ${row.color} 0%, ${row.color}cc 100%)`,
              width: `${widths[i]}%`,
            }"
            :data-target="targets[i]"
            data-testid="dash-difficulty-bar"
          ></div>
        </div>
      </div>
    </div>
    <div class="mt-5 border-t-2 border-slate-200 pt-4 sm:mt-10 sm:pt-8">
      <div class="text-center">
        <div
          class="number-display gradient-text mb-3 text-2xl sm:text-4xl md:text-5xl"
          data-testid="dash-difficulty-total"
        >
          {{ total }}
        </div>
        <div
          class="text-base font-black tracking-wide text-slate-600 uppercase"
          style="font-family: 'Outfit', sans-serif"
        >
          Jumlah Keseluruhan
        </div>
      </div>
    </div>
  </div>
</template>
