<script setup lang="ts">
/**
 * Sumber Kertas (`/admin/source-papers`, S2-T09, PRD30 R1-ADM-Q-19, API-Q-23): the read-only registry of intake papers that carry a
 * Tahun. Two tiles (Jumlah Kertas, Perlu Semakan), the filter bar (Subjek, Tahun, Negeri, Kertas, Jenis, the Perlu Semakan checkbox,
 * Tapis), the table (25 per page) with the badge OK / Perlu Semakan / Skema and a Lihat link. Negeri shows "—" when unknown.
 */
import type { TableColumn } from '@nuxt/ui'
import { INTAKE_PAPER_TYPE_CODES, INTAKE_PAPER_TYPE_LABELS, SOURCE_PAPER_MESSAGES } from '@pp/contract'
import { computed, reactive, ref } from 'vue'

import { useApi } from '@/composables/useApi'
import { DsBadge, DsDataTable, DsFilterBar, DsLink, DsLoadError, DsNativeSelect, DsPage, DsStatRow, DsText, type CardField, type StatItem } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchSourcePapers } from '../api/imports'
import { LOAD_ERROR } from '../lib/ui-errors'

const PAGE_SIZE = 25
const DASH = '—'
const KERTAS = [1, 2, 3, 4]

const filters = reactive({ subject: '', year: '', negeri: '', kertas: '', jenis: '', needsReview: false })
const applied = reactive({ subject: '', year: '', negeri: '', kertas: '', jenis: '', needsReview: false })
const page = ref(1)

const query = computed(() => ({ ...applied, page: page.value }))
const { data, error, reload } = useApi((signal) => fetchSourcePapers({ ...query.value, signal }), query)

// Negeri / Tahun / Subjek options: the values present in the data. The full OPT-NEGERI-KERTAS list is API-REF-01 (S0-T12), not on this base yet.
const options = computed(() => data.value?.meta.options ?? { years: [], negeri: [], subjects: [] })
const firstLoad = computed(() => data.value === null && error.value === null)

const stats = computed<StatItem[]>(() => [
  { key: 'total', label: 'Jumlah Kertas', value: data.value ? formatNumber(data.value.meta.totalPapers) : DASH, icon: 'scroll' },
  { key: 'review', label: 'Perlu Semakan', value: data.value ? formatNumber(data.value.meta.needsReviewCount) : DASH, icon: 'warning', accent: 'trial' },
])

function applyFilters(): void {
  Object.assign(applied, filters)
  page.value = 1
}

type Badge = { label: string; tone: 'success' | 'warning' | 'info' }
/** Perlu Semakan wins, then Skema (no scheme), else OK. */
function badgeOf(r: { needsReview: boolean; hasScheme: boolean }): Badge {
  if (r.needsReview) return { label: 'Perlu Semakan', tone: 'warning' }
  if (!r.hasScheme) return { label: 'Skema', tone: 'info' }
  return { label: 'OK', tone: 'success' }
}

interface Row extends Record<string, unknown> {
  id: string
  subject: string
  year: number
  negeri: string
  kertas: string
  jenis: string
  questions: number
  sourceLabel: string
  badge: Badge
  badgeLabel: string
}

const rows = computed<Row[]>(() =>
  (data.value?.data ?? []).map((r) => {
    const badge = badgeOf(r)
    return {
      id: r.id,
      subject: r.subjectName || r.subject || DASH,
      year: r.year,
      negeri: r.negeri || DASH,
      kertas: r.kertas === null ? DASH : `Kertas ${String(r.kertas)}`,
      jenis: INTAKE_PAPER_TYPE_LABELS[r.paperType],
      questions: r.questions,
      sourceLabel: r.sourceLabel,
      badge,
      badgeLabel: badge.label,
    }
  }),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'subject', header: 'Subjek' },
  { accessorKey: 'year', header: 'Tahun' },
  { accessorKey: 'negeri', header: 'Negeri' },
  { accessorKey: 'kertas', header: 'Kertas' },
  { accessorKey: 'jenis', header: 'Jenis' },
  { accessorKey: 'questions', header: 'Bilangan Soalan' },
  { accessorKey: 'sourceLabel', header: 'Sumber' },
  { accessorKey: 'badgeLabel', header: 'Status' },
  { id: 'actions', header: '' },
]
const cardFields: CardField[] = [
  { key: 'year', label: 'Tahun' },
  { key: 'negeri', label: 'Negeri' },
  { key: 'kertas', label: 'Kertas' },
  { key: 'jenis', label: 'Jenis' },
  { key: 'questions', label: 'Bilangan Soalan' },
  { key: 'sourceLabel', label: 'Sumber' },
]
const detailPath = (id: unknown): string => `/admin/source-papers/${String(id)}`
</script>

