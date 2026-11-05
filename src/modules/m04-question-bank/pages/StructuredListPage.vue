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
 *
 * `portal="guru"` (S6-T17, R1-GUR-44b) mounts the same page for teachers at `/guru/soalan-berstruktur`:
 * API-GUR-26 client, 20 rows per page, Status filter, the PRD columns and BM pager, and none of the
 * admin-only parts (stat cards, subject pills, "Tambah Soalan", KBAT filter). The default is 'admin'.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useRouteExists } from '@/composables'
import {
  DsDataTable,
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsRowActions,
  DsStatRow,
  type CardField,
  type RowAction,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchStructuredQuestions } from '../api/structured'
import { fetchGuruStructuredQuestions, namedText } from '../api/structured-guru'
import StructuredGuruList, { type GuruTableRow } from '../components/StructuredGuruList.vue'
import {
  AUDIT_ROUTES,
  GURU_STRUCTURED_LIST_PATH,
  GURU_STRUCTURED_ROUTES,
  STRUCTURED_CREATE_PATH,
  STRUCTURED_LIST_PATH,
} from '../lib/audit-routes'
import { fetchLevelOptions, fetchSubjectOptions } from '../lib/lookup-options'
import { GURU_STATUS_LABEL, KBAT_FILTER_OPTIONS } from '../lib/structured-options'
import { pageOf, queryText } from '../lib/route-query'
import { LOAD_ERROR } from '../lib/ui-errors'

const props = withDefaults(defineProps<{ portal?: 'admin' | 'guru' }>(), { portal: 'admin' })
const guru = props.portal === 'guru'
const listPath = guru ? GURU_STRUCTURED_LIST_PATH : STRUCTURED_LIST_PATH

const route = useRoute()
const router = useRouter()
// DV: the M10 teacher form is not routed yet, so "Tambah Soalan" is hidden until it is.
const { routeExists } = useRouteExists()

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => ({
  subject_id: queryText(route.query.subject_id),
  education_level_id: queryText(route.query.education_level_id),
  kbat_level: queryText(route.query.kbat_level),
  status: queryText(route.query.status),
  page: pageOf(route.query.page),
}))

// Draft values of the form controls; re-synced when the URL changes (back/forward, reset).
const subjectId = ref(applied.value.subject_id)
const levelId = ref(applied.value.education_level_id)
const kbat = ref(applied.value.kbat_level)
const statusValue = ref(applied.value.status)
watch(applied, (a) => {
  statusValue.value = a.status
  subjectId.value = a.subject_id
  levelId.value = a.education_level_id
  kbat.value = a.kbat_level
})

const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
const { data: levels } = useApi((signal) => fetchLevelOptions(signal))
/** Teacher filter lists: subjects A-Z, Tingkatan 1-5 only (R1-GUR-44b). */
const guruSubjects = computed(() =>
  [...(subjects.value ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ms')),
)
const guruLevels = computed(() => (levels.value ?? []).filter((l) => /^Tingkatan/.test(l.name)))

type AdminResult = Awaited<ReturnType<typeof fetchStructuredQuestions>>
type GuruResult = Awaited<ReturnType<typeof fetchGuruStructuredQuestions>>

const { data, error, reload } = useApi<AdminResult | GuruResult>(
  (signal) =>
    guru
      ? fetchGuruStructuredQuestions({
          subjectId: applied.value.subject_id || null,
          educationLevelId: applied.value.education_level_id || null,
          status: applied.value.status || null,
          page: applied.value.page,
          signal,
        })
      : fetchStructuredQuestions({
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
    () => route.query.status,
    () => route.query.page,
  ],
)

const adminData = computed(() => (guru ? null : (data.value as AdminResult | null)))
const guruData = computed(() => (guru ? (data.value as GuruResult | null) : null))
const rows = computed(() => adminData.value?.data ?? [])
const stats = computed(() => adminData.value?.meta.stats ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const statItems = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Soalan',
    value: formatNumber(stats.value?.total ?? 0),
    icon: 'stack',
    accent: 'action',
  },
  {
    key: 'published',
    label: 'Published',
    value: formatNumber(stats.value?.published ?? 0),
    icon: 'check-circle',
    accent: 'friend',
  },
])

const counter = computed(() => {
  const meta = data.value?.meta
  if (!meta) return ''
  if (meta.totalItems === 0 || meta.from == null || meta.to == null) {
    return 'Menunjukkan 0 daripada 0 soalan'
  }
  return `Menunjukkan ${formatNumber(meta.from)}–${formatNumber(meta.to)} daripada ${formatNumber(meta.totalItems)} soalan`
})

/** R1-GUR-44b: the BM pager summary (DV-GUR-44b-1) and the sub-line total. */
const guruSummary = computed(() => {
  const meta = guruData.value?.meta
  if (!meta || meta.totalItems === 0 || meta.from == null || meta.to == null) return ''
  return `Menunjukkan ${formatNumber(meta.from)} hingga ${formatNumber(meta.to)} daripada ${formatNumber(meta.totalItems)} keputusan`
})
const guruSubtitle = computed(() =>
  guruData.value
    ? `Cipta & urus soalan berstruktur mengikut piawaian SPM KPM — ${formatNumber(guruData.value.meta.totalItems)} soalan dalam bank`
    : 'Cipta & urus soalan berstruktur mengikut piawaian SPM KPM',
)
const guruPage = computed({
  get: () => guruData.value?.meta.page ?? applied.value.page,
  set: (page: number) => goToPage(page),
})

function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (subjectId.value !== '') out.subject_id = subjectId.value
  if (levelId.value !== '') out.education_level_id = levelId.value
  if (guru) {
    if (statusValue.value !== '') out.status = statusValue.value
  } else if (kbat.value !== '') out.kbat_level = kbat.value
  return out
}

