<script setup lang="ts">
/**
 * S3 `/password/reset` "Lupa Kata Laluan - PRESTASIPLUS" (M01-T4; FR-M01-27..29, BR-10).
 * Native validation only. Submit calls `POST /api/auth/password/email`: success shows the green
 * status box above the form, a failure the red alert; the email is kept either way (FR-M01-29).
 * There is no link to the IC reset here (FR-M01-27).
 */
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AuthAlert from '../components/auth/AuthAlert.vue'

import { sendPasswordResetLink } from '../api'
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from '../components/auth/classes'
import PasswordCard from '../components/auth/PasswordCard.vue'
import { errorLines } from '../lib/error-lines'

const email = ref('')
const loading = ref(false)
const errors = ref<string[]>([])
const status = ref('')
const emailInput = ref<HTMLInputElement | null>(null)

// `autofocus` (FR-M01-27): the attribute only acts on a full page load, so focus on mount too.
onMounted(() => emailInput.value?.focus())

async function submit(): Promise<void> {
  loading.value = true
  errors.value = []
  status.value = ''
  try {
    status.value = await sendPasswordResetLink(email.value)
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PasswordCard
    heading="Lupa Kata Laluan?"
    intro="Masukkan email anda dan kami akan hantar pautan untuk reset kata laluan."
  >
    <template #icon>🔑</template>

    <form data-testid="forgot-form" class="space-y-5" @submit.prevent="submit">
      <AuthAlert variant="success" :messages="status" data-testid="forgot-status" />
      <AuthAlert :messages="errors" data-testid="forgot-alert" />

      <div>
        <label for="email" :class="AUTH_LABEL_CLASS">
          <UIcon name="i-ph-envelope-simple-duotone" class="size-4 text-primary" />
          Alamat Email
        </label>
        <div class="relative">
          <input
            id="email"
            ref="emailInput"
            v-model="email"
            type="email"
            name="email"
            required
            autofocus
            autocomplete="email"
            placeholder="nama@email.com"
            :class="[AUTH_INPUT_CLASS, 'pr-12']"
            data-testid="forgot-email"
          />
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-dimmed select-none"
            data-testid="forgot-email-at"
            >@</span
          >
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading"
        :class="AUTH_SUBMIT_CLASS"
        data-testid="forgot-submit"
      >
        <template v-if="loading">
          <UIcon name="i-ph-circle-notch" class="size-5 motion-safe:animate-spin" />
          Menghantar...
        </template>
        <template v-else>
          <UIcon name="i-ph-paper-plane-tilt-duotone" class="size-5" />
          Hantar Pautan Reset
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
