<script setup lang="ts">
/** S11 "Cabaran Hari Ini" (FN-M14-2.1.6; FR-M14-18): the first 4 active challenges, "Lihat semua →". */
import { DsIconChip, DsRewardChip, DsStack, DsCluster, DsText } from '@/ds'

import type { ChallengeProgress } from '../../api'
import { gamClampPct, gamDifficultyLabel } from '../../lib/student/s11-format'
import { difficultyColor } from './difficulty'

defineProps<{ challenges: readonly ChallengeProgress[] }>()
</script>

<template>
  <UCard class="min-w-0 lg:col-span-2" data-testid="s11-challenges">
    <DsStack gap="sm">
      <DsCluster justify="between" :wrap="false">
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
      </DsCluster>
      <DsStack as="ul" gap="xs">
        <li
          v-for="c in challenges"
          :key="c.id"
          class="flex min-w-0 flex-col gap-2 rounded-card bg-elevated p-3"
          data-testid="s11-challenge"
        >
          <DsCluster gap="xs">
            <DsText variant="label" tone="highlighted">{{ c.title }}</DsText>
            <UBadge
              :color="difficultyColor(c.difficulty)"
              variant="subtle"
              size="sm"
              class="uppercase"
              data-testid="s11-challenge-difficulty"
              >{{ gamDifficultyLabel(c.difficulty) }}</UBadge
            >
          </DsCluster>
          <DsText variant="caption">{{ c.description }}</DsText>
          <UProgress
            :model-value="gamClampPct(c.pct)"
            :max="100"
            size="sm"
            :aria-label="`Progres ${c.title}`"
            :data-value="gamClampPct(c.pct)"
          />
          <DsCluster gap="xs" justify="between" :wrap="false">
            <DsText variant="caption" as="span" tabular data-testid="s11-challenge-progress"
              >{{ c.progress }}/{{ c.target }}</DsText
            >
            <DsRewardChip
              art="coin"
              :value="`+${c.rewardSyiling}`"
              data-testid="s11-challenge-reward"
            />
          </DsCluster>
        </li>
      </DsStack>
    </DsStack>
  </UCard>
</template>
