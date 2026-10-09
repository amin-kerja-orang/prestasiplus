<script setup lang="ts">
/**
 * The result of S13-S16 (URS FN-M16-6.2.4, 6.3.4, 6.4.4, 6.5.5) as a modal over the dimmed page, as live
 * (betul-salah-done, cabaran-kilat-done, tembak-jawapan-done, susun-jawapan-done): the big emoji and the
 * title (live paints the title dark on the dark card, ≈ 1.2:1; DV-M16-45 paints it white), the subtitle, the
 * glass stat tiles, "🏆 REKOD BARU!" when the server says `is_new_record`, then the replay button and
 * "🎮 Hub". The syiling tile is built by the page from the credited amount (DV-M16-23). The S14 replay button is
 * cyan-600 → blue-600 (live: white on cyan-500 ≈ 2.4:1; DV-M16-48).
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import CoinFly from './CoinFly.vue'

const props = defineProps<{
  /** "✅ HEBAT!": the emoji is shown big, the rest is the heading. */
  title: string
  subtitle: string
  tiles: { label: string; value: string; tone: string; wide?: boolean }[]
  newRecord: boolean
  againLabel: string
  coinsCredited: number
  theme: 'indigo' | 'cyan' | 'ember' | 'teal'
}>()

defineEmits<{ again: [] }>()

const CARD = {
  indigo: 'border-violet-500/30 from-indigo-950 to-violet-950',
  cyan: 'border-indigo-400/30 from-indigo-950 to-violet-950',
  ember: 'border-orange-500/30 from-stone-950 to-orange-950',
  teal: 'border-teal-500/30 from-teal-950 to-emerald-950',
} as const

const AGAIN = {
  indigo: 'from-violet-600 to-violet-700 text-white',
  cyan: 'from-cyan-600 to-blue-600 text-white',
  ember: 'from-orange-600 to-orange-700 text-white',
  teal: 'from-teal-400 to-teal-600 text-teal-950',
} as const

const parts = computed(() => {
  const i = props.title.indexOf(' ')
  return i < 0
    ? { emoji: '', text: props.title }
    : { emoji: props.title.slice(0, i), text: props.title.slice(i + 1) }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[200] flex animate-fade-in items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
    >
      <section
        class="relative w-full max-w-[26rem] rounded-3xl border bg-gradient-to-br p-6 text-center shadow-2xl"
        :class="CARD[theme]"
        data-testid="solo-result"
      >
        <CoinFly :coins="coinsCredited" />
        <div class="text-6xl" data-testid="solo-result-emoji">{{ parts.emoji }}</div>
        <h2
          class="mt-2 font-heading text-2xl font-extrabold text-white"
          data-testid="solo-result-title"
        >
          {{ parts.text }}
        </h2>
        <p class="mt-1 text-sm text-slate-300">{{ subtitle }}</p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <div
            v-for="tile in tiles"
            :key="tile.label"
            class="rounded-2xl border border-white/10 bg-white/5 p-3"
            :class="tile.wide ? 'col-span-2' : ''"
            data-testid="solo-result-tile"
          >
            <div class="text-2xl font-extrabold break-words" :class="tile.tone">
              {{ tile.value }}
            </div>
            <div class="text-xs font-medium text-slate-300">{{ tile.label }}</div>
          </div>
        </div>
        <p
          v-if="newRecord"
          class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-base font-extrabold text-amber-300"
          data-testid="solo-new-record"
        >
          🏆 REKOD BARU!
        </p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            class="min-h-12 rounded-xl bg-gradient-to-r px-3 py-3 text-base font-bold shadow-lg hover:brightness-110"
            :class="AGAIN[theme]"
            data-testid="solo-again"
            @click="$emit('again')"
          >
            {{ againLabel }}
          </button>
          <RouterLink
            to="/permainan"
            class="flex min-h-12 items-center justify-center rounded-xl bg-white/10 px-3 py-3 text-base font-bold text-slate-100 hover:bg-white/20"
            >🎮 Hub</RouterLink
          >
        </div>
      </section>
    </div>
  </Teleport>
</template>
