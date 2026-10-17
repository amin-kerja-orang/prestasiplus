<script setup lang="ts">
/**
 * The game bar of S13 and S14: "Skor" tile, the ring clock, "Betul" tile. S14 sets the labels in
 * capitals (`caps`).
 */
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
    <UCard :ui="{ body: 'p-3 sm:p-3' }" class="min-w-16 text-center">
      <p class="text-caption text-muted">{{ caps ? 'SKOR' : 'Skor' }}</p>
      <p class="tabular text-heading text-primary" data-testid="solo-score">{{ score }}</p>
    </UCard>
    <RingTimer :value="timeLeft" :max="max" />
    <UCard :ui="{ body: 'p-3 sm:p-3' }" class="min-w-16 text-center">
      <p class="text-caption text-muted">{{ caps ? 'BETUL' : 'Betul' }}</p>
      <p class="tabular text-heading text-success" data-testid="solo-correct">{{ correct }}</p>
    </UCard>
  </div>
</template>
