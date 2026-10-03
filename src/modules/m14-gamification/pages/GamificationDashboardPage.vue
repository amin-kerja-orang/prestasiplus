<script setup lang="ts">
/**
 * S11 `/gamification` "Gamifikasi Dashboard" (M14-T2a; FR-M14-14…22, BR-M14-05…09). Reads #3 once;
 * shell header and tab title come from the route meta (DV-M14-01).
 */
import { Medal, Share2 } from '@lucide/vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchGamificationDashboard } from '../api'
import S11ChallengesCard from '../components/student-a/S11ChallengesCard.vue'
import S11Hero from '../components/student-a/S11Hero.vue'
import S11MasteryCard from '../components/student-a/S11MasteryCard.vue'
import S11RecentCard from '../components/student-a/S11RecentCard.vue'
import S11StatCards from '../components/student-a/S11StatCards.vue'
import S11TierSystem from '../components/student-a/S11TierSystem.vue'

const dashboard = useApi((signal) => fetchGamificationDashboard({ signal }))
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="gamification-dashboard-page">
    <AlertBox v-if="dashboard.error.value" messages="Ralat berlaku. Sila cuba lagi." />

    <div
      v-else-if="!dashboard.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="s11-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <template v-else>
      <S11Hero :wallet="dashboard.data.value.wallet" />
      <S11StatCards :wallet="dashboard.data.value.wallet" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <S11ChallengesCard :challenges="dashboard.data.value.challenges.slice(0, 4)" />
        <S11RecentCard :rows="dashboard.data.value.recent.slice(0, 6)" />
      </div>

      <S11MasteryCard
        v-if="dashboard.data.value.mastery.length"
        :rows="dashboard.data.value.mastery"
      />
      <S11TierSystem
        :tiers="dashboard.data.value.tiers"
        :current-key="dashboard.data.value.wallet.tier.key"
      />

      <section
        v-if="dashboard.data.value.wallet.nextTitle"
        class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5"
        data-testid="s11-next-title"
      >
        <h2 class="flex items-center gap-2 font-heading text-lg font-semibold">
          <Medal class="h-5 w-5 text-purple-500" />Gelaran Seterusnya
        </h2>
        <div class="mt-3 flex items-center gap-3 rounded-xl bg-green-50 p-3">
          <span class="text-3xl">{{ dashboard.data.value.wallet.nextTitle.emoji }}</span>
          <div class="min-w-0">
            <p class="font-semibold text-green-700">
              {{ dashboard.data.value.wallet.nextTitle.name }}
            </p>
            <p class="text-sm text-slate-600" data-testid="s11-next-title-need">
              Perlu {{ formatCount(dashboard.data.value.wallet.nextTitle.need) }} syiling lagi untuk
              gelaran ini
            </p>
          </div>
        </div>
      </section>

      <RouterLink
        to="/gamification/kad-kongsi"
        class="flex min-h-11 items-center gap-3 rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-100 p-4 shadow-sm"
        data-testid="s11-share-link"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white"
          ><Share2 class="h-5 w-5"
        /></span>
        <span class="min-w-0 flex-1">
          <span class="block font-semibold text-purple-800">Kad Kongsi</span>
          <span class="block text-sm text-purple-700">Kongsi pencapaian anda di WhatsApp!</span>
        </span>
        <span class="text-indigo-400">→</span>
      </RouterLink>
    </template>
  </div>
</template>
