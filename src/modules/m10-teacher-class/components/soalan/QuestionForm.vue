<script setup lang="ts">
/**
 * The form of S22 `/guru/soalan/cipta` (FR-M10-99..106; FN-M10-7.2.1–7.2.14, 11.1, 11.2). Native HTML5
 * validation (no `novalidate`): level, subject, type, difficulty, text and, by type, the four options,
 * the Betul / Salah answer or "Jawapan Utama". Level + subject load Bab and Bidang; Bab loads Topik;
 * Bidang → SK → SP; each has an inline add panel (a failed add does nothing visible, as live S22).
 * "Jenis Tulisan" Arab / Jawi makes the textarea RTL; the keyboard button opens the Arabic / Jawi keys.
 * Server messages show in a box above the form and under their field; the typed values are kept.
 */
import {
  BookOpen,
  Images,
  Keyboard,
  Lightbulb,
  ListChecks,
  Eye,
  Send,
  Tag,
  X,
  Info,
  CircleHelp,
} from '@lucide/vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import {
  ArabicKeyboardPanel,
  backspaceAtCaret,
  insertAtCaret,
  type KeyboardMode,
} from '@/modules/m04-question-bank'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'

import {
  createBidang,
  createChapter,
  createSk,
  createSp,
  createTopic,
  fetchBidang,
  fetchChapters,
  fetchSk,
  fetchSp,
  fetchTopics,
} from '../../api/guru'
import type {
  BidangOption,
  ChapterOption,
  CreateQuestionRequest,
  SkOption,
  SpOption,
  TopicOption,
} from '../../api/types'
import AddRow from './AddRow.vue'
import { fetchLevelOptions, fetchSubjectOptions, type NamedLookup } from './data'
import { buildBody, emptyValues } from './form'
import GaleriRajahModal from './GaleriRajahModal.vue'
import ImageField from './ImageField.vue'
import {
  bidangLabel,
  chapterLabel,
  DIFFICULTIES,
  isRtlScript,
  OPTION_LETTERS,
  QUESTION_TYPES,
  type PanelField,
  SCRIPTS,
} from './lib'

defineProps<{
  saving: boolean
  general: string[]
  fields: Record<string, string>
}>()
const emit = defineEmits<{
  submit: [body: CreateQuestionRequest, image: File | null, optionImages: (File | null)[]]
}>()

const v = reactive(emptyValues())
const image = ref<File | null>(null)
const optionImages = ref<(File | null)[]>([null, null, null, null])

// --- lookups ---------------------------------------------------------------------------------
const levels = ref<NamedLookup[]>([])
const subjects = ref<NamedLookup[]>([])
const chapters = ref<ChapterOption[]>([])
const topics = ref<TopicOption[]>([])
const bidangs = ref<BidangOption[]>([])
const sks = ref<SkOption[]>([])
const sps = ref<SpOption[]>([])
const seq = { chapters: 0, topics: 0, bidang: 0, sk: 0, sp: 0 }

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

/** Runs a lookup; a failed or stale one empties the list silently (FN-M10-11.1.1). */
async function load<T>(key: keyof typeof seq, fetcher: () => Promise<T[]>, into: { value: T[] }) {
  const token = ++seq[key]
  try {
    const list = await fetcher()
    if (token === seq[key]) into.value = list
  } catch {
    if (token === seq[key]) into.value = []
  }
}

const sorted = (list: ChapterOption[]): ChapterOption[] =>
  [...list].sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))

const ready = computed(() => v.levelId !== '' && v.subjectId !== '')

watch(
  () => [v.levelId, v.subjectId] as const,
  () => {
    v.chapterId = ''
    v.topicId = ''
    v.bidangId = ''
    v.skId = ''
    v.spId = ''
    topics.value = []
    sks.value = []
    sps.value = []
    seq.topics++
    seq.sk++
    seq.sp++
    if (!ready.value) {
      seq.chapters++
      seq.bidang++
      chapters.value = []
      bidangs.value = []
      return
    }
    const query = { subjectId: Number(v.subjectId), educationLevelId: Number(v.levelId) }
    void load('chapters', async () => sorted(await fetchChapters(query)), chapters)
    void load('bidang', () => fetchBidang(query), bidangs)
  },
)
watch(
  () => v.chapterId,
  (id) => {
    v.topicId = ''
    topics.value = []
    seq.topics++
    if (id !== '') void load('topics', () => fetchTopics(Number(id)), topics)
  },
)
watch(
  () => v.bidangId,
  (id) => {
    v.skId = ''
    v.spId = ''
    sks.value = []
    sps.value = []
    seq.sp++
    if (id !== '') void load('sk', () => fetchSk(Number(id)), sks)
  },
)
watch(
  () => v.skId,
  (id) => {
    v.spId = ''
    sps.value = []
    if (id !== '') void load('sp', () => fetchSp(Number(id)), sps)
  },
)

