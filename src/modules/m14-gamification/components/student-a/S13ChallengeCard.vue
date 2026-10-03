<script setup lang="ts">
/**
 * S13 challenge card (FN-M14-4.1.2; FR-M14-35): icon, title, difficulty badge, description,
 * "💰 +n Syiling", "⭐ +n XP", "Progres: p/t", bar and "{pct}%". A completed card keeps the layout:
 * full emerald bar, "✅" before the title, emerald-300 border (SRS §8.2, PROPOSED).
 */
import { AppIcon } from '@/components/icon'

import type { ChallengeProgress } from '../../api'
import { gamClampPct, gamDifficultyClass, gamDifficultyLabel } from '../../lib/student/s11-format'

defineProps<{ challenge: ChallengeProgress }>()
</script>

<template>
  <article
    class="min-w-0 rounded-2xl border-2 bg-white p-4 shadow sm:p-5"
    :class="challenge.completed ? 'border-emerald-300' : 'border-transparent'"
    :data-completed="challenge.completed ? 'true' : 'false'"
    data-testid="s13-card"
  >
    <div class="flex items-start gap-3 sm:gap-4">
      <span class="w-10 shrink-0 text-center text-3xl"><AppIcon :name="challenge.icon" /></span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-heading text-base font-bold text-slate-800" data-testid="s13-title">
            <template v-if="challenge.completed">✅ </template>{{ challenge.title }}
          </h3>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
            :class="gamDifficultyClass(challenge.difficulty)"
            data-testid="s13-difficulty"
            >{{ gamDifficultyLabel(challenge.difficulty) }}</span
          >
        </div>
        <p class="mt-1 text-sm text-slate-500">{{ challenge.description }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span
            class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
            data-testid="s13-reward-syiling"
            >💰 +{{ challenge.rewardSyiling }} Syiling</span
          >
          <span
            class="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700"
            data-testid="s13-reward-xp"
            >⭐ +{{ challenge.rewardXp }} XP</span
          >
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 text-sm">
          <span class="font-medium text-slate-600" data-testid="s13-progress"
            >Progres: {{ challenge.progress }}/{{ challenge.target }}</span
          >
          <span class="font-semibold text-emerald-500" data-testid="s13-pct"
            >{{ Math.round(gamClampPct(challenge.pct)) }}%</span
          >
        </div>
        <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            class="h-full rounded-full"
            :class="challenge.completed ? 'bg-emerald-500' : 'bg-blue-500'"
            :style="{ width: `${challenge.completed ? 100 : gamClampPct(challenge.pct)}%` }"
            data-testid="s13-bar"
          />
        </div>
      </div>
    </div>
  </article>
</template>
