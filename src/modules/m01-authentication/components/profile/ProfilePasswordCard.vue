<script setup lang="ts">
/**
 * S8 "Tukar Kata Laluan" card (FR-M01-45, BR-16): its own form, three password fields with no
 * `required` attribute (server-side validation only, as live). Hint "Sekurang-kurangnya 6 aksara"
 * (DV-03; live says 8). On
 * success the fields are cleared and the session is kept; the page shows the flash.
 */
import { ref } from 'vue'

import { useFlash } from '@/composables/useFlash'

import { changePassword } from '../../api'
import { errorLines } from '../../lib/error-lines'
import { DsCluster, DsStack } from '@/ds'

const emit = defineEmits<{
  saved: [status: string]
  failed: [lines: string[]]
}>()

const flash = useFlash()
const currentPassword = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const saving = ref(false)

async function submit(): Promise<void> {
  saving.value = true
  flash.clear()
  try {
    const status = await changePassword({
      currentPassword: currentPassword.value,
      password: password.value,
      passwordConfirmation: passwordConfirmation.value,
    })
    currentPassword.value = ''
    password.value = ''
    passwordConfirmation.value = ''
    emit('saved', status)
  } catch (err) {
    emit('failed', errorLines(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard>
    <DsStack as="form" data-testid="password-form" @submit.prevent="submit">
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-lock-key" class="size-5" aria-hidden="true" />
        Tukar Kata Laluan
      </h2>

      <UFormField label="Kata Laluan Semasa">
        <UInput
          v-model="currentPassword"
          type="password"
          name="current_password"
          autocomplete="current-password"
          size="lg"
          class="w-full"
          data-testid="password-current"
        />
      </UFormField>

      <UFormField label="Kata Laluan Baharu" help="Sekurang-kurangnya 6 aksara">
        <UInput
          v-model="password"
          type="password"
          name="password"
          autocomplete="new-password"
          size="lg"
          class="w-full"
          data-testid="password-new"
        />
      </UFormField>

      <UFormField label="Sahkan Kata Laluan Baharu">
        <UInput
          v-model="passwordConfirmation"
          type="password"
          name="password_confirmation"
          autocomplete="new-password"
          size="lg"
          class="w-full"
          data-testid="password-confirm"
        />
      </UFormField>

      <DsCluster gap="none" align="stretch" justify="end" :wrap="false">
        <UButton
          type="submit"
          color="primary"
          size="lg"
          icon="i-ph-shield-check"
          :loading="saving"
          :disabled="saving"
          data-testid="password-submit"
          >Tukar Kata Laluan</UButton
        >
      </DsCluster>
    </DsStack>
  </UCard>
</template>
