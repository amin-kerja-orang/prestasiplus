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

import { LaravelPager } from '@/components/data'
import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

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
  <div class="min-w-0 space-y-5" data-testid="marketplace-page">
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
        class="flex justify-center py-10 text-slate-400"
        data-testid="marketplace-loading"
      >
        <LoadingSpinner :size="28" />
      </div>
      <div
        v-else-if="rows.length === 0"
        class="rounded-2xl bg-white px-4 py-12 text-center shadow-md"
        data-testid="marketplace-empty"
      >
        <p class="text-5xl" aria-hidden="true">{{ MARKETPLACE_COPY.emptyIcon }}</p>
        <h3 class="mt-3 text-lg font-bold text-slate-800">{{ MARKETPLACE_COPY.emptyTitle }}</h3>
        <p class="mt-1 text-sm text-slate-500">{{ MARKETPLACE_COPY.emptyHint }}</p>
      </div>
      <template v-else>
        <ProductGrid :products="rows" />
        <LaravelPager
          v-if="meta && meta.totalPages > 1"
          :page="page"
          :total="meta.totalItems"
          :per-page="meta.pageSize"
          path="/marketplace"
          :query="pagerQuery"
          @change="goTo"
        />
      </template>
    </template>
  </div>
</template>
