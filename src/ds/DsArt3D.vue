<script setup lang="ts">
/**
 * Fluent Emoji 3D reward / hero art (design system 10.2). Bundled local asset. Decorative by
 * default (`alt=""` + `aria-hidden`); pass `label` only when the art is the sole carrier of meaning.
 * `variant="plain"` is the non-3D mode: an ordinary image (`src`, `alt`) with the card radius,
 * lazy loading and an optional ratio, so pages never use a raw `<img>`.
 */
import { computed } from 'vue'

import { art3dSources, type Art3DName } from './assets'

type ArtSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'

const props = withDefaults(
  defineProps<{
    name?: Art3DName
    size?: ArtSize
    /** Gentle idle bob (card art). Switched off for reduced motion. */
    float?: boolean
    label?: string
    variant?: '3d' | 'plain'
    /** Plain variant: image URL. */
    src?: string
    /** Plain variant: alt text (empty = decorative). */
    alt?: string
    /** Plain variant: fixed ratio, the image covers it. */
    ratio?: 'video' | 'square'
  }>(),
  {
    name: undefined,
    size: 'md',
    float: false,
    label: undefined,
    variant: '3d',
    src: undefined,
    alt: '',
    ratio: undefined,
  },
)

const artSize: Record<ArtSize, string> = {
  xs: 'size-6.5',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-16',
  xl: 'size-19',
  hero: 'size-32',
}
const source = computed(() => (props.name ? art3dSources[props.name] : undefined))
</script>

<template>
  <img
    v-if="variant === 'plain'"
    :src="src"
    :alt="alt"
    :aria-hidden="alt ? undefined : 'true'"
    data-art="plain"
    class="w-full rounded-card object-cover"
    :class="ratio === 'video' ? 'aspect-video' : ratio === 'square' ? 'aspect-square' : 'h-auto'"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
  <img
    v-else
    :src="source"
    :alt="label ?? ''"
    :aria-hidden="label ? undefined : 'true'"
    :data-art="name"
    class="shrink-0 object-contain"
    :class="[artSize[size], float && 'animate-ds-bob motion-reduce:animate-none']"
    width="128"
    height="128"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
</template>
