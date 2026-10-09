<script setup lang="ts">
/**
 * S8 `/marketplace/penjual/:id` (FR-M20-62; URS FT-M20-4.3): back link, the shop card and the grid of
 * the seller's visible products (image, name, price, struck original; no badge or shipping line). An
 * unknown, hidden or non-numeric shop id renders the in-place 404 page (FR-M20-09, FR-M20-54).
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { LoadingSpinner } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

import { fetchMarketplaceShop } from '../api'
import BackLink from '../components/product/BackLink.vue'
import { SHOP_COPY } from '../components/product/copy'
import LoadError from '../components/product/LoadError.vue'
import ProductGrid from '../components/product/ProductGrid.vue'
import ShopCard from '../components/product/ShopCard.vue'

const props = defineProps<{ id: string }>()

const pageMeta = usePageMeta()
const sellerId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

const shop = useApi(
  (signal) =>
    sellerId.value === null
      ? Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
      : fetchMarketplaceShop(sellerId.value, { signal }),
  () => props.id,
)

const notFound = computed(
  () =>
    sellerId.value === null || (isApiError(shop.error.value) && shop.error.value.status === 404),
)
const failed = computed(() => shop.error.value !== null && !notFound.value)

watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)

watch(
  () => shop.data.value,
  (value) => {
    if (!value) return
    pageMeta.setHeader({ title: SHOP_COPY.headerTitle, subtitle: value.shop.shopName })
    pageMeta.setTitle(`${value.shop.shopName} - ${SHOP_COPY.tabSuffix}`)
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="notFound" />
  <div v-else class="min-w-0 space-y-5" data-testid="shop-page">
    <BackLink />
    <LoadError v-if="failed" @retry="shop.reload" />
    <div
      v-else-if="!shop.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="shop-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <ShopCard :shop="shop.data.value.shop" />
      <ProductGrid :products="shop.data.value.products" variant="simple" />
    </template>
  </div>
</template>
