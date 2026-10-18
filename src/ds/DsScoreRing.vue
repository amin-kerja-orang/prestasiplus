<script setup lang="ts">
/**
 * Score / progress ring (design system 6, "Hero card" ring and "Win screen" ring). An SVG meter:
 * track + bar, the number in the middle, and `role="meter"` with a BM label from the caller.
 */
import { computed } from 'vue'

import { warnDeprecated } from './deprecate'

type RingSize = 'sm' | 'md' | 'lg'
/** win: lime bar (>= 3/5); action: primary bar. */
type RingAccent = 'win' | 'action'

const RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    size?: RingSize
    accent?: RingAccent
    /** White bar and track for the gradient hero card. */
    inverted?: boolean
    /** @deprecated use `accent` (`win` / `action`) and `inverted` (was `onPrimary`). */
    tone?: RingAccent | 'onPrimary'
    /** Accessible name of the meter (BM). */
    label: string
    /** Small text under the number, e.g. "daripada 5". */
    unit?: string
    /** Text for the centre; defaults to the value. */
    display?: string
  }>(),
  { max: 100, size: 'md', accent: undefined, inverted: false, tone: undefined, unit: undefined, display: undefined },
)

const ringBox: Record<RingSize, string> = { sm: 'size-21', md: 'size-34', lg: 'size-42' }
const numberSize: Record<RingSize, string> = {
  sm: 'text-subheading',
  md: 'text-title',
  lg: 'text-display',
}
if (props.tone) warnDeprecated('DsScoreRing', 'tone', 'accent / inverted')
const isInverted = computed(() => props.inverted || props.tone === 'onPrimary')
const ringAccent = computed<RingAccent>(
  () => props.accent ?? (props.tone === 'win' ? 'win' : 'action'),
)
const barTone: Record<RingAccent, string> = { win: 'text-win-ring', action: 'text-primary-t' }
const bar = computed(() => (isInverted.value ? 'text-primary-on' : barTone[ringAccent.value]))
const track = computed(() =>
  isInverted.value ? 'text-primary-on opacity-30' : 'text-muted opacity-25',
)

const clamped = computed(() => Math.min(Math.max(props.value, 0), props.max))
const offset = computed(() => CIRCUMFERENCE * (1 - (props.max > 0 ? clamped.value / props.max : 0)))
</script>

<template>
  <div
    class="relative shrink-0"
    :class="ringBox[size]"
    role="meter"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="clamped"
    data-ds="score-ring"
  >
    <svg viewBox="0 0 100 100" class="size-full" aria-hidden="true" focusable="false">
      <circle
        cx="50"
        cy="50"
        :r="RADIUS"
        fill="none"
        stroke="currentColor"
        stroke-width="9"
        :class="track"
      />
      <circle
        cx="50"
        cy="50"
        :r="RADIUS"
        fill="none"
        stroke="currentColor"
        stroke-width="9"
        stroke-linecap="round"
        transform="rotate(-90 50 50)"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="offset"
        class="transition-all duration-1000 ease-pop motion-reduce:transition-none"
        :class="bar"
        data-ds="ring-bar"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <slot>
        <span
          class="tabular font-display font-extrabold"
          :class="[numberSize[size], isInverted ? 'text-primary-on' : 'text-highlighted']"
          >{{ display ?? clamped }}</span
        >
        <span v-if="unit" class="text-overline text-muted">{{ unit }}</span>
      </slot>
    </div>
  </div>
</template>
