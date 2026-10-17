<script setup lang="ts">
/** Stat card of S1, S2, S3 (label above, big value, optional small suffix and caption). */
defineProps<{
  label: string
  value: string
  /** Muted suffix after the value ("/5", "/522"). */
  suffix?: string
  caption?: string
  /** A value that stands for "no data" (shown dimmed). */
  muted?: boolean
}>()
</script>

<template>
  <UCard class="min-w-0" data-testid="kirk-stat">
    <div class="flex min-w-0 flex-col gap-1">
      <p class="text-caption text-muted" data-testid="kirk-stat-label">{{ label }}</p>
      <p :class="['tabular text-heading', muted ? 'text-dimmed' : 'text-highlighted']">
        <span data-testid="kirk-stat-value">{{ value }}</span
        ><span v-if="suffix" class="text-label text-muted" data-testid="kirk-stat-suffix">{{
          suffix
        }}</span>
      </p>
      <p v-if="caption" class="text-caption text-muted" data-testid="kirk-stat-caption">
        {{ caption }}
      </p>
    </div>
  </UCard>
</template>
