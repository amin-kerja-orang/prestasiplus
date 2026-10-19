<script setup lang="ts">
/**
 * S6 `/permainan` "Zona Permainan" (SRS M16 v1.6 FR-M16-51..53; URS FT-M16-4.1; M16-T4a). The hero, the
 * open-rooms strip and the 18 cards of discovery A.3 from `GET /api/games/hub` (#22). Every card and
 * button links to its real route (D21 reach rule).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsArt3D, DsPage, DsStack, DsCluster, DsGrid, DsHeading, DsText } from '@/ds'

import { fetchGamesHub } from '../api'
import GameCard from '../components/hub/GameCard.vue'
import { HUB_CARDS, HUB_HEADING, HUB_INTRO } from '../components/hub/hub-cards'
import OpenRoomsStrip from '../components/hub/OpenRoomsStrip.vue'
import { LOAD_ERROR } from '../components/lobby/lobby-config'

const { data: hub, error } = useApi((signal) => fetchGamesHub({ signal }))

const loading = computed(() => hub.value === null && error.value === null)
</script>

<template>
  <DsPage data-testid="hub-page">
    <DsStack v-if="loading" aria-busy="true" data-testid="hub-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-28 w-full" />
    </DsStack>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="LOAD_ERROR"
      data-testid="hub-error"
    />
    <template v-else-if="hub">
      <UCard>
        <DsCluster gap="md" justify="between" :wrap="false">
          <DsStack gap="2xs">
            <DsHeading :level="1" data-testid="hub-h1">{{ HUB_HEADING }}</DsHeading>
            <DsText variant="body" tone="muted" class="max-w-prose">{{ HUB_INTRO }}</DsText>
          </DsStack>
          <DsArt3D name="trophy" size="hero" float class="hidden sm:block" />
        </DsCluster>
      </UCard>

      <OpenRoomsStrip :rooms="hub.openRooms" />

      <DsGrid :cols="{ base: 1, sm: 2, lg: 3 }" data-testid="hub-grid">
        <GameCard v-for="card in HUB_CARDS" :key="card.id" :card="card" :chips="hub.chips" />
      </DsGrid>
    </template>
  </DsPage>
</template>
