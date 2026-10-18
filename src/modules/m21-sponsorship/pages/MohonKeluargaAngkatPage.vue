<script setup lang="ts">
/**
 * S6 `/mohon-keluarga-angkat` (FR-M21-46..49; URS FT-M21-4.2; M21-T2). The browser checks (`required`,
 * `type=email`) run first; "Hantar Permohonan" then calls #15. On 201 the form is reset and the PROPOSED
 * green notice shows above it; on 422 the PROPOSED messages of the `fields` map show in a red box above
 * the form (the rejected fields get the error ring). Examples fill the textarea client side only.
 */
import { computed, nextTick, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { DsPage } from '@/ds'

import { submitFosterApplication } from '../api'
import { FOSTER_APPLICATION_MESSAGES } from '../api/types'
import type { ApplicationCategory, FamilyIncomeRange, FosterApplicationField } from '../api/types'
import MohonHero from '../components/mohon/MohonHero.vue'
import MohonInfoBox from '../components/mohon/MohonInfoBox.vue'
import ReasonExamples from '../components/mohon/ReasonExamples.vue'
import { CATEGORY_OPTIONS, INCOME_OPTIONS, MOHON_COPY } from '../components/mohon/mohon-copy'

/** Generic failure line; INFERRED copy, same text as M01 `GENERIC_ERROR` (not in M01's public entry). */
const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

const form = reactive<{
  studentEmail: string
  studentCategory: ApplicationCategory | ''
  familyIncomeRange: FamilyIncomeRange | ''
  reason: string
}>({
  studentEmail: '',
  studentCategory: '',
  familyIncomeRange: '',
  reason: '',
})

const sending = ref(false)
const success = ref('')
const errors = ref<string[]>([])
const failedFields = ref<ReadonlySet<string>>(new Set())
const noticeEl = ref<HTMLElement | null>(null)

/** A rejected field gets an error ring (no ARIA added, D10). */
const errorClass = (field: FosterApplicationField): string =>
  failedFields.value.has(field) ? 'ring-2 ring-error' : ''
const categoryItems = [
  { label: MOHON_COPY.categoryPlaceholder, value: '' },
  ...CATEGORY_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
]
const incomeItems = [
  { label: MOHON_COPY.incomePlaceholder, value: '' },
  ...INCOME_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
]
const hasNotice = computed(() => success.value !== '' || errors.value.length > 0)

function pickExample(text: string): void {
  form.reason = text
}

function resetForm(): void {
  form.studentEmail = ''
  form.studentCategory = ''
  form.familyIncomeRange = ''
  form.reason = ''
}

async function showNotice(): Promise<void> {
  await nextTick()
  // Scroll the notice into view as the m02 form pages do (CompStudentCreatePage `alertBox.scrollIntoView`).
  noticeEl.value?.scrollIntoView?.({ block: 'nearest' })
}

async function onSubmit(): Promise<void> {
  if (sending.value) return
  sending.value = true
  success.value = ''
  errors.value = []
  failedFields.value = new Set()
  try {
    await submitFosterApplication({
      studentEmail: form.studentEmail.trim(),
      studentCategory: form.studentCategory as ApplicationCategory,
      familyIncomeRange: form.familyIncomeRange,
      reason: form.reason,
    })
    resetForm()
    success.value = FOSTER_APPLICATION_MESSAGES.success
  } catch (err) {
    if (isApiError(err) && err.fields !== undefined && Object.keys(err.fields).length > 0) {
      errors.value = [...new Set(Object.values(err.fields))]
      failedFields.value = new Set(Object.keys(err.fields))
    } else {
      // Not a field rejection (network, 401, 5xx): generic line as the m01 pages show (no M21 copy, SRS §8.3).
      errors.value = [GENERIC_ERROR]
    }
  } finally {
    sending.value = false
    await showNotice()
  }
}
</script>

<template>
  <DsPage class="max-w-2xl" data-testid="mohon-page">
    <MohonHero />

    <div v-show="hasNotice" ref="noticeEl" class="flex flex-col gap-2" data-testid="mohon-notice">
      <UAlert
        v-if="success !== ''"
        color="success"
        variant="soft"
        icon="i-ph-check-circle-duotone"
        :title="success"
        data-variant="success"
      />
      <UAlert
        v-if="errors.length > 0"
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        data-variant="error"
      >
        <template #title>
          <p v-for="e in errors" :key="e">{{ e }}</p>
        </template>
      </UAlert>
    </div>

    <form
      class="flex flex-col gap-4 rounded-card bg-default p-4 shadow-lift sm:p-6"
      data-testid="mohon-form"
      @submit.prevent="onSubmit"
    >
      <div>
        <label for="student_email" class="mb-1 block text-label text-highlighted">{{
          MOHON_COPY.emailLabel
        }}</label>
        <UInput
          id="student_email"
          v-model="form.studentEmail"
          name="student_email"
          type="email"
          required
          size="xl"
          class="w-full"
          :placeholder="MOHON_COPY.emailPlaceholder"
          :ui="{ base: errorClass('studentEmail') }"
        />
        <p id="student_email_hint" class="mt-1 text-caption text-muted">
          {{ MOHON_COPY.hintBefore
          }}<RouterLink to="/register" class="font-semibold text-primary-t underline">{{
            MOHON_COPY.hintLink
          }}</RouterLink
          >{{ MOHON_COPY.hintAfter }}
        </p>
      </div>

      <div>
        <label for="student_category" class="mb-1 block text-label text-highlighted">{{
          MOHON_COPY.categoryLabel
        }}</label>
        <UNativeSelect
          id="student_category"
          v-model="form.studentCategory"
          name="student_category"
          required
          size="xl"
          class="w-full"
          :items="categoryItems"
          :ui="{ base: errorClass('studentCategory') }"
        />
      </div>

      <div>
        <label for="family_income_range" class="mb-1 block text-label text-highlighted">{{
          MOHON_COPY.incomeLabel
        }}</label>
        <UNativeSelect
          id="family_income_range"
          v-model="form.familyIncomeRange"
          name="family_income_range"
          size="xl"
          class="w-full"
          :items="incomeItems"
          :ui="{ base: errorClass('familyIncomeRange') }"
        />
      </div>

      <div>
        <label for="reason" class="mb-1 block text-label text-highlighted">{{
          MOHON_COPY.reasonLabel
        }}</label>
        <UTextarea
          id="reason"
          v-model="form.reason"
          name="reason"
          :rows="4"
          required
          class="w-full"
          :placeholder="MOHON_COPY.reasonPlaceholder"
          :ui="{ base: errorClass('reason') }"
        />
      </div>

      <ReasonExamples @pick="pickExample" />

      <UButton
        type="submit"
        size="xl"
        icon="i-ph-paper-plane-tilt-duotone"
        class="min-h-12 w-full justify-center"
        :disabled="sending"
        data-testid="mohon-submit"
        >{{ MOHON_COPY.submit }}</UButton
      >
    </form>

    <MohonInfoBox />
  </DsPage>
</template>
