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
  DsFormField,
  DsFormSection,
  DsNativeSelect,
  DsPanel,
  DsRtlScope,
  DsStack,
  DsGrid,
  DsCluster,
  DsText,
} from '@/ds'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import {
  ArabicKeyboardPanel,
  backspaceAtCaret,
  insertAtCaret,
  type KeyboardMode,
} from '@/modules/m04-question-bank'

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
  correctItems,
  OPTION_LETTERS,
  TF_ITEMS,
  QUESTION_TYPES,
  type PanelField,
  SCRIPTS,
} from './lib'

const CORRECT_ITEMS = correctItems()

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

const galleryOpen = ref(false)

// --- submit and errors -----------------------------------------------------------------------

function submit(): void {
  emit('submit', buildBody(v), image.value, optionImages.value)
}
</script>

<template>
  <DsStack
    method="post"
    enctype="multipart/form-data"
    as="form"
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

    <!-- Maklumat Soalan -->
    <DsFormSection title="Maklumat Soalan" icon="tag" accent="action" data-testid="info-card">
      <DsGrid :cols="{ base: 1, md: 2 }">
        <div class="min-w-0">
          <label for="q-level" class="mb-2 block text-label text-highlighted"
            >Tahap Pendidikan *</label
          >
          <DsNativeSelect
            id="q-level"
            v-model="v.levelId"
            name="education_level_id"
            required
            data-testid="q-level"
          >
            <option value="">-- Pilih Tahap --</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </DsNativeSelect>
          <p v-if="fields.educationLevelId" class="mt-1 text-caption text-error">
            {{ fields.educationLevelId }}
          </p>
        </div>
        <div class="min-w-0">
          <label for="q-subject" class="mb-2 block text-label text-highlighted"
            >Mata Pelajaran *</label
          >
          <DsNativeSelect
            id="q-subject"
            v-model="v.subjectId"
            name="subject_id"
            required
            data-testid="q-subject"
          >
            <option value="">-- Pilih Subjek --</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </DsNativeSelect>
          <p v-if="fields.subjectId" class="mt-1 text-caption text-error">{{ fields.subjectId }}</p>
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
          <p v-if="fields.curriculumChapterId" class="mt-1 text-caption text-error">
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
          <p v-if="fields.curriculumTopicId" class="mt-1 text-caption text-error">
            {{ fields.curriculumTopicId }}
          </p>
        </div>

        <div class="min-w-0">
          <label for="q-type" class="mb-2 block text-label text-highlighted">Jenis Soalan *</label>
          <DsNativeSelect
            id="q-type"
            v-model="v.questionType"
            name="question_type"
            required
            data-testid="q-type"
          >
            <option v-for="t in QUESTION_TYPES" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </DsNativeSelect>
          <p v-if="fields.questionType" class="mt-1 text-caption text-error">
            {{ fields.questionType }}
          </p>
        </div>
        <div class="min-w-0">
          <label for="q-difficulty" class="mb-2 block text-label text-highlighted"
            >Tahap Kesukaran *</label
          >
          <DsNativeSelect
            id="q-difficulty"
            v-model="v.difficulty"
            name="difficulty_level"
            required
            data-testid="q-difficulty"
          >
            <option value="">-- Pilih Tahap --</option>
            <option v-for="d in DIFFICULTIES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </DsNativeSelect>
          <p v-if="fields.difficultyLevel" class="mt-1 text-caption text-error">
            {{ fields.difficultyLevel }}
          </p>
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
      </DsGrid>
    </DsFormSection>

    <!-- Pemetaan DSKP -->
    <DsFormSection title="Pemetaan DSKP" icon="book-open" accent="win" data-testid="dskp-card">
      <p class="mb-4 text-caption text-muted">
        Dokumen Standard Kurikulum dan Pentaksiran — Bidang → Standard Kandungan → Standard
        Pembelajaran
      </p>
      <DsStack>
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
        <DsText v-if="fields.dskpSpId" variant="caption" tone="error">{{ fields.dskpSpId }}</DsText>
        <p class="flex items-center gap-2 text-caption text-muted">
          <UIcon name="i-ph-info-duotone" class="size-4 shrink-0" />
          Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR.
        </p>
      </DsStack>
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
          required
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
      <p v-if="fields.questionText" class="mt-1 text-caption text-error">
        {{ fields.questionText }}
      </p>
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
          <DsText
            variant="body"
            wrap="anywhere"
            class="min-w-0 whitespace-pre-wrap"
            :dir="rtl ? 'rtl' : undefined"
            data-testid="q-preview-text"
          >
            {{ v.questionText || '(Tiada teks lagi)' }}
          </DsText>
        </DsRtlScope>
      </DsPanel>

      <div class="mt-4 min-w-0">
        <span class="mb-2 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-images-duotone" class="size-4 text-primary-t" />
          Imej Soalan (Pilihan)
        </span>
        <ImageField
          v-model:file="image"
          variant="question"
          name="question_image"
          testid="q-image"
          @gallery="galleryOpen = true"
        />
        <p v-if="fields.questionImage" class="mt-1 text-caption text-error">
          {{ fields.questionImage }}
        </p>
      </div>
    </DsFormSection>

    <!-- Answer blocks -->
    <DsFormSection
      v-if="v.questionType === 'mcq'"
      title="Pilihan Jawapan"
      icon="list-checks"
      accent="trial"
      data-testid="mcq-card"
    >
      <p class="mb-4 text-body text-muted">Masukkan 4 pilihan dan pilih jawapan yang betul.</p>
      <URadioGroup
        id="q-correct"
        v-model="v.correct"
        legend="Jawapan betul"
        orientation="horizontal"
        :items="CORRECT_ITEMS"
        class="mb-4"
        data-testid="q-correct"
      />
      <DsStack gap="sm">
        <DsPanel
          v-for="(letter, i) in OPTION_LETTERS"
          :key="letter"
          tone="inset"
          :data-testid="`q-option-row-${String(i)}`"
        >
          <DsCluster :wrap="false">
            <UBadge color="primary" variant="subtle" size="lg">{{ letter }}</UBadge>
            <UInput
              v-model="v.options[i]"
              type="text"
              :name="`options[${String(i)}][text]`"
              required
              maxlength="500"
              :placeholder="`Pilihan ${letter}`"
              :aria-label="`Pilihan ${letter}`"
              class="min-w-0 flex-1"
              :data-testid="`q-option-${String(i)}`"
            />
          </DsCluster>
          <div class="mt-2 sm:pl-16">
            <ImageField
              :file="optionImages[i] ?? null"
              variant="option"
              :name="`options[${String(i)}][image]`"
              :testid="`q-option-image-${String(i)}`"
              @update:file="optionImages[i] = $event"
            />
          </div>
        </DsPanel>
      </DsStack>
      <p v-if="fields.options" class="mt-2 text-caption text-error">{{ fields.options }}</p>
      <p v-if="fields.correctAnswer" class="mt-2 text-caption text-error">
        {{ fields.correctAnswer }}
      </p>
      <p class="mt-3 flex items-center gap-2 text-caption text-muted">
        <UIcon name="i-ph-info-duotone" class="size-4 shrink-0" />
        Klik butang bulat untuk memilih jawapan yang betul.
      </p>
    </DsFormSection>

    <DsFormSection
      v-else-if="v.questionType === 'true_false'"
      title="Jawapan Betul / Salah"
      icon="check-square"
      accent="trial"
      data-testid="tf-card"
    >
      <p class="mb-4 text-body text-muted">Pilih jawapan yang betul untuk pernyataan ini.</p>
      <URadioGroup
        id="q-tf"
        v-model="v.tfAnswer"
        legend="Jawapan betul"
        orientation="horizontal"
        :items="TF_ITEMS"
        data-testid="q-tf"
      />
      <p v-if="fields.tfAnswer" class="mt-1 text-caption text-error">{{ fields.tfAnswer }}</p>
    </DsFormSection>

    <DsFormSection
      v-else-if="v.questionType === 'short_answer' || v.questionType === 'fill_blank'"
      title="Jawapan Betul"
      icon="pencil-simple-line"
      accent="trial"
      data-testid="short-card"
    >
      <p class="mb-4 text-body text-muted">
        <template v-if="v.questionType === 'short_answer'">
          Masukkan jawapan yang betul. Pelajar akan dipadankan secara automatik.
        </template>
        <template v-else>
          Gunakan <code>___</code> dalam soalan untuk tempat kosong, dan masukkan jawapan betul di
          bawah.
        </template>
      </p>
      <DsStack>
        <DsFormField label="Jawapan Utama *" name="q-answer" :error="fields.correctAnswer">
          <UInput
            id="q-answer"
            v-model="v.correctAnswerText"
            type="text"
            name="correct_answer"
            required
            maxlength="500"
            placeholder="Jawapan yang betul..."
            class="w-full"
            data-testid="q-answer"
          />
        </DsFormField>
        <DsFormField
          label="Jawapan Alternatif (Pilihan)"
          name="q-alt"
          help="Jawapan alternatif yang juga diterima sebagai betul."
        >
          <UInput
            id="q-alt"
            v-model="v.altAnswers"
            type="text"
            name="alt_answers"
            maxlength="500"
            placeholder="Pisahkan dengan koma, cth: jawapan1, jawapan2"
            class="w-full"
            data-testid="q-alt"
          />
        </DsFormField>
      </DsStack>
    </DsFormSection>

    <DsFormSection
      v-else
      title="Jawapan Contoh (Model Answer)"
      icon="article"
      accent="trial"
      data-testid="essay-card"
    >
      <p class="mb-4 text-body text-muted">
        Masukkan jawapan contoh sebagai rujukan pelajar selepas menjawab.
      </p>
      <UTextarea
        id="q-model"
        v-model="v.modelAnswer"
        name="model_answer"
        :rows="6"
        placeholder="Tulis jawapan contoh di sini..."
        :aria-label="'Jawapan Contoh (Model Answer)'"
        class="w-full"
        data-testid="q-model"
      />
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
    </DsFormSection>

    <DsCluster justify="between" :wrap="false">
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
        >Hantar untuk Semakan</UButton
      >
    </DsCluster>

    <GaleriRajahModal :open="galleryOpen" @close="galleryOpen = false" />
  </DsStack>
</template>
