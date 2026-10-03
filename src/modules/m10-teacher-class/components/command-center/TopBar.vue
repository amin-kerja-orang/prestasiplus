<script setup lang="ts">
/**
 * Top bar of S2 (FR-M10-14, FN-M10-2.2.1): "← Dashboard", h1 "Command Center", the six links, the LIVE badge
 * and the MYT clock. DV-M10-17: below 1024 px the six links sit in a horizontally scrollable row of their own
 * and the LIVE badge and the clock stay visible (live clips them).
 */
import { RouterLink } from 'vue-router'

import { useClock } from './composables'
import { NAV_LINKS, type NavAction, REKOD_PATH, S2_COPY } from './copy'

defineEmits<{ open: [action: NavAction] }>()

const clock = useClock()
const PILL =
  'inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition'
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-indigo-500/60 bg-gradient-to-r from-indigo-950 to-indigo-900 px-3 py-3 sm:px-4 lg:flex-nowrap lg:px-5"
    data-testid="cc-topbar"
  >
    <RouterLink
      to="/guru"
      :class="[
        PILL,
        'order-1 border-indigo-400/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25',
      ]"
      data-testid="cc-back"
      >{{ S2_COPY.back }}</RouterLink
    >
    <h1
      class="order-2 min-w-0 bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text font-heading text-base font-extrabold tracking-widest text-transparent uppercase sm:text-2xl"
      data-testid="cc-title"
    >
      {{ S2_COPY.title }}
    </h1>
    <nav
      class="order-4 flex w-full items-center gap-2 overflow-x-auto pb-1 lg:order-3 lg:w-auto lg:flex-1 lg:justify-center lg:overflow-visible lg:pb-0"
      data-testid="cc-links"
    >
      <template v-for="l in NAV_LINKS" :key="l.id">
        <RouterLink
          v-if="l.id === 'rekod'"
          :to="REKOD_PATH"
          :class="[PILL, l.tone]"
          data-testid="cc-link-rekod"
          >{{ l.label }}</RouterLink
        >
        <a
          v-else
          href="#"
          :class="[PILL, l.tone]"
          :data-testid="`cc-link-${l.id}`"
          @click.prevent="$emit('open', l.id)"
          >{{ l.label }}</a
        >
      </template>
    </nav>
    <div class="order-3 ml-auto flex shrink-0 items-center gap-2 lg:order-4" data-testid="cc-live">
      <span class="text-sm font-bold tracking-widest text-indigo-300" data-testid="cc-live-badge">{{
        S2_COPY.live
      }}</span>
      <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
      <span
        class="font-mono text-base font-bold text-indigo-200 sm:text-lg"
        data-testid="cc-clock"
        >{{ clock }}</span
      >
      <span class="font-mono text-xs text-slate-400">{{ S2_COPY.tz }}</span>
    </div>
  </header>
</template>
