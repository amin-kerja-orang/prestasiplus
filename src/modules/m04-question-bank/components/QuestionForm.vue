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
import {
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Info,
  Keyboard,
  ListChecks,
  PenLine,
  Save,
  Star,
  X,
} from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'

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

function submit(): void {
  if (props.saving) return
  emit('submit', buildBody(values, spId.value, props.mode))
}

// Server errors: red border + text under the field; scroll to the first one.
const formEl = ref<HTMLFormElement | null>(null)
const err = (key: string): string | undefined => props.errors.fields[key]
const invalid = (key: string): string | false => key in props.errors.fields && FORM_ERROR_MODIFIER

watch(
  () => props.errors,
  async () => {
    await nextTick()
    const target = formEl.value?.querySelector('[data-field-error]') ?? formEl.value
    target?.scrollIntoView?.({ block: 'center' })
  },
)

// Arabic / Jawi keyboard (create only).
const textarea = ref<HTMLTextAreaElement | null>(null)
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

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const STAR = 'h-4 w-4 fill-amber-400 text-amber-400'
const CARD = 'rounded-2xl bg-white p-4 shadow sm:p-6'
const CARD_TITLE = 'mb-4 flex items-center gap-2 text-lg font-bold text-slate-800'
const CHOICE_CARD =
  'flex min-h-11 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300'
