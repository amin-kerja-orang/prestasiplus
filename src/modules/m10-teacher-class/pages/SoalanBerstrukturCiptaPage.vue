<script setup lang="ts">
/**
 * `/guru/soalan-berstruktur/cipta` "Cipta Soalan Berstruktur" (R1-GUR-44b, S6-T17). "Hantar untuk Semakan"
 * posts API-GUR-17 (structured variant): one guru intake batch with one structured item, shown to the
 * teacher as "Menunggu Semakan". Success flashes "Soalan berstruktur dihantar untuk semakan." and returns to
 * the list; a refusal keeps the typed values and shows its messages. "Batal" leaves without saving.
 */
import { useRouter } from 'vue-router'

import { useFlash } from '@/composables'
import { DsBackLink, DsPage } from '@/ds'

import { createStructuredSubmission } from '../api/structured-submit'
import StructuredSubmitForm from '../components/soalan-berstruktur/StructuredSubmitForm.vue'
import { STRUCTURED_COPY } from '../lib/structured-form'
import { useStructuredSave } from '../lib/use-structured-save'

const LIST = '/guru/soalan-berstruktur'
const router = useRouter()
const flash = useFlash()
const { saving, fields, save } = useStructuredSave()

async function onSubmit(values: Parameters<typeof save>[0], image: File | null): Promise<void> {
  if (await save(values, image, null, (body) => createStructuredSubmission(body))) {
    flash.success(STRUCTURED_COPY.submitted)
    await router.push(LIST)
  }
}
</script>

<template>
  <DsPage data-testid="berstruktur-cipta-page">
    <DsBackLink :to="LIST" label="Kembali ke Senarai" data-testid="back-link" />
    <StructuredSubmitForm
      :saving="saving"
      :fields="fields"
      @submit="onSubmit"
      @cancel="router.push(LIST)"
    />
  </DsPage>
</template>
