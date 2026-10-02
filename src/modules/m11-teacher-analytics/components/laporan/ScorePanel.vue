<script setup lang="ts">
/**
 * FN-M11-2.2.10: "Pecahan Skor Purata", five bar cards (no Permainan, as live). "-%" is red-500 text
 * over a red-400 bar at 0%; values > 0 take the BR-M11-22 colours.
 */
import { ChartBar, CircleQuestionMark, Crosshair, Dumbbell, ListOrdered, Zap } from '@lucide/vue'
import type { Component } from 'vue'

import type { TeacherReport } from '../../api/types'
import { LAPORAN_COPY } from './copy'
import { bandOf, SCORE_BAR, SCORE_TEXT, type ScoreKey } from './format'

defineProps<{ score: TeacherReport['score'] }>()

const BARS: { key: ScoreKey; label: string; icon: Component; tint: string }[] = [
  { key: 'kuiz', label: 'Kuiz', icon: CircleQuestionMark, tint: 'text-indigo-500' },
  { key: 'struktur', label: 'Struktur', icon: ListOrdered, tint: 'text-teal-500' },
  { key: 'latihTubi', label: 'Latih Tubi', icon: Dumbbell, tint: 'text-emerald-500' },
  { key: 'trackingA', label: 'Tracking A', icon: Crosshair, tint: 'text-blue-500' },
  { key: 'battle', label: 'Battle', icon: Zap, tint: 'text-rose-500' },
]
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow" data-testid="panel-skor">
    <h4 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
      <ChartBar class="h-4 w-4 text-amber-500" />{{ LAPORAN_COPY.scoreBreakdown }}
    </h4>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div
        v-for="b in BARS"
        :key="b.key"
        class="min-w-0 rounded-xl border border-amber-100 p-3"
        :data-testid="`bar-${b.key}`"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-700">
            <component :is="b.icon" :class="['h-4 w-4 shrink-0', b.tint]" />{{ b.label }}
          </span>
          <span
            v-if="score.byType[b.key] === null"
            class="text-sm font-bold text-red-500"
            data-testid="bar-value"
            >{{ LAPORAN_COPY.noScore }}</span
          >
          <span
            v-else
            :class="['text-sm font-bold', SCORE_TEXT[bandOf(score.byType[b.key] as number)]]"
            data-testid="bar-value"
            >{{ score.byType[b.key] }}%</span
          >
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            :class="[
              'h-full rounded-full',
              score.byType[b.key] === null
                ? 'bg-red-400'
                : SCORE_BAR[bandOf(score.byType[b.key] as number)],
            ]"
            :style="{ width: `${score.byType[b.key] ?? 0}%` }"
            data-testid="bar-fill"
          />
        </div>
      </div>
    </div>
  </section>
</template>
