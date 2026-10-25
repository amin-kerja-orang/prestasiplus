<script setup lang="ts">
/**
 * `/password/change` "Tukar Kata Laluan - PRESTASIPLUS" (AM2-A1, DV-26): the forced password change.
 * An account flagged `mustChangePassword` (admin-created, bootstrapped or migrated) is refused by the
 * API on every route except `GET /api/session`, `PUT /api/me/password` and logout, so the router
 * sends it here. The page calls only `PUT /api/me/password` (current, new, confirmation) and, after
 * success, `GET /api/session`: the change rotates the session, so the CSRF token and the flag must be
 * read again. Then it goes to the landing path. Any signed-in role may open it. Native validation
 * only; the server's field errors show in the red alert (`errorLines`). The notice is the API's own
 * `PASSWORD_CHANGE_REQUIRED` text; the rest of the copy is "Perlu pengesahan". If the password changed
 * but the new session cannot be read, the stored CSRF token is stale: the page signs out (best effort
 * on the server, always locally) and goes to `/login`.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFlash } from '@/composables'
import { DsFormField, DsStack } from '@/ds'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'

import AuthAlert from '../components/auth/AuthAlert.vue'
import PasswordCard from '../components/auth/PasswordCard.vue'
import PasswordInput from '../components/auth/PasswordInput.vue'
import { errorLines } from '../lib/error-lines'
import { changePasswordAndRefresh } from '../lib/password-change'

const router = useRouter()
const session = useSessionStore()
const flash = useFlash()

const currentPassword = ref('')
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const errors = ref<string[]>([])

async function submit(): Promise<void> {
  if (loading.value) return
  loading.value = true
  errors.value = []
  let result: Awaited<ReturnType<typeof changePasswordAndRefresh>>
  try {
    result = await changePasswordAndRefresh({
      currentPassword: currentPassword.value,
      password: password.value,
      passwordConfirmation: confirmation.value,
    })
  } catch (err) {
    errors.value = errorLines(err)
    loading.value = false
    return
  } finally {
    // Never keep a typed password in the page state, whatever the outcome.
    currentPassword.value = ''
    password.value = ''
    confirmation.value = ''
  }
  if (!result.refreshed) {
    // The password is changed but the new session could not be read: sign in again.
    await session.logout()
    useNotificationBadgeStore().reset()
    loading.value = false
    await router.replace('/login')
    return
  }
  flash.success(result.status)
  loading.value = false
  await router.push(session.landingPath ?? '/')
}
</script>

<template>
  <PasswordCard heading="Tukar Kata Laluan" intro="Sila tukar kata laluan anda sebelum meneruskan.">
    <template #icon>🔒</template>

    <DsStack as="form" data-testid="change-form" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="change-alert" />

      <DsFormField native for="current_password" label="Kata Laluan Semasa">
        <PasswordInput
          id="current_password"
          v-model="currentPassword"
          name="current_password"
          placeholder="••••••••"
          autocomplete="current-password"
          testid="change-current"
        />
      </DsFormField>

      <DsFormField native for="password" label="Kata Laluan Baharu">
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="Minimum 6 aksara"
          autocomplete="new-password"
          testid="change-new"
        />
      </DsFormField>

      <DsFormField native for="password_confirmation" label="Sahkan Kata Laluan Baharu">
        <PasswordInput
          id="password_confirmation"
          v-model="confirmation"
          name="password_confirmation"
          placeholder="Taip semula kata laluan"
          autocomplete="new-password"
          testid="change-confirm"
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
        data-testid="change-submit"
      >
        {{ loading ? 'Menukar...' : 'Tukar Kata Laluan' }}
      </UButton>

      <UButton
        to="/logout"
        block
        size="xl"
        variant="link"
        color="neutral"
        icon="i-ph-sign-out-duotone"
        data-testid="change-logout"
        >Log Keluar</UButton
      >
    </DsStack>
  </PasswordCard>
</template>
