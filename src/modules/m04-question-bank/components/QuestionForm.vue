<script setup lang="ts">
/**
 * The form of S2 `/admin/questions/create` and S4 `/admin/questions/:id/edit` (M04-T4; FR-M04-17..36,
 * 48..52). Native HTML5 validation only (no `novalidate`): Subjek, Tahap Pendidikan, Tahap Kesukaran
 * and Teks Soalan are `required`, and for MCQ the four options and the correct radio (FR-M04-22).
 * Server messages (SRS §5, UNVERIFIED COPY) show in red under their field, the values are kept.
 *
 * The difficulty tiles, the Betul / Salah tiles and the correct-answer radios are `URadioGroup`s. The
 * browser cannot block an empty group there, so `submit` checks the difficulty itself and shows the
 * message the server would send.
 *
 * Create: "Jenis Soalan" switches the answer card with `v-show` semantics (hidden cards keep their
 * values, every field is posted) and the Teks Soalan textarea has the Arabic / Jawi key panel. Edit: no
 * type select (the saved type's card is shown, DV-M04-05), no keyboard, saved images and DSKP preloaded.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsRtlScope } from '@/ds'

import type { EducationLevelLookup, SubjectLookup } from '../api/lookups'
import type { QuestionDetail, QuestionInputBody } from '../api/questions'
import { backspaceAtCaret, insertAtCaret, type KeyboardMode } from '../lib/arabic-keyboard'
import { DIFFICULTY_LABELS } from '../lib/question-list'
import {
  buildBody,
  emptyValues,
  OPTION_LETTERS,
  QUESTION_TYPE_OPTIONS,
  valuesFromQuestion,
  type FormErrors,
  type QuestionFormValues,
} from '../lib/question-form'
import ArabicKeyboardPanel from './ArabicKeyboardPanel.vue'
import DskpTagging from './DskpTagging.vue'
import QuestionImagePicker from './QuestionImagePicker.vue'

const props = defineProps<{
  mode: 'create' | 'edit'
  initial?: QuestionDetail | null
  subjects: readonly SubjectLookup[]
  levels: readonly EducationLevelLookup[]
  saving: boolean
  errors: FormErrors
  cancelTo: string
}>()

const emit = defineEmits<{ submit: [body: QuestionInputBody] }>()

const edit = computed(() => props.mode === 'edit')
const values = reactive<QuestionFormValues>(
  props.initial ? valuesFromQuestion(props.initial) : emptyValues(),
)
const spId = ref(props.initial?.dskp ? String(props.initial.dskp.sp.id) : '')

const isMcq = computed(() => values.questionType === 'mcq')
const isShortOrFill = computed(
  () => values.questionType === 'short_answer' || values.questionType === 'fill_blank',
)

/** The required difficulty group, worded as the server does (SRS §5). */
const DIFFICULTY_MISSING = 'Sila pilih tahap kesukaran.'
const localErrors = ref<Record<string, string>>({})

// Server errors: red text under the field; scroll to the first one.
const formEl = ref<HTMLFormElement | null>(null)
const err = (key: string): string | undefined => localErrors.value[key] ?? props.errors.fields[key]

async function scrollToError(): Promise<void> {
  await nextTick()
  const target = formEl.value?.querySelector('[data-testid="field-error"]') ?? formEl.value
  target?.scrollIntoView?.({ block: 'center' })
}

function submit(): void {
  if (props.saving) return
  localErrors.value = {}
  if (values.difficulty === '') {
    localErrors.value = { difficultyLevel: DIFFICULTY_MISSING }
    void scrollToError()
    return
  }
  emit('submit', buildBody(values, spId.value, props.mode))
}

watch(
  () => props.errors,
  () => {
    localErrors.value = {}
    void scrollToError()
  },
)

// Arabic / Jawi keyboard (create only).
const textareaCmp = ref<{ textareaRef?: HTMLTextAreaElement | null } | null>(null)
const textarea = computed<HTMLTextAreaElement | null>(() => textareaCmp.value?.textareaRef ?? null)
const keyboardOpen = ref(false)
const keyboardMode = ref<KeyboardMode>('arab')
const rtl = ref(false)

function toggleKeyboard(): void {
  keyboardOpen.value = !keyboardOpen.value
  if (keyboardOpen.value) {
    rtl.value = true
    keyboardMode.value = 'arab'
  }
}

