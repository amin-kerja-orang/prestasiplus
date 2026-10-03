<script setup lang="ts">
/** A dark panel of S2: emoji and an upper-case heading (FN-M10-2.2.4, 2.2.5). */
defineProps<{ icon: string; title: string; testid: string }>()
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-700 bg-slate-800 p-4"
    :data-testid="testid"
  >
    <h2
      class="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400 uppercase"
    >
      <span aria-hidden="true" class="text-base">{{ icon }}</span>
      <span>{{ title }}</span>
    </h2>
    <slot />
  </section>
</template>
