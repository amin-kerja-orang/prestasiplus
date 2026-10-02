<script setup lang="ts">
/**
 * Standalone auth layout of S1/S2 (FR-M01-01, FR-M01-02/15, shells.md §4). Rendered by the page
 * (route `layout: 'bare'`), so no shell wraps it:
 * - animated pastel gradient (`bg-auth`, `coolGradient` 15s), floating emoji and an SVG wave, all
 *   decorative (`aria-hidden`); the animations run under `motion-safe:` only (NFR-05);
 * - two columns from `lg` (DV-07; live `md`): the `welcome` slot on the left, hidden below `lg`;
 *   the card column holds the white card (logo + tagline + default slot), an optional `below`
 *   slot (the S1 stats strip) and the footer line.
 */
import { LOGO_URL } from '@/shells/shared/brand'

import AuthFooter from './AuthFooter.vue'

defineProps<{
  /** Card tagline under the logo (S1 "Platform Latih Tubi Nasional 🇲🇾", S2 "Daftar Akaun Baru 🇲🇾"). */
  tagline: string
}>()

defineSlots<{ welcome?: () => unknown; default: () => unknown; below?: () => unknown }>()

/** 📚 ✏️ ⭐ 🎨 🚀 💡 with their positions; visible at every width (FR-M01-01). */
const FLOATS = [
  { emoji: '📚', position: 'top-4 left-3 sm:top-10 sm:left-10' },
  { emoji: '✏️', position: 'top-16 right-3 sm:top-24 sm:right-14' },
  { emoji: '⭐', position: 'bottom-24 left-3 sm:bottom-32 sm:left-16' },
  { emoji: '🎨', position: 'bottom-16 right-3 sm:bottom-20 sm:right-10' },
  { emoji: '🚀', position: 'top-1/2 left-1 sm:left-6' },
  { emoji: '💡', position: 'top-1/3 right-1 sm:right-6' },
] as const
</script>

<template>
  <main
    class="relative flex min-h-screen items-center justify-center overflow-hidden bg-auth p-3 motion-safe:animate-cool-gradient sm:p-4"
    data-testid="auth-layout"
  >
    <span
      v-for="(float, i) in FLOATS"
      :key="float.emoji"
      aria-hidden="true"
      class="pointer-events-none absolute text-2xl opacity-60 select-none motion-safe:animate-float-bounce sm:text-4xl"
      :class="float.position"
      :style="{ animationDelay: `${String(i)}s` }"
      data-testid="auth-float"
    >
      {{ float.emoji }}
    </span>

    <svg
      aria-hidden="true"
      class="pointer-events-none absolute bottom-0 left-0 h-24 w-full"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      data-testid="auth-wave"
    >
      <path
        fill="rgba(255,255,255,0.35)"
        d="M0,64 C240,120 480,0 720,40 C960,80 1200,120 1440,48 L1440,120 L0,120 Z"
      />
    </svg>

    <div class="relative z-10 w-full max-w-6xl lg:grid lg:grid-cols-2 lg:items-center lg:gap-8">
      <div v-if="$slots.welcome" class="hidden space-y-6 lg:block" data-testid="auth-welcome">
        <slot name="welcome" />
      </div>

      <div class="mx-auto w-full max-w-[560px] lg:max-w-none">
        <div class="rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8 md:p-10">
          <div class="mb-6 text-center">
            <img :src="LOGO_URL" alt="PRESTASIPLUS" class="mx-auto mb-3 h-16 w-auto max-w-full" />
            <p class="text-sm font-medium text-slate-500" data-testid="auth-tagline">
              {{ tagline }}
            </p>
          </div>
          <slot />
        </div>

        <slot name="below" />

        <AuthFooter />
      </div>
    </div>
  </main>
</template>
