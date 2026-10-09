<script setup lang="ts">
/**
 * The darjah picker overlay shared by S13-S16 and S19 (URS FN-M16-6.1.1; DV-M16-18/19): full screen,
 * dark gradient, `z-index: 200`, the game emoji and title, the group "🏫 Sekolah Rendah" with
 * "Darjah 1" to "Darjah 4" (`?darjah=n`, hover border in the game colour) and "← Kembali ke Hub".
 * Nothing runs under it: the host starts its game only once `?darjah` is set. The muted texts are lighter
 * than live (≈ 2.7-3.5:1 there; DV-M16-47).
 */
import { RouterLink, useRoute } from 'vue-router'

import { PICKER_DARJAH } from './solo-lib'

defineProps<{ emoji: string; title: string; color: string }>()

const route = useRoute()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[200] flex animate-fade-in items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4"
      data-testid="darjah-picker"
    >
      <div class="w-full max-w-lg py-6 text-center text-white">
        <div class="text-6xl">{{ emoji }}</div>
        <h2 class="mt-3 font-heading text-2xl font-extrabold">{{ title }}</h2>
        <p class="mt-2 text-sm text-slate-400">Pilih darjah / tingkatan kamu:</p>
        <p class="mt-6 mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
          🏫 Sekolah Rendah
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <RouterLink
            v-for="n in PICKER_DARJAH"
            :key="n"
            :to="{ path: route.path, query: { darjah: String(n) } }"
            class="flex min-h-11 items-center justify-center rounded-2xl border-2 border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:border-(--pick-color) hover:bg-white/10"
            :style="{ '--pick-color': color }"
            >Darjah {{ n }}</RouterLink
          >
        </div>
        <RouterLink
          to="/permainan"
          class="mt-8 inline-flex min-h-11 items-center justify-center px-3 text-sm text-slate-400 hover:text-white"
          >← Kembali ke Hub</RouterLink
        >
      </div>
    </div>
  </Teleport>
</template>
