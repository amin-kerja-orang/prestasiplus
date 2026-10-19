<script setup lang="ts">
/** "Tahap Kesukaran" (FR-M05-27): five rows with a bar scaled to the largest count, plus the total. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { barWidths, DIFFICULTY_BAR_DELAY_MS, DIFFICULTY_ROWS } from '../dashboard/dashboard-lib'
import { DsCluster, DsStack, DsHeading, DsText } from '@/ds'

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
  <DsStack as="section" gap="sm" aria-labelledby="dash-difficulty-h" data-testid="dash-difficulty">
    <DsHeading id="dash-difficulty-h" :level="2">📈 Tahap Kesukaran</DsHeading>
    <UCard :ui="{ body: 'flex flex-col gap-4 p-4' }">
      <DsStack
        v-for="(row, i) in rows"
        :key="row.level"
        gap="2xs"
        data-testid="dash-difficulty-row"
      >
        <DsCluster gap="xs" justify="between" :wrap="false">
          <span class="flex items-center gap-2 text-label text-highlighted">
            <span class="flex text-warning" aria-hidden="true">
              <span v-for="n in row.level" :key="n" data-testid="dash-difficulty-star">★</span>
            </span>
            <span>{{ row.label }}</span>
          </span>
          <DsText variant="label" tone="muted" tabular data-testid="dash-difficulty-count">{{
            row.count
          }}</DsText>
        </DsCluster>
        <UProgress
          :model-value="widths[i] ?? 0"
          :max="100"
          size="sm"
          :color="BAR_COLORS[i]"
          :aria-label="`${row.label}: ${row.count}`"
          :data-target="targets[i]"
          data-testid="dash-difficulty-bar"
        />
      </DsStack>
      <DsStack gap="none" align="center">
        <DsText variant="title" as="span" tabular data-testid="dash-difficulty-total">{{
          total
        }}</DsText>
        <DsText variant="label" tone="muted">Jumlah Keseluruhan</DsText>
      </DsStack>
    </UCard>
  </DsStack>
</template>
