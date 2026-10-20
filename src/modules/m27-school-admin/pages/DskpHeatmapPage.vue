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
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBreadcrumb, DsLoadError, DsPage } from '@/ds'

import { fetchSchoolDskpHeatmap } from '../api/school-admin'
import HeatmapFilters from '../components/heatmap/HeatmapFilters.vue'
import HeatmapMap from '../components/heatmap/HeatmapMap.vue'

const TITLE = 'DSKP Heatmap'

const crumbs = [{ label: 'Dashboard Sekolah', to: '/admin-sekolah' }, { label: TITLE }]

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

const { data, error, loading, reload } = useApi(
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
    !data.value.subjects.some((s) => String(s.id) === String(requested.value)),
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
  <DsPage data-testid="dh-page">
    <template #breadcrumb>
      <DsBreadcrumb v-if="data" :items="crumbs" data-testid="dh-breadcrumb" />
    </template>
    <template v-if="data">
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
    <DsLoadError
      v-else-if="error && !refused"
      :message="error.message"
      testid="dh-error"
      @retry="reload"
    />
    <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="dh-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
