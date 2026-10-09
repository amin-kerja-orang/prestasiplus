<script setup lang="ts">
/**
 * The game bar of S13 and S14: "Skor" box, the ring clock, "Betul" box (glass boxes as live). S14 sets
 * the labels in capitals and a cyan ring.
 */
import RingTimer from './RingTimer.vue'

withDefaults(
  defineProps<{
    score: number
    timeLeft: number
    max: number
    correct: number
    caps?: boolean
    ring?: string
    scoreTone?: string
    correctTone?: string
  }>(),
  {
    caps: false,
    ring: 'stroke-violet-500',
    scoreTone: 'text-violet-300',
    correctTone: 'text-emerald-400',
  },
)
</script>

<template>
  <div class="mx-auto flex max-w-xl items-center justify-between gap-3" data-testid="solo-bar">
    <div class="min-w-16 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <div
        class="text-xs font-semibold text-slate-300"
        :class="caps ? 'tracking-wider uppercase' : ''"
      >
        Skor
      </div>
      <div class="text-xl font-extrabold" :class="scoreTone" data-testid="solo-score">
        {{ score }}
      </div>
    </div>
    <RingTimer :value="timeLeft" :max="max" :stroke="ring" />
    <div class="min-w-16 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <div
        class="text-xs font-semibold text-slate-300"
        :class="caps ? 'tracking-wider uppercase' : ''"
      >
        Betul
      </div>
      <div class="text-xl font-extrabold" :class="correctTone" data-testid="solo-correct">
        {{ correct }}
      </div>
    </div>
  </div>
</template>
