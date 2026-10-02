<script setup lang="ts">
/**
 * S2 `/admin/questions/create` "Tambah Soalan Baru" (M04-T4; FR-M04-17..29, FN-M04-1.2.x). Back link,
 * h1 and subtitle, then the shared form. A load failure of the Subjek / Tahap lists is the red box with
 * "Cuba Semula" (SRS §8.2). Save posts #3; success queues the API `status` flash (UNVERIFIED COPY) and
 * opens S1; a 422 keeps the input and shows each message under its field.
 */
import { ArrowLeft } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { createQuestion, type QuestionInputBody } from '../api/questions'
import QuestionForm from '../components/QuestionForm.vue'
import { formErrors, type FormErrors } from '../lib/question-form'
import { QUESTIONS_LIST_PATH } from '../lib/question-list'
import { LOAD_ERROR } from '../lib/ui-errors'

const router = useRouter()
const flash = useFlash()

const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))

const loadError = computed(() => subjects.error.value ?? levels.error.value)
const ready = computed(() => subjects.data.value !== null && levels.data.value !== null)

function retry(): void {
  void subjects.reload()
  void levels.reload()
}

const saving = ref(false)
const errors = ref<FormErrors>({ fields: {}, general: [] })

async function save(body: QuestionInputBody): Promise<void> {
  saving.value = true
  errors.value = { fields: {}, general: [] }
  try {
    const result = await createQuestion(body)
    flash.success(result.status)
    await router.push(QUESTIONS_LIST_PATH)
  } catch (err) {
    errors.value = formErrors(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="question-create-page">
    <div class="flex min-w-0 items-start gap-3">
      <RouterLink
        :to="QUESTIONS_LIST_PATH"
        class="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="question-back"
      >
        <ArrowLeft class="h-5 w-5" aria-hidden="true" />
      </RouterLink>
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-800 sm:text-2xl">✨ Tambah Soalan Baru</h1>
        <p class="text-sm text-slate-500">Isi maklumat di bawah untuk menambah soalan baharu</p>
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
      mode="create"
      :subjects="subjects.data.value?.data ?? []"
      :levels="levels.data.value?.data ?? []"
      :saving="saving"
      :errors="errors"
      :cancel-to="QUESTIONS_LIST_PATH"
      @submit="save"
    />
  </div>
</template>
