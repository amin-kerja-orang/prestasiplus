<script setup lang="ts">
/** One of the four KPI tiles (FR-M10-16, FN-M10-2.2.3): label, value, sub text; a click opens its drill. */
import { DsIconChip } from '@/ds'

defineProps<{ label: string; value: string; sub: string; icon: string; testid: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    class="h-auto min-w-0 flex-col items-start gap-1 bg-default p-4 text-start"
    :data-testid="testid"
    @click="$emit('click')"
  >
    <span class="flex w-full min-w-0 items-center gap-2">
      <DsIconChip :icon="icon" size="sm" />
      <span class="min-w-0 text-overline text-muted">{{ label }}</span>
    </span>
    <span class="tabular text-title text-highlighted" data-testid="cc-kpi-value">{{ value }}</span>
    <span class="text-caption text-muted" data-testid="cc-kpi-sub">{{ sub }}</span>
  </UButton>
</template>
