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
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsFilterBar, DsPage, DsStatTile, type CardField } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchStructuredQuestions } from '../api/structured'
import ErrorBox from '../components/ErrorBox.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
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

interface StructuredRow extends Record<string, unknown> {
  id: number
  stimulusExcerpt: string
  subjectName: string
  levelName: string
  kbat: string
  marks: string
  subCount: number
}

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
  () => [applied.value.subject_id, applied.value.education_level_id, applied.value.kbat_level].filter((v) => v !== '').length,
)

async function resetFilter(): Promise<void> {
  subjectId.value = ''
  levelId.value = ''
  kbat.value = ''
  await router.push({ path: STRUCTURED_LIST_PATH })
}
</script>

<template>
  <DsPage data-testid="structured-page">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="min-w-0 text-body text-muted">Semua soalan berstruktur SPM dalam sistem</p>
      <UButton
        :to="STRUCTURED_CREATE_PATH"
        icon="i-ph-plus"
        class="min-h-11 shrink-0"
        data-testid="structured-add"
      >
        Tambah Soalan
      </UButton>
    </div>

    <!-- Stat cards + subject distribution (whole store). -->
    <section class="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <template v-if="stats">
        <DsStatTile
          :value="formatNumber(stats.total)"
          unit="Jumlah Soalan"
          icon="i-ph-stack"
          data-testid="structured-stat-total"
        />
        <DsStatTile
          :value="formatNumber(stats.published)"
          unit="Published"
          icon="i-ph-check-circle"
          data-testid="structured-stat-published"
        />
      </template>
      <template v-else>
        <USkeleton class="h-24 w-full" data-testid="structured-stat-total" />
        <USkeleton class="h-24 w-full" data-testid="structured-stat-published" />
      </template>
      <UCard class="col-span-2 lg:col-span-3" data-testid="structured-by-subject">
        <h2 class="mb-3 text-label text-muted">Agihan Mengikut Subjek</h2>
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
      </UCard>
    </section>

    <!-- Filter (the URL is the state). -->
    <DsFilterBar
      :active-count="activeCount"
      data-testid="structured-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <div class="w-full min-w-0 sm:w-56">
        <label for="structured-subject" class="mb-2 block text-label text-highlighted">Subjek</label>
        <NativeSelect
          id="structured-subject"
          v-model="subjectId"
          name="subject_id"
          data-testid="structured-subject"
        >
          <option value="">Semua Subjek</option>
          <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-56">
        <label for="structured-level" class="mb-2 block text-label text-highlighted">Tingkatan</label>
        <NativeSelect
          id="structured-level"
          v-model="levelId"
          name="education_level_id"
          data-testid="structured-level"
        >
          <option value="">Semua</option>
          <option v-for="l in levels ?? []" :key="l.id" :value="String(l.id)">
            {{ l.name }}
          </option>
        </NativeSelect>
      </div>
      <div class="w-full min-w-0 sm:w-56">
        <label for="structured-kbat" class="mb-2 block text-label text-highlighted">KBAT</label>
        <NativeSelect id="structured-kbat" v-model="kbat" name="kbat_level" data-testid="structured-kbat">
          <option value="">Semua KBAT</option>
          <option v-for="o in KBAT_FILTER_OPTIONS" :key="o.value" :value="String(o.value)">
            {{ o.label }}
          </option>
        </NativeSelect>
      </div>
    </DsFilterBar>

    <!-- Load failure: alert in place of the table + retry (design-system §7.4). -->
    <div v-if="error" class="flex flex-col gap-3" data-testid="structured-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" class="min-h-11" data-testid="structured-retry" @click="reload()">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3" data-testid="structured-footer-wrap">
      <DsDataTable
        :data="tableRows"
        :columns="columns"
        caption="Senarai soalan berstruktur"
        :loading="firstLoad"
        :total="data?.meta.totalItems ?? 0"
        :page-size="data?.meta.pageSize ?? 25"
        :page="data?.meta.page ?? applied.page"
        card-title="stimulusExcerpt"
        :card-fields="cardFields"
        empty-label="Tiada soalan berstruktur ditemui"
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
          <UButton
            :to="{ name: AUDIT_ROUTES.structuredDetail, params: { id: row.original.id } }"
            color="neutral"
            variant="soft"
            icon="i-ph-eye"
            class="min-h-11"
            data-testid="structured-view"
          >
            Lihat
          </UButton>
        </template>
        <template #card-actions="{ row }">
          <UButton
            :to="{ name: AUDIT_ROUTES.structuredDetail, params: { id: row.id as number } }"
            color="neutral"
            variant="soft"
            icon="i-ph-eye"
            aria-label="Lihat"
            class="min-h-11 min-w-11 justify-center"
          />
        </template>
      </DsDataTable>
      <p v-if="data && showCounter" class="text-caption text-muted" data-testid="structured-counter">
        {{ counter }}
      </p>
    </div>
  </DsPage>
</template>
