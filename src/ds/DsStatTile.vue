<script setup lang="ts">
/**
 * Stat tile (design system 6, "Stat tile"; design language 3 and 7.2): icon chip or a 3D reward
 * image, a tabular number, the label and an optional `sub` line and `delta`. With `to` the whole
 * tile is a link that lifts on hover. Staff gets the quieter shadow and tinted chip through the
 * personality variants and a short `rise` entry that plays once per page load; learner keeps the
 * full `rise`.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import type { Art3DName } from './assets'
import { dsCopy } from './copy'
import DsArt3D from './DsArt3D.vue'
import DsIcon from './DsIcon.vue'
import DsIconChip from './DsIconChip.vue'
import { usePersonality } from './personality'
import { staffRiseAllowed } from './rise'
import type { DsAccent } from './types'

export interface StatDelta {
  /** Display text, e.g. `+4.2%`. */
  value: string
  dir: 'up' | 'down' | 'flat'
}

const props = withDefaults(
  defineProps<{
    value: string | number
    /** Label under the number (BM, from the caller). */
    unit: string
    /** Small supporting line under the label (caption). */
    sub?: string
    /** Phosphor base name for the chip (full `i-ph-*` classes still work). Ignored when `art` is set. */
    icon?: string
    accent?: DsAccent
    /** Semantic KPI tint of the chip (risk counts); otherwise the accent. */
    tone?: 'success' | 'warning' | 'error' | 'info'
    /** 3D reward image instead of the chip (learner "Ganjaran 3D"). */
    art?: Art3DName
    /** Row layout for KPI strips: chip left, number and unit stacked (staff lists). */
    compact?: boolean
    /** Report size: roomy padding and a larger number (admin KPI strips). */
    roomy?: boolean
    /** Token colour class of the number (a focus point), e.g. 'text-primary'. */
    valueClass?: string
    /** Makes the tile a link. */
    to?: RouteLocationRaw
    delta?: StatDelta
    /** Skeleton in place of the content. */
    loading?: boolean
    /** The tile is a button (a drill-down that is not a route); the caller listens to `click`. */
    clickable?: boolean
  }>(),
  {
    sub: undefined,
    icon: undefined,
    accent: 'action',
    tone: undefined,
    art: undefined,
    compact: false,
    roomy: false,
    valueClass: 'text-highlighted',
    to: undefined,
    delta: undefined,
    loading: false,
    clickable: false,
  },
)

const personality = usePersonality()
// Decided once per tile at mount; non-reactive on purpose (the entry is a one-shot).
const riseOff = !staffRiseAllowed()
const chipSize = computed(() => (props.roomy ? (personality.value === 'staff' ? 'lg' : 'sm') : 'md'))

const deltaIcon = { up: 'arrow-up', down: 'arrow-down', flat: 'minus' } as const
const deltaTone = { up: 'text-success', down: 'text-error', flat: 'text-muted' } as const
const deltaWord = { up: dsCopy.deltaUp, down: dsCopy.deltaDown, flat: dsCopy.deltaFlat } as const
</script>

<template>
  <div
    v-if="compact"
    class="flex min-w-0 items-center gap-3 rounded-card bg-default p-3 shadow-ds-xs sm:gap-4 sm:p-4"
    data-ds="stat-tile"
    data-compact="true"
  >
    <DsIconChip v-if="icon" :icon="icon" :accent="accent" :tone="tone" size="md" />
    <div class="flex min-w-0 flex-col">
      <span
        class="tabular truncate font-display text-heading leading-tight font-extrabold"
        :class="valueClass"
        >{{ value }}</span
      >
      <span class="truncate text-label font-semibold text-muted">{{ unit }}</span>
    </div>
  </div>
  <component
    :is="to ? RouterLink : clickable ? 'button' : 'div'"
    v-else
    v-bind="to ? { to } : clickable ? { type: 'button' } : {}"
    class="flex min-w-0 animate-ds-rise flex-col items-start rounded-card bg-default shadow-ds-xs motion-reduce:animate-none learner:shadow-lift"
    :class="[
      clickable ? 'cursor-pointer text-start' : '',
      roomy ? 'gap-3 p-6' : 'gap-2 px-2.5 pt-3.5 pb-3',
      riseOff ? 'staff:animate-none' : 'staff:animate-ds-rise-quick',
    ]"
    data-ds="stat-tile"
    :aria-busy="loading ? 'true' : undefined"
  >
    <template v-if="loading">
      <USkeleton class="size-8 rounded-chip" />
      <USkeleton class="h-7 w-20" />
      <USkeleton class="h-4 w-24" />
    </template>
    <template v-else>
      <DsArt3D v-if="art" :name="art" size="md" />
      <DsIconChip
        v-else-if="icon"
        :icon="icon"
        :accent="accent"
        :tone="tone"
        :size="chipSize"
      />
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
      <span v-if="sub" class="text-caption text-muted" data-ds="stat-tile-sub">{{ sub }}</span>
      <span
        v-if="delta"
        class="tabular inline-flex items-center gap-1 text-caption font-semibold"
        :class="deltaTone[delta.dir]"
        data-ds="stat-tile-delta"
      >
        <DsIcon :name="deltaIcon[delta.dir]" weight="bold" class="size-4" />
        <span class="sr-only">{{ deltaWord[delta.dir] }}</span>
        {{ delta.value }}
      </span>
    </template>
  </component>
</template>
