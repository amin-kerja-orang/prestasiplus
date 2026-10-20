<script setup lang="ts">
/**
 * Semak Ekstrak (v2-question-bank 4.8): the source page (image or text) beside the extracted
 * questions. Per question: stem, type and leaf mode, options / parts, mark scheme, DSKP tag.
 * Stimulus groups: a figure or passage is stored once and several questions attach to it; the
 * group stays contiguous. "Hantar untuk semakan" is blocked until the quality gates pass.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { usePageMeta } from '@/composables/usePageMeta'
import { DsEmptyState, DsPage, DsPanel, DsStateView, DsStatusBadge } from '@/ds'

import StimulusView from '../../../components/StimulusView.vue'
import { formatDateTime } from '../../../lib/use-bijak'
import { bijakAdminServer } from '../../../server/client'
import { isUnavailable, UNAVAILABLE_TITLE } from '../../../server/errors'
import QuestionEditor from '../components/QuestionEditor.vue'
import {
  attachToStimulus,
  detachFromStimulus,
  groupLabel,
  groupsOf,
  removeStimulus,
} from '../domain/grouping'
import { paperMarks, questionMarks } from '../domain/marks'
import { validateBatch } from '../domain/validation'
import { blankQuestion, nextLabel } from '../domain/blank'
import { INTAKE_LIST_PATH } from '../lib/intake-routes'
import { getPageImages } from '../lib/page-images'
import type { IntakeBatch, IntakeIssue, IntakeQuestion, IntakeStimulus } from '../types'

const props = defineProps<{ batchId: string }>()
const pageMeta = usePageMeta()
const server = bijakAdminServer()

const batch = ref<IntakeBatch | null>(null)
const loadState = ref<'loading' | 'error' | 'missing' | 'unavailable' | 'ready'>('loading')
const readonly = computed(() => batch.value?.status !== 'draf')
/** A batch typed by hand has no file: no source panel, the editor takes the full width. */
const isManual = computed(() => batch.value?.sourceKind === 'manual')
const paperBack = computed(() =>
  batch.value?.forPaperId ? `/admin/spm/kertas/${encodeURIComponent(batch.value.forPaperId)}?menunggu=1` : '',
)
// The shell header (breadcrumb title) and tab title match the page for a manual batch.
watch(isManual, (m) => {
  if (!m) return
  pageMeta.setHeader({ title: 'Tulis Soalan Manual', subtitle: 'Taip soalan sendiri tanpa PDF' })
  pageMeta.setTitle('Tulis Soalan Manual - Admin PRESTASIPLUS')
})
const mobileTab = ref<'soalan' | 'sumber'>('soalan')
const pageNo = ref(1)
const open = ref<Set<string>>(new Set())
const saveState = ref<'tersimpan' | 'belum' | 'menyimpan' | 'gagal'>('tersimpan')
const submitting = ref(false)
const submittedNote = ref(false)
const stepUnavailable = ref(false)
const serverIssues = ref<IntakeIssue[]>([])
const groupNote = ref('')
const showIssues = ref(false)

const images = computed(() => getPageImages(props.batchId))
const pageImage = computed(() => images.value.find((i) => i.page === pageNo.value))
const pageText = computed(() => batch.value?.pages.find((p) => p.page === pageNo.value))

async function load(): Promise<void> {
  loadState.value = 'loading'
  try {
    batch.value = await server.getIntakeBatch(props.batchId)
    loadState.value = 'ready'
    const first = batch.value.questions[0]
    if (first) open.value = new Set([first.id])
  } catch (e) {
    loadState.value = isUnavailable(e)
      ? 'unavailable'
      : (e as { code?: string }).code === 'not_found'
        ? 'missing'
        : 'error'
  }
}
onMounted(load)

/* ------------------------------------------------------------------------------ autosave */
let timer: ReturnType<typeof setTimeout> | undefined
let loaded = false
watch(
  () => [batch.value?.questions, batch.value?.stimuli],
  () => {
    if (!batch.value || readonly.value) return
    if (!loaded) {
      loaded = true
      return
    }
    saveState.value = 'belum'
    clearTimeout(timer)
    timer = setTimeout(() => void save(), 700)
  },
  { deep: true },
)
onBeforeUnmount(() => {
  clearTimeout(timer)
  if (saveState.value === 'belum') void save()
})

