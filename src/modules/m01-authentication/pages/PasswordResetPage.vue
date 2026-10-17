<script setup lang="ts">
/**
 * S4 `/password/reset/:token` "Reset Kata Laluan - PRESTASIPLUS" (M01-T4; FR-M01-30..32, BR-11).
 * Renders for any token (the token is checked on submit). The email is pre-filled from `?email=`,
 * otherwise empty and editable. On success the new session is stored and the app goes to the role
 * landing page with the status text as flash; a bad or expired token shows the red alert, keeps the
 * email and clears the two password fields (INFERRED, Laravel "withInput except password").
 */
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AuthAlert from '../components/auth/AuthAlert.vue'
import { useFlash } from '@/composables'
import { useSessionStore } from '@/stores/session'

import { resetPassword } from '../api'
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from '../components/auth/classes'
import PasswordCard from '../components/auth/PasswordCard.vue'
import PasswordInput from '../components/auth/PasswordInput.vue'
import { errorLines } from '../lib/error-lines'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const flash = useFlash()

const token = String(Array.isArray(route.params.token) ? route.params.token[0] : route.params.token)
const queryEmail = Array.isArray(route.query.email) ? route.query.email[0] : route.query.email

const email = ref(queryEmail ?? '')
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

    <form data-testid="reset-form" class="space-y-5" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="reset-alert" />
      <input type="hidden" name="token" :value="token" />

      <div>
        <label for="email" :class="AUTH_LABEL_CLASS">
          <UIcon name="i-ph-envelope-simple-duotone" class="size-4 text-primary" />
          Alamat Email
        </label>
        <input
          id="email"
          v-model="email"
          type="email"
          name="email"
          required
          autocomplete="email"
          placeholder="nama@email.com"
          :class="AUTH_INPUT_CLASS"
          data-testid="reset-email"
        />
      </div>

      <div>
        <label for="password" :class="AUTH_LABEL_CLASS">
          <UIcon name="i-ph-lock-duotone" class="size-4 text-primary" />
          Kata Laluan Baru
        </label>
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="Minimum 6 aksara"
          autocomplete="new-password"
          testid="reset-password"
        />
      </div>

      <div>
        <label for="password_confirmation" :class="AUTH_LABEL_CLASS">
          <UIcon name="i-ph-lock-duotone" class="size-4 text-primary" />
          Sahkan Kata Laluan
        </label>
        <PasswordInput
          id="password_confirmation"
          v-model="confirmation"
          name="password_confirmation"
          placeholder="Taip semula kata laluan"
          autocomplete="new-password"
          testid="reset-confirm"
        />
      </div>

      <button
        type="submit"
        :disabled="loading"
        :class="AUTH_SUBMIT_CLASS"
        data-testid="reset-submit"
      >
        <template v-if="loading">
          <UIcon name="i-ph-circle-notch" class="size-5 motion-safe:animate-spin" />
          Menukar...
        </template>
        <template v-else>
          <UIcon name="i-ph-check-circle-duotone" class="size-5" />
          Tukar Kata Laluan
        </template>
      </button>

      <p class="text-center">
        <RouterLink to="/login" :class="[AUTH_LINK_CLASS, 'text-muted hover:text-default']">
          <UIcon name="i-ph-arrow-left" class="size-4" />
          Kembali ke Log Masuk
        </RouterLink>
      </p>
    </form>
  </PasswordCard>
</template>
