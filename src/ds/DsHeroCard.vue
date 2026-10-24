<script setup lang="ts">
/**
 * Hero card "Sambung latihan" (design system 6, "Hero card"): the gradient A1 card (flat primary
 * for staff) with on-primary text, an overline, title and sub line, a white pill CTA, an 84px
 * progress ring and optional 3D art overlapping the top-right corner over a soft glow. Below `sm`
 * the card gets top padding when it has art, so the text sits under the art instead of beside it.
 */
import { useId } from 'vue'

import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsScoreRing from './DsScoreRing.vue'

const props = withDefaults(
  defineProps<{
    overline: string
    title: string
    subtitle?: string
    /** Progress 0 to 100 for the ring; omit to hide the ring. */
    progress?: number
    /** Accessible name of the ring (BM), required with `progress`. */
    ringLabel?: string
    art?: Art3DName
    ctaLabel?: string
  }>(),
  {
    subtitle: undefined,
    progress: undefined,
    ringLabel: undefined,
    art: undefined,
    ctaLabel: undefined,
  },
)

defineEmits<{ cta: [] }>()

const titleId = useId()
const hasRing = () => props.progress !== undefined && !!props.ringLabel
</script>

<template>
  <article
    class="relative mt-3 flex items-center gap-4 rounded-sheet bg-gradient-primary p-4.5 text-primary-on shadow-hero"
    :class="art ? 'max-sm:pt-16' : ''"
    :aria-labelledby="titleId"
    data-ds="hero-card"
  >
    <template v-if="art">
      <span
        class="pointer-events-none absolute -top-8 right-2 size-24 rounded-full bg-primary-on/10"
        aria-hidden="true"
        data-ds="hero-glow"
      />
      <DsArt3D :name="art" size="xl" float class="pointer-events-none absolute -top-5 right-4" />
    </template>
    <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
      <span class="text-overline">{{ overline }}</span>
      <h3 :id="titleId" class="font-display text-subheading font-bold text-primary-on">{{ title }}</h3>
      <p v-if="subtitle" class="text-label font-medium">{{ subtitle }}</p>
      <slot name="cta">
        <UButton
          v-if="ctaLabel"
          color="neutral"
          variant="solid"
          size="lg"
          trailing-icon="i-ph-arrow-right-bold"
          class="mt-2.5 min-h-12 bg-primary-on text-primary-t shadow-none hover:bg-primary-on"
          data-ds="hero-cta"
          @click="$emit('cta')"
          >{{ ctaLabel }}</UButton
        >
      </slot>
    </div>
    <DsScoreRing
      v-if="hasRing()"
      :value="progress ?? 0"
      size="sm"
      tone="onPrimary"
      :label="ringLabel ?? ''"
      :display="`${progress}%`"
      class="self-end"
    />
  </article>
</template>
