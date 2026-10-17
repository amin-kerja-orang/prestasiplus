<script setup lang="ts">
/**
 * S5 `/admin-sekolah/laporan-bulanan` "Laporan Bulanan" (SRS M27 Part B v1.8 FR-M27-81…87, 44; PROPOSED screen,
 * D26). User shell; one read-only call (`GET /api/admin-sekolah/laporan-bulanan?bulan=YYYY-MM`, school from
 * the session; an invalid or future month gives the current month). Top to bottom: breadcrumb, heading with
 * the month links, four cards, "Statistik Bulanan", "Prestasi Mengikut Subjek", footer and "Cetak / PDF".
 * A month without answers shows the four cards and the footer only (FR-M27-83: no section below the cards).
 *
 * States: loading shows the spinner only; a 403 renders the global 403 page in place; any other failure
 * shows the server's own message.
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsPage } from '@/ds'

import { fetchMonthlyReport } from '../api/school-admin'
import ReportCrumb from '../components/shared/ReportCrumb.vue'
import MonthlyCards from '../components/monthly/MonthlyCards.vue'
import MonthlyTable from '../components/monthly/MonthlyTable.vue'
import { generatedAtLabel, monthLabel } from '../components/monthly/monthly-format'
import SubjectPerformance from '../components/monthly/SubjectPerformance.vue'

const TITLE = 'Laporan Bulanan'

const route = useRoute()
const pageMeta = usePageMeta()

const bulan = computed(() => {
  const v = route.query.bulan
  return typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null
})

const { data, error, loading } = useApi(
  (signal) => fetchMonthlyReport({ bulan: bulan.value, signal }),
  [bulan],
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

/** FR-M27-83: a month without answers shows the cards only. */
const hasAnswers = computed(() => (data.value?.cards.answers ?? 0) > 0)

function print() {
  window.print()
}
</script>

<template>
  <DsPage data-testid="lb-page">
    <template v-if="data">
      <ReportCrumb prefix="lb" back-label="← Dashboard Sekolah" back-to="/admin-sekolah" :title="TITLE" />

      <div
        class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1"
        data-testid="lb-month-nav"
      >
        <h2 class="text-title text-highlighted" data-testid="lb-heading">
          Laporan {{ data.label }}
        </h2>
        <div class="flex flex-wrap items-center gap-x-4">
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

      <MonthlyCards :cards="data.cards" />

      <template v-if="hasAnswers">
        <MonthlyTable :months="data.months" :total="data.total" />
        <SubjectPerformance v-if="data.subjects.rows.length > 0" :subjects="data.subjects" />
      </template>

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
    </template>
    <UAlert
      v-else-if="error && !refused"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      :description="error.message"
      role="alert"
      data-testid="lb-error"
    />
    <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="lb-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
