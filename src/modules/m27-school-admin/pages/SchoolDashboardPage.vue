<script setup lang="ts">
/**
 * S0 `/admin-sekolah` "Dashboard Sekolah" (SRS M27 v1.3 FR-M27-01…37; roles-matrix row L07). User shell, one
 * read-only call (`GET /api/admin-sekolah/dashboard`, scope from the session). Top to bottom: Perutusan
 * Terkini, the school banner (no breadcrumb on this landing page, FR-AS-2-4), four summary cards, the "Guru Menunggu" callout (only when above 0), "Ringkasan Prestasi".
 *
 * States: loading shows the spinner only; a 403 (a school admin without a school, FR-M27-08) renders the
 * global 403 page in place; any other failure shows the shared BM load-error line (SWE; the server text is English, FR-M27-28;
 * there is no M01 global error page in the app yet).
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsCallout, DsLoadError, DsPage } from '@/ds'

import { fetchSchoolDashboard } from '../api/dashboard'
import PerformanceSummary from '../components/dashboard/PerformanceSummary.vue'
import PerutusanCard from '../components/dashboard/PerutusanCard.vue'
import SchoolBanner from '../components/dashboard/SchoolBanner.vue'
import { count, PATHS } from '../components/dashboard/dashboard-format'
import SummaryCards from '../components/dashboard/SummaryCards.vue'

const pageMeta = usePageMeta()
const { data, error, loading, reload } = useApi((signal) => fetchSchoolDashboard({ signal }))

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
  <DsPage data-testid="sd-page">
    <template v-if="data">
      <PerutusanCard :rows="data.perutusan" />
      <SchoolBanner :school="data.school" :role-label="data.roleLabel" />
      <SummaryCards :cards="data.cards" />
      <DsCallout
        v-if="data.pendingTeachers > 0"
        tone="warning"
        title="Guru Menunggu"
        data-testid="sd-pending-teachers"
      >
        <RouterLink
          :to="PATHS.pendingTeachers"
          class="inline-flex min-h-11 items-center gap-2"
          data-testid="sd-pending-teachers-link"
        >
          <span>Guru Menunggu</span>
          <span class="tabular" data-testid="sd-pending-teachers-count">{{ count(data.pendingTeachers) }}</span>
        </RouterLink>
      </DsCallout>
      <PerformanceSummary :performance="data.performance" />
    </template>
    <DsLoadError v-else-if="error && !refused" testid="sd-error" @retry="reload" />
    <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="sd-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
