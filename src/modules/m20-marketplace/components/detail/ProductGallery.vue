<script setup lang="ts">
/**
 * S7 gallery card (FN-M20-4.2.2, FR-M20-55): the main image and one thumbnail button per image (up to
 * 5). A thumbnail click swaps the main image client-side (no request) and moves the indigo border;
 * the first thumbnail is active on load. A product without an image shows the neutral placeholder.
 */
import { Package } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

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
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-md" data-testid="product-gallery">
    <div class="aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
      <img
        v-if="main"
        :src="main.url"
        :alt="name"
        class="h-full w-full object-cover"
        data-testid="gallery-main"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-slate-300">
        <Package class="h-16 w-16" aria-hidden="true" data-testid="gallery-placeholder" />
      </div>
    </div>
    <div
      v-if="images.length > 0"
      class="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5"
      data-testid="gallery-thumbs"
    >
      <button
        v-for="(image, index) in images"
        :key="image.id"
        type="button"
        class="aspect-square min-h-11 overflow-hidden rounded-lg border-2 bg-slate-100 transition"
        :class="
          index === active ? 'border-indigo-500' : 'border-transparent hover:border-slate-300'
        "
        :data-active="index === active ? 'true' : 'false'"
        data-testid="gallery-thumb"
        @click="active = index"
      >
        <img :src="image.url" alt="" class="h-full w-full object-cover" />
      </button>
    </div>
  </section>
</template>
