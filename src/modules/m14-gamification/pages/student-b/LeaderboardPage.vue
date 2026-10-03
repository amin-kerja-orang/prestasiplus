<script setup lang="ts">
/**
 * S14 `/gamification/leaderboard` "Papan Pendahulu" (M14-T2b; FR-M14-40..43, BR-M14-17;
 * FN-M14-5.1.*). Hero, the podium (silver, gold raised, bronze) and rows #4–#50 of the all-time
 * ranking by lifetime syiling. `?period=` is ignored; there is no own-rank card and no period
 * filter (as live). The podium cards stay inside the viewport at 320–1280 (DV-M14-07).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchGamificationLeaderboard } from '../../api'
import LeaderboardPodium from '../../components/student-b/LeaderboardPodium.vue'
import LeaderboardRows from '../../components/student-b/LeaderboardRows.vue'
import StudentBLoadState from '../../components/student-b/StudentBLoadState.vue'
import { LEADERBOARD_COPY } from '../../lib/student/leaderboard-lib'

const { data, error, reload } = useApi((signal) => fetchGamificationLeaderboard({ signal }))

const loaded = computed(() => data.value !== null)
</script>

<template>
  <div class="space-y-5" data-testid="leaderboard-page">
    <section
      class="rounded-2xl bg-linear-to-br from-violet-600 to-purple-400 px-5 py-5 text-white shadow-lg"
      data-testid="leaderboard-hero"
    >
      <h1 class="font-heading text-2xl font-bold text-white">{{ LEADERBOARD_COPY.title }}</h1>
      <p class="mt-1 text-sm text-white/90">{{ LEADERBOARD_COPY.subtitle }}</p>
    </section>

    <template v-if="loaded && data">
      <LeaderboardPodium v-if="data.podium.length > 0" :podium="data.podium" />
      <LeaderboardRows :rows="data.rows" />
    </template>
    <StudentBLoadState
      v-else
      :error="error !== null"
      :message="LEADERBOARD_COPY.loadError"
      :retry-label="LEADERBOARD_COPY.retry"
      test-key="leaderboard"
      @retry="reload()"
    />
  </div>
</template>
