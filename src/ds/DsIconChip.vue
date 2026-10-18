<script setup lang="ts">
/**
 * Solid accent icon chip (design system 6, "Icon chip"). Learner: solid accent fill with the
 * accent's own glyph colour. Staff: 12% theme tint with a theme-coloured glyph. Decorative; the
 * label next to it carries the meaning.
 */
import { accentChip } from './accent'
import type { DsAccent } from './types'

type ChipSize = 'xs' | 'sm' | 'md' | 'lg'

withDefaults(
  defineProps<{
    /** Phosphor icon class, e.g. `i-ph-fire-duotone`. */
    icon: string
    accent?: DsAccent
    size?: ChipSize
  }>(),
  { accent: 'action', size: 'md' },
)

const chipSize: Record<ChipSize, string> = {
  xs: 'size-6.5 rounded-full',
  sm: 'size-9 rounded-chip',
  md: 'size-8 learner:size-10 rounded-chip',
  lg: 'size-12 rounded-chip',
}
const iconSize: Record<ChipSize, string> = {
  xs: 'size-4',
  sm: 'size-5',
  md: 'size-5 learner:size-6',
  lg: 'size-6.5',
}
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center"
    :class="[accentChip[accent], chipSize[size]]"
    aria-hidden="true"
    data-ds="icon-chip"
  >
    <UIcon :name="icon" :class="iconSize[size]" />
  </span>
</template>
