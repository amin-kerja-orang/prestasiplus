<script setup lang="ts">
/**
 * S15 `/artikel` (FR-M09-22..30; URS FN-M09-2.1.x for a logged-in user, 2.2.x for a guest).
 *
 * One page, two presentations: the user shell (every role) and the guest public layout (hero,
 * hot heading, "Cari artikel menarik...", "Pilih Kategori:", clock before the date). The
 * router picks the layout; this page only reads `isLoggedIn` for the guest-only copy. The query
 * string (`search`, `category`, `page`) is the state; the hot section (6 random cards) is shown
 * only when neither `search` nor `category` is set (FR-M09-28). Page size 18; the pager keeps
 * `search` and `category`.
 *
 * v2 restyle (B04): `DsPage`, `DsMediaCard` grid 1/2/3, `DsEmptyState`, `UPagination`.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useSession } from '@/composables'
import { DsArt3D, DsEmptyState, DsPage } from '@/ds'

import {
  fetchArticles,
  fetchHotArticles,
  type ArticleCard,
  type ArticleListQuery,
  type HotCard,
} from '../api'
import ArtikelCardView from '../components/artikel/ArtikelCard.vue'
import ArtikelHotCardView from '../components/artikel/ArtikelHotCard.vue'
import ArtikelSearchPills from '../components/artikel/ArtikelSearchPills.vue'
import {
  ARTIKEL_COPY,
  ARTIKEL_PAGE_SIZE,
  ARTIKEL_PATH,
  HERO_TOPICS,
  listQuery,
  queryPage,
  queryText,
} from '../lib/artikel/artikel'

const route = useRoute()
const router = useRouter()
const { isLoggedIn } = useSession()
const guest = computed(() => !isLoggedIn.value)

const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  category: queryText(route.query.category),
  page: queryPage(route.query.page),
}))
const filtered = computed(() => applied.value.search !== '' || applied.value.category !== '')

const queryDeps = [() => route.query.search, () => route.query.category, () => route.query.page]

const { data, error } = useApi(
  (signal) =>
    fetchArticles(
      {
        search: applied.value.search,
        category:
          applied.value.category === ''
            ? undefined
            : (applied.value.category as ArticleListQuery['category']),
        page: applied.value.page,
      },
      { signal },
    ),
  queryDeps,
)

// A new random draw on every load, as live; skipped while searching or filtering.
const { data: hotData } = useApi(
  async (signal): Promise<HotCard[]> =>
    filtered.value ? [] : (await fetchHotArticles({ signal })).data,
  queryDeps,
)

const rows = computed<ArticleCard[]>(() => data.value?.data ?? [])
const hot = computed<HotCard[]>(() => (filtered.value ? [] : (hotData.value ?? [])))
const total = computed(() => data.value?.meta.totalItems ?? 0)
const loaded = computed(() => data.value !== null)

function onSearch(search: string): void {
  void router.push({
    path: ARTIKEL_PATH,
    query: listQuery({ search, category: applied.value.category }),
  })
}

function pageTo(page: number) {
  return { path: ARTIKEL_PATH, query: listQuery({ ...applied.value, page }) }
}

function goToPage(page: number): void {
  void router.push(pageTo(page))
}
</script>

<template>
  <DsPage
    :title="guest ? undefined : ARTIKEL_COPY.headerTitle"
    :subtitle="guest ? undefined : ARTIKEL_COPY.headerSubtitle"
    data-testid="artikel-list-page"
  >
    <!-- Guest hero (FN-M09-2.2.2). -->
    <header
      v-if="guest"
      class="flex flex-col items-center gap-3 text-center"
      data-testid="artikel-hero"
    >
      <DsArt3D name="books" size="xl" float />
      <UBadge color="primary" variant="solid" :label="ARTIKEL_COPY.heroChip" />
      <h1 class="text-title text-highlighted">
        {{ ARTIKEL_COPY.heroTitle }}
      </h1>
      <p class="max-w-prose text-body text-muted" data-testid="artikel-hero-line">
        <strong class="text-highlighted">{{ HERO_TOPICS[0] }}</strong
        >, <strong class="text-highlighted">{{ HERO_TOPICS[1] }}</strong
        >, <strong class="text-highlighted">{{ HERO_TOPICS[2] }}</strong> dan
        <strong class="text-highlighted">{{ HERO_TOPICS[3] }}</strong> untuk pelajar Malaysia!
      </p>
    </header>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-ph-warning-duotone"
      :description="ARTIKEL_COPY.loadFailed"
    />

    <!-- Hot section (FR-M09-28): only without search or category. -->
    <section v-if="hot.length > 0" class="flex flex-col gap-4" data-testid="artikel-hot">
      <h2 class="text-heading text-highlighted" data-testid="artikel-hot-heading">
        {{ ARTIKEL_COPY.hotHeading }}
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        <ArtikelHotCardView v-for="item in hot" :key="item.id" :article="item" />
      </div>
    </section>

    <ArtikelSearchPills
      :search="applied.search"
      :category="applied.category"
      :guest="guest"
      @submit="onSearch"
    />

    <template v-if="loaded">
      <!-- Empty (FR-M09-26). -->
      <DsEmptyState
        v-if="rows.length === 0"
        :title="ARTIKEL_COPY.emptyTitle"
        :description="ARTIKEL_COPY.emptyBody"
        icon="i-ph-newspaper-duotone"
        data-testid="artikel-empty"
      >
        <template #actions>
          <UButton :to="ARTIKEL_PATH" icon="i-ph-arrow-left" data-testid="artikel-empty-action">{{
            ARTIKEL_COPY.emptyAction
          }}</UButton>
        </template>
      </DsEmptyState>

      <template v-else>
        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3"
          data-testid="artikel-grid"
        >
          <ArtikelCardView v-for="item in rows" :key="item.id" :article="item" :guest="guest" />
        </div>
        <div
          v-if="total > ARTIKEL_PAGE_SIZE"
          class="flex justify-center"
          data-testid="artikel-pager"
        >
          <UPagination
            :sibling-count="0"
            :page="applied.page"
            :total="total"
            :items-per-page="ARTIKEL_PAGE_SIZE"
            :to="pageTo"
            :prev="{ 'aria-label': 'Sebelum' }"
            :next="{ 'aria-label': 'Seterusnya' }"
            @update:page="goToPage"
          />
        </div>
      </template>
    </template>
  </DsPage>
</template>
