<script setup lang="ts">
/**
 * S2 `/admin/questions/create` "Tambah Soalan Baru" (M04-T4; FR-M04-17..29, FN-M04-1.2.x). Back link,
 * h1 and subtitle, then the shared form. A load failure of the Subjek / Tahap lists is the red box with
 * "Cuba Semula" (SRS §8.2). Save posts #3; success queues the API `status` flash (UNVERIFIED COPY) and
 * opens S1; a 422 keeps the input and shows each message under its field.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsLoadError, DsPage } from '@/ds'

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
  <DsPage
    subtitle="Isi maklumat di bawah untuk menambah soalan baharu"
    data-testid="question-create-page"
  >
    <template #breadcrumb>
      <DsBackLink :to="QUESTIONS_LIST_PATH" data-testid="question-back" />
    </template>
    <DsLoadError
      v-if="loadError"
      :message="LOAD_ERROR"
      testid="question-form-error"
      retry-testid="question-form-retry"
      @retry="retry"
    />

    <div v-else-if="!ready" class="flex flex-col gap-4" data-testid="question-form-skeleton">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-48 w-full" />
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
  </DsPage>
</template>
