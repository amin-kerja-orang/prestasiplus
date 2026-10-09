<script setup lang="ts">
/** Card grid of S6 and S8: 2 / 3 / 4 columns at 375 / 768 / 1280 (SRS M20 v1.2 §10). */
import type { ProductCard as ProductCardData } from '../../api'
import ProductCard from './ProductCard.vue'

withDefaults(
  defineProps<{ products: readonly ProductCardData[]; variant?: 'full' | 'simple' | 'related' }>(),
  { variant: 'full' },
)
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
    data-testid="product-grid"
  >
    <ProductCard v-for="p in products" :key="p.id" :product="p" :variant="variant" />
  </div>
</template>
