<script setup lang="ts">
/** Loading state of the M08 pages: skeleton blocks shaped like the final layout (stat tiles + a card). */
</script>

<template>
  <div class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
    </div>
    <USkeleton class="h-64 w-full" />
  </div>
</template>
