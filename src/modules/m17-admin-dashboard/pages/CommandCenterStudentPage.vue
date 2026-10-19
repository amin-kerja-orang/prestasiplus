<script setup lang="ts">
/**
 * S7 "{pelajar} - Command Center" (M17 FR-M17-53..59, FN-M17-5.4.x): back link "← Kembali ke Kelas",
 * breadcrumb, five cards ("Jumlah Jawapan" opens all sessions), "Pecahan Subjek", "Aktiviti Mingguan
 * (8 Minggu)" (a 0 week ignores clicks), "Trend Mood (30 Hari)" (a dot opens the mood-day modal from page
 * data), "HeadCount" (a row opens the headcount modal) and "ALESA AI Insight". The sessions, session,
 * headcount and mood-day modals are opened from here. The route prefix is a prop.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import {
  DsChart,
  DsDrillTable,
  DsLoadError,
  DsPanel,
  DsStatRow,
  type StatItem,
  DsGrid,
  DsStack,
  DsCluster,
  DsText,
} from '@/ds'

import { fetchCcStudent } from '../api/command-center'
import type { CcHeadcountRow, CcMoodDot, CcWeek } from '../api/command-center-types'
import {
  type CcSessionsSource,
  count,
  dmyOfKey,
  MOOD,
  pct1,
  score2,
} from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcFrame from '../components/command-center/CcFrame.vue'
import CcHeadcountModal from '../components/command-center/CcHeadcountModal.vue'
import CcMoodDayModal from '../components/command-center/CcMoodDayModal.vue'
import CcSessionDetailModal from '../components/command-center/CcSessionDetailModal.vue'
import CcSessionsModal from '../components/command-center/CcSessionsModal.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcHeadcountRow]: CcHeadcountRow[K] }

const props = withDefaults(defineProps<{ userId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound, reload } = useCcPage(
  (signal) => fetchCcStudent(props.userId, { signal }),
  () => props.userId,
  (d) => d.student.name,
)

const classLink = computed(() =>
  data.value?.class ? paths.value.classroom(data.value.class.id) : undefined,
)
const crumbs = computed(() => {
  const d = data.value
  if (!d) return [{ label: 'Command Center', to: paths.value.overview }]
  return [
    { label: 'Command Center', to: paths.value.overview },
    ...(d.school ? [{ label: d.school.name, to: paths.value.school(d.school.id) }] : []),
    ...(d.teacher
      ? [
          {
            label: d.teacher.name,
            to: d.school ? paths.value.teacher(d.school.id, d.teacher.id) : undefined,
          },
        ]
      : []),
    ...(d.class ? [{ label: d.class.name, to: classLink.value }] : []),
    { label: d.student.name },
  ]
})

// --- modals ---------------------------------------------------------------------------------
const sessionsSource = ref<CcSessionsSource | null>(null)
const sessionId = ref<string | null>(null)
const headcount = ref<{ configId: number; subject: string } | null>(null)
const moodDay = ref<(CcMoodDot & { noSession: boolean }) | null>(null)

function openWeek(week: CcWeek) {
  if (week.count === 0) return
  sessionsSource.value = { kind: 'week', start: week.start, end: week.end, label: week.label }
}
function openMood(dot: CcMoodDot) {
  const weeks = data.value?.weeks ?? []
  const week = weeks.find((w) => w.start <= dot.date && dot.date <= w.end)
  moodDay.value = { ...dot, noSession: week !== undefined && week.count === 0 }
}
function openHeadcount(h: CcHeadcountRow) {
  headcount.value = { configId: h.configId, subject: h.subject }
}

const cards = computed<StatItem[]>(() => {
  const c = data.value?.cards
  if (!c) return []
  return [
    {
      key: 'answers',
      label: 'Jumlah Jawapan',
      value: count(c.answers),
      icon: 'i-ph-clipboard-text',
      accent: 'action',
      clickTitle: 'Klik untuk lihat semua sesi',
      onClick: () => {
        sessionsSource.value = { kind: 'all' }
      },
    },
    {
      key: 'accuracy',
      label: 'Ketepatan',
      value: pct1(c.accuracy),
      icon: 'i-ph-target',
      accent: 'win',
    },
    {
      key: 'activeDays',
      label: 'Hari Aktif',
      value: String(c.activeDays),
      icon: 'i-ph-calendar-check',
      accent: 'friend',
    },
    { key: 'streak', label: 'Streak', value: String(c.streak), icon: 'i-ph-fire', accent: 'heat' },
    {
      key: 'consistency',
      label: 'Konsistensi',
      value: `${String(c.consistency)}%`,
      icon: 'i-ph-chart-line-up',
      accent: 'trial',
    },
  ]
})

const weekLabels = computed(() => (data.value?.weeks ?? []).map((w) => w.label))
const weekSeries = computed(() => [
  { label: 'Aktiviti Mingguan', data: (data.value?.weeks ?? []).map((w) => w.count) },
])
const HEADCOUNT_COLUMNS: TableColumn<Row>[] = [
  { id: 'subject', header: 'Subjek' },
  { id: 'tov', header: 'TOV' },
  { id: 'etr', header: 'ETR' },
  { id: 'rs', header: 'RS' },
  { id: 'grade', header: 'Gred' },
  { id: 'date', header: 'Tarikh' },
]
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="classLink ?? paths.overview"
    back-label="Kembali ke Kelas"
    :crumbs="crumbs"
  >
    <DsLoadError v-if="error" testid="cc-error" @retry="reload" />
    <p
      v-else-if="!data"
      class="flex items-center gap-2 text-body text-muted"
      data-testid="cc-loading"
    >
      <UProgress class="w-16" aria-hidden="true" />Memuatkan...
    </p>
    <template v-else>
      <DsStatRow
        :items="cards"
        prefix="cc-stat"
        :cols="5"
        density="roomy"
        data-testid="cc-student-cards"
      />

      <DsGrid :cols="{ md: 2 }">
        <DsPanel icon="i-ph-chart-bar" title="Pecahan Subjek">
          <DsStack as="ul" gap="2xs" data-testid="cc-subjects">
            <li v-for="s in data.subjects" :key="s.code" class="min-w-0">
              <UButton
                color="neutral"
                variant="ghost"
                block
                class="h-auto min-h-11 min-w-0 justify-start gap-3 px-2 py-2 text-start"
                title="Klik untuk lihat sesi"
                data-testid="cc-subject-row"
                :data-code="s.code"
                @click="sessionsSource = { kind: 'subject', code: s.code, name: s.label }"
              >
                <DsText
                  variant="label"
                  tone="highlighted"
                  wrap="anywhere"
                  class="w-28 min-w-0 shrink-0 sm:w-36"
                  >{{ s.label }}</DsText
                >
                <UProgress
                  class="min-w-6 flex-1"
                  :model-value="Math.min(100, s.pct)"
                  :max="100"
                  aria-hidden="true"
                />
                <DsText variant="caption" as="span" tabular class="shrink-0">{{
                  pct1(s.pct)
                }}</DsText>
                <DsText
                  variant="caption"
                  as="span"
                  tabular
                  class="shrink-0"
                  data-testid="cc-subject-ratio"
                  >{{ s.correct }}/{{ s.total }}</DsText
                >
              </UButton>
            </li>
          </DsStack>
        </DsPanel>

        <DsPanel icon="i-ph-chart-line-up" title="Aktiviti Mingguan (8 Minggu)">
          <DsChart
            title="Aktiviti Mingguan (8 Minggu)"
            :labels="weekLabels"
            :series="weekSeries"
            table-label="Aktiviti mingguan, 8 minggu"
          />
          <ul class="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8" data-testid="cc-weeks">
            <li v-for="w in data.weeks" :key="w.start" class="min-w-0">
              <UButton
                color="neutral"
                variant="soft"
                block
                :disabled="w.count === 0"
                class="h-auto min-h-11 flex-col gap-0 px-1 py-1"
                data-testid="cc-week"
                :data-start="w.start"
                :data-count="w.count"
                @click="openWeek(w)"
              >
                <DsText variant="label" tone="highlighted" tabular>{{ w.count }}</DsText>
                <DsText variant="caption" as="span" tabular data-testid="cc-week-label">{{
                  w.label
                }}</DsText>
              </UButton>
            </li>
          </ul>
        </DsPanel>

        <DsPanel icon="i-ph-smiley" title="Trend Mood (30 Hari)">
          <DsText
            v-if="data.moodTrend.length === 0"
            variant="body"
            tone="muted"
            data-testid="cc-mood-empty"
          >
            Tiada data mood
          </DsText>
          <DsCluster v-else as="ul" gap="2xs" align="stretch" data-testid="cc-mood-dots">
            <li v-for="d in data.moodTrend" :key="d.date">
              <UButton
                color="neutral"
                variant="ghost"
                :icon="MOOD[d.mood].icon"
                :title="`${d.date} — ${MOOD[d.mood].label}`"
                :aria-label="`${d.date} — ${MOOD[d.mood].label}`"
                data-testid="cc-mood-dot"
                :data-date="d.date"
                @click="openMood(d)"
              />
            </li>
          </DsCluster>
        </DsPanel>

        <DsPanel icon="i-ph-clipboard-text" title="HeadCount">
          <div data-testid="cc-table-scroller">
            <DsDrillTable
              :data="data.headcount"
              :columns="HEADCOUNT_COLUMNS"
              caption="HeadCount"
              data-testid="cc-headcount-table"
              @drill="openHeadcount"
            >
              <template #subject-cell="{ row }">
                <UButton
                  variant="link"
                  color="neutral"
                  class="h-auto p-0 text-start"
                  trailing-icon="i-ph-magnifying-glass"
                  title="Klik untuk lihat semua pelajar"
                  :label="row.original.subject"
                  data-testid="cc-headcount-row"
                  :data-config-id="row.original.configId"
                  @click.stop="openHeadcount(row.original)"
                />
              </template>
              <template #tov-cell="{ row }"
                ><span class="tabular">{{ score2(row.original.tov) }}</span></template
              >
              <template #etr-cell="{ row }"
                ><span class="tabular">{{ score2(row.original.etr) }}</span></template
              >
              <template #rs-cell="{ row }"
                ><span class="tabular">{{ score2(row.original.rs) }}</span></template
              >
              <template #grade-cell="{ row }">{{ row.original.grade ?? '-' }}</template>
              <template #date-cell="{ row }"
                ><span class="tabular text-muted">{{ dmyOfKey(row.original.date) }}</span></template
              >
            </DsDrillTable>
          </div>
        </DsPanel>
      </DsGrid>

      <DsPanel icon="i-ph-sparkle" title="ALESA AI Insight">
        <div class="flex flex-col gap-2 bg-soft p-4" data-testid="cc-insight">
          <DsText variant="overline" as="div" tone="primary">Analisis ALESA</DsText>
          <DsText variant="body" tone="highlighted" data-testid="cc-insight-text">
            {{ data.insight.texts.join(' ') }}
          </DsText>
          <DsText variant="caption" align="end">Sumber: {{ data.insight.source }}</DsText>
        </div>
      </DsPanel>

      <CcSessionsModal
        v-if="sessionsSource"
        :user-id="userId"
        :source="sessionsSource"
        @close="sessionsSource = null"
        @open-session="(id) => (sessionId = id)"
      />
      <CcSessionDetailModal v-if="sessionId" :session-id="sessionId" @close="sessionId = null" />
      <CcHeadcountModal
        v-if="headcount"
        :config-id="headcount.configId"
        :subject="headcount.subject"
        @close="headcount = null"
      />
      <CcMoodDayModal
        v-if="moodDay"
        :date="moodDay.date"
        :mood="moodDay.mood"
        :reason="moodDay.reason"
        :no-session="moodDay.noSession"
        @close="moodDay = null"
      />
    </template>
  </CcFrame>
</template>
