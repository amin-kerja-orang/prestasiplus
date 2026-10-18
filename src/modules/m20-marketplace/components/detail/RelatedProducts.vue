<script setup lang="ts">
/** "Produk Berkaitan" grid (hidden when there are none). */
import type { ProductCard } from '../../api'
import ProductGrid from '../product/ProductGrid.vue'
import { DETAIL_COPY } from './copy'

defineProps<{ products: readonly ProductCard[] }>()
</script>

<template>
  <section v-if="products.length > 0" class="flex min-w-0 flex-col gap-3" data-testid="related-products">
    <h2 class="flex items-center gap-2 text-heading text-highlighted">
      <UIcon name="i-ph-squares-four-duotone" class="size-5 text-primary-t" aria-hidden="true" />
      {{ DETAIL_COPY.related }}
    </h2>
    <ProductGrid :products="products" variant="related" />
  </section>
</template>
