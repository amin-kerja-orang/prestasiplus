<script setup lang="ts">
/**
 * S6 "Penguasaan Subjek" (FR-M08-40): per practised subject a tile (the first two letters of the subject
 * code in the subject colour), the name, a bar (≥ 80 #10b981, 60–79.9 #f59e0b, < 60 #ef4444; INFERRED
 * bands), "{round(x)}%" and "{n} sesi · {m} soalan"; or the empty state with "Mula Berlatih" → `/practice`.
 */
import { BookText, ChartPie, Play } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { StudentPerformance } from '../../api/types'
import { masteryTone } from '../../lib/analitik'

defineProps<{ mastery: StudentPerformance['mastery'] }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow lg:col-span-2" data-testid="mastery-card">
    <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
      <BookText class="h-5 w-5 text-indigo-500" />Penguasaan Subjek
    </h2>
    <div
      v-if="mastery.length === 0"
      class="flex flex-col items-center gap-3 py-8 text-sm text-slate-500"
      data-testid="mastery-empty"
    >
      <ChartPie class="h-8 w-8 text-slate-300" />
      <p>Belum ada data latihan.</p>
      <RouterLink
        to="/practice"
        class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        data-testid="mastery-start"
      >
        <Play class="h-4 w-4" />Mula Berlatih
      </RouterLink>
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="mastery-list">
      <div
        v-for="m in mastery"
        :key="m.subjectCode"
        class="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3"
        :data-testid="`mastery-${m.subjectCode}`"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          :style="{ backgroundColor: m.color }"
          >{{ m.subjectCode.slice(0, 2).toUpperCase() }}</span
        >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-slate-800">{{ m.subjectName }}</p>
          <div class="flex items-center gap-2">
            <div class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                :class="['h-full rounded-full', masteryTone(m.accuracy).bar]"
                :style="{ width: `${String(Math.min(m.accuracy, 100))}%` }"
              ></div>
            </div>
            <span :class="['text-xs font-bold', masteryTone(m.accuracy).text]" data-testid="pct"
              >{{ Math.round(m.accuracy) }}%</span
            >
          </div>
          <p class="text-xs text-slate-400">{{ m.sessions }} sesi · {{ m.answered }} soalan</p>
        </div>
      </div>
    </div>
  </section>
</template>
