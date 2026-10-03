<script setup lang="ts">
/** FR-M05-09: the Kombo reminder banner (the caller decides when it shows). */
import { Play, TriangleAlert } from '@lucide/vue'
import { RouterLink } from 'vue-router'

defineProps<{ count: number }>()
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 p-4 shadow-lg md:p-5"
    data-testid="dash-kombo"
  >
    <div
      class="pointer-events-none absolute top-0 right-0 -mt-4 -mr-4 text-8xl opacity-10 md:text-9xl"
      style="font-family: 'Outfit', sans-serif"
    >
      ⚠️
    </div>
    <div class="relative z-10">
      <div class="flex items-center gap-3 md:gap-4">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 md:h-16 md:w-16"
        >
          <TriangleAlert class="h-5 w-5 text-white md:h-8 md:w-8" />
        </div>
        <div class="min-w-0 flex-1">
          <h3
            class="text-sm leading-tight font-black text-white md:text-xl"
            style="font-family: 'Outfit', sans-serif"
          >
            Kombo {{ count }} hari akan putus!
          </h3>
          <p class="mt-0.5 text-xs leading-snug font-semibold text-white/80 md:text-base">
            Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini.
          </p>
        </div>
      </div>
      <div
        class="mt-3 flex items-center gap-2 md:absolute md:top-1/2 md:right-4 md:mt-0 md:-translate-y-1/2"
      >
        <RouterLink
          to="/practice"
          class="relative block rounded-xl bg-white/25 px-5 py-2 text-center text-xs font-bold text-white shadow-md backdrop-blur-sm transition-all after:absolute after:inset-x-0 after:-inset-y-1.5 hover:scale-105 hover:bg-white/40 md:inline-flex md:items-center md:py-2.5 md:text-sm"
          data-testid="dash-kombo-link"
        >
          <Play class="mr-1 inline h-3.5 w-3.5" /> Mula Latihan
        </RouterLink>
      </div>
    </div>
  </div>
</template>
