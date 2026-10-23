<script setup lang="ts">
/**
 * Q3 `/latihan-berstruktur/:id/jawab[?scope=spm[&track=bahasa]]` — the structured answer page
 * (M05-T7; FR-M05-96, 97, 137; LS-7, provisional: live never opened it), restyled for v2 (batch B01;
 * not a quiz runner: no per-option UI).
 *
 * - Loads #16 with `scope` / `track`; unknown or non-numeric id → the global 404 page.
 * - Stimulus (plain text, `pre-line`; the image only when M04 supplied a safe URL), one textarea per
 *   sub-question with "[{marks} markah]", the hint, "Lapor" (M04 structured report modal) and "Hantar".
 * - "Hantar" posts #17 with `scope` / `track` and shows the result placeholder (§8.3): marks per
 *   sub-question, "Skema jawapan:" and "Jumlah: {a}/{b} markah". Field errors (422) are listed.
 * - The back link is the `backUrl` of #16 (plain list or the SPM variant list, FR-M05-137).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { ReportQuestionModal } from '@/modules/m04-question-bank'

import { fetchStructuredDetail, submitStructuredAttempt } from '../api/practice'
import type { StructuredAttemptResult } from '../api/types'
import StimulusImage from '../components/structured/StimulusImage.vue'
import { marksLabel, parseVariant, safeImageSrc } from '../components/structured/structured-lib'
import { DsLoadError, DsStickyActions } from '@/ds'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const SUBMIT_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()

// The id is opaque: a string from the API, decimal text for a mock number. An unknown id is a 404
// from the API (both modes), so only an empty param is rejected here.
const id = computed(() => String(route.params.id ?? ''))
const variant = computed(() => parseVariant(route.query))

const { data, error, reload } = useApi(
  (signal) =>
    id.value === ''
      ? Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
      : fetchStructuredDetail(id.value, variant.value, { signal }),
  [id, () => route.query],
)

const notFound = computed(
  () =>
    error.value !== null &&
    ((isApiError(error.value) && error.value.status === 404) ||
      (error.value as { status?: number }).status === 404),
)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const answers = reactive<Record<number, string>>({})
const result = ref<StructuredAttemptResult | null>(null)
const sending = ref(false)
const errors = ref<string[]>([])
const reportOpen = ref(false)

// A new set starts with empty answers and no result.
watch([id, variant], () => {
  for (const k of Object.keys(answers)) delete answers[Number(k)]
  result.value = null
  errors.value = []
})

const image = computed(() => safeImageSrc(data.value?.stimulusImage))
const marksOf = (subId: number) => result.value?.marks.find((m) => m.subQuestionId === subId)
const modelOf = (subId: number) =>
  result.value?.modelAnswers.find((m) => m.subQuestionId === subId)?.text ?? ''

async function submit(): Promise<void> {
  if (!data.value || sending.value || result.value) return
  sending.value = true
  errors.value = []
  try {
    result.value = await submitStructuredAttempt(id.value, {
      answers: data.value.subQuestions.map((s) => ({
        subQuestionId: s.id,
        text: answers[s.id] ?? '',
      })),
      scope: variant.value.scope,
      track: variant.value.track,
    })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  } catch (e) {
    const fields = isApiError(e) ? e.fields : undefined
    errors.value = fields && Object.keys(fields).length > 0 ? Object.values(fields) : [SUBMIT_ERROR]
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="answer-page">
    <h1 v-if="!data" class="sr-only">Soalan Berstruktur</h1>
    <template v-if="data">
      <UButton
        :to="data.backUrl"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-start"
        data-testid="answer-back"
        >Kembali</UButton
      >

      <h1 class="sr-only">Soalan Berstruktur</h1>

      <UCard>
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="soft">{{ data.subjectName }}</UBadge>
            <UBadge color="primary" variant="solid">{{ data.levelName }}</UBadge>
          </div>
          <p
            class="max-w-prose text-body break-words whitespace-pre-line text-highlighted"
            data-testid="answer-stimulus"
          >
            {{ data.stimulus }}
          </p>
          <StimulusImage v-if="image" :src="image" data-testid="answer-image" />
        </div>
      </UCard>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <UCard v-for="s in data.subQuestions" :key="s.id" :data-testid="`sub-${String(s.id)}`">
          <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="text-body break-words text-highlighted">
                <span class="text-label" data-testid="sub-label">{{ s.label }}</span>
                <span class="ms-1 whitespace-pre-line">{{ s.text }}</span>
              </p>
              <span class="text-caption text-muted" data-testid="sub-marks">{{
                marksLabel(s.marks)
              }}</span>
            </div>
            <UTextarea
              v-model="answers[s.id]"
              :rows="6"
              :disabled="result !== null"
              :aria-label="`Jawapan ${s.label}`"
              class="w-full"
              data-testid="sub-answer"
            />

            <UAlert
              v-if="result"
              color="neutral"
              variant="soft"
              data-testid="sub-result"
            >
              <template #title>
                <span data-testid="sub-awarded"
                  >{{ marksOf(s.id)?.awarded ?? 0 }}/{{ marksOf(s.id)?.max ?? s.marks }} markah</span
                >
              </template>
              <template #description>
                <span class="text-default">Skema jawapan:</span>
                <span class="ms-1 break-words whitespace-pre-line" data-testid="sub-model">{{
                  modelOf(s.id)
                }}</span>
              </template>
            </UAlert>
          </div>
        </UCard>

        <UCard v-if="result" data-testid="answer-total-card">
          <p class="text-center text-heading text-highlighted" data-testid="answer-total">
            Jumlah: {{ result.totalAwarded }}/{{ result.totalMax }} markah
          </p>
        </UCard>

        <UAlert
          v-if="errors.length > 0"
          color="error"
          variant="soft"
          icon="i-ph-warning-circle-duotone"
          data-testid="answer-errors"
        >
          <template #description>
            <ul class="flex flex-col gap-1">
              <li v-for="m in errors" :key="m">{{ m }}</li>
            </ul>
          </template>
        </UAlert>

        <p
          v-if="!result"
          class="flex items-start gap-2 text-body text-muted"
          data-testid="answer-hint"
        >
          <UIcon name="i-ph-info-duotone" class="mt-1 size-5 shrink-0" aria-hidden="true" />
          Jawab semua sub-soalan, kemudian klik Hantar.
        </p>

        <DsStickyActions v-if="!result">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-ph-flag-duotone"
            title="Lapor soalan ini"
            class="min-h-11"
            data-testid="answer-report"
            @click="reportOpen = true"
            >Lapor</UButton
          >
          <UButton
            type="submit"
            size="lg"
            :disabled="sending"
            class="min-h-14 flex-1 justify-center md:flex-none md:px-8"
            data-testid="answer-submit"
            >Hantar</UButton
          >
        </DsStickyActions>
      </form>

      <ReportQuestionModal
        v-model:open="reportOpen"
        :question-id="data.id"
        variant="structured"
        source="structured_attempt"
      />
    </template>

    <DsLoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      retry-testid="answer-retry"
      testid="answer-error"
      @retry="reload()"
    />
  </div>
</template>
