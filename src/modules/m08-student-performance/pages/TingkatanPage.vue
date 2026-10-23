<script setup lang="ts">
/**
 * S3 `/prestasi/tingkatan/{t4|t5}` "Dashboard Tingkatan" (M08-T5; FR-M08-23…28). An unknown code is the
 * standard 404 (the API answers 404). "On Track" / "Below Target", the class On Track / Below and the
 * "Murid Berisiko" rows are headcount figures (M08-T1b) and read 0 / empty until they exist. The "Lihat →"
 * class link is shown only to a role that may open the class page (staff), so a pupil gets no dead link (DV-M08-47).
 */
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import { DsBackLink, DsDataTable, DsLeaderRow, DsLoadError, DsPage, DsPageHeader, DsPanel, DsPillNav, DsStatRow, type PillItem } from '@/ds'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchLevelDetail } from '../api/performance'
import { usePhIcon } from '../lib/icons'
import {
  TONE_TEXT,
  accuracyTone,
  capPct,
  dec2,
  gapText,
  grouped,
  levelNumber,
  pct1,
  pctTrim,
  plain,
} from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useCanOpen } from '../lib/route-access'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()
const { canOpen } = useCanOpen()

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))
const pageMeta = usePageMeta()
const icon = usePhIcon()

watchEffect(() => {
  if (code.value === 't4' || code.value === 't5') {
    pageMeta.setHeader({
      title: `Tingkatan ${String(levelNumber(code.value))}`,
      subtitle: 'Dashboard Prestasi Tingkatan',
    })
  }
})

const { data, error, reload } = useRouteData(
  (signal) => fetchLevelDetail(code.value, { signal }),
  () => code.value,
)
const loadFailed = computed(() => isLoadError(error.value))

const stats = computed<StatSpec[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { id: 'kelas', label: 'Kelas', value: plain(d.classes), icon: 'chalkboard' },
    { id: 'murid', label: 'Murid', value: plain(d.students), icon: 'users' },
    { id: 'ketepatan', label: 'Purata Ketepatan', value: pct1(capPct(d.accuracy)), icon: 'target' },
    { id: 'sesi', label: 'Jumlah Sesi', value: grouped(d.sessions), icon: 'lightning' },
    { id: 'on', label: 'On Track', value: plain(d.onTrack), icon: 'check-circle' },
    {
      id: 'below',
      label: 'Below Target',
      value: plain(d.below),
      icon: 'warning',
      accent: 'heat',
    },
  ]
})

