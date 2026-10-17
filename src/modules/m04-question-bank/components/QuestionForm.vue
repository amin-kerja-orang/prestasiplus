<script setup lang="ts">
/**
 * The form of S2 `/admin/questions/create` and S4 `/admin/questions/:id/edit` (M04-T4; FR-M04-17..36,
 * 48..52). Native HTML5 validation only (no `novalidate`): Subjek, Tahap Pendidikan, Tahap Kesukaran
 * and Teks Soalan are `required`, and for MCQ the four options and the correct radio (FR-M04-22).
 * Server messages (SRS §5, UNVERIFIED COPY) show in red under their field, the values are kept.
 *
 * Create: "Jenis Soalan" switches the answer card with `v-show` semantics (hidden cards keep their
 * values, every field is posted) and the Teks Soalan textarea has the Arabic / Jawi key panel. Edit: no
 * type select (the saved type's card is shown, DV-M04-05), no keyboard, saved images and DSKP preloaded.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'

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
import ChoiceRadio from './native/ChoiceRadio.vue'
import DskpTagging from './DskpTagging.vue'
import ErrorBox from './ErrorBox.vue'
import NativeRadio from './native/NativeRadio.vue'
import NativeSelect from './native/NativeSelect.vue'
import RtlScope from './native/RtlScope.vue'
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

function submit(): void {
  if (props.saving) return
  emit('submit', buildBody(values, spId.value, props.mode))
}

// Server errors: red border + text under the field; scroll to the first one.
const formEl = ref<HTMLFormElement | null>(null)
const err = (key: string): string | undefined => props.errors.fields[key]
const invalid = (key: string): boolean => key in props.errors.fields

watch(
  () => props.errors,
  async () => {
    await nextTick()
    const target = formEl.value?.querySelector('[data-field-error]') ?? formEl.value
    target?.scrollIntoView?.({ block: 'center' })
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

const STAR_LABELS = [1, 2, 3, 4, 5]
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
    <ErrorBox :messages="errors.general" data-testid="question-form-alert" />

    <!-- Card "Maklumat Soalan" -->
    <UCard data-testid="info-card">
      <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-question" class="size-5 text-primary" />
        Maklumat Soalan
      </h2>

      <div class="flex min-w-0 flex-col gap-4">
        <div class="min-w-0">
          <label for="q-subject" class="mb-2 block text-label text-highlighted">Subjek *</label>
          <NativeSelect
            id="q-subject"
            v-model="values.subjectId"
            name="subject_id"
            required
            data-testid="q-subject"
          >
            <option value="">Pilih Subjek</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </NativeSelect>
          <p v-if="err('subjectId')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('subjectId') }}
          </p>
        </div>

        <div class="min-w-0">
          <label for="q-level" class="mb-2 block text-label text-highlighted"
            >Tahap Pendidikan *</label
          >
          <NativeSelect
            id="q-level"
            v-model="values.educationLevelId"
            name="education_level_id"
            required
            data-testid="q-level"
          >
            <option value="">Pilih Tahap Pendidikan</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </NativeSelect>
          <p v-if="err('educationLevelId')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('educationLevelId') }}
          </p>
        </div>

        <div class="min-w-0">
          <DskpTagging
            v-model:sp-id="spId"
            :subject-id="values.subjectId"
            :level-id="values.educationLevelId"
            :initial="initial?.dskp ?? null"
            :edit="edit"
          />
          <p v-if="err('dskpSpId')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('dskpSpId') }}
          </p>
        </div>

        <fieldset class="min-w-0">
          <legend class="mb-2 text-label text-highlighted">Tahap Kesukaran *</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            <ChoiceRadio
              v-for="n in STAR_LABELS"
              :key="n"
              v-model="values.difficulty"
              name="difficulty_level"
              :value="String(n)"
              required
              :invalid="invalid('difficultyLevel')"
              :data-testid="`q-difficulty-${String(n)}`"
            >
              <span class="flex flex-wrap justify-center gap-1" aria-hidden="true">
                <UIcon v-for="s in n" :key="s" name="i-ph-star-fill" class="size-4" />
              </span>
              <span class="text-caption">{{ DIFFICULTY_LABELS[n] }}</span>
            </ChoiceRadio>
          </div>
          <p v-if="err('difficultyLevel')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('difficultyLevel') }}
          </p>
        </fieldset>

        <div v-if="!edit" class="min-w-0">
          <label for="q-type" class="mb-2 block text-label text-highlighted">Jenis Soalan *</label>
          <NativeSelect
            id="q-type"
            v-model="values.questionType"
            name="question_type"
            required
            data-testid="q-type"
          >
            <option v-for="t in QUESTION_TYPE_OPTIONS" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </NativeSelect>
          <p v-if="err('questionType')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('questionType') }}
          </p>
        </div>

        <div class="min-w-0">
          <label for="q-text" class="mb-2 block text-label text-highlighted">Teks Soalan *</label>
          <RtlScope :rtl="rtl">
            <UTextarea
              id="q-text"
              ref="textareaCmp"
              v-model="values.questionText"
              name="question_text"
              :rows="4"
              required
              placeholder="Masukkan teks soalan di sini..."
              :dir="rtl ? 'rtl' : undefined"
              :color="invalid('questionText') ? 'error' : undefined"
              :aria-invalid="invalid('questionText') ? 'true' : undefined"
              class="w-full"
              data-testid="q-text"
            />
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
          </RtlScope>
          <p class="mt-1 text-caption text-muted">Minimum 10 aksara</p>
          <p v-if="err('questionText')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('questionText') }}
          </p>
          <ArabicKeyboardPanel
            v-if="!edit && keyboardOpen"
            v-model:mode="keyboardMode"
            :anchor="textarea"
            @insert="insertKey"
            @backspace="backspaceKey"
            @close="keyboardOpen = false"
          />
        </div>

        <div class="min-w-0">
          <span class="mb-2 flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-image" class="size-4 text-primary" />
            Gambar Soalan <span class="text-muted">(Pilihan)</span>
          </span>
          <QuestionImagePicker
            v-model:file="values.questionImage"
            v-model:removed="values.removeQuestionImage"
            variant="zone"
            :saved="initial?.questionImage ?? null"
            :edit="edit"
            testid="q-image"
          />
          <p v-if="err('questionImage')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('questionImage') }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- MCQ card -->
    <UCard v-show="isMcq" data-testid="mcq-card">
      <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-list-checks" class="size-5 text-primary" />
        Pilihan Jawapan
      </h2>
      <div class="flex min-w-0 flex-col gap-3">
        <UCard v-for="(letter, i) in OPTION_LETTERS" :key="letter" variant="subtle">
          <div class="flex items-start gap-3">
            <label class="inline-flex size-11 shrink-0 items-center justify-center">
              <NativeRadio
                v-model="values.correctAnswer"
                name="correct_answer"
                :value="String(i)"
                :required="isMcq"
                :aria-label="`Jawapan betul ${letter}`"
                :data-testid="`q-correct-${String(i)}`"
              />
            </label>
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <label :for="`q-option-${String(i)}`" class="text-label text-highlighted">
                Pilihan {{ letter }} *
              </label>
              <UInput
                :id="`q-option-${String(i)}`"
                v-model="values.options[i]"
                type="text"
                name="options[]"
                :required="isMcq"
                :placeholder="`Masukkan pilihan ${letter}`"
                class="w-full"
                :data-testid="`q-option-${String(i)}`"
              />
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
                data-field-error
              >
                {{ err(`optionImages.${String(i)}`) }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
      <p v-if="err('options')" class="mt-2 text-caption text-error" data-field-error>
        {{ err('options') }}
      </p>
      <p v-if="err('correctAnswer')" class="mt-2 text-caption text-error" data-field-error>
        {{ err('correctAnswer') }}
      </p>
      <p class="mt-4 flex items-start gap-2 text-caption text-muted">
        <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" />
        <span>
          <strong>Nota:</strong> Pilih butang radio di sebelah pilihan yang merupakan jawapan yang
          betul.
        </span>
      </p>
    </UCard>

    <!-- True / false card -->
    <UCard v-show="values.questionType === 'true_false'" data-testid="tf-card">
      <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-checks" class="size-5 text-primary" />
        Jawapan Betul / Salah
      </h2>
      <div class="grid grid-cols-2 gap-3">
        <ChoiceRadio v-model="values.tfAnswer" name="tf_answer" value="true" data-testid="q-tf-true">
          <span class="flex items-center gap-2">
            <UIcon name="i-ph-check-circle" class="size-5" />
            Betul
          </span>
        </ChoiceRadio>
        <ChoiceRadio
          v-model="values.tfAnswer"
          name="tf_answer"
          value="false"
          data-testid="q-tf-false"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-ph-x-circle" class="size-5" />
            Salah
          </span>
        </ChoiceRadio>
      </div>
      <p v-if="err('tfAnswer')" class="mt-2 text-caption text-error" data-field-error>
        {{ err('tfAnswer') }}
      </p>
    </UCard>

    <!-- Short answer / fill blank card -->
    <UCard v-show="isShortOrFill" data-testid="short-card">
      <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-pen-nib" class="size-5 text-primary" />
        {{ values.questionType === 'fill_blank' ? 'Jawapan Isi Tempat Kosong' : 'Jawapan Pendek' }}
      </h2>
      <div class="flex min-w-0 flex-col gap-4">
        <div class="min-w-0">
          <label for="q-answer-text" class="mb-2 block text-label text-highlighted">
            Jawapan Betul *
          </label>
          <UInput
            id="q-answer-text"
            v-model="values.correctAnswerText"
            type="text"
            name="correct_answer_text"
            placeholder="Masukkan jawapan betul"
            :color="invalid('correctAnswerText') ? 'error' : undefined"
            class="w-full"
            data-testid="q-answer-text"
          />
          <p v-if="err('correctAnswerText')" class="mt-1 text-caption text-error" data-field-error>
            {{ err('correctAnswerText') }}
          </p>
        </div>
        <div class="min-w-0">
          <label for="q-alt" class="mb-2 block text-label text-highlighted"
            >Jawapan Alternatif (pisahkan dengan koma)</label
          >
          <UInput
            id="q-alt"
            v-model="values.altAnswers"
            type="text"
            name="alt_answers"
            placeholder="cth: jawapan1, jawapan2"
            class="w-full"
            data-testid="q-alt"
          />
          <p class="mt-1 text-caption text-muted">Jawapan lain yang juga diterima</p>
        </div>
      </div>
    </UCard>

    <!-- Essay card -->
    <UCard v-show="values.questionType === 'essay'" data-testid="essay-card">
      <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-file-text" class="size-5 text-primary" />
        Jawapan Contoh (Esei)
      </h2>
      <label for="q-model" class="mb-2 block text-label text-highlighted">
        Jawapan Model (pilihan — ditunjukkan sebagai rujukan)
      </label>
      <UTextarea
        id="q-model"
        v-model="values.modelAnswer"
        name="model_answer"
        :rows="6"
        placeholder="Tulis jawapan contoh di sini..."
        class="w-full"
        data-testid="q-model"
      />
    </UCard>

    <!-- Card "Maklumat Tambahan" -->
    <UCard data-testid="extra-card">
      <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-info" class="size-5 text-primary" />
        Maklumat Tambahan
      </h2>
      <div class="flex min-w-0 flex-col gap-4">
        <div class="min-w-0">
          <label for="q-explanation" class="mb-2 block text-label text-highlighted"
            >Penjelasan</label
          >
          <UTextarea
            id="q-explanation"
            v-model="values.explanation"
            name="explanation"
            :rows="3"
            placeholder="Penjelasan untuk jawapan (pilihan)"
            class="w-full"
            data-testid="q-explanation"
          />
          <p class="mt-1 text-caption text-muted">
            Penjelasan akan ditunjukkan kepada pelajar selepas menjawab
          </p>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="min-w-0">
            <label for="q-language" class="mb-2 block text-label text-highlighted">Bahasa</label>
            <NativeSelect
              id="q-language"
              v-model="values.language"
              name="language"
              data-testid="q-language"
            >
              <option value="bm">Bahasa Melayu</option>
              <option value="en">English</option>
            </NativeSelect>
            <p v-if="err('language')" class="mt-1 text-caption text-error" data-field-error>
              {{ err('language') }}
            </p>
          </div>
          <div class="min-w-0">
            <label for="q-points" class="mb-2 block text-label text-highlighted">Nilai Mata</label>
            <UInput
              id="q-points"
              v-model="values.pointsValue"
              type="number"
              name="points_value"
              min="1"
              :color="invalid('pointsValue') ? 'error' : undefined"
              class="w-full"
              data-testid="q-points"
            />
            <p class="mt-1 text-caption text-muted">Mata yang diperoleh jika jawapan betul</p>
            <p v-if="err('pointsValue')" class="mt-1 text-caption text-error" data-field-error>
              {{ err('pointsValue') }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <UButton
        :to="cancelTo"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        class="min-h-11"
        data-testid="q-cancel"
      >
        Batal
      </UButton>
      <UButton
        type="submit"
        :loading="saving"
        :disabled="saving"
        :icon="saving ? undefined : 'i-ph-floppy-disk'"
        class="min-h-11"
        data-testid="q-submit"
      >
        {{ edit ? 'Kemaskini Soalan' : 'Simpan Soalan' }}
      </UButton>
    </div>
  </form>
</template>
