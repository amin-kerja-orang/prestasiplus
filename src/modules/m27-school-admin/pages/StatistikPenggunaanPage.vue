<script setup lang="ts">
/**
 * S1 `/admin-sekolah/statistik-penggunaan` "Statistik Penggunaan" (SRS M27 Part B FR-M27-44, 51…57; roles-matrix
 * row L51). User shell, one read-only call (`GET /api/admin-sekolah/usage?period=`, school from the session).
 * Top to bottom: breadcrumb, period pills, seven tiles, the card "Mengikut Mod Latihan" (or the empty card),
 * and the footnote while there is no accuracy. No export (FR-M27-56).
 *
 * States: loading shows the spinner only; a 403 renders the global 403 page in place; any other failure shows
 * the server's own message (no M27 copy, FR-M27-48). While another period loads, the previous figures stay.
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError, isHttpMode } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBreadcrumb, DsLoadError, DsPage } from '@/ds'

import { fetchSchoolUsage } from '../api/school-admin'
import UsageModeCard from '../components/usage/UsageModeCard.vue'
import UsagePeriodPills from '../components/usage/UsagePeriodPills.vue'
import UsageTiles from '../components/usage/UsageTiles.vue'
import { DASHBOARD_PATH, normalisePeriod } from '../components/usage/usage-format'

const TITLE = 'Statistik Penggunaan'
const EMPTY_FOOTNOTE =
  'Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini.'
const COHORT_FOOTNOTE = 'Disembunyikan kerana kurang daripada 5 pelajar aktif.'

const crumbs = [{ label: 'Dashboard Sekolah', to: DASHBOARD_PATH }, { label: TITLE }]

const route = useRoute()
const pageMeta = usePageMeta()
const period = computed(() => normalisePeriod(route.query.period))

const { data, error, loading, reload } = useApi(
  (signal) => fetchSchoolUsage({ period: period.value, signal }),
  [period],
)

/**
 * SW7-04 (DV-M27-25): the real API hides the accuracy of a group of fewer than 5 active pupils (k-cohort rule), so
 * "—" can come with answers on the tiles. Only then (http mode) the footnote names the real reason.
 */
const cohortHidden = computed(
  () =>
    isHttpMode() && data.value?.tiles.accuracy === null && (data.value?.tiles.answers ?? 0) > 0,
)

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

// FR-M27-44: header title, sub-line = the school name.
watch(
  data,
  (d) => {
    if (d) pageMeta.setHeader({ title: TITLE, subtitle: d.school.name })
  },
  { immediate: true },
)
</script>

<template>
  <DsPage data-testid="su-page" :data-period="data?.period">
    <template #breadcrumb>
      <DsBreadcrumb v-if="data" :items="crumbs" data-testid="su-breadcrumb" />
    </template>
    <template v-if="data">
      <UsagePeriodPills :active="period" />
      <UsageTiles :tiles="data.tiles" />
      <UsageModeCard :modes="data.modes" :period="data.period" :label="data.label" />
      <p
        v-if="data.tiles.accuracy === null"
        class="text-caption text-muted"
        data-testid="su-footnote"
      >
        {{ cohortHidden ? COHORT_FOOTNOTE : EMPTY_FOOTNOTE }}
      </p>
    </template>
    <DsLoadError
      v-else-if="error && !refused"
      testid="su-error"
      @retry="reload"
    />
    <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="su-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
