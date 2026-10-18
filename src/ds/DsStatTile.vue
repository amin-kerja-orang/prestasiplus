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
    /** Report size: roomy padding and a larger number (admin KPI strips). */
    roomy?: boolean
    /** Token colour class of the number (a focus point), e.g. 'text-primary'. */
    valueClass?: string
  }>(),
  {
    icon: undefined,
    accent: 'action',
    art: undefined,
    roomy: false,
    valueClass: 'text-highlighted',
  },
)
</script>

<template>
  <div
    class="flex min-w-0 animate-ds-rise flex-col items-start rounded-card bg-default shadow-ds-xs motion-reduce:animate-none learner:shadow-lift"
    :class="roomy ? 'gap-3 p-6' : 'gap-2 px-2.5 pt-3.5 pb-3'"
    data-ds="stat-tile"
  >
    <DsArt3D v-if="art" :name="art" size="md" />
    <DsIconChip v-else-if="icon" :icon="icon" :accent="accent" :size="roomy ? 'sm' : 'md'" />
    <span
      class="tabular font-display font-extrabold"
      :class="[valueClass, roomy ? 'text-title' : 'text-heading']"
      >{{ value }}</span
    >
    <span
      class="text-muted"
      :class="roomy ? 'text-body font-medium' : '-mt-1 text-caption font-semibold'"
      >{{ unit }}</span
    >
  </div>
</template>
