<script setup lang="ts">
/**
 * Left welcome panel of S1/S2 (FR-M01-02, FR-M01-15): mascot bubble, a translucent card with the
 * H2, the paragraph (slot) and three pastel tiles. Shown by `AuthLayout` from `lg` only (DV-07).
 */
import type { WelcomeTile } from './welcome-tiles'

defineProps<{ mascot: string; heading: string; tiles: readonly WelcomeTile[] }>()
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div class="flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl shadow-lg">
    <span data-testid="auth-mascot">{{ mascot }}</span>
  </div>
  <div class="rounded-3xl bg-white/70 p-8 shadow-xl">
    <h2 class="font-heading text-3xl font-bold text-gray-800">{{ heading }}</h2>
    <p class="mt-3 text-gray-600"><slot /></p>
    <div class="mt-6 space-y-3">
      <div
        v-for="tile in tiles"
        :key="tile.title"
        class="flex items-center gap-3 rounded-xl p-3"
        :class="tile.tint"
        data-testid="auth-tile"
      >
        <span class="text-2xl">{{ tile.emoji }}</span>
        <div>
          <div class="font-semibold">{{ tile.title }}</div>
          <div class="text-sm text-gray-600">{{ tile.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
