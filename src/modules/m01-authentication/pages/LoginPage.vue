<script setup lang="ts">
/**
 * S1 `/login` "Log Masuk - PRESTASIPLUS" (M01-T3; FR-M01-01..14, 67, 68).
 * Native HTML5 validation only (`required`, `type=email`; no `novalidate`, FR-M01-08). Submit calls
 * `POST /api/auth/login`; on success the session is stored and the app goes to the role landing
 * page with no message (FR-M01-12); on failure the red alert shows the server text, the email is
 * kept and the password cleared (FR-M01-09/10/68). Renders for a logged-in user too (FR-M01-13).
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthAlert from '../components/auth/AuthAlert.vue'
import { isPrototypeRole, isPrototypeScopeOn, MSG_ROLE_OUT_OF_SCOPE } from '@/app/prototype-scope'
import { resolvePostLoginTarget } from '@/app/router/guards'
import { useApi } from '@/composables'
import { DsFormField, DsSticker } from '@/ds'
import { formatNumber } from '@/lib/number'
import { useSessionStore } from '@/stores/session'

import { getPlatformStats, login } from '../api'
import AuthLayout from '../components/auth/AuthLayout.vue'
import AuthWelcomePanel from '../components/auth/AuthWelcomePanel.vue'
import PasswordInput from '../components/auth/PasswordInput.vue'
import { LOGIN_TILES } from '../components/auth/welcome-tiles'
import { errorLines } from '../lib/error-lines'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const email = ref('')
const password = ref('')
const remember = ref(false)
const loading = ref(false)
const errors = ref<string[]>([])

// FR-M01-11: derived at request time; the welcome text and the stats strip use the same values.
const { data: stats } = useApi(() => getPlatformStats())

async function submit(): Promise<void> {
  loading.value = true
  errors.value = []
  try {
    const next = await login({
      email: email.value,
      password: password.value,
      remember: remember.value,
    })
    session.setSession(next)
    // SWEEP-23OCT O1: the real API does not know the prototype scope. Same refusal as the mock login:
    // end the server session (POST /api/auth/logout, then the client session is cleared) and say why.
    if (isPrototypeScopeOn() && !isPrototypeRole(next.user.role)) {
      await session.logout()
      errors.value = [MSG_ROLE_OUT_OF_SCOPE]
      password.value = ''
      return
    }
    await router.push(
      resolvePostLoginTarget(router, route.query.redirect, {
        isLoggedIn: true,
        role: next.user.role,
        landingPath: next.user.landingPath,
      }),
    )
  } catch (err) {
    errors.value = errorLines(err)
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout tagline="Platform Latih Tubi Nasional 🇲🇾">
    <template #welcome>
      <AuthWelcomePanel mascot="🎓" heading="Selamat Kembali! 👋" :tiles="LOGIN_TILES">
        <template v-if="stats">
          Teruskan pembelajaran anda dengan lebih
          <strong data-testid="welcome-question-count">{{
            formatNumber(stats.questionCount)
          }}</strong>
          soalan latihan dalam <strong>{{ formatNumber(stats.subjectCount) }}</strong> subjek
          berbeza!
        </template>
      </AuthWelcomePanel>
    </template>

    <form data-testid="login-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="login-alert" />

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
          data-testid="login-email"
        />
      </DsFormField>

      <DsFormField native for="password" label="Kata Laluan">
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="••••••••"
          autocomplete="current-password"
          testid="login-password"
        />
      </DsFormField>

      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <UCheckbox
          v-model="remember"
          name="remember"
          label="Ingat saya"
          data-testid="login-remember"
        />
        <div class="ml-auto flex flex-col items-end">
          <UButton to="/password/reset" variant="link" color="primary" class="min-h-11"
            >Lupa kata laluan?</UButton
          >
          <UButton
            to="/password/reset-ic"
            variant="link"
            color="primary"
            icon="i-ph-identification-card-duotone"
            class="min-h-11"
            >Reset melalui No IC</UButton
          >
        </div>
      </div>

      <UButton
        type="submit"
        block
        size="xl"
        variant="solid"
        :loading="loading"
        :disabled="loading"
        icon="i-ph-sign-in-duotone"
        data-testid="login-submit"
      >
        {{ loading ? 'Sedang Memasuki...' : 'Log Masuk' }}
      </UButton>

      <UButton to="/register" variant="link" color="neutral" class="min-h-11 justify-center">
        <span>Belum ada akaun? <strong class="text-primary-t">Daftar Sekarang 🚀</strong></span>
      </UButton>

      <UButton
        to="/"
        variant="link"
        color="neutral"
        icon="i-ph-arrow-left"
        class="min-h-11 justify-center"
        >Kembali ke Laman Utama</UButton
      >
    </form>

    <template #below>
      <ul
        v-if="stats"
        class="mt-4 flex flex-wrap items-center justify-center gap-2"
        data-testid="login-stats"
      >
        <li>
          <DsSticker art="books">{{ formatNumber(stats.questionCount) }}+ Soalan</DsSticker>
        </li>
        <li>
          <DsSticker art="cap">{{ formatNumber(stats.subjectCount) }} Subjek</DsSticker>
        </li>
        <li>
          <DsSticker art="trophy">{{ formatNumber(stats.levelCount) }} Tahap</DsSticker>
        </li>
      </ul>
    </template>
  </AuthLayout>
</template>
