<script setup lang="ts">
/**
 * S11 `/gamification` "Gamifikasi Dashboard" (M14-T2a; FR-M14-14…22, BR-M14-05…09). Reads #3 once;
 * shell header and tab title come from the route meta (DV-M14-01). v2 look: DS composites only.
 */
import { DsCharacterCard, DsPage, DsStack, DsGrid, DsCluster, DsText } from '@/ds'
import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchGamificationDashboard } from '../api'
import S11ChallengesCard from '../components/student-a/S11ChallengesCard.vue'
import S11Hero from '../components/student-a/S11Hero.vue'
import S11MasteryCard from '../components/student-a/S11MasteryCard.vue'
import S11RecentCard from '../components/student-a/S11RecentCard.vue'
import WalletTiles from '../components/student-a/WalletTiles.vue'
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

    <DsStack v-else-if="!dashboard.data.value" aria-busy="true" data-testid="s11-loading">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-40 w-full" />
    </DsStack>

    <template v-else>
      <S11Hero :wallet="dashboard.data.value.wallet" />
      <WalletTiles :wallet="dashboard.data.value.wallet" />

      <DsGrid :cols="{ base: 1, lg: 3 }" align="start">
        <S11ChallengesCard :challenges="dashboard.data.value.challenges.slice(0, 4)" />
        <S11RecentCard :rows="dashboard.data.value.recent.slice(0, 6)" />
      </DsGrid>

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
        accent="win"
        icon="medal"
        title="Gelaran Seterusnya"
        data-testid="s11-next-title"
      >
        <DsCluster :wrap="false">
          <DsText variant="title" as="span" aria-hidden="true">{{
            dashboard.data.value.wallet.nextTitle.emoji
          }}</DsText>
          <DsStack gap="none">
            <DsText variant="label" as="p" tone="highlighted">
              {{ dashboard.data.value.wallet.nextTitle.name }}
            </DsText>
            <DsText variant="caption" data-testid="s11-next-title-need">
              Perlu {{ formatCount(dashboard.data.value.wallet.nextTitle.need) }} syiling lagi untuk
              gelaran ini
            </DsText>
          </DsStack>
        </DsCluster>
      </DsCharacterCard>

      <RouterLink to="/gamification/kad-kongsi" class="block min-h-11" data-testid="s11-share-link">
        <DsCharacterCard
          accent="friend"
          icon="share-network"
          title="Kad Kongsi"
          description="Kongsi pencapaian anda di WhatsApp!"
        />
      </RouterLink>
    </template>
  </DsPage>
</template>
