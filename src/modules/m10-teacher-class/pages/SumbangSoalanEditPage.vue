<script setup lang="ts">
/**
 * S24 `/guru/soalan/:id/edit` "Edit Soalan" (M10-T6; FR-M10-108, 109; FR-GUR-44-6; AC-GUR-44-6). Only the
 * question, the difficulty, the four options with the correct one, and the explanation change.
 * "Kesukaran *" offers the five star options, preselects the SAVED value (1 to 5) and the form preselects the
 * SAVED correct answer; the saved TP is shown read-only. Missing fields show the 44-F1 BM texts and nothing is
 * sent. "Simpan Perubahan" sends #55 and goes to S23 (INFERRED). A question that is not own or unknown is the
 * standard 404.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsFormField, DsLoadError, DsNativeSelect, DsPage, DsPanel } from '@/ds'

import { fetchContributedQuestion, updateContributedQuestion } from '../api/guru'
import type { ContributedQuestionDetail, UpdateQuestionRequest } from '../api/types'
import { FORM_MESSAGES } from '../components/soalan/form'
import { COPY, correctItems, DIFFICULTY_OPTIONS, OPTION_LETTERS } from '../components/soalan/lib'
import { moduleMessage } from '../lib/generic-server-text'

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

const CORRECT_ITEMS = correctItems()

const form = reactive({
  questionText: '',
  difficulty: '',
  options: ['', '', '', ''],
  correct: null as number | null,
  explanation: '',
})
const saving = ref(false)
const general = ref<string[]>([])
const fields = ref<Record<string, string>>({})

/** Loads the saved values: the saved Kesukaran (1 to 5) and the saved correct answer are preselected. */
function preload(q: ContributedQuestionDetail): void {
  form.questionText = q.questionText
  form.difficulty =
    q.difficultyLevel >= 1 && q.difficultyLevel <= 5 ? String(q.difficultyLevel) : ''
  form.options = Array.from({ length: 4 }, (_, i) => q.options?.[i] ?? '')
  form.correct = q.correctAnswer
  form.explanation = q.explanation ?? ''
}
watch(data, (q) => {
  if (q) preload(q)
})

const back = computed(() => `/guru/soalan/${String(props.id)}`)

/** The 44-F1 texts of the fields this form edits (`{}` = valid). */
function check(): Record<string, string> {
  const e: Record<string, string> = {}
  const text = form.questionText.trim()
  if (text === '') e.questionText = FORM_MESSAGES.text
  else if ([...text].length > 2000) e.questionText = FORM_MESSAGES.textLong
  if (form.difficulty === '') e.difficultyLevel = FORM_MESSAGES.difficulty
  for (const [i, letter] of OPTION_LETTERS.entries()) {
    const option = (form.options[i] ?? '').trim()
    if (option === '') e.options ??= FORM_MESSAGES.option(letter)
    else if ([...option].length > 500) e.options ??= FORM_MESSAGES.optionLong(letter)
  }
  if (form.correct === null) e.correctOptionId = FORM_MESSAGES.correct
  if ([...form.explanation].length > 2000) e.explanation = FORM_MESSAGES.explanationLong
  return e
}