// --- inline adds -----------------------------------------------------------------------------
interface RowHandle {
  done: () => void
}
const chapterRow = ref<RowHandle | null>(null)
const topicRow = ref<RowHandle | null>(null)
const bidangRow = ref<RowHandle | null>(null)
const skRow = ref<RowHandle | null>(null)
const spRow = ref<RowHandle | null>(null)

const hasError = (r: unknown): r is { error: string } =>
  typeof r === 'object' && r !== null && 'error' in r

/** Runs an inline create: a refusal or failure does nothing visible. */
async function attempt<T>(run: () => Promise<T | { error: string }>): Promise<T | null> {
  try {
    const res = await run()
    return hasError(res) ? null : res
  } catch {
    return null
  }
}

async function addChapter(f: Record<string, string>): Promise<void> {
  const name = (f.name ?? '').trim()
  const number = Number(f.number)
  if (name === '' || !Number.isFinite(number) || f.number === '') return
  const made = await attempt(() =>
    createChapter({
      subjectId: Number(v.subjectId),
      educationLevelId: Number(v.levelId),
      name,
      chapterNumber: number,
    }),
  )
  if (!made) return
  chapters.value = sorted([...chapters.value, made])
  v.chapterId = String(made.id)
  chapterRow.value?.done()
}
async function addTopic(f: Record<string, string>): Promise<void> {
  const name = (f.name ?? '').trim()
  if (name === '' || v.chapterId === '') return
  const made = await attempt(() => createTopic({ chapterId: Number(v.chapterId), name }))
  if (!made) return
  topics.value = [...topics.value, made]
  v.topicId = String(made.id)
  topicRow.value?.done()
}
async function addBidang(f: Record<string, string>): Promise<void> {
  const code = (f.code ?? '').trim()
  const name = (f.name ?? '').trim()
  if (code === '' || name === '') return
  const made = await attempt(() =>
    createBidang({
      subjectId: Number(v.subjectId),
      educationLevelId: Number(v.levelId),
      code,
      name,
    }),
  )
  if (!made) return
  bidangs.value = [...bidangs.value, made]
  v.bidangId = String(made.id)
  bidangRow.value?.done()
}
async function addSk(f: Record<string, string>): Promise<void> {
  const code = (f.code ?? '').trim()
  const description = (f.description ?? '').trim()
  if (code === '' || description === '' || v.bidangId === '') return
  const made = await attempt(() => createSk({ bidangId: Number(v.bidangId), code, description }))
  if (!made) return
  sks.value = [...sks.value, made]
  v.skId = String(made.id)
  skRow.value?.done()
}
async function addSp(f: Record<string, string>): Promise<void> {
  const code = (f.code ?? '').trim()
  const description = (f.description ?? '').trim()
  if (code === '' || description === '' || v.skId === '') return
  const made = await attempt(() => createSp({ skId: Number(v.skId), code, description }))
  if (!made) return
  sps.value = [...sps.value, made]
  v.spId = String(made.id)
  spRow.value?.done()
}

const CHAPTER_FIELDS: PanelField[] = [
  { key: 'number', placeholder: 'No.', type: 'number', min: 1, max: 99, narrow: true },
  { key: 'name', placeholder: 'Nama bab...' },
]
const TOPIC_FIELDS: PanelField[] = [{ key: 'name', placeholder: 'Nama topik...' }]
const BIDANG_FIELDS: PanelField[] = [
  { key: 'code', placeholder: 'Kod (cth: B1)', narrow: true },
  { key: 'name', placeholder: 'Nama bidang...' },
]
const SK_FIELDS: PanelField[] = [
  { key: 'code', placeholder: 'Kod (cth: 1.1)', narrow: true },
  { key: 'description', placeholder: 'Penerangan SK...' },
]
const SP_FIELDS: PanelField[] = [
  { key: 'code', placeholder: 'Kod (cth: 1.1.1)', narrow: true },
  { key: 'description', placeholder: 'Penerangan SP...' },
]

