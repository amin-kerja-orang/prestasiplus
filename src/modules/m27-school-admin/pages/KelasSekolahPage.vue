<script setup lang="ts">
/**
 * S8 `/admin-sekolah/kelas` "Kelas Sekolah" (SRS M27 Part B v1.8 FR-M27-111…116, 44, 49; PROPOSED screen,
 * D26, DV-M27-20: M10 `classroom` rows only). User shell; one read-only call (`GET /api/admin-sekolah/kelas`
 * with `level`, `search`, `page`; school from the session). Top to bottom: back link, the tile "Kelas Aktif"
 * and the line "{n} kelas dipaparkan", the filter bar, the table and the pager (25 per page).
 * The header sub-line (the school name) comes from the session user: #16 does not return the school.
 *
 * States: loading shows a skeleton; a 403 renders the global 403 page in place; any other failure shows
 * the server's own message. The list stays on screen while the next filter or page loads.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { useSession } from '@/composables/useSession'
import { DsBackLink, DsLoadError, DsPage, DsStatTile } from '@/ds'
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

const { data, error, loading, reload } = useApi(
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
  <DsPage data-testid="kl-page">
    <template v-if="data">
      <DsBackLink to="/admin-sekolah" label="Papan Pemuka Sekolah" data-testid="kl-crumb-back" />

      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="sm:w-64" data-testid="kl-tile">
          <DsStatTile
            :value="formatCount(data.tiles.activeClasses)"
            unit="Kelas Aktif"
            icon="chalkboard"
            accent="win"
          />
        </div>
        <p class="text-body text-muted" data-testid="kl-displayed">
          {{ formatCount(data.meta.displayed) }} kelas dipaparkan
        </p>
      </div>

      <ClassFilters :levels="data.levels" :level="level" :search="search" @apply="apply" />

      <ClassTable
        :rows="data.data"
        :from="data.meta.from ?? 1"
        :page="pageNo"
        :total="data.meta.totalItems"
        :page-size="data.meta.pageSize"
        @page="goPage"
      />
    </template>
    <DsLoadError
      v-else-if="error && !refused"
      :message="error.message"
      testid="kl-error"
      @retry="reload"
    />
    <div v-else-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="kl-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>
  </DsPage>
</template>
