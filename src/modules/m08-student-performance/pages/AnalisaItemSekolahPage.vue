<script setup lang="ts">
/**
 * S9 `/analisa-item/sekolah[/{id}]` "Analisa Item Sekolah" (M08-T5; FR-M08-58…61, 141…143, BR-M08-17).
 * The viewer's own school, or school `{id}` (admin any, officers their scope, others own school, else the
 * 403 page; an unknown school is the 404 page). Header figures that the data does not supply (`null`,
 * DV-M08-32) show "—", never 0. GPS and the other headcount figures come from M08-T1b.
 */
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import { DsBreadcrumb, DsChart, DsDataTable, DsEmptyState, DsLoadError, DsPage, DsPageHeader, DsPanel, DsStatRow, DsPillNav, type PillItem } from '@/ds'
import { usePrototypeScope, useRouteExists } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchSchoolItemAnalysis } from '../api/performance'
import SchoolQuestionList from '../components/analisa-item/SchoolQuestionList.vue'
import { usePhIcon } from '../lib/icons'
import {
  BAND_STYLE,
  DASH,
  LEVEL_BADGE,
  LEVEL_ICON,
  dec2,
  grouped,
  pct1,
  ratioPct,
} from '../lib/prestasi/format'
import { sparklineSeries } from '../lib/prestasi/gps-chart'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()

const route = useRoute()
const pageMeta = usePageMeta()
const icon = usePhIcon()
const { home, allows } = usePrototypeScope()
const { routeExists } = useRouteExists()

const schoolId = computed(() => {
  const raw = route.params.id
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return raw === undefined || raw === '' ? undefined : n
})
/** An unknown `tingkatan` value activates no chip and filters nothing (FR-M08-59). */
const tingkatan = computed<'T4' | 'T5' | null>(() => {
  const q = route.query.tingkatan
  const v = Array.isArray(q) ? q[0] : q
  return v === 'T4' || v === 'T5' ? v : null
})

/** An unknown `tingkatan` value activates no chip, not even "Semua" (FR-M08-59). */
const hasQuery = computed(() => route.query.tingkatan !== undefined)

const { data, error, reload } = useRouteData(
  (signal) =>
    fetchSchoolItemAnalysis({
      ...(schoolId.value === undefined ? {} : { schoolId: schoolId.value }),
      tingkatan: tingkatan.value,
      signal,
    }),
  [() => schoolId.value, () => tingkatan.value],
)
const loadFailed = computed(() => isLoadError(error.value))

const subtitle = computed(() => {
  const d = data.value
  if (!d || d.school.name === '') return undefined
  return tingkatan.value
    ? `${d.school.name} — Tingkatan ${tingkatan.value.slice(1)}`
    : d.school.name
})
watchEffect(() => {
  if (subtitle.value === undefined) return
  pageMeta.setHeader({ title: 'Analisa Item — Sekolah', subtitle: subtitle.value })
})

const base = computed(() =>
  schoolId.value === undefined
    ? '/analisa-item/sekolah'
    : `/analisa-item/sekolah/${String(schoolId.value)}`,
)
const chips = computed<PillItem<string>[]>(() => [
  { key: 'all', label: 'Semua', to: base.value },
  { key: 'T4', label: 'Tingkatan 4', to: `${base.value}?tingkatan=T4` },
  { key: 'T5', label: 'Tingkatan 5', to: `${base.value}?tingkatan=T5` },
])
const activeChip = computed(() => (!hasQuery.value ? 'all' : tingkatan.value))

const emptyCopy = computed(() =>
  data.value?.variant === 'byId'
    ? 'Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan.'
    : 'Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan.',
)

const stats = computed<StatSpec[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { id: 'pelajar', label: 'Jumlah Pelajar', value: grouped(d.students), icon: 'users' },
    {
      id: 'soalan',
      label: 'Soalan Dijawab',
      value: d.answers === null ? DASH : grouped(d.answers),
      icon: 'question',
    },
    {
      id: 'ketepatan',
      label: 'Ketepatan Keseluruhan',
      value: d.accuracy === null ? DASH : pct1(d.accuracy),
      icon: 'target',
    },
  ]
})

const difficulty = computed(() => {
  const d = data.value?.difficulty
  if (!d) return null
  const total = d.mudah + d.sederhana + d.sukar
  return {
    total,
    parts: [
      { id: 'mudah', label: 'Mudah', level: 'Mudah', count: d.mudah },
      { id: 'sederhana', label: 'Sederhana', level: 'Sederhana', count: d.sederhana },
      { id: 'sukar', label: 'Sukar', level: 'Sukar', count: d.sukar },
    ] as const,
  }
})
const spark = computed(() => (data.value ? sparklineSeries(data.value.gps.years) : null))

