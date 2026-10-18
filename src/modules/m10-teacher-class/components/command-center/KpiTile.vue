<script setup lang="ts">
/** One of the four KPI tiles (FR-M10-16, FN-M10-2.2.3): label, value, sub text; a click opens its drill. */
import { DsStatTile, type DsAccent } from '@/ds'

defineProps<{
  label: string
  value: string
  sub: string
  /** Phosphor base name of the chip. */
  icon: string
  accent: DsAccent
  testid: string
}>()
defineEmits<{ click: [] }>()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    block
    class="h-auto min-w-0 items-stretch p-0 text-start"
    :data-testid="testid"
    @click="$emit('click')"
  >
    <DsStatTile
      class="w-full"
      :value="value"
      :unit="label"
      :sub="sub"
      :icon="icon"
      :accent="accent"
      part-prefix="cc-kpi"
    />
  </UButton>
</template>
