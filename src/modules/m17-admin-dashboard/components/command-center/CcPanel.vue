<script setup lang="ts">
/** A dark panel with an emoji and an uppercase heading (live S4-S7 panels). */
defineProps<{ icon: string; title: string }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl border border-slate-700 bg-slate-800 p-4 md:p-5">
    <h2
      class="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400 uppercase"
    >
      <span aria-hidden="true" class="text-base">{{ icon }}</span>
      <span data-testid="cc-panel-title">{{ title }}</span>
    </h2>
    <slot />
  </section>
</template>
