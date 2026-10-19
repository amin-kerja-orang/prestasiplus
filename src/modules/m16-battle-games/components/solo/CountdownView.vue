<script setup lang="ts">
import { DsText } from '@/ds'

/**
 * The 3 → 2 → 1 countdown of S13-S15 (800 ms per step, URS FN-M16-6.2.1, 6.3.1, 6.4.1): the shell is
 * covered by a scrim with the game title and a big number on an A1 gradient disc (pop-in, switched
 * off for reduced motion).
 */
defineProps<{ title: string; count: number; hint?: string }>()
</script>

<template>
  <Teleport to="body">
    <section
      class="fixed inset-0 z-150 flex flex-col items-center justify-center gap-4 bg-default/95 px-4 text-center"
      role="status"
      aria-live="polite"
      data-testid="solo-countdown"
    >
      <h2 class="font-display text-subheading font-extrabold text-highlighted">{{ title }}</h2>
      <div
        :key="count"
        class="tabular grid size-32 animate-ds-hop place-items-center rounded-full bg-gradient-primary font-display text-display font-extrabold text-primary-on shadow-hero motion-reduce:animate-none"
        data-testid="solo-countdown-number"
      >
        {{ count }}
      </div>
      <DsText v-if="hint" variant="body" tone="muted">{{ hint }}</DsText>
    </section>
  </Teleport>
</template>
