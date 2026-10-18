<script setup lang="ts">
/**
 * Hero header card of a main Pentadbiran page: the A1 gradient, a soft glow and 3D art. Decorative
 * band above the page (the page keeps its own heading and content).
 */
import DsArt3D from '@/ds/DsArt3D.vue'

import type { PentadbiranHeroSpec } from './heroes'

defineProps<{ hero: PentadbiranHeroSpec }>()
</script>

<template>
  <section
    class="relative mb-4 overflow-hidden rounded-sheet bg-gradient-primary p-4 pe-24 text-primary-on shadow-hero sm:mb-6 sm:p-6 sm:pe-40"
    :aria-label="hero.title"
    data-testid="pentadbiran-hero"
  >
    <span
      class="pointer-events-none absolute -end-10 -top-12 size-44 rounded-full bg-primary-on/10"
      aria-hidden="true"
    />
    <span
      class="pointer-events-none absolute end-24 -bottom-16 size-36 rounded-full bg-primary-on/10"
      aria-hidden="true"
    />
    <div class="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 sm:end-8 sm:scale-150">
      <DsArt3D :name="hero.art" size="lg" float />
    </div>
    <div class="relative flex min-w-0 flex-col gap-1">
      <span class="text-overline">{{ hero.overline }}</span>
      <p class="font-display text-title font-extrabold">{{ hero.title }}</p>
      <p class="max-w-prose text-label font-medium">{{ hero.subtitle }}</p>
    </div>
  </section>
</template>
