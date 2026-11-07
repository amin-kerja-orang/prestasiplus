<script setup lang="ts">
/**
 * `/guru/soalan-berstruktur/:id/edit` (R1-GUR-44b, S6-T17): the same form, preloaded from the own submission
 * (API-GUR-26 detail `form`), sending the full body with `PUT /api/guru/intake/structured/:id`. A submission
 * that is not the viewer's own, or an approved question, is the standard 404. A 409 (the admin already accepted
 * it) shows the server's message. "Padam" asks first and deletes the submission.
 */
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsCluster, DsLoadError, DsPage, DsStack } from '@/ds'
import { useConfirm } from '@/ds/useConfirm'

import {
  deleteStructuredSubmission,
  fetchStructuredSubmission,
  updateStructuredSubmission,
} from '../api/structured-submit'
import { COPY } from '../components/soalan/lib'
import StructuredSubmitForm from '../components/soalan-berstruktur/StructuredSubmitForm.vue'
import { moduleMessage } from '../lib/generic-server-text'
import {
  STRUCTURED_COPY,
  STRUCTURED_EXTRA_COPY,
  valuesFromSaved,
  type StructuredFormValues,
} from '../lib/structured-form'
import { FORM_MESSAGE_KEY, useStructuredSave } from '../lib/use-structured-save'

const props = defineProps<{ id: string }>()

const LIST = '/guru/soalan-berstruktur'
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()
const { saving, fields, save } = useStructuredSave()

const { data, error, reload } = useApi(
  (signal) => fetchStructuredSubmission(props.id, { signal }),
  () => props.id,
)

/** Not own / unknown is a 404 from the API; an approved question has no `form` and is not editable here. */
const notFound = computed(
  () =>
    (isApiError(error.value) && error.value.status === 404) ||
    (data.value !== null && (data.value.source !== 'submission' || data.value.form === null)),
)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const initial = computed<StructuredFormValues | null>(() => {
  const d = data.value
  return d && d.form ? valuesFromSaved({ ...d, form: d.form }) : null
})

async function onSubmit(values: StructuredFormValues, image: File | null): Promise<void> {
  const saved = data.value?.form?.stimulusImageId ?? null
  if (await save(values, image, saved, (body) => updateStructuredSubmission(props.id, body))) {
    flash.success(STRUCTURED_COPY.submitted)
    await router.push(LIST)
  }
}

async function remove(): Promise<void> {
  const ok = await confirm({
    message: 'Padam soalan ini? Tindakan ini tidak boleh dibatalkan.',
    tone: 'error',
  })
  if (!ok) return
  try {
    await deleteStructuredSubmission(props.id)
    flash.success(COPY.deleted)
    await router.push(LIST)
  } catch (err) {
    fields.value = { [FORM_MESSAGE_KEY]: moduleMessage(err) ?? STRUCTURED_EXTRA_COPY.saveFailed }
  }
}
</script>

<template>
  <DsPage data-testid="berstruktur-edit-page">
    <DsBackLink :to="LIST" label="Kembali ke Senarai" data-testid="back-link" />
    <DsLoadError
      v-if="error && !notFound"
      :message="STRUCTURED_EXTRA_COPY.loadFailed"
      :retry-label="STRUCTURED_EXTRA_COPY.retry"
      testid="edit-error"
      @retry="reload"
    />
    <DsStack v-else-if="!data && !notFound" gap="sm" aria-busy="true">
      <USkeleton />
      <USkeleton />
    </DsStack>
    <template v-else-if="initial && data">
      <StructuredSubmitForm
        :saving="saving"
        :fields="fields"
        :initial="initial"
        :has-saved-image="!!data.form?.stimulusImageId"
        @submit="onSubmit"
        @cancel="router.push(LIST)"
      />
      <DsCluster>
        <UButton
          type="button"
          color="error"
          variant="soft"
          icon="i-ph-trash"
          size="xl"
          data-testid="berstruktur-delete"
          @click="remove"
          >Padam</UButton
        >
      </DsCluster>
    </template>
  </DsPage>
</template>
