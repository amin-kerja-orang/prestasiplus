<script setup lang="ts">
/**
 * S16 `/artikel/:slug` (FR-M09-32..39; URS FN-M09-2.3.x). Logged in: shell header = title /
 * "Artikel", breadcrumb, chips, author card, body, share card, related and (from `lg`) the "Artikel
 * Terkini" aside. Guest (L-7, provisional): the same content without breadcrumb and aside, inside
 * the guest public layout. An unknown or unpublished slug renders the standalone 404 page in place.
 *
 * Opening the page counts a view (the API increments before replying, BR-M09-07), so the page
 * fetches once per slug. The body HTML is passed through the allow-list sanitiser (SEC-M09-01)
 * before `v-html`.
 */
import { ArrowRight, Calendar, Clock, LayoutGrid, Newspaper, Star } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta, useSession } from '@/composables'
import { diffForHumans, formatDateEn } from '@/lib/time'

import { fetchArticle, fetchLatestArticles, type ArticleCard } from '../api'
import ArtikelShareCard from '../components/artikel/ArtikelShareCard.vue'
import { ARTIKEL_COPY, ARTIKEL_PATH, breadcrumbTitle } from '../lib/artikel/artikel'
import { sanitizeHtml } from '../lib/artikel/sanitize-html'

const props = defineProps<{ slug: string }>()

const { isLoggedIn } = useSession()
const pageMeta = usePageMeta()

const { data: article, error } = useApi(
  (signal) => fetchArticle(props.slug, { signal }),
  () => props.slug,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    // In-app move from an unknown slug to a valid one: show the page again.
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)

// The aside is for logged-in users from `lg` (CSS); guests never fetch it.
const { data: latestData } = useApi(
  async (signal): Promise<ArticleCard[]> =>
    isLoggedIn.value ? (await fetchLatestArticles(5, { signal })).data : [],
  () => props.slug,
)
const latest = computed(() => latestData.value ?? [])

watch(
  article,
  (value) => {
    if (value) pageMeta.setHeader({ title: value.title, subtitle: ARTIKEL_COPY.headerTitle })
  },
  { immediate: true },
)

const body = computed(() => (article.value ? sanitizeHtml(article.value.content) : ''))
const published = computed(() =>
  article.value?.publishedAt ? formatDateEn(article.value.publishedAt) : '',
)
const age = computed(() =>
  article.value?.publishedAt ? diffForHumans(article.value.publishedAt) : '',
)

const CHIP =
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white shadow'
</script>

