<script setup lang="ts">
/** Win sticker (lime, stamp-in), e.g. "Streak 5 hari!" (design system 6, "Win screen"). */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'

defineProps<{
  /** Optional 3D glyph before the text. */
  art?: Art3DName
}>()
</script>

<template>
  <span
    class="inline-flex animate-ds-stamp items-center gap-1.5 rounded-chip bg-highlight px-4 py-2 font-display text-subheading font-extrabold text-on-highlight motion-reduce:animate-none"
    data-ds="sticker"
  >
    <DsArt3D v-if="art" :name="art" size="xs" />
    <slot />
  </span>
</template>
