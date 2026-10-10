<script setup lang="ts">
/**
 * S4 `/amaran/sekolah` "Amaran Awal — Sekolah" (SRS M27 Part B v1.8 FR-M27-74…80, 44; roles-matrix row L54): the
 * M27 alias of M18 S22 for the school admin. The school comes from the session (the route takes no id, so no
 * foreign school can be asked for); `?tingkatan=T4|T5` filters. One read call, M18 #21; "Muat Turun CSV" calls
 * M18 #30. Top to bottom: level pills, four tiles, the distribution card, the buttons, the subject card (only
 * with data) and the risk list. No breadcrumb (DV-M27-22).
 *
 * States: loading shows the spinner; a 403 (or a session without a school) renders the global 403 page in
 * place; any other failure shows the server's own message. While another level loads, the old figures stay.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi, useFlash, useSession } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { saveBlob } from '@/lib/save-blob'

import { downloadSchoolRiskCsv, fetchSchoolRisk } from '../api/amaran'
import AmaranActions from '../components/amaran/AmaranActions.vue'
import AmaranDistribution from '../components/amaran/AmaranDistribution.vue'
import AmaranLevelPills from '../components/amaran/AmaranLevelPills.vue'
import AmaranPupilTable from '../components/amaran/AmaranPupilTable.vue'
import AmaranSubjectCard from '../components/amaran/AmaranSubjectCard.vue'
import AmaranTiles from '../components/amaran/AmaranTiles.vue'
import { normaliseLevel, TITLE } from '../components/amaran/amaran-format'
import { errorLines } from '../components/users/users-format'

const route = useRoute()
const pageMeta = usePageMeta()
const flash = useFlash()
const { user } = useSession()

const schoolId = computed(() => user.value?.schoolId ?? null)
const level = computed(() => normaliseLevel(route.query.tingkatan))

const { data, error, loading } = useApi(
  async (signal) => {
    if (schoolId.value === null) return null
    return fetchSchoolRisk(schoolId.value, { tingkatan: level.value, signal })
  },
  [schoolId, level],
)

const refused = computed(
  () => schoolId.value === null || (isApiError(error.value) && error.value.status === 403),
)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

// FR-M27-44: sub-line = the school name (+ " — Tingkatan {n}" with a level).
watch(
  data,
  (d) => {
    if (d) pageMeta.setHeader({ title: TITLE, subtitle: `${d.school.name}${d.levelSuffix}` })
  },
  { immediate: true },
)

const downloading = ref(false)
async function download(): Promise<void> {
  if (downloading.value || schoolId.value === null) return
  downloading.value = true
  try {
    const file = await downloadSchoolRiskCsv(schoolId.value)
    saveBlob(file.blob, file.filename ?? `amaran-sekolah-${String(schoolId.value)}.csv`)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="am-page" :data-level="data?.levelFilter ?? 'all'">
    <template v-if="data && schoolId !== null">
      <AmaranLevelPills :active="level" />
      <AmaranTiles :tally="data.tally" />
      <AmaranDistribution :tally="data.tally" />
      <AmaranActions :school-id="schoolId" :downloading="downloading" @download="download" />
      <AmaranSubjectCard v-if="data.weakness.length > 0" :rows="data.weakness" />
      <AmaranPupilTable :rows="data.pupils" />
    </template>
    <AlertBox v-else-if="error && !refused" :messages="error.message" data-testid="am-error" />
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="am-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
