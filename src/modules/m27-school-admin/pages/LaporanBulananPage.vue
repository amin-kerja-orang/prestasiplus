<script setup lang="ts">
/**
 * S5 `/admin-sekolah/laporan-bulanan` "Laporan Bulanan" (R1-AS-50; SRS M27 Part B v1.8 FR-M27-81…87, 44). User
 * shell; one read-only call (`GET /api/admin-sekolah/laporan-bulanan?bulan=YYYY-MM`, school from the session; an
 * invalid or future month gives the current month). Top to bottom: breadcrumb, heading with the month links, the
 * eight cards, the note "Tiada data untuk bulan ini." (a month without answers), "Trend Harian", "Trend
 * Penggunaan Bulanan {tahun}", "Statistik Bulanan", "Prestasi Mengikut Subjek", footer and "Cetak / PDF".
 * Every section always renders, with its own empty copy (FR-AS-50-3).
 *
 * Print (FR-AS-50-4): the report sits in a `data-ds="print-sheet"` wrapper, so the shell is hidden by the global
 * print rules (A4 portrait, `src/theme/ds-extras.css`); the month links and the button are `print:hidden`; the
 * print title is "Laporan Bulanan — {Bulan} {tahun}" (document title while printing, and a print-only heading).
 *
 * States: loading shows the spinner only; a 403 renders the global 403 page in place; any other failure
 * shows the server's own message.
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError, isHttpMode } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBreadcrumb, DsChart, DsLoadError, DsPage, DsPanel } from '@/ds'

import { fetchMonthlyReport } from '../api/school-admin'
import MonthlyCards from '../components/monthly/MonthlyCards.vue'
import MonthlyTable from '../components/monthly/MonthlyTable.vue'
import { generatedAtLabel, monthLabel } from '../components/monthly/monthly-format'
import SubjectPerformance from '../components/monthly/SubjectPerformance.vue'

const TITLE = 'Laporan Bulanan'

const crumbs = [{ label: 'Dashboard Sekolah', to: '/admin-sekolah' }, { label: TITLE }]

const route = useRoute()
const pageMeta = usePageMeta()

const bulan = computed(() => {
  const v = route.query.bulan
  return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null
})

const { data, error, loading, reload } = useApi(
  (signal) => fetchMonthlyReport({ bulan: bulan.value, signal }),
  [bulan],
)

/**
 * SW7-04 (DV-M27-25): the real API leaves a month out of the series (and hides its accuracy) when fewer than 5
 * pupils answered in it, so a month with answers can come with no row. Only then (http mode) the empty state names
 * the real reason instead of "Tiada aktiviti direkodkan".
 */
const cohortHidden = computed(
  () =>
    isHttpMode() &&
    (data.value?.cards.answers ?? 0) > 0 &&
    data.value?.cards.accuracy === null &&
    data.value.months.length === 0,
)

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

watch(
  data,
  (d) => {
    if (d) pageMeta.setHeader({ title: TITLE, subtitle: d.school.name })
  },
  { immediate: true },
)

/** FR-AS-50-3: a month without answers still shows every section; the note says why they are empty. */
const hasAnswers = computed(() => (data.value?.cards.answers ?? 0) > 0)

/** "Laporan Bulanan — {Bulan} {tahun}" (FR-AS-50-4). */
const printTitle = computed(() => (data.value ? `Laporan Bulanan — ${data.value.label}` : 'Laporan Bulanan'))

/** "Trend Harian": one bar per day, the label printed every 5th day (FR-AS-50-5). */
const dailyLabels = computed(() => (data.value?.daily ?? []).map((d) => String(d.day)))
const dailySeries = computed(() => [{ label: 'Soalan dijawab', data: (data.value?.daily ?? []).map((d) => d.answers) }])

/** "Trend Penggunaan Bulanan {tahun}": 12 bars Jan to Dis, the chosen month highlighted. */
const yearLabels = computed(() => (data.value?.yearly.months ?? []).map((m) => m.label))
const yearSeries = computed(() => [{ label: 'Sesi', data: (data.value?.yearly.months ?? []).map((m) => m.sessions) }])
const yearHighlight = computed(() => (data.value?.yearly.months ?? []).findIndex((m) => m.month === data.value?.month))

let savedTitle: string | null = null
function beforePrint() {
  // Idempotent: a second event (or a second listener) must not save the print title as the original.
  if (savedTitle === null && document.title !== printTitle.value) savedTitle = document.title
  document.title = printTitle.value
}
function afterPrint() {
  if (savedTitle !== null) document.title = savedTitle
  savedTitle = null
}
onMounted(() => {
  window.addEventListener('beforeprint', beforePrint)
  window.addEventListener('afterprint', afterPrint)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', beforePrint)
  window.removeEventListener('afterprint', afterPrint)
})

function print() {
  window.print()
}
</script>

<template>
  <DsPage data-testid="lb-page">
    <template #breadcrumb>
      <DsBreadcrumb v-if="data" :items="crumbs" data-testid="lb-breadcrumb" />
    </template>
    <div v-if="data" class="flex min-w-0 flex-col gap-4 md:gap-6" data-ds="print-sheet" data-testid="lb-sheet">
      <h1 class="hidden text-title text-highlighted print:block" data-testid="lb-print-title">
        {{ printTitle }}
      </h1>

      <div
        class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1"
        data-testid="lb-month-nav"
      >
        <h2 class="text-title text-highlighted" data-testid="lb-heading">
          Laporan {{ data.label }}
        </h2>
        <div class="flex flex-wrap items-center gap-x-4 print:hidden">
          <UButton
            :to="{ query: { bulan: data.prev } }"
            color="neutral"
            variant="ghost"
            size="lg"
            :label="`← ${monthLabel(data.prev)}`"
            data-testid="lb-prev"
          />
          <UButton
            v-if="data.next"
            :to="{ query: { bulan: data.next } }"
            color="neutral"
            variant="ghost"
            size="lg"
            :label="`${monthLabel(data.next)} →`"
            data-testid="lb-next"
          />
        </div>
      </div>

      <MonthlyCards :cards="data.cards" :label="data.label" />

      <p v-if="!hasAnswers" class="text-body text-muted" data-testid="lb-empty-note">
        Tiada data untuk bulan ini.
      </p>

      <DsPanel data-testid="lb-daily">
        <DsChart
          type="bar"
          title="Trend Harian"
          table-label="Trend harian"
          :labels="dailyLabels"
          :series="dailySeries"
          :tick-every="5"
          data-testid="lb-daily-chart"
        />
      </DsPanel>

      <DsPanel data-testid="lb-yearly">
        <DsChart
          type="bar"
          :title="`Trend Penggunaan Bulanan ${data.yearly.year}`"
          table-label="Trend penggunaan bulanan"
          :labels="yearLabels"
          :series="yearSeries"
          :highlight-index="yearHighlight < 0 ? undefined : yearHighlight"
          data-testid="lb-yearly-chart"
        />
      </DsPanel>

      <MonthlyTable :months="data.months" :total="data.total" :cohort-hidden="cohortHidden" />
      <SubjectPerformance :subjects="data.subjects" />

      <div
        class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="lb-footer"
      >
        <p class="text-caption text-muted" data-testid="lb-generated">
          Laporan dijana: {{ generatedAtLabel(data.generatedAt) }} · PrestasiPlus
        </p>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-printer"
          label="Cetak / PDF"
          class="print:hidden"
          data-testid="lb-print"
          @click="print"
        />
      </div>
    </div>
    <DsLoadError
      v-else-if="error && !refused"
      testid="lb-error"
      @retry="reload"
    />
    <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="lb-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
