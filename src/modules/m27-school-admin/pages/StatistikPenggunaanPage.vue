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

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchSchoolUsage } from '../api/school-admin'
import UsageBreadcrumb from '../components/usage/UsageBreadcrumb.vue'
import UsageModeCard from '../components/usage/UsageModeCard.vue'
import UsagePeriodPills from '../components/usage/UsagePeriodPills.vue'
import UsageTiles from '../components/usage/UsageTiles.vue'
import { normalisePeriod } from '../components/usage/usage-format'

const TITLE = 'Statistik Penggunaan'

const route = useRoute()
const pageMeta = usePageMeta()
const period = computed(() => normalisePeriod(route.query.period))

const { data, error, loading } = useApi(
  (signal) => fetchSchoolUsage({ period: period.value, signal }),
  [period],
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
  <div class="min-w-0 space-y-4" data-testid="su-page" :data-period="data?.period">
    <template v-if="data">
      <UsageBreadcrumb :title="TITLE" />
      <UsagePeriodPills :active="period" />
      <UsageTiles :tiles="data.tiles" />
      <UsageModeCard :modes="data.modes" :period="data.period" :label="data.label" />
      <p
        v-if="data.tiles.accuracy === null"
        class="text-xs text-slate-500"
        data-testid="su-footnote"
      >
        Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini.
      </p>
    </template>
    <AlertBox v-else-if="error && !refused" :messages="error.message" data-testid="su-error" />
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="su-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
