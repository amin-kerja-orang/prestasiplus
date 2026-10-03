<script setup lang="ts">
/** Tinted stat card of S3, S4 and S5 (label + big value; cards of FN-M11-4.1.2, 4.2.2, 4.3.2). */
defineProps<{
  label: string
  value: string
  /** Full class strings of the tone (background, label colour, value colour). */
  tone: { box: string; label: string; value: string }
}>()
</script>

<template>
  <div :class="['min-w-0 rounded-2xl border p-3 sm:p-4', tone.box]" data-testid="mon-stat">
    <p :class="['text-sm font-medium', tone.label]">{{ label }}</p>
    <p :class="['font-heading text-2xl font-bold', tone.value]" data-testid="mon-stat-value">
      <slot>{{ value }}</slot>
    </p>
  </div>
</template>