const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <form
    ref="formEl"
    method="post"
    enctype="multipart/form-data"
    class="space-y-4 sm:space-y-6"
    data-testid="question-form"
    @submit.prevent="submit"
  >
    <AlertBox :messages="errors.general" data-testid="question-form-alert" />

    <!-- Card "Maklumat Soalan" -->
    <section :class="CARD" data-testid="info-card">
      <h2 :class="CARD_TITLE">
        <CircleQuestionMark class="h-5 w-5 text-indigo-600" aria-hidden="true" />
        Maklumat Soalan
      </h2>

      <div class="space-y-5">
        <div>
          <label for="q-subject" :class="LABEL">Subjek <span class="text-red-500">*</span></label>
          <select
            id="q-subject"
            v-model="values.subjectId"
            name="subject_id"
            required
            :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white', invalid('subjectId')]"
            data-testid="q-subject"
          >
            <option value="">Pilih Subjek</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </select>
          <p v-if="err('subjectId')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('subjectId') }}
          </p>
        </div>

        <div>
          <label for="q-level" :class="LABEL">
            Tahap Pendidikan <span class="text-red-500">*</span>
          </label>
          <select
            id="q-level"
            v-model="values.educationLevelId"
            name="education_level_id"
            required
            :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white', invalid('educationLevelId')]"
            data-testid="q-level"
          >
            <option value="">Pilih Tahap Pendidikan</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </select>
          <p v-if="err('educationLevelId')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('educationLevelId') }}
          </p>
        </div>

        <div>
          <DskpTagging
            v-model:sp-id="spId"
            :subject-id="values.subjectId"
            :level-id="values.educationLevelId"
            :initial="initial?.dskp ?? null"
            :edit="edit"
          />
          <p v-if="err('dskpSpId')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('dskpSpId') }}
          </p>
        </div>

        <fieldset class="min-w-0">
          <legend :class="LABEL">Tahap Kesukaran <span class="text-red-500">*</span></legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            <label v-for="n in 5" :key="n" class="relative block">
              <input
                v-model="values.difficulty"
                type="radio"
                name="difficulty_level"
                :value="String(n)"
                required
                class="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                :data-testid="`q-difficulty-${String(n)}`"
              />
              <span
                :class="[
                  CHOICE_CARD,
                  'h-full flex-col justify-center text-center text-xs',
                  invalid('difficultyLevel'),
                ]"
              >
                <span class="flex flex-wrap justify-center gap-0.5">
                  <Star v-for="s in n" :key="s" :class="STAR" aria-hidden="true" />
                </span>
                {{ DIFFICULTY_LABELS[n] }}
              </span>
            </label>
          </div>
          <p v-if="err('difficultyLevel')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('difficultyLevel') }}
          </p>
        </fieldset>

        <div v-if="!edit">
          <label for="q-type" :class="LABEL">
            Jenis Soalan <span class="text-red-500">*</span>
          </label>
          <select
            id="q-type"
            v-model="values.questionType"
            name="question_type"
            required
            :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white', invalid('questionType')]"
            data-testid="q-type"
          >
            <option v-for="t in QUESTION_TYPE_OPTIONS" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </select>
          <p v-if="err('questionType')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('questionType') }}
          </p>
        </div>

        <div>
          <label for="q-text" :class="LABEL">Teks Soalan <span class="text-red-500">*</span></label>
          <div class="relative">
            <textarea
              id="q-text"
              ref="textarea"
              v-model="values.questionText"
              name="question_text"
              rows="4"
              required
              placeholder="Masukkan teks soalan di sini..."
              :dir="rtl ? 'rtl' : undefined"
              :class="[FORM_TEXTAREA_CLASS, 'block', !edit && 'pb-12', invalid('questionText')]"
              :style="rtl ? { fontFamily: `'Scheherazade New', 'Lateef', serif` } : undefined"
              data-testid="q-text"
            ></textarea>
            <button
              v-if="!edit"
              type="button"
              title="Papan kekunci Arab / Jawi"
              :class="[
                'absolute bottom-2 left-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition after:absolute after:-inset-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
                keyboardOpen
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100',
              ]"
              data-testid="vkb-toggle"
              @mousedown.prevent
              @click="toggleKeyboard"
            >
              <Keyboard class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p class="mt-1 text-xs text-slate-500">Minimum 10 aksara</p>
          <p v-if="err('questionText')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
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

        <div>
          <span :class="[LABEL, 'flex items-center gap-2']">
            <ImageIcon class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Gambar Soalan <span class="font-normal text-slate-400">(Pilihan)</span>
          </span>
          <QuestionImagePicker
            v-model:file="values.questionImage"
            v-model:removed="values.removeQuestionImage"
            variant="zone"
            :saved="initial?.questionImage ?? null"
            :edit="edit"
            testid="q-image"
          />
          <p v-if="err('questionImage')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('questionImage') }}
          </p>
        </div>
      </div>
    </section>

    <!-- MCQ card -->
    <section v-show="isMcq" :class="CARD" data-testid="mcq-card">
      <h2 :class="CARD_TITLE">
        <ListChecks class="h-5 w-5 text-emerald-600" aria-hidden="true" />
        Pilihan Jawapan
      </h2>
      <div class="space-y-3">
        <div
          v-for="(letter, i) in OPTION_LETTERS"
          :key="letter"
          class="min-w-0 rounded-xl border-2 border-slate-200 p-3 sm:p-4"
        >
          <div class="flex items-start gap-3">
            <!-- The label's pseudo-element widens the 20px radio to a 44px touch target. -->
            <label class="relative mt-1 inline-flex shrink-0 after:absolute after:-inset-3">
              <input
                v-model="values.correctAnswer"
                type="radio"
                name="correct_answer"
                :value="String(i)"
                :required="isMcq"
                class="relative z-10 h-5 w-5 accent-indigo-600"
                :data-testid="`q-correct-${String(i)}`"
              />
            </label>
            <div class="min-w-0 flex-1 space-y-2">
              <label
                :for="`q-option-${String(i)}`"
                class="block text-sm font-semibold text-slate-700"
              >
                Pilihan {{ letter }} <span class="text-red-500">*</span>
              </label>
              <input
                :id="`q-option-${String(i)}`"
                v-model="values.options[i]"
                type="text"
                name="options[]"
                :required="isMcq"
                :placeholder="`Masukkan pilihan ${letter}`"
                :class="[FORM_INPUT_CLASS, 'min-h-11']"
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
                :class="FORM_ERROR_TEXT_CLASS"
                data-field-error
              >
                {{ err(`optionImages.${String(i)}`) }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <p v-if="err('options')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
        {{ err('options') }}
      </p>
      <p v-if="err('correctAnswer')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
        {{ err('correctAnswer') }}
      </p>
      <p
        class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
      >
        <Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Nota:</strong> Pilih butang radio di sebelah pilihan yang merupakan jawapan yang
          betul.
        </span>
      </p>
    </section>

    <!-- True / false card -->
    <section v-show="values.questionType === 'true_false'" :class="CARD" data-testid="tf-card">
      <h2 :class="CARD_TITLE">
        <CheckCheck class="h-5 w-5 text-emerald-600" aria-hidden="true" />
        Jawapan Betul / Salah
      </h2>
      <div class="grid grid-cols-2 gap-3">
        <label class="relative block">
          <input
            v-model="values.tfAnswer"
            type="radio"
            name="tf_answer"
            value="true"
            class="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            data-testid="q-tf-true"
          />
          <span
            :class="[
              CHOICE_CARD,
              'justify-center peer-checked:border-emerald-500 peer-checked:bg-emerald-50',
            ]"
          >
            <CircleCheck class="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Betul
          </span>
        </label>
        <label class="relative block">
          <input
            v-model="values.tfAnswer"
            type="radio"
            name="tf_answer"
            value="false"
            class="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            data-testid="q-tf-false"
          />
          <span
            :class="[
              CHOICE_CARD,
              'justify-center peer-checked:border-red-500 peer-checked:bg-red-50',
            ]"
          >
            <CircleX class="h-5 w-5 text-red-600" aria-hidden="true" />
            Salah
          </span>
        </label>
      </div>
      <p v-if="err('tfAnswer')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
        {{ err('tfAnswer') }}
      </p>
    </section>

    <!-- Short answer / fill blank card -->
    <section v-show="isShortOrFill" :class="CARD" data-testid="short-card">
      <h2 :class="CARD_TITLE">
        <PenLine class="h-5 w-5 text-emerald-600" aria-hidden="true" />
        {{ values.questionType === 'fill_blank' ? 'Jawapan Isi Tempat Kosong' : 'Jawapan Pendek' }}
      </h2>
      <div class="space-y-4">
        <div>
          <label for="q-answer-text" :class="LABEL">
            Jawapan Betul <span class="text-red-500">*</span>
          </label>
          <input
            id="q-answer-text"
            v-model="values.correctAnswerText"
            type="text"
            name="correct_answer_text"
            placeholder="Masukkan jawapan betul"
            :class="[FORM_INPUT_CLASS, 'min-h-11', invalid('correctAnswerText')]"
            data-testid="q-answer-text"
          />
          <p v-if="err('correctAnswerText')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
            {{ err('correctAnswerText') }}
          </p>
        </div>
        <div>
          <label for="q-alt" :class="LABEL">Jawapan Alternatif (pisahkan dengan koma)</label>
          <input
            id="q-alt"
            v-model="values.altAnswers"
            type="text"
            name="alt_answers"
            placeholder="cth: jawapan1, jawapan2"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="q-alt"
          />
          <p class="mt-1 text-xs text-slate-500">Jawapan lain yang juga diterima</p>
        </div>
      </div>
    </section>

    <!-- Essay card -->
    <section v-show="values.questionType === 'essay'" :class="CARD" data-testid="essay-card">
      <h2 :class="CARD_TITLE">
        <FileText class="h-5 w-5 text-emerald-600" aria-hidden="true" />
        Jawapan Contoh (Esei)
      </h2>
      <label for="q-model" :class="LABEL">
        Jawapan Model (pilihan — ditunjukkan sebagai rujukan)
      </label>
      <textarea
        id="q-model"
        v-model="values.modelAnswer"
        name="model_answer"
        rows="6"
        placeholder="Tulis jawapan contoh di sini..."
        :class="FORM_TEXTAREA_CLASS"
        data-testid="q-model"
      ></textarea>
    </section>

    <!-- Card "Maklumat Tambahan" -->
    <section :class="CARD" data-testid="extra-card">
      <h2 :class="CARD_TITLE">
        <Info class="h-5 w-5 text-blue-600" aria-hidden="true" />
        Maklumat Tambahan
      </h2>
      <div class="space-y-5">
        <div>
          <label for="q-explanation" :class="LABEL">Penjelasan</label>
          <textarea
            id="q-explanation"
            v-model="values.explanation"
            name="explanation"
            rows="3"
            placeholder="Penjelasan untuk jawapan (pilihan)"
            :class="FORM_TEXTAREA_CLASS"
            data-testid="q-explanation"
          ></textarea>
          <p class="mt-1 text-xs text-slate-500">
            Penjelasan akan ditunjukkan kepada pelajar selepas menjawab
          </p>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label for="q-language" :class="LABEL">Bahasa</label>
            <select
              id="q-language"
              v-model="values.language"
              name="language"
              :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white', invalid('language')]"
              data-testid="q-language"
            >
              <option value="bm">Bahasa Melayu</option>
              <option value="en">English</option>
            </select>
            <p v-if="err('language')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
              {{ err('language') }}
            </p>
          </div>
          <div>
            <label for="q-points" :class="LABEL">Nilai Mata</label>
            <input
              id="q-points"
              v-model="values.pointsValue"
              type="number"
              name="points_value"
              min="1"
              :class="[FORM_INPUT_CLASS, 'min-h-11', invalid('pointsValue')]"
              data-testid="q-points"
            />
            <p class="mt-1 text-xs text-slate-500">Mata yang diperoleh jika jawapan betul</p>
            <p v-if="err('pointsValue')" :class="FORM_ERROR_TEXT_CLASS" data-field-error>
              {{ err('pointsValue') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <RouterLink
        :to="cancelTo"
        :class="[BTN, 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50']"
        data-testid="q-cancel"
      >
        <X class="h-4 w-4" aria-hidden="true" />
        Batal
      </RouterLink>
      <button
        type="submit"
        :disabled="saving"
        :class="[
          BTN,
          'bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50',
        ]"
        data-testid="q-submit"
      >
        <LoadingSpinner v-if="saving" class="h-4 w-4" />
        <Save v-else class="h-4 w-4" aria-hidden="true" />
        {{ edit ? 'Kemaskini Soalan' : 'Simpan Soalan' }}
      </button>
    </div>
  </form>
</template>
