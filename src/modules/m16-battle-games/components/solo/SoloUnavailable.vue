<script setup lang="ts">
/**
 * Interim notice (D58, issue #78) shown instead of a single-player game in http mode, until the engines
 * call `POST /games/solo/{game}/check` and `/games/solo/kad-memori/reveal`. A route with `meta.ownsH1`
 * has no shell h1, so this page renders its own.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsEmptyState, DsPage } from '@/ds'

const route = useRoute()
const showH1 = computed(() => route.meta.ownsH1 === true)
const gameTitle = computed(() => route.meta.header?.title ?? '')
</script>

<template>
  <DsPage data-testid="solo-unavailable-page">
    <div class="flex flex-col items-start gap-1">
      <UButton to="/permainan" color="neutral" variant="ghost" icon="i-ph-arrow-left" class="min-h-11">
        Permainan
      </UButton>
      <h1 v-if="showH1" class="text-title text-highlighted">{{ gameTitle }}</h1>
    </div>
    <DsEmptyState
      title="Permainan ini belum tersedia dalam demo"
      description="Sila cuba permainan lain di halaman Permainan."
      icon="game-controller"
      data-testid="solo-unavailable"
    />
  </DsPage>
</template>
