<script setup lang="ts">
/**
 * S24 `/guru/soalan/:id/edit` "Edit Soalan" (M10-T6; FR-M10-108, 109; FN-M10-7.4.1–7.4.7, DV-M10-15).
 * Only the question, an image, the difficulty, the MCQ options with the correct one, and the
 * explanation change. "Tahap Kesukaran" offers "Mudah" 2 / "Sederhana" 3 / "Sukar" 4, preselects the
 * saved value and sends nothing when "-- Pilih --" is kept (the server keeps the saved difficulty,
 * INFERRED). "Simpan Perubahan" sends #55 and goes to S23 (INFERRED). A question that is not own or
 * unknown is the standard 404.
 */
import { ArrowLeft, Save } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { useApi, useFlash } from '@/composables'

import { fetchContributedQuestion, updateContributedQuestion } from '../api/guru'
import type { ContributedQuestionDetail, UpdateQuestionRequest } from '../api/types'
import { COPY, EDIT_DIFFICULTIES, OPTION_LETTERS } from '../components/soalan/lib'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()

const { data, error, reload } = useApi(
  (signal) => fetchContributedQuestion(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})

const form = reactive({
  questionText: '',
  difficulty: '',
  options: ['', '', '', ''],
  correct: 0,
  explanation: '',
})
const image = ref<File | null>(null)
const saving = ref(false)
const general = ref<string[]>([])
const fields = ref<Record<string, string>>({})

/** Loads the saved values; a saved 1 or 5 shows "-- Pilih --" (FN-M10-7.4.4). */
function preload(q: ContributedQuestionDetail): void {
  form.questionText = q.questionText
  form.difficulty =
    q.difficultyLevel >= 2 && q.difficultyLevel <= 4 ? String(q.difficultyLevel) : ''
  form.options = Array.from({ length: 4 }, (_, i) => q.options?.[i] ?? '')
  form.correct = q.correctAnswer ?? 0
  form.explanation = q.explanation ?? ''
}
watch(data, (q) => {
  if (q) preload(q)
})

const isMcq = computed(() => data.value?.questionType === 'mcq')
const back = computed(() => `/guru/soalan/${String(props.id)}`)

async function save(): Promise<void> {
  if (saving.value || !data.value) return
  saving.value = true
  general.value = []
  fields.value = {}
  const body: UpdateQuestionRequest = {
    questionText: form.questionText,
    explanation: form.explanation,
  }
  if (form.difficulty !== '') body.difficultyLevel = Number(form.difficulty)
  if (isMcq.value) {
    body.options = form.options.map((optionText, id) => ({ id, optionText }))
    body.correctOptionId = form.correct
  }
  try {
    await updateContributedQuestion(props.id, body, image.value)
    flash.success(COPY.updated)
    await router.push(back.value)
  } catch (err) {
    if (isApiError(err) && err.fields) {
      fields.value = err.fields
      general.value = Object.values(err.fields)
    } else {
      general.value = [isApiError(err) ? err.message : COPY.saveFailed]
    }
  } finally {
    saving.value = false
  }
}

const invalid = (key: string): string | false => key in fields.value && FORM_ERROR_MODIFIER
const CARD = 'min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6'
const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
</script>

