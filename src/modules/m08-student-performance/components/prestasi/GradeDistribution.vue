<script setup lang="ts">
/** S1 "📈 Taburan Gred (Anggaran)" (FR-M08-15): one bar row per grade; widths = count ÷ max count. */
import { computed } from 'vue'

import { formatNumber } from '@/lib/number'

import type { SchoolPerformance } from '../../api/types'
import { GRADE_BAR, grouped, ratioPct } from '../../lib/prestasi/format'

const props = defineProps<{ distribution: SchoolPerformance['distribution'] }>()

const max = computed(() => Math.max(0, ...props.distribution.map((d) => d.count)))
const total = computed(() => props.distribution.reduce((sum, d) => sum + d.count, 0))
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow lg:col-span-2" data-testid="grade-card">
    <h3 class="mb-4 text-base font-bold text-slate-700">📈 Taburan Gred (Anggaran)</h3>
    <ul class="space-y-1.5">
      <li
        v-for="d in distribution"
        :key="d.grade"
        class="flex items-center gap-2 text-xs"
        :data-testid="`grade-row-${d.grade}`"
      >
        <span class="w-7 shrink-0 text-right font-semibold text-slate-600">{{ d.grade }}</span>
        <div class="h-5 min-w-0 flex-1">
          <div
            :class="['h-full rounded', GRADE_BAR[d.grade]]"
            :style="{ width: `${ratioPct(d.count, max)}%` }"
          ></div>
        </div>
        <span class="w-9 shrink-0 text-right text-slate-600">{{ grouped(d.count) }}</span>
        <span class="w-12 shrink-0 text-right text-slate-400"
          >{{ formatNumber(d.pct, { decimals: 1 }) }}%</span
        >
      </li>
    </ul>
    <p class="mt-3 text-right text-xs text-slate-400" data-testid="grade-total">
      Jumlah: {{ grouped(total) }} rekod
    </p>
  </section>
</template>
