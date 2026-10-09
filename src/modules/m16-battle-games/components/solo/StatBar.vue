<script setup lang="ts">
/** The game bar "Skor" · clock · "Betul" of S13 and S14 (clock red at ≤ 10 s). */
defineProps<{ score: number; timeLeft: number; correct: number }>()
</script>

<template>
  <div
    class="grid grid-cols-3 items-center rounded-2xl bg-white p-3 text-center shadow-sm"
    data-testid="solo-bar"
  >
    <div>
      <div class="text-xl font-extrabold text-slate-800" data-testid="solo-score">{{ score }}</div>
      <div class="text-xs font-semibold text-slate-500">Skor</div>
    </div>
    <div
      class="text-3xl font-extrabold"
      :class="timeLeft <= 10 ? 'text-red-500' : 'text-slate-800'"
      data-testid="solo-clock"
    >
      {{ timeLeft }}
    </div>
    <div>
      <div class="text-xl font-extrabold text-slate-800" data-testid="solo-correct">
        {{ correct }}
      </div>
      <div class="text-xs font-semibold text-slate-500">Betul</div>
    </div>
  </div>
</template>
