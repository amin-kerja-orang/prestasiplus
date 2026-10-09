<script setup lang="ts">
/**
 * S6 `/permainan` "Zona Permainan" (SRS M16 v1.6 FR-M16-51..53; URS FT-M16-4.1; M16-T4a). The hero, the
 * open-rooms strip and the 18 cards of discovery A.3 from `GET /api/games/hub` (#22). Every card and
 * button links to its real route (D21 reach rule).
 */
import { computed } from 'vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchGamesHub } from '../api'
import GameCard from '../components/hub/GameCard.vue'
import { HUB_CARDS, HUB_HEADING, HUB_INTRO } from '../components/hub/hub-cards'
import OpenRoomsStrip from '../components/hub/OpenRoomsStrip.vue'
import { LOAD_ERROR } from '../components/lobby/lobby-config'

const { data: hub, error } = useApi((signal) => fetchGamesHub({ signal }))

const loading = computed(() => hub.value === null && error.value === null)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4 sm:space-y-6" data-testid="hub-page">
    <div v-if="loading" class="flex justify-center py-16 text-indigo-500" data-testid="hub-loading">
      <LoadingSpinner :size="32" />
    </div>
    <AlertBox v-else-if="error" :messages="LOAD_ERROR" data-testid="hub-error" />
    <template v-else-if="hub">
      <header
        class="relative overflow-hidden rounded-2xl bg-linear-to-r from-indigo-500 via-purple-500 to-fuchsia-300 p-5 text-white shadow-lg sm:p-6"
      >
        <h1 class="font-heading text-2xl font-bold sm:text-3xl" data-testid="hub-h1">
          {{ HUB_HEADING }}
        </h1>
        <p class="mt-1 max-w-xl text-sm sm:text-base">{{ HUB_INTRO }}</p>
        <span
          class="pointer-events-none absolute top-1/2 right-6 hidden -translate-y-1/2 text-7xl opacity-20 select-none sm:block sm:text-8xl"
          >🎮</span
        >
      </header>

      <OpenRoomsStrip :rooms="hub.openRooms" />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="hub-grid">
        <GameCard v-for="card in HUB_CARDS" :key="card.id" :card="card" :chips="hub.chips" />
      </div>
    </template>
  </div>
</template>
