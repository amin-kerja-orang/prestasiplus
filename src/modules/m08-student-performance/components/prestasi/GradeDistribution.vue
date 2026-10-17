<script setup lang="ts">
/**
 * S1 "📈 Taburan Gred (Anggaran)" (FR-M08-15): one bar per grade (count), with each grade's count and share
 * in the list under the chart so the numbers stay readable.
 */
import { computed } from 'vue'

import { formatNumber } from '@/lib/number'
import { DsChart } from '@/ds'

import type { SchoolPerformance } from '../../api/types'
import { grouped } from '../../lib/prestasi/format'

const props = defineProps<{ distribution: SchoolPerformance['distribution'] }>()

const total = computed(() => props.distribution.reduce((sum, d) => sum + d.count, 0))
const labels = computed(() => props.distribution.map((d) => d.grade))
const series = computed(() => [
  { label: 'Bilangan', data: props.distribution.map((d) => d.count), slot: 1 },
])
</script>

<template>
  <UCard class="lg:col-span-2" data-testid="grade-card">
    <div class="flex flex-col gap-4">
      <DsChart
        title="📈 Taburan Gred (Anggaran)"
        :level="2"
        :labels="labels"
        :series="series"
        table-label="Taburan gred anggaran"
      />
      <ul class="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5" aria-label="Butiran taburan gred">
        <li
          v-for="d in distribution"
          :key="d.grade"
          class="flex items-baseline justify-between gap-2 text-caption"
          :data-testid="`grade-row-${d.grade}`"
        >
          <span class="text-label text-highlighted">{{ d.grade }}</span>
          <span class="tabular text-muted"
            >{{ grouped(d.count) }} · {{ formatNumber(d.pct, { decimals: 1 }) }}%</span
          >
        </li>
      </ul>
      <p class="text-end text-caption text-muted" data-testid="grade-total">
        Jumlah: {{ grouped(total) }} rekod
      </p>
    </div>
  </UCard>
</template>