<template>
  <DsPage layout="list" data-testid="source-papers-page">
    <DsStatRow :items="stats" density="compact" :cols="2" prefix="source-papers-tile" aria-label="Ringkasan sumber kertas" />

    <DsFilterBar :show-reset="false" data-testid="source-papers-filters" @apply="applyFilters">
      <DsNativeSelect v-model="filters.subject" aria-label="Subjek" data-testid="sp-filter-subject">
        <option value="">Semua Subjek</option>
        <option v-for="s in options.subjects" :key="s.code" :value="s.code">{{ s.name || s.code }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="filters.year" aria-label="Tahun" data-testid="sp-filter-year">
        <option value="">Semua Tahun</option>
        <option v-for="y in options.years" :key="y" :value="String(y)">{{ y }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="filters.negeri" aria-label="Negeri" data-testid="sp-filter-negeri">
        <option value="">Semua Negeri</option>
        <option v-for="n in options.negeri" :key="n" :value="n">{{ n }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="filters.kertas" aria-label="Kertas" data-testid="sp-filter-kertas">
        <option value="">Semua Kertas</option>
        <option v-for="k in KERTAS" :key="k" :value="String(k)">Kertas {{ k }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="filters.jenis" aria-label="Jenis" data-testid="sp-filter-jenis">
        <option value="">Semua Jenis</option>
        <option v-for="j in INTAKE_PAPER_TYPE_CODES" :key="j" :value="j">{{ INTAKE_PAPER_TYPE_LABELS[j] }}</option>
      </DsNativeSelect>
      <UCheckbox v-model="filters.needsReview" label="Perlu Semakan" data-testid="sp-filter-review" />
    </DsFilterBar>

    <DsLoadError v-if="error" :message="LOAD_ERROR" testid="source-papers-error" retry-testid="source-papers-retry" @retry="reload()" />
    <DsDataTable
      v-else
      v-model:page="page"
      :data="rows"
      :columns="columns"
      :total="data?.meta.totalItems ?? 0"
      :page-size="PAGE_SIZE"
      caption="Sumber kertas"
      variant="flush"
      density="compact"
      :loading="firstLoad"
      :empty-title="SOURCE_PAPER_MESSAGES.empty"
      empty-description=""
      card-title="subject"
      :card-fields="cardFields"
      row-key="id"
      data-testid="source-papers-table"
    >
      <template #empty>
        <DsText as="span" variant="body" data-testid="source-papers-empty">{{ SOURCE_PAPER_MESSAGES.empty }}</DsText>
      </template>
      <template #badgeLabel-cell="{ row }">
        <DsBadge :tone="row.original.badge.tone" :label="row.original.badge.label" data-testid="source-paper-badge" />
      </template>
      <template #actions-cell="{ row }">
        <DsLink :to="detailPath(row.original.id)" data-testid="source-paper-view">Lihat</DsLink>
      </template>
      <template #card-actions="{ row }">
        <DsBadge :tone="(row.badge as Badge).tone" :label="(row.badge as Badge).label" data-testid="source-paper-badge" />
        <DsLink :to="detailPath(row.id)" data-testid="source-paper-view">Lihat</DsLink>
      </template>
    </DsDataTable>
  </DsPage>
</template>
