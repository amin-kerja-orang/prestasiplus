<script setup lang="ts">
/**
 * Q4 `/spm-mock/:id` in-exam page (M06-T4; FR-M06-72/73, BR-M06-23/26): PROVISIONAL, UNVERIFIED (L-8).
 *
 * A neutral placeholder: the title "{Subjek} · Paper {n}", a timer element counting up from the mock's
 * `createdAt` (direction, time limit and auto-submit are not specified, URS OQ-M06-05; there is no
 * pause control), every item with an answer input (Paper 1 objective: option radios; Paper 2: a
 * textarea) and one submit button with PROPOSED COPY "Hantar". Submit calls #15 and goes to S12.
 * A submitted mock redirects to S12; an unknown or foreign id is the global 404.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox } from '@/components/feedback'
import { FORM_TEXTAREA_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { clock } from '@/lib/time'

import { fetchMock, submitMock } from '../api'
import { elapsedLabel, optionLetter } from '../components/mock-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const SUBMIT_ERROR = 'Gagal menghantar jawapan. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))
const { data, error, loading, reload } = useApi((signal) => fetchMock(id.value, { signal }), id)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)
watch(
  data,
  (d) => {
    if (d?.status === 'submitted') void router.replace(`/spm-mock/${String(d.id)}/result`)
  },
  { immediate: true },
)

const answers = reactive<Record<number, string>>({})
const submitting = ref(false)
const submitError = ref<string | null>(null)

const nowMs = ref(clock.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = clock.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
})
const elapsed = computed(() =>
  data.value ? elapsedLabel(data.value.createdAt, nowMs.value) : '00:00',
)

async function submit(): Promise<void> {
  if (!data.value || submitting.value) return
  submitting.value = true
  submitError.value = null
  try {
    await submitMock(
      data.value.id,
      data.value.items.map((it) => ({ no: it.no, answer: answers[it.no] ?? '' })),
    )
    await router.push(`/spm-mock/${String(data.value.id)}/result`)
  } catch {
    submitError.value = SUBMIT_ERROR
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="px-2 py-4 sm:px-6 sm:py-8" data-testid="run-page" data-provisional="true">
    <div class="mx-auto max-w-3xl space-y-4">
      <div v-if="loading && !data" class="space-y-2" data-testid="run-skeleton">
        <div v-for="n in 3" :key="n" class="h-20 animate-pulse rounded-xl bg-slate-100"></div>
      </div>
      <div v-else-if="error && !notFound" class="space-y-3" data-testid="run-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
          data-testid="run-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>

      <form
        v-else-if="data && data.status === 'in_progress'"
        class="space-y-4"
        data-testid="run-form"
        @submit.prevent="submit"
      >
        <header
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        >
          <h1
            class="font-heading text-lg font-bold break-words text-slate-900"
            data-testid="run-title"
          >
            {{ data.subject }} · Paper {{ data.paperNumber }}
          </h1>
          <p
            class="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-bold text-slate-800"
            data-testid="mock-timer"
          >
            {{ elapsed }}
          </p>
        </header>

        <AlertBox v-if="submitError" :messages="submitError" data-testid="run-submit-error" />

        <ol class="space-y-3" data-testid="run-items">
          <li
            v-for="it in data.items"
            :key="it.no"
            class="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
            :data-testid="`run-item-${String(it.no)}`"
          >
            <p class="text-sm font-semibold break-words text-slate-900">
              Soalan {{ it.no }}
              <span class="text-xs font-normal text-slate-500">({{ it.maxMarks }} markah)</span>
            </p>
            <p class="mt-1 text-sm break-words whitespace-pre-line text-slate-700">{{ it.text }}</p>
            <fieldset v-if="it.options" class="mt-3 space-y-1">
              <legend class="sr-only">Jawapan soalan {{ it.no }}</legend>
              <label
                v-for="(opt, i) in it.options"
                :key="i"
                class="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  v-model="answers[it.no]"
                  type="radio"
                  :name="`answer-${String(it.no)}`"
                  :value="optionLetter(i)"
                  class="mt-0.5 h-4 w-4 shrink-0"
                  data-testid="run-option"
                />
                <span class="min-w-0 break-words"
                  ><b>{{ optionLetter(i) }}.</b> {{ opt }}</span
                >
              </label>
            </fieldset>
            <textarea
              v-else
              v-model="answers[it.no]"
              rows="4"
              :aria-label="`Jawapan soalan ${String(it.no)}`"
              :class="FORM_TEXTAREA_CLASS"
              class="mt-3"
              data-testid="run-answer"
            ></textarea>
          </li>
        </ol>

        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-700 disabled:opacity-60 sm:w-auto"
          data-testid="run-submit"
        >
          Hantar
        </button>
      </form>
    </div>
  </div>
</template>
