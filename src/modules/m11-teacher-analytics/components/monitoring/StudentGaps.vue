<script setup lang="ts">
/**
 * S4 "Gap Analysis & Cadangan Latihan" (FN-M11-4.2.8; FR-M11-69): shown only when its tab is active;
 * gap cards by severity, "Topik Kuat" tiles, the empty state with the live copy, and "Subjek Belum
 * Dicuba" chips.
 */
import { BookOpen, CircleAlert, CircleCheck, Crosshair, Star } from '@lucide/vue'

import type { GapSeverity, StudentDetail } from '../../api/types'
import { CARD, count, pct1 } from './monitoring-format'

defineProps<{ gaps: StudentDetail['gaps'] }>()

const SEVERITY: Record<GapSeverity, { card: string; pill: string; fill: string }> = {
  Kritikal: { card: 'border-red-800/20 bg-red-800/5', pill: 'bg-red-800', fill: 'bg-red-800' },
  Lemah: { card: 'border-red-600/20 bg-red-600/5', pill: 'bg-red-600', fill: 'bg-red-600' },
  'Perlu Perhatian': {
    card: 'border-orange-600/20 bg-orange-600/5',
    pill: 'bg-orange-600',
    fill: 'bg-orange-600',
  },
}
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-panel-gaps">
    <h3 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <Crosshair class="h-5 w-5 text-indigo-600" />Gap Analysis &amp; Cadangan Latihan
    </h3>
    <p class="mb-3 text-xs text-slate-500">
      Topik lemah dikesan automatik berdasarkan jawapan pelajar. Soalan latihan dicadangkan untuk
      isi gap.
    </p>

    <div v-if="gaps.items.length > 0" class="space-y-2" data-testid="mon-gap-list">
      <div
        v-for="g in gaps.items"
        :key="`${g.subjectName}-${g.group}`"
        :class="['rounded-xl border p-3', SEVERITY[g.severity].card]"
        data-testid="mon-gap-card"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold break-words text-slate-800">{{ g.group }}</p>
            <p class="text-xs text-slate-500">{{ g.subjectName }}</p>
          </div>
          <span
            :class="[
              'rounded-full px-2.5 py-0.5 text-xs font-semibold text-white',
              SEVERITY[g.severity].pill,
            ]"
            data-testid="mon-gap-severity"
            >{{ g.severity }}</span
          >
        </div>
        <div class="mt-2 flex items-center gap-2">
          <div class="h-3 min-w-0 flex-1 rounded-full bg-slate-200">
            <div
              :class="['h-3 rounded-full', SEVERITY[g.severity].fill]"
              :style="{ width: `${String(Math.max(g.pct, 3))}%` }"
            />
          </div>
          <span class="text-xs font-semibold text-slate-700">{{ pct1(g.pct) }}</span>
        </div>
        <p class="mt-1 text-xs text-slate-500">{{ count(g.correct) }}/{{ count(g.total) }} betul</p>
        <p class="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
          <BookOpen class="h-3.5 w-3.5" />{{ count(g.availableQuestions) }} soalan tersedia untuk
          latihan
        </p>
      </div>
    </div>
    <div v-else class="rounded-xl bg-green-50 p-4 text-center" data-testid="mon-gap-empty">
      <p class="flex items-center justify-center gap-2 font-semibold text-green-700">
        <CircleCheck class="h-5 w-5" />Tiada topik lemah dikesan!
      </p>
      <p class="text-sm text-green-700">
        Semua topik yang dicuba mempunyai ketepatan melebihi 60%.
      </p>
    </div>

    <div v-if="gaps.strong.length > 0" class="mt-4" data-testid="mon-gap-strong">
      <h4 class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
        <Star class="h-4 w-4 text-green-500" />Topik Kuat
      </h4>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          v-for="s in gaps.strong"
          :key="`${s.subjectName}-${s.group}`"
          class="flex items-center gap-3 rounded-xl bg-green-50 p-2.5"
          data-testid="mon-strong-tile"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white"
            >{{ Math.round(s.pct) }}%</span
          >
          <div class="min-w-0">
            <p class="text-sm font-semibold break-words text-slate-800">{{ s.group }}</p>
            <p class="text-xs text-slate-500">
              {{ s.subjectName }} · {{ count(s.answered) }} soalan
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="gaps.untried.length > 0" class="mt-4" data-testid="mon-gap-untried">
      <h4 class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
        <CircleAlert class="h-4 w-4 text-slate-400" />Subjek Belum Dicuba
      </h4>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="s in gaps.untried"
          :key="s"
          class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
          data-testid="mon-untried-chip"
          >{{ s }}</span
        >
      </div>
    </div>
  </section>
</template>
