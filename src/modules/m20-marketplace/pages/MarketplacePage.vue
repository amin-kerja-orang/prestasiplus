<script setup lang="ts">
/**
 * S6 `/marketplace` (FR-M20-49..54; URS FT-M20-4.1): the search card, the category chips and the
 * product grid of #14, or the "Tiada Produk Dijumpai" card (no match, or a page beyond the last).
 * The four filter values live in the URL (`q`, `category`, `condition`, `sort`, `page`), so every
 * state is a bookmarkable GET link as on live. The pager appears only when there is more than one
 * page and the page has rows.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'

import { fetchMarketplaceCategories, searchMarketplaceProducts, type BuyerSort } from '../api'
import CategoryChips from '../components/product/CategoryChips.vue'
import {
  MARKETPLACE_COPY,
  readBuyerQuery,
  readPage,
  type BuyerQuery,
} from '../components/product/copy'
import LoadError from '../components/product/LoadError.vue'
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
    <LoadError v-if="failed" @retry="retry" />
    <template v-else>
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
          :title="MARKETPLACE_COPY.emptyTitle"
          :description="MARKETPLACE_COPY.emptyHint"
          icon="i-ph-storefront-duotone"
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
