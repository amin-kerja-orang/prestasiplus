<script setup lang="ts">
/**
 * S19 `/ranking` "Kedudukan" (M08-T4; FR-M08-108..112, BR-M08-27, DV-22, DV-23; FN-M08-7.1.*).
 *
 * - Hero "Kedudukan" with the scope label (Nasional, Negeri, Daerah, Sekolah, or the chosen state);
 *   the tab title is "Kedudukan {x}" (DV-22).
 * - Four scope pills in a scrolling row; each keeps the non-empty filters. An unknown `scope` activates
 *   no pill and ranks nationally.
 * - GET form: Subjek, Tingkatan and (negeri / daerah scopes) Negeri, submitting on change.
 * - Ranked rows (12-column grid) or the empty state; the footer only on the nasional scope.
 * - Names are plain text: the ranking entries are not linked (FR-M08-112), and a row without a user id
 *   must never become a `/pelajar/null` link.
 * - The query string is the state (a GET form on live).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, usePageMeta } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsIdentity,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  type PillItem,
  DsStack,
  DsCluster,
  DsText,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchRankings } from '../api/performance'
import {
  MEDALS,
  RANKING_PATH,
  SCOPE_PILLS,
  TINGKATAN_OPTIONS,
  activeScope,
  apiQuery,
  formQuery,
  readRankingState,
  scopeLabel,
  scopeQuery,
  tabTitle,
} from '../lib/ranking'
import { LOAD_ERROR } from '../lib/prestasi/load'
import { fetchSubjectOptions } from '../lib/subject-options'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const state = computed(() => readRankingState(route.query))
const active = computed(() => activeScope(state.value.scope))
const label = computed(() => scopeLabel(state.value))

const { data, error, reload } = useApi(
  (signal) => fetchRankings(apiQuery(state.value), { signal }),
  () => route.fullPath,
)
const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))

watchEffect(() => {
  pageMeta.setTitle(tabTitle(state.value))
})

const firstLoad = computed(() => data.value === null && error.value === null)
const rows = computed(() => data.value?.rows ?? [])
const footer = computed(() =>
  data.value?.showFooter === true ? { total: data.value.total } : null,
)
const showNegeri = computed(() => active.value === 'negeri' || active.value === 'daerah')
/** The hidden `scope` of the form: what the URL says, else the default. */
const formScope = computed(() => (state.value.scope === '' ? 'nasional' : state.value.scope))

const subjectId = ref(state.value.subjectId)
const tingkatan = ref(state.value.tingkatan)
const negeri = ref(state.value.negeri)
watch(state, (s) => {
  subjectId.value = s.subjectId
  tingkatan.value = s.tingkatan
  negeri.value = s.negeri
})

function submitForm(): void {
  void router.push({
    path: RANKING_PATH,
    query: formQuery(
      { subjectId: subjectId.value, tingkatan: tingkatan.value, negeri: negeri.value },
      formScope.value,
    ),
  })
}

const PILL_ICONS: Record<string, string> = {
  nasional: 'i-ph-globe',
  negeri: 'i-ph-map-pin-area',
  daerah: 'i-ph-map-pin',
  sekolah: 'i-ph-student',
}

/** A select cannot hold an empty value, so "no filter" travels as `all` and is query-less. */
const ALL = 'all'
const subjectItems = computed(() => [
  { label: 'Semua Subjek', value: ALL },
  ...(subjects.value ?? []).map((s) => ({ label: s.name, value: String(s.id) })),
])
const tingkatanItems = TINGKATAN_OPTIONS.map((o) => ({
  label: o.label,
  value: o.value === '' ? ALL : o.value,
}))
const negeriItems = computed(() => [
  { label: 'Pilih Negeri', value: ALL },
  ...(data.value?.states ?? []).map((n) => ({ label: n, value: n })),
])

function bindFilter(target: typeof subjectId) {
  return computed({
    get: () => (target.value === '' ? ALL : target.value),
    set: (v: string | undefined) => {
      target.value = v === undefined || v === ALL ? '' : v
      submitForm()
    },
  })
}
const subjectModel = bindFilter(subjectId)
const tingkatanModel = bindFilter(tingkatan)
const negeriModel = bindFilter(negeri)

const scopePills = computed<PillItem<string>[]>(() =>
  SCOPE_PILLS.map((p) => ({
    key: p.id,
    label: p.label,
    icon: PILL_ICONS[p.id],
    to: { path: RANKING_PATH, query: scopeQuery(state.value, p.id) },
  })),
)

type Row = NonNullable<typeof data.value>['rows'][number]
const tableRows = computed<Row[]>(() => rows.value)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'rank', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  { accessorKey: 'tahap', header: 'Tahap' },
  { accessorKey: 'correct', header: 'Betul' },
  { accessorKey: 'accuracy', header: 'Tepat' },
]
</script>

