<script setup lang="ts">
/**
 * S13 `/gamification/challenges` "Cabaran Harian" (M14-T2a; FR-M14-34, 35). Reads #7: header with the
 * "{completed}/{active}" "Selesai" counter, then one card per active challenge in the order served.
 */
import { Target } from '@lucide/vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchGamificationChallenges } from '../api'
import S13ChallengeCard from '../components/student-a/S13ChallengeCard.vue'

const challenges = useApi((signal) => fetchGamificationChallenges({ signal }))
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="gamification-challenges-page">
    <AlertBox v-if="challenges.error.value" messages="Ralat berlaku. Sila cuba lagi." />

    <div
      v-else-if="!challenges.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="s13-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <template v-else>
      <section
        class="gam-hero flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-3xl bg-linear-to-br from-red-600 to-amber-500 p-4 text-white shadow-lg sm:p-6"
        data-testid="s13-hero"
      >
        <div class="min-w-0">
          <h1 class="flex items-center gap-2 font-heading text-2xl font-bold text-white">
            <Target class="h-6 w-6" />Cabaran Harian
          </h1>
          <p class="mt-1 text-sm text-white">
            Selesaikan cabaran untuk dapatkan syiling &amp; XP bonus!
          </p>
        </div>
        <div
          class="shrink-0 rounded-xl bg-white/20 px-4 py-2 text-center"
          data-testid="s13-counter"
        >
          <p class="text-xl font-bold text-white" data-testid="s13-counter-value">
            {{ challenges.data.value.meta.completed }}/{{ challenges.data.value.meta.active }}
          </p>
          <p class="text-xs text-white">Selesai</p>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-4">
        <S13ChallengeCard v-for="c in challenges.data.value.data" :key="c.id" :challenge="c" />
      </div>
    </template>
  </div>
</template>
