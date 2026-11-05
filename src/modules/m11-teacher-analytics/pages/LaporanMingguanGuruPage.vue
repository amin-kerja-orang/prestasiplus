<script setup lang="ts">
/**
 * S6-T01 `/guru/laporan-mingguan-kelas` "Laporan Mingguan" (R1-GUR-43, API-GUR-21). The teacher picks
 * one of the own classes (first by default); the report covers the current Monday-Sunday week (MYT).
 * No week navigation. With no class: the select is empty and disabled, nothing is fetched, tiles read
 * 0 and every list shows its empty copy. "Cetak" prints the report sheet (print rules in
 * `src/theme/ds-extras.css` hide everything outside `[data-ds='print-sheet']`).
 */
import { AMARAN_MONTH_ABBREVIATIONS, type GuruWeeklyReport } from '@pp/contract'
import { computed, ref, watch } from 'vue'

import { useApi } from '@/composables'
import {
  DsCluster,
  DsGrid,
  DsHeading,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsProgress,
  DsStack,
  DsText,
} from '@/ds'
import { roundHalfUp } from '@/lib/number'

import { fetchGuruClasses } from '@/modules/m10-teacher-class'
import { fetchGuruWeeklyReport } from '../api'

const COPY = {
  classLabel: 'Pilih Kelas',
  noClass: 'Tiada kelas lagi',
  print: 'Cetak',
  summaryTitle: 'Ringkasan Minggu Ini',
  answered: 'Soalan Dijawab',
  active: 'Pelajar Aktif',
  improved: 'Pelajar Meningkat',
  attention: 'Subjek Perlu Perhatian',
  topTitle: 'Top Performers',
  topEmpty: 'Tiada pelajar dengan sekurang-kurangnya 5 soalan minggu ini.',
  improvedTitle: 'Paling Meningkat',
  improvedCaption: '(berbanding minggu lepas)',
  improvedEmpty: 'Tiada perbandingan minggu-ke-minggu yang mencukupi.',
  attentionCaption: '(ketepatan < 50%)',
  attentionAllGood: 'Syabas! Semua subjek melebihi 50% ketepatan.',
  attentionNone: 'Tiada latihan direkodkan minggu ini.',
} as const

const DAY_MS = 86_400_000
const MYT_MS = 8 * 3_600_000
const pad = (n: number): string => String(n).padStart(2, '0')
const mon = (m: number): string => AMARAN_MONTH_ABBREVIATIONS[m] ?? ''

