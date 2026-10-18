<script setup lang="ts">
/**
 * Table thumbnail (16:9, 64px wide): the image, or a tinted icon tile when there is none.
 */
import DsArt3D from './DsArt3D.vue'

withDefaults(defineProps<{ src?: string; alt?: string }>(), { src: undefined, alt: '' })
</script>

<template>
  <div class="w-16 shrink-0 overflow-clip rounded-chip" data-ds="thumb">
    <DsArt3D v-if="src" variant="plain" ratio="video" :src="src" :alt="alt" />
    <div
      v-else
      class="grid aspect-video place-items-center bg-primary/10 text-primary-t"
      aria-hidden="true"
    >
      <UIcon name="i-ph-image" class="size-5" />
    </div>
  </div>
</template>
