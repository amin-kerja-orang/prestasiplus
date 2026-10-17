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
import { Printer } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchMonthlyReport } from '../api/school-admin'
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

const LINK =
  'inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-blue-700 hover:underline'

function print() {
  window.print()
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="lb-page">
    <template v-if="data">
      <nav class="flex min-w-0 flex-wrap items-center gap-x-2 text-sm" data-testid="lb-breadcrumb">
        <RouterLink
          to="/admin-sekolah"
          class="inline-flex min-h-11 items-center text-slate-500 hover:text-slate-700"
          data-testid="lb-crumb-back"
          >← Dashboard Sekolah</RouterLink
        >
        <span class="text-slate-300">/</span>
        <span class="font-bold text-slate-700" data-testid="lb-crumb-current">{{ TITLE }}</span>
      </nav>

      <div
        class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1"
        data-testid="lb-month-nav"
      >
        <h2 class="text-xl font-bold text-slate-800" data-testid="lb-heading">
          Laporan {{ data.label }}
        </h2>
        <div class="flex flex-wrap items-center gap-x-4">
          <RouterLink :to="{ query: { bulan: data.prev } }" :class="LINK" data-testid="lb-prev"
            >← {{ monthLabel(data.prev) }}</RouterLink
          >
          <RouterLink
            v-if="data.next"
            :to="{ query: { bulan: data.next } }"
            :class="LINK"
            data-testid="lb-next"
            >{{ monthLabel(data.next) }} →</RouterLink
          >
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
        <p class="text-xs text-slate-500" data-testid="lb-generated">
          Laporan dijana: {{ generatedAtLabel(data.generatedAt) }} · PrestasiPlus
        </p>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 print:hidden"
          data-testid="lb-print"
          @click="print"
        >
          <Printer class="h-4 w-4" />Cetak / PDF
        </button>
      </div>
    </template>
    <AlertBox v-else-if="error && !refused" :messages="error.message" data-testid="lb-error" />
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="lb-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
