<script setup lang="ts">
/**
 * Character card (design system 3.3 and 6): a meaning-coloured surface (a low mix over the raised
 * card) with a solid icon chip or 3D art, a title, one muted line and a solid accent CTA. Variants:
 * trial (amber), warning (orange), info (violet), win (lime), action (blue).
 */
import { computed } from 'vue'

import { accentSolid, accentTint } from './accent'
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsIconChip from './DsIconChip.vue'
import type { DsAccent } from './types'

type CardVariant = 'trial' | 'warning' | 'info' | 'win' | 'action'

const props = withDefaults(
  defineProps<{
    variant?: CardVariant
    title: string
    description?: string
    /** Phosphor icon for the solid chip. Ignored when `art` is set. */
    icon?: string
    /** 3D art instead of the chip. */
    art?: Art3DName
    ctaLabel?: string
  }>(),
  {
    variant: 'action',
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
const accent = computed(() => accentOf[props.variant])
</script>

<template>
  <article
    class="relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-sheet bg-default p-4 shadow-ds-xs learner:shadow-lift"
    :data-variant="variant"
    data-ds="character-card"
  >
    <span
      class="pointer-events-none absolute inset-0"
      :class="accentTint[accent]"
      aria-hidden="true"
    />
    <div class="relative flex items-start gap-3">
      <DsArt3D v-if="art" :name="art" size="lg" float />
      <DsIconChip v-else-if="icon" :icon="icon" :accent="accent" size="lg" />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h3 class="font-display text-subheading font-bold text-highlighted">{{ title }}</h3>
        <p v-if="description" class="text-label text-muted">{{ description }}</p>
        <slot />
      </div>
    </div>
    <UButton
      v-if="ctaLabel"
      :color="variant === 'action' ? 'primary' : 'neutral'"
      variant="solid"
      size="lg"
      block
      class="relative"
      :class="variant === 'action' ? '' : accentSolid[accent]"
      data-ds="card-cta"
      @click="$emit('cta')"
      >{{ ctaLabel }}</UButton
    >
  </article>
</template>
