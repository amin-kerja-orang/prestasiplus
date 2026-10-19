<script setup lang="ts">
/** S11 "Cabaran Hari Ini" (FN-M14-2.1.6; FR-M14-18): the first 4 active challenges, "Lihat semua →". */
import { DsIconChip, DsRewardChip } from '@/ds'

import type { ChallengeProgress } from '../../api'
import { gamClampPct, gamDifficultyLabel } from '../../lib/student/s11-format'
import { difficultyColor } from './difficulty'

defineProps<{ challenges: readonly ChallengeProgress[] }>()
</script>

<template>
  <UCard class="min-w-0 lg:col-span-2" data-testid="s11-challenges">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
          <DsIconChip icon="target" accent="heat" size="sm" />Cabaran Hari Ini
        </h2>
        <UButton
          to="/gamification/challenges"
          variant="link"
          size="sm"
          class="min-h-11"
          data-testid="s11-challenges-all"
          >Lihat semua →</UButton
        >
      </div>
      <ul class="flex flex-col gap-2">
        <li
          v-for="c in challenges"
          :key="c.id"
          class="flex min-w-0 flex-col gap-2 rounded-card bg-elevated p-3"
          data-testid="s11-challenge"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-label text-highlighted">{{ c.title }}</span>
            <UBadge
              :color="difficultyColor(c.difficulty)"
              variant="subtle"
              size="sm"
              class="uppercase"
              data-testid="s11-challenge-difficulty"
              >{{ gamDifficultyLabel(c.difficulty) }}</UBadge
            >
          </div>
          <p class="text-caption text-muted">{{ c.description }}</p>
          <UProgress
            :model-value="gamClampPct(c.pct)"
            :max="100"
            size="sm"
            :aria-label="`Progres ${c.title}`"
            :data-value="gamClampPct(c.pct)"
          />
          <div class="flex items-center justify-between gap-2">
            <span class="tabular text-caption text-muted" data-testid="s11-challenge-progress"
              >{{ c.progress }}/{{ c.target }}</span
            >
            <DsRewardChip art="coin" :value="`+${c.rewardSyiling}`" data-testid="s11-challenge-reward" />
          </div>
        </li>
      </ul>
    </div>
  </UCard>
</template>
