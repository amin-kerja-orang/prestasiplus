<script setup lang="ts">
/**
 * "Pemerhatian & Insight" (FN-M12-6.9.1; FR-M12-59; BR-M12-24; DV-M12-13): three info rows (the GPS sentence is omitted
 * when the scope has no SPM history) and the disclaimer.
 */
import { AppIcon } from '@/components/icon'

import type { Results } from '../../../api/types'
import { CARD, gps, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ insights: Results['insights'] }>()
</script>

<template>
  <section class="min-w-0 space-y-3" data-testid="res-insights">
    <div :class="[CARD, 'border-l-4 !border-l-blue-500 p-4 sm:p-5']">
      <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
        <AppIcon name="fa-lightbulb" class="h-4 w-4 text-yellow-500" />Pemerhatian &amp; Insight
      </h2>
      <ul class="space-y-2 text-sm text-slate-600">
        <li class="flex items-start gap-2 rounded-lg bg-slate-50 p-3" data-testid="insight-row">
          <AppIcon name="fa-info-circle" class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />Hanya
          {{ plain(insights.active) }} daripada {{ plain(insights.t4t5) }} pelajar T4/T5 ({{
            pct(insights.pct)
          }}) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja.
        </li>
        <li class="flex items-start gap-2 rounded-lg bg-slate-50 p-3" data-testid="insight-row">
          <AppIcon name="fa-info-circle" class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />Purata
          ketepatan pelajar aktif dalam platform: {{ pct(insights.accuracy) }}. Ini bersamaan
          anggaran gred {{ insights.grade }}.
        </li>
        <li
          v-if="insights.gps !== null && insights.year !== null"
          class="flex items-start gap-2 rounded-lg bg-slate-50 p-3"
          data-testid="insight-row"
        >
          <AppIcon name="fa-info-circle" class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />GPS
          keseluruhan dari headcount (tahun {{ insights.year }}): {{ gps(insights.gps) }}. Trend
          menunjukkan peningkatan dari tahun ke tahun.
        </li>
      </ul>
    </div>
    <p
      class="flex items-start gap-1.5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-400"
      data-testid="insight-disclaimer"
    >
      <AppIcon name="fa-exclamation-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />Disclaimer: Data
      GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar.
    </p>
  </section>
</template>
