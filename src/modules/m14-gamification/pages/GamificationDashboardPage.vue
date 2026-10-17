<script setup lang="ts">
/**
 * S11 `/gamification` "Gamifikasi Dashboard" (M14-T2a; FR-M14-14…22, BR-M14-05…09). Reads #3 once;
 * shell header and tab title come from the route meta (DV-M14-01). v2 look: DS composites only.
 */
import { DsCharacterCard, DsPage } from '@/ds'
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
  <DsPage data-testid="gamification-dashboard-page">
    <UAlert
      v-if="dashboard.error.value"
      color="error"
      variant="subtle"
      title="Ralat berlaku. Sila cuba lagi."
    />

    <div
      v-else-if="!dashboard.data.value"
      class="flex flex-col gap-4"
      aria-busy="true"
      data-testid="s11-loading"
    >
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else>
      <S11Hero :wallet="dashboard.data.value.wallet" />
      <S11StatCards :wallet="dashboard.data.value.wallet" />

      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
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

      <DsCharacterCard
        v-if="dashboard.data.value.wallet.nextTitle"
        variant="win"
        icon="i-ph-medal-duotone"
        title="Gelaran Seterusnya"
        data-testid="s11-next-title"
      >
        <div class="flex items-center gap-3">
          <span class="text-title" aria-hidden="true">{{
            dashboard.data.value.wallet.nextTitle.emoji
          }}</span>
          <div class="flex min-w-0 flex-col">
            <p class="text-label text-highlighted">
              {{ dashboard.data.value.wallet.nextTitle.name }}
            </p>
            <p class="text-caption text-muted" data-testid="s11-next-title-need">
              Perlu {{ formatCount(dashboard.data.value.wallet.nextTitle.need) }} syiling lagi untuk
              gelaran ini
            </p>
          </div>
        </div>
      </DsCharacterCard>

      <RouterLink to="/gamification/kad-kongsi" class="block min-h-11" data-testid="s11-share-link">
        <DsCharacterCard
          variant="info"
          icon="i-ph-share-network-duotone"
          title="Kad Kongsi"
          description="Kongsi pencapaian anda di WhatsApp!"
        />
      </RouterLink>
    </template>
  </DsPage>
</template>
