<script setup lang="ts">
/**
 * A dark panel of S2 with an emoji and an uppercase heading. From `xl` the board fills the viewport and a
 * panel scrolls inside itself (as live, FR-M17-33); panels grow to fill their column, so no column ends in a hole; below `xl` the page scrolls and nothing is clipped.
 */
defineProps<{ icon: string; title: string; testid: string; fixed?: boolean }>()
</script>

<template>
  <section
    :class="[
      'min-w-0 grow rounded-2xl border border-slate-700 bg-slate-800 p-4 xl:p-2.5',
      fixed ? 'xl:shrink-0' : 'xl:min-h-[6rem] xl:shrink xl:overflow-y-auto',
    ]"
    :data-testid="testid"
  >
    <h2
      class="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400 uppercase xl:mb-1.5"
    >
      <span class="text-base">{{ icon }}</span>
      <span data-testid="board-panel-title">{{ title }}</span>
    </h2>
    <slot />
  </section>
</template>
