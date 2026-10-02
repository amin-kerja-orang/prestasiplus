<script setup lang="ts">
/**
 * S1 `/login` "Log Masuk - PRESTASIPLUS" (M01-T3; FR-M01-01..14, 67, 68).
 * Native HTML5 validation only (`required`, `type=email`; no `novalidate`, FR-M01-08). Submit calls
 * `POST /api/auth/login`; on success the session is stored and the app goes to the role landing
 * page with no message (FR-M01-12); on failure the red alert shows the server text, the email is
 * kept and the password cleared (FR-M01-09/10/68). Renders for a logged-in user too (FR-M01-13).
 */
import { ArrowLeft, IdCard, Lock, LogIn, Mail } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatNumber } from '@/lib/number'
import { useSessionStore } from '@/stores/session'

import { getPlatformStats, login } from '../api'
import AuthLayout from '../components/auth/AuthLayout.vue'
import AuthWelcomePanel from '../components/auth/AuthWelcomePanel.vue'
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from '../components/auth/classes'
import PasswordInput from '../components/auth/PasswordInput.vue'
import { LOGIN_TILES } from '../components/auth/welcome-tiles'
import { errorLines } from '../lib/error-lines'

const router = useRouter()
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
    await router.push(next.user.landingPath)
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

    <form data-testid="login-form" class="space-y-5" @submit.prevent="submit">
      <AlertBox :messages="errors" data-testid="login-alert" />

      <div>
        <label for="email" :class="AUTH_LABEL_CLASS">
          <Mail class="h-4 w-4 text-blue-500" />
          Alamat Email
        </label>
        <div class="relative">
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="nama@email.com"
            :class="[AUTH_INPUT_CLASS, 'pr-12']"
            data-testid="login-email"
          />
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-gray-400 select-none"
            >@</span
          >
        </div>
      </div>

      <div>
        <label for="password" :class="AUTH_LABEL_CLASS">
          <Lock class="h-4 w-4 text-green-500" />
          Kata Laluan
        </label>
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="••••••••"
          autocomplete="current-password"
          testid="login-password"
        />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-x-4">
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            v-model="remember"
            type="checkbox"
            name="remember"
            class="h-5 w-5 rounded border-gray-300 accent-indigo-600"
            data-testid="login-remember"
          />
          Ingat saya
        </label>
        <div class="ml-auto flex flex-col items-end">
          <RouterLink
            to="/password/reset"
            :class="[AUTH_LINK_CLASS, 'text-blue-600 hover:text-blue-800']"
          >
            Lupa kata laluan?
          </RouterLink>
          <RouterLink
            to="/password/reset-ic"
            :class="[AUTH_LINK_CLASS, 'text-indigo-600 hover:text-indigo-800']"
          >
            <IdCard class="h-4 w-4" />
            Reset melalui No IC
          </RouterLink>
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading"
        :class="AUTH_SUBMIT_CLASS"
        data-testid="login-submit"
      >
        <template v-if="loading">
          <LoadingSpinner />
          Sedang Memasuki...
        </template>
        <template v-else>
          <LogIn class="h-5 w-5" />
          Log Masuk
        </template>
      </button>

      <p class="text-center text-sm text-gray-600">
        <RouterLink
          to="/register"
          class="inline-flex min-h-11 items-center gap-1 text-gray-600 hover:text-gray-800"
        >
          Belum ada akaun?
          <strong class="text-indigo-600 underline decoration-wavy underline-offset-4"
            >Daftar Sekarang 🚀</strong
          >
        </RouterLink>
      </p>

      <p class="text-center">
        <RouterLink to="/" :class="[AUTH_LINK_CLASS, 'text-slate-500 hover:text-slate-700']">
          <ArrowLeft class="h-4 w-4" />
          Kembali ke Laman Utama
        </RouterLink>
      </p>
    </form>

    <template #below>
      <p
        v-if="stats"
        class="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-center text-sm font-medium text-slate-700 shadow"
        data-testid="login-stats"
      >
        ❓ {{ formatNumber(stats.questionCount) }}+ Soalan • 📚
        {{ formatNumber(stats.subjectCount) }} Subjek • 🎓
        {{ formatNumber(stats.levelCount) }} Tahap
      </p>
    </template>
  </AuthLayout>
</template>
