<script setup lang="ts">
/**
 * S8 "Tukar Kata Laluan" card (FR-M01-45, BR-16): its own form, three password fields with no
 * `required` attribute and no eye toggle (server-side validation only, as live). Hint
 * "Sekurang-kurangnya 6 aksara" (DV-03; live says 8). On success the fields are cleared and the
 * session is kept; the page shows the flash.
 */
import { KeyRound, Lock, Shield } from '@lucide/vue'
import { ref } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'

import { changePassword } from '../../api'
import { errorLines } from '../../lib/error-lines'
import {
  PROFILE_BUTTON_CLASS,
  PROFILE_CARD_CLASS,
  PROFILE_CARD_TITLE_CLASS,
  PROFILE_INPUT_CLASS,
  PROFILE_LABEL_CLASS,
} from './classes'

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
  <form :class="PROFILE_CARD_CLASS" data-testid="password-form" @submit.prevent="submit">
    <h2 :class="PROFILE_CARD_TITLE_CLASS">
      <Lock class="h-5 w-5 text-amber-500" />
      Tukar Kata Laluan
    </h2>

    <div class="space-y-4">
      <div>
        <label for="current_password" :class="PROFILE_LABEL_CLASS">
          <KeyRound class="h-4 w-4 text-amber-500" />
          Kata Laluan Semasa
        </label>
        <input
          id="current_password"
          v-model="currentPassword"
          type="password"
          name="current_password"
          autocomplete="current-password"
          :class="PROFILE_INPUT_CLASS"
          data-testid="password-current"
        />
      </div>

      <div>
        <label for="password" :class="PROFILE_LABEL_CLASS">
          <Lock class="h-4 w-4 text-green-500" />
          Kata Laluan Baharu
        </label>
        <input
          id="password"
          v-model="password"
          type="password"
          name="password"
          autocomplete="new-password"
          :class="PROFILE_INPUT_CLASS"
          data-testid="password-new"
        />
        <p class="mt-1 text-xs text-slate-500">Sekurang-kurangnya 6 aksara</p>
      </div>

      <div>
        <label for="password_confirmation" :class="PROFILE_LABEL_CLASS">
          <Lock class="h-4 w-4 text-green-500" />
          Sahkan Kata Laluan Baharu
        </label>
        <input
          id="password_confirmation"
          v-model="passwordConfirmation"
          type="password"
          name="password_confirmation"
          autocomplete="new-password"
          :class="PROFILE_INPUT_CLASS"
          data-testid="password-confirm"
        />
      </div>

      <button
        type="submit"
        :disabled="saving"
        :class="[PROFILE_BUTTON_CLASS, 'bg-warn-gradient']"
        data-testid="password-submit"
      >
        <LoadingSpinner v-if="saving" />
        <Shield v-else class="h-4 w-4" />
        Tukar Kata Laluan
      </button>
    </div>
  </form>
</template>
