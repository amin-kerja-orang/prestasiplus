<script setup lang="ts">
/** S11 "Tahap Penguasaan Subjek" (FN-M14-2.1.8; FR-M14-20): read-only M05 mastery rows. */
import { Layers } from '@lucide/vue'

import type { DashboardMastery } from '../../api'
import { gamClampPct, gamStageLabel, gamTrimNumber } from '../../lib/student/s11-format'

defineProps<{ rows: readonly DashboardMastery[] }>()

const barPct = (r: DashboardMastery) =>
  r.nextTarget === null ? 100 : r.nextTarget > 0 ? gamClampPct((r.correct / r.nextTarget) * 100) : 0
const isActive = (r: DashboardMastery) => gamStageLabel(r.stage) === 'Aktif'
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="s11-mastery">
    <h2 class="flex items-center gap-2 font-heading text-lg font-semibold">
      <Layers class="h-5 w-5 text-emerald-500" />Tahap Penguasaan Subjek
    </h2>
    <div class="mt-3 space-y-3">
      <div
        v-for="(r, i) in rows"
        :key="`${r.subjectName}-${i}`"
        class="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3"
        data-testid="s11-mastery-row"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          :class="isActive(r) ? 'bg-blue-500' : 'bg-amber-500'"
          >L{{ r.level }}</span
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0 truncate text-sm font-semibold text-slate-800">{{
              r.subjectName
            }}</span>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="isActive(r) ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'"
              >{{ gamStageLabel(r.stage) }}</span
            >
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              class="h-full rounded-full"
              :class="isActive(r) ? 'bg-blue-500' : 'bg-amber-500'"
              :style="{ width: `${barPct(r)}%` }"
            />
          </div>
          <div
            class="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-xs text-slate-400"
          >
            <span data-testid="s11-mastery-correct"
              >{{ r.correct }} betul<template v-if="r.nextTarget !== null">
                / {{ r.nextTarget }}</template
              ></span
            >
            <span data-testid="s11-mastery-accuracy"
              >{{ gamTrimNumber(r.accuracy) }}% tepat<template v-if="r.multiplier > 1">
                · {{ r.multiplier }}x bonus</template
              ></span
            >
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
