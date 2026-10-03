<script setup lang="ts">
/**
 * Standalone header of S2 (FN-M17-3.1.1): "← Dashboard", "📊 Aktiviti Harian", the title, the pulsing LIVE
 * pill, the MYT clock. Below `md` the title drops to its own row so the clock and LIVE stay visible
 * (DV-M17-01). The school view adds "Pemantauan langsung sekolah anda" under the title (FR-M17-106 a).
 */
import { RouterLink } from 'vue-router'

import { S2_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
const PILL =
  'inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 py-2 text-sm font-semibold transition'
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-indigo-500/60 bg-gradient-to-r from-indigo-950 to-indigo-900 px-3 py-2 sm:px-4 xl:shrink-0 xl:flex-nowrap xl:px-5"
    data-testid="cc-s2-header"
  >
    <div class="order-1 flex shrink-0 flex-wrap items-center gap-2">
      <RouterLink
        :to="paths.dashboard"
        :class="[
          PILL,
          'border-indigo-400/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25',
        ]"
        data-testid="cc-s2-back"
        >{{ S2_COPY.back }}</RouterLink
      >
      <RouterLink
        :to="paths.daily"
        :class="[
          PILL,
          'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
        ]"
        data-testid="cc-s2-daily"
        >{{ S2_COPY.daily }}</RouterLink
      >
    </div>
    <div
      class="order-3 min-w-0 basis-full md:order-2 md:flex-1 md:basis-auto md:text-center"
      data-testid="cc-s2-heading"
    >
      <h1
        class="bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text font-heading text-xl font-extrabold tracking-widest text-transparent uppercase sm:text-2xl"
        data-testid="cc-title"
      >
        {{ S2_COPY.title }}
      </h1>
      <p v-if="school" class="mt-0.5 text-sm text-slate-300" data-testid="cc-s2-subtitle">
        {{ S2_COPY.schoolSub }}
      </p>
    </div>
    <div
      class="order-2 ml-auto flex shrink-0 items-center gap-2 md:order-3"
      data-testid="cc-s2-live"
    >
      <span class="text-sm font-bold tracking-widest text-indigo-300" data-testid="cc-live-badge">{{
        S2_COPY.live
      }}</span>
      <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
      <span
        class="font-mono text-base font-bold text-indigo-200 sm:text-lg"
        data-testid="cc-clock"
        >{{ clock }}</span
      >
      <span class="font-mono text-xs text-slate-400">{{ S2_COPY.tz }}</span>
    </div>
  </header>
</template>