type ClassRow = NonNullable<typeof data.value>['classRows'][number]
interface Row extends Record<string, unknown> {
  classId: number
  name: string
  subject: string
  teacher: string
  students: number
  sessions: number
  accuracyText: string
  accuracy: number
  onTrack: number
  below: number
  href: string | null
}
const rows = computed<Row[]>(() =>
  (data.value?.classRows ?? []).map((r: ClassRow) => ({
    classId: r.classId,
    name: r.name,
    subject: r.subject,
    teacher: r.teacher ?? '—',
    students: r.students,
    sessions: r.sessions,
    accuracyText: pctTrim(capPct(r.accuracy)),
    accuracy: r.accuracy,
    onTrack: r.onTrack,
    below: r.below,
    href: r.href,
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'name', header: 'Kelas' },
  { accessorKey: 'subject', header: 'Subjek' },
  { accessorKey: 'teacher', header: 'Guru' },
  { accessorKey: 'students', header: 'Murid' },
  { accessorKey: 'sessions', header: 'Sesi' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'onTrack', header: 'On Track' },
  { accessorKey: 'below', header: 'Below' },
  { accessorKey: 'href', header: 'Aksi' },
]
const cardFields = [
  { key: 'subject', label: 'Subjek' },
  { key: 'teacher', label: 'Guru' },
  { key: 'students', label: 'Murid' },
  { key: 'sessions', label: 'Sesi' },
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'onTrack', label: 'On Track' },
  { key: 'below', label: 'Below' },
]
const levelPills: PillItem<string>[] = ['t4', 't5'].map((c) => ({
  key: c,
  label: c.toUpperCase(),
  to: `/prestasi/tingkatan/${c}`,
}))
</script>

<template>
  <DsPage data-testid="tingkatan-page">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsPageHeader
        :show-title="true" :title="`Tingkatan ${levelNumber(data.code)}`"
        :subtitle="`Dashboard Prestasi Tingkatan · ${plain(data.classes)} kelas · ${plain(data.subjects)} subjek`"
        subtitle-testid="level-summary"
      >
        <template #breadcrumb>
          <DsBackLink to="/prestasi/tingkatan" label="Kembali ke senarai tingkatan" data-testid="back-link" />
        </template>
        <template #actions>
          <DsPillNav
            :items="levelPills"
            :active="data.code"
            label="Tingkatan"
            testid-prefix="pill"
          />
        </template>
      </DsPageHeader>

      <DsStatRow :items="statItems(stats)" data-testid="stat-cards" :cols="5" prefix="stat" />

      <DsPanel data-testid="headcount-card">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-subheading text-highlighted">Headcount Keseluruhan</h2>
            <span class="tabular text-label text-highlighted" data-testid="headcount-pct"
              >{{ data.onTrackPct }}% On Track</span
            >
          </div>
          <UProgress
            :model-value="data.onTrack + data.below > 0 ? data.onTrackPct : 0"
            :max="100"
            color="success"
            aria-label="Headcount Keseluruhan"
          />
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
            <span class="flex items-center gap-2">
              <UIcon :name="icon('check-circle')" class="size-4 text-success" />On Track:
              {{ data.onTrack }}
            </span>
            <span class="flex items-center gap-2">
              <UIcon :name="icon('warning')" class="size-4 text-error" />Below Target:
              {{ data.below }}
            </span>
          </div>
        </div>
      </DsPanel>

      <section class="flex min-w-0 flex-col gap-3" data-testid="class-card">
        <h2 class="text-subheading text-highlighted">Perbandingan Kelas</h2>
        <DsDataTable
          :data="rows"
          :columns="columns"
          caption="Perbandingan kelas"
          card-title="name"
          :card-fields="cardFields"
          :page-size="100"
          data-testid="class-table"
        >
          <template #name-cell="{ row }">
            <span
              class="text-label whitespace-nowrap text-highlighted"
              :data-testid="`class-row-${row.original.classId}`"
              >{{ row.original.name }}</span
            >
          </template>
          <template #accuracyText-cell="{ row }">
            <span :class="[TONE_TEXT[accuracyTone(row.original.accuracy)], 'text-label']">{{
              row.original.accuracyText
            }}</span>
          </template>
          <template #onTrack-cell="{ row }">
            <span :class="row.original.onTrack > 0 ? 'text-success' : 'text-dimmed'">{{
              row.original.onTrack
            }}</span>
          </template>
          <template #below-cell="{ row }">
            <span :class="row.original.below > 0 ? 'text-error' : 'text-dimmed'">{{
              row.original.below
            }}</span>
          </template>
          <template #href-cell="{ row }">
            <UButton
              v-if="row.original.href && canOpen(row.original.href)"
              :to="row.original.href"
              color="neutral"
              variant="link"
              class="min-h-11"
              label="Lihat →"
            />
          </template>
          <template #card-actions="{ row }">
            <UButton
              v-if="row.href && canOpen(row.href as string)"
              :to="row.href as string"
              color="neutral"
              variant="soft"
              size="lg"
              label="Lihat →"
            />
          </template>
        </DsDataTable>
      </section>

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <DsPanel class="min-w-0" data-testid="top-students">
          <div class="flex flex-col gap-3">
            <h2 class="text-subheading text-highlighted">Murid Terbaik</h2>
            <ol class="flex max-h-96 flex-col gap-2 overflow-y-auto">
              <DsLeaderRow
                v-for="(s, i) in data.topStudents"
                :key="s.userId"
                :rank="i + 1"
                :name="s.name"
                :school="`${s.sessions} sesi · ${s.answered} soalan`"
                :points="pctTrim(capPct(s.accuracy))"
                :data-testid="`top-${s.userId}`"
              />
            </ol>
          </div>
        </DsPanel>

        <DsPanel class="min-w-0" data-testid="at-risk">
          <div class="flex flex-col gap-3">
            <h2 class="text-subheading text-highlighted">Murid Berisiko</h2>
            <div class="flex max-h-96 flex-col gap-2 overflow-y-auto">
              <RouterLink
                v-for="r in data.atRisk"
                :key="`${r.userId}-${r.className}-${r.checkpoint}`"
                :to="`/prestasi/${r.userId}`"
                class="flex min-h-11 items-center gap-3 bg-soft p-3"
                data-testid="at-risk-row"
              >
                <UIcon :name="icon('warning')" class="size-5 shrink-0 text-error" />
                <span class="flex min-w-0 grow flex-col">
                  <span class="text-label break-words text-highlighted">{{ r.name }}</span>
                  <span class="text-caption text-muted"
                    >{{ r.className }} · OTR{{ r.checkpoint }}: {{ dec2(r.ar) }}% (sasaran
                    {{ dec2(r.target) }}%)</span
                  >
                </span>
                <span class="tabular shrink-0 text-label text-error">{{ gapText(r.gap) }}</span>
              </RouterLink>
            </div>
          </div>
        </DsPanel>
      </div>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
