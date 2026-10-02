<script setup lang="ts">
/** S5 "📈 Headcount — Ringkasan Kelas" (discovery §2.22.2): shown only when the class has a config. */
import { RouterLink } from 'vue-router'

import type { ClassDashboard } from '../../api/types'
import { pctTrim } from '../../lib/prestasi/format'

defineProps<{ block: NonNullable<ClassDashboard['headcount']> }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="headcount-block">
    <h3 class="mb-3 text-base font-bold text-slate-800">📈 Headcount — Ringkasan Kelas</h3>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
        <p class="text-2xl font-bold text-emerald-600" data-testid="hc-on">{{ block.onTrack }}</p>
        <p class="text-sm text-emerald-700">On Track / Above</p>
      </div>
      <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
        <p class="text-2xl font-bold text-red-600" data-testid="hc-below">{{ block.below }}</p>
        <p class="text-sm text-red-700">Below Target</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center">
        <p class="text-2xl font-bold text-gray-500" data-testid="hc-none">{{ block.noData }}</p>
        <p class="text-sm text-gray-600">Tiada Data</p>
      </div>
    </div>
    <div class="mt-3 flex h-1.5 overflow-hidden rounded-full bg-slate-100" data-testid="hc-bar">
      <div class="h-1.5" :style="{ width: `${block.pct.on}%`, background: '#22c55e' }"></div>
      <div class="h-1.5" :style="{ width: `${block.pct.below}%`, background: '#ef4444' }"></div>
      <div class="h-1.5" :style="{ width: `${block.pct.none}%`, background: '#94a3b8' }"></div>
    </div>
    <div
      class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500"
    >
      <span class="flex flex-wrap gap-x-4">
        <span data-testid="hc-tov"
          >Purata TOV: {{ block.avgTov === null ? '—' : pctTrim(block.avgTov) }}</span
        >
        <span data-testid="hc-etr"
          >Purata ETR: {{ block.avgEtr === null ? '—' : pctTrim(block.avgEtr) }}</span
        >
      </span>
      <RouterLink
        :to="`/headcount/${block.configId}/summary`"
        class="inline-flex min-h-11 items-center text-blue-600"
        data-testid="hc-full"
        >Lihat Penuh →</RouterLink
      >
    </div>
  </section>
</template>