const chapterOptions = computed(() =>
  chapters.value.map((c) => ({ value: String(c.id), label: chapterLabel(c) })),
)
const topicOptions = computed(() =>
  topics.value.map((t) => ({ value: String(t.id), label: t.name })),
)
const bidangOptions = computed(() =>
  bidangs.value.map((b) => ({ value: String(b.id), label: bidangLabel(b) })),
)
const skOptions = computed(() =>
  sks.value.map((s) => ({ value: String(s.id), label: `${s.code} — ${s.description}` })),
)
const spOptions = computed(() =>
  sps.value.map((s) => ({ value: String(s.id), label: `${s.code} — ${s.description}` })),
)

// --- question text, keyboard, preview --------------------------------------------------------
const textarea = ref<HTMLTextAreaElement | null>(null)
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

const galleryOpen = ref(false)

// --- submit and errors -----------------------------------------------------------------------

function submit(): void {
  emit('submit', buildBody(v), image.value, optionImages.value)
}

const invalid = (props: Record<string, string>, key: string): string | false =>
  key in props && FORM_ERROR_MODIFIER

const CARD = 'min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6'
const CARD_TITLE = 'mb-4 flex items-center gap-2 text-base font-bold text-slate-800'
const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const SEL = [FORM_SELECT_CLASS, 'min-h-11 bg-white']
</script>

