<script setup lang="ts">
/** Stat card of S3, S4 and S5 (label + big value; cards of FN-M11-4.1.2, 4.2.2, 4.3.2). */
defineProps<{
  label: string
  value: string
  /** Optional token text colour of the value (a focus point, e.g. the accuracy band). */
  valueClass?: string
}>()
</script>

<template>
  <UCard variant="soft" class="min-w-0" data-testid="mon-stat">
    <div class="flex flex-col gap-1">
      <p class="text-caption text-muted">{{ label }}</p>
      <p
        :class="['tabular text-heading', valueClass ?? 'text-highlighted']"
        data-testid="mon-stat-value"
      >
        <slot>{{ value }}</slot>
      </p>
    </div>
  </UCard>
</template>
