<script setup lang="ts">
/**
 * S11 `/admin/soalan-gambar` "Soalan Perlu Gambar Rajah - Admin" (M04-T7; FR-M04-95..101,
 * FN-M04-5.2.1..5.2.11). The shell header carries the title and subtitle; no admin sidebar item.
 *
 * - Three stat cards (labels upper case by CSS; each list's count under the active filters, "Jumlah"
 *   their sum, DV-M04-11) and the top-10 subject pills (global under every filter, as live).
 * - GET filter (`subject_id` alphabetical, `school_id` every school A-Z, "Tapis"). The subject filter
 *   applies to both lists, the school filter to the MCQ list only.
 * - "MCQ (n)" and "Struktur (n)" sections, 20 cards each with their own pager (`mcq_page`,
 *   `str_page`; links keep the filters and drop the other list's page, DV-M04-16); a section is
 *   omitted when its count is 0. Both empty: "Semua soalan sudah lengkap dengan gambar rajah!".
 * - Upload and dismiss call the API and reload with the API `status` as the flash.
 */
import { ChartBar, Funnel, ListOrdered, PenLine } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { LaravelPager } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchDiagramAudit } from '../api/diagram-audit'
import DiagramCard from '../components/DiagramCard.vue'
import { DIAGRAMS_PATH } from '../lib/audit-routes'
import { fetchSchoolNameOptions, fetchSubjectOptions } from '../lib/lookup-options'
import { pageOf, queryText } from '../lib/route-query'
import { LOAD_ERROR, errorLines } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const applied = computed(() => ({
  subject_id: queryText(route.query.subject_id),
  school_id: queryText(route.query.school_id),
  mcq_page: pageOf(route.query.mcq_page),
  str_page: pageOf(route.query.str_page),
}))

const subjectId = ref(applied.value.subject_id)
const schoolId = ref(applied.value.school_id)
watch(applied, (a) => {
  subjectId.value = a.subject_id
  schoolId.value = a.school_id
})

const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
const { data: schools } = useApi((signal) => fetchSchoolNameOptions(signal))

const { data, error, reload } = useApi(
  (signal) =>
    fetchDiagramAudit({
      subjectId: applied.value.subject_id || null,
      schoolId: applied.value.school_id || null,
      mcqPage: applied.value.mcq_page,
      strPage: applied.value.str_page,
      signal,
    }),
  [
    () => route.query.subject_id,
    () => route.query.school_id,
    () => route.query.mcq_page,
    () => route.query.str_page,
  ],
)

const stats = computed(() => data.value?.meta.stats ?? null)
const pills = computed(() => data.value?.meta.bySubject ?? [])
const mcq = computed(() => data.value?.data.mcq ?? null)
const structured = computed(() => data.value?.data.structured ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
const allDone = computed(
  () => mcq.value !== null && structured.value !== null && stats.value?.total === 0,
)

/** Filters kept on every pager link (DV-M04-16); the other list's page is dropped. */
const pagerQuery = computed(() => ({
  subject_id: applied.value.subject_id,
  school_id: applied.value.school_id,
}))

function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (subjectId.value !== '') out.subject_id = subjectId.value
  if (schoolId.value !== '') out.school_id = schoolId.value
  return out
}

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  const current: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value))
    if (value !== '') current[key] = value
  const same =
    JSON.stringify(current) === JSON.stringify(query) &&
    !route.query.mcq_page &&
    !route.query.str_page
  // Submitting the same filter reloads the page, as a live GET form does.
  if (same) await reload()
  else await router.push({ path: DIAGRAMS_PATH, query })
}

function goToPage(param: 'mcq_page' | 'str_page', page: number): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value)) if (value !== '') query[key] = value
  void router.push({ path: DIAGRAMS_PATH, query: { ...query, [param]: String(page) } })
}

async function onDone(message: string): Promise<void> {
  await reload()
  flash.show({ type: 'success', message })
}

function onFailed(err: unknown): void {
  flash.show({ type: 'error', message: errorLines(err) })
}

