<script setup lang="ts">
/**
 * S8 `/admin-sekolah/kelas` "Kelas Sekolah" (SRS M27 Part B v1.8 FR-M27-111…116, 44, 49; PROPOSED screen,
 * D26, DV-M27-20: M10 `classroom` rows only). User shell; one read-only call (`GET /api/admin-sekolah/kelas`
 * with `level`, `search`, `page`; school from the session). Top to bottom: breadcrumb, the tile "Kelas Aktif"
 * and the line "{n} kelas dipaparkan", the filter card, the table and the Laravel paginator (25 per page).
 * The header sub-line (the school name) comes from the session user: #16 does not return the school.
 *
 * States: loading shows the spinner; a 403 renders the global 403 page in place; any other failure shows
 * the server's own message. The list stays on screen while the next filter or page loads.
 */
import { School } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { LaravelPager } from '@/components/data'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { useSession } from '@/composables/useSession'
import { formatCount } from '@/lib/number'

import { fetchSchoolClasses } from '../api/school-admin'
import ClassFilters from '../components/classes/ClassFilters.vue'
import ClassTable from '../components/classes/ClassTable.vue'

const TITLE = 'Kelas Sekolah'
const PATH = '/admin-sekolah/kelas'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const { user } = useSession()

const first = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : ''

const level = computed(() => first(route.query.level))
const search = computed(() => first(route.query.search))
const pageNo = computed(() => {
  const n = Number(first(route.query.page))
  return Number.isInteger(n) && n >= 1 ? n : 1
})

const { data, error, loading } = useApi(
  (signal) =>
    fetchSchoolClasses({
      level: level.value || null,
      search: search.value || null,
      page: pageNo.value,
      signal,
    }),
  [level, search, pageNo],
)

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

watch(
  () => user.value?.school?.name,
  (name) => pageMeta.setHeader({ title: TITLE, ...(name ? { subtitle: name } : {}) }),
  { immediate: true },
)

function apply(filters: { level: string; search: string }) {
  void router.push({
    path: PATH,
    query: {
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.search ? { search: filters.search } : {}),
    },
  })
}

function goPage(page: number) {
  void router.push({
    path: PATH,
    query: {
      ...(level.value ? { level: level.value } : {}),
      ...(search.value ? { search: search.value } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  })
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="kl-page">
    <template v-if="data">
      <nav class="flex min-w-0 flex-wrap items-center gap-x-2 text-sm" data-testid="kl-breadcrumb">
        <RouterLink
          to="/admin-sekolah"
          class="inline-flex min-h-11 items-center text-slate-500 hover:text-slate-700"
          data-testid="kl-crumb-back"
          >← Dashboard Sekolah</RouterLink
        >
        <span class="text-slate-300">/</span>
        <span class="font-bold text-slate-700" data-testid="kl-crumb-current">{{ TITLE }}</span>
      </nav>

      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          class="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4 shadow sm:w-64"
          data-testid="kl-tile"
        >
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"
          >
            <School class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <p
              class="text-xs font-bold tracking-wide text-slate-500 uppercase"
              data-testid="kl-tile-label"
            >
              Kelas Aktif
            </p>
            <p class="text-2xl font-bold text-slate-800" data-testid="kl-tile-value">
              {{ formatCount(data.tiles.activeClasses) }}
            </p>
          </div>
        </div>
        <p class="text-sm text-slate-600" data-testid="kl-displayed">
          {{ formatCount(data.meta.displayed) }} kelas dipaparkan
        </p>
      </div>

      <ClassFilters :levels="data.levels" :level="level" :search="search" @apply="apply" />

      <ClassTable :rows="data.data" :from="data.meta.from ?? 1" />
      <LaravelPager
        :page="pageNo"
        :total="data.meta.totalItems"
        :per-page="data.meta.pageSize"
        :path="PATH"
        :query="{ level, search }"
        @change="goPage"
      />
    </template>
    <AlertBox v-else-if="error && !refused" :messages="error.message" data-testid="kl-error" />
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="kl-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
