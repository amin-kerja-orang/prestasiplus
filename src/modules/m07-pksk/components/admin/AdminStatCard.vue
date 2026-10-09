<script setup lang="ts">
/** Stat card of S5 (five cards) and S8 (three cards): a bold coloured count over a small label. */
defineProps<{ value: number; label: string; colorClass: string; testid: string }>()
</script>

<template>
  <div class="min-w-0 rounded-xl bg-white p-4 text-center shadow" :data-testid="testid">
    <p :class="['text-2xl font-bold sm:text-3xl', colorClass]" data-testid="stat-value">
      {{ value }}
    </p>
    <p class="text-xs text-slate-500 sm:text-sm" data-testid="stat-label">{{ label }}</p>
  </div>
</template>