async function save(): Promise<void> {
  const b = batch.value
  if (!b || b.status !== 'draf') return
  saveState.value = 'menyimpan'
  try {
    await server.saveExtracted(b.id, { questions: b.questions, stimuli: b.stimuli })
    saveState.value = 'tersimpan'
  } catch {
    saveState.value = 'gagal'
  }
}

/* ------------------------------------------------------------------------------ derived */
const issues = computed<IntakeIssue[]>(() => (batch.value ? validateBatch(batch.value) : []))
const groups = computed(() => groupsOf(batch.value?.questions ?? []))
const total = computed(() => paperMarks(batch.value?.questions ?? []))
const issuesByQuestion = computed(() => {
  const m = new Map<string, number>()
  for (const i of issues.value) if (i.questionId) m.set(i.questionId, (m.get(i.questionId) ?? 0) + 1)
  return m
})
const stimulusOf = (q: IntakeQuestion): IntakeStimulus | undefined =>
  batch.value?.stimuli.find((s) => s.id === q.stimulusId)
const startsGroup = (i: number): boolean => {
  const qs = batch.value?.questions ?? []
  return !!qs[i]?.stimulusId && qs[i].stimulusId !== qs[i - 1]?.stimulusId
}
const groupFor = (q: IntakeQuestion) => groups.value.find((g) => g.stimulusId === q.stimulusId)

const saveText = computed(
  () =>
    ({
      tersimpan: 'Semua perubahan disimpan',
      belum: 'Perubahan belum disimpan',
      menyimpan: 'Menyimpan...',
      gagal: 'Gagal menyimpan',
    })[saveState.value],
)

