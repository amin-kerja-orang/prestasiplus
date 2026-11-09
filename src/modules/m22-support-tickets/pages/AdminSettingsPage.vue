<script setup lang="ts">
/**
 * `/admin/settings` "Tetapan" (R1-ADM-N-07): one section `Hubungi Sokongan`, the values Panduan and the ticket
 * screens show. Admin shell, platform admin only. The other V2 sections are not built (FD-N07).
 */
import { ref, watch } from 'vue'

import { isApiError } from '@/api'
import { useApi } from '@/composables'
import { DsCallout, DsFormField, DsFormSection, DsPage, DsStack, DsStateView } from '@/ds'

import { fetchSupportSettings, saveSupportSettings } from '../api/tickets'
import { SETTINGS_SAVED_FLASH } from '../api/types'

const { data, error, reload } = useApi((signal) => fetchSupportSettings({ signal }))

const email = ref('')
const whatsapp = ref('')
const hours = ref('')
watch(data, (saved) => {
  if (!saved) return
  email.value = saved.email
  whatsapp.value = saved.whatsapp
  hours.value = saved.hours
})

const saving = ref(false)
const saved = ref(false)
const fields = ref<Record<string, string>>({})
const formError = ref('')

async function save(): Promise<void> {
  saving.value = true
  saved.value = false
  fields.value = {}
  formError.value = ''
  try {
    const answer = await saveSupportSettings({
      email: email.value,
      whatsapp: whatsapp.value,
      hours: hours.value,
    })
    email.value = answer.email
    whatsapp.value = answer.whatsapp
    hours.value = answer.hours
    saved.value = true
  } catch (err) {
    if (isApiError(err) && err.fields) fields.value = err.fields
    else formError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage layout="form" data-testid="st-page">
    <DsStateView
      :status="data ? 'ready' : error ? 'error' : 'loading'"
      :error="error?.message"
      skeleton="text"
      @retry="reload"
    >
      <DsStack as="form" data-testid="st-form" @submit.prevent="save">
        <DsCallout
          v-if="saved"
          tone="success"
          :title="SETTINGS_SAVED_FLASH"
          data-testid="st-flash"
        />
        <DsCallout v-if="formError" tone="error" :title="formError" data-testid="st-error" />
        <DsFormSection title="Hubungi Sokongan" :columns="2">
          <DsFormField label="E-mel sokongan" name="email" :error="fields.email">
            <UInput
              v-model="email"
              type="text"
              inputmode="email"
              maxlength="120"
              class="w-full"
              data-testid="st-email"
            />
          </DsFormField>
          <DsFormField
            label="Telefon / WhatsApp sokongan"
            name="whatsapp"
            :error="fields.whatsapp"
          >
            <UInput
              v-model="whatsapp"
              type="text"
              inputmode="tel"
              class="w-full"
              data-testid="st-whatsapp"
            />
          </DsFormField>
          <DsFormField
            label="Waktu perkhidmatan"
            name="hours"
            :error="fields.hours"
            class="sm:col-span-2"
          >
            <UInput
              v-model="hours"
              type="text"
              maxlength="120"
              class="w-full"
              placeholder="Isnin - Jumaat, 9 pagi - 5 petang"
              data-testid="st-hours"
            />
          </DsFormField>
          <template #footer>
            <UButton type="submit" label="Simpan Tetapan" :loading="saving" data-testid="st-save" />
          </template>
        </DsFormSection>
      </DsStack>
    </DsStateView>
  </DsPage>
</template>
