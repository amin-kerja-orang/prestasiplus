<script setup lang="ts">
/**
 * Fluent Emoji 3D reward / hero art (design system 10.2). Bundled local asset. Decorative by
 * default (`alt=""` + `aria-hidden`); pass `label` only when the art is the sole carrier of meaning.
 */
import { art3dSources, type Art3DName } from './assets'

type ArtSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'

withDefaults(
  defineProps<{
    name: Art3DName
    size?: ArtSize
    /** Gentle idle bob (card art). Switched off for reduced motion. */
    float?: boolean
    label?: string
  }>(),
  { size: 'md', float: false, label: undefined },
)

const artSize: Record<ArtSize, string> = {
  xs: 'size-6.5',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-16',
  xl: 'size-19',
  hero: 'size-32',
}
</script>

<template>
  <img
    :src="art3dSources[name]"
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
