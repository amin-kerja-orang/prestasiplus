<script setup lang="ts">
/** The 3 → 2 → 1 countdown of S13-S15 (800 ms per step, URS FN-M16-6.2.1, 6.3.1, 6.4.1). */
defineProps<{ title: string; count: number; hint?: string }>()
</script>

<template>
  <section
    class="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center text-center"
    data-testid="solo-countdown"
  >
    <h2 class="font-heading text-2xl font-extrabold text-slate-800">{{ title }}</h2>
    <div
      :key="count"
      class="mt-6 animate-pop-in text-8xl font-extrabold text-indigo-600"
      data-testid="solo-countdown-number"
    >
      {{ count }}
    </div>
    <p v-if="hint" class="mt-4 text-sm text-slate-500">{{ hint }}</p>
  </section>
</template>
