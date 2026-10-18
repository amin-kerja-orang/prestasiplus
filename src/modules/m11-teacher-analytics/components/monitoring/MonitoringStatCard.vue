<script setup lang="ts">
/** Stat tile of S3, S4 and S5 (label + big value; cards of FN-M11-4.1.2, 4.2.2, 4.3.2): a roomy `DsStatTile`. */
import { DsStatTile } from '@/ds'
import type { DsAccent } from '@/ds/types'

withDefaults(
  defineProps<{
    label: string
    value: string
    icon?: string
    accent?: DsAccent
    /** Token text colour class of the value (a focus point, e.g. the accuracy band). */
    valueClass?: string
  }>(),
  { icon: 'i-ph-chart-bar', accent: 'action', valueClass: 'text-highlighted' },
)
</script>

<template>
  <DsStatTile
    roomy
    :value="value"
    :unit="label"
    :icon="icon"
    :accent="accent"
    :value-class="valueClass"
    data-testid="mon-stat"
  />
</template>
