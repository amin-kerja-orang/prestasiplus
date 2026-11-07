<script setup lang="ts">
/**
 * S6 `/marketplace` (FR-M20-49..54; URS FT-M20-4.1; R1-MUR-32): the Ringgit price note, the search card, the category
 * chips and the product grid of #14, or the empty card: "Tiada produk tersedia" when no filter is active,
 * "Tiada Produk Dijumpai" when a filter matches nothing (or a page beyond the last).
 * The four filter values live in the URL (`q`, `category`, `condition`, `sort`, `page`), so every
 * state is a bookmarkable GET link as on live. The pager appears only when there is more than one
 * page and the page has rows.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage, DsLoadError, DsText } from '@/ds'

import { fetchMarketplaceCategories, searchMarketplaceProducts, type BuyerSort } from '../api'
import CategoryChips from '../components/product/CategoryChips.vue'
import {
  MARKETPLACE_COPY,
  readBuyerQuery,
  readPage,
  type BuyerQuery,
} from '../components/product/copy'
import ProductFilters from '../components/product/ProductFilters.vue'
import ProductGrid from '../components/product/ProductGrid.vue'

const route = useRoute()
const router = useRouter()

const query = computed(() => readBuyerQuery(route.query))
const page = computed(() => readPage(route.query))

const categories = useApi((signal) => fetchMarketplaceCategories({ signal }))
const products = useApi(
  (signal) =>
    searchMarketplaceProducts({
      q: query.value.q,
      category: query.value.category,
      condition:
        query.value.condition === 'new' || query.value.condition === 'used'
          ? query.value.condition
          : '',
      sort: query.value.sort as BuyerSort,
      page: page.value,
      signal,
    }),
  [query, page],
)

/** A text search, a category or a condition is applied (the sort alone is not a filter). */
const filtered = computed(
  () => query.value.q.trim() !== '' || query.value.category !== '' || query.value.condition !== '',
)

const failed = computed(() => categories.error.value !== null || products.error.value !== null)
const ready = computed(() => categories.data.value !== null && products.data.value !== null)
const rows = computed(() => products.data.value?.data ?? [])
const meta = computed(() => products.data.value?.meta ?? null)

function retry(): void {
  void categories.reload()
  void products.reload()
}

function search(next: BuyerQuery): void {
  void router.push({
    path: '/marketplace',
    query: { q: next.q, category: next.category, condition: next.condition, sort: next.sort },
  })
}

function goTo(next: number): void {
  const { page: _page, ...rest } = route.query
  void _page
  void router.push({ path: '/marketplace', query: { ...rest, page: String(next) } })
}

const pagerQuery = computed(() => ({
  q: query.value.q,
  category: query.value.category,
  condition: query.value.condition,
  sort: query.value.sort,
}))
</script>

<template>
  <DsPage data-testid="marketplace-page">
    <DsLoadError v-if="failed" :message="MARKETPLACE_COPY.loadFailed" testid="m20-load-error" retry-testid="m20-retry" @retry="retry" />
    <template v-else>
      <DsText variant="caption" data-testid="marketplace-price-note">
        {{ MARKETPLACE_COPY.priceNote }}
      </DsText>
      <ProductFilters
        v-if="categories.data.value"
        :categories="categories.data.value"
        :query="query"
        @search="search"
      />
      <CategoryChips
        v-if="categories.data.value"
        :categories="categories.data.value"
        :active="query.category"
      />

      <div
        v-if="!ready"
        class="flex flex-col gap-3"
        aria-busy="true"
        data-testid="marketplace-loading"
      >
        <USkeleton class="h-28 w-full" />
        <USkeleton class="h-40 w-full" />
      </div>
      <div v-else-if="rows.length === 0" data-testid="marketplace-empty">
        <DsEmptyState
          :title="filtered ? MARKETPLACE_COPY.noMatchTitle : MARKETPLACE_COPY.emptyTitle"
          :description="filtered ? MARKETPLACE_COPY.noMatchHint : MARKETPLACE_COPY.emptyHint"
          icon="storefront"
        />
      </div>
      <template v-else>
        <ProductGrid :products="rows" />
        <div class="flex justify-center">
          <UPagination
            v-if="meta && meta.totalPages > 1"
            :page="page"
            :total="meta.totalItems"
            :items-per-page="meta.pageSize"
            :to="(p: number) => ({ path: '/marketplace', query: { ...pagerQuery, page: String(p) } })"
            @update:page="goTo"
          />
        </div>
      </template>
    </template>
  </DsPage>
</template>
