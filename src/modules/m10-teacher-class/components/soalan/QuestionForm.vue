<script setup lang="ts">
/**
 * The form of S22 `/guru/soalan/cipta` "Tambah Soalan Baru" (44-F1; FR-GUR-44-9, FR-GUR-44-11). Multiple choice only:
 * Tingkatan, Subjek, Bab, SP, TP, Aras Pemikiran, Kesukaran (1 to 5 stars), the question, four options with one
 * correct answer and the explanation. No native validation (`novalidate`): every missing field shows its BM text
 * under the field and nothing is sent. Bab is required only when the Subjek + Tingkatan has chapters, SP, TP and
 * Aras only where DSKP nodes exist (`dskp-rule.ts`, D112). Kesukaran starts as min(5, TP) until it is touched.
 * "Jenis Tulisan" Arab / Jawi makes the textarea RTL; the keyboard button opens the Arabic / Jawi keys.
 * Server messages show in a box above the form and under their field; the typed values are kept.
 */
import { DsFormSection, DsNativeSelect, DsPanel, DsRtlScope, DsText } from '@/ds'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import {
  ArabicKeyboardPanel,
  backspaceAtCaret,
  COGNITIVE_OPTIONS,
  insertAtCaret,
  type KeyboardMode,
} from '@/modules/m04-question-bank'

import { fetchChapters } from '../../api/guru'
import type { ChapterOption, CreateQuestionRequest } from '../../api/types'
import { fetchLevelOptions, fetchSubjectOptions, type NamedLookup } from './data'
import { DSKP_EMPTY, TP_VALUES, dskpRequired } from './dskp-rule'
import { fetchSpChoices, type SpChoice } from './dskp-lookup'
import { buildBody, emptyValues, validateForm, type FormField } from './form'
import {
  chapterLabel,
  correctItems,
  DIFFICULTY_OPTIONS,
  difficultyFromTp,
  isRtlScript,
  OPTION_LETTERS,
  SCRIPTS,
  spLabel,
} from './lib'

const CORRECT_ITEMS = correctItems()

const props = defineProps<{
  saving: boolean
  general: string[]
  fields: Record<string, string>
}>()
const emit = defineEmits<{
  submit: [body: CreateQuestionRequest]
}>()

const v = reactive(emptyValues())

// --- lookups ---------------------------------------------------------------------------------
const levels = ref<NamedLookup[]>([])
const subjects = ref<NamedLookup[]>([])
const chapters = ref<ChapterOption[]>([])
const sps = ref<SpChoice[]>([])
/** The Bab / SP lists of the chosen pair have been answered (so an empty list means "none exist"). */
const loaded = reactive({ chapters: false, sps: false })
const seq = { chapters: 0, sp: 0 }

onMounted(async () => {
  try {
    ;[levels.value, subjects.value] = await Promise.all([
      fetchLevelOptions(),
      fetchSubjectOptions(),
    ])
  } catch {
    levels.value = []
    subjects.value = []
  }
})

const sorted = (list: ChapterOption[]): ChapterOption[] =>
  [...list].sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))

const ready = computed(() => v.levelId !== '' && v.subjectId !== '')

watch(
  () => [v.levelId, v.subjectId] as const,
  () => {
    v.chapterId = ''
    v.spId = ''
    seq.chapters++
    seq.sp++
    chapters.value = []
    sps.value = []
    loaded.chapters = false
    loaded.sps = false
    if (!ready.value) return
    const query = { subjectId: Number(v.subjectId), educationLevelId: Number(v.levelId) }
    const chapterToken = seq.chapters
    fetchChapters(query)
      .then((list) => {
        if (chapterToken === seq.chapters) chapters.value = sorted(list)
      })
      .catch(() => undefined)
      .finally(() => {
        if (chapterToken === seq.chapters) loaded.chapters = true
      })
    const spToken = seq.sp
    fetchSpChoices(query)
      .then((list) => {
        if (spToken === seq.sp) sps.value = list
      })
      .catch(() => undefined)
      .finally(() => {
        if (spToken === seq.sp) loaded.sps = true
      })
  },
)

