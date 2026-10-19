<script setup lang="ts">
/**
 * S6 `/permainan` "Zona Permainan" (SRS M16 v1.6 FR-M16-51..53; URS FT-M16-4.1; M16-T4a). The hero, the
 * open-rooms strip and the 18 cards of discovery A.3 from `GET /api/games/hub` (#22). Every card and
 * button links to its real route (D21 reach rule).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsArt3D, DsPage } from '@/ds'

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
    <div v-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="hub-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-28 w-full" />
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="LOAD_ERROR"
      data-testid="hub-error"
    />
    <template v-else-if="hub">
      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted" data-testid="hub-h1">{{ HUB_HEADING }}</h1>
            <p class="max-w-prose text-body text-muted">{{ HUB_INTRO }}</p>
          </div>
          <DsArt3D name="trophy" size="hero" float class="hidden sm:block" />
        </div>
      </UCard>

      <OpenRoomsStrip :rooms="hub.openRooms" />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="hub-grid">
        <GameCard v-for="card in HUB_CARDS" :key="card.id" :card="card" :chips="hub.chips" />
      </div>
    </template>
  </DsPage>
</template>
