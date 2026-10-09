<script setup lang="ts">
/**
 * The darjah picker overlay shared by S13-S16 and S19 (URS FN-M16-6.1.1; DV-M16-18/19): full screen,
 * dark gradient, `z-index: 200`, the game emoji and title, the group "🏫 Sekolah Rendah" with
 * "Darjah 1" to "Darjah 4" (`?darjah=n`, hover border in the game colour) and "← Kembali ke Hub".
 * Nothing runs under it: the host starts its game only once `?darjah` is set.
 */
import { RouterLink, useRoute } from 'vue-router'

import { PICKER_DARJAH } from './solo-lib'

defineProps<{ emoji: string; title: string; color: string }>()

const route = useRoute()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[200] flex animate-fade-in items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4"
      data-testid="darjah-picker"
    >
      <div class="w-full max-w-sm py-6 text-center text-white">
        <div class="text-6xl">{{ emoji }}</div>
        <h2 class="mt-2 font-heading text-2xl font-extrabold">{{ title }}</h2>
        <p class="mt-4 text-sm text-slate-300">Pilih darjah / tingkatan kamu:</p>
        <p class="mt-4 mb-2 text-xs font-semibold tracking-wide text-slate-400">
          🏫 Sekolah Rendah
        </p>
        <div class="grid grid-cols-2 gap-3">
          <RouterLink
            v-for="n in PICKER_DARJAH"
            :key="n"
            :to="{ path: route.path, query: { darjah: String(n) } }"
            class="flex min-h-11 items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 px-3 py-3 text-base font-bold text-white transition hover:border-(--pick-color) hover:bg-white/20"
            :style="{ '--pick-color': color }"
            >Darjah {{ n }}</RouterLink
          >
        </div>
        <RouterLink
          to="/permainan"
          class="mt-6 inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-slate-300 hover:text-white"
          >← Kembali ke Hub</RouterLink
        >
      </div>
    </div>
  </Teleport>
</template>
