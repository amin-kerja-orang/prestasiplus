<script setup lang="ts">
/**
 * V2 `/cikgu/essay/:id` essay marking view (PROPOSED, FR-M13-56, 48; URS FN-M13-4.3.2). Own records
 * only: a foreign or unknown id is the standard 404. The comment is text with its line breaks kept.
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'

import { fetchEssay } from '../api'
import { ESSAY_COPY as C } from '../components/teacher/copy'
import { orDash, rubricShort } from '../components/teacher/lib'
import PageState from '../components/teacher/PageState.vue'

const props = defineProps<{ id: number }>()

const { data, error, reload } = useApi(
  (signal) => fetchEssay(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})
</script>

<template>
  <div class="mx-auto min-w-0 max-w-3xl space-y-4" data-testid="essay-view-page">
    <RouterLink
      to="/cikgu/essay"
      class="inline-flex min-h-11 items-center text-sm font-medium text-purple-600 hover:underline"
      data-testid="essay-back"
      >{{ C.back }}</RouterLink
    >
    <PageState
      :loaded="data !== null || notFound"
      :error="error !== null && !notFound"
      :message="C.loadFailed"
      :retry-label="C.retry"
      @retry="reload"
    >
      <section v-if="data" class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h1 class="font-heading text-2xl font-bold text-slate-800">{{ C.title }}</h1>
        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {{ C.viewLabels.student }}
            </dt>
            <dd class="text-slate-800" data-testid="essay-view-student">
              {{ orDash(data.studentName) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {{ C.viewLabels.subject }}
            </dt>
            <dd class="text-slate-800" data-testid="essay-view-subject">
              {{ orDash(data.subjectName) }} / {{ rubricShort(data.rubricKey) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {{ C.viewLabels.tajuk }}
            </dt>
            <dd class="break-words text-slate-800" data-testid="essay-view-tajuk">
              {{ orDash(data.essayTitle) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {{ C.viewLabels.marks }}
            </dt>
            <dd class="text-slate-800" data-testid="essay-view-marks">
              {{ data.marks }}/{{ data.maxMarks }}
            </dd>
          </div>
        </dl>
        <div
          class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm break-words whitespace-pre-line text-slate-700"
          data-testid="essay-view-comment"
        >
          {{ data.comment }}
        </div>
      </section>
    </PageState>
  </div>
</template>