async function save(): Promise<void> {
  if (saving.value || !data.value) return
  general.value = []
  const found = check()
  fields.value = found
  if (Object.keys(found).length > 0) return
  saving.value = true
  const body: UpdateQuestionRequest = {
    questionText: form.questionText,
    explanation: form.explanation,
    difficultyLevel: Number(form.difficulty),
    options: form.options.map((optionText, id) => ({ id, optionText })),
    correctOptionId: form.correct as number,
  }
  try {
    await updateContributedQuestion(props.id, body)
    flash.success(COPY.updated)
    await router.push(back.value)
  } catch (err) {
    if (isApiError(err) && err.fields) {
      fields.value = err.fields
      general.value = Object.values(err.fields)
    } else {
      general.value = [moduleMessage(err) ?? COPY.saveFailed]
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="soalan-edit-page">
    <DsLoadError
      v-if="error && !notFound"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="edit-error"
      @retry="reload"
    />
    <div v-else-if="!data && !notFound" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <template v-else-if="data">
      <DsBackLink :to="back" data-testid="edit-back" />

      <form
        method="post"
        enctype="multipart/form-data"
        class="flex min-w-0 flex-col gap-4"
        novalidate
        data-testid="edit-form"
        @submit.prevent="save"
      >
        <UAlert
          v-if="general.length"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle-duotone"
          role="alert"
          data-testid="form-errors"
        >
          <template #description>
            <p v-for="(m, i) in general" :key="i">{{ m }}</p>
          </template>
        </UAlert>

        <DsPanel data-testid="edit-source">
          <p class="text-overline text-muted">Sumber Asal</p>
          <p class="mt-1 text-body break-all text-default">{{ data.source ?? '' }}</p>
        </DsPanel>

        <DsPanel>
          <DsFormField label="Soalan *" name="e-text" :error="fields.questionText">
            <UTextarea
              id="e-text"
              v-model="form.questionText"
              name="question_text"
              :rows="3"
              class="w-full"
              data-testid="e-text"
            />
          </DsFormField>
        </DsPanel>

        <DsPanel>
          <DsFormField label="Kesukaran *" name="e-difficulty" :error="fields.difficultyLevel">
            <DsNativeSelect
              id="e-difficulty"
              v-model="form.difficulty"
              name="difficulty_level"
              data-testid="e-difficulty"
            >
              <option value="">-- Pilih kesukaran --</option>
              <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="String(d.value)">
                {{ d.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>
          <p v-if="data.tp !== null" class="mt-3 text-body text-muted" data-testid="e-tp">
            Tahap Penguasaan (TP): <strong class="text-highlighted">{{ data.tp }}</strong>
          </p>
        </DsPanel>

        <DsPanel data-testid="edit-options">
          <p class="mb-3 text-label text-highlighted">Pilihan Jawapan *</p>
          <URadioGroup
            id="e-correct"
            :model-value="form.correct ?? undefined"
            legend="Jawapan betul"
            orientation="horizontal"
            :items="CORRECT_ITEMS"
            class="mb-3"
            data-testid="e-correct"
            @update:model-value="form.correct = Number($event)"
          />
          <div class="flex min-w-0 flex-col gap-3">
            <DsPanel v-for="(letter, i) in OPTION_LETTERS" :key="letter" tone="inset">
              <div class="flex min-w-0 items-start gap-3">
                <span class="mt-3 w-6 shrink-0 text-label text-highlighted">{{ letter }})</span>
                <UTextarea
                  v-model="form.options[i]"
                  :name="`options[${String(i)}][option_text]`"
                  :rows="2"
                  class="min-w-0 flex-1"
                  :aria-label="`Pilihan ${letter}`"
                  :data-testid="`e-option-${String(i)}`"
                />
                <UBadge
                  v-if="form.correct === i"
                  color="success"
                  variant="subtle"
                  icon="i-ph-check-circle-duotone"
                  class="mt-2 shrink-0"
                  >Betul</UBadge
                >
              </div>
            </DsPanel>
          </div>
          <p v-if="fields.options" class="mt-2 text-caption text-error">{{ fields.options }}</p>
          <p v-if="fields.correctOptionId" class="mt-2 text-caption text-error">
            {{ fields.correctOptionId }}
          </p>
          <p class="mt-3 text-caption text-muted">
            Pilih radio button untuk tandakan jawapan betul
          </p>
        </DsPanel>

        <DsPanel>
          <DsFormField
            label="Penerangan (optional)"
            name="e-explanation"
            :error="fields.explanation"
          >
            <UTextarea
              id="e-explanation"
              v-model="form.explanation"
              name="explanation"
              :rows="3"
              class="w-full"
              data-testid="e-explanation"
            />
          </DsFormField>
        </DsPanel>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            type="submit"
            :loading="saving"
            :disabled="saving"
            :icon="saving ? undefined : 'i-ph-floppy-disk-duotone'"
            class="min-h-11"
            data-testid="form-submit"
            >Simpan Perubahan</UButton
          >
          <UButton
            :to="back"
            color="neutral"
            variant="soft"
            class="min-h-11"
            data-testid="form-cancel"
            >Batal</UButton
          >
        </div>
      </form>
    </template>
  </DsPage>
</template>
