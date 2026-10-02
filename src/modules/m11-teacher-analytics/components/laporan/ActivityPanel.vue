<script setup lang="ts">
/** FN-M11-2.2.9: "Pecahan Aktiviti ({range} Hari Lepas)", seven tiles (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-7`). */
import {
  ChartPie,
  CircleQuestionMark,
  Crosshair,
  Dumbbell,
  Gamepad2,
  ListOrdered,
  Sigma,
  Zap,
} from '@lucide/vue'
import type { Component } from 'vue'

import type { TeacherReport } from '../../api/types'
import { activityPanelTitle } from './copy'
import { grouped, type ActivityKey } from './format'

defineProps<{ activity: TeacherReport['activity']; range: number }>()

const TILES: { key: ActivityKey | 'jumlah'; label: string; icon: Component; text: string }[] = [
  { key: 'kuiz', label: 'Kuiz', icon: CircleQuestionMark, text: 'text-indigo-600' },
  { key: 'struktur', label: 'Struktur', icon: ListOrdered, text: 'text-teal-600' },
  { key: 'latihTubi', label: 'Latih Tubi', icon: Dumbbell, text: 'text-emerald-600' },
  { key: 'trackingA', label: 'Tracking A', icon: Crosshair, text: 'text-blue-600' },
  { key: 'battle', label: 'Battle', icon: Zap, text: 'text-rose-600' },
  { key: 'permainan', label: 'Permainan', icon: Gamepad2, text: 'text-amber-600' },
  { key: 'jumlah', label: 'Jumlah', icon: Sigma, text: 'text-purple-700' },
]
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow" data-testid="panel-aktiviti">
    <h4 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
      <ChartPie class="h-4 w-4 text-purple-500" />
      <span data-testid="panel-title">{{ activityPanelTitle(range) }}</span>
    </h4>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <div
        v-for="t in TILES"
        :key="t.key"
        class="min-w-0 rounded-xl border border-slate-100 p-3 text-center"
        :data-testid="`tile-${t.key}`"
      >
        <p :class="['font-heading text-xl font-bold', t.text]" data-testid="tile-value">
          {{ grouped(t.key === 'jumlah' ? activity.total : activity.byType[t.key]) }}
        </p>
        <p class="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
          <component :is="t.icon" :class="['h-3 w-3 shrink-0', t.text]" />{{ t.label }}
        </p>
      </div>
    </div>
  </section>
</template>
