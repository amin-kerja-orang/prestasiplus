<script setup lang="ts">
/**
 * S6 `/admin/questions/quality` "Dashboard Kualiti Soalan" (M04-T5; FR-M04-59…63).
 *
 * From `GET /api/question-quality`: the 4 KPI cards, the 3 bucket cards, "Taburan Kualiti", "Mengikut
 * Subjek", "Mengikut Tingkatan" and "Soalan Untuk Semakan Aktif" with the row link "Edit" (→ S4), then the
 * button "Jalankan Audit Semula" (no confirm; disabled with "Sedang audit..." while it runs). After the
 * audit the dashboard reloads and the API `status` is the green flash (UNVERIFIED COPY).
 *
 * D9 deviation: a distribution segment narrower than {@link NARROW_SEGMENT_PCT} % keeps its label
 * outside the bar (live clips it, e.g. "0.5"). Nothing else changes.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import {
  DsBadge,
  DsDataTable,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatRow,
  type CardField,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchQualitySummary, runQualityAudit } from '../api/quality'
import { averageColor } from '../lib/import-quality'
import { questionEditPath } from '../lib/question-list'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const flash = useFlash()
const { data, error, reload } = useApi((signal) => fetchQualitySummary({ signal }))

const firstLoad = computed(() => data.value === null && error.value === null)

const SEGMENTS = [
  { key: 'cemerlang', label: 'Cemerlang', color: 'success' },
  { key: 'baik', label: 'Baik', color: 'primary' },
  { key: 'lemah', label: 'Lemah', color: 'warning' },
  { key: 'kritikal', label: 'Kritikal', color: 'error' },
] as const

const segments = computed(() => {
  const d = data.value?.distribution
  if (!d) return []
  return SEGMENTS.filter((s) => d[s.key] > 0).map((s) => ({
    ...s,
    pct: d[s.key],
    text: `${formatNumber(d[s.key], { decimals: 1 })}%`,
  }))
})

const running = ref(false)

async function runAudit(): Promise<void> {
  if (running.value) return
  running.value = true
  try {
    const result = await runQualityAudit()
    await reload()
    flash.show({ type: 'success', message: result.status })
    window.scrollTo?.({ top: 0 })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    running.value = false
  }
}

interface SubjectRow extends Record<string, unknown> {
  subjectId: number
  name: string
  count: string
  average: number
  averageText: string
  excellent: string
}
interface ActionRow extends Record<string, unknown> {
  id: number
  idText: string
  questionText: string
  subjectName: string
  levelName: string
  source: string
  score: number
}

const subjectRows = computed<SubjectRow[]>(() =>
  (data.value?.bySubject ?? []).map((s) => ({
    subjectId: s.subjectId,
    name: s.name,
    count: formatNumber(s.count),
    average: s.average,
    averageText: formatNumber(s.average, { decimals: 1 }),
    excellent: `${String(s.excellentPct)}%`,
  })),
)
const actionRows = computed<ActionRow[]>(() =>
  (data.value?.actionList ?? []).map((q) => ({
    id: q.id,
    idText: `#${String(q.id)}`,
    questionText: q.questionText,
    subjectName: q.subject?.name ?? '',
    levelName: q.level?.name ?? '',
    source: q.sourceSet ?? '',
    score: q.qualityScore,
  })),
)

const kpis = computed<StatItem[]>(() =>
  data.value
    ? [
        {
          key: 'total',
          label: 'Jumlah Soalan',
          value: formatNumber(data.value.total),
          icon: 'stack',
          accent: 'action',
        },
        {
          key: 'average',
          label: 'Purata Skor',
          value: formatNumber(data.value.average, { decimals: 1 }),
          icon: 'gauge',
          accent: 'friend',
        },
        {
          key: 'excellent',
          label: 'Cemerlang (76-100)',
          value: formatNumber(data.value.excellentCount),
          icon: 'seal-check',
          accent: 'win',
        },
        {
          key: 'action',
          label: 'Perlu Tindakan Aktif (≤ 50)',
          value: formatNumber(data.value.activeActionCount),
          icon: 'warning',
          accent: 'trial',
        },
      ]
    : [],
)

const subjectColumns: TableColumn<SubjectRow>[] = [
  { accessorKey: 'name', header: 'Subjek' },
  { accessorKey: 'count', header: 'Soalan', meta: { width: 'xs' } },
  { accessorKey: 'averageText', header: 'Purata', meta: { width: 'xs' } },
  { accessorKey: 'excellent', header: 'Cemerlang', meta: { width: 'xs' } },
]
const subjectCardFields: CardField[] = [
  { key: 'count', label: 'Soalan' },
  { key: 'averageText', label: 'Purata' },
  { key: 'excellent', label: 'Cemerlang' },
]
const actionColumns: TableColumn<ActionRow>[] = [
  { accessorKey: 'idText', header: 'ID' },
  { accessorKey: 'questionText', header: 'Soalan' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'levelName', header: 'Tingkatan' },
  { accessorKey: 'source', header: 'Sumber' },
  { accessorKey: 'score', header: 'Skor' },
]
const actionCardFields: CardField[] = [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelName', label: 'Tingkatan' },
  { key: 'source', label: 'Sumber' },
  { key: 'score', label: 'Skor' },
]
</script>

<template>
  <DsPage data-testid="quality-page">
    <template #actions>
      <UButton
        type="button"
        :loading="running"
        :disabled="running || !data"
        :icon="running ? undefined : 'i-ph-clipboard-text'"
        class="min-h-11"
        data-testid="quality-audit"
        @click="runAudit"
      >
        {{ running ? 'Sedang audit...' : 'Jalankan Audit Semula' }}
      </UButton>
    </template>
    <DsLoadError
      v-if="error"
      :message="LOAD_ERROR"
      testid="quality-error"
      retry-testid="quality-retry"
      @retry="reload()"
    />

    <div v-else-if="firstLoad" class="flex flex-col gap-4" data-testid="quality-skeleton">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
      </div>
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else-if="data">
      <DsStatRow :items="kpis" :cols="4" prefix="kpi" data-testid="quality-kpis" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="quality-buckets">
        <DsPanel stretch data-testid="bucket-baik">
          <p class="text-overline text-muted">Skor 51-75</p>
          <p class="tabular my-1 text-display text-highlighted" data-testid="bucket-baik-value">
            {{ formatNumber(data.buckets.baik) }}
          </p>
          <p class="text-caption text-muted">Perlu semakan ringan atau pengayaan metadata.</p>
        </DsPanel>
        <DsPanel stretch data-testid="bucket-lemah">
          <p class="text-overline text-muted">Skor ≤ 50</p>
          <p class="tabular my-1 text-display text-error" data-testid="bucket-lemah-value">
            {{ formatNumber(data.buckets.lemahKritikal) }}
          </p>
          <p class="text-caption text-muted">Bucket ini patut jadi fokus tindakan segera.</p>
        </DsPanel>
        <DsPanel stretch data-testid="bucket-legacy">
          <p class="text-overline text-muted">Legacy Generic</p>
          <p class="tabular my-1 text-display text-highlighted" data-testid="bucket-legacy-value">
            {{ formatNumber(data.buckets.legacyGeneric) }}
          </p>
          <p class="text-caption break-words text-muted">
            Row legacy seperti <code class="text-label">tracking_a_feed_20260308</code>,
            <code class="text-label">spm_tracking_auto_seed_v1</code>, dan
            <code class="text-label">source_type=ai_generated</code> diasingkan daripada senarai
            tindakan aktif.
          </p>
        </DsPanel>
      </div>

      <DsPanel title="Taburan Kualiti" data-testid="quality-distribution">
        <ul class="flex flex-col gap-3">
          <li v-for="s in segments" :key="s.key" class="flex flex-col gap-1">
            <div class="flex items-baseline justify-between gap-3 text-body">
              <span class="text-highlighted">{{ s.label }}</span>
              <span class="tabular text-label text-highlighted" :data-testid="`dist-${s.key}`">{{
                s.text
              }}</span>
            </div>
            <UProgress :model-value="s.pct" :max="100" :color="s.color" size="md" />
          </li>
        </ul>
      </DsPanel>

      <div class="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
        <DsPanel
          title="Mengikut Subjek"
          icon="books"
          accent="friend"
          class="min-w-0"
          data-testid="quality-subjects"
        >
          <template #actions>
            <DsBadge tone="neutral" class="tabular" :label="`${formatNumber(subjectRows.length)} subjek`" />
          </template>
          <DsDataTable
            variant="bare"
            layout="fixed"
            :data="subjectRows"
            :columns="subjectColumns"
            caption="Kualiti mengikut subjek"
            :page-size="Math.max(subjectRows.length, 1)"
            card-title="name"
            :card-fields="subjectCardFields"
          >
            <template #averageText-cell="{ row }">
              <UBadge
                :color="averageColor(row.original.average)"
                variant="subtle"
                :label="row.original.averageText"
                data-testid="subject-average"
              />
            </template>
          </DsDataTable>
        </DsPanel>

        <DsPanel
          title="Mengikut Tingkatan"
          icon="graduation-cap"
          accent="trial"
          class="min-w-0"
          data-testid="quality-levels"
        >
          <div class="flex flex-col gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
            <div v-for="l in data.byLevel" :key="l.levelId" class="flex flex-col gap-1" data-testid="level-row">
              <div class="flex items-baseline justify-between gap-3 text-body">
                <span class="text-highlighted">{{ l.name }}</span>
                <span class="tabular text-muted"
                  >{{ formatNumber(l.count) }} soalan ·
                  {{ formatNumber(l.average, { decimals: 1 }) }}</span
                >
              </div>
              <UProgress :model-value="l.average" :max="100" size="sm" data-testid="level-bar" />
            </div>
          </div>
        </DsPanel>
      </div>

      <DsPanel
        title="Soalan Untuk Semakan Aktif"
        description="Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy."
        icon="warning"
        accent="heat"
        data-testid="quality-actions"
      >
        <template #actions>
          <DsBadge
            tone="neutral"
            class="tabular"
            data-testid="action-count"
            :label="`${formatNumber(data.actionList.length)} soalan`"
          />
        </template>

        <DsDataTable
          variant="bare"
          :data="actionRows"
          :columns="actionColumns"
          caption="Soalan untuk semakan aktif"
          :page-size="Math.max(actionRows.length, 1)"
          card-title="questionText"
          :card-fields="actionCardFields"
        >
          <template #questionText-cell="{ row }">
            <span class="block max-w-64 break-words text-highlighted">{{ row.original.questionText }}</span>
          </template>
          <template #source-cell="{ row }">
            <span class="block max-w-56 text-caption break-all text-muted">{{ row.original.source }}</span>
          </template>
          <template #score-cell="{ row }">
            <div class="flex items-center gap-2 whitespace-nowrap">
              <UBadge color="warning" variant="subtle" :label="String(row.original.score)" />
              <UButton
                :to="questionEditPath(row.original.id)"
                color="neutral"
                variant="link"
                icon="i-ph-pencil-simple"
                class="min-h-11"
                data-testid="action-edit"
              >
                Edit
              </UButton>
            </div>
          </template>
          <template #card-actions="{ row }">
            <UButton
              :to="questionEditPath(row.id as number)"
              color="neutral"
              variant="soft"
              icon="i-ph-pencil-simple"
              aria-label="Edit"
              class="min-h-11 min-w-11 justify-center"
            />
          </template>
        </DsDataTable>
      </DsPanel>
    </template>
  </DsPage>
</template>