/** D112: what the lookups found for the chosen Subjek + Tingkatan. */
const ctx = computed(() => ({
  hasChapters: chapters.value.length > 0,
  hasDskpNodes: sps.value.length > 0,
}))
const need = computed(() => dskpRequired(ctx.value))
const noChapters = computed(() => ready.value && loaded.chapters && chapters.value.length === 0)
const noSps = computed(() => ready.value && loaded.sps && sps.value.length === 0)
const star = (on: boolean): string => (on ? ' *' : '')

const chapterOptions = computed(() =>
  chapters.value.map((c) => ({ value: String(c.id), label: chapterLabel(c) })),
)
const spOptions = computed(() => sps.value.map((s) => ({ value: String(s.id), label: spLabel(s) })))

// --- Kesukaran: min(5, TP) until the teacher touches it --------------------------------------
const difficultyTouched = ref(false)
watch(
  () => v.tp,
  (tp) => {
    const n = Number(tp)
    if (!difficultyTouched.value && tp !== '' && Number.isInteger(n)) {
      v.difficulty = String(difficultyFromTp(n))
    }
  },
)
function pickDifficulty(value: string | number): void {
  difficultyTouched.value = true
  v.difficulty = String(value)
}

// --- question text, keyboard, preview --------------------------------------------------------
const textareaCmp = ref<{ textareaRef?: HTMLTextAreaElement | null } | null>(null)
const textarea = computed<HTMLTextAreaElement | null>(() => textareaCmp.value?.textareaRef ?? null)
const keyboardOpen = ref(false)
const keyboardMode = ref<KeyboardMode>('arab')
const keyboardRtl = ref(false)
const rtl = computed(() => isRtlScript(v.scriptType) || keyboardRtl.value)

watch(
  () => v.scriptType,
  () => {
    keyboardRtl.value = false
  },
)

function toggleKeyboard(): void {
  keyboardOpen.value = !keyboardOpen.value
  if (keyboardOpen.value) keyboardRtl.value = true
}

async function applyEdit(
  compute: (value: string, start: number, end: number) => { value: string; caret: number },
): Promise<void> {
  const el = textarea.value
  const start = el?.selectionStart ?? v.questionText.length
  const end = el?.selectionEnd ?? start
  const next = compute(v.questionText, start, end)
  v.questionText = next.value
  await nextTick()
  if (el) {
    el.value = next.value
    el.setSelectionRange(next.caret, next.caret)
  }
}
const insertKey = (text: string) => applyEdit((value, s, e) => insertAtCaret(value, s, e, text))
const backspaceKey = () => applyEdit((value, s, e) => backspaceAtCaret(value, s, e))

// --- submit and errors -----------------------------------------------------------------------

const clientErrors = ref<Partial<Record<FormField, string>>>({})
/** The text under a field: the client check first, else the server's `fields.<name>`. */
const err = (name: FormField): string | undefined => clientErrors.value[name] ?? props.fields[name]
const errorCount = computed(() => Object.keys(clientErrors.value).length)

const FOCUS_ID: Record<FormField, string> = {
  educationLevelId: 'q-level',
  subjectId: 'q-subject',
  chapterId: 'q-chapter',
  spIds: 'q-sp',
  tp: 'q-tp',
  cognitiveLevel: 'q-aras',
  difficultyLevel: 'q-difficulty',
  questionText: 'q-text',
  options: 'q-option-0',
  correctAnswer: 'q-correct',
  explanation: 'q-explanation',
}

async function submit(): Promise<void> {
  const found = validateForm(v, ctx.value)
  clientErrors.value = found
  const first = (Object.keys(FOCUS_ID) as FormField[]).find((k) => found[k] !== undefined)
  if (first) {
    await nextTick()
    const id = FOCUS_ID[first]
    ;(document.getElementById(id) ?? document.querySelector<HTMLElement>(`[id^="${id}"]`))?.focus()
    return
  }
  emit('submit', buildBody(v))
}
</script>

