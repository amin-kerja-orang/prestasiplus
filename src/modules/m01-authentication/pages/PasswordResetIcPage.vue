<script setup lang="ts">
/**
 * S5 `/password/reset-ic` "Reset Kata Laluan (No IC) - PRESTASIPLUS" (M01-T4; FR-M01-33..35, BR-12).
 * Submit calls `POST /api/auth/password/reset-ic`; on a match the app goes to S4 pre-filled
 * (`/password/reset/{token}?email={email}`; the e-mail is the one typed here when the response
 * carries none, SW8-03), otherwise the red alert shows the mismatch text and the
 * entered values stay. `maxlength=14` (DV-04; live 20).
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthAlert from '../components/auth/AuthAlert.vue'

import { DsFormField } from '@/ds'

import { resetByIc } from '../api'
import PasswordCard from '../components/auth/PasswordCard.vue'
import { errorLines } from '../lib/error-lines'

const router = useRouter()

const email = ref('')
const icNumber = ref('')
const loading = ref(false)
const errors = ref<string[]>([])
const emailInput = ref<{ inputRef: HTMLInputElement | null } | null>(null)

// `autofocus` (FR-M01-33): the attribute only acts on a full page load, so focus on mount too.
onMounted(() => emailInput.value?.inputRef?.focus())

async function submit(): Promise<void> {
  loading.value = true
  errors.value = []
  try {
    // Snapshot first: the field stays editable while the request is pending, but the token is
    // bound to the e-mail that was submitted.
    const submitted = email.value
    const { token, email: matched } = await resetByIc(submitted, icNumber.value)
    // SW8-03: the API answers `{token}` only, and the token is bound to the e-mail it was
    // issued for, so S4 gets the submitted e-mail (the mock also echoes it; that one wins).
    await router.push({
      path: `/password/reset/${token}`,
      query: { email: matched ?? submitted },
    })
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

    <form data-testid="ic-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="ic-alert" />

      <DsFormField native for="email" label="Alamat Email">
        <UInput
          id="email"
          ref="emailInput"
          v-model="email"
          type="email"
          name="email"
          required
          autofocus
          autocomplete="email"
          placeholder="nama@email.com"
          icon="i-ph-envelope-simple-duotone"
          size="xl"
          class="w-full"
          data-testid="ic-email"
        />
      </DsFormField>

      <DsFormField
        native
        for="ic_number"
        label="No Kad Pengenalan"
        hint="Tanpa tanda sempang (-). Contoh: 000101010000"
      >
        <UInput
          id="ic_number"
          v-model="icNumber"
          type="text"
          name="ic_number"
          required
          maxlength="14"
          placeholder="000101010000"
          icon="i-ph-identification-card-duotone"
          size="xl"
          class="w-full"
          data-testid="ic-number"
        />
      </DsFormField>

      <UButton
        type="submit"
        block
        size="xl"
        variant="solid"
        :loading="loading"
        :disabled="loading"
        icon="i-ph-lock-open-duotone"
        data-testid="ic-submit"
      >
        {{ loading ? 'Memproses...' : 'Reset Kata Laluan' }}
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
