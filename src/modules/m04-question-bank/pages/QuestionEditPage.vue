<script setup lang="ts">
/**
 * S4 `/admin/questions/:id/edit` "Edit Soalan" (M04-T4; FR-M04-48..52, FN-M04-1.7.x, DV-M04-05/06/15).
 * Back link (to S3), h1 "Kemaskini maklumat soalan #{id}" and the shared form pre-filled from #4. An
 * unknown id is the standard 404 page; another load failure is the red box with "Cuba Semula". Save
 * sends #5 (the type never changes) and opens S3 with the API `status` flash (UNVERIFIED COPY).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { fetchQuestion, updateQuestion, type QuestionInputBody } from '../api/questions'
import ErrorBox from '../components/ErrorBox.vue'
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
  <DsPage data-testid="question-edit-page">
    <div class="flex min-w-0 items-center gap-3">
      <UButton
        :to="questionDetailPath(id)"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left"
        aria-label="Kembali"
        class="size-11 shrink-0 justify-center"
        data-testid="question-back"
      />
      <p class="min-w-0 text-body text-muted">Kemaskini maklumat soalan #{{ id }}</p>
    </div>

    <div v-if="loadError" class="flex flex-col gap-3" data-testid="question-form-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" class="min-h-11" data-testid="question-form-retry" @click="retry">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <div v-else-if="!ready" class="flex flex-col gap-4" data-testid="question-form-skeleton">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-48 w-full" />
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
  </DsPage>
</template>
