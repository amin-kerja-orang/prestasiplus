<script setup lang="ts">
/**
 * The result of S13-S16 (URS FN-M16-6.2.4, 6.3.4, 6.4.4, 6.5.5): emoji + title, the subtitle, the stat
 * tiles, "🏆 REKOD BARU!" when the server says `is_new_record`, then the replay button and "🎮 Hub".
 * The syiling tile is built by the page from the credited amount (DV-M16-23).
 */
import { RouterLink } from 'vue-router'

import CoinFly from './CoinFly.vue'

defineProps<{
  title: string
  subtitle: string
  tiles: { label: string; value: string }[]
  newRecord: boolean
  againLabel: string
  coinsCredited: number
}>()

defineEmits<{ again: [] }>()
</script>

<template>
  <section
    class="relative mx-auto w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-lg"
    data-testid="solo-result"
  >
    <CoinFly :coins="coinsCredited" />
    <h2 class="font-heading text-3xl font-extrabold text-slate-800" data-testid="solo-result-title">
      {{ title }}
    </h2>
    <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
    <div class="mt-5 grid grid-cols-2 gap-3">
      <div
        v-for="tile in tiles"
        :key="tile.label"
        class="rounded-2xl bg-slate-50 p-3"
        data-testid="solo-result-tile"
      >
        <div class="text-xl font-extrabold break-words text-slate-800">{{ tile.value }}</div>
        <div class="text-xs font-semibold text-slate-500">{{ tile.label }}</div>
      </div>
    </div>
    <p
      v-if="newRecord"
      class="mt-4 rounded-xl bg-amber-100 px-3 py-2 text-sm font-extrabold text-amber-700"
      data-testid="solo-new-record"
    >
      🏆 REKOD BARU!
    </p>
    <div class="mt-6 grid grid-cols-2 gap-3">
      <button
        type="button"
        class="min-h-11 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white hover:bg-indigo-700"
        data-testid="solo-again"
        @click="$emit('again')"
      >
        {{ againLabel }}
      </button>
      <RouterLink
        to="/permainan"
        class="flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
        >🎮 Hub</RouterLink
      >
    </div>
  </section>
</template>
