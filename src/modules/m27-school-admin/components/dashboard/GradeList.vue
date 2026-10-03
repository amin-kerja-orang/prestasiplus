<script setup lang="ts">
/**
 * S0 "Taburan Gred (Anggaran)" sub-heading with "Lihat penuh →" (to M08 S1) and the grade list A+ … G
 * (FR-M27-36; the list is INFERRED from the M08 page, OQ-M27-11): letter, bar in the M08 grade colour, count,
 * percentage, footer "Jumlah: {n} rekod". The bar shrinks, the row never scrolls sideways.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { formatNumber } from '@/lib/number'

import type { DashboardGrade } from '../../api/dashboard'
import { count, GRADE_BAR, PATHS, ratioPct } from './dashboard-format'

const props = defineProps<{ distribution: readonly DashboardGrade[]; total: number }>()

const max = computed(() => Math.max(0, ...props.distribution.map((d) => d.count)))
</script>

<template>
  <div class="mt-4 min-w-0" data-testid="sd-grades">
    <div class="flex flex-wrap items-center justify-between gap-x-3">
      <h3 class="text-sm font-bold text-slate-700" data-testid="sd-grades-heading">
        Taburan Gred (Anggaran)
      </h3>
      <RouterLink
        :to="PATHS.school"
        class="inline-flex min-h-11 items-center text-xs font-semibold text-blue-600 hover:text-blue-700"
        data-testid="sd-grades-full"
        >Lihat penuh →</RouterLink
      >
    </div>
    <ul class="space-y-1.5">
      <li
        v-for="d in distribution"
        :key="d.grade"
        class="flex min-w-0 items-center gap-2 text-xs"
        data-testid="sd-grade-row"
      >
        <span
          class="w-7 shrink-0 text-right font-semibold text-slate-600"
          data-testid="sd-grade-letter"
          >{{ d.grade }}</span
        >
        <div class="h-5 min-w-0 flex-1">
          <div
            :class="['h-full rounded', GRADE_BAR[d.grade] ?? 'bg-slate-400']"
            :style="{ width: `${ratioPct(d.count, max)}%` }"
            data-testid="sd-grade-bar"
          ></div>
        </div>
        <span class="w-10 shrink-0 text-right text-slate-600" data-testid="sd-grade-count">{{
          count(d.count)
        }}</span>
        <span class="w-12 shrink-0 text-right text-slate-500" data-testid="sd-grade-pct"
          >{{ formatNumber(d.pct, { decimals: 1 }) }}%</span
        >
      </li>
    </ul>
    <p class="mt-3 text-right text-xs text-slate-500" data-testid="sd-grades-total">
      Jumlah: {{ count(total) }} rekod
    </p>
  </div>
</template>