const STAT_CARD = 'flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow'
const STAT_NUMBER = 'font-heading text-3xl font-bold'
const STAT_LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase'
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="diagrams-page">
    <!-- Stat cards: 2 + 1 below sm (as live), 3 across from sm. -->
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <div :class="STAT_CARD" data-testid="diagrams-stat-mcq">
        <ListOrdered class="h-5 w-5 text-orange-400" aria-hidden="true" />
        <div
          v-if="stats"
          :class="[STAT_NUMBER, 'text-orange-700']"
          data-testid="diagrams-stat-mcq-value"
        >
          {{ formatNumber(stats.mcq) }}
        </div>
        <div v-else class="my-1 h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p :class="STAT_LABEL">MCQ Perlu Gambar</p>
      </div>
      <div :class="STAT_CARD" data-testid="diagrams-stat-structured">
        <PenLine class="h-5 w-5 text-indigo-500" aria-hidden="true" />
        <div
          v-if="stats"
          :class="[STAT_NUMBER, 'text-indigo-600']"
          data-testid="diagrams-stat-structured-value"
        >
          {{ formatNumber(stats.structured) }}
        </div>
        <div v-else class="my-1 h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p :class="STAT_LABEL">Struktur Perlu Gambar</p>
      </div>
      <div :class="[STAT_CARD, 'col-span-2 sm:col-span-1']" data-testid="diagrams-stat-total">
        <ChartBar class="h-5 w-5 text-slate-500" aria-hidden="true" />
        <div
          v-if="stats"
          :class="[STAT_NUMBER, 'text-slate-700']"
          data-testid="diagrams-stat-total-value"
        >
          {{ formatNumber(stats.total) }}
        </div>
        <div v-else class="my-1 h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p :class="STAT_LABEL">Jumlah</p>
      </div>
    </section>

    <!-- Top-10 subjects by flagged MCQ count (global). -->
    <section class="rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="diagrams-by-subject">
      <h2 class="mb-3 text-xs font-bold tracking-wide text-slate-600 uppercase">
        MCQ Perlu Gambar Mengikut Mata Pelajaran
      </h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="p in pills"
          :key="p.name"
          class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-orange-700"
          data-testid="diagrams-pill"
          >{{ p.name }}: {{ formatNumber(p.count) }}</span
        >
      </div>
    </section>

    <!-- Filter (GET form): one column below sm, three across from sm. -->
    <form
      method="get"
      class="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-3 sm:p-5"
      data-testid="diagrams-filter"
      @submit.prevent="submitFilter"
    >
      <select
        v-model="subjectId"
        name="subject_id"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="diagrams-subject"
      >
        <option value="">Semua Mata Pelajaran</option>
        <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </select>
      <select
        v-model="schoolId"
        name="school_id"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="diagrams-school"
      >
        <option value="">Semua Sekolah</option>
        <option v-for="s in schools ?? []" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </select>
      <button
        type="submit"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        data-testid="diagrams-filter-submit"
      >
        <Funnel class="h-4 w-4" aria-hidden="true" />
        Tapis
      </button>
    </form>

    <div v-if="error" class="space-y-3" data-testid="diagrams-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-slate-900"
        data-testid="diagrams-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <div v-else-if="firstLoad" class="space-y-3" data-testid="diagrams-skeleton">
      <div v-for="n in 3" :key="n" class="h-24 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <template v-else>
      <p
        v-if="allDone"
        class="rounded-2xl bg-white p-8 text-center text-emerald-700 shadow"
        data-testid="diagrams-empty"
      >
        Semua soalan sudah lengkap dengan gambar rajah!
      </p>

      <section v-if="mcq && mcq.meta.totalItems > 0" class="space-y-3" data-testid="diagrams-mcq">
        <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
          <ListOrdered class="h-4 w-4 text-orange-400" aria-hidden="true" />
          MCQ ({{ mcq.meta.totalItems }})
        </h2>
        <DiagramCard
          v-for="item in mcq.items"
          :key="item.id"
          kind="mcq"
          :item="item"
          @done="onDone"
          @failed="onFailed"
        />
        <div data-testid="diagrams-mcq-pager">
          <LaravelPager
            :page="mcq.meta.page"
            :total="mcq.meta.totalItems"
            :per-page="mcq.meta.pageSize"
            :path="DIAGRAMS_PATH"
            :query="pagerQuery"
            page-param="mcq_page"
            @change="(p) => goToPage('mcq_page', p)"
          />
        </div>
      </section>

      <section
        v-if="structured && structured.meta.totalItems > 0"
        class="space-y-3"
        data-testid="diagrams-structured"
      >
        <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
          <PenLine class="h-4 w-4 text-indigo-500" aria-hidden="true" />
          Struktur ({{ structured.meta.totalItems }})
        </h2>
        <DiagramCard
          v-for="item in structured.items"
          :key="item.id"
          kind="structured"
          :item="item"
          @done="onDone"
          @failed="onFailed"
        />
        <div data-testid="diagrams-structured-pager">
          <LaravelPager
            :page="structured.meta.page"
            :total="structured.meta.totalItems"
            :per-page="structured.meta.pageSize"
            :path="DIAGRAMS_PATH"
            :query="pagerQuery"
            page-param="str_page"
            @change="(p) => goToPage('str_page', p)"
          />
        </div>
      </section>
    </template>
  </div>
</template>
