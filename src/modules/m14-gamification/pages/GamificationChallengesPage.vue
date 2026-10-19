<script setup lang="ts">
/**
 * S13 `/gamification/challenges` "Cabaran Harian" (M14-T2a; FR-M14-34, 35). Reads #7: header with the
 * "{completed}/{active}" "Selesai" counter, then one card per active challenge in the order served.
 */
import { useApi } from '@/composables'
import { DsPage, DsStatTile } from '@/ds'

import { fetchGamificationChallenges } from '../api'
import S13ChallengeCard from '../components/student-a/S13ChallengeCard.vue'

const challenges = useApi((signal) => fetchGamificationChallenges({ signal }))
</script>

<template>
  <DsPage data-testid="gamification-challenges-page">
    <UAlert
      v-if="challenges.error.value"
      color="error"
      variant="subtle"
      title="Ralat berlaku. Sila cuba lagi."
    />

    <div
      v-else-if="!challenges.data.value"
      class="flex flex-col gap-4"
      aria-busy="true"
      data-testid="s13-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <UCard data-testid="s13-hero">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted">Cabaran Harian</h1>
            <p class="text-body text-muted">
              Selesaikan cabaran untuk dapatkan syiling &amp; XP bonus!
            </p>
          </div>
          <div data-testid="s13-counter">
            <DsStatTile
              art="fire"
              :value="`${challenges.data.value.meta.completed}/${challenges.data.value.meta.active}`"
              unit="Selesai"
              data-testid="s13-counter-value"
            />
          </div>
        </div>
      </UCard>

      <div class="grid grid-cols-1 gap-4">
        <S13ChallengeCard v-for="c in challenges.data.value.data" :key="c.id" :challenge="c" />
      </div>
    </template>
  </DsPage>
</template>