type Subject = NonNullable<typeof data.value>['subjects'][number]
interface Row extends Record<string, unknown> {
  subjectId: number
  name: string
  pupilsText: string
  questionsText: string
  accuracyText: string
  wrongText: string
}
const rows = computed<Row[]>(() =>
  (data.value?.subjects ?? []).map((s: Subject) => ({
    subjectId: s.subjectId,
    name: s.name,
    pupilsText: grouped(s.pupils),
    questionsText: grouped(s.questions),
    accuracyText: pct1(s.accuracy),
    wrongText: grouped(s.wrong),
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'name', header: 'Subjek' },
  { accessorKey: 'pupilsText', header: 'Pelajar' },
  { accessorKey: 'questionsText', header: 'Soalan' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'wrongText', header: 'Salah' },
]
const cardFields = [
  { key: 'pupilsText', label: 'Pelajar' },
  { key: 'questionsText', label: 'Soalan' },
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'wrongText', label: 'Salah' },
]
</script>

<template>
  <DsPage data-testid="analisa-item-sekolah-page">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsBreadcrumb
        :items="[{ label: 'Papan Pemuka', to: home }, { label: 'Analisa Item Sekolah' }]"
        aria-label="Breadcrumb"
        data-testid="breadcrumb"
      />

      <DsPageHeader title="Analisa Item — Sekolah" :subtitle="subtitle" />

      <DsPanel v-if="data.school.name" data-testid="school-card">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex min-w-0 grow flex-col gap-2">
            <h2 class="text-heading break-words text-highlighted" data-testid="school-name">
              {{ data.school.name }}
            </h2>
            <div class="flex flex-wrap items-center gap-2 text-caption text-muted">
              <UBadge color="neutral" variant="subtle" :label="data.school.type" />
              <span v-if="data.school.code" class="tabular">{{ data.school.code }}</span>
              <span v-if="data.school.district"
                >{{ data.school.district }} • {{ data.school.state }}</span
              >
              <span v-else>{{ data.school.state }}</span>
            </div>
          </div>
          <dl class="flex gap-6 text-center">
            <div class="flex flex-col-reverse gap-1">
              <dt class="text-caption text-muted">Pelajar</dt>
              <dd class="tabular text-title text-highlighted" data-testid="school-students">
                {{ grouped(data.students) }}
              </dd>
            </div>
            <div class="flex flex-col-reverse gap-1">
              <dt class="text-caption text-muted">Jawapan</dt>
              <dd class="tabular text-title text-highlighted" data-testid="school-answers">
                {{ data.answers === null ? DASH : grouped(data.answers) }}
              </dd>
            </div>
          </dl>
        </div>
      </DsPanel>

      <DsPillNav :items="chips" :active="activeChip" label="Tingkatan" data-testid="tingkatan-chips" />

      <div v-if="data.students === 0" data-testid="school-empty">
        <DsEmptyState title="Tiada Data Pelajar" :description="emptyCopy" icon="i-ph-user-minus" />
      </div>

      <template v-else>
        <div data-testid="school-stats">
          <DsStatRow :items="statItems(stats)" data-testid="stat-cards" :cols="4" prefix="stat" />
        </div>

        <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <DsPanel class="min-w-0" data-testid="difficulty-card">
            <div class="flex flex-col gap-4">
              <h2 class="text-subheading text-highlighted">Profil Kesukaran</h2>
              <p v-if="!difficulty || difficulty.total === 0" class="text-body text-muted">
                Tiada data
              </p>
              <ul v-else class="grid grid-cols-3 gap-3">
                <li
                  v-for="p in difficulty.parts"
                  :key="p.id"
                  class="flex min-w-0 flex-col items-start gap-2"
                  :data-testid="`diff-${p.id}`"
                >
                  <UBadge
                    :color="LEVEL_BADGE[p.level]"
                    variant="subtle"
                    :icon="icon(LEVEL_ICON[p.level])"
                    :label="p.label"
                  />
                  <span class="tabular text-title text-highlighted">{{ p.count }}</span>
                  <UProgress
                    class="w-full"
                    :model-value="ratioPct(p.count, difficulty.total)"
                    :max="100"
                    :color="LEVEL_BADGE[p.level]"
                    size="sm"
                    :aria-label="`${p.label}: ${p.count}`"
                  />
                </li>
              </ul>
            </div>
          </DsPanel>

          <DsPanel class="min-w-0" data-testid="school-gps-card">
            <div class="flex flex-col gap-3">
              <h2 class="text-subheading text-highlighted">GPS Anggaran Sekolah</h2>
              <div class="flex flex-wrap items-center gap-3">
                <span
:class="[data.gps.band ? BAND_STYLE[data.gps.band].text : 'text-dimmed', 'tabular text-display']"
                  data-testid="school-gps-value"
                  >{{ data.gps.value === null ? DASH : dec2(data.gps.value) }}</span>
                <UBadge
                  v-if="data.gps.band"
                  :color="BAND_STYLE[data.gps.band].badge"
                  variant="subtle"
                  size="lg"
                  :label="data.gps.band"
                />
              </div>
              <p class="text-caption text-muted">
                Berdasarkan {{ data.gps.entries }} entri headcount • Lebih rendah = lebih baik
              </p>
              <DsChart
                v-if="spark"
                title="Trend GPS"
                type="line"
                :labels="spark.labels"
                :series="spark.series"
                data-testid="school-gps-spark"
              />
              <UButton
                v-if="allows(`/sekolah/${data.school.id}/prestasi`) && routeExists(`/sekolah/${data.school.id}/prestasi`)"
                :to="`/sekolah/${data.school.id}/prestasi`"
                color="neutral"
                variant="link"
                class="min-h-11 self-start"
                :icon="icon('chart-pie')"
                label="Prestasi 360"
              />
            </div>
          </DsPanel>
        </div>

        <section class="flex min-w-0 flex-col gap-3" data-testid="school-subjects">
          <div class="flex flex-col gap-1">
            <h2 class="text-subheading text-highlighted">Prestasi Mengikut Subjek</h2>
            <p class="text-body text-muted">
              Ringkasan ketepatan dan jawapan salah bagi setiap subjek
            </p>
          </div>
          <DsDataTable
            :data="rows"
            :columns="columns"
            caption="Prestasi mengikut subjek"
            card-title="name"
            :card-fields="cardFields"
            :page-size="100"
            data-testid="subject-table"
          />
        </section>

        <SchoolQuestionList v-if="data.questions.length > 0" :questions="data.questions" />
      </template>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
