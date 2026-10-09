<script setup lang="ts">
/**
 * The 3 → 2 → 1 countdown of S13-S15 (800 ms per step, URS FN-M16-6.2.1, 6.3.1, 6.4.1): the shell is
 * dimmed by a dark overlay with the game title and a big glowing number (live betul-salah-countdown).
 */
defineProps<{ title: string; count: number; hint?: string; tone?: string }>()
</script>

<template>
  <Teleport to="body">
    <section
      class="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/85 px-4 text-center"
      data-testid="solo-countdown"
    >
      <h2 class="font-heading text-xl font-extrabold text-white sm:text-2xl">{{ title }}</h2>
      <div
        :key="count"
        class="mt-4 animate-pop-in text-8xl font-extrabold drop-shadow-[0_0_24px_currentColor]"
        :class="tone ?? 'text-violet-500'"
        data-testid="solo-countdown-number"
      >
        {{ count }}
      </div>
      <p v-if="hint" class="mt-4 text-sm text-slate-300">{{ hint }}</p>
    </section>
  </Teleport>
</template>
