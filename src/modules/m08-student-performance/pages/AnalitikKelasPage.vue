<script setup lang="ts">
/**
 * S8 `/analitik/kelas` "Analitik Kelas" (M08-T7; FR-M08-54…57, BR-M08-15). The selects submit on change:
 * the URL keeps the live query names `classroom_id`, `subject_id`, `risk_level`.
 * A class the viewer may not open is the 403 page (§7 #8).
 */
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsStatRow,
  DsStatusBadge,
  type DsStatus,
  DsStack,
  DsHeading,
} from '@/ds'

import { fetchClassAnalytics } from '../api/class'
import type { RiskLevel } from '../api/types'
import { TREND_ICON, TREND_TEXT } from '../lib/analitik'
import { usePhIcon } from '../lib/icons'
import { pct1 } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()

const route = useRoute()
const router = useRouter()
const icon = usePhIcon()

const queryInt = (key: string): number | undefined => {
  const raw = route.query[key]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined
}
const queryText = (key: string): string => {
  const raw = route.query[key]
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v : ''
}

const classroomId = computed(() => queryInt('classroom_id'))
const subjectId = computed(() => queryInt('subject_id'))
const riskLevel = computed(() => queryText('risk_level') as RiskLevel | '')

const { data, error, reload } = useRouteData(
  (signal) =>
    fetchClassAnalytics(
      {
        ...(classroomId.value === undefined ? {} : { classroomId: classroomId.value }),
        ...(subjectId.value === undefined ? {} : { subjectId: subjectId.value }),
        riskLevel: riskLevel.value,
      },
      { signal },
    ),
  [() => classroomId.value, () => subjectId.value, () => riskLevel.value],
)
const loadFailed = computed(() => isLoadError(error.value))

/** The select cannot hold an empty value, so "Semua Risiko" travels as `all` and is query-less. */
const ALL = 'all'
const RISKS: { value: string; label: string }[] = [
  { value: ALL, label: 'Semua Risiko' },
  { value: 'critical', label: 'Kritikal' },
  { value: 'high', label: 'Tinggi' },
  { value: 'medium', label: 'Sederhana' },
  { value: 'low', label: 'Rendah' },
]
const RISK_BADGE: Record<RiskLevel, { label: string; status: DsStatus }> = {
  critical: { label: 'Kritikal', status: 'risk-high' },
  high: { label: 'Tinggi', status: 'risk-mid' },
  medium: { label: 'Sederhana', status: 'inactive' },
  low: { label: 'Rendah', status: 'risk-low' },
}
const TREND_LABEL = { up: 'Naik', down: 'Turun', stable: 'Tetap' } as const

