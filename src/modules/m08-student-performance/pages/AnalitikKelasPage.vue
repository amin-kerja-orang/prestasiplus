<script setup lang="ts">
/**
 * S8 `/analitik/kelas` "Analitik Kelas" (M08-T7; R1-GUR-5, R1-AS-5). The selects submit on change:
 * the URL keeps the live query names `classroom_id`, `subject_id`, `risk_level` ("Semua Kelas" and "Semua Subjek"
 * are query-less). A class the viewer may not open is the 403 page (§7 #8). Whole percentages on screen (decision 11),
 * 25 rows a page, "Kelas" column for the school admin, "Rekod Intervensi" for the teacher only.
 */
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import { useSessionStore } from '@/stores/session'

import { DsCluster, DsDataTable, DsEmptyState, DsFilterBar, DsLoadError, DsPage, DsPageHeader, DsStatRow, DsStatusBadge, type DsStatus } from '@/ds'

import { fetchClassAnalytics } from '../api/class'
import type { ClassRiskLevel, ClassTrend, RiskLevel } from '../api/types'
import { TREND_ICON, TREND_TEXT } from '../lib/analitik'
import { usePhIcon } from '../lib/icons'
import { DASH, pctWhole } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()

const route = useRoute()
const router = useRouter()
const icon = usePhIcon()
const session = useSessionStore()
/** FR-AS-5-2: the school admin sees the extra column "Kelas". */
const isSchoolAdmin = computed(() => session.role === 'school_admin')
/** FR-GUR-5-4, FR-AS-5-3: "Rekod Intervensi" is the teacher's only (lead ruling, 5 Nov); never the school admin's or the admin's. */
const mayRecordIntervention = computed(() => session.role === 'teacher')

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
/** 'none' = Belum Bermula (no answers): the neutral "inactive" badge with its own word. */
const RISK_BADGE: Record<ClassRiskLevel, { label: string; status: DsStatus }> = {
  critical: { label: 'Kritikal', status: 'risk-high' },
  high: { label: 'Tinggi', status: 'risk-mid' },
  medium: { label: 'Sederhana', status: 'inactive' },
  low: { label: 'Rendah', status: 'risk-low' },
  none: { label: 'Belum Bermula', status: 'inactive' },
}
/** FR-GUR-5-2 Trend sentences; "BARU" is a badge. */
const TREND_SENTENCE: Record<ClassTrend, string> = {
  up: 'Meningkat berbanding minggu lepas',
  down: 'Menurun berbanding minggu lepas',
  stable: 'Stabil',
  new: 'BARU',
}

const classItems = computed(() => [
  { label: 'Semua Kelas', value: ALL },
  ...(data.value?.options.classes ?? []).map((c) => ({ label: c.name, value: String(c.id) })),
])
const subjectItems = computed(() => [
  { label: 'Semua Subjek', value: ALL },
  ...(data.value?.options.subjects ?? []).map((s) => ({ label: s.name, value: String(s.id) })),
])
const classValue = computed(() => {
  const id = data.value?.options.selected.classroomId
  return id === null || id === undefined ? ALL : String(id)
})
const subjectValue = computed(() => {
  const id = data.value?.options.selected.subjectId
  return id === null || id === undefined ? ALL : String(id)
})
const riskValue = computed(() => data.value?.options.selected.riskLevel || ALL)
const activeCount = computed(() => (riskLevel.value ? 1 : 0) + (classroomId.value === undefined ? 0 : 1) + (subjectId.value === undefined ? 0 : 1))

/** Submit on change: the three filters of the current selection, empty ones left out. */
function submit(change: { classroom_id?: string; subject_id?: string; risk_level?: string }): void {
  const next: Record<string, string> = {}
  // The current selection is the URL (the data of a reload in flight may still show the old one).
  const cid = change.classroom_id ?? (classroomId.value === undefined ? '' : String(classroomId.value))
  // The subjects are every active subject whatever the class: a class change keeps the subject.
  const sid = change.subject_id ?? (subjectId.value === undefined ? '' : String(subjectId.value))
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
  submit({ [key]: value === ALL ? '' : value })
}

/** The bar's "Cari" re-submits the current selection; "Set Semula" goes back to the defaults. */
const apply = (): void => submit({})
const reset = (): void => {
  void router.push({ path: '/analitik/kelas' })
}

const trendTone = (t: Exclude<ClassTrend, 'new'>): string => TREND_TEXT[t]
const trendIcon = (t: Exclude<ClassTrend, 'new'>): string => icon.value(TREND_ICON[t])
const riskStatus = (r: ClassRiskLevel): DsStatus => RISK_BADGE[r].status

/** Unjuran "{low} – {high}" (DV-16). */
const range = (p: { low: string; high: string }): string => `${p.low} – ${p.high}`
/** Ketepatan colour: error < 50 (OBSERVED), the FR-M08-50 bands otherwise (INFERRED). */
const accTone = (n: number | null): string =>
  n === null ? '' : n < 50 ? 'text-error' : n < 75 ? 'text-warning' : 'text-success'

