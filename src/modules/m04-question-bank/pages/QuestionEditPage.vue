<script setup lang="ts">
/**
 * S4 `/admin/questions/:id/edit` "Edit Soalan" (M04-T4; FR-M04-48..52, FN-M04-1.7.x, DV-M04-05/06/15).
 * Back link (to S3), h1 "Kemaskini maklumat soalan #{id}" and the shared form pre-filled from #4. An
 * unknown id is the standard 404 page; another load failure is the red box with "Cuba Semula". Save
 * sends #5 (the type never changes) and opens S3 with the API `status` flash (UNVERIFIED COPY).
 */
import { ArrowLeft } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { fetchQuestion, updateQuestion, type QuestionInputBody } from '../api/questions'
import QuestionForm from '../components/QuestionForm.vue'
import { formErrors, type FormErrors } from '../lib/question-form'
import { questionDetailPath } from '../lib/question-list'
import { LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()

const question = useApi(
  (signal) => fetchQuestion(props.id, { signal }),
  () => props.id,
)
const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))

const notFound = computed(
  () => isApiError(question.error.value) && question.error.value.status === 404,
)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const loadError = computed(
  () =>
    (notFound.value ? null : question.error.value) ?? subjects.error.value ?? levels.error.value,
)
const ready = computed(
  () => question.data.value !== null && subjects.data.value !== null && levels.data.value !== null,
)

function retry(): void {
  void question.reload()
  void subjects.reload()
  void levels.reload()
}

const saving = ref(false)
const errors = ref<FormErrors>({ fields: {}, general: [] })

async function save(body: QuestionInputBody): Promise<void> {
  saving.value = true
  errors.value = { fields: {}, general: [] }
  try {
    const result = await updateQuestion(props.id, body)
    flash.success(result.status)
    await router.push(questionDetailPath(props.id))
  } catch (err) {
    errors.value = formErrors(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="question-edit-page">
    <div class="flex min-w-0 items-start gap-3">
      <RouterLink
        :to="questionDetailPath(id)"
        class="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="question-back"
      >
        <ArrowLeft class="h-5 w-5" aria-hidden="true" />
      </RouterLink>
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-800 sm:text-2xl">✏️ Edit Soalan</h1>
        <p class="text-sm text-slate-500">Kemaskini maklumat soalan #{{ id }}</p>
      </div>
    </div>

    <div v-if="loadError" class="space-y-3" data-testid="question-form-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="question-form-retry"
        @click="retry"
      >
        Cuba Semula
      </button>
    </div>

    <div v-else-if="!ready" class="space-y-4" data-testid="question-form-skeleton">
      <div class="h-64 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="h-48 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <QuestionForm
      v-else
      :key="id"
      mode="edit"
      :initial="question.data.value"
      :subjects="subjects.data.value?.data ?? []"
      :levels="levels.data.value?.data ?? []"
      :saving="saving"
      :errors="errors"
      :cancel-to="questionDetailPath(id)"
      @submit="save"
    />
  </div>
</template>
