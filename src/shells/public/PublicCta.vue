<script setup lang="ts">
/**
 * Guest registration CTA (live `section`, FN-M09-2.2.6 / 6.2.4): decorative emoji, h2, body,
 * `fa-arrow-right` "Daftar Percuma Sekarang" → `/register`, and the "100% Percuma" note.
 *
 * Copy, emoji order and href are OBSERVED (inventory S15-205…214, S17-206…214). The visual design
 * (gradient panel, emoji positions, the arrow after the label) is INFERRED: no guest markup,
 * styles or screenshot were captured. The floating motion is the design-system `floatBounce`,
 * applied with `motion-safe:` like the auth pages' decorative emoji.
 */
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

import { PUBLIC_CTA_BUTTON, PUBLIC_CTA_NOTE, type PublicCtaCopy } from './public-sections'

defineProps<{ cta: PublicCtaCopy }>()

/**
 * Decoration slots, used in order (INFERRED positions). Below `sm` the emoji are smaller and sit
 * in the four corners only; the two mid-side slots (5th, 6th emoji) are hidden there so no emoji
 * sits over the copy on a 320-375 px screen (INFERRED).
 */
const POSITIONS = [
  'top-3 left-3 sm:top-6 sm:left-10',
  'top-3 right-3 sm:top-8 sm:right-16',
  'bottom-3 left-3 sm:bottom-8 sm:left-24',
  'bottom-3 right-3 sm:bottom-6 sm:right-10',
  'hidden sm:block top-1/2 sm:left-4',
  'hidden sm:block top-1/3 sm:right-4',
] as const
</script>

<template>
  <section
    class="mx-auto w-full max-w-7xl px-3 pb-10 sm:px-6 sm:pb-14"
    data-testid="public-layout-cta"
  >
    <div
      class="relative overflow-hidden rounded-3xl px-5 py-10 text-center text-white shadow-2xl bg-primary-gradient sm:px-10 sm:py-14"
    >
      <div
        v-for="(emoji, i) in cta.decorations"
        :key="i"
        class="pointer-events-none absolute text-xl opacity-60 select-none motion-safe:animate-float-bounce sm:text-4xl"
        :class="POSITIONS[i % POSITIONS.length]"
        :style="{ animationDelay: `${String(i * 0.8)}s` }"
      >
        {{ emoji }}
      </div>

      <div class="relative mx-auto max-w-2xl">
        <h2 class="font-heading text-2xl font-bold text-white sm:text-4xl">{{ cta.heading }}</h2>
        <p class="mt-3 text-sm text-white/90 sm:mt-4 sm:text-lg">{{ cta.body }}</p>
        <ShellLink
          to="/register"
          class="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 font-heading text-base font-bold text-indigo-600 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl sm:mt-8 sm:px-8 sm:text-lg"
          data-testid="public-layout-cta-register"
        >
          {{ PUBLIC_CTA_BUTTON }}
          <NavIcon fa="fa-arrow-right" />
        </ShellLink>
        <p class="mt-4 text-xs text-white/80 sm:text-sm">{{ PUBLIC_CTA_NOTE }}</p>
      </div>
    </div>
  </section>
</template>
