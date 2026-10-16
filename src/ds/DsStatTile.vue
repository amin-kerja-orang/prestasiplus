<script setup lang="ts">
/**
 * Stat tile (design system 6, "Stat tile"): solid icon chip or a 3D reward image, a display number
 * and a small unit. Numbers are tabular. Staff gets the quieter shadow and tinted chip through
 * the personality variants.
 */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsIconChip from './DsIconChip.vue'
import type { DsAccent } from './types'

withDefaults(
  defineProps<{
    value: string | number
    /** Unit / label under the number (BM, from the caller). */
    unit: string
    /** Phosphor icon for the chip. Ignored when `art` is set. */
    icon?: string
    accent?: DsAccent
    /** 3D reward image instead of the chip (learner "Ganjaran 3D"). */
    art?: Art3DName
  }>(),
  { icon: undefined, accent: 'action', art: undefined },
)
</script>

<template>
  <div
    class="flex min-w-0 animate-ds-rise flex-col items-start gap-2 rounded-card bg-default px-2.5 pt-3.5 pb-3 shadow-ds-xs motion-reduce:animate-none learner:shadow-lift"
    data-ds="stat-tile"
  >
    <DsArt3D v-if="art" :name="art" size="md" />
    <DsIconChip v-else-if="icon" :icon="icon" :accent="accent" />
    <span class="tabular font-display text-heading font-extrabold text-highlighted">{{
      value
    }}</span>
    <span class="-mt-1 text-caption font-semibold text-muted">{{ unit }}</span>
  </div>
</template>
