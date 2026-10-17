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
import { DsDataTable, DsPage, DsStatTile, type CardField } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchQualitySummary, runQualityAudit } from '../api/quality'
import ErrorBox from '../components/ErrorBox.vue'
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

const subjectColumns: TableColumn<SubjectRow>[] = [
  { accessorKey: 'name', header: 'Subjek' },
  { accessorKey: 'count', header: 'Soalan' },
  { accessorKey: 'averageText', header: 'Purata' },
  { accessorKey: 'excellent', header: 'Cemerlang' },
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
    <div v-if="error" class="flex flex-col gap-3" data-testid="quality-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" class="min-h-11" data-testid="quality-retry" @click="reload()">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <div v-else-if="firstLoad" class="flex flex-col gap-4" data-testid="quality-skeleton">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <USkeleton v-for="n in 4" :key="n" class="h-24 w-full" />
      </div>
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="quality-kpis">
        <DsStatTile
          :value="formatNumber(data.total)"
          unit="Jumlah Soalan"
          icon="i-ph-stack"
          data-testid="kpi-total"
        />
        <DsStatTile
          :value="formatNumber(data.average, { decimals: 1 })"
          unit="Purata Skor"
          icon="i-ph-gauge"
          data-testid="kpi-average"
        />
        <DsStatTile
          :value="formatNumber(data.excellentCount)"
          unit="Cemerlang (76-100)"
          icon="i-ph-seal-check"
          data-testid="kpi-excellent"
        />
        <DsStatTile
          :value="formatNumber(data.activeActionCount)"
          unit="Perlu Tindakan Aktif (≤ 50)"
          icon="i-ph-warning"
          data-testid="kpi-action"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="quality-buckets">
        <UCard data-testid="bucket-baik">
          <p class="text-overline text-muted">Skor 51-75</p>
          <p class="tabular my-1 text-display text-highlighted" data-testid="bucket-baik-value">
            {{ formatNumber(data.buckets.baik) }}
          </p>
          <p class="text-caption text-muted">Perlu semakan ringan atau pengayaan metadata.</p>
        </UCard>
        <UCard data-testid="bucket-lemah">
          <p class="text-overline text-muted">Skor ≤ 50</p>
          <p class="tabular my-1 text-display text-error" data-testid="bucket-lemah-value">
            {{ formatNumber(data.buckets.lemahKritikal) }}
          </p>
          <p class="text-caption text-muted">Bucket ini patut jadi fokus tindakan segera.</p>
        </UCard>
        <UCard data-testid="bucket-legacy">
          <p class="text-overline text-muted">Legacy Generic</p>
          <p class="tabular my-1 text-display text-highlighted" data-testid="bucket-legacy-value">
            {{ formatNumber(data.buckets.legacyGeneric) }}
          </p>
          <p class="text-caption break-words text-muted">
            Row legacy seperti `tracking_a_feed_20260308`, `spm_tracking_auto_seed_v1`, dan
            `source_type=ai_generated` diasingkan daripada senarai tindakan aktif.
          </p>
        </UCard>
      </div>

      <UCard data-testid="quality-distribution">
        <h3 class="mb-4 text-subheading text-highlighted">Taburan Kualiti</h3>
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
      </UCard>

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <div class="min-w-0" data-testid="quality-subjects">
          <h3 class="mb-3 text-subheading text-highlighted">Mengikut Subjek</h3>
          <DsDataTable
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
        </div>

        <UCard data-testid="quality-levels">
          <h3 class="mb-3 text-subheading text-highlighted">Mengikut Tingkatan</h3>
          <div class="flex flex-col gap-4">
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
        </UCard>
      </div>

      <div class="flex flex-col gap-3" data-testid="quality-actions">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-subheading text-highlighted">Soalan Untuk Semakan Aktif</h3>
            <p class="mt-1 text-caption text-muted">
              Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy.
            </p>
          </div>
          <span class="tabular shrink-0 text-body whitespace-nowrap text-muted" data-testid="action-count"
            >{{ formatNumber(data.actionList.length) }} soalan</span
          >
        </div>
        <DsDataTable
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
      </div>

      <div class="flex justify-end">
        <UButton
          type="button"
          :loading="running"
          :disabled="running"
          :icon="running ? undefined : 'i-ph-clipboard-text'"
          class="min-h-11"
          data-testid="quality-audit"
          @click="runAudit"
        >
          {{ running ? 'Sedang audit...' : 'Jalankan Audit Semula' }}
        </UButton>
      </div>
    </template>
  </DsPage>
</template>