/* ------------------------------------------------------------------------------ edit */
function updateQuestion(id: string, q: IntakeQuestion): void {
  if (!batch.value) return
  batch.value.questions = batch.value.questions.map((x) => (x.id === id ? q : x))
}
function addQuestion(): void {
  const b = batch.value
  if (!b) return
  const q = blankQuestion(b.subject, nextLabel(b.questions), pageNo.value)
  b.questions = [...b.questions, q]
  open.value = new Set([...open.value, q.id])
}
function removeQuestion(id: string): void {
  if (!batch.value) return
  batch.value.questions = batch.value.questions.filter((q) => q.id !== id)
}
function toggle(id: string): void {
  const s = new Set(open.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  open.value = s
}

/* ------------------------------------------------------------------------------ stimuli */
function addStimulus(kind: 'diagram' | 'passage'): void {
  const b = batch.value
  if (!b) return
  const word = kind === 'diagram' ? 'Rajah' : 'Petikan'
  const n = b.stimuli.filter((s) => s.label.startsWith(word)).length + 1
  b.stimuli = [
    ...b.stimuli,
    {
      id: `stim-${Date.now().toString(36)}`,
      kind,
      label: `${word} ${n}`,
      alt: '',
      page: pageNo.value,
      ...(kind === 'passage' ? { text: '' } : {}),
    },
  ]
}
function patchStimulus(id: string, p: Partial<IntakeStimulus>): void {
  if (!batch.value) return
  batch.value.stimuli = batch.value.stimuli.map((s) => (s.id === id ? { ...s, ...p } : s))
}
function dropStimulus(id: string): void {
  if (!batch.value) return
  const r = removeStimulus(batch.value.questions, batch.value.stimuli, id)
  batch.value.questions = r.questions
  batch.value.stimuli = r.stimuli
}
function inGroup(stimulusId: string, q: IntakeQuestion): boolean {
  return q.stimulusId === stimulusId
}
function toggleMember(stimulusId: string, qid: string, on: boolean): void {
  const b = batch.value
  if (!b) return
  if (on) {
    const r = attachToStimulus(b.questions, [qid], stimulusId)
    b.questions = r.questions
    groupNote.value = r.moved
      ? 'Soalan dipindahkan supaya kumpulan kekal berturutan.'
      : ''
  } else {
    b.questions = detachFromStimulus(b.questions, [qid])
    groupNote.value = ''
  }
}
function quickAttach(qid: string, stimulusId: string): void {
  toggleMember(stimulusId || '', qid, false)
  if (stimulusId) toggleMember(stimulusId, qid, true)
}
function previewImage(s: IntakeStimulus) {
  return images.value.find((i) => i.page === s.page)
}

/* ------------------------------------------------------------------------------ submit */
function goTo(i: IntakeIssue): void {
  if (!i.questionId) return
  open.value = new Set([...open.value, i.questionId])
  mobileTab.value = 'soalan'
  setTimeout(
    () => document.getElementById(`q-${i.questionId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    50,
  )
}

async function submit(): Promise<void> {
  const b = batch.value
  if (!b || issues.value.length > 0 || submitting.value) return
  submitting.value = true
  try {
    clearTimeout(timer)
    await save()
    const res = await server.submitForReview(b.id)
    if (res.ok) {
      batch.value = res.batch
      submittedNote.value = true
    } else {
      serverIssues.value = res.issues
      showIssues.value = true
    }
  } catch (e) {
    if (!isUnavailable(e)) throw e
    stepUnavailable.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DsPage
    layout="report"
    :title="isManual ? 'Tulis Soalan Manual' : 'Semak Ekstrak'"
    :subtitle="
      batch
        ? isManual
          ? `Soalan manual · ${batch.source} · ${batch.year}`
          : `${batch.fileName} · ${batch.year}`
        : undefined
    "
    back-label="Kembali ke Senarai Ekstrak"
    :back-to="INTAKE_LIST_PATH"
    data-testid="intake-review-page"
  >
    <DsEmptyState v-if="loadState === 'unavailable'" :title="UNAVAILABLE_TITLE" data-testid="unavailable-state" />
    <DsStateView
      v-else
      :status="loadState === 'ready' ? 'ready' : loadState === 'loading' ? 'loading' : 'error'"
      :error="
        loadState === 'missing'
          ? 'Kumpulan ekstrak tidak ditemui.'
          : 'Tidak dapat memuatkan kumpulan ekstrak.'
      "
      skeleton="cards"
      @retry="load"
    >
      <template v-if="batch">
        <!-- summary + submit -->
        <DsPanel data-testid="review-summary">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <DsStatusBadge
                :status="batch.status === 'draf' ? 'draft' : 'awaiting-review'"
                :label="batch.status === 'draf' ? 'Draf' : 'Semakan'"
              />
              <span>{{ batch.questions.length }} soalan</span>
              <span>{{ total }} markah</span>
              <span>{{ groups.length }} kumpulan rajah</span>
              <UBadge v-if="isManual" variant="subtle" color="primary" data-testid="manual-badge">
                Manual
              </UBadge>
              <span v-else class="text-muted">
                Pengekstrak: {{ batch.provider }} ({{ batch.model }})
              </span>
              <span
                class="text-muted"
                aria-live="polite"
                data-testid="save-state"
              >
                {{ readonly ? `Dihantar ${formatDateTime(batch.submittedAt ?? batch.updatedAt)}` : saveText }}
              </span>
            </div>
            <div v-if="!readonly" class="flex flex-wrap items-center gap-2">
              <UButton
                variant="outline"
                color="neutral"
                icon="i-ph-floppy-disk"
                data-testid="save-draft"
                @click="save"
              >
                Simpan draf
              </UButton>
              <UButton
                icon="i-ph-paper-plane-tilt"
                :disabled="issues.length > 0"
                :loading="submitting"
                data-testid="submit-review"
                @click="submit"
              >
                Hantar untuk semakan
              </UButton>
            </div>
          </div>

          <UAlert
            v-if="batch.itemsUnavailable || stepUnavailable"
            class="mt-4"
            color="neutral"
            variant="subtle"
            icon="i-ph-info"
            :title="UNAVAILABLE_TITLE"
            description="Soalan yang diekstrak dan penyuntingan belum tersedia dalam demo. Halaman dan teks fail yang dimuat naik dipaparkan sahaja."
            data-testid="step-unavailable"
          />

          <UAlert
            v-if="submittedNote || readonly"
            class="mt-4"
            color="success"
            variant="subtle"
            icon="i-ph-check-circle"
            title="Dihantar untuk semakan"
            description="Kumpulan ini kini dalam status Semakan dan tidak boleh disunting. Pelajar tidak melihatnya sehingga diluluskan dan diterbitkan."
            data-testid="submitted-note"
          >
            <template #actions>
              <UButton
                to="/admin/spm/semakan"
                size="sm"
                color="success"
                variant="outline"
                icon="i-ph-seal-check"
                data-testid="goto-queue"
              >
                Buka Baris Gilir Semakan
              </UButton>
              <UButton
                v-if="paperBack"
                :to="paperBack"
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-ph-stack"
                data-testid="back-to-paper"
              >
                Kembali ke Pembina Kertas
              </UButton>
            </template>
          </UAlert>
          <template v-else>
            <button
              type="button"
              class="mt-4 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left"
              :class="issues.length > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
              :aria-expanded="showIssues"
              data-testid="issues-toggle"
              @click="showIssues = !showIssues"
            >
              <span class="font-medium">
                {{
                  issues.length > 0
                    ? `${issues.length} perkara perlu dibaiki sebelum dihantar`
                    : 'Semua semakan kualiti lulus. Sedia dihantar.'
                }}
              </span>
              <span class="i-ph-caret-down" aria-hidden="true" />
            </button>
            <ul
              v-if="showIssues && issues.length > 0"
              class="mt-2 flex max-h-72 flex-col gap-1 overflow-auto"
              data-testid="issues-list"
            >
              <li v-for="(i, k) in issues" :key="k">
                <button
                  type="button"
                  class="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-elevated"
                  @click="goTo(i)"
                >
                  <span class="font-medium">{{ i.where }}:</span> {{ i.message }}
                </button>
              </li>
            </ul>
          </template>
          <UAlert
            v-if="batch.unmatched.length > 0"
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-ph-warning"
            title="Skema tidak dipadankan"
            :description="batch.unmatched.join(', ')"
          />
        </DsPanel>

        <!-- mobile switch -->
        <div v-if="!isManual" class="flex gap-2 lg:hidden" role="tablist" aria-label="Paparan">
          <UButton
            v-for="t in [
              { v: 'soalan', l: 'Soalan' },
              { v: 'sumber', l: 'Sumber kertas' },
            ] as const"
            :key="t.v"
            role="tab"
            :aria-selected="mobileTab === t.v"
            :variant="mobileTab === t.v ? 'solid' : 'outline'"
            color="neutral"
            class="flex-1 justify-center"
            @click="mobileTab = t.v"
          >
            {{ t.l }}
          </UButton>
        </div>

        <div
          class="grid min-w-0 gap-6"
          :class="isManual ? '' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start'"
        >
          <!-- source (stimuli only for a manual batch) -->
          <aside
            :class="
              isManual
                ? 'block'
                : [
                    mobileTab === 'sumber' ? 'block' : 'hidden lg:block',
                    'lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto',
                  ]
            "
            class="flex min-w-0 flex-col gap-3"
            :aria-label="isManual ? 'Rajah dan petikan' : 'Sumber kertas'"
            data-testid="source-panel"
          >
            <DsPanel v-if="!isManual">
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-semibold">Halaman sumber</p>
                  <UBadge v-if="pageText" variant="subtle" color="neutral">
                    {{ pageText.source === 'ocr' ? 'OCR' : 'Lapisan teks' }}
                  </UBadge>
                </div>
                <div class="flex flex-wrap gap-1" role="group" aria-label="Pilih halaman">
                  <UButton
                    v-for="p in batch.pages"
                    :key="p.page"
                    size="sm"
                    :variant="pageNo === p.page ? 'solid' : 'outline'"
                    color="neutral"
                    :aria-pressed="pageNo === p.page"
                    @click="pageNo = p.page"
                  >
                    {{ p.page }}
                  </UButton>
                </div>
                <img
                  v-if="pageImage"
                  :src="pageImage.dataUrl"
                  :alt="`Halaman ${pageNo} kertas`"
                  class="w-full rounded-lg border border-default"
                />
                <pre
                  v-else-if="pageText"
                  class="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm"
                  data-testid="source-text"
                  >{{ pageText.text }}</pre
                >
              </div>
            </DsPanel>

            <!-- stimuli -->
            <DsPanel data-testid="stimulus-panel">
              <fieldset :disabled="readonly" class="flex min-w-0 flex-col gap-4">
                <legend class="mb-1 font-semibold">Rajah dan petikan</legend>
                <p class="text-sm text-muted">
                  Satu rajah disimpan sekali. Pilih soalan yang berkongsinya; soalan itu kekal berturutan.
                </p>
                <p v-if="batch.stimuli.length === 0" class="text-sm text-muted">
                  Tiada rajah atau petikan.
                </p>
                <p
                  v-if="groupNote"
                  class="rounded-lg bg-info/10 p-2 text-sm text-info"
                  role="status"
                  data-testid="group-note"
                >
                  {{ groupNote }}
                </p>
                <div
                  v-for="s in batch.stimuli"
                  :key="s.id"
                  class="flex flex-col gap-3 rounded-xl border border-default p-3"
                  data-testid="stimulus-card"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-medium">{{ s.label }}</p>
                    <UButton
                      icon="i-ph-trash"
                      color="error"
                      variant="ghost"
                      :aria-label="`Buang ${s.label}`"
                      @click="dropStimulus(s.id)"
                    />
                  </div>
                  <StimulusView v-if="s.svg || s.text" :stimulus="s" />
                  <img
                    v-else-if="previewImage(s)"
                    :src="previewImage(s)!.dataUrl"
                    :alt="s.alt || `Halaman ${s.page}`"
                    class="max-h-48 w-full rounded-lg border border-default object-contain"
                  />
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="text-muted">Tajuk kapsyen</span>
                    <input
                      :value="s.caption ?? ''"
                      class="min-h-11 rounded-lg border border-default bg-default px-3"
                      :aria-label="`Kapsyen ${s.label}`"
                      @input="patchStimulus(s.id, { caption: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="text-muted">Teks alternatif (wajib)</span>
                    <input
                      :value="s.alt"
                      class="min-h-11 rounded-lg border border-default bg-default px-3"
                      :aria-label="`Teks alternatif ${s.label}`"
                      data-testid="stimulus-alt"
                      @input="patchStimulus(s.id, { alt: ($event.target as HTMLInputElement).value })"
                    />
                  </label>
                  <label v-if="s.kind === 'passage'" class="flex flex-col gap-1 text-sm">
                    <span class="text-muted">Teks petikan</span>
                    <textarea
                      :value="s.text ?? ''"
                      rows="3"
                      class="rounded-lg border border-default bg-default p-3"
                      @input="patchStimulus(s.id, { text: ($event.target as HTMLTextAreaElement).value })"
                    />
                  </label>
                  <fieldset class="flex flex-col gap-1">
                    <legend class="mb-1 text-sm font-medium">Soalan dalam kumpulan ini</legend>
                    <UCheckbox
                      v-for="q in batch.questions"
                      :key="q.id"
                      :model-value="inGroup(s.id, q)"
                      :disabled="!!q.stimulusId && q.stimulusId !== s.id"
                      :label="`Soalan ${q.label}${q.stimulusId && q.stimulusId !== s.id ? ' (dalam kumpulan lain)' : ''}`"
                      :data-testid="`group-${s.id}-q${q.label}`"
                      @update:model-value="(v: boolean | 'indeterminate') => toggleMember(s.id, q.id, v === true)"
                    />
                  </fieldset>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-if="!isManual"
                    size="sm"
                    variant="outline"
                    color="neutral"
                    icon="i-ph-image"
                    data-testid="add-diagram"
                    @click="addStimulus('diagram')"
                  >
                    Tambah rajah
                  </UButton>
                  <UButton
                    size="sm"
                    variant="outline"
                    color="neutral"
                    icon="i-ph-article"
                    @click="addStimulus('passage')"
                  >
                    Tambah petikan
                  </UButton>
                </div>
              </fieldset>
            </DsPanel>
          </aside>

          <!-- questions -->
          <section
            :class="isManual || mobileTab === 'soalan' ? 'block' : 'hidden lg:block'"
            class="flex min-w-0 flex-col gap-4"
            aria-label="Soalan diekstrak"
            data-testid="questions-panel"
          >
            <div class="flex min-w-0 flex-col gap-4">
              <template v-for="(q, i) in batch.questions" :key="q.id">
                <div
                  v-if="startsGroup(i) && stimulusOf(q)"
                  class="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4"
                  data-testid="group-header"
                >
                  <p class="text-sm font-semibold">
                    {{ stimulusOf(q)!.label }}
                    <span v-if="groupFor(q)" class="font-normal text-muted">
                      · {{ groupLabel(groupFor(q)!) }} berkongsi rajah ini
                    </span>
                  </p>
                  <StimulusView v-if="stimulusOf(q)!.svg || stimulusOf(q)!.text" :stimulus="stimulusOf(q)!" />
                  <p v-else class="text-sm text-muted">{{ stimulusOf(q)!.alt || 'Tiada pratonton' }}</p>
                </div>
                <article
                  :id="`q-${q.id}`"
                  class="scroll-mt-4 overflow-hidden rounded-2xl border bg-default"
                  :class="q.stimulusId ? 'border-primary/30 ml-3 sm:ml-6' : 'border-default'"
                  :data-testid="`question-card`"
                  :data-label="q.label"
                >
                  <button
                    type="button"
                    class="flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
                    :aria-expanded="open.has(q.id)"
                    :aria-controls="`qb-${q.id}`"
                    @click="toggle(q.id)"
                  >
                    <span class="text-lg font-bold">{{ q.label }}</span>
                    <UBadge variant="subtle" color="neutral">
                      {{ q.type === 'mcq' ? 'Objektif' : q.type === 'structured' ? 'Berstruktur' : q.type === 'essay' ? 'Esei' : 'Pendek' }}
                    </UBadge>
                    <span class="text-sm text-muted">{{ questionMarks(q) }} markah</span>
                    <UBadge v-if="stimulusOf(q)" variant="subtle" color="primary">
                      {{ stimulusOf(q)!.label }}
                    </UBadge>
                    <UBadge
                      v-if="issuesByQuestion.get(q.id)"
                      variant="subtle"
                      color="warning"
                      data-testid="q-issues"
                    >
                      {{ issuesByQuestion.get(q.id) }} isu
                    </UBadge>
                    <UBadge v-else variant="subtle" color="success">Sedia</UBadge>
                    <span class="min-w-0 flex-1 basis-full truncate text-sm text-muted sm:basis-auto">
                      {{ q.stem || q.parts[0]?.prompt }}
                    </span>
                    <span
                      :class="open.has(q.id) ? 'i-ph-caret-up' : 'i-ph-caret-down'"
                      class="ml-auto"
                      aria-hidden="true"
                    />
                  </button>
                  <fieldset
                    v-if="open.has(q.id)"
                    :id="`qb-${q.id}`"
                    :disabled="readonly"
                    class="flex min-w-0 flex-col gap-4 border-t border-default p-4"
                  >
                    <label class="flex max-w-sm flex-col gap-1 text-sm">
                      <span class="font-medium">Rajah / petikan dikongsi</span>
                      <select
                        :value="q.stimulusId ?? ''"
                        class="min-h-11 rounded-lg border border-default bg-default px-3"
                        data-testid="q-stimulus"
                        @change="quickAttach(q.id, ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="">Tiada</option>
                        <option v-for="s in batch.stimuli" :key="s.id" :value="s.id">{{ s.label }}</option>
                      </select>
                    </label>
                    <QuestionEditor
                      :model-value="q"
                      @update:model-value="updateQuestion(q.id, $event)"
                    />
                    <div class="flex justify-end">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-ph-trash"
                        @click="removeQuestion(q.id)"
                      >
                        Buang soalan
                      </UButton>
                    </div>
                  </fieldset>
                </article>
              </template>
              <div v-if="!readonly">
                <UButton
                  icon="i-ph-plus"
                  variant="outline"
                  color="neutral"
                  data-testid="add-question"
                  @click="addQuestion"
                >
                  Tambah soalan
                </UButton>
              </div>
            </div>
          </section>
        </div>
      </template>
    </DsStateView>
  </DsPage>
</template>
