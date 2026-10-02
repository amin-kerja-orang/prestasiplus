<script setup lang="ts">
/**
 * S17 `/video` "Video Pembelajaran" (M09-T3; FR-M09-76..82, BR-M09-18/19, URS FT-M09-6.1/6.2).
 *
 * Logged in: the user shell shows the header (route meta). Guest: the F-20 public layout wraps this
 * page, which adds the hero. Both share the GET search form, the category and subject pills (from
 * `meta.facets`), the 24-card grid and the pager. The query string is the state.
 *
 * Pills (OBSERVED): a category pill is `?subject=&category=` with an active subject, a subject pill
 * is `?category=&subject=` with an active category; subject pills ignore the active subject (no
 * active style, full counts) and "Reset Subjek" clears it. A zero-count pill is not a link (DV-M09-10).
 */
import { ArrowLeft, Plus, Search, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { LaravelPager } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { useSessionStore } from '@/stores/session'

import { fetchVideos } from '../api/content'
import type { VideoListQuery } from '../api/types'
import VideoCard from '../components/video/VideoCard.vue'
import {
  COPY,
  VIDEO_ADD_PATH,
  VIDEO_PATH,
  errorLines,
  listQuery,
  queryPage,
  queryText,
  querySubject,
  toSearchString,
} from '../lib/video'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const applied = computed(() => {
  const category = queryText(route.query.category)
  return {
    search: queryText(route.query.search).trim(),
    // An unknown category code is passed on as it is: the API answers with an empty list.
    category,
    subject: querySubject(route.query.subject),
    page: queryPage(route.query.page),
  }
})

const search = ref(queryText(route.query.search))
watch(
  () => route.query.search,
  (value) => {
    search.value = queryText(value)
  },
)

function apiQuery(): VideoListQuery {
  const a = applied.value
  const query: VideoListQuery = { search: a.search, page: a.page }
  if (a.category !== '') query.category = a.category as VideoListQuery['category']
  if (a.subject !== undefined) query.subject = a.subject
  return query
}

const { data, error } = useApi(
  (signal) => fetchVideos(apiQuery(), { signal }),
  [
    () => route.query.search,
    () => route.query.category,
    () => route.query.subject,
    () => route.query.page,
  ],
)

const videos = computed(() => data.value?.data ?? [])
const facets = computed(() => data.value?.meta.facets ?? null)
const total = computed(() => data.value?.meta.totalItems ?? 0)

const PILL =
  'inline-flex min-h-11 items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300'
const PILL_IDLE = 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
const PILL_ACTIVE = 'bg-linear-to-br from-red-500 to-orange-500 text-white shadow'
const SUBJECT_PILL =
  'inline-flex min-h-11 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300'

/** "Semua ({n})": `/video` or `/video?subject={id}` (the search is kept). */
const allHref = computed(() =>
  toSearchString(
    listQuery({ subject: applied.value.subject, search: applied.value.search }, 'subject-first'),
  ),
)

function categoryHref(code: string): string {
  return toSearchString(
    listQuery(
      { subject: applied.value.subject, category: code, search: applied.value.search },
      'subject-first',
    ),
  )
}

function subjectHref(id: number): string {
  return toSearchString(
    listQuery(
      { subject: id, category: applied.value.category, search: applied.value.search },
      'category-first',
    ),
  )
}

const pagerQuery = computed(() =>
  listQuery(
    {
      subject: applied.value.subject,
      category: applied.value.category,
      search: applied.value.search,
    },
    'subject-first',
  ),
)

function submitSearch(): void {
  const query = listQuery(
    { subject: applied.value.subject, category: applied.value.category, search: search.value },
    'subject-first',
  )
  void router.push({ path: VIDEO_PATH, query })
}

function goToPage(page: number): void {
  void router.push({ path: VIDEO_PATH, query: { ...pagerQuery.value, page: String(page) } })
}
</script>

<template>
  <div class="min-w-0 space-y-5 sm:space-y-6" data-testid="video-list-page">
    <!-- Guest hero (URS FN-M09-6.2.2). -->
    <header
      v-if="!session.isLoggedIn"
      class="py-4 text-center sm:py-6"
      data-testid="video-guest-hero"
    >
      <div class="text-4xl" aria-hidden="true">🎬 🎯</div>
      <span
        class="mt-3 inline-block rounded-full bg-red-100 px-4 py-1 text-xs font-bold tracking-wide text-red-700"
        >{{ COPY.guestChip }}</span
      >
      <h1 class="mt-3 font-heading text-3xl font-extrabold text-slate-900 sm:text-5xl">
        {{ COPY.guestHeading }}
      </h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-lg">{{ COPY.guestBody }}</p>
    </header>

    <form
      method="get"
      :action="VIDEO_PATH"
      class="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl bg-white px-4 py-1 shadow"
      data-testid="video-search-form"
      @submit.prevent="submitSearch"
    >
      <Search class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      <input
        v-model="search"
        type="text"
        name="search"
        :placeholder="COPY.searchPlaceholder"
        aria-label="Cari video"
        :class="[FORM_INPUT_CLASS, 'min-h-11 border-0 shadow-none focus:ring-0']"
        data-testid="video-search"
      />
    </form>

    <AlertBox v-if="error" :messages="errorLines(error)" data-testid="video-list-error" />

    <template v-else-if="data && facets">
      <!-- Category pills (BR-M09-18). -->
      <nav
        class="flex flex-wrap justify-center gap-2"
        aria-label="Kategori video"
        data-testid="video-category-pills"
      >
        <RouterLink
          v-if="facets.total > 0"
          :to="allHref"
          :class="[PILL, applied.category === '' ? PILL_ACTIVE : PILL_IDLE]"
          data-testid="video-category-pill"
          data-code="all"
        >
          {{ COPY.all }} <span class="font-normal opacity-70">({{ facets.total }})</span>
        </RouterLink>
        <span
          v-else
          :class="[PILL, PILL_IDLE, 'cursor-default opacity-50']"
          data-testid="video-category-pill"
          data-code="all"
        >
          {{ COPY.all }} <span class="font-normal opacity-70">({{ facets.total }})</span>
        </span>
        <template v-for="c in facets.categories" :key="c.code">
          <RouterLink
            v-if="c.count > 0"
            :to="categoryHref(c.code)"
            :class="[PILL, applied.category === c.code ? PILL_ACTIVE : PILL_IDLE]"
            data-testid="video-category-pill"
            :data-code="c.code"
          >
            {{ c.label }} <span class="font-normal opacity-70">({{ c.count }})</span>
          </RouterLink>
          <span
            v-else
            :class="[PILL, PILL_IDLE, 'cursor-default opacity-50']"
            data-testid="video-category-pill"
            :data-code="c.code"
          >
            {{ c.label }} <span class="font-normal opacity-70">({{ c.count }})</span>
          </span>
        </template>
      </nav>

      <!-- Subject pills: counts ignore the active subject (OBSERVED). -->
      <nav
        v-if="facets.subjects.length > 0 || applied.subject !== undefined"
        class="flex flex-wrap justify-center gap-2"
        aria-label="Subjek video"
        data-testid="video-subject-pills"
      >
        <RouterLink
          v-for="s in facets.subjects"
          :key="s.id"
          :to="subjectHref(s.id)"
          :class="SUBJECT_PILL"
          data-testid="video-subject-pill"
          :data-subject-id="s.id"
        >
          {{ s.name }} <span class="font-normal opacity-60">({{ s.count }})</span>
        </RouterLink>
        <RouterLink
          v-if="applied.subject !== undefined"
          :to="VIDEO_PATH"
          :class="[SUBJECT_PILL, 'text-red-600']"
          data-testid="video-reset-subject"
        >
          <X class="h-3.5 w-3.5" aria-hidden="true" />
          {{ COPY.resetSubject }}
        </RouterLink>
      </nav>

      <div v-if="session.isLoggedIn" class="flex justify-end">
        <RouterLink
          :to="VIDEO_ADD_PATH"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-linear-to-br from-red-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          data-testid="video-add"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ COPY.add }}
        </RouterLink>
      </div>

      <div
        v-if="videos.length === 0"
        class="rounded-2xl bg-white px-4 py-12 text-center shadow"
        data-testid="video-empty"
      >
        <div class="text-5xl" aria-hidden="true">🎬</div>
        <h2 class="mt-3 font-heading text-lg font-bold text-slate-800">{{ COPY.emptyTitle }}</h2>
        <p class="mt-1 text-sm text-slate-500">{{ COPY.emptyBody }}</p>
        <RouterLink
          :to="VIDEO_PATH"
          class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-linear-to-br from-red-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          data-testid="video-empty-action"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          {{ COPY.emptyAction }}
        </RouterLink>
      </div>

      <ul
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-6"
        data-testid="video-grid"
      >
        <li v-for="video in videos" :key="video.id" class="min-w-0">
          <VideoCard :video="video" />
        </li>
      </ul>

      <LaravelPager
        :page="applied.page"
        :total="total"
        :per-page="data.meta.pageSize"
        :path="VIDEO_PATH"
        :query="pagerQuery"
        @change="goToPage"
      />
    </template>
  </div>
</template>