<template>
  <form
    method="post"
    enctype="multipart/form-data"
    class="flex min-w-0 flex-col gap-4"
    novalidate
    data-testid="question-form"
    @submit.prevent="submit"
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
    <UAlert
      v-if="errorCount > 0"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      :description="`${String(errorCount)} medan perlu dibetulkan.`"
      data-testid="form-banner"
    />

    <!-- Maklumat Soalan -->
    <DsFormSection title="Maklumat Soalan" icon="tag" accent="action" data-testid="info-card">
      <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div class="min-w-0">
          <label for="q-level" class="mb-2 block text-label text-highlighted">Tingkatan *</label>
          <DsNativeSelect
            id="q-level"
            v-model="v.levelId"
            name="education_level_id"
            :aria-invalid="err('educationLevelId') ? 'true' : undefined"
            data-testid="q-level"
          >
            <option value="">-- Pilih tingkatan --</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </DsNativeSelect>
          <DsText v-if="err('educationLevelId')" variant="caption" tone="error" role="alert">{{
            err('educationLevelId')
          }}</DsText>
        </div>
        <div class="min-w-0">
          <label for="q-subject" class="mb-2 block text-label text-highlighted">Subjek *</label>
          <DsNativeSelect
            id="q-subject"
            v-model="v.subjectId"
            name="subject_id"
            :aria-invalid="err('subjectId') ? 'true' : undefined"
            data-testid="q-subject"
          >
            <option value="">-- Pilih subjek --</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </DsNativeSelect>
          <DsText v-if="err('subjectId')" variant="caption" tone="error" role="alert">{{
            err('subjectId')
          }}</DsText>
        </div>

        <div class="min-w-0">
          <label for="q-difficulty" class="mb-2 block text-label text-highlighted"
            >Kesukaran *</label
          >
          <DsNativeSelect
            id="q-difficulty"
            :model-value="v.difficulty"
            name="difficulty_level"
            :aria-invalid="err('difficultyLevel') ? 'true' : undefined"
            data-testid="q-difficulty"
            @update:model-value="pickDifficulty"
          >
            <option value="">-- Pilih kesukaran --</option>
            <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="String(d.value)">
              {{ d.label }}
            </option>
          </DsNativeSelect>
          <DsText v-if="err('difficultyLevel')" variant="caption" tone="error" role="alert">{{
            err('difficultyLevel')
          }}</DsText>
        </div>
        <div class="min-w-0">
          <label for="q-script" class="mb-2 block text-label text-highlighted">Jenis Tulisan</label>
          <DsNativeSelect
            id="q-script"
            v-model="v.scriptType"
            name="script_type"
            data-testid="q-script"
          >
            <option v-for="s in SCRIPTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </DsNativeSelect>
        </div>
      </div>
    </DsFormSection>

    <!-- Pemetaan DSKP (D112: required only where the Subjek + Tingkatan has chapters / DSKP nodes) -->
    <DsFormSection title="Pemetaan DSKP" icon="book-open" accent="win" data-testid="dskp-card">
      <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div class="min-w-0">
          <label for="q-chapter" class="mb-2 block text-label text-highlighted"
            >Bab{{ star(need.chapterId) }}</label
          >
          <DsNativeSelect
            id="q-chapter"
            v-model="v.chapterId"
            name="chapter_id"
            :disabled="!ready || chapters.length === 0"
            :aria-invalid="err('chapterId') ? 'true' : undefined"
            data-testid="q-chapter"
          >
            <option value="">{{ noChapters ? DSKP_EMPTY.chapter : '-- Pilih bab --' }}</option>
            <option v-for="c in chapterOptions" :key="c.value" :value="c.value">
              {{ c.label }}
            </option>
          </DsNativeSelect>
          <DsText v-if="err('chapterId')" variant="caption" tone="error" role="alert">{{
            err('chapterId')
          }}</DsText>
        </div>
        <div class="min-w-0">
          <label for="q-sp" class="mb-2 block text-label text-highlighted"
            >SP{{ star(need.spIds) }}</label
          >
          <DsNativeSelect
            id="q-sp"
            v-model="v.spId"
            name="sp_id"
            :disabled="!ready || sps.length === 0"
            :aria-invalid="err('spIds') ? 'true' : undefined"
            data-testid="q-sp"
          >
            <option value="">{{ noSps ? DSKP_EMPTY.sp : '-- Pilih SP --' }}</option>
            <option v-for="o in spOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </DsNativeSelect>
          <DsText v-if="err('spIds')" variant="caption" tone="error" role="alert">{{
            err('spIds')
          }}</DsText>
        </div>
        <div class="min-w-0">
          <label for="q-tp" class="mb-2 block text-label text-highlighted"
            >TP{{ star(need.tp) }}</label
          >
          <DsNativeSelect
            id="q-tp"
            v-model="v.tp"
            name="tp"
            :aria-invalid="err('tp') ? 'true' : undefined"
            data-testid="q-tp"
          >
            <option value="">-- Pilih TP --</option>
            <option v-for="n in TP_VALUES" :key="n" :value="String(n)">{{ n }}</option>
          </DsNativeSelect>
          <DsText v-if="err('tp')" variant="caption" tone="error" role="alert">{{
            err('tp')
          }}</DsText>
        </div>
        <div class="min-w-0">
          <label for="q-aras" class="mb-2 block text-label text-highlighted"
            >Aras Pemikiran{{ star(need.cognitiveLevel) }}</label
          >
          <DsNativeSelect
            id="q-aras"
            v-model="v.cognitiveLevel"
            name="cognitive_level"
            :aria-invalid="err('cognitiveLevel') ? 'true' : undefined"
            data-testid="q-aras"
          >
            <option value="">-- Pilih aras --</option>
            <option v-for="c in COGNITIVE_OPTIONS" :key="c.value" :value="c.value">
              {{ c.label }}
            </option>
          </DsNativeSelect>
          <DsText v-if="err('cognitiveLevel')" variant="caption" tone="error" role="alert">{{
            err('cognitiveLevel')
          }}</DsText>
        </div>
      </div>
      <p class="mt-4 flex items-center gap-2 text-caption text-muted">
        <UIcon name="i-ph-info-duotone" class="size-4 shrink-0" />
        Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR.
      </p>
    </DsFormSection>

    <!-- Soalan -->
    <DsFormSection title="Soalan" icon="question" accent="heat" data-testid="text-card">
      <DsRtlScope :rtl="rtl">
        <UTextarea
          id="q-text"
          ref="textareaCmp"
          v-model="v.questionText"
          name="question_text"
          :rows="4"
          maxlength="2000"
          :placeholder="rtl ? 'اكتب السؤال هنا...' : 'Tuliskan soalan di sini...'"
          :dir="rtl ? 'rtl' : undefined"
          class="w-full"
          data-testid="q-text"
        />
        <UButton
          type="button"
          title="Papan kekunci Arab / Jawi"
          aria-label="Papan kekunci Arab / Jawi"
          :color="keyboardOpen ? 'primary' : 'neutral'"
          :variant="keyboardOpen ? 'solid' : 'soft'"
          icon="i-ph-keyboard-duotone"
          class="mt-2 size-11 justify-center"
          data-testid="vkb-toggle"
          @mousedown.prevent
          @click="toggleKeyboard"
        />
      </DsRtlScope>
      <DsText v-if="err('questionText')" variant="caption" tone="error" role="alert">{{
        err('questionText')
      }}</DsText>
      <ArabicKeyboardPanel
        v-if="keyboardOpen"
        v-model:mode="keyboardMode"
        :anchor="textarea"
        @insert="insertKey"
        @backspace="backspaceKey"
        @close="keyboardOpen = false"
      />

      <DsPanel v-if="v.scriptType !== 'rumi'" tone="inset" class="mt-3" data-testid="q-preview">
        <p class="mb-1 flex items-center gap-2 text-label text-muted">
          <UIcon name="i-ph-eye-duotone" class="size-4" />
          Pratonton paparan soalan:
        </p>
        <DsRtlScope :rtl="rtl">
          <p
            class="min-w-0 text-body break-words whitespace-pre-wrap text-default"
            :dir="rtl ? 'rtl' : undefined"
            data-testid="q-preview-text"
          >
            {{ v.questionText || '(Tiada teks lagi)' }}
          </p>
        </DsRtlScope>
      </DsPanel>
    </DsFormSection>

    <!-- Pilihan Jawapan (multiple choice only) -->
    <DsFormSection title="Pilihan Jawapan" icon="list-checks" accent="trial" data-testid="mcq-card">
      <p class="mb-4 text-body text-muted">Masukkan 4 pilihan dan pilih jawapan yang betul.</p>
      <URadioGroup
        id="q-correct"
        :model-value="v.correct ?? undefined"
        legend="Jawapan betul"
        orientation="horizontal"
        :items="CORRECT_ITEMS"
        class="mb-4"
        data-testid="q-correct"
        @update:model-value="v.correct = Number($event)"
      />
      <div class="flex min-w-0 flex-col gap-3">
        <DsPanel
          v-for="(letter, i) in OPTION_LETTERS"
          :key="letter"
          tone="inset"
          :data-testid="`q-option-row-${String(i)}`"
        >
          <div class="flex min-w-0 items-center gap-3">
            <UBadge color="primary" variant="subtle" size="lg">{{ letter }}</UBadge>
            <UInput
              :id="`q-option-${String(i)}`"
              v-model="v.options[i]"
              type="text"
              :name="`options[${String(i)}][text]`"
              maxlength="500"
              :placeholder="`Pilihan ${letter}`"
              :aria-label="`Pilihan ${letter}`"
              class="min-w-0 flex-1"
              :data-testid="`q-option-${String(i)}`"
            />
          </div>
        </DsPanel>
      </div>
      <DsText v-if="err('options')" variant="caption" tone="error" role="alert">{{
        err('options')
      }}</DsText>
      <DsText v-if="err('correctAnswer')" variant="caption" tone="error" role="alert">{{
        err('correctAnswer')
      }}</DsText>
      <p class="mt-3 flex items-center gap-2 text-caption text-muted">
        <UIcon name="i-ph-info-duotone" class="size-4 shrink-0" />
        Klik butang bulat untuk memilih jawapan yang betul.
      </p>
    </DsFormSection>

    <!-- Penerangan -->
    <DsFormSection
      title="Penerangan (Pilihan)"
      icon="lightbulb"
      accent="friend"
      data-testid="explanation-card"
    >
      <UTextarea
        id="q-explanation"
        v-model="v.explanation"
        name="explanation"
        :rows="3"
        maxlength="2000"
        placeholder="Terangkan jawapan yang betul untuk membantu pelajar faham..."
        aria-label="Penerangan (Pilihan)"
        class="w-full"
        data-testid="q-explanation"
      />
      <DsText v-if="err('explanation')" variant="caption" tone="error" role="alert">{{
        err('explanation')
      }}</DsText>
    </DsFormSection>

    <div class="flex items-center justify-between gap-3">
      <UButton
        to="/guru/soalan"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        class="min-h-11"
        data-testid="form-cancel"
        >Batal</UButton
      >
      <UButton
        type="submit"
        :loading="saving"
        :disabled="saving"
        :icon="saving ? undefined : 'i-ph-paper-plane-tilt-duotone'"
        class="min-h-11"
        data-testid="form-submit"
        >{{ saving ? 'Menyimpan...' : 'Hantar untuk Semakan' }}</UButton
      >
    </div>
  </form>
</template>
