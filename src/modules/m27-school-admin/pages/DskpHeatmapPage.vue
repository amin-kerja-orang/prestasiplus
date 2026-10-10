<script setup lang="ts">
/**
 * S2 `/admin-sekolah/dskp-heatmap` "DSKP Heatmap" (SRS M27 Part B v1.8 FR-M27-58…65, 44; PROPOSED screen,
 * D26). User shell; one read-only call (`GET /api/admin-sekolah/dskp-heatmap?subjectId=&tingkatan=`, school
 * from the session). Top to bottom: breadcrumb, filter card, the DSKP map card.
 *
 * States: loading shows the spinner only; a 403 renders the global 403 page in place; any other failure
 * shows the server's own message. A level with no subject, or a `subjectId` that is not a subject with SP at
 * the level, shows "Tiada Standard Pembelajaran untuk subjek dan tingkatan ini." (FR-M27-64).
 */
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchSchoolDskpHeatmap } from '../api/school-admin'
import HeatmapFilters from '../components/heatmap/HeatmapFilters.vue'
import HeatmapMap from '../components/heatmap/HeatmapMap.vue'

const TITLE = 'DSKP Heatmap'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const first = (v: unknown): string | null =>
  typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null

const subjectParam = computed(() => first(route.query.subjectId))
const levelParam = computed(() => first(route.query.tingkatan))
/** The requested subject id, when the query holds digits only. */
const requested = computed(() =>
  subjectParam.value !== null && /^\d+$/.test(subjectParam.value)
    ? Number(subjectParam.value)
    : null,
)

const { data, error, loading } = useApi(
  (signal) =>
    fetchSchoolDskpHeatmap({
      subjectId: requested.value,
      tingkatan: levelParam.value,
      signal,
    }),
  [subjectParam, levelParam],
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

const unknownSubject = computed(
  () =>
    data.value !== null &&
    requested.value !== null &&
    !data.value.subjects.some((s) => s.id === requested.value),
)
const selectValue = computed<number | ''>(() => {
  if (!data.value || unknownSubject.value) return ''
  return data.value.subject?.id ?? ''
})
const empty = computed(
  () =>
    data.value !== null &&
    (data.value.subject === null || data.value.bidang.length === 0 || unknownSubject.value),
)

function pickSubject(id: number) {
  void router.push({
    query: {
      subjectId: String(id),
      tingkatan: (data.value?.level.code ?? 't4').toUpperCase(),
    },
  })
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="dh-page">
    <template v-if="data">
      <nav class="flex min-w-0 flex-wrap items-center gap-x-2 text-sm" data-testid="dh-breadcrumb">
        <RouterLink
          to="/admin-sekolah"
          class="inline-flex min-h-11 items-center text-slate-500 hover:text-slate-700"
          data-testid="dh-crumb-back"
          >← Dashboard Sekolah</RouterLink
        >
        <span class="text-slate-300">/</span>
        <span class="font-bold text-slate-700" data-testid="dh-crumb-current">{{ TITLE }}</span>
      </nav>
      <HeatmapFilters
        :subjects="data.subjects"
        :subject-id="selectValue"
        :level="data.level.code"
        @subject="pickSubject"
      />
      <HeatmapMap
        :caption="empty ? null : data.caption"
        :bidang="empty ? [] : data.bidang"
        :empty="empty"
      />
    </template>
    <AlertBox v-else-if="error && !refused" :messages="error.message" data-testid="dh-error" />
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="dh-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
