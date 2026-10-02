<script setup lang="ts">
/**
 * S15 `/artikel` (FR-M09-22..30; URS FN-M09-2.1.x for a logged-in user, 2.2.x for a guest).
 *
 * One page, two presentations: the user shell (every role) and the guest public layout (hero,
 * "🔥" hot heading, "Cari artikel menarik...", "Pilih Kategori:", clock before the date). The
 * router picks the layout; this page only reads `isLoggedIn` for the guest-only copy. The query
 * string (`search`, `category`, `page`) is the state; the hot section (6 random cards) is shown
 * only when neither `search` nor `category` is set (FR-M09-28). Page size 18; the pager keeps
 * `search` and `category`.
 */
import { ArrowLeft } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { LaravelPager } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi, useSession } from '@/composables'

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

const pagerQuery = computed(() =>
  listQuery({ search: applied.value.search, category: applied.value.category }),
)

function onSearch(search: string): void {
  void router.push({
    path: ARTIKEL_PATH,
    query: listQuery({ search, category: applied.value.category }),
  })
}

function goToPage(page: number): void {
  void router.push({
    path: ARTIKEL_PATH,
    query: listQuery({ ...applied.value, page }),
  })
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
</script>

<template>
  <div class="min-w-0 space-y-6 sm:space-y-8" data-testid="artikel-list-page">
    <!-- Guest hero (FN-M09-2.2.2). -->
    <header v-if="guest" class="relative space-y-3 text-center" data-testid="artikel-hero">
      <div class="flex justify-center gap-3 text-2xl" aria-hidden="true">
        <span>📚</span><span>✨</span><span>🔥</span><span>⭐</span>
      </div>
      <p>
        <span
          class="inline-block rounded-full bg-white px-4 py-1 text-sm font-semibold text-purple-600 shadow"
          >{{ ARTIKEL_COPY.heroChip }}</span
        >
      </p>
      <h1
        class="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl"
      >
        {{ ARTIKEL_COPY.heroTitle }}
      </h1>
      <p class="mx-auto max-w-2xl text-base text-gray-600" data-testid="artikel-hero-line">
        <span class="font-bold">{{ HERO_TOPICS[0] }}</span
        >, <span class="font-bold">{{ HERO_TOPICS[1] }}</span
        >, <span class="font-bold">{{ HERO_TOPICS[2] }}</span> dan
        <span class="font-bold">{{ HERO_TOPICS[3] }}</span> untuk pelajar Malaysia!
      </p>
    </header>

    <AlertBox v-if="error" :messages="ARTIKEL_COPY.loadFailed" />

    <!-- Hot section (FR-M09-28): only without search or category. -->
    <section v-if="hot.length > 0" class="space-y-4" data-testid="artikel-hot">
      <h2 class="text-2xl font-extrabold text-gray-800" data-testid="artikel-hot-heading">
        <span v-if="guest" aria-hidden="true">🔥 </span>{{ ARTIKEL_COPY.hotHeading }}
      </h2>
      <div :class="GRID">
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
      <section
        v-if="rows.length === 0"
        class="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-md"
        data-testid="artikel-empty"
      >
        <p class="text-5xl" aria-hidden="true">🔍</p>
        <h2 class="mt-3 text-xl font-bold text-gray-800">{{ ARTIKEL_COPY.emptyTitle }}</h2>
        <p class="mt-1 text-gray-600">{{ ARTIKEL_COPY.emptyBody }}</p>
        <RouterLink
          :to="ARTIKEL_PATH"
          class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-r from-blue-500 to-purple-500 px-5 py-2 text-sm font-semibold text-white shadow"
          data-testid="artikel-empty-action"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />{{ ARTIKEL_COPY.emptyAction }}
        </RouterLink>
      </section>

      <template v-else>
        <div :class="GRID" data-testid="artikel-grid">
          <ArtikelCardView v-for="item in rows" :key="item.id" :article="item" :guest="guest" />
        </div>
        <LaravelPager
          :page="applied.page"
          :total="total"
          :per-page="ARTIKEL_PAGE_SIZE"
          :path="ARTIKEL_PATH"
          :query="pagerQuery"
          @change="goToPage"
        />
      </template>
    </template>
  </div>
</template>
