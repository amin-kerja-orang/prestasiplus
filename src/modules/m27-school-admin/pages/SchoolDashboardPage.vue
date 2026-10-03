<script setup lang="ts">
/**
 * S0 `/admin-sekolah` "Dashboard Sekolah" (SRS M27 v1.3 FR-M27-01…37; roles-matrix row L07). User shell, one
 * read-only call (`GET /api/admin-sekolah/dashboard`, scope from the session). Top to bottom: Perutusan
 * Terkini, breadcrumb, red school banner, four summary cards, "Ringkasan Prestasi".
 *
 * States: loading shows the spinner only; a 403 (a school admin without a school, FR-M27-08) renders the
 * global 403 page in place; any other failure shows the server's own error message (no M27 copy, FR-M27-28;
 * there is no M01 global error page in the app yet).
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchSchoolDashboard } from '../api/dashboard'
import PerformanceSummary from '../components/dashboard/PerformanceSummary.vue'
import PerutusanCard from '../components/dashboard/PerutusanCard.vue'
import SchoolBanner from '../components/dashboard/SchoolBanner.vue'
import SummaryCards from '../components/dashboard/SummaryCards.vue'

const pageMeta = usePageMeta()
const { data, error, loading } = useApi((signal) => fetchSchoolDashboard({ signal }))

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

// FR-M27-03: header title "Dashboard Sekolah", subtitle = the school name.
watch(
  data,
  (d) => {
    if (d) pageMeta.setHeader({ title: 'Dashboard Sekolah', subtitle: d.school.name })
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="sd-page">
    <template v-if="data">
      <PerutusanCard :rows="data.perutusan" />
      <SchoolBanner :school="data.school" :role-label="data.roleLabel" />
      <SummaryCards :cards="data.cards" />
      <PerformanceSummary :performance="data.performance" />
    </template>
    <AlertBox v-else-if="error && !refused" :messages="error.message" data-testid="sd-error" />
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="sd-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
