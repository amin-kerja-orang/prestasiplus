<script setup lang="ts">
/**
 * S3 `/password/reset` "Lupa Kata Laluan - PRESTASIPLUS" (M01-T4; FR-M01-27..29, BR-10).
 * Native validation only. Submit calls `POST /api/auth/password/email`: success shows the green
 * status box above the form, a failure the red alert; the email is kept either way (FR-M01-29).
 * There is no link to the IC reset here (FR-M01-27).
 */
import { onMounted, ref } from 'vue'

import AuthAlert from '../components/auth/AuthAlert.vue'

import { DsFormField, DsStack } from '@/ds'

import { sendPasswordResetLink } from '../api'
import PasswordCard from '../components/auth/PasswordCard.vue'
import { errorLines } from '../lib/error-lines'

const email = ref('')
const loading = ref(false)
const errors = ref<string[]>([])
const status = ref('')
const emailInput = ref<{ inputRef: HTMLInputElement | null } | null>(null)

// `autofocus` (FR-M01-27): the attribute only acts on a full page load, so focus on mount too.
onMounted(() => emailInput.value?.inputRef?.focus())

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

    <DsStack data-testid="forgot-form" as="form" @submit.prevent="submit">
      <AuthAlert variant="success" :messages="status" data-testid="forgot-status" />
      <AuthAlert :messages="errors" data-testid="forgot-alert" />

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
          data-testid="forgot-email"
        >
          <template #trailing>
            <span aria-hidden="true" class="text-dimmed select-none" data-testid="forgot-email-at"
              >@</span
            >
          </template>
        </UInput>
      </DsFormField>

      <UButton
        type="submit"
        block
        size="xl"
        variant="solid"
        :loading="loading"
        :disabled="loading"
        icon="i-ph-paper-plane-tilt-duotone"
        data-testid="forgot-submit"
      >
        {{ loading ? 'Menghantar...' : 'Hantar Pautan Reset' }}
      </UButton>

      <UButton
        to="/login"
        variant="link"
        color="neutral"
        icon="i-ph-arrow-left"
        class="min-h-11 justify-center"
        >Kembali ke Log Masuk</UButton
      >
    </DsStack>
  </PasswordCard>
</template>