const pagerQuery = computed(() =>
  guru
    ? {
        subject_id: applied.value.subject_id,
        education_level_id: applied.value.education_level_id,
        status: applied.value.status,
      }
    : {
        subject_id: applied.value.subject_id,
        education_level_id: applied.value.education_level_id,
        kbat_level: applied.value.kbat_level,
      },
)

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  const current: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value))
    if (value !== '') current[key] = value
  const same = JSON.stringify(current) === JSON.stringify(query) && !route.query.page
  // Submitting the same filter reloads the page, as a live GET form does.
  if (same) await reload()
  else await router.push({ path: listPath, query })
}

function goToPage(page: number): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value)) if (value !== '') query[key] = value
  void router.push({ path: listPath, query: { ...query, page: String(page) } })
}

interface StructuredRow extends Record<string, unknown> {
  id: number
  stimulusExcerpt: string
  subjectName: string
  levelName: string
  kbat: string
  marks: string
  subCount: number
}

const guruRows = computed<GuruTableRow[]>(() =>
  (guruData.value?.data ?? []).map((r) => ({
    id: r.id,
    number: r.number,
    textExcerpt: r.textExcerpt,
    levelName: namedText(r.level),
    subjectName: namedText(r.subject),
    kbat: r.kbat,
    subCount: r.subCount,
    marks: `${String(r.marks)}m`,
    status: GURU_STATUS_LABEL[r.status] ?? r.status,
    statusKey: r.status,
  })),
)

const tableRows = computed<StructuredRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    stimulusExcerpt: r.stimulusExcerpt,
    subjectName: r.subject?.name ?? '',
    levelName: r.level?.name ?? '',
    kbat: `L${String(r.kbatLevel)}`,
    marks: `${String(r.totalMarks)}m`,
    subCount: r.subCount,
  })),
)

/** The one row action: a link to the read-only detail page. */
const viewAction = (id: number): RowAction[] => [
  {
    label: 'Lihat',
    icon: 'i-ph-eye',
    to: { name: guru ? GURU_STRUCTURED_ROUTES.detail : AUDIT_ROUTES.structuredDetail, params: { id } },
    testid: 'structured-view',
  },
]

const columns: TableColumn<StructuredRow>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'stimulusExcerpt', header: 'Stimulus / Soalan' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'levelName', header: 'Tgk' },
  { accessorKey: 'kbat', header: 'KBAT' },
  { accessorKey: 'marks', header: 'Markah' },
  { accessorKey: 'subCount', header: 'Sub-Q' },
  { id: 'actions', header: 'Aksi' },
]
const cardFields: CardField[] = [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelName', label: 'Tgk' },
  { key: 'kbat', label: 'KBAT' },
  { key: 'marks', label: 'Markah' },
  { key: 'subCount', label: 'Sub-Q' },
]

/** The Malay counter shows when there is no pager (an empty list included, DV-M04-12). */
const showCounter = computed(() => !!data.value && data.value.meta.totalItems <= data.value.meta.pageSize)
const activeCount = computed(
  () =>
    [
      applied.value.subject_id,
      applied.value.education_level_id,
      guru ? applied.value.status : applied.value.kbat_level,
    ].filter((v) => v !== '').length,
)

async function resetFilter(): Promise<void> {
  subjectId.value = ''
  levelId.value = ''
  kbat.value = ''
  statusValue.value = ''
  await router.push({ path: listPath })
}
</script>

