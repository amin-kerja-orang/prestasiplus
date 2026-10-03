<script setup lang="ts">
defineProps<{ pct: number; color: string }>()
</script>

<template>
  <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div
      class="h-2 rounded-full"
      :style="{ width: `${String(pct)}%`, backgroundColor: color }"
      data-testid="mastery-bar"
    ></div>
  </div>
</template>
