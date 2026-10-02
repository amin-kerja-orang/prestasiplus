<script setup lang="ts">
/**
 * S8 `/admin/structured-questions` "Soalan Berstruktur" (M04-T7; FR-M04-83..87, FN-M04-4.1.1..4.1.9).
 *
 * - h1 + subtitle + "Tambah Soalan" (M10 teacher form), two stat cards and the "Agihan Mengikut
 *   Subjek" pills (whole store, unaffected by the filters).
 * - GET filter form (`subject_id`, `education_level_id`, `kbat_level`, "Cari"); "Reset" only while a
 *   filter is set. The query string is the state: the form navigates, the list follows the route.
 * - 25 rows per page; Subjek, Tgk and Markah hide below 640px and Sub-Q below 768px. The Malay
 *   counter and the English Laravel pager (keeps the filters) sit under the table.
 * - Empty: one row "Tiada soalan berstruktur ditemui" and "Menunjukkan 0 daripada 0 soalan" (DV-M04-12).
 */
import { Eye, Plus, Search } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchStructuredQuestions } from '../api/structured'
import { AUDIT_ROUTES, STRUCTURED_CREATE_PATH, STRUCTURED_LIST_PATH } from '../lib/audit-routes'
import { fetchLevelOptions, fetchSubjectOptions } from '../lib/lookup-options'
import { KBAT_FILTER_OPTIONS } from '../lib/structured-options'
import { pageOf, queryText } from '../lib/route-query'
import { LOAD_ERROR } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => ({
  subject_id: queryText(route.query.subject_id),
  education_level_id: queryText(route.query.education_level_id),
  kbat_level: queryText(route.query.kbat_level),
  page: pageOf(route.query.page),
}))

const filterActive = computed(
  () =>
    applied.value.subject_id !== '' ||
    applied.value.education_level_id !== '' ||
    applied.value.kbat_level !== '',
)

// Draft values of the form controls; re-synced when the URL changes (back/forward, reset).
const subjectId = ref(applied.value.subject_id)
const levelId = ref(applied.value.education_level_id)
const kbat = ref(applied.value.kbat_level)
watch(applied, (a) => {
  subjectId.value = a.subject_id
  levelId.value = a.education_level_id
  kbat.value = a.kbat_level
})

const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
const { data: levels } = useApi((signal) => fetchLevelOptions(signal))

const { data, error, reload } = useApi(
  (signal) =>
    fetchStructuredQuestions({
      subjectId: applied.value.subject_id || null,
      educationLevelId: applied.value.education_level_id || null,
      kbatLevel: applied.value.kbat_level || null,
      page: applied.value.page,
      signal,
    }),
  [
    () => route.query.subject_id,
    () => route.query.education_level_id,
    () => route.query.kbat_level,
    () => route.query.page,
  ],
)

const rows = computed(() => data.value?.data ?? [])
const stats = computed(() => data.value?.meta.stats ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const counter = computed(() => {
  const meta = data.value?.meta
  if (!meta) return ''
  if (meta.totalItems === 0 || meta.from == null || meta.to == null) {
    return 'Menunjukkan 0 daripada 0 soalan'
  }
  return `Menunjukkan ${formatNumber(meta.from)}–${formatNumber(meta.to)} daripada ${formatNumber(meta.totalItems)} soalan`
})

function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (subjectId.value !== '') out.subject_id = subjectId.value
  if (levelId.value !== '') out.education_level_id = levelId.value
  if (kbat.value !== '') out.kbat_level = kbat.value
  return out
}

const pagerQuery = computed(() => ({
  subject_id: applied.value.subject_id,
  education_level_id: applied.value.education_level_id,
  kbat_level: applied.value.kbat_level,
}))

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  const current: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value))
    if (value !== '') current[key] = value
  const same = JSON.stringify(current) === JSON.stringify(query) && !route.query.page
  // Submitting the same filter reloads the page, as a live GET form does.
  if (same) await reload()
  else await router.push({ path: STRUCTURED_LIST_PATH, query })
}

function goToPage(page: number): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value)) if (value !== '') query[key] = value
  void router.push({ path: STRUCTURED_LIST_PATH, query: { ...query, page: String(page) } })
}

