<script setup lang="ts">
/** Product gallery: main image plus a thumbnail strip (product images stay images, D-RS-5). */
import { computed, ref, watch } from 'vue'

import { DsArt3D } from '@/ds'

import type { ProductImage } from '../../api'

const props = defineProps<{ images: readonly ProductImage[]; name: string }>()

const active = ref(0)
watch(
  () => props.images,
  () => {
    active.value = 0
  },
)
const main = computed(() => props.images[active.value] ?? null)
</script>

<template>
  <UCard class="min-w-0" data-testid="product-gallery">
    <div class="flex flex-col gap-3">
      <DsArt3D
        v-if="main"
        variant="plain"
        :src="main.url"
        :alt="name"
        ratio="square"
        data-testid="gallery-main"
      />
      <div v-else class="grid aspect-square w-full place-items-center bg-muted">
        <UIcon
          name="i-ph-package-duotone"
          class="size-16 text-muted"
          aria-hidden="true"
          data-testid="gallery-placeholder"
        />
      </div>
      <div
        v-if="images.length > 0"
        class="grid grid-cols-4 gap-2 sm:grid-cols-5"
        data-testid="gallery-thumbs"
      >
        <UButton
          v-for="(image, index) in images"
          :key="image.id"
          type="button"
          :color="index === active ? 'primary' : 'neutral'"
          :variant="index === active ? 'solid' : 'soft'"
          class="aspect-square min-h-11 p-1"
          :aria-label="`${name} ${index + 1}`"
          :aria-pressed="index === active"
          :data-active="index === active ? 'true' : 'false'"
          data-testid="gallery-thumb"
          @click="active = index"
        >
          <DsArt3D variant="plain" :src="image.url" alt="" ratio="square" />
        </UButton>
      </div>
    </div>
  </UCard>
</template>