<template>
  <form
    method="post"
    enctype="multipart/form-data"
    class="min-w-0 space-y-4"
    data-testid="question-form"
    @submit.prevent="submit"
  >
    <AlertBox :messages="general" data-testid="form-errors" />

    <!-- Maklumat Soalan -->
    <section :class="CARD" data-testid="info-card">
      <h2 :class="CARD_TITLE">
        <Tag class="h-5 w-5 text-teal-600" />
        Maklumat Soalan
      </h2>
      <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div class="min-w-0">
          <label for="q-level" :class="LABEL">Tahap Pendidikan *</label>
          <select
            id="q-level"
            v-model="v.levelId"
            name="education_level_id"
            required
            :class="[...SEL, invalid(fields, 'educationLevelId')]"
            data-testid="q-level"
          >
            <option value="">-- Pilih Tahap --</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </select>
          <p v-if="fields.educationLevelId" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.educationLevelId }}
          </p>
        </div>
        <div class="min-w-0">
          <label for="q-subject" :class="LABEL">Mata Pelajaran *</label>
          <select
            id="q-subject"
            v-model="v.subjectId"
            name="subject_id"
            required
            :class="[...SEL, invalid(fields, 'subjectId')]"
            data-testid="q-subject"
          >
            <option value="">-- Pilih Subjek --</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </select>
          <p v-if="fields.subjectId" :class="FORM_ERROR_TEXT_CLASS">{{ fields.subjectId }}</p>
        </div>

        <div class="min-w-0">
          <AddRow
            id="q-chapter"
            ref="chapterRow"
            v-model="v.chapterId"
            label="Bab (Pilihan)"
            placeholder="-- Pilih Bab --"
            :options="chapterOptions"
            :add-disabled="!ready"
            add-title="Tambah Bab Baru"
            panel-title="Bab Baru"
            :panel-fields="CHAPTER_FIELDS"
            testid="q-chapter"
            @add="addChapter"
          />
          <p v-if="fields.curriculumChapterId" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.curriculumChapterId }}
          </p>
        </div>
        <div class="min-w-0">
          <AddRow
            id="q-topic"
            ref="topicRow"
            v-model="v.topicId"
            label="Topik (Pilihan)"
            placeholder="-- Pilih Topik --"
            :options="topicOptions"
            :add-disabled="v.chapterId === ''"
            add-title="Tambah Topik Baru"
            panel-title="Topik Baru"
            :panel-fields="TOPIC_FIELDS"
            testid="q-topic"
            @add="addTopic"
          />
          <p v-if="fields.curriculumTopicId" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.curriculumTopicId }}
          </p>
        </div>

        <div class="min-w-0">
          <label for="q-type" :class="LABEL">Jenis Soalan *</label>
          <select
            id="q-type"
            v-model="v.questionType"
            name="question_type"
            required
            :class="[...SEL, invalid(fields, 'questionType')]"
            data-testid="q-type"
          >
            <option v-for="t in QUESTION_TYPES" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </select>
          <p v-if="fields.questionType" :class="FORM_ERROR_TEXT_CLASS">{{ fields.questionType }}</p>
        </div>
        <div class="min-w-0">
          <label for="q-difficulty" :class="LABEL">Tahap Kesukaran *</label>
          <select
            id="q-difficulty"
            v-model="v.difficulty"
            name="difficulty_level"
            required
            :class="[...SEL, invalid(fields, 'difficultyLevel')]"
            data-testid="q-difficulty"
          >
            <option value="">-- Pilih Tahap --</option>
            <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
          <p v-if="fields.difficultyLevel" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.difficultyLevel }}
          </p>
        </div>
        <div class="min-w-0">
          <label for="q-script" :class="LABEL">Jenis Tulisan</label>
          <select
            id="q-script"
            v-model="v.scriptType"
            name="script_type"
            :class="SEL"
            data-testid="q-script"
          >
            <option v-for="s in SCRIPTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Pemetaan DSKP -->
    <section :class="[CARD, 'border-l-4 border-emerald-500']" data-testid="dskp-card">
      <h2 :class="[CARD_TITLE, 'mb-1']">
        <BookOpen class="h-5 w-5 text-emerald-600" />
        Pemetaan DSKP
      </h2>
      <p class="mb-4 text-xs text-slate-500">
        Dokumen Standard Kurikulum dan Pentaksiran — Bidang → Standard Kandungan → Standard
        Pembelajaran
      </p>
      <div class="min-w-0 space-y-4">
        <AddRow
          id="q-bidang"
          ref="bidangRow"
          v-model="v.bidangId"
          label="Bidang / Tema"
          placeholder="-- Pilih Bidang --"
          :options="bidangOptions"
          :add-disabled="!ready"
          add-title="Tambah Bidang Baru"
          panel-title="Bidang Baru"
          :panel-fields="BIDANG_FIELDS"
          testid="q-bidang"
          @add="addBidang"
        />
        <AddRow
          id="q-sk"
          ref="skRow"
          v-model="v.skId"
          label="Standard Kandungan (SK)"
          placeholder="-- Pilih SK --"
          :options="skOptions"
          :disabled="v.bidangId === ''"
          :add-disabled="v.bidangId === ''"
          add-title="Tambah SK Baru"
          panel-title="SK Baru"
          :panel-fields="SK_FIELDS"
          testid="q-sk"
          @add="addSk"
        />
        <AddRow
          id="q-sp"
          ref="spRow"
          v-model="v.spId"
          label="Standard Pembelajaran (SP)"
          placeholder="-- Pilih SP --"
          :options="spOptions"
          :disabled="v.skId === ''"
          :add-disabled="v.skId === ''"
          add-title="Tambah SP Baru"
          panel-title="SP Baru"
          :panel-fields="SP_FIELDS"
          testid="q-sp"
          @add="addSp"
        />
        <p v-if="fields.dskpSpId" :class="FORM_ERROR_TEXT_CLASS">{{ fields.dskpSpId }}</p>
        <p class="flex items-center gap-1.5 text-xs text-slate-500">
          <Info class="h-3.5 w-3.5 shrink-0" />
          Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR.
        </p>
      </div>
    </section>

    <!-- Soalan -->
    <section :class="CARD" data-testid="text-card">
      <h2 :class="CARD_TITLE">
        <CircleHelp class="h-5 w-5 text-blue-600" />
        Soalan
      </h2>
      <div class="relative min-w-0">
        <textarea
          id="q-text"
          ref="textarea"
          v-model="v.questionText"
          name="question_text"
          rows="4"
          maxlength="2000"
          required
          :placeholder="rtl ? 'اكتب السؤال هنا...' : 'Tuliskan soalan di sini...'"
          :dir="rtl ? 'rtl' : undefined"
          :class="[FORM_TEXTAREA_CLASS, 'block pb-14', invalid(fields, 'questionText')]"
          :style="rtl ? { fontFamily: `'Scheherazade New', 'Lateef', serif` } : undefined"
          data-testid="q-text"
        ></textarea>
        <button
          type="button"
          title="Papan kekunci Arab / Jawi"
          :class="[
            'absolute bottom-2 left-2 inline-flex h-11 w-11 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
            keyboardOpen
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100',
          ]"
          data-testid="vkb-toggle"
          @mousedown.prevent
          @click="toggleKeyboard"
        >
          <Keyboard class="h-4 w-4" />
        </button>
      </div>
      <p v-if="fields.questionText" :class="FORM_ERROR_TEXT_CLASS">{{ fields.questionText }}</p>
      <ArabicKeyboardPanel
        v-if="keyboardOpen"
        v-model:mode="keyboardMode"
        :anchor="textarea"
        @insert="insertKey"
        @backspace="backspaceKey"
        @close="keyboardOpen = false"
      />

      <div
        v-if="v.scriptType !== 'rumi'"
        class="mt-3 min-w-0 rounded-xl bg-slate-50 p-3"
        data-testid="q-preview"
      >
        <p class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Eye class="h-3.5 w-3.5" />
          Pratonton paparan soalan:
        </p>
        <p
          class="min-w-0 text-lg break-words whitespace-pre-wrap text-slate-800"
          :dir="rtl ? 'rtl' : undefined"
          :style="rtl ? { fontFamily: `'Scheherazade New', 'Lateef', serif` } : undefined"
          data-testid="q-preview-text"
        >
          {{ v.questionText || '(Tiada teks lagi)' }}
        </p>
      </div>

      <div class="mt-4 min-w-0">
        <span :class="[LABEL, 'flex items-center gap-2']">
          <Images class="h-4 w-4 text-teal-600" />
          Imej Soalan (Pilihan)
        </span>
        <ImageField
          v-model:file="image"
          variant="question"
          name="question_image"
          testid="q-image"
          @gallery="galleryOpen = true"
        />
        <p v-if="fields.questionImage" :class="FORM_ERROR_TEXT_CLASS">{{ fields.questionImage }}</p>
      </div>
    </section>

    <!-- Answer blocks -->
    <section v-if="v.questionType === 'mcq'" :class="CARD" data-testid="mcq-card">
      <h2 :class="[CARD_TITLE, 'mb-1']">
        <ListChecks class="h-5 w-5 text-violet-600" />
        Pilihan Jawapan
      </h2>
      <p class="mb-4 text-sm text-slate-500">Masukkan 4 pilihan dan pilih jawapan yang betul.</p>
      <div class="min-w-0 space-y-3">
        <div
          v-for="(letter, i) in OPTION_LETTERS"
          :key="letter"
          class="min-w-0 rounded-xl border border-slate-200 p-3"
          :data-testid="`q-option-row-${String(i)}`"
        >
          <div class="flex min-w-0 items-center gap-3">
            <label class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
              <input
                v-model="v.correct"
                type="radio"
                name="correct_option"
                :value="i"
                class="h-5 w-5 accent-indigo-600"
                :data-testid="`q-correct-${String(i)}`"
              />
            </label>
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700"
            >
              {{ letter }}
            </span>
            <input
              v-model="v.options[i]"
              type="text"
              :name="`options[${String(i)}][text]`"
              required
              maxlength="500"
              :placeholder="`Pilihan ${letter}`"
              :class="[FORM_INPUT_CLASS, 'min-h-11 min-w-0 flex-1']"
              :data-testid="`q-option-${String(i)}`"
            />
          </div>
          <div class="mt-2 pl-0 sm:pl-14">
            <ImageField
              :file="optionImages[i] ?? null"
              variant="option"
              :name="`options[${String(i)}][image]`"
              :testid="`q-option-image-${String(i)}`"
              @update:file="optionImages[i] = $event"
            />
          </div>
        </div>
      </div>
      <p v-if="fields.options" :class="FORM_ERROR_TEXT_CLASS">{{ fields.options }}</p>
      <p v-if="fields.correctAnswer" :class="FORM_ERROR_TEXT_CLASS">{{ fields.correctAnswer }}</p>
      <p class="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Info class="h-3.5 w-3.5 shrink-0" />
        Klik butang bulat untuk memilih jawapan yang betul.
      </p>
    </section>

    <section v-else-if="v.questionType === 'true_false'" :class="CARD" data-testid="tf-card">
      <h2 :class="[CARD_TITLE, 'mb-1']">Jawapan Betul / Salah</h2>
      <p class="mb-4 text-sm text-slate-500">Pilih jawapan yang betul untuk pernyataan ini.</p>
      <div class="flex flex-wrap gap-4">
        <label class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
          <input
            v-model="v.tfAnswer"
            type="radio"
            name="tf_answer"
            value="true"
            required
            class="h-5 w-5 accent-emerald-600"
            data-testid="q-tf-true"
          />
          Betul
        </label>
        <label class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
          <input
            v-model="v.tfAnswer"
            type="radio"
            name="tf_answer"
            value="false"
            required
            class="h-5 w-5 accent-red-600"
            data-testid="q-tf-false"
          />
          Salah
        </label>
      </div>
      <p v-if="fields.tfAnswer" :class="FORM_ERROR_TEXT_CLASS">{{ fields.tfAnswer }}</p>
    </section>

    <section
      v-else-if="v.questionType === 'short_answer' || v.questionType === 'fill_blank'"
      :class="CARD"
      data-testid="short-card"
    >
      <h2 :class="[CARD_TITLE, 'mb-1']">Jawapan Betul</h2>
      <p class="mb-4 text-sm text-slate-500">
        <template v-if="v.questionType === 'short_answer'">
          Masukkan jawapan yang betul. Pelajar akan dipadankan secara automatik.
        </template>
        <template v-else>
          Gunakan <code>___</code> dalam soalan untuk tempat kosong, dan masukkan jawapan betul di
          bawah.
        </template>
      </p>
      <div class="min-w-0 space-y-4">
        <div>
          <label for="q-answer" :class="LABEL">Jawapan Utama *</label>
          <input
            id="q-answer"
            v-model="v.correctAnswerText"
            type="text"
            name="correct_answer"
            required
            maxlength="500"
            placeholder="Jawapan yang betul..."
            :class="[FORM_INPUT_CLASS, 'min-h-11', invalid(fields, 'correctAnswer')]"
            data-testid="q-answer"
          />
          <p v-if="fields.correctAnswer" :class="FORM_ERROR_TEXT_CLASS">
            {{ fields.correctAnswer }}
          </p>
        </div>
        <div>
          <label for="q-alt" :class="LABEL">Jawapan Alternatif (Pilihan)</label>
          <input
            id="q-alt"
            v-model="v.altAnswers"
            type="text"
            name="alt_answers"
            maxlength="500"
            placeholder="Pisahkan dengan koma, cth: jawapan1, jawapan2"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="q-alt"
          />
          <p class="mt-1 text-xs text-slate-500">
            Jawapan alternatif yang juga diterima sebagai betul.
          </p>
        </div>
      </div>
    </section>

    <section v-else :class="CARD" data-testid="essay-card">
      <h2 :class="[CARD_TITLE, 'mb-1']">Jawapan Contoh (Model Answer)</h2>
      <p class="mb-4 text-sm text-slate-500">
        Masukkan jawapan contoh sebagai rujukan pelajar selepas menjawab.
      </p>
      <textarea
        id="q-model"
        v-model="v.modelAnswer"
        name="model_answer"
        rows="6"
        placeholder="Tulis jawapan contoh di sini..."
        :class="FORM_TEXTAREA_CLASS"
        data-testid="q-model"
      ></textarea>
    </section>

    <!-- Penerangan -->
    <section :class="CARD" data-testid="explanation-card">
      <h2 :class="CARD_TITLE">
        <Lightbulb class="h-5 w-5 text-amber-500" />
        Penerangan (Pilihan)
      </h2>
      <textarea
        id="q-explanation"
        v-model="v.explanation"
        name="explanation"
        rows="3"
        maxlength="2000"
        placeholder="Terangkan jawapan yang betul untuk membantu pelajar faham..."
        :class="FORM_TEXTAREA_CLASS"
        data-testid="q-explanation"
      ></textarea>
    </section>

    <div class="flex items-center justify-between gap-3">
      <RouterLink
        to="/guru/soalan"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        data-testid="form-cancel"
      >
        <X class="h-4 w-4" />
        Batal
      </RouterLink>
      <button
        type="submit"
        :disabled="saving"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-sm font-bold text-white shadow transition hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
        data-testid="form-submit"
      >
        <LoadingSpinner v-if="saving" :size="16" />
        <Send v-else class="h-4 w-4" />
        Hantar untuk Semakan
      </button>
    </div>

    <GaleriRajahModal :open="galleryOpen" @close="galleryOpen = false" />
  </form>
</template>
