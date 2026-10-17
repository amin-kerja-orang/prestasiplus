<script setup lang="ts">
/**
 * S13 challenge card (FN-M14-4.1.2; FR-M14-35): icon, title, difficulty badge, description,
 * "💰 +n Syiling", "⭐ +n XP", "Progres: p/t", bar and "{pct}%". A completed card keeps the layout:
 * full bar, "✅" before the title (SRS §8.2, PROPOSED), done state in the success colour.
 */
import { DsIconChip, DsRewardChip } from '@/ds'

import type { ChallengeProgress } from '../../api'
import { gamClampPct, gamDifficultyLabel } from '../../lib/student/s11-format'
import { difficultyColor } from './difficulty'

defineProps<{ challenge: ChallengeProgress }>()
</script>

<template>
  <UCard
    :class="challenge.completed ? 'bg-success/12' : ''"
    :data-completed="challenge.completed ? 'true' : 'false'"
    data-testid="s13-card"
  >
    <div class="flex items-start gap-3 sm:gap-4">
      <DsIconChip
        :icon="challenge.completed ? 'i-ph-check-circle-duotone' : 'i-ph-target-duotone'"
        :accent="challenge.completed ? 'win' : 'heat'"
        size="lg"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-display text-subheading font-bold text-highlighted" data-testid="s13-title">
            <template v-if="challenge.completed">✅ </template>{{ challenge.title }}
          </h3>
          <UBadge
            :color="difficultyColor(challenge.difficulty)"
            variant="subtle"
            size="sm"
            class="uppercase"
            data-testid="s13-difficulty"
            >{{ gamDifficultyLabel(challenge.difficulty) }}</UBadge
          >
        </div>
        <p class="text-label text-muted">{{ challenge.description }}</p>
        <div class="flex flex-wrap gap-2">
          <DsRewardChip
            art="coin"
            :value="`+${challenge.rewardSyiling}`"
            label="Syiling"
            data-testid="s13-reward-syiling"
          />
          <DsRewardChip
            icon="i-ph-star-duotone"
            :value="`+${challenge.rewardXp}`"
            label="XP"
            data-testid="s13-reward-xp"
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="tabular text-label text-toned" data-testid="s13-progress"
            >Progres: {{ challenge.progress }}/{{ challenge.target }}</span
          >
          <span class="tabular text-label text-success" data-testid="s13-pct"
            >{{ Math.round(gamClampPct(challenge.pct)) }}%</span
          >
        </div>
        <UProgress
          :model-value="challenge.completed ? 100 : gamClampPct(challenge.pct)"
          :max="100"
          :color="challenge.completed ? 'success' : 'primary'"
          :aria-label="`Progres ${challenge.title}`"
          :data-value="challenge.completed ? 100 : gamClampPct(challenge.pct)"
          data-testid="s13-bar"
        />
      </div>
    </div>
  </UCard>
</template>
