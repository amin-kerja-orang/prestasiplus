<script setup lang="ts">
/** Skeleton cards of the loading state (FR-G-10; SRS M06 §8.2). */
withDefaults(defineProps<{ count?: number; cols?: string }>(), {
  count: 6,
  cols: 'md:grid-cols-2 lg:grid-cols-3',
})
</script>

<template>
  <div
    :class="['grid grid-cols-1 gap-3 sm:gap-5', cols]"
    aria-busy="true"
    data-testid="spm-skeleton"
  >
    <div
      v-for="n in count"
      :key="n"
      class="h-36 animate-pulse rounded-2xl border border-slate-100 bg-slate-100"
    ></div>
  </div>
</template>
