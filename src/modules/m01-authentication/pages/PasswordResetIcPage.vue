<script setup lang="ts">
/**
 * S5 `/password/reset-ic` "Reset Kata Laluan (No IC) - PRESTASIPLUS" (M01-T4; FR-M01-33..35, BR-12).
 * Submit calls `POST /api/auth/password/reset-ic`; on a match the app goes to S4 pre-filled
 * (`/password/reset/{token}?email={email}`), otherwise the red alert shows the mismatch text and the
 * entered values stay. `maxlength=14` (DV-04; live 20).
 */
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AuthAlert from '../components/auth/AuthAlert.vue'

import { resetByIc } from '../api'
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from '../components/auth/classes'
import PasswordCard from '../components/auth/PasswordCard.vue'
import { errorLines } from '../lib/error-lines'

const router = useRouter()

const email = ref('')
const icNumber = ref('')
const loading = ref(false)
const errors = ref<string[]>([])
const emailInput = ref<HTMLInputElement | null>(null)

// `autofocus` (FR-M01-33): the attribute only acts on a full page load, so focus on mount too.
onMounted(() => emailInput.value?.focus())

async function submit(): Promise<void> {
  loading.value = true
  errors.value = []
  try {
    const { token, email: matched } = await resetByIc(email.value, icNumber.value)
    await router.push({ path: `/password/reset/${token}`, query: { email: matched } })
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <PasswordCard
    heading="Reset Melalui No IC"
    intro="Masukkan email dan No Kad Pengenalan yang didaftarkan dalam profil anda."
  >
    <template #icon
      ><UIcon name="i-ph-identification-card-duotone" class="size-10"
    /></template>

    <form data-testid="ic-form" class="space-y-5" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="ic-alert" />

      <div>
        <label for="email" :class="AUTH_LABEL_CLASS">
          <UIcon name="i-ph-envelope-simple-duotone" class="size-4 text-primary" />
          Alamat Email
        </label>
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
          :class="AUTH_INPUT_CLASS"
          data-testid="ic-email"
        />
      </div>

      <div>
        <label for="ic_number" :class="AUTH_LABEL_CLASS">
          <UIcon name="i-ph-identification-card-duotone" class="size-4 text-primary" />
          No Kad Pengenalan
        </label>
        <input
          id="ic_number"
          v-model="icNumber"
          type="text"
          name="ic_number"
          required
          maxlength="14"
          placeholder="000101010000"
          :class="AUTH_INPUT_CLASS"
          data-testid="ic-number"
        />
        <p class="mt-2 text-caption text-muted">Tanpa tanda sempang (-). Contoh: 000101010000</p>
      </div>

      <button type="submit" :disabled="loading" :class="AUTH_SUBMIT_CLASS" data-testid="ic-submit">
        <template v-if="loading">
          <UIcon name="i-ph-circle-notch" class="size-5 motion-safe:animate-spin" />
          Memproses...
        </template>
        <template v-else>
          <UIcon name="i-ph-lock-open-duotone" class="size-5" />
          Reset Kata Laluan
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
