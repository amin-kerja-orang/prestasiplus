<script setup lang="ts">
/**
 * Icon chip (design system 6, "Icon chip"; design language 6.3). Learner: solid accent fill with the
 * accent's own glyph colour. Staff: 12% theme tint with a theme-coloured glyph. `tone` swaps the
 * accent for a semantic tint (risk KPIs, status). Decorative; the label next to it carries the
 * meaning. `icon` is a Phosphor base name (`funnel`; weight follows the personality) or, for one
 * more release, a full `i-ph-*` class. Sizes: staff sm 28 / md 32 / lg 40, learner sm 36 / md 40 / lg 48.
 */
import { computed } from 'vue'

import { accentChip } from './accent'
import { resolveIcon } from './icon'
import { usePersonality } from './personality'
import type { DsAccent } from './types'

type ChipSize = 'xs' | 'sm' | 'md' | 'lg'
type ChipTone = 'success' | 'warning' | 'error' | 'info'

const props = withDefaults(
  defineProps<{
    /** Phosphor base name (`fire`) or a full class (`i-ph-fire-duotone`, deprecated). */
    icon: string
    accent?: DsAccent
    /** Semantic tint instead of the accent. */
    tone?: ChipTone
    size?: ChipSize
  }>(),
  { accent: 'action', tone: undefined, size: 'md' },
)

const chipSize: Record<ChipSize, string> = {
  xs: 'size-6.5 rounded-full',
  sm: 'size-7 learner:size-9 rounded-chip',
  md: 'size-8 learner:size-10 rounded-chip',
  lg: 'size-10 learner:size-12 rounded-chip',
}
const iconSize: Record<ChipSize, string> = {
  xs: 'size-4',
  sm: 'size-4 learner:size-5',
  md: 'size-5 learner:size-6',
  lg: 'size-6 learner:size-6.5',
}
const toneChip: Record<ChipTone, string> = {
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  error: 'bg-error/12 text-error',
  info: 'bg-info/12 text-info',
}

const personality = usePersonality()
const iconName = computed(() => resolveIcon(props.icon, personality.value))
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center"
    :class="[props.tone ? toneChip[props.tone] : accentChip[props.accent], chipSize[props.size]]"
    aria-hidden="true"
    data-ds="icon-chip"
  >
    <UIcon :name="iconName" :class="iconSize[props.size]" />
  </span>
</template>