/** Current Monday and Sunday (MYT, UTC+8) as UTC-midnight dates. */
function currentWeekMyt(now: number = Date.now()): { from: Date; to: Date } {
  const my = new Date(now + MYT_MS)
  const today = Date.UTC(my.getUTCFullYear(), my.getUTCMonth(), my.getUTCDate())
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7
  const from = new Date(today - sinceMonday * DAY_MS)
  return { from, to: new Date(from.getTime() + 6 * DAY_MS) }
}
const dm = (d: Date): string => `${pad(d.getUTCDate())} ${mon(d.getUTCMonth())}`
const dmy = (d: Date): string => `${dm(d)} ${String(d.getUTCFullYear())}`
/** "YYYY-MM-DD" to a UTC-midnight date. */
const parseYmd = (s: string): Date => {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const whole = (v: number): number => roundHalfUp(v)

const classes = useApi((signal) => fetchGuruClasses({ signal }))
const classList = computed(() => classes.data.value?.data ?? [])
const classId = ref('')
watch(
  classList,
  (list) => {
    if (!list.some((c) => String(c.id) === classId.value)) {
      classId.value = list[0] ? String(list[0].id) : ''
    }
  },
  { immediate: true },
)

/** Fetches only through the `classId` watcher below, so no class means no call. */
const report = useApi((signal) => fetchGuruWeeklyReport(classId.value, { signal }), [], {
  immediate: false,
})
watch(
  classId,
  (id) => {
    if (id !== '') void report.reload()
  },
  { immediate: true },
)

const hasClass = computed(() => classList.value.length > 0)
const d = computed<GuruWeeklyReport | null>(() => (hasClass.value ? report.data.value : null))

const classesLoading = computed(() => !classes.error.value && !classes.data.value)
const reportLoading = computed(() => hasClass.value && !report.error.value && !report.data.value)
const loadError = computed(() => classes.error.value ?? (hasClass.value ? report.error.value : null))
const ready = computed(() => !classesLoading.value && !loadError.value && !reportLoading.value)

function retry(): void {
  if (classes.error.value) void classes.reload()
  else void report.reload()
}

const week = computed(() => {
  if (d.value) {
    const from = parseYmd(d.value.week.from)
    const to = parseYmd(d.value.week.to)
    return { label: d.value.week.label, print: `${dm(from)} – ${dmy(to)}` }
  }
  const { from, to } = currentWeekMyt()
  return { label: `${dmy(from)} — ${dmy(to)}`, print: `${dm(from)} – ${dmy(to)}` }
})
const className = computed(() => {
  if (d.value) return d.value.classroom.name
  return classList.value.find((c) => String(c.id) === classId.value)?.name ?? 'Semua Kelas'
})
const printTitle = computed(() => `Laporan Mingguan — ${className.value} | ${week.value.print}`)

const tiles = computed(() => [
  { key: 'answered', label: COPY.answered, value: d.value?.summary.answered ?? 0 },
  { key: 'active', label: COPY.active, value: d.value?.summary.activePupils ?? 0 },
  { key: 'improved', label: COPY.improved, value: d.value?.summary.improvedPupils ?? 0 },
  { key: 'attention', label: COPY.attention, value: d.value?.summary.attentionSubjects ?? 0 },
])
const top = computed(() => d.value?.topPerformers ?? [])
const improvedRows = computed(() => d.value?.mostImproved ?? [])
const subjects = computed(() => d.value?.attentionSubjects ?? [])
const subjectsEmpty = computed(() =>
  (d.value?.summary.answered ?? 0) > 0 ? COPY.attentionAllGood : COPY.attentionNone,
)

function printPage(): void {
  window.print()
}
</script>

<template>
  <DsPage data-testid="lm-page">
    <DsLoadError
      v-if="loadError"
      :error="loadError"
      :message="loadError.message || undefined"
      testid="lm-error"
      @retry="retry"
    />

    <div v-else-if="!ready" aria-busy="true" data-testid="lm-loading">
      <UProgress />
    </div>

    <DsStack v-else gap="md" data-ds="print-sheet" data-testid="lm-sheet">
      <DsPanel class="print:hidden" data-testid="lm-toolbar">
        <DsCluster stack-below="sm" justify="between" align="end">
          <label>
            <DsText variant="label" as="span">{{ COPY.classLabel }}</DsText>
            <DsNativeSelect
              v-model="classId"
              name="classroomId"
              :placeholder="hasClass ? undefined : COPY.noClass"
              :disabled="!hasClass"
              data-testid="lm-class"
            >
              <option v-for="c in classList" :key="c.id" :value="String(c.id)">
                {{ c.name }}
              </option>
            </DsNativeSelect>
          </label>
          <UButton
            type="button"
            icon="i-ph-printer"
            class="min-h-11"
            data-testid="lm-print"
            @click="printPage"
            >{{ COPY.print }}</UButton
          >
        </DsCluster>
      </DsPanel>

      <DsHeading :level="2" class="hidden print:block" data-testid="lm-print-title">
        {{ printTitle }}
      </DsHeading>

      <UCard data-testid="lm-summary">
        <DsStack gap="sm">
          <DsHeading :level="2" variant="label">{{ COPY.summaryTitle }}</DsHeading>
          <DsText variant="body" tone="muted" data-testid="lm-week">{{ week.label }}</DsText>
          <DsGrid :cols="{ base: 2, md: 4 }" gap="sm" data-testid="lm-tiles">
            <UCard
              v-for="t in tiles"
              :key="t.key"
              variant="soft"
              :data-testid="`lm-tile-${t.key}`"
            >
              <DsText variant="heading" tabular data-testid="lm-tile-value">{{ t.value }}</DsText>
              <DsText variant="caption">{{ t.label }}</DsText>
            </UCard>
          </DsGrid>
        </DsStack>
      </UCard>

      <UCard data-testid="lm-top">
        <DsStack gap="sm">
          <DsHeading :level="2" variant="label">{{ COPY.topTitle }}</DsHeading>
          <DsText v-if="top.length === 0" variant="body" tone="muted" data-testid="lm-top-empty">
            {{ COPY.topEmpty }}
          </DsText>
          <DsStack v-else as="ol" gap="xs" data-testid="lm-top-rows">
            <li v-for="r in top" :key="r.rank" data-testid="lm-top-row">
              <DsCluster justify="between" align="baseline">
                <DsText variant="body" wrap="anywhere"
                  ><DsText variant="label" as="span" tabular>{{ r.rank }}</DsText>
                  {{ r.name }}</DsText
                >
                <DsText variant="caption">{{ r.answered }} soalan minggu ini</DsText>
                <DsText variant="label" tabular>{{ whole(r.accuracy) }}% ketepatan</DsText>
              </DsCluster>
            </li>
          </DsStack>
        </DsStack>
      </UCard>

      <UCard data-testid="lm-improved">
        <DsStack gap="sm">
          <DsHeading :level="2" variant="label"
            >{{ COPY.improvedTitle }}
            <DsText variant="caption" as="span">{{ COPY.improvedCaption }}</DsText></DsHeading
          >
          <DsText
            v-if="improvedRows.length === 0"
            variant="body"
            tone="muted"
            data-testid="lm-improved-empty"
          >
            {{ COPY.improvedEmpty }}
          </DsText>
          <DsStack v-else as="ul" gap="xs" data-testid="lm-improved-rows">
            <li v-for="(r, i) in improvedRows" :key="i" data-testid="lm-improved-row">
              <DsCluster justify="between" align="baseline">
                <DsText variant="body" wrap="anywhere">{{ r.name }}</DsText>
                <DsText variant="body" tone="muted" tabular
                  >{{ whole(r.previousAccuracy) }}% → {{ whole(r.accuracy) }}%</DsText
                >
                <DsText variant="label" tabular>+{{ r.delta }}%</DsText>
              </DsCluster>
            </li>
          </DsStack>
        </DsStack>
      </UCard>

      <UCard data-testid="lm-attention">
        <DsStack gap="sm">
          <DsHeading :level="2" variant="label"
            >{{ COPY.attention }}
            <DsText variant="caption" as="span">{{ COPY.attentionCaption }}</DsText></DsHeading
          >
          <DsText
            v-if="subjects.length === 0"
            variant="body"
            tone="muted"
            data-testid="lm-attention-empty"
          >
            {{ subjectsEmpty }}
          </DsText>
          <DsStack v-else as="ul" gap="sm" data-testid="lm-attention-rows">
            <li v-for="(s, i) in subjects" :key="i" data-testid="lm-attention-row">
              <DsStack gap="xs">
                <DsCluster justify="between" align="baseline">
                  <DsText variant="body" wrap="anywhere">{{ s.subject }}</DsText>
                  <DsText variant="label" tabular
                    >{{ whole(s.accuracy) }}% ({{ s.answered }} soalan)</DsText
                  >
                </DsCluster>
                <DsProgress
                  :value="whole(s.accuracy)"
                  :show-value="false"
                  tone="error"
                  :aria-label="`${s.subject} ${whole(s.accuracy)}%`"
                  data-testid="lm-attention-bar"
                />
              </DsStack>
            </li>
          </DsStack>
        </DsStack>
      </UCard>
    </DsStack>
  </DsPage>
</template>
