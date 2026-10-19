<script setup lang="ts">
/**
 * S17 `/video` "Video Pembelajaran" (M09-T3; FR-M09-76..82, BR-M09-18/19, URS FT-M09-6.1/6.2).
 *
 * Logged in: the user shell shows the header (route meta). Guest: the F-20 public layout wraps this
 * page, which adds the hero. Both share the GET search form, the category and subject pills (from
 * `meta.facets`), the card grid and the pager. The query string is the state.
 *
 * Pills (OBSERVED): a category pill is `?subject=&category=` with an active subject, a subject pill
 * is `?category=&subject=` with an active category; subject pills ignore the active subject (no
 * active style, full counts) and "Reset Subjek" clears it. A zero-count pill is not a link (DV-M09-10).
 *
 * v2 restyle (B04): `DsPage` + `DsMediaCard` grid, token colours only; the personality (learner
 * Elektrik / staff kobalt) comes from the shell.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsArt3D, DsEmptyState, DsLoadError, DsPage, DsCluster, DsHeading, DsText } from '@/ds'
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

const { data, error, reload } = useApi(
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

function pageTo(page: number) {
  return { path: VIDEO_PATH, query: { ...pagerQuery.value, page: String(page) } }
}

function goToPage(page: number): void {
  void router.push(pageTo(page))
}
</script>

<template>
  <DsPage
    :title="session.isLoggedIn ? COPY.listTitle : undefined"
    :subtitle="session.isLoggedIn ? COPY.listSubtitle : undefined"
    data-testid="video-list-page"
  >
    <!-- Guest hero (URS FN-M09-6.2.2). -->
    <header
      v-if="!session.isLoggedIn"
      class="flex flex-col items-center gap-3 py-4 text-center"
      data-testid="video-guest-hero"
    >
      <DsArt3D name="rocket" size="xl" float />
      <UBadge color="primary" variant="solid" :label="COPY.guestChip" />
      <DsHeading :level="1">
        {{ COPY.guestHeading }}
      </DsHeading>
      <DsText variant="body" tone="muted" class="max-w-prose">{{ COPY.guestBody }}</DsText>
    </header>

    <form
      method="get"
      :action="VIDEO_PATH"
      class="w-full max-w-2xl self-center"
      role="search"
      data-testid="video-search-form"
      @submit.prevent="submitSearch"
    >
      <UInput
        v-model="search"
        type="text"
        name="search"
        size="xl"
        icon="i-ph-magnifying-glass-duotone"
        :placeholder="COPY.searchPlaceholder"
        aria-label="Cari video"
        class="w-full"
        data-testid="video-search"
      />
    </form>

    <DsLoadError
      v-if="error"
      :message="errorLines(error).join(' ')"
      testid="video-list-error"
      @retry="reload()"
    />

    <template v-else-if="data && facets">
      <!-- Category pills (BR-M09-18). -->
      <DsCluster
        as="nav"
        gap="xs"
        align="stretch"
        aria-label="Kategori video"
        data-testid="video-category-pills"
      >
        <UButton
          :to="facets.total > 0 ? allHref : undefined"
          :disabled="facets.total === 0"
          :color="applied.category === '' ? 'primary' : 'neutral'"
          :variant="applied.category === '' ? 'solid' : 'soft'"
          data-testid="video-category-pill"
          data-code="all"
          >{{ COPY.all }} <span class="tabular">({{ facets.total }})</span></UButton
        >
        <UButton
          v-for="c in facets.categories"
          :key="c.code"
          :to="c.count > 0 ? categoryHref(c.code) : undefined"
          :disabled="c.count === 0"
          :color="applied.category === c.code ? 'primary' : 'neutral'"
          :variant="applied.category === c.code ? 'solid' : 'soft'"
          data-testid="video-category-pill"
          :data-code="c.code"
          >{{ c.label }} <span class="tabular">({{ c.count }})</span></UButton
        >
      </DsCluster>

      <!-- Subject pills: counts ignore the active subject (OBSERVED). -->
      <DsCluster
        v-if="facets.subjects.length > 0 || applied.subject !== undefined"
        as="nav"
        gap="xs"
        align="stretch"
        aria-label="Subjek video"
        data-testid="video-subject-pills"
      >
        <UButton
          v-for="s in facets.subjects"
          :key="s.id"
          :to="subjectHref(s.id)"
          color="neutral"
          variant="outline"
          size="sm"
          class="min-h-11"
          data-testid="video-subject-pill"
          :data-subject-id="s.id"
          >{{ s.name }} <span class="tabular">({{ s.count }})</span></UButton
        >
        <UButton
          v-if="applied.subject !== undefined"
          :to="VIDEO_PATH"
          color="error"
          variant="ghost"
          size="sm"
          icon="i-ph-x"
          class="min-h-11"
          data-testid="video-reset-subject"
          >{{ COPY.resetSubject }}</UButton
        >
      </DsCluster>

      <DsCluster v-if="session.isLoggedIn" gap="none" align="stretch" justify="end" :wrap="false">
        <UButton :to="VIDEO_ADD_PATH" icon="i-ph-plus-bold" data-testid="video-add">{{
          COPY.add
        }}</UButton>
      </DsCluster>

      <DsEmptyState
        v-if="videos.length === 0"
        :title="COPY.emptyTitle"
        :description="COPY.emptyBody"
        icon="i-ph-film-slate-duotone"
        data-testid="video-empty"
      >
        <template #actions>
          <UButton :to="VIDEO_PATH" icon="i-ph-arrow-left" data-testid="video-empty-action">{{
            COPY.emptyAction
          }}</UButton>
        </template>
      </DsEmptyState>

      <ul
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="video-grid"
      >
        <li v-for="video in videos" :key="video.id" class="min-w-0">
          <VideoCard :video="video" />
        </li>
      </ul>

      <DsCluster
        v-if="total > data.meta.pageSize"
        gap="none"
        align="stretch"
        justify="center"
        :wrap="false"
        class="max-w-full overflow-x-auto"
        data-testid="video-pager"
      >
        <UPagination
          :sibling-count="0"
          :page="applied.page"
          :total="total"
          :items-per-page="data.meta.pageSize"
          :to="pageTo"
          :prev="{ 'aria-label': 'Sebelum' }"
          :next="{ 'aria-label': 'Seterusnya' }"
          @update:page="goToPage"
        />
      </DsCluster>
    </template>
  </DsPage>
</template>