<template>
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="soalan-edit-page">
    <div
      v-if="error && !notFound"
      class="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="edit-error"
    >
      <AlertBox :messages="COPY.loadFailed" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
        data-testid="edit-retry"
        @click="reload"
      >
        {{ COPY.retry }}
      </button>
    </div>
    <div
      v-else-if="!data && !notFound"
      class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
    >
      <LoadingSpinner :size="24" />
    </div>

    <template v-else-if="data">
      <RouterLink
        :to="back"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        data-testid="edit-back"
      >
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </RouterLink>

      <form
        method="post"
        enctype="multipart/form-data"
        class="min-w-0 space-y-4"
        data-testid="edit-form"
        @submit.prevent="save"
      >
        <AlertBox :messages="general" data-testid="form-errors" />

        <section :class="CARD" data-testid="edit-source">
          <p class="text-xs font-semibold text-slate-500 uppercase">Sumber Asal</p>
          <p class="mt-1 text-sm break-all text-slate-800">{{ data.source ?? '' }}</p>
        </section>

        <section :class="CARD">
          <label for="e-text" :class="LABEL">Soalan <span class="text-red-500">*</span></label>
          <textarea
            id="e-text"
            v-model="form.questionText"
            name="question_text"
            rows="3"
            required
            :class="[FORM_TEXTAREA_CLASS, invalid('questionText')]"
            data-testid="e-text"
          ></textarea>
          <p v-if="fields.questionText" :class="FORM_ERROR_TEXT_CLASS">{{ fields.questionText }}</p>
        </section>

        <section :class="CARD">
          <label for="e-image" :class="LABEL">Tambah Gambarajah (optional)</label>
          <input
            id="e-image"
            type="file"
            name="image"
            accept="image/jpeg,image/png"
            class="block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:font-semibold file:text-indigo-700"
            data-testid="e-image"
            @change="image = ($event.target as HTMLInputElement).files?.[0] ?? null"
          />
          <p class="mt-1 text-xs text-slate-500">JPG, PNG, max 5MB.</p>
          <p v-if="fields.image" :class="FORM_ERROR_TEXT_CLASS">{{ fields.image }}</p>
        </section>

        <section :class="CARD">
          <label for="e-difficulty" :class="LABEL">Tahap Kesukaran</label>
          <select
            id="e-difficulty"
            v-model="form.difficulty"
            name="difficulty_level"
            :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white', invalid('difficultyLevel')]"
            data-testid="e-difficulty"
          >
            <option value="">-- Pilih --</option>
            <option v-for="d in EDIT_DIFFICULTIES" :key="d.value" :value="String(d.value)">
              {{ d.label }}
            </option>
          </select>
          <p v-if="fields.difficultyLevel" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.difficultyLevel }}
          </p>
        </section>

        <section v-if="isMcq" :class="CARD" data-testid="edit-options">
          <p :class="LABEL">Pilihan Jawapan <span class="text-red-500">*</span></p>
          <div class="min-w-0 space-y-3">
            <div
              v-for="(letter, i) in OPTION_LETTERS"
              :key="letter"
              :class="[
                'flex min-w-0 items-start gap-3 rounded-xl border p-3',
                form.correct === i
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50',
              ]"
            >
              <label class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
                <input
                  v-model="form.correct"
                  type="radio"
                  name="correct_option"
                  :value="i"
                  class="h-5 w-5 accent-indigo-600"
                  :data-testid="`e-correct-${String(i)}`"
                />
              </label>
              <span class="mt-2.5 w-6 shrink-0 text-sm font-bold text-slate-700"
                >{{ letter }})</span
              >
              <textarea
                v-model="form.options[i]"
                :name="`options[${String(i)}][option_text]`"
                rows="2"
                required
                :class="[FORM_INPUT_CLASS, 'min-w-0 flex-1']"
                :data-testid="`e-option-${String(i)}`"
              ></textarea>
            </div>
          </div>
          <p v-if="fields.options" :class="FORM_ERROR_TEXT_CLASS">{{ fields.options }}</p>
          <p v-if="fields.correctOptionId" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.correctOptionId }}
          </p>
          <p class="mt-3 text-xs text-slate-500">Pilih radio button untuk tandakan jawapan betul</p>
        </section>

        <section :class="CARD">
          <label for="e-explanation" :class="LABEL">Penerangan (optional)</label>
          <textarea
            id="e-explanation"
            v-model="form.explanation"
            name="explanation"
            rows="3"
            :class="FORM_TEXTAREA_CLASS"
            data-testid="e-explanation"
          ></textarea>
        </section>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            :disabled="saving"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="form-submit"
          >
            <LoadingSpinner v-if="saving" :size="16" />
            <Save v-else class="h-4 w-4" />
            Simpan Perubahan
          </button>
          <RouterLink
            :to="back"
            class="inline-flex min-h-11 items-center rounded-xl bg-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            data-testid="form-cancel"
          >
            Batal
          </RouterLink>
        </div>
      </form>
    </template>
  </div>
</template>
