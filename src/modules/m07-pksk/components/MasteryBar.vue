<script setup lang="ts">
import type { DsAccent } from '@/ds'

withDefaults(defineProps<{ pct: number; accent?: DsAccent }>(), { accent: 'action' })

const bar: Record<DsAccent, string> = {
  action: 'rounded-full bg-gradient-primary-h',
  win: 'rounded-full bg-highlight',
  heat: 'rounded-full bg-heat',
  friend: 'rounded-full bg-friend',
  trial: 'rounded-full bg-trial',
}
</script>

<template>
  <UProgress
    :model-value="pct"
    :max="100"
    size="sm"
    aria-label="Penguasaan"
    :ui="{ base: 'bg-elevated rounded-full', indicator: bar[accent] }"
    data-testid="mastery-bar"
  />
</template>