const SKELETON_ROWS = 5
const STAT_CARD = 'flex flex-col justify-center rounded-2xl bg-white p-5 text-center shadow'
const LABEL = 'mb-1 block text-xs font-semibold text-slate-600'
const CELL_HIDE_SM = 'hidden sm:table-cell'
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="structured-page">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-slate-800 sm:text-3xl">
          Soalan Berstruktur
        </h1>
        <p class="text-sm text-slate-500">Semua soalan berstruktur SPM dalam sistem</p>
      </div>
      <RouterLink
        :to="STRUCTURED_CREATE_PATH"
        class="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:self-auto"
        data-testid="structured-add"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        Tambah Soalan
      </RouterLink>
    </div>

    <!-- Stat cards + subject distribution (whole store). -->
    <section class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <div :class="STAT_CARD" data-testid="structured-stat-total">
        <div
          v-if="stats"
          class="font-heading text-3xl font-bold text-indigo-600"
          data-testid="structured-stat-total-value"
        >
          {{ formatNumber(stats.total) }}
        </div>
        <div v-else class="mx-auto h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p class="text-sm text-slate-500">Jumlah Soalan</p>
      </div>
      <div :class="STAT_CARD" data-testid="structured-stat-published">
        <div
          v-if="stats"
          class="font-heading text-3xl font-bold text-emerald-600"
          data-testid="structured-stat-published-value"
        >
          {{ formatNumber(stats.published) }}
        </div>
        <div v-else class="mx-auto h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p class="text-sm text-slate-500">Published</p>
      </div>
      <div
        class="col-span-2 rounded-2xl bg-white p-5 text-center shadow lg:col-span-3"
        data-testid="structured-by-subject"
      >
        <h2 class="mb-3 text-sm font-semibold text-slate-600">Agihan Mengikut Subjek</h2>
        <div v-if="stats" class="flex flex-wrap justify-center gap-1.5">
          <span
            v-for="s in stats.bySubject"
            :key="s.name"
            class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
            data-testid="structured-subject-pill"
            >{{ s.name }}: <strong class="text-slate-800">{{ formatNumber(s.count) }}</strong></span
          >
        </div>
        <div
          v-else
          class="mx-auto h-16 w-full max-w-md animate-pulse rounded-lg bg-slate-100"
        ></div>
      </div>
    </section>

    <!-- Filter (GET form): one column below sm, four across from sm. -->
    <form
      method="get"
      class="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-4 sm:items-end sm:p-5"
      data-testid="structured-filter"
      @submit.prevent="submitFilter"
    >
      <div>
        <label for="structured-subject" :class="LABEL">Subjek</label>
        <select
          id="structured-subject"
          v-model="subjectId"
          name="subject_id"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="structured-subject"
        >
          <option value="">Semua Subjek</option>
          <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </select>
      </div>
      <div>
        <label for="structured-level" :class="LABEL">Tingkatan</label>
        <select
          id="structured-level"
          v-model="levelId"
          name="education_level_id"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="structured-level"
        >
          <option value="">Semua</option>
          <option v-for="l in levels ?? []" :key="l.id" :value="String(l.id)">
            {{ l.name }}
          </option>
        </select>
      </div>
      <div>
        <label for="structured-kbat" :class="LABEL">KBAT</label>
        <select
          id="structured-kbat"
          v-model="kbat"
          name="kbat_level"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="structured-kbat"
        >
          <option value="">Semua KBAT</option>
          <option v-for="o in KBAT_FILTER_OPTIONS" :key="o.value" :value="String(o.value)">
            {{ o.label }}
          </option>
        </select>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="structured-search"
        >
          <Search class="h-4 w-4" aria-hidden="true" />
          Cari
        </button>
        <RouterLink
          v-if="filterActive"
          :to="STRUCTURED_LIST_PATH"
          class="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="structured-reset"
        >
          Reset
        </RouterLink>
      </div>
    </form>

    <!-- Load failure: red box in place of the table + retry (design-system §7.4). -->
    <div v-if="error" class="space-y-3" data-testid="structured-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="structured-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <DataTableCard v-else>
      <table :class="T.table" data-testid="structured-table">
        <thead>
          <tr>
            <th scope="col" :class="T.th">#</th>
            <th scope="col" :class="T.th">Stimulus / Soalan</th>
            <th scope="col" :class="[T.th, CELL_HIDE_SM]">Subjek</th>
            <th scope="col" :class="[T.th, CELL_HIDE_SM]">Tgk</th>
            <th scope="col" :class="[T.th, 'text-center']">KBAT</th>
            <th scope="col" :class="[T.th, 'text-center', CELL_HIDE_SM]">Markah</th>
            <th scope="col" :class="[T.th, 'hidden text-center md:table-cell']">Sub-Q</th>
            <th scope="col" :class="[T.th, 'text-center']">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr
              v-for="n in SKELETON_ROWS"
              :key="n"
              :class="T.row"
              data-testid="structured-skeleton"
            >
              <td :class="T.td" colspan="8">
                <div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <tr v-else-if="rows.length === 0" :class="T.row" data-testid="structured-empty">
            <td colspan="8" class="px-4 py-12 text-center text-slate-400">
              Tiada soalan berstruktur ditemui
            </td>
          </tr>

          <template v-else>
            <tr
              v-for="row in rows"
              :key="row.id"
              :class="[T.row, 'align-middle']"
              data-testid="structured-row"
              :data-question-id="row.id"
            >
              <td :class="[T.td, 'text-slate-400']">{{ row.id }}</td>
              <td :class="[T.td, 'min-w-40 text-slate-800']">{{ row.stimulusExcerpt }}</td>
              <td :class="[T.td, CELL_HIDE_SM]">
                <span
                  v-if="row.subject"
                  class="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-indigo-700"
                  >{{ row.subject.name }}</span
                >
              </td>
              <td :class="[T.td, CELL_HIDE_SM]">{{ row.level?.name }}</td>
              <td :class="[T.td, 'text-center']">
                <span
                  class="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700"
                  data-testid="structured-kbat-pill"
                  >L{{ row.kbatLevel }}</span
                >
              </td>
              <td :class="[T.td, 'text-center', CELL_HIDE_SM]">{{ row.totalMarks }}m</td>
              <td :class="[T.td, 'hidden text-center text-slate-500 md:table-cell']">
                {{ row.subCount }}
              </td>
              <td :class="[T.td, 'text-center']">
                <RouterLink
                  :to="{ name: AUDIT_ROUTES.structuredDetail, params: { id: row.id } }"
                  class="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  data-testid="structured-view"
                >
                  <Eye class="h-4 w-4" aria-hidden="true" />
                  Lihat
                </RouterLink>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <template #footer>
        <div class="space-y-3 border-t border-slate-100 px-4 py-3" data-testid="structured-footer">
          <div v-if="data" data-testid="structured-pager">
            <LaravelPager
              :page="data.meta.page"
              :total="data.meta.totalItems"
              :per-page="data.meta.pageSize"
              :path="STRUCTURED_LIST_PATH"
              :query="pagerQuery"
              @change="goToPage"
            />
          </div>
          <p v-if="data" class="text-sm text-slate-500" data-testid="structured-counter">
            {{ counter }}
          </p>
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
