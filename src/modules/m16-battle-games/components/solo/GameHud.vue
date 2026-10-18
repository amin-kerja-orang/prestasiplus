<script setup lang="ts">
/**
 * The game bar of S13 and S14: "Skor" tile, the ring clock, "Betul" tile. S14 sets the labels in
 * capitals (`caps`).
 */
import { DsStatTile } from '@/ds'

import RingTimer from './RingTimer.vue'

withDefaults(
  defineProps<{
    score: number
    timeLeft: number
    max: number
    correct: number
    caps?: boolean
  }>(),
  { caps: false },
)
</script>

<template>
  <div class="flex items-center justify-between gap-3" data-testid="solo-bar">
    <DsStatTile
      class="min-w-24 flex-1"
      icon="trophy"
      accent="win"
      :value="score"
      :unit="caps ? 'SKOR' : 'Skor'"
      value-class="text-primary"
      value-testid="solo-score"
    />
    <RingTimer :value="timeLeft" :max="max" />
    <DsStatTile
      class="min-w-24 flex-1"
      icon="check-circle"
      accent="friend"
      :value="correct"
      :unit="caps ? 'BETUL' : 'Betul'"
      value-class="text-success"
      value-testid="solo-correct"
    />
  </div>
</template>
