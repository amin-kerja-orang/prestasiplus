<script setup lang="ts">
/**
 * Standalone header of S3 (FN-M17-4.1.1): "⚡ AKTIVITI PLATFORM" ("AKTIVITI SEKOLAH" for the school admin,
 * FR-M17-116), "◀ Command Center" and "Laporan Eksekutif" (admin only), the MYT clock.
 */
import { RouterLink } from 'vue-router'

import { ccDailyTitle } from '../../api/command-center-board'
import { S2_COPY, S3_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
const PILL =
  'inline-flex min-h-11 shrink-0 items-center rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/25'
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-indigo-500/40 bg-gradient-to-r from-indigo-950 to-slate-950 px-3 py-3 sm:px-4 lg:flex-nowrap lg:px-5"
    data-testid="cc-s3-header"
  >
    <h1
      class="order-1 min-w-0 flex-1 font-heading text-lg font-extrabold tracking-widest text-indigo-300 uppercase sm:text-xl lg:flex-none"
      data-testid="cc-title"
    >
      <span>⚡ </span>{{ ccDailyTitle(school ? 'school' : 'platform') }}
    </h1>
    <div
      class="order-3 flex w-full flex-wrap items-center gap-2 lg:order-2 lg:w-auto lg:flex-1 lg:justify-center"
    >
      <RouterLink :to="paths.board" :class="PILL" data-testid="cc-s3-back">{{
        S3_COPY.back
      }}</RouterLink>
      <RouterLink v-if="paths.report" :to="paths.report" :class="PILL" data-testid="cc-s3-report">{{
        S3_COPY.report
      }}</RouterLink>
    </div>
    <div class="order-2 flex shrink-0 items-center gap-2 lg:order-3" data-testid="cc-s3-live">
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
