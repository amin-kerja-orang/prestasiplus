<script setup lang="ts">
/**
 * S7 "Produk Berkaitan" (`fa-th-large`; FN-M20-4.2.8, FR-M20-60): the other visible products of the same
 * category from #15 (at most 4), each a link to S7 with image, name and price. Hidden when empty.
 */
import { LayoutGrid } from '@lucide/vue'

import type { ProductCard } from '../../api'
import ProductGrid from '../product/ProductGrid.vue'
import { DETAIL_COPY } from './copy'

defineProps<{ products: readonly ProductCard[] }>()
</script>

<template>
  <section v-if="products.length > 0" class="min-w-0 space-y-3" data-testid="related-products">
    <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
      <LayoutGrid class="h-4 w-4 text-indigo-500" aria-hidden="true" />
      {{ DETAIL_COPY.related }}
    </h2>
    <ProductGrid :products="products" variant="related" />
  </section>
</template>
