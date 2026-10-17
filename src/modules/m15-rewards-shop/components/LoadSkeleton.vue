<script setup lang="ts">
/** Loading skeleton shared by the M15 pages. */
defineProps<{ testid: string }>()
</script>

<template>
  <div class="flex flex-col gap-3" aria-busy="true" :data-testid="testid">
    <USkeleton class="h-28 w-full" />
    <USkeleton class="h-40 w-full" />
  </div>
</template>
