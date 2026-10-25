<script setup lang="ts">
/**
 * S0 "Taburan Gred (Anggaran)" sub-heading with "Lihat penuh →" (to M08 S1) and the grade distribution
 * A+ … G (FR-M27-36; the list is INFERRED from the M08 page, OQ-M27-11), drawn as horizontal bars through
 * `DsChart` (restyle spec AS-2; counts on the bars, the percentage in the label), footer "Jumlah: {n}
 * rekod".
 */
import { computed } from 'vue'

import { DsChart } from '@/ds'
import { formatNumber } from '@/lib/number'

import type { DashboardGrade } from '../../api/dashboard'
import { count, PATHS } from './dashboard-format'

const props = defineProps<{ distribution: readonly DashboardGrade[]; total: number }>()

const labels = computed(() =>
  props.distribution.map((d) => `${d.grade} (${formatNumber(d.pct, { decimals: 1 })}%)`),
)
const series = computed(() => [{ label: 'Rekod', data: props.distribution.map((d) => d.count) }])
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3" data-testid="sd-grades">
    <div class="flex flex-wrap items-center justify-between gap-x-3">
      <h3 class="text-subheading text-highlighted" data-testid="sd-grades-heading">
        Taburan Gred (Anggaran)
      </h3>
      <UButton
        :to="PATHS.school"
        color="primary"
        variant="link"
        label="Lihat penuh →"
        data-testid="sd-grades-full"
      />
    </div>
    <DsChart
      v-if="distribution.length > 0"
      type="bar"
      horizontal
      height="lg"
      title="Bilangan rekod mengikut gred"
      table-label="Taburan gred"
      :labels="labels"
      :series="series"
      data-testid="sd-grades-chart"
    />
    <p class="text-end text-caption text-muted" data-testid="sd-grades-total">
      Jumlah: {{ count(total) }} rekod
    </p>
  </div>
</template>
