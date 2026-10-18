<script setup lang="ts">
/** Skeleton cards of the loading state (FR-G-10; SRS M06 §8.2). */
withDefaults(defineProps<{ count?: number }>(), { count: 6 })
</script>

<template>
  <div
    class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
    aria-busy="true"
    data-testid="spm-skeleton"
  >
    <USkeleton v-for="n in count" :key="n" class="h-36" />
  </div>
</template>