<template>
  <!-- Teacher mount (R1-GUR-44b): the PRD columns, BM pager and Status filter; no admin parts. -->
  <DsPage v-if="guru" :subtitle="guruSubtitle" data-testid="structured-page">
    <StructuredGuruList
      v-model:subject="subjectId"
      v-model:level="levelId"
      v-model:status="statusValue"
      v-model:page="guruPage"
      :rows="guruRows"
      :subjects="guruSubjects"
      :levels="guruLevels"
      :loading="firstLoad"
      :failed="!!error"
      :total="guruData?.meta.totalItems ?? 0"
      :page-size="guruData?.meta.pageSize ?? 20"
      :total-pages="guruData?.meta.totalPages ?? 1"
      :summary="guruSummary"
      :active-count="activeCount"
      @apply="submitFilter"
      @retry="reload()"
    />
  </DsPage>

  <DsPage v-else subtitle="Semua soalan berstruktur SPM dalam sistem" data-testid="structured-page">
    <template #actions>
      <UButton
        v-if="routeExists(STRUCTURED_CREATE_PATH)"
        :to="STRUCTURED_CREATE_PATH"
        icon="i-ph-plus"
        class="min-h-11 shrink-0"
        data-testid="structured-add"
      >
        Tambah Soalan
      </UButton>
    </template>

    <!-- Stat cards + subject distribution (whole store). -->
    <DsStatRow :items="statItems" :cols="2" :loading="!stats" density="roomy" prefix="structured-stat" />
    <DsPanel title="Agihan Mengikut Subjek" data-testid="structured-by-subject">
        <div v-if="stats" class="flex flex-wrap gap-2">
          <UBadge
            v-for="s in stats.bySubject"
            :key="s.name"
            color="neutral"
            variant="soft"
            data-testid="structured-subject-pill"
            >{{ s.name }}: <strong class="tabular text-highlighted">{{ formatNumber(s.count) }}</strong></UBadge
          >
        </div>
        <USkeleton v-else class="h-16 w-full" />
    </DsPanel>

    <!-- Filter (the URL is the state). -->
    <DsFilterBar
      :active-count="activeCount"
      data-testid="structured-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <div class="w-full min-w-0 sm:w-56">
        <DsFormField v-slot="{ id }" native for="structured-subject" label="Subjek">
          <DsNativeSelect
            :id="id"
            v-model="subjectId"
            name="subject_id"
            data-testid="structured-subject"
          >
            <option value="">Semua Subjek</option>
            <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
              {{ s.name }}
            </option>
          </DsNativeSelect>
        </DsFormField>
      </div>
      <div class="w-full min-w-0 sm:w-56">
        <DsFormField v-slot="{ id }" native for="structured-level" label="Tingkatan">
          <DsNativeSelect
            :id="id"
            v-model="levelId"
            name="education_level_id"
            data-testid="structured-level"
          >
            <option value="">Semua</option>
            <option v-for="l in levels ?? []" :key="l.id" :value="String(l.id)">
              {{ l.name }}
            </option>
          </DsNativeSelect>
        </DsFormField>
      </div>
      <div class="w-full min-w-0 sm:w-56">
        <DsFormField v-slot="{ id }" native for="structured-kbat" label="KBAT">
          <DsNativeSelect :id="id" v-model="kbat" name="kbat_level" data-testid="structured-kbat">
            <option value="">Semua KBAT</option>
            <option v-for="o in KBAT_FILTER_OPTIONS" :key="o.value" :value="String(o.value)">
              {{ o.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>
      </div>
    </DsFilterBar>

    <!-- Load failure: alert in place of the table + retry (design-system §7.4). -->
    <DsLoadError
      v-if="error"
      :message="LOAD_ERROR"
      testid="structured-error"
      retry-testid="structured-retry"
      @retry="reload()"
    />

    <div v-else class="flex flex-col gap-3" data-testid="structured-footer-wrap">
      <DsDataTable
        variant="flush"
        :data="tableRows"
        :columns="columns"
        caption="Senarai soalan berstruktur"
        :loading="firstLoad"
        :total="data?.meta.totalItems ?? 0"
        :page-size="data?.meta.pageSize ?? 25"
        :page="data?.meta.page ?? applied.page"
        card-title="stimulusExcerpt"
        :card-fields="cardFields"
        empty-title="Tiada soalan berstruktur ditemui"
        :filtered="activeCount > 0"
        data-testid="structured-table"
        @update:page="goToPage"
      >
        <template #empty>
          <span data-testid="structured-empty">Tiada soalan berstruktur ditemui</span>
        </template>
        <template #subjectName-cell="{ row }">
          <UBadge
            v-if="row.original.subjectName"
            color="neutral"
            variant="subtle"
            :label="row.original.subjectName"
          />
        </template>
        <template #kbat-cell="{ row }">
          <UBadge color="info" variant="subtle" :label="row.original.kbat" data-testid="structured-kbat-pill" />
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="viewAction(row.original.id)" :inline="1" />
        </template>
        <template #card-actions="{ row }">
          <DsRowActions :actions="viewAction(row.id as number)" :inline="1" />
        </template>
      </DsDataTable>
      <p v-if="data && showCounter" class="text-caption text-muted" data-testid="structured-counter">
        {{ counter }}
      </p>
    </div>
  </DsPage>
</template>
