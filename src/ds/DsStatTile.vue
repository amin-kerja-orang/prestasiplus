<script setup lang="ts">
/**
 * Stat tile (design system 6, "Stat tile"; design language 3 and 7.2): icon chip or a 3D reward
 * image, a tabular number, the label and an optional `sub` line and `delta`. With `to` the whole
 * tile is a link that lifts on hover. Staff gets the quieter shadow and tinted chip through the
 * personality variants and a short `rise` entry that plays once per page load; learner keeps the
 * full `rise`. States: hover (link), focus-visible, active, selected, disabled, loading, error.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import './states.css'

import type { Art3DName } from './assets'
import { dsCopy } from './copy'
import { warnDeprecated } from './deprecate'
import DsArt3D from './DsArt3D.vue'
import DsIcon from './DsIcon.vue'
import DsIconChip from './DsIconChip.vue'
import { usePersonality } from './personality'
import { staffRiseAllowed } from './rise'
import type { DsAccent, DsIconProp, DsTileDensity, DsTone, DsValueTone } from './types'
import { resolveValueClass } from './valueTone'

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
    /** Phosphor base name for the chip (full `i-ph-*` classes are deprecated). Ignored when `art` is set. */
    icon?: DsIconProp
    accent?: DsAccent
    /** Semantic KPI tint of the chip (risk counts); otherwise the accent. */
    tone?: DsTone
    /** 3D reward image instead of the chip (learner "Ganjaran 3D"). */
    art?: Art3DName
    /**
     * `compact` = row layout for KPI strips (chip left, number and unit stacked, staff lists);
     * `roomy` = report size (roomy padding, larger number, admin KPI strips).
     */
    density?: DsTileDensity
    /** @deprecated use `density="compact"`. */
    compact?: boolean
    /** @deprecated use `density="roomy"`. */
    roomy?: boolean
    /** Colour of the number (a focus point). */
    valueTone?: DsValueTone
    /** @deprecated use `valueTone`. */
    valueClass?: string
    /** Framed with a primary ring (the tile of the applied filter). */
    selected?: boolean
    /** Not available: dimmed, no hover, not clickable. */
    disabled?: boolean
    /** Failed to load: error ring and the `errorLabel` line. */
    error?: boolean
    errorLabel?: string
    /** Makes the tile a link. */
    to?: RouteLocationRaw
    delta?: StatDelta
    /** Skeleton in place of the content. */
    loading?: boolean
    /** Test-id prefix of the parts (`<prefix>-value`, `-label`, `-sub`) for tests that read the figures. */
    partPrefix?: string
    /** Test ids of the number and the `sub` line (modules whose tests address them). */
    valueTestid?: string
    subTestid?: string
    /** The tile is a button (a drill-down that is not a route); the caller listens to `click`. */
    clickable?: boolean
  }>(),
  {
    sub: undefined,
    icon: undefined,
    accent: 'action',
    tone: undefined,
    art: undefined,
    density: undefined,
    compact: false,
    roomy: false,
    valueTone: undefined,
    valueClass: undefined,
    selected: false,
    disabled: false,
    error: false,
    errorLabel: dsCopy.loadError,
    to: undefined,
    delta: undefined,
    loading: false,
    partPrefix: undefined,
    valueTestid: undefined,
    subTestid: undefined,
    clickable: false,
  },
)

if (props.compact) warnDeprecated('DsStatTile', 'compact', 'density="compact"')
if (props.roomy) warnDeprecated('DsStatTile', 'roomy', 'density="roomy"')
if (props.valueClass) warnDeprecated('DsStatTile', 'valueClass', 'valueTone')

const size = computed<DsTileDensity>(
  () => props.density ?? (props.compact ? 'compact' : props.roomy ? 'roomy' : 'default'),
)
const isCompact = computed(() => size.value === 'compact')
const isRoomy = computed(() => size.value === 'roomy')
const numberClass = computed(() => resolveValueClass(props.valueTone, props.valueClass))
const interactive = computed(() => Boolean(props.to) || props.clickable)
/** Ring and pressed / disabled looks shared by the link, button and static forms. */
const stateClass = computed(() => [
  props.disabled ? 'pointer-events-none opacity-50' : '',
  interactive.value
    ? 'active:opacity-90'
    : '',
])
const stateAttr = computed(() =>
  props.error ? 'error' : props.disabled ? 'disabled' : props.selected ? 'selected' : undefined,
)

function part(name: 'value' | 'label' | 'sub'): string | undefined {
  return props.partPrefix ? `${props.partPrefix}-${name}` : undefined
}

