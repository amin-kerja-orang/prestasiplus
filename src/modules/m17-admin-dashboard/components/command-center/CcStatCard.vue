<script setup lang="ts">
/** Stat card of S4 / S7; `clickTitle` makes it a button (S7 "Jumlah Jawapan"). */
import { DsIconChip } from '@/ds'

defineProps<{
  label: string
  value: string
  /** Phosphor icon of the chip (`i-ph-...`). */
  icon: string
  /** Makes the card a button with this `title`. */
  clickTitle?: string
}>()
defineEmits<{ click: [] }>()
</script>

<template>
  <UButton
    v-if="clickTitle"
    color="neutral"
    variant="ghost"
    class="h-auto min-w-0 flex-col items-start gap-1 bg-default p-4 text-start"
    :title="clickTitle"
    data-testid="cc-stat"
    @click="$emit('click')"
  >
    <span class="flex w-full min-w-0 items-center gap-2">
      <DsIconChip :icon="icon" size="sm" />
      <span class="min-w-0 text-overline text-muted">{{ label }}</span>
    </span>
    <span class="tabular text-title text-highlighted" data-testid="cc-stat-value">{{ value }}</span>
  </UButton>
  <UCard v-else class="min-w-0" data-testid="cc-stat">
    <div class="flex min-w-0 flex-col items-start gap-1">
      <span class="flex w-full min-w-0 items-center gap-2">
        <DsIconChip :icon="icon" size="sm" />
        <span class="min-w-0 text-overline text-muted">{{ label }}</span>
      </span>
      <span class="tabular text-title text-highlighted" data-testid="cc-stat-value">{{
        value
      }}</span>
    </div>
  </UCard>
</template>
