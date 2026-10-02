<script setup lang="ts">
/**
 * S5 `/password/reset-ic` "Reset Kata Laluan (No IC) - PRESTASIPLUS" (M01-T4; FR-M01-33..35, BR-12).
 * Submit calls `POST /api/auth/password/reset-ic`; on a match the app goes to S4 pre-filled
 * (`/password/reset/{token}?email={email}`), otherwise the red alert shows the mismatch text and the
 * entered values stay. `maxlength=14` (DV-04; live 20).
 */
import { ArrowLeft, IdCard, LockOpen, Mail } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'

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
      ><IdCard class="h-[60px] w-[60px] text-indigo-400" :stroke-width="1.5"
    /></template>

    <form data-testid="ic-form" class="space-y-5" @submit.prevent="submit">
      <AlertBox :messages="errors" data-testid="ic-alert" />

      <div>
        <label for="email" :class="AUTH_LABEL_CLASS">
          <Mail class="h-4 w-4 text-blue-500" />
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
          <IdCard class="h-4 w-4 text-indigo-500" />
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
        <p class="mt-2 text-xs text-slate-500">Tanpa tanda sempang (-). Contoh: 000101010000</p>
      </div>

      <button type="submit" :disabled="loading" :class="AUTH_SUBMIT_CLASS" data-testid="ic-submit">
        <template v-if="loading">
          <LoadingSpinner />
          Memproses...
        </template>
        <template v-else>
          <LockOpen class="h-5 w-5" />
          Reset Kata Laluan
        </template>
      </button>

      <p class="text-center">
        <RouterLink to="/login" :class="[AUTH_LINK_CLASS, 'text-slate-500 hover:text-slate-700']">
          <ArrowLeft class="h-4 w-4" />
          Kembali ke Log Masuk
        </RouterLink>
      </p>
    </form>
  </PasswordCard>
</template>
