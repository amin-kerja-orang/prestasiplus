<script setup lang="ts">
/**
 * Q3 `/latihan-berstruktur/:id/jawab[?scope=spm[&track=bahasa]]` — the structured answer page
 * (M05-T7; FR-M05-96, 97, 137; LS-7, provisional: live never opened it).
 *
 * - Loads #16 with `scope` / `track`; unknown or non-numeric id → the global 404 page.
 * - Stimulus (plain text, `pre-line`; the image only when M04 supplied a safe URL), one textarea per
 *   sub-question with "[{marks} markah]", the hint, "Lapor" (M04 structured report modal) and "Hantar".
 * - "Hantar" posts #17 with `scope` / `track` and shows the result placeholder (§8.3): marks per
 *   sub-question, "Skema jawapan:" and "Jumlah: {a}/{b} markah". Field errors (422) are listed.
 * - The back link is the `backUrl` of #16 (plain list or the SPM variant list, FR-M05-137).
 */
import { ArrowLeft, Flag, Info } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { ReportQuestionModal } from '@/modules/m04-question-bank'

import { fetchStructuredDetail, submitStructuredAttempt } from '../api/practice'
import type { StructuredAttemptResult } from '../api/types'
import { marksLabel, parseVariant, safeImageSrc } from '../components/structured/structured-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const SUBMIT_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()

const id = computed(() => {
  const raw = String(route.params.id ?? '')
  return /^\d+$/.test(raw) ? Number(raw) : NaN
})
const variant = computed(() => parseVariant(route.query))

const { data, error, reload } = useApi(
  (signal) =>
    Number.isNaN(id.value)
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
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="answer-page">
    <div v-if="data" class="mx-auto max-w-3xl">
      <RouterLink
        :to="data.backUrl"
        class="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="answer-back"
      >
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </RouterLink>

      <div class="mb-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{{
            data.subjectName
          }}</span>
          <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{{
            data.levelName
          }}</span>
        </div>
        <p
          class="text-sm break-words whitespace-pre-line text-slate-800 sm:text-base"
          data-testid="answer-stimulus"
        >
          {{ data.stimulus }}
        </p>
        <img
          v-if="image"
          :src="image"
          alt=""
          class="mt-4 max-h-96 max-w-full rounded-lg"
          data-testid="answer-image"
        />
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div
          v-for="s in data.subQuestions"
          :key="s.id"
          class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
          :data-testid="`sub-${String(s.id)}`"
        >
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-sm font-bold break-words text-slate-800">
              <span data-testid="sub-label">{{ s.label }}</span>
              <span class="ml-1 font-normal whitespace-pre-line">{{ s.text }}</span>
            </p>
            <span class="text-xs font-semibold text-slate-400" data-testid="sub-marks">{{
              marksLabel(s.marks)
            }}</span>
          </div>
          <textarea
            v-model="answers[s.id]"
            rows="4"
            :disabled="result !== null"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-50"
            data-testid="sub-answer"
          ></textarea>

          <div
            v-if="result"
            class="mt-3 rounded-lg bg-slate-50 p-3 text-sm"
            data-testid="sub-result"
          >
            <p class="font-bold text-slate-800" data-testid="sub-awarded">
              {{ marksOf(s.id)?.awarded ?? 0 }}/{{ marksOf(s.id)?.max ?? s.marks }} markah
            </p>
            <p class="mt-1 text-slate-600">
              <span class="font-semibold">Skema jawapan:</span>
              <span class="ml-1 break-words whitespace-pre-line" data-testid="sub-model">{{
                modelOf(s.id)
              }}</span>
            </p>
          </div>
        </div>

        <p
          v-if="result"
          class="rounded-2xl bg-white p-4 text-center text-lg font-extrabold text-slate-900 shadow-sm"
          data-testid="answer-total"
        >
          Jumlah: {{ result.totalAwarded }}/{{ result.totalMax }} markah
        </p>

        <AlertBox v-if="errors.length > 0" :messages="errors" data-testid="answer-errors" />

        <p
          v-if="!result"
          class="flex items-start gap-2 text-sm text-slate-500"
          data-testid="answer-hint"
        >
          <Info class="mt-0.5 h-4 w-4 shrink-0" />
          Jawab semua sub-soalan, kemudian klik Hantar.
        </p>

        <div v-if="!result" class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            title="Lapor soalan ini"
            class="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            data-testid="answer-report"
            @click="reportOpen = true"
          >
            <Flag class="h-3.5 w-3.5" />
            Lapor
          </button>
          <button
            type="submit"
            :disabled="sending"
            class="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-600 px-8 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60"
            data-testid="answer-submit"
          >
            Hantar
          </button>
        </div>
      </form>

      <ReportQuestionModal
        v-model:open="reportOpen"
        :question-id="data.id"
        variant="structured"
        source="structured_attempt"
      />
    </div>

    <div
      v-else-if="error && !notFound"
      class="mx-auto max-w-xl space-y-3"
      data-testid="answer-error"
    >
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
        data-testid="answer-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>
  </div>
</template>
