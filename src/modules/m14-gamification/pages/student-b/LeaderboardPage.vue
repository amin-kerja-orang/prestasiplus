<script setup lang="ts">
/**
 * S14 `/gamification/leaderboard` "Papan Pendahulu" (M14-T2b; FR-M14-40..43, BR-M14-17;
 * FN-M14-5.1.*). Hero, the podium (silver, gold raised, bronze) and rows #4–#50 of the all-time
 * ranking by lifetime syiling. `?period=` is ignored; there is no own-rank card and no period
 * filter (as live). The podium cards stay inside the viewport at 320–1280 (DV-M14-07).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsPage, DsLoadError } from '@/ds'

import { fetchGamificationLeaderboard } from '../../api'
import LeaderboardPodium from '../../components/student-b/LeaderboardPodium.vue'
import LeaderboardRows from '../../components/student-b/LeaderboardRows.vue'
import { LEADERBOARD_COPY } from '../../lib/student/leaderboard-lib'

const { data, error, reload } = useApi((signal) => fetchGamificationLeaderboard({ signal }))

const loaded = computed(() => data.value !== null)
</script>

<template>
  <DsPage data-testid="leaderboard-page">
    <UCard data-testid="leaderboard-hero">
      <div class="flex flex-col gap-1">
        <h1 class="text-title text-highlighted">
          {{ LEADERBOARD_COPY.title }}
        </h1>
        <p class="text-body text-muted">{{ LEADERBOARD_COPY.subtitle }}</p>
      </div>
    </UCard>

    <template v-if="loaded && data">
      <LeaderboardPodium v-if="data.podium.length > 0" :podium="data.podium" />
      <LeaderboardRows :rows="data.rows" />
    </template>
    <DsLoadError
      v-else-if="error !== null"
      :message="LEADERBOARD_COPY.loadError"
      :retry-label="LEADERBOARD_COPY.retry"
      testid="leaderboard-error"
      retry-testid="leaderboard-retry"
      @retry="reload()"
    />
    <div v-else class="flex flex-col gap-3" aria-busy="true" data-testid="leaderboard-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