const personality = usePersonality()
// Decided once per tile at mount; non-reactive on purpose (the entry is a one-shot).
const riseOff = !staffRiseAllowed()
// Staff: one 40px chip beside the number (the tile hugs its content); learner keeps the stacked tile.
const chipSize = computed(() =>
  personality.value === 'staff' ? 'lg' : isRoomy.value ? 'sm' : 'md',
)

const deltaIcon = { up: 'arrow-up', down: 'arrow-down', flat: 'minus' } as const
const deltaTone = { up: 'text-success', down: 'text-error', flat: 'text-muted' } as const
const deltaWord = { up: dsCopy.deltaUp, down: dsCopy.deltaDown, flat: dsCopy.deltaFlat } as const
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    v-if="isCompact"
    v-bind="to ? { to } : {}"
    class="flex min-w-0 items-center gap-3 rounded-card bg-default p-4 shadow-ds-xs max-sm:flex-col max-sm:items-start max-sm:gap-2 sm:gap-4 staff:p-4 md:staff:p-5"
    :class="[to ? 'hover:bg-elevated' : '', stateClass]"
    data-ds="stat-tile"
    data-compact="true"
    :data-state="stateAttr"
    :aria-busy="loading ? 'true' : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    :aria-current="selected ? 'true' : undefined"
  >
    <template v-if="loading">
      <USkeleton class="size-10 rounded-chip" />
      <USkeleton class="h-10 w-24" />
    </template>
    <template v-else>
      <DsIconChip v-if="icon" :icon="icon" :accent="accent" :tone="tone" :size="chipSize" />
      <div class="flex min-w-0 flex-col gap-0.5">
        <span
          class="tabular truncate font-display text-heading learner:font-extrabold staff:text-kpi"
          :class="numberClass"
          :data-testid="valueTestid ?? part('value')"
          >{{ value }}</span
        >
        <span
          class="line-clamp-2 text-caption font-semibold text-muted staff:text-body staff:font-medium"
          :data-testid="part('label')"
          >{{ unit }}</span
        >
        <span
          v-if="sub"
          class="line-clamp-3 text-caption text-muted"
          data-ds="stat-tile-sub"
          :data-testid="subTestid ?? part('sub')"
          >{{ sub }}</span
        >
        <span
          v-if="error"
          class="truncate text-caption text-error"
          role="alert"
          data-ds="stat-tile-error"
          >{{ errorLabel }}</span
        >
      </div>
    </template>
  </component>
  <component
    :is="to ? RouterLink : clickable ? 'button' : 'div'"
    v-else
    v-bind="to ? { to } : clickable ? { type: 'button', disabled: disabled || undefined } : {}"
    class="flex min-w-0 animate-ds-rise flex-col items-start rounded-card bg-default shadow-ds-xs motion-reduce:animate-none learner:shadow-lift staff:p-4 sm:staff:flex-row sm:staff:items-center sm:staff:gap-4 md:staff:p-5"
    :class="[
      clickable ? 'cursor-pointer text-start' : '',
      isRoomy ? 'gap-3 p-6' : 'gap-2 px-2.5 pt-3.5 pb-3',
      riseOff ? 'staff:animate-none' : 'staff:animate-ds-rise-quick',
      stateClass,
    ]"
    data-ds="stat-tile"
    :data-state="stateAttr"
    :aria-busy="loading ? 'true' : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    :aria-current="selected ? 'true' : undefined"
  >
    <template v-if="loading">
      <USkeleton class="size-10 rounded-chip" />
      <div class="flex flex-col gap-1.5">
        <USkeleton class="h-7 w-20" />
        <USkeleton class="h-4 w-24" />
      </div>
    </template>
    <template v-else>
      <DsArt3D v-if="art" :name="art" size="md" />
      <DsIconChip v-else-if="icon" :icon="icon" :accent="accent" :tone="tone" :size="chipSize" />
      <div class="flex min-w-0 flex-col items-start gap-2 staff:gap-0.5">
        <span
          class="tabular font-display font-extrabold staff:text-kpi"
          :class="[numberClass, isRoomy ? 'text-title' : 'text-heading']"
          :data-testid="valueTestid ?? part('value')"
          >{{ value }}</span
        >
        <span
          class="text-muted staff:text-body staff:font-medium"
          :class="isRoomy ? 'text-body font-medium' : '-mt-1 text-caption font-semibold staff:mt-0'"
          :data-testid="part('label')"
          >{{ unit }}</span
        >
        <span
          v-if="sub"
          class="text-caption text-muted"
          data-ds="stat-tile-sub"
          :data-testid="subTestid ?? part('sub')"
          >{{ sub }}</span
        >
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
        <span v-if="error" class="text-caption text-error" role="alert" data-ds="stat-tile-error">{{
          errorLabel
        }}</span>
        <slot />
      </div>
    </template>
  </component>
</template>