const summary = computed<StatSpec[]>(() => {
  const s = data.value?.summary
  if (!s) return []
  return [
    { id: 'pelajar', label: 'Jumlah Pelajar', value: s.students, icon: 'users' },
    { id: 'ketepatan', label: 'Purata Ketepatan', value: pctWhole(s.accuracy), icon: 'target' },
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
  classesText: string
  accuracy: number | null
  accuracyText: string
  answeredText: string
  trend: ClassTrend
  trendText: string
  rangeText: string
  riskLevel: ClassRiskLevel
  riskText: string
}
const rows = computed<Row[]>(() =>
  (data.value?.rows ?? []).map((r: DataRow, i) => ({
    userId: r.userId,
    index: i + 1,
    name: r.name,
    classesText: r.classes.join(', '),
    accuracy: r.accuracy,
    accuracyText: pctWhole(r.accuracy),
    answeredText: r.riskLevel === 'none' ? DASH : String(r.answered),
    trend: r.trend,
    trendText: r.riskLevel === 'none' ? DASH : TREND_SENTENCE[r.trend],
    rangeText: r.projection === null ? DASH : range(r.projection),
    riskLevel: r.riskLevel,
    riskText: RISK_BADGE[r.riskLevel].label,
  })),
)
const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  ...(isSchoolAdmin.value ? [{ accessorKey: 'classesText', header: 'Kelas' }] : []),
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'answeredText', header: 'Soalan' },
  { accessorKey: 'trendText', header: 'Trend' },
  { accessorKey: 'rangeText', header: 'Unjuran' },
  { accessorKey: 'riskText', header: 'Risiko' },
  { accessorKey: 'userId', header: 'Tindakan' },
])
const cardFields = computed(() => [
  ...(isSchoolAdmin.value ? [{ key: 'classesText', label: 'Kelas' }] : []),
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'answeredText', label: 'Soalan' },
  { key: 'trendText', label: 'Trend' },
  { key: 'rangeText', label: 'Unjuran' },
  { key: 'riskText', label: 'Risiko' },
])
/** FR-GUR-5-4: Kritikal and Tinggi rows only; the m12 form reads `?pelajar=`. */
const showIntervention = (r: { riskLevel: ClassRiskLevel }): boolean =>
  mayRecordIntervention.value && (r.riskLevel === 'critical' || r.riskLevel === 'high')
const interventionHref = (userId: number | string): string => `/guru/kirkpatrick/interventions?pelajar=${String(userId)}`
const PAGE_SIZE = 25
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
          title="Tiada pelajar sepadan dengan tapisan ini."
          icon="chart-line-up"
        />
      </div>

      <template v-else>
        <DsStatRow :items="statItems(summary)" data-testid="stat-cards" :cols="4" prefix="sum" />

        <section class="flex min-w-0 flex-col gap-3" data-testid="list-card">
          <h2 class="text-subheading text-highlighted">Senarai Pelajar</h2>
          <DsDataTable
            :data="rows"
            :columns="columns"
            caption="Senarai pelajar"
            card-title="name"
            :card-fields="cardFields"
            :page-size="PAGE_SIZE"
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
            <template #trendText-cell="{ row }">
              <span v-if="row.original.riskLevel === 'none'" data-testid="trend-none">{{ DASH }}</span>
              <DsStatusBadge
                v-else-if="row.original.trend === 'new'"
                status="new"
                label="BARU"
                data-testid="trend-new"
              />
              <span v-else :class="[trendTone(row.original.trend), 'flex items-center gap-1']" data-testid="trend-cell">
                <UIcon :name="trendIcon(row.original.trend)" class="size-5" />
                <span class="text-caption">{{ row.original.trendText }}</span>
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
              <DsCluster gap="sm">
                <UButton
                  :to="`/prestasi/${row.original.userId}`"
                  color="neutral"
                  variant="soft"
                  size="lg"
                  :icon="icon('chart-line-up')"
                  label="Lihat Analitik"
                  data-testid="lihat-analitik"
                />
                <UButton
                  v-if="showIntervention(row.original)"
                  :to="interventionHref(row.original.userId)"
                  color="neutral"
                  variant="soft"
                  size="lg"
                  :icon="icon('clipboard-text')"
                  label="Rekod Intervensi"
                  data-testid="rekod-intervensi"
                />
              </DsCluster>
            </template>
            <template #card-actions="{ row }">
              <UButton
                :to="`/prestasi/${String(row.userId)}`"
                color="neutral"
                variant="soft"
                size="lg"
                :icon="icon('chart-line-up')"
                label="Lihat Analitik"
                data-testid="lihat-analitik"
              />
              <UButton
                v-if="showIntervention(row)"
                :to="interventionHref(row.userId)"
                color="neutral"
                variant="soft"
                size="lg"
                :icon="icon('clipboard-text')"
                label="Rekod Intervensi"
                data-testid="rekod-intervensi"
              />
            </template>
          </DsDataTable>
        </section>
      </template>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