const classItems = computed(() =>
  (data.value?.options.classes ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
)
const subjectItems = computed(() =>
  (data.value?.options.subjects ?? []).map((s) => ({ label: s.name, value: String(s.id) })),
)
const classValue = computed(() => String(data.value?.options.selected.classroomId ?? ''))
const subjectValue = computed(() => String(data.value?.options.selected.subjectId ?? ''))
const riskValue = computed(() => data.value?.options.selected.riskLevel || ALL)
const activeCount = computed(() => (riskLevel.value ? 1 : 0))

/** Submit on change: the three filters of the current selection, empty ones left out. */
function submit(change: { classroom_id?: string; subject_id?: string; risk_level?: string }): void {
  const sel = data.value?.options.selected
  const next: Record<string, string> = {}
  const cid =
    change.classroom_id ?? (sel?.classroomId === null ? '' : String(sel?.classroomId ?? ''))
  const sid =
    change.classroom_id !== undefined
      ? ''
      : (change.subject_id ?? (sel?.subjectId === null ? '' : String(sel?.subjectId ?? '')))
  const rl = change.risk_level ?? riskLevel.value
  if (cid) next.classroom_id = cid
  if (sid) next.subject_id = sid
  if (rl) next.risk_level = rl
  void router.push({ path: '/analitik/kelas', query: next })
}
function onChange(
  key: 'classroom_id' | 'subject_id' | 'risk_level',
  value: string | undefined,
): void {
  if (value === undefined) return
  submit({ [key]: key === 'risk_level' && value === ALL ? '' : value })
}

/** The bar's "Cari" re-submits the current selection; "Set Semula" goes back to the defaults. */
const apply = (): void => submit({})
const reset = (): void => {
  void router.push({ path: '/analitik/kelas' })
}

type Trend = 'up' | 'down' | 'stable'
const trendKey = (t: Trend): Trend => t
const trendTone = (t: Trend): string => TREND_TEXT[t]
const trendIcon = (t: Trend): string => icon.value(TREND_ICON[t])
const riskStatus = (r: RiskLevel): DsStatus => RISK_BADGE[r].status

/** Unjuran "{low} – {high}" (DV-16). */
const range = (p: { low: string; high: string }): string => `${p.low} – ${p.high}`
/** Ketepatan colour: error < 50 (OBSERVED), the FR-M08-50 bands otherwise (INFERRED). */
const accTone = (n: number): string =>
  n < 50 ? 'text-error' : n < 75 ? 'text-warning' : 'text-success'

const summary = computed<StatSpec[]>(() => {
  const s = data.value?.summary
  if (!s) return []
  return [
    { id: 'pelajar', label: 'Jumlah Pelajar', value: s.students, icon: 'users' },
    { id: 'ketepatan', label: 'Purata Ketepatan', value: pct1(s.accuracy), icon: 'target' },
    {
      id: 'berisiko',
      label: 'Pelajar Berisiko',
      value: s.atRisk,
      icon: 'warning',
      accent: s.atRisk === 0 ? 'action' : 'heat',
    },
    { id: 'baik', label: 'Prestasi Baik', value: s.good, icon: 'check-circle' },
  ]
})

type DataRow = NonNullable<typeof data.value>['rows'][number]
interface Row extends Record<string, unknown> {
  userId: number
  index: number
  name: string
  accuracy: number
  accuracyText: string
  answered: number
  trend: DataRow['trend']
  rangeText: string
  riskLevel: RiskLevel
  riskText: string
}
const rows = computed<Row[]>(() =>
  (data.value?.rows ?? []).map((r, i) => ({
    userId: r.userId,
    index: i + 1,
    name: r.name,
    accuracy: r.accuracy,
    accuracyText: `${r.accuracy.toFixed(1)}%`,
    answered: r.answered,
    trend: r.trend,
    rangeText: range(r.projection),
    riskLevel: r.riskLevel,
    riskText: RISK_BADGE[r.riskLevel].label,
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'answered', header: 'Soalan' },
  { accessorKey: 'trend', header: 'Trend' },
  { accessorKey: 'rangeText', header: 'Unjuran' },
  { accessorKey: 'riskText', header: 'Risiko' },
  { accessorKey: 'userId', header: 'Tindakan' },
]
const cardFields = [
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'answered', label: 'Soalan' },
  { key: 'rangeText', label: 'Unjuran' },
  { key: 'riskText', label: 'Risiko' },
]
</script>

<template>
  <DsPage data-testid="analitik-kelas-page">
    <DsPageHeader
      title="Analitik Kelas"
      subtitle="Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian"
    />
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div data-testid="filters">
        <DsFilterBar :active-count="activeCount" @apply="apply" @reset="reset">
          <UFormField label="Kelas" class="min-w-0 sm:w-56" for="f-kelas">
            <USelect
              id="f-kelas"
              name="classroom_id"
              :items="classItems"
              :model-value="classValue"
              class="w-full"
              size="lg"
              data-testid="filter-kelas"
              @update:model-value="onChange('classroom_id', $event)"
            />
          </UFormField>
          <UFormField label="Mata Pelajaran" class="min-w-0 sm:w-56" for="f-subjek">
            <USelect
              id="f-subjek"
              name="subject_id"
              :items="subjectItems"
              :model-value="subjectValue"
              class="w-full"
              size="lg"
              data-testid="filter-subjek"
              @update:model-value="onChange('subject_id', $event)"
            />
          </UFormField>
          <UFormField label="Risiko" class="min-w-0 sm:w-48" for="f-risiko">
            <USelect
              id="f-risiko"
              name="risk_level"
              :items="RISKS"
              :model-value="riskValue"
              class="w-full"
              size="lg"
              data-testid="filter-risiko"
              @update:model-value="onChange('risk_level', $event)"
            />
          </UFormField>
        </DsFilterBar>
      </div>

      <div v-if="data.summary === null" data-testid="analitik-empty">
        <DsEmptyState
          title="Tiada data analitik untuk kelas dan subjek ini."
          icon="chart-line-up"
        />
      </div>

      <template v-else>
        <DsStatRow :items="statItems(summary)" data-testid="stat-cards" :cols="4" prefix="sum" />

        <DsStack as="section" gap="sm" data-testid="list-card">
          <DsHeading :level="2" variant="subheading">Senarai Pelajar</DsHeading>
          <DsDataTable
            :data="rows"
            :columns="columns"
            caption="Senarai pelajar"
            card-title="name"
            :card-fields="cardFields"
            :page-size="100"
            data-testid="student-table"
          >
            <template #name-cell="{ row }">
              <RouterLink
                :to="`/prestasi/${row.original.userId}`"
                class="inline-flex min-h-11 items-center text-label text-highlighted"
                :data-testid="`student-row-${row.original.userId}`"
                >{{ row.original.name }}</RouterLink
              >
            </template>
            <template #accuracyText-cell="{ row }">
              <span :class="[accTone(row.original.accuracy), 'text-label']">{{
                row.original.accuracyText
              }}</span>
            </template>
            <template #trend-cell="{ row }">
              <span :class="[trendTone(row.original.trend), 'flex items-center gap-1']">
                <UIcon :name="trendIcon(row.original.trend)" class="size-5" />
                <span class="text-caption">{{ TREND_LABEL[trendKey(row.original.trend)] }}</span>
              </span>
            </template>
            <template #riskText-cell="{ row }">
              <DsStatusBadge
                :status="riskStatus(row.original.riskLevel)"
                :label="row.original.riskText"
                data-testid="risk-badge"
              />
            </template>
            <template #userId-cell="{ row }">
              <UButton
                :to="`/prestasi/${row.original.userId}`"
                color="neutral"
                variant="soft"
                :icon="icon('chart-line-up')"
                label="Lihat Analitik"
              />
            </template>
            <template #card-actions="{ row }">
              <UButton
                :to="`/prestasi/${String(row.userId)}`"
                color="neutral"
                variant="soft"
                size="lg"
                :icon="icon('chart-line-up')"
                label="Lihat Analitik"
              />
            </template>
          </DsDataTable>
        </DsStack>
      </template>
    </template>
    <div
      v-else-if="!error"
      class="flex flex-col gap-4 md:gap-6"
      aria-busy="true"
      data-testid="page-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
