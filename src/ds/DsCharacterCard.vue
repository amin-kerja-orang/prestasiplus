<script setup lang="ts">
/**
 * Character card (design system 3.3 and 6): a meaning-coloured surface (a low mix over the raised
 * card) with a solid icon chip or 3D art, a title, one muted line and a solid accent CTA. Variants:
 * trial (amber), warning (orange), info (violet), win (lime), action (blue).
 */
import { computed } from 'vue'

import { accentSolid, accentTint } from './accent'
import type { Art3DName } from './assets'
import { warnDeprecated } from './deprecate'
import DsArt3D from './DsArt3D.vue'
import DsIconChip from './DsIconChip.vue'
import type { DsAccent, DsIconProp } from './types'

/** Deprecated names of the accents: `warning` = `heat`, `info` = `friend`. */
type CardVariant = 'trial' | 'warning' | 'info' | 'win' | 'action'

const props = withDefaults(
  defineProps<{
    accent?: DsAccent
    /** @deprecated use `accent` (`warning` = `heat`, `info` = `friend`). */
    variant?: CardVariant
    title: string
    description?: string
    /** Phosphor icon for the solid chip. Ignored when `art` is set. */
    icon?: DsIconProp
    /** 3D art instead of the chip. */
    art?: Art3DName
    ctaLabel?: string
  }>(),
  {
    accent: undefined,
    variant: undefined,
    description: undefined,
    icon: undefined,
    art: undefined,
    ctaLabel: undefined,
  },
)

defineEmits<{ cta: [] }>()

const accentOf: Record<CardVariant, DsAccent> = {
  trial: 'trial',
  warning: 'heat',
  info: 'friend',
  win: 'win',
  action: 'action',
}
if (props.variant) warnDeprecated('DsCharacterCard', 'variant', 'accent')
const tint = computed<DsAccent>(
  () => props.accent ?? (props.variant ? accentOf[props.variant] : 'action'),
)
</script>

<template>
  <article
    class="relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-sheet bg-default p-4 shadow-ds-xs learner:shadow-lift"
    :data-variant="accent ?? variant ?? 'action'"
    data-ds="character-card"
  >
    <span
      class="pointer-events-none absolute inset-0"
      :class="accentTint[tint]"
      aria-hidden="true"
    />
    <div class="relative flex items-start gap-3">
      <DsArt3D v-if="art" :name="art" size="lg" float />
      <DsIconChip v-else-if="icon" :icon="icon" :accent="tint" size="lg" />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h3 class="font-display text-subheading font-bold text-highlighted">{{ title }}</h3>
        <p v-if="description" class="text-label text-muted">{{ description }}</p>
        <slot />
      </div>
    </div>
    <UButton
      v-if="ctaLabel"
      :color="tint === 'action' ? 'primary' : 'neutral'"
      variant="solid"
      size="lg"
      block
      class="relative"
      :class="tint === 'action' ? '' : accentSolid[tint]"
      data-ds="card-cta"
      @click="$emit('cta')"
      >{{ ctaLabel }}</UButton
    >
  </article>
</template>
