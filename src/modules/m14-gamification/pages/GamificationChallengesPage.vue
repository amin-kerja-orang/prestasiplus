<script setup lang="ts">
/**
 * S13 `/gamification/challenges` "Cabaran Harian" (M14-T2a; FR-M14-34, 35). Reads #7: header with the
 * "{completed}/{active}" "Selesai" counter, then one card per active challenge in the order served.
 */
import { useApi } from '@/composables'
import { DsPage, DsStatTile, DsStack, DsCluster, DsGrid, DsHeading, DsText } from '@/ds'

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

    <DsStack v-else-if="!challenges.data.value" aria-busy="true" data-testid="s13-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-32 w-full" />
    </DsStack>

    <template v-else>
      <UCard data-testid="s13-hero">
        <DsCluster gap="md" justify="between">
          <DsStack gap="2xs">
            <DsHeading :level="1">Cabaran Harian</DsHeading>
            <DsText variant="body" tone="muted">
              Selesaikan cabaran untuk dapatkan syiling &amp; XP bonus!
            </DsText>
          </DsStack>
          <div data-testid="s13-counter">
            <DsStatTile
              art="fire"
              :value="`${challenges.data.value.meta.completed}/${challenges.data.value.meta.active}`"
              unit="Selesai"
              data-testid="s13-counter-value"
            />
          </div>
        </DsCluster>
      </UCard>

      <DsGrid :cols="1">
        <S13ChallengeCard v-for="c in challenges.data.value.data" :key="c.id" :challenge="c" />
      </DsGrid>
    </template>
  </DsPage>
</template>
