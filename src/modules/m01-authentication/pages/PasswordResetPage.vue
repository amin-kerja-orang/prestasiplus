<script setup lang="ts">
/**
 * S4 `/password/reset/:token` "Reset Kata Laluan - PRESTASIPLUS" (M01-T4; FR-M01-30..32, BR-11).
 * Renders for any token (the token is checked on submit). The email is pre-filled from `?email=`,
 * otherwise empty and editable. On success the new session is stored and the app goes to the role
 * landing page with the status text as flash; a bad or expired token shows the red alert, keeps the
 * email and clears the two password fields (INFERRED, Laravel "withInput except password").
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthAlert from '../components/auth/AuthAlert.vue'
import { useFlash } from '@/composables'
import { DsFormField } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { resetPassword } from '../api'
import PasswordCard from '../components/auth/PasswordCard.vue'
import PasswordInput from '../components/auth/PasswordInput.vue'
import { useNoReferrer } from '../composables/useNoReferrer'
import { errorLines } from '../lib/error-lines'

// The URL may hold the token (path route): never send it as a Referer (SW8-07b).
useNoReferrer()

// SW8-07b: the mailed link carries the token in the URL fragment; `PasswordResetEntryPage` reads it
// once and hands it over as props (client state only). Without props the token comes from the path
// and the e-mail from `?email=`, as on the live site.
const props = defineProps<{ token?: string; email?: string }>()

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const flash = useFlash()

const token =
  props.token ??
  String(Array.isArray(route.params.token) ? route.params.token[0] : route.params.token)
const queryEmail = Array.isArray(route.query.email) ? route.query.email[0] : route.query.email

const email = ref(props.email ?? queryEmail ?? '')
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const errors = ref<string[]>([])

async function submit(): Promise<void> {
  loading.value = true
  errors.value = []
  try {
    const { session: next, status } = await resetPassword({
      token,
      email: email.value,
      password: password.value,
      passwordConfirmation: confirmation.value,
    })
    session.setSession(next)
    flash.success(status)
    await router.push(next.user.landingPath)
  } catch (err) {
    errors.value = errorLines(err)
    password.value = ''
    confirmation.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PasswordCard heading="Reset Kata Laluan" intro="Masukkan kata laluan baru anda.">
    <template #icon>🔒</template>

    <form data-testid="reset-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="reset-alert" />
      <UInput type="hidden" name="token" :model-value="token" class="hidden" />

      <DsFormField native for="email" label="Alamat Email">
        <UInput
          id="email"
          v-model="email"
          type="email"
          name="email"
          required
          autocomplete="email"
          placeholder="nama@email.com"
          icon="i-ph-envelope-simple-duotone"
          size="xl"
          class="w-full"
          data-testid="reset-email"
        />
      </DsFormField>

      <DsFormField native for="password" label="Kata Laluan Baru">
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="Minimum 6 aksara"
          autocomplete="new-password"
          testid="reset-password"
        />
      </DsFormField>

      <DsFormField native for="password_confirmation" label="Sahkan Kata Laluan">
        <PasswordInput
          id="password_confirmation"
          v-model="confirmation"
          name="password_confirmation"
          placeholder="Taip semula kata laluan"
          autocomplete="new-password"
          testid="reset-confirm"
        />
      </DsFormField>

      <UButton
        type="submit"
        block
        size="xl"
        variant="solid"
        :loading="loading"
        :disabled="loading"
        icon="i-ph-check-circle-duotone"
        data-testid="reset-submit"
      >
        {{ loading ? 'Menukar...' : 'Tukar Kata Laluan' }}
      </UButton>

      <UButton
        to="/login"
        variant="link"
        color="neutral"
        icon="i-ph-arrow-left"
        class="min-h-11 justify-center"
        >Kembali ke Log Masuk</UButton
      >
    </form>
  </PasswordCard>
</template>
