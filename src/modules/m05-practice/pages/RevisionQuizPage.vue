<script setup lang="ts">
/**
 * S7 `/practice/revision/:code` "Ulang Kaji — {subject}" (M05-T5; FR-M05-74…89, 138; BR-14).
 *
 * The page is the guard of S7 (#10): an unknown code → the global 404 page; no queued question for
 * the subject → S6 with the one-time info flash (FR-M05-72); otherwise it mounts `QuizRunner` with
 * the S7 labels, revision chips, the "corrected" line and `reload` retry. The runner starts the
 * session (mode `revision`, 20 questions), shows the loading state, handles a start failure
 * (`alert` + back to S6) and posts the report with `source: 'revision'`. The spinner takes the
 * subject colour (FR-M05-75).
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'

import { fetchRevisionSubject } from '../api/practice'
import type { StartSessionRequest, StartSessionResponse } from '../api/types'
import QuizRunner from '../components/quiz/QuizRunner.vue'
import { REVISION_LABELS } from '../components/quiz/quiz-labels'
import { setRevisionFlash } from '../components/revision/revision-flash'
import { DsLoadError } from '@/ds'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const REVISION_COUNT = 20

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const { data, error, reload } = useApi(
  (signal) => fetchRevisionSubject(code.value, { signal }),
  code,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

watch(
  data,
  (d) => {
    if (!d) return
    if (d.count === 0) {
      setRevisionFlash()
      void router.replace('/practice/revision')
      return
    }
    pageMeta.setTitle(`Ulang Kaji — ${d.subject.name}`)
  },
  { immediate: true },
)

const ready = computed(() => (data.value && data.value.count > 0 ? data.value : null))
const start = computed<StartSessionRequest>(() => ({
  mode: 'revision',
  subjectCode: code.value,
  count: REVISION_COUNT,
}))
const headerTitle = (s: StartSessionResponse): string =>
  `Ulang Kaji — ${s.subject?.name ?? ready.value?.subject.name ?? ''}`
</script>

<template>
  <QuizRunner
    v-if="ready"
    :key="code"
    :start="start"
    :header-title="headerTitle"
    :labels="REVISION_LABELS"
    revision-chips
    corrected-line
    back-url="/practice/revision"
    retry="reload"
    :report="{ source: 'revision', failureText: 'Gagal menghantar laporan. Sila cuba lagi.' }"
    :accent-color="ready.subject.color"
  />
  <DsLoadError
    v-else-if="error && !notFound"
    :message="LOAD_ERROR"
    retry-testid="revision-quiz-retry"
    testid="revision-quiz-error"
    @retry="reload()"
  />
</template>
