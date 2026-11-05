<script setup lang="ts">
/**
 * `/guru/soalan-guru/:id/sunting` "Edit Soalan & Rujukan" (FR-GUR-44a-1): the create form with every saved field
 * preloaded from `GET /api/guru/personal-questions/:id`; "Simpan Soalan" sends the full body of `PUT` (the same body and
 * rules as the create) and returns to the list. Another teacher's id and an unknown id are the standard 404.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsLoadError, DsPage, DsStack } from '@/ds'

import { fetchPersonalQuestion, updatePersonalQuestion } from '../api/personal-questions'
import type { PersonalQuestionRequest } from '../api/personal-questions-types'
import { RUJUKAN_COPY } from '../components/soalan-rujukan/copy'
import RujukanForm from '../components/soalan-rujukan/RujukanForm.vue'
import { COPY } from '../components/soalan/lib'
import { moduleMessage } from '../lib/generic-server-text'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()

const { data, error, reload } = useApi(
  (signal) => fetchPersonalQuestion(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})

const saving = ref(false)
const general = ref<string[]>([])
const fields = ref<Record<string, string>>({})

async function save(body: PersonalQuestionRequest): Promise<void> {
  if (saving.value) return
  saving.value = true
  general.value = []
  fields.value = {}
  try {
    await updatePersonalQuestion(props.id, body)
    flash.success(RUJUKAN_COPY.saved)
    await router.push('/guru/soalan-guru')
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
  <DsPage class="max-w-4xl" data-testid="rujukan-edit-page">
    <DsLoadError
      v-if="error && !notFound"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="edit-error"
      @retry="reload"
    />
    <DsStack v-else-if="!data && !notFound" gap="sm" aria-busy="true">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-48 w-full" />
    </DsStack>

    <template v-else-if="data">
      <DsBackLink to="/guru/soalan-guru" :label="RUJUKAN_COPY.backToList" data-testid="edit-back" />
      <RujukanForm
        :key="data.id"
        :initial="data"
        :saving="saving"
        :general="general"
        :fields="fields"
        @submit="save"
      />
    </template>
  </DsPage>
</template>
