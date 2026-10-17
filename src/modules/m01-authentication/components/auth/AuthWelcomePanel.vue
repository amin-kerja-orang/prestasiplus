<script setup lang="ts">
/**
 * Brand panel of S1/S2 (FR-M01-02, FR-M01-15), v2 theme: sits on the gradient A1 surface of
 * `AuthLayout` (from `xl` only). Mascot bubble, the H2, the paragraph (slot) and three tiles.
 */
import type { WelcomeTile } from './welcome-tiles'

defineProps<{ mascot: string; heading: string; tiles: readonly WelcomeTile[] }>()
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div
    class="flex size-24 items-center justify-center rounded-full bg-primary-on/15 text-5xl"
    aria-hidden="true"
  >
    <span data-testid="auth-mascot">{{ mascot }}</span>
  </div>
  <div class="flex flex-col gap-3">
    <h2 class="font-display text-title">{{ heading }}</h2>
    <p class="text-body"><slot /></p>
  </div>
  <ul class="flex flex-col gap-3">
    <li
      v-for="tile in tiles"
      :key="tile.title"
      class="flex items-center gap-3 rounded-card bg-primary-on/10 p-3"
      data-testid="auth-tile"
    >
      <span class="text-2xl" aria-hidden="true">{{ tile.emoji }}</span>
      <div>
        <div class="text-label">{{ tile.title }}</div>
        <div class="text-caption">{{ tile.text }}</div>
      </div>
    </li>
  </ul>
</template>