<template>
  <div v-if="notFound" />
  <div v-else class="min-w-0" data-testid="artikel-detail-page">
    <AlertBox v-if="error" :messages="ARTIKEL_COPY.loadFailed" />

    <div v-if="article" class="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
      <article class="min-w-0 space-y-5">
        <nav
          v-if="isLoggedIn"
          class="flex flex-wrap items-center gap-2 text-sm text-gray-700"
          data-testid="artikel-breadcrumb"
        >
          <RouterLink
            to="/dashboard"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm"
          >
            <LayoutGrid class="h-4 w-4" aria-hidden="true" />{{ ARTIKEL_COPY.breadcrumbDashboard }}
          </RouterLink>
          <span class="text-pink-400" aria-hidden="true">→</span>
          <RouterLink
            :to="ARTIKEL_PATH"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm"
          >
            <Newspaper class="h-4 w-4" aria-hidden="true" />{{ ARTIKEL_COPY.breadcrumbArtikel }}
          </RouterLink>
          <span class="text-pink-400" aria-hidden="true">→</span>
          <span
            class="max-w-full rounded-full bg-linear-to-r from-purple-500 to-pink-500 px-3 py-1.5 text-xs font-bold break-words text-white"
            data-testid="artikel-breadcrumb-current"
            >{{ breadcrumbTitle(article.title) }}</span
          >
        </nav>

        <div class="flex flex-wrap items-center gap-2">
          <span
            :class="[CHIP, 'bg-linear-to-r from-blue-500 via-violet-500 to-pink-500']"
            data-testid="artikel-chip-category"
            >{{ article.categoryLabel }}</span
          >
          <span
            :class="[CHIP, 'bg-linear-to-r from-lime-500 to-green-500']"
            data-testid="artikel-chip-level"
            >{{ article.gradeLabel }}</span
          >
          <span
            v-if="article.isFeatured"
            :class="[CHIP, 'bg-linear-to-r from-amber-400 to-orange-500']"
            data-testid="artikel-chip-featured"
          >
            <Star class="h-3 w-3 fill-current" aria-hidden="true" />{{ ARTIKEL_COPY.featuredChip }}
          </span>
        </div>

        <h1
          class="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-3xl leading-tight font-extrabold break-words text-transparent sm:text-4xl"
          data-testid="artikel-title"
        >
          {{ article.title }}
        </h1>

        <p
          v-if="article.excerpt"
          class="rounded-r-xl border-l-4 border-purple-500 bg-linear-to-r from-blue-50 to-pink-50 px-4 py-3 text-lg break-words text-gray-700"
          data-testid="artikel-excerpt"
        >
          {{ article.excerpt }}
        </p>

        <div
          class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-purple-400 bg-white p-4 shadow-md"
          data-testid="artikel-author-card"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-pink-500 text-xl font-bold text-white"
              aria-hidden="true"
              data-testid="artikel-author-initial"
              >{{ article.author.initial }}</span
            >
            <div class="min-w-0">
              <p class="font-bold break-words text-gray-800" data-testid="artikel-author-name">
                {{ article.author.name }}
              </p>
              <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                <span
                  class="inline-flex items-center gap-1 whitespace-nowrap"
                  data-testid="artikel-published"
                >
                  <Calendar class="h-3 w-3" aria-hidden="true" />{{ published }}
                </span>
                <span aria-hidden="true">•</span>
                <span
                  class="inline-flex items-center gap-1 whitespace-nowrap"
                  data-testid="artikel-age"
                >
                  <Clock class="h-3 w-3" aria-hidden="true" />{{ age }}
                </span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-5 text-center">
            <p>
              <span class="text-lg font-bold text-purple-600"
                ><span aria-hidden="true">👁️</span>
                <span data-testid="artikel-views">{{ article.views }}</span></span
              ><br /><span class="text-xs text-gray-500">{{ ARTIKEL_COPY.readers }}</span>
            </p>
            <p>
              <span class="text-lg font-bold text-pink-600"
                ><span aria-hidden="true">❤️</span>
                <span data-testid="artikel-likes">{{ article.likes }}</span></span
              ><br /><span class="text-xs text-gray-500">{{ ARTIKEL_COPY.likes }}</span>
            </p>
          </div>
        </div>

        <!-- Sanitised by `sanitizeHtml` (allow-list; SEC-M09-01). -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="artikel-body" data-testid="artikel-body" v-html="body" />

        <ArtikelShareCard :title="article.title" />

        <section v-if="article.related.length > 0" class="space-y-4" data-testid="artikel-related">
          <h2 class="text-xl font-extrabold text-gray-800">
            <span aria-hidden="true">📚</span> {{ ARTIKEL_COPY.related }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <RouterLink
              v-for="item in article.related"
              :key="item.id"
              :to="`/artikel/${item.slug}`"
              class="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:-translate-y-1"
              data-testid="artikel-related-card"
            >
              <div
                class="flex h-24 items-center justify-center bg-linear-to-br from-purple-400 via-pink-400 to-orange-400 text-4xl"
                aria-hidden="true"
              >
                📰
              </div>
              <div class="flex flex-1 flex-col gap-2 p-3">
                <h3 class="text-sm font-bold break-words text-gray-800">{{ item.title }}</h3>
                <p
                  class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"
                >
                  <span class="inline-flex items-center gap-1 whitespace-nowrap">
                    <Clock class="h-3 w-3" aria-hidden="true" />{{
                      item.publishedAt ? diffForHumans(item.publishedAt) : ''
                    }}
                  </span>
                  <span class="whitespace-nowrap">👁️ {{ item.views }}</span>
                </p>
              </div>
            </RouterLink>
          </div>
        </section>
      </article>

      <aside v-if="isLoggedIn" class="mt-6 hidden lg:mt-0 lg:block" data-testid="artikel-aside">
        <div class="rounded-2xl bg-white p-4 shadow-md lg:sticky lg:top-4">
          <h2 class="mb-3 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-pink-500 text-white"
              ><Newspaper class="h-4 w-4" aria-hidden="true"
            /></span>
            {{ ARTIKEL_COPY.latest }}
          </h2>
          <ul class="space-y-3">
            <li v-for="item in latest" :key="item.id">
              <RouterLink
                :to="`/artikel/${item.slug}`"
                class="flex min-h-11 items-start gap-3"
                data-testid="artikel-aside-item"
              >
                <span
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-purple-400 to-orange-400 text-white"
                  ><Newspaper class="h-4 w-4" aria-hidden="true"
                /></span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold break-words text-gray-800">{{
                    item.title
                  }}</span>
                  <span class="block text-xs text-gray-500">{{
                    item.publishedAt ? diffForHumans(item.publishedAt) : ''
                  }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>
          <RouterLink
            :to="ARTIKEL_PATH"
            class="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-purple-600"
            data-testid="artikel-aside-all"
          >
            {{ ARTIKEL_COPY.seeAll }}<ArrowRight class="h-4 w-4" aria-hidden="true" />
          </RouterLink>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Article body: h2 / p / ol / ul ... as live; wraps at any width (no horizontal page scroll). */
.artikel-body {
  min-width: 0;
  overflow-wrap: anywhere;
  border-radius: 1rem;
  background: #fff;
  padding: 1.25rem;
  color: var(--color-gray-700);
  line-height: 1.8;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
@media (min-width: 640px) {
  .artikel-body {
    padding: 1.75rem;
  }
}
.artikel-body :deep(h1),
.artikel-body :deep(h2),
.artikel-body :deep(h3),
.artikel-body :deep(h4) {
  margin: 1.25em 0 0.5em;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-gray-800);
}
.artikel-body :deep(h2) {
  font-size: 1.25rem;
}
.artikel-body :deep(h3) {
  font-size: 1.1rem;
}
.artikel-body :deep(:first-child) {
  margin-top: 0;
}
.artikel-body :deep(p) {
  margin: 0 0 1em;
}
.artikel-body :deep(ul),
.artikel-body :deep(ol) {
  margin: 0 0 1em;
  padding-left: 1.5rem;
}
.artikel-body :deep(ul) {
  list-style: disc;
}
.artikel-body :deep(ol) {
  list-style: decimal;
}
.artikel-body :deep(li) {
  margin-bottom: 0.4em;
}
.artikel-body :deep(li)::marker {
  color: var(--color-orange-500);
}
.artikel-body :deep(a) {
  color: var(--color-purple-600);
  text-decoration: underline;
}
.artikel-body :deep(img) {
  max-width: 100%;
  height: auto;
}
.artikel-body :deep(blockquote) {
  margin: 0 0 1em;
  border-left: 4px solid var(--color-purple-400);
  padding-left: 1rem;
  color: var(--color-gray-600);
}
.artikel-body :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}
.artikel-body :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}
</style>
