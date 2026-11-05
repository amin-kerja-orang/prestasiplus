<script setup lang="ts">
/**
 * S24 `/guru/soalan/:id/edit` "Edit Soalan" (44-F1 "the same form edits"; FR-GUR-44-6; AC-GUR-44-6): the create
 * form with every saved field preloaded (Tingkatan, Subjek, Bab, SP, TP, Aras, the saved Kesukaran, the four options,
 * the saved correct answer, the explanation). "Simpan Perubahan" sends the full body of `PUT /api/guru/questions/:id`
 * (the same body and rules as the create; a rejected item returns to "Menunggu Semakan") and goes to S23.
 * An item that is not own or unknown is the standard 404; a 409 (no longer editable) shows its message.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsLoadError, DsPage } from '@/ds'

import { fetchContributedQuestion, updateContributedQuestion } from '../api/guru'
import type { CreateQuestionRequest } from '../api/types'
import { COPY } from '../components/soalan/lib'
import QuestionForm from '../components/soalan/QuestionForm.vue'
import { moduleMessage } from '../lib/generic-server-text'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()

const { data, error, reload } = useApi(
  (signal) => fetchContributedQuestion(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})

const saving = ref(false)
const general = ref<string[]>([])
const fields = ref<Record<string, string>>({})
const back = computed(() => `/guru/soalan/${String(props.id)}`)

async function save(body: CreateQuestionRequest): Promise<void> {
  if (saving.value) return
  saving.value = true
  general.value = []
  fields.value = {}
  try {
    await updateContributedQuestion(props.id, body)
    flash.success(COPY.updated)
    await router.push(back.value)
  } catch (err) {
    if (isApiError(err) && err.fields) {
      fields.value = err.fields
      general.value = Object.values(err.fields)
    } else {
      general.value = [moduleMessage(err) ?? COPY.saveFailed]
    }
    window.scrollTo?.({ top: 0 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="soalan-edit-page">
    <DsLoadError
      v-if="error && !notFound"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="edit-error"
      @retry="reload"
    />
    <div v-else-if="!data && !notFound" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <template v-else-if="data">
      <DsBackLink :to="back" data-testid="edit-back" />
      <QuestionForm
        :key="data.id"
        :initial="data"
        :saving="saving"
        :general="general"
        :fields="fields"
        submit-label="Simpan Perubahan"
        :cancel-to="back"
        @submit="save"
      />
    </template>
  </DsPage>
</template>
