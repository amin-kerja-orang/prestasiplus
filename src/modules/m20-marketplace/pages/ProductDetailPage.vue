<script setup lang="ts">
/**
 * S7 `/marketplace/:slug` (FR-M20-55..61; URS FT-M20-4.2): back link, gallery, details card, "Penjual"
 * card (right column under the details card), "Ulasan ({n})" and "Produk Berkaitan". The page
 * fetches #15 once per slug; #15 adds a view on every call (BR-M20-12), so the page shows the
 * post-increment `views` and never refetches on its own.
 * The shell header is "Marketplace" / {category} and the tab "{product} - Marketplace PRESTASIPLUS".
 * An unknown or hidden slug renders the in-place 404 page.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { DsPage, DsLoadError, DsBackLink, DsStack, DsGrid } from '@/ds'

import { fetchMarketplaceProduct } from '../api'
import { DETAIL_COPY } from '../components/detail/copy'
import ProductGallery from '../components/detail/ProductGallery.vue'
import ProductInfo from '../components/detail/ProductInfo.vue'
import RelatedProducts from '../components/detail/RelatedProducts.vue'
import ReviewsCard from '../components/detail/ReviewsCard.vue'
import SellerPanel from '../components/detail/SellerPanel.vue'
import { MARKETPLACE_COPY } from '../components/product/copy'

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
  <DsPage v-else data-testid="product-page">
    <DsBackLink to="/marketplace" :label="MARKETPLACE_COPY.back" data-testid="marketplace-back" />
    <DsLoadError
      v-if="failed"
      :message="MARKETPLACE_COPY.loadFailed"
      testid="m20-load-error"
      retry-testid="m20-retry"
      @retry="product.reload"
    />
    <DsStack
      v-else-if="!product.data.value"
      gap="sm"
      aria-busy="true"
      data-testid="product-loading"
    >
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-40 w-full" />
    </DsStack>
    <template v-else>
      <DsGrid :cols="{ base: 1, md: 2 }">
        <ProductGallery :images="product.data.value.images" :name="product.data.value.name" />
        <DsStack>
          <ProductInfo :product="product.data.value" />
          <SellerPanel :seller="product.data.value.seller" />
        </DsStack>
      </DsGrid>
      <ReviewsCard :reviews="product.data.value.reviews" :count="product.data.value.reviewCount" />
      <RelatedProducts :products="product.data.value.related" />
    </template>
  </DsPage>
</template>
