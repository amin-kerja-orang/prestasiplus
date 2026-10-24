<script setup lang="ts">
/**
 * S24 `/guru/soalan/:id/edit` "Edit Soalan" (M10-T6; FR-M10-108, 109; FN-M10-7.4.1–7.4.7, DV-M10-15).
 * Only the question, an image, the difficulty, the MCQ options with the correct one, and the
 * explanation change. "Tahap Kesukaran" offers "Mudah" 2 / "Sederhana" 3 / "Sukar" 4, preselects the
 * saved value and sends nothing when "-- Pilih --" is kept (the server keeps the saved difficulty,
 * INFERRED). "Simpan Perubahan" sends #55 and goes to S23 (INFERRED). A question that is not own or
 * unknown is the standard 404.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import {
  DsArt3D,
  DsBackLink,
  DsFileField,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
} from '@/ds'

import { fetchContributedQuestion, updateContributedQuestion } from '../api/guru'
import type { ContributedQuestionDetail, UpdateQuestionRequest } from '../api/types'
import {
  COPY,
  correctItems,
  EDIT_DIFFICULTIES,
  IMAGE_ACCEPT,
  IMAGE_MAX_MB,
  isAcceptedImage,
  isLoadableImage,
  OPTION_LETTERS,
  saveErrorMessage,
} from '../components/soalan/lib'

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
  correct: 0,
  explanation: '',
})
const image = ref<File | null>(null)
/** Set when a picked file is not of an accepted type (the dialog's "All files" bypasses `accept`). */
const imageTypeError = ref('')
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

function pickImage(value: File | File[] | null): void {
  const picked = Array.isArray(value) ? (value[0] ?? null) : value
  if (picked && !isAcceptedImage(picked)) {
    imageTypeError.value = COPY.imageInvalid
    return
  }
  imageTypeError.value = ''
  image.value = picked
}

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
      general.value = [saveErrorMessage(err)]
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
              required
              class="w-full"
              data-testid="e-text"
            />
          </DsFormField>
        </DsPanel>

        <DsPanel>
          <DsFormField
            label="Tambah Gambarajah (optional)"
            name="e-image"
            :help="COPY.imageInvalid"
            :error="imageTypeError || fields.questionImage || fields.image"
          >
            <DsArt3D
              v-if="isLoadableImage(data.questionImage)"
              variant="plain"
              :src="data.questionImage"
              alt="Imej soalan"
              class="mb-2 max-h-40 object-contain"
              data-testid="e-image-current"
            />
            <DsFileField
              :model-value="image"
              name="image"
              :accept="IMAGE_ACCEPT"
              :max-size-mb="IMAGE_MAX_MB"
              data-testid="e-image"
              @update:model-value="pickImage"
            />
          </DsFormField>
        </DsPanel>

        <DsPanel>
          <DsFormField label="Tahap Kesukaran" name="e-difficulty" :error="fields.difficultyLevel">
            <DsNativeSelect
              id="e-difficulty"
              v-model="form.difficulty"
              name="difficulty_level"
              data-testid="e-difficulty"
            >
              <option value="">-- Pilih --</option>
              <option v-for="d in EDIT_DIFFICULTIES" :key="d.value" :value="String(d.value)">
                {{ d.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>
        </DsPanel>

        <DsPanel v-if="isMcq" data-testid="edit-options">
          <p class="mb-3 text-label text-highlighted">Pilihan Jawapan *</p>
          <URadioGroup
            id="e-correct"
            v-model="form.correct"
            legend="Jawapan betul"
            orientation="horizontal"
            :items="CORRECT_ITEMS"
            class="mb-3"
            data-testid="e-correct"
          />
          <div class="flex min-w-0 flex-col gap-3">
            <DsPanel v-for="(letter, i) in OPTION_LETTERS" :key="letter" tone="inset">
<div class="flex min-w-0 items-start gap-3">
              <span class="mt-3 w-6 shrink-0 text-label text-highlighted">{{ letter }})</span>
              <UTextarea
                v-model="form.options[i]"
                :name="`options[${String(i)}][option_text]`"
                :rows="2"
                required
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
          <DsFormField label="Penerangan (optional)" name="e-explanation">
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
            :disabled="saving"
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
