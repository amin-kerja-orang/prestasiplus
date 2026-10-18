<script setup lang="ts">
/**
 * Reward chip (design system 6, "Reward chip"): a neutral pill with a coloured reward icon (or a
 * 3D image) and a display number, plus an optional small label from `md` up. Staff views pass an
 * `icon` (kobalt glyph, no orange); learner views may pass `art`.
 */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsIcon from './DsIcon.vue'

withDefaults(
  defineProps<{
    value: string | number
    /** Phosphor base name (see `DsIcon`). Ignored when `art` is set. */
    icon?: string
    art?: Art3DName
    /** Small label after the number, shown from `md` up (BM). */
    label?: string
    /** Navbar chip: 32px, flat, same surface as the other quiet chips (no shadow, no display face). */
    quiet?: boolean
  }>(),
  { icon: undefined, art: undefined, label: undefined, quiet: false },
)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full"
    :class="
      quiet
        ? 'h-8 gap-1.5 bg-elevated pr-3 pl-2'
        : 'min-h-9 gap-1 bg-default py-1 pr-2 pl-1.5 shadow-ds-xs sm:gap-2 sm:pr-3 sm:pl-2 learner:shadow-lift'
    "
    data-ds="reward-chip"
  >
    <DsArt3D v-if="art" :name="art" size="xs" />
    <DsIcon
      v-else-if="icon"
      :name="icon"
      class="size-5 text-flame staff:text-ic-theme"
      aria-hidden="true"
    />
    <span
      class="tabular text-label text-highlighted"
      :class="quiet ? 'font-semibold' : 'font-display font-extrabold'"
      >{{ value }}</span
    >
    <span v-if="label" class="hidden text-caption text-muted md:inline">{{ label }}</span>
  </span>
</template>
