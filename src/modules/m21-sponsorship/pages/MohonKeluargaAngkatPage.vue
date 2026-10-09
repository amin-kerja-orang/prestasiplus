<script setup lang="ts">
/**
 * S6 `/mohon-keluarga-angkat` (FR-M21-46..49; URS FT-M21-4.2; M21-T2). The browser checks (`required`,
 * `type=email`) run first; "Hantar Permohonan" then calls #15. On 201 the form is reset and the PROPOSED
 * green notice shows above it; on 422 the PROPOSED messages of the `fields` map show in a red box above
 * the form (the rejected fields get the red border). Examples fill the textarea client side only.
 */
import { Send } from '@lucide/vue'
import { computed, nextTick, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'

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

const errorClass = (field: FosterApplicationField): string =>
  failedFields.value.has(field) ? FORM_ERROR_MODIFIER : ''
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
  <div class="mx-auto w-full max-w-[670px] min-w-0 space-y-4" data-testid="mohon-page">
    <MohonHero />

    <div v-show="hasNotice" ref="noticeEl" data-testid="mohon-notice">
      <AlertBox v-if="success !== ''" variant="success" :messages="success" />
      <AlertBox v-if="errors.length > 0" variant="error" :messages="errors" />
    </div>

    <form
      class="space-y-4 rounded-2xl bg-white p-4 shadow-md sm:p-6"
      data-testid="mohon-form"
      @submit.prevent="onSubmit"
    >
      <div>
        <label for="student_email" class="mb-1 block text-sm font-semibold text-slate-700">{{
          MOHON_COPY.emailLabel
        }}</label>
        <input
          id="student_email"
          v-model="form.studentEmail"
          name="student_email"
          type="email"
          required
          :placeholder="MOHON_COPY.emailPlaceholder"
          :class="[FORM_INPUT_CLASS, errorClass('studentEmail')]"
        />
        <p id="student_email_hint" class="mt-1 text-xs text-slate-500">
          {{ MOHON_COPY.hintBefore
          }}<RouterLink to="/register" class="font-semibold text-blue-600 underline">{{
            MOHON_COPY.hintLink
          }}</RouterLink
          >{{ MOHON_COPY.hintAfter }}
        </p>
      </div>

      <div>
        <label for="student_category" class="mb-1 block text-sm font-semibold text-slate-700">{{
          MOHON_COPY.categoryLabel
        }}</label>
        <select
          id="student_category"
          v-model="form.studentCategory"
          name="student_category"
          required
          :class="[FORM_SELECT_CLASS, errorClass('studentCategory')]"
        >
          <option value="">{{ MOHON_COPY.categoryPlaceholder }}</option>
          <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>

      <div>
        <label for="family_income_range" class="mb-1 block text-sm font-semibold text-slate-700">{{
          MOHON_COPY.incomeLabel
        }}</label>
        <select
          id="family_income_range"
          v-model="form.familyIncomeRange"
          name="family_income_range"
          :class="[FORM_SELECT_CLASS, errorClass('familyIncomeRange')]"
        >
          <option value="">{{ MOHON_COPY.incomePlaceholder }}</option>
          <option v-for="o in INCOME_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>

      <div>
        <label for="reason" class="mb-1 block text-sm font-semibold text-slate-700">{{
          MOHON_COPY.reasonLabel
        }}</label>
        <textarea
          id="reason"
          v-model="form.reason"
          name="reason"
          rows="4"
          required
          :placeholder="MOHON_COPY.reasonPlaceholder"
          :class="[FORM_TEXTAREA_CLASS, errorClass('reason')]"
        ></textarea>
      </div>

      <ReasonExamples @pick="pickExample" />

      <button
        type="submit"
        class="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="sending"
        data-testid="mohon-submit"
      >
        <Send class="h-4 w-4" />
        {{ MOHON_COPY.submit }}
      </button>
    </form>

    <MohonInfoBox />
  </div>
</template>