async function applyEdit(
  compute: (v: string, s: number, e: number) => { value: string; caret: number },
) {
  const el = textarea.value
  const start = el?.selectionStart ?? values.questionText.length
  const end = el?.selectionEnd ?? start
  const next = compute(values.questionText, start, end)
  values.questionText = next.value
  await nextTick()
  if (el) {
    el.value = next.value
    el.setSelectionRange(next.caret, next.caret)
  }
}

const insertKey = (text: string) => applyEdit((v, s, e) => insertAtCaret(v, s, e, text))
const backspaceKey = () => applyEdit((v, s, e) => backspaceAtCaret(v, s, e))

const DIFFICULTY_ITEMS = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: DIFFICULTY_LABELS[n] ?? String(n),
}))
const TF_ITEMS = [
  { value: 'true', label: 'Betul', icon: 'i-ph-check-circle' },
  { value: 'false', label: 'Salah', icon: 'i-ph-x-circle' },
]
/** One single-radio group per option row; the shared `correctAnswer` value keeps them exclusive. */
const correctItems = (i: number, letter: string) => [
  { value: String(i), label: `Jawapan betul ${letter}` },
]
</script>

<template>
  <form
    ref="formEl"
    method="post"
    enctype="multipart/form-data"
    class="flex min-w-0 flex-col gap-4 md:gap-6"
    data-testid="question-form"
    @submit.prevent="submit"
  >
    <UAlert
      v-if="errors.general.length > 0"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      role="alert"
      data-testid="question-form-alert"
    >
      <template #description>
        <p v-for="(line, i) in errors.general" :key="i">{{ line }}</p>
      </template>
    </UAlert>

    <div class="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-4 md:gap-6">
        <!-- Section "Maklumat Soalan" -->
        <DsFormSection title="Maklumat Soalan" icon="question" data-testid="info-card">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DsFormField
              v-slot="{ id, describedby, invalid }"
              native
              for="q-subject"
              label="Subjek"
              required
              :error="err('subjectId')"
            >
              <DsNativeSelect
                :id="id"
                v-model="values.subjectId"
                name="subject_id"
                required
                :invalid="invalid"
                :aria-describedby="describedby"
                data-testid="q-subject"
              >
                <option value="">Pilih Subjek</option>
                <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
              </DsNativeSelect>
            </DsFormField>

            <DsFormField
              v-slot="{ id, describedby, invalid }"
              native
              for="q-level"
              label="Tahap Pendidikan"
              required
              :error="err('educationLevelId')"
            >
              <DsNativeSelect
                :id="id"
                v-model="values.educationLevelId"
                name="education_level_id"
                required
                :invalid="invalid"
                :aria-describedby="describedby"
                data-testid="q-level"
              >
                <option value="">Pilih Tahap Pendidikan</option>
                <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
              </DsNativeSelect>
            </DsFormField>
          </div>

          <div class="min-w-0">
            <DskpTagging
              v-model:sp-id="spId"
              :subject-id="values.subjectId"
              :level-id="values.educationLevelId"
              :initial="initial?.dskp ?? null"
              :edit="edit"
            />
            <p v-if="err('dskpSpId')" class="mt-1 text-caption text-error" data-testid="field-error">
              {{ err('dskpSpId') }}
            </p>
          </div>

          <DsFormField label="Tahap Kesukaran" required :error="err('difficultyLevel')">
            <URadioGroup
              id="q-difficulty"
              v-model="values.difficulty"
              name="difficulty_level"
              variant="card"
              color="info"
              indicator="hidden"
              :items="DIFFICULTY_ITEMS"
              :ui="{
                fieldset: 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5',
              }"
              class="w-full"
            >
              <template #label="{ item }">
                <span class="flex w-full flex-col items-center gap-1 text-center">
                  <span class="flex flex-wrap justify-center gap-1" aria-hidden="true">
                    <UIcon
                      v-for="s in Number(item.value)"
                      :key="s"
                      name="i-ph-star-fill"
                      class="size-4"
                    />
                  </span>
                  <span class="text-caption">{{ item.label }}</span>
                </span>
              </template>
            </URadioGroup>
          </DsFormField>

          <DsFormField
            v-if="!edit"
            v-slot="{ id, describedby, invalid }"
            native
            for="q-type"
            label="Jenis Soalan"
            required
            :error="err('questionType')"
          >
            <DsNativeSelect
              :id="id"
              v-model="values.questionType"
              name="question_type"
              required
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-type"
            >
              <option v-for="t in QUESTION_TYPE_OPTIONS" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <div class="min-w-0">
            <DsFormField
              v-slot="{ id, describedby, invalid }"
              native
              for="q-text"
              label="Teks Soalan"
              required
              hint="Minimum 10 aksara"
              :error="err('questionText')"
            >
              <DsRtlScope :rtl="rtl">
                <UTextarea
                  :id="id"
                  ref="textareaCmp"
                  v-model="values.questionText"
                  name="question_text"
                  :rows="4"
                  required
                  placeholder="Masukkan teks soalan di sini..."
                  :dir="rtl ? 'rtl' : undefined"
                  :color="invalid ? 'error' : undefined"
                  :aria-invalid="invalid ? 'true' : undefined"
                  :aria-describedby="describedby"
                  class="w-full"
                  data-testid="q-text"
                />
              </DsRtlScope>
            </DsFormField>
            <UButton
              v-if="!edit"
              type="button"
              title="Papan kekunci Arab / Jawi"
              aria-label="Papan kekunci Arab / Jawi"
              :color="keyboardOpen ? 'primary' : 'neutral'"
              :variant="keyboardOpen ? 'solid' : 'soft'"
              icon="i-ph-keyboard"
              class="mt-2 size-11 justify-center"
              data-testid="vkb-toggle"
              @mousedown.prevent
              @click="toggleKeyboard"
            />
            <ArabicKeyboardPanel
              v-if="!edit && keyboardOpen"
              v-model:mode="keyboardMode"
              :anchor="textarea"
              @insert="insertKey"
              @backspace="backspaceKey"
              @close="keyboardOpen = false"
            />
          </div>

          <DsFormField label="Gambar Soalan (Pilihan)" :error="err('questionImage')">
            <QuestionImagePicker
              v-model:file="values.questionImage"
              v-model:removed="values.removeQuestionImage"
              variant="zone"
              :saved="initial?.questionImage ?? null"
              :edit="edit"
              testid="q-image"
            />
          </DsFormField>
        </DsFormSection>
      </div>

      <div class="flex min-w-0 flex-col gap-4 md:gap-6">
        <!-- Section MCQ -->
        <DsFormSection
          v-show="isMcq"
          title="Pilihan Jawapan"
          icon="list-checks"
          data-testid="mcq-card"
        >
          <div class="flex min-w-0 flex-col gap-3">
            <div
              v-for="(letter, i) in OPTION_LETTERS"
              :key="letter"
              class="flex flex-col gap-2 bg-soft p-3 sm:p-4"
            >
              <div class="flex items-end gap-3">
                <URadioGroup
                  :id="`q-correct-${String(i)}`"
                  :model-value="values.correctAnswer"
                  name="correct_answer"
                  :items="correctItems(i, letter)"
                  :ui="{ label: 'sr-only', root: 'shrink-0 pb-3' }"
                  @update:model-value="values.correctAnswer = String($event)"
                />
                <DsFormField
                  v-slot="{ id }"
                  class="flex-1"
                  native
                  :for="`q-option-${String(i)}`"
                  :label="`Pilihan ${letter}`"
                  :required="isMcq"
                >
                  <UInput
                    :id="id"
                    v-model="values.options[i]"
                    type="text"
                    name="options[]"
                    :required="isMcq"
                    :placeholder="`Masukkan pilihan ${letter}`"
                    class="w-full"
                    :data-testid="`q-option-${String(i)}`"
                  />
                </DsFormField>
              </div>
              <div class="flex min-w-0 flex-col gap-2">
                <QuestionImagePicker
                  :file="values.optionImages[i] ?? null"
                  :removed="values.removeOptionImage[i] ?? false"
                  variant="chip"
                  :saved="initial?.optionImages[i] ?? null"
                  :edit="edit"
                  :testid="`q-option-image-${String(i)}`"
                  @update:file="values.optionImages[i] = $event"
                  @update:removed="values.removeOptionImage[i] = $event"
                />
                <p
                  v-if="err(`optionImages.${String(i)}`)"
                  class="text-caption text-error"
                  data-testid="field-error"
                >
                  {{ err(`optionImages.${String(i)}`) }}
                </p>
              </div>
            </div>
          </div>
          <p v-if="err('options')" class="text-caption text-error" data-testid="field-error">
            {{ err('options') }}
          </p>
          <p v-if="err('correctAnswer')" class="text-caption text-error" data-testid="field-error">
            {{ err('correctAnswer') }}
          </p>
          <p class="flex items-start gap-2 text-caption text-muted">
            <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" />
            <span>
              <strong>Nota:</strong> Pilih butang radio di sebelah pilihan yang merupakan jawapan
              yang betul.
            </span>
          </p>
        </DsFormSection>

        <!-- Section true / false -->
        <DsFormSection
          v-show="values.questionType === 'true_false'"
          title="Jawapan Betul / Salah"
          icon="i-ph-checks"
          data-testid="tf-card"
        >
          <URadioGroup
            id="q-tf"
            v-model="values.tfAnswer"
            name="tf_answer"
            variant="card"
            color="info"
            indicator="hidden"
            :items="TF_ITEMS"
            :ui="{ fieldset: 'grid grid-cols-2 gap-3' }"
            class="w-full"
          >
            <template #label="{ item }">
              <span class="flex w-full items-center justify-center gap-2">
                <UIcon :name="(item as (typeof TF_ITEMS)[number]).icon" class="size-5" />
                {{ item.label }}
              </span>
            </template>
          </URadioGroup>
          <p v-if="err('tfAnswer')" class="text-caption text-error" data-testid="field-error">
            {{ err('tfAnswer') }}
          </p>
        </DsFormSection>

        <!-- Section short answer / fill blank -->
        <DsFormSection
          v-show="isShortOrFill"
          :title="values.questionType === 'fill_blank' ? 'Jawapan Isi Tempat Kosong' : 'Jawapan Pendek'"
          icon="pen-nib"
          data-testid="short-card"
        >
          <DsFormField
            v-slot="{ id, invalid }"
            native
            for="q-answer-text"
            label="Jawapan Betul"
            required
            :error="err('correctAnswerText')"
          >
            <UInput
              :id="id"
              v-model="values.correctAnswerText"
              type="text"
              name="correct_answer_text"
              placeholder="Masukkan jawapan betul"
              :color="invalid ? 'error' : undefined"
              class="w-full"
              data-testid="q-answer-text"
            />
          </DsFormField>
          <DsFormField
            v-slot="{ id }"
            native
            for="q-alt"
            label="Jawapan Alternatif (pisahkan dengan koma)"
            hint="Jawapan lain yang juga diterima"
          >
            <UInput
              :id="id"
              v-model="values.altAnswers"
              type="text"
              name="alt_answers"
              placeholder="cth: jawapan1, jawapan2"
              class="w-full"
              data-testid="q-alt"
            />
          </DsFormField>
        </DsFormSection>

        <!-- Section essay -->
        <DsFormSection
          v-show="values.questionType === 'essay'"
          title="Jawapan Contoh (Esei)"
          icon="file-text"
          data-testid="essay-card"
        >
          <DsFormField
            v-slot="{ id }"
            native
            for="q-model"
            label="Jawapan Model (pilihan — ditunjukkan sebagai rujukan)"
          >
            <UTextarea
              :id="id"
              v-model="values.modelAnswer"
              name="model_answer"
              :rows="6"
              placeholder="Tulis jawapan contoh di sini..."
              class="w-full"
              data-testid="q-model"
            />
          </DsFormField>
        </DsFormSection>

        <!-- Section "Maklumat Tambahan" -->
        <DsFormSection title="Maklumat Tambahan" icon="info" data-testid="extra-card">
          <DsFormField
            v-slot="{ id }"
            native
            for="q-explanation"
            label="Penjelasan"
            hint="Penjelasan akan ditunjukkan kepada pelajar selepas menjawab"
          >
            <UTextarea
              :id="id"
              v-model="values.explanation"
              name="explanation"
              :rows="3"
              placeholder="Penjelasan untuk jawapan (pilihan)"
              class="w-full"
              data-testid="q-explanation"
            />
          </DsFormField>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DsFormField
              v-slot="{ id, describedby, invalid }"
              native
              for="q-language"
              label="Bahasa"
              :error="err('language')"
            >
              <DsNativeSelect
                :id="id"
                v-model="values.language"
                name="language"
                :invalid="invalid"
                :aria-describedby="describedby"
                data-testid="q-language"
              >
                <option value="bm">Bahasa Melayu</option>
                <option value="en">English</option>
              </DsNativeSelect>
            </DsFormField>
            <DsFormField
              v-slot="{ id, invalid }"
              native
              for="q-points"
              label="Nilai Mata"
              hint="Mata yang diperoleh jika jawapan betul"
              :error="err('pointsValue')"
            >
              <UInput
                :id="id"
                v-model="values.pointsValue"
                type="number"
                name="points_value"
                min="1"
                :color="invalid ? 'error' : undefined"
                class="w-full"
                data-testid="q-points"
              />
            </DsFormField>
          </div>
        </DsFormSection>
      </div>
    </div>

    <DsFormBar
      :cancel-to="cancelTo"
      :saving="saving"
      :submit-label="edit ? 'Kemaskini Soalan' : 'Simpan Soalan'"
    />
  </form>
</template>
