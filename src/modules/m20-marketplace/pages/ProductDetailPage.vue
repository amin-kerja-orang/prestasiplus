<script setup lang="ts">
/**
 * S7 `/marketplace/:slug` (FR-M20-55..61; URS FT-M20-4.2): back link, gallery, details card, "Penjual"
 * card, "Ulasan ({n})" and "Produk Berkaitan". The page fetches #15 once per slug; #15 adds a view on
 * every call (BR-M20-12), so the page shows the post-increment `views` and never refetches on its own.
 * The shell header is "Marketplace" / {category} and the tab "{product} - Marketplace PRESTASIPLUS".
 * An unknown or hidden slug renders the in-place 404 page.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { LoadingSpinner } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

import { fetchMarketplaceProduct } from '../api'
import { DETAIL_COPY } from '../components/detail/copy'
import ProductGallery from '../components/detail/ProductGallery.vue'
import ProductInfo from '../components/detail/ProductInfo.vue'
import RelatedProducts from '../components/detail/RelatedProducts.vue'
import ReviewsCard from '../components/detail/ReviewsCard.vue'
import SellerPanel from '../components/detail/SellerPanel.vue'
import BackLink from '../components/product/BackLink.vue'
import LoadError from '../components/product/LoadError.vue'

const props = defineProps<{ slug: string }>()

const pageMeta = usePageMeta()
const product = useApi(
  (signal) => fetchMarketplaceProduct(props.slug, { signal }),
  () => props.slug,
)

const notFound = computed(
  () => isApiError(product.error.value) && product.error.value.status === 404,
)
const failed = computed(() => product.error.value !== null && !notFound.value)

watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    // In-app move from an unknown slug to a valid one: show the page again.
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)

watch(
  () => product.data.value,
  (value) => {
    if (!value) return
    pageMeta.setHeader({ title: DETAIL_COPY.headerTitle, subtitle: value.category.name })
    pageMeta.setTitle(`${value.name} - ${DETAIL_COPY.tabSuffix}`)
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="notFound" />
  <div v-else class="min-w-0 space-y-5" data-testid="product-page">
    <BackLink />
    <LoadError v-if="failed" @retry="product.reload" />
    <div
      v-else-if="!product.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="product-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <template v-else>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ProductGallery :images="product.data.value.images" :name="product.data.value.name" />
        <ProductInfo :product="product.data.value" />
      </div>
      <SellerPanel :seller="product.data.value.seller" />
      <ReviewsCard :reviews="product.data.value.reviews" :count="product.data.value.reviewCount" />
      <RelatedProducts :products="product.data.value.related" />
    </template>
  </div>
</template>