<template>
  <DsPage
    title="Kedudukan"
    :subtitle="label"
    subtitle-testid="ranking-subtitle"
    data-testid="ranking-page"
  >
    <DsPillNav
      :items="scopePills"
      :active="active"
      label="Skop kedudukan"
      testid-prefix="ranking-pill"
      data-testid="ranking-pills"
    />

    <!-- Filters (GET form): submit on change -->
    <DsPanel data-testid="ranking-filter">
      <form
        method="get"
        :action="RANKING_PATH"
        :class="showNegeri ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'grid grid-cols-2 gap-4'"
        @submit.prevent="submitForm"
      >
        <UFormField label="Subjek" for="ranking-subject" class="min-w-0">
          <USelect
            id="ranking-subject"
            v-model="subjectModel"
            name="subject_id"
            :items="subjectItems"
            size="lg"
            class="w-full"
            data-testid="ranking-subject"
          />
        </UFormField>
        <UFormField label="Tingkatan" for="ranking-tingkatan" class="min-w-0">
          <USelect
            id="ranking-tingkatan"
            v-model="tingkatanModel"
            name="tingkatan"
            :items="tingkatanItems"
            size="lg"
            class="w-full"
            data-testid="ranking-tingkatan"
          />
        </UFormField>
        <UFormField v-if="showNegeri" label="Negeri" for="ranking-negeri" class="min-w-0">
          <USelect
            id="ranking-negeri"
            v-model="negeriModel"
            name="negeri"
            :items="negeriItems"
            size="lg"
            class="w-full"
            data-testid="ranking-negeri"
          />
        </UFormField>
      </form>
    </DsPanel>

    <DsLoadError v-if="error" :message="LOAD_ERROR" testid="ranking-error" @retry="reload()" />

    <!-- Loading -->
    <DsStack v-else-if="firstLoad" gap="xs" aria-busy="true" data-testid="ranking-loading">
      <USkeleton v-for="n in 3" :key="n" class="h-12 w-full" />
    </DsStack>

    <!-- Empty -->
    <div v-else-if="rows.length === 0" data-testid="ranking-empty">
      <DsEmptyState
        title="Tiada data kedudukan"
        description="Mula menjawab soalan untuk muncul di papan kedudukan!"
        icon="trophy"
        friend="aiman"
      >
        <template #actions>
          <UButton to="/practice" label="Mula Latihan" size="lg" data-testid="ranking-start" />
        </template>
      </DsEmptyState>
      <span class="sr-only">🏆</span>
    </div>

    <!-- List -->
    <DsStack v-else gap="sm" data-testid="ranking-list">
      <DsDataTable
        :data="tableRows"
        :columns="columns"
        :page-size="tableRows.length"
        variant="flush"
        layout="fixed"
        caption="Kedudukan"
      >
        <template #rank-cell="{ row }">
          <span data-testid="ranking-rank">
            <UBadge
              v-if="MEDALS[row.original.rank]"
              color="primary"
              variant="solid"
              :label="MEDALS[row.original.rank]?.emoji"
            />
            <DsText v-else variant="label" tone="muted">{{ row.original.rank }}</DsText>
          </span>
        </template>
        <template #name-cell="{ row }">
          <DsIdentity :name="row.original.name" :sub="row.original.schoolName">
            <template #name>
              <span class="truncate" data-testid="ranking-name">{{ row.original.name }}</span>
            </template>
          </DsIdentity>
        </template>
        <template #tahap-cell="{ row }">
          <UBadge color="neutral" variant="subtle" size="sm" data-testid="ranking-tahap"
            >L{{ row.original.tahap }}</UBadge
          >
        </template>
        <template #correct-cell="{ row }">
          <DsText variant="label" tone="highlighted" data-testid="ranking-betul">{{
            formatNumber(row.original.correct)
          }}</DsText>
        </template>
        <template #accuracy-cell="{ row }">
          <span
            class="text-label"
            :class="row.original.accuracy >= 50 ? 'text-success' : 'text-error'"
            data-testid="ranking-tepat"
            >{{ row.original.accuracy.toFixed(2) }}%</span
          >
        </template>
        <template #card="{ row }">
          <DsCluster :wrap="false">
            <UBadge
              :color="MEDALS[row.rank] ? 'primary' : 'neutral'"
              :variant="MEDALS[row.rank] ? 'solid' : 'subtle'"
              :label="MEDALS[row.rank]?.emoji ?? String(row.rank)"
            />
            <DsIdentity :name="row.name" :sub="row.schoolName" />
          </DsCluster>
          <dl class="grid grid-cols-3 gap-x-3">
            <div>
              <DsText variant="caption" as="dt">Tahap</DsText>
              <dd class="tabular text-label">L{{ row.tahap }}</dd>
            </div>
            <div>
              <DsText variant="caption" as="dt">Betul</DsText>
              <DsText variant="label" as="dd" tone="highlighted" tabular>{{
                formatNumber(row.correct)
              }}</DsText>
            </div>
            <div>
              <DsText variant="caption" as="dt">Tepat</DsText>
              <dd
                class="tabular text-label"
                :class="row.accuracy >= 50 ? 'text-success' : 'text-error'"
              >
                {{ row.accuracy.toFixed(2) }}%
              </dd>
            </div>
          </dl>
        </template>
      </DsDataTable>
      <DsText v-if="footer" variant="caption" align="center" data-testid="ranking-footer">
        Menunjukkan {{ rows.length }} dari {{ footer.total }} pelajar
      </DsText>
    </DsStack>
  </DsPage>
</template>
