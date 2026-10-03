<script setup lang="ts">
/** S11 "Cabaran Hari Ini" (FN-M14-2.1.6; FR-M14-18): the first 4 active challenges, "Lihat semua →". */
import { Target } from '@lucide/vue'

import { AppIcon } from '@/components/icon'

import type { ChallengeProgress } from '../../api'
import { gamClampPct, gamDifficultyClass, gamDifficultyLabel } from '../../lib/student/s11-format'

defineProps<{ challenges: readonly ChallengeProgress[] }>()
</script>

<template>
  <section
    class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5 lg:col-span-2"
    data-testid="s11-challenges"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 font-heading text-lg font-semibold">
        <Target class="h-5 w-5 text-red-500" />Cabaran Hari Ini
      </h2>
      <RouterLink
        to="/gamification/challenges"
        class="inline-flex min-h-11 items-center text-xs font-medium text-blue-600 hover:underline"
        data-testid="s11-challenges-all"
        >Lihat semua →</RouterLink
      >
    </div>
    <div class="mt-2 space-y-3">
      <div
        v-for="c in challenges"
        :key="c.id"
        class="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3"
        data-testid="s11-challenge"
      >
        <span class="w-8 shrink-0 text-center text-2xl"><AppIcon :name="c.icon" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-slate-800">{{ c.title }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
              :class="gamDifficultyClass(c.difficulty)"
              data-testid="s11-challenge-difficulty"
              >{{ gamDifficultyLabel(c.difficulty) }}</span
            >
          </div>
          <p class="text-sm text-slate-500">{{ c.description }}</p>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-blue-500"
              :style="{ width: `${gamClampPct(c.pct)}%` }"
            />
          </div>
          <div class="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span data-testid="s11-challenge-progress">{{ c.progress }}/{{ c.target }}</span>
            <span class="font-semibold text-amber-600" data-testid="s11-challenge-reward"
              >+{{ c.rewardSyiling }} 💰</span
            >
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
