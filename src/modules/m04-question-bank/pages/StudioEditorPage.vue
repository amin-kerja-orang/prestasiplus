<script setup lang="ts">
/**
 * Studio "Cipta soalan" / "Sunting soalan" (R1-F03b, T13). One long page with a tab bar `1 Tag`, `2 Kertas`, `3 Rangsangan`,
 * `4 Sub-bahagian` (FR-QA-16), a save bar `{n} markah` `· {n} belum lengkap` `Simpan draf` with the completeness panel above it, and these additions of V3: the shared stimulus is a GROUP of questions (D90), every leaf carries TP and
 * Aras pemikiran, the unit and SP come from the DSKP tree, the Bab is a select (D89), and pictures go through the files
 * module. A draft saves with gaps; the gate is at approval. The status bar (Hantar untuk semakan, Terbitkan, Arkib, Edit sebagai
 * draf, Dilihat murid di) is `StudioStatusBar` (R1-F03a).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useFlash } from '@/composables'
import { useSessionStore } from '@/stores'
import { DsCallout, DsCluster, DsDrawer, DsFormBar, DsFormField, DsFormSection, DsGrid, DsLoadError, DsNativeSelect, DsPage, DsPillNav, DsStack, DsText, StimulusFigure } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import {
  createGroup,
  createQuestionInGroup,
  createStimulus,
  createStudioQuestion,
  fetchGateCheck,
  fetchGroup,
  fetchStudioQuestion,
  STUDIO_UNAVAILABLE,
  studioAvailable,
  updateStudioQuestion,
  type StudioQuestionDetail,
} from '../api/studio'
import ArabicKeyboardPanel from '../components/ArabicKeyboardPanel.vue'
import ChapterSelect from '../components/ChapterSelect.vue'
import StudioCompletenessPanel from '../components/studio/StudioCompletenessPanel.vue'
import StudioDskpFields from '../components/studio/StudioDskpFields.vue'
import StudioGroupEditor from '../components/studio/StudioGroupEditor.vue'
import StudioImageField from '../components/studio/StudioImageField.vue'
import StudioLeafEditor from '../components/studio/StudioLeafEditor.vue'
import StudioPreview from '../components/studio/StudioPreview.vue'
import StudioStatusBar from '../components/studio/StudioStatusBar.vue'
import { backspaceAtCaret, insertAtCaret, type KeyboardMode } from '../lib/arabic-keyboard'
import { studioFieldErrors } from '../lib/studio/field-errors'
import type { GroupView } from '../lib/studio/group-members'
import { toStimulusData } from '../lib/studio/preview'
import { stimulusIssue, toCreateBody, type PendingGroup } from '../lib/studio/stimulus'
import {
  asksScript,
  blankDraft,
  blankLeaf,
  completenessRows,
  draftGaps,
  draftTp,
  draftTpNote,
  hydrate,
  KESUKARAN,
  nextLeafLabel,
  SCRIPT_TYPES,
  toRequestBody,
  totalMarks,
  type StudioDraft,
} from '../lib/studio/draft'
import {
  clearSnapshot,
  loadSnapshot,
  recoveryKey,
  RECOVERY_MESSAGE,
  sameDraft,
  saveSnapshot,
} from '../lib/studio/recovery'
import { errorLines, GENERIC_ERROR, LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const flash = useFlash()

const edit = computed(() => props.id !== undefined)
const draft = ref<StudioDraft>(blankDraft())
const subjects = ref<{ id: string; name: string }[]>([])
const levels = ref<{ id: string; name: string }[]>([])
const status = ref('draft')
const unsupported = ref<string[]>([])
const loadFailed = ref(false)
const loading = ref(true)
const saving = ref(false)
const problems = ref<string[]>([])
const fieldProblems = ref<Record<string, string>>({})

const groupView = ref<GroupView | null>(null)
/** D93: a shared stimulus prepared on the create page; it is created with the question in `save` (no orphan group). */
const pendingGroup = ref<PendingGroup | null>(null)
const previewOpen = ref(false)
/** AC-ADM-R3: below 1024 px a `Rangsangan` button in the save bar opens the group's stimulus in a sheet; the form stays mounted, so typed text is kept. */
const wide = useMedia('(width >= 64rem)')
const stimulusOpen = ref(false)
const stimuli = computed(() => (groupView.value?.stimuli ?? []).map(toStimulusData))
watch(wide, (w) => {
  if (w) stimulusOpen.value = false
})

/* ---- draft recovery (V2 flow 1 step 2): unsaved work is kept in the browser and offered again ---- */
const store: Storage | null = typeof window === 'undefined' ? null : window.localStorage
const storeKey = computed(() => recoveryKey(session.user?.id === undefined ? 'tetamu' : String(session.user.id), props.id))
const saved = ref<StudioDraft | null>(null)
const offer = ref<StudioDraft | null>(null)
let keepTimer: ReturnType<typeof setTimeout> | undefined

function startRecovery(): void {
  saved.value = JSON.parse(JSON.stringify(draft.value)) as StudioDraft
  const snap = store === null ? null : loadSnapshot(store, storeKey.value)
  offer.value = snap !== null && !sameDraft(snap, draft.value) ? snap : null
  if (snap !== null && offer.value === null && store !== null) clearSnapshot(store, storeKey.value)
}
function restore(): void {
  if (offer.value) draft.value = offer.value
  offer.value = null
}
function discard(): void {
  if (store !== null) clearSnapshot(store, storeKey.value)
  offer.value = null
}
watch(
  draft,
  () => {
    if (store === null || loading.value || offer.value !== null || saved.value === null || readOnly.value) return
    clearTimeout(keepTimer)
    keepTimer = setTimeout(() => {
      if (sameDraft(draft.value, saved.value as StudioDraft)) clearSnapshot(store, storeKey.value)
      else saveSnapshot(store, storeKey.value, draft.value)
    }, 600)
  },
  { deep: true },
)
onBeforeUnmount(() => clearTimeout(keepTimer))

const SERVING = ['approved', 'published']
/** An approved or published question is read-only until "Edit sebagai draf" (V2 S1.3); that button writes the draft version. */
const unlocked = computed(() => !SERVING.includes(status.value))
const readOnly = computed(() => !unlocked.value || unsupported.value.length > 0)
/** The form differs from what is stored: a status move would act on the stored version. */
const dirty = computed(() => saved.value !== null && !sameDraft(draft.value, saved.value))
const subjectName = computed(() => subjects.value.find((x) => x.id === draft.value.subjectId)?.name ?? '')
const showScript = computed(() => asksScript(subjectName.value))

/* ---- FR: the flat form's keyboard (imported, not rewritten) on every text editor of a non-Rumi question (decision 5 on #428) ---- */
const keyboardOpen = ref(false)
const keyboardMode = ref<KeyboardMode>('arab')
const keyboardTarget = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const showKeyboard = computed(() => showScript.value && draft.value.scriptType !== 'rumi' && !readOnly.value)
watch(showKeyboard, (on) => {
  if (!on) keyboardOpen.value = false
})
function trackField(e: FocusEvent): void {
  const el = e.target
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === 'text')) keyboardTarget.value = el
}
function toggleKeyboard(): void {
  keyboardOpen.value = !keyboardOpen.value
  if (keyboardOpen.value && !keyboardTarget.value?.isConnected) {
    keyboardTarget.value = document.querySelector<HTMLTextAreaElement>('[data-testid="studio-stem"]')
  }
}
async function keyEdit(compute: (v: string, s: number, e: number) => { value: string; caret: number }): Promise<void> {
  const el = keyboardTarget.value
  if (!el?.isConnected) return
  const next = compute(el.value, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length)
  el.value = next.value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  el.setSelectionRange(next.caret, next.caret)
  el.focus()
}

const levelName = computed(() => levels.value.find((l) => l.id === draft.value.educationLevelId)?.name ?? '')
/** What the fields have read about the Subjek + Tingkatan; null = not known yet. */
const hasDskp = ref<boolean | null>(null)
const hasChapters = ref<boolean | null>(null)
const gaps = computed(() => draftGaps(draft.value, levelName.value, { hasChapters: hasChapters.value }))
/** What API-Q-05 says about the stored question; null before a save or when the read failed. */
const gateIssues = ref<{ path: string; message: string }[] | null>(null)
const gateFailed = ref(false)
const chaptersFailed = ref(false)
const dskpFailed = ref(false)
const checkFailed = computed(() => gateFailed.value || chaptersFailed.value || dskpFailed.value)
const completeness = computed(() =>
  completenessRows({ draft: draft.value, gaps: gaps.value, issues: gateIssues.value, stored: edit.value ? saved.value : null, hasDskp: hasDskp.value }),
)
const tabs = [
  { key: 'tag', label: '1 Tag' },
  { key: 'kertas', label: '2 Kertas' },
  { key: 'rangsangan', label: '3 Rangsangan' },
  { key: 'sub', label: '4 Sub-bahagian' },
] as const
type TabKey = (typeof tabs)[number]['key']
const active = ref<TabKey>('tag')

function go(key: TabKey): void {
  active.value = key
  document.getElementById(`studio-section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** The jump link of the panel: scroll to the field and focus it, or the first control inside it. */
function jump(field: string): void {
  // The SP block exists once a Tajuk DSKP is chosen.
  const el = document.querySelector<HTMLElement>(`[data-testid="${field}"]`) ?? (field === 'studio-sp' ? document.querySelector<HTMLElement>('[data-testid="studio-unit"]') : null)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // A themed select hides its native control, so the focus goes to the first control of the field.
  const holder = el.closest<HTMLElement>('[data-ds="form-field"]') ?? el
  const target = holder.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button') ?? el
  target.focus({ preventScroll: true })
}

/** A question made from its group starts on the group's Subjek, Tingkatan and Kertas (PRD45 6.3). A failed read leaves them to the admin. */
async function prefillFromGroup(id: string): Promise<void> {
  try {
    const g = await fetchGroup(id)
    if (g.subjectId) draft.value.subjectId = g.subjectId
    if (g.educationLevelId) draft.value.educationLevelId = g.educationLevelId
    if (g.kertas) draft.value.kertas = g.kertas as StudioDraft['kertas']
  } catch {
    // The group editor below shows its own load error.
  }
}

async function readGate(id: string): Promise<void> {
  gateFailed.value = false
  try {
    gateIssues.value = (await fetchGateCheck(id)).issues
  } catch {
    gateIssues.value = null
    gateFailed.value = true
  }
}

/** FR-ADM-Q04.7: arriving from the old flat form, once; the query is then removed. */
function noteOldForm(): void {
  if (route.query.dari !== 'borang-lama') return
  flash.success('Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini.')
  const { dari: _dari, ...query } = route.query
  void _dari
  void router.replace({ path: route.path, query })
}

let loadSeq = 0
async function load(): Promise<void> {
  const token = ++loadSeq
  loading.value = true
  loadFailed.value = false
  keyboardOpen.value = false
  keyboardTarget.value = null
  try {
    const [s, l] = await Promise.all([fetchSubjects(), fetchEducationLevels()])
    subjects.value = s.data.map((x) => ({ id: String(x.id), name: x.name }))
    levels.value = l.data.map((x) => ({ id: String(x.id), name: x.name }))
    if (props.id === undefined && typeof route.query.kumpulan === 'string' && /^\d+$/.test(route.query.kumpulan)) {
      draft.value.groupId = route.query.kumpulan
      await prefillFromGroup(route.query.kumpulan)
    }
    if (props.id !== undefined) {
      const q: StudioQuestionDetail = await fetchStudioQuestion(props.id)
      // A move to another question while this read ran: the newer load owns the form.
      if (token !== loadSeq) return
      const h = hydrate(q)
      draft.value = h.draft
      unsupported.value = h.unsupported
      status.value = q.status
      await readGate(props.id)
      // S2-T03: the V2 `/preview` path arrives here with `?pratonton=1`.
      if (route.query.pratonton === '1') previewOpen.value = true
    }
  } catch {
    if (token === loadSeq) loadFailed.value = true
  } finally {
    if (token === loadSeq) loading.value = false
  }
  if (token === loadSeq && !loadFailed.value) startRecovery()
}
onMounted(() => {
  noteOldForm()
  if (studioAvailable()) void load()
  else loading.value = false
})
// The route to `/sunting` after the first save keeps this page instance: read the stored question and its gate.
watch(
  () => props.id,
  (id, was) => {
    if (id !== undefined && id !== was && studioAvailable()) void load()
  },
)

function addLeaf(): void {
  draft.value.leaves.push(blankLeaf(nextLeafLabel(draft.value.leaves)))
}
function removeLeaf(uid: string): void {
  draft.value.leaves = draft.value.leaves.filter((l) => l.uid !== uid)
}

async function save(): Promise<void> {
  saving.value = true
  problems.value = []
  fieldProblems.value = {}
  try {
    if (edit.value && props.id !== undefined) {
      const res = await updateStudioQuestion(props.id, toRequestBody(draft.value, { sendScript: showScript.value }))
      flash.success(res.status)
      if (store !== null) clearSnapshot(store, storeKey.value)
      await load()
    } else {
      // D93: a group made (or joined) on this page before the question exists takes the question when it is saved.
      let into = draft.value.groupId
      const pend = pendingGroup.value
      if (into === null && pend !== null) {
        const issue = stimulusIssue(pend.form)
        if (issue !== null) {
          problems.value = [issue]
          return
        }
        const stim = await createStimulus(toCreateBody(pend.form))
        const label = pend.form.label.trim() === '' ? null : pend.form.label.trim()
        const g = await createGroup({ label, stimulusIds: [stim.data.id], questionIds: pend.memberIds })
        // If the question then fails to save, a retry joins this group instead of making another one.
        into = g.data.id
        draft.value.groupId = g.data.id
      }
      const body = toRequestBody(draft.value, { sendScript: showScript.value })
      const res = into === null ? await createStudioQuestion(body) : await createQuestionInGroup(into, body)
      flash.success('Soalan draf disimpan. Terbitkan melalui semakan apabila sedia.')
      clearTimeout(keepTimer)
      if (store !== null) clearSnapshot(store, storeKey.value)
      await router.replace(`/admin/studio/questions/${res.data.id}/sunting`)
    }
  } catch (err) {
    fieldProblems.value = isApiError(err) ? studioFieldErrors(err.fields) : {}
    problems.value = errorLines(err)
    if (problems.value.length === 0) problems.value = [GENERIC_ERROR]
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage layout="form" back-to="/admin/studio" data-testid="studio-editor-page">
    <DsCallout v-if="!studioAvailable()" tone="info" data-testid="studio-unavailable">{{ STUDIO_UNAVAILABLE }}</DsCallout>
    <DsLoadError v-else-if="loadFailed" :message="LOAD_ERROR" testid="studio-load-error" retry-testid="studio-load-retry" @retry="load" />
    <DsText v-else-if="loading" variant="body" tone="muted" data-testid="studio-loading">Memuatkan…</DsText>

    <DsStack v-else as="form" gap="lg" data-testid="studio-form" @submit.prevent="save" @focusin="trackField">
      <DsCallout v-if="offer" tone="warning" data-testid="studio-recovery">
        {{ RECOVERY_MESSAGE }}
        <template #actions>
          <DsCluster gap="sm">
            <UButton type="button" color="primary" data-testid="studio-recovery-restore" @click="restore">Pulihkan</UButton>
            <UButton type="button" color="neutral" variant="soft" data-testid="studio-recovery-discard" @click="discard">Buang</UButton>
          </DsCluster>
        </template>
      </DsCallout>

      <DsCallout v-if="problems.length > 0" tone="error" :title="`Ada masalah — ${problems.length} ralat.`" data-testid="studio-problems">
        <DsText v-for="p in problems" :key="p" variant="body">{{ p }}</DsText>
      </DsCallout>

      <StudioStatusBar
        v-if="edit && props.id !== undefined"
        :question-id="props.id"
        :status="status"
        :dirty="dirty"
        :unsupported="unsupported.length > 0"
        :in-group="draft.groupId !== null"
        @changed="load"
        @refused="fieldProblems = $event"
      />
      <DsCallout v-if="unsupported.length > 0" tone="warning" title="Soalan ini belum boleh disunting di Studio" data-testid="studio-unsupported">
        <DsText v-for="u in unsupported" :key="u" variant="body">{{ u }}</DsText>
      </DsCallout>

      <DsCluster gap="sm">
        <UButton type="button" color="neutral" variant="soft" data-testid="studio-preview-open" @click="previewOpen = true">Pratonton</UButton>
      </DsCluster>

      <DsPillNav :items="tabs" :active="active" label="Bahagian borang" testid-prefix="studio-tab" @select="go" />

      <!-- Langkah 1 -->
      <DsStack id="studio-section-tag" as="section">
        <DsFormSection title="Langkah 1 Tag & pengelasan" description="Subjek, Tingkatan, Tajuk DSKP dan Bab untuk penapisan dan pelaporan." icon="stack">
          <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
            <DsFormField v-slot="{ id: fid }" native label="Subjek" for="studio-subject" required :error="fieldProblems.subjectId">
              <DsNativeSelect :id="fid" v-model="draft.subjectId" placeholder="Pilih subjek" :disabled="readOnly" data-testid="studio-subject">
                <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
              </DsNativeSelect>
            </DsFormField>
            <DsFormField v-slot="{ id: fid }" native label="Tingkatan" for="studio-level" required :error="fieldProblems.educationLevelId">
              <DsNativeSelect :id="fid" v-model="draft.educationLevelId" placeholder="Pilih Tingkatan" :disabled="readOnly" data-testid="studio-level">
                <option v-for="l in levels" :key="l.id" :value="l.id">{{ l.name }}</option>
              </DsNativeSelect>
            </DsFormField>
          </DsGrid>
          <StudioDskpFields v-model:unit-id="draft.unitId" v-model:sp-ids="draft.spIds" :subject-id="draft.subjectId" :level-id="draft.educationLevelId" :disabled="readOnly" :error="fieldProblems['tag.unitId']" @nodes="hasDskp = $event" @failed="dskpFailed = $event" />
          <ChapterSelect v-model="draft.chapterId" :subject-id="draft.subjectId" :level-id="draft.educationLevelId" :error="fieldProblems.curriculumChapterId" @chapters="hasChapters = $event" @failed="chaptersFailed = $event" />
          <DsFormField v-slot="{ id: fid }" native label="Tahap kesukaran" for="studio-difficulty" hint="Kesukaran ialah anggaran guru; TP ialah tahap DSKP." :error="fieldProblems.difficultyLevel">
            <DsNativeSelect :id="fid" v-model.number="draft.difficulty" :disabled="readOnly" data-testid="studio-difficulty">
              <option v-for="k in KESUKARAN" :key="k.value" :value="k.value">{{ k.label }}</option>
            </DsNativeSelect>
          </DsFormField>
        </DsFormSection>
      </DsStack>

      <!-- Langkah 2 -->
      <DsStack id="studio-section-kertas" as="section">
        <DsFormSection title="Langkah 2 Kertas & bahagian" description="Letak soalan dalam kertas peperiksaan, atau simpan sebagai soalan bank." icon="book-open">
          <DsFormField v-slot="{ id: fid }" native label="Kertas (pilihan)" for="studio-kertas" :error="fieldProblems.kertas">
            <DsNativeSelect :id="fid" v-model="draft.kertas" :disabled="readOnly" data-testid="studio-kertas">
              <option value="">— Soalan bank (tiada kertas) —</option>
              <option value="1">Kertas 1</option>
              <option value="2">Kertas 2</option>
              <option value="3">Kertas 3</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField v-slot="{ id: fid }" native label="Nombor soalan" for="studio-number" required :error="fieldProblems.numberLabel">
            <UInput :id="fid" v-model="draft.numberLabel" placeholder="1" maxlength="32" :disabled="readOnly" data-testid="studio-number" />
          </DsFormField>
          <DsFormField v-if="showScript" v-slot="{ id: fid }" native label="Jenis tulisan" for="studio-script" :error="fieldProblems.scriptType">
            <DsNativeSelect :id="fid" v-model="draft.scriptType" :disabled="readOnly" data-testid="studio-script">
              <option v-for="k in SCRIPT_TYPES" :key="k.value" :value="k.value">{{ k.label }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsCluster v-if="showKeyboard" gap="sm">
            <UButton type="button" color="neutral" variant="soft" icon="keyboard" title="Papan kekunci Arab / Jawi" data-testid="studio-keyboard-toggle" @mousedown.prevent @click="toggleKeyboard">Papan kekunci</UButton>
          </DsCluster>
          <DsFormField v-slot="{ id: fid }" native label="Teks soalan (stem)" for="studio-stem" required :error="fieldProblems.questionText">
            <UTextarea :id="fid" v-model="draft.stem" :rows="4" placeholder="Contoh: Rajah 1 menunjukkan litar bersiri." :disabled="readOnly" data-testid="studio-stem" />
          </DsFormField>
          <DsFormField label="Gambar soalan (pilihan)">
            <StudioImageField v-model="draft.stemImageToken" testid="studio-stem-image" :disabled="readOnly" />
          </DsFormField>
        </DsFormSection>
      </DsStack>

      <!-- Langkah 3 -->
      <DsStack id="studio-section-rangsangan" as="section">
        <DsFormSection title="Langkah 3 Rangsangan (stimulus)" description="Satu rangsangan dikongsi oleh semua soalan yang merujuknya. Ia dipaparkan sekali." icon="book-open-text">
          <!-- FR-ADM-QE2.2: a saved member shows the stimulus read-only; the group is changed on its own page. -->
          <UButton v-if="draft.groupId !== null" :to="`/admin/studio/groups/${draft.groupId}`" color="neutral" variant="soft" data-testid="studio-open-group">Buka kumpulan</UButton>
          <StudioGroupEditor v-model:group-id="draft.groupId" v-model:pending="pendingGroup" :current-question-id="props.id ?? null" :subject-id="draft.subjectId || null" :disabled="readOnly || draft.groupId !== null" @changed="groupView = $event" />
        </DsFormSection>
      </DsStack>

      <!-- Langkah 4 -->
      <DsStack id="studio-section-sub" as="section">
        <DsFormSection title="Langkah 4 Sub-bahagian" description="Setiap bahagian membawa jenis jawapan, markah dan skema tersendiri." icon="list">
          <DsText variant="label" data-testid="studio-total-marks">Jumlah markah: {{ totalMarks(draft) }}</DsText>
          <DsText v-if="draftTp(draft) !== null" variant="body" tone="muted" data-testid="studio-question-tp">TP soalan: {{ draftTp(draft) }} {{ draftTpNote(draft) }}</DsText>
          <StudioLeafEditor
            v-for="(leaf, i) in draft.leaves"
            :key="leaf.uid"
            :model-value="leaf"
            :testid="`studio-leaf-${i}`"
            :can-remove="draft.leaves.length > 1"
            :disabled="readOnly"
            :errors="fieldProblems"
            @update:model-value="draft.leaves[i] = $event"
            @remove="removeLeaf(leaf.uid)"
          />
          <UButton type="button" color="neutral" variant="soft" :disabled="readOnly" data-testid="studio-add-leaf" @click="addLeaf">
            + Sub-bahagian
          </UButton>
          <DsFormField v-slot="{ id: fid }" native label="Penjelasan" for="studio-explanation" hint="Penjelasan akan ditunjukkan kepada pelajar selepas menjawab" :error="fieldProblems.explanation">
            <UTextarea :id="fid" v-model="draft.explanation" :rows="3" placeholder="Penjelasan untuk jawapan (pilihan)" :disabled="readOnly" data-testid="studio-explanation" />
          </DsFormField>
          <DsFormField v-if="draft.explanationEn !== null" v-slot="{ id: fid }" native label="Penjelasan (English)" for="studio-explanation-en" :error="fieldProblems.explanationEn">
            <UTextarea :id="fid" v-model="draft.explanationEn" :rows="3" :disabled="readOnly" data-testid="studio-explanation-en" />
          </DsFormField>
        </DsFormSection>
      </DsStack>

      <StudioCompletenessPanel :rows="completeness" :load-failed="checkFailed" @jump="jump" />

      <DsFormBar submit-label="Simpan draf" :saving="saving" :disabled="readOnly" cancel-to="/admin/studio" data-testid="studio-save-bar">
        <template v-if="stimuli.length > 0 && !wide" #extra>
          <UButton type="button" color="neutral" variant="soft" aria-haspopup="dialog" data-testid="studio-stimulus-open" @click="stimulusOpen = true">Rangsangan</UButton>
        </template>
        <template #status>
          <DsText as="span" variant="caption" data-testid="studio-save-marks">{{ totalMarks(draft) }} markah</DsText>
          <DsText v-if="completeness.length > 0" as="span" variant="caption" data-testid="studio-save-gaps"> · {{ completeness.length }} belum lengkap</DsText>
        </template>
      </DsFormBar>
    </DsStack>
    <ArabicKeyboardPanel
      v-if="keyboardOpen"
      :key="keyboardTarget?.id ?? ''"
      v-model:mode="keyboardMode"
      :anchor="keyboardTarget"
      @insert="(text: string) => keyEdit((v, a, b) => insertAtCaret(v, a, b, text))"
      @backspace="keyEdit((v, a, b) => backspaceAtCaret(v, a, b))"
      @close="keyboardOpen = false"
    />
    <DsDrawer v-model:open="stimulusOpen" title="Rangsangan" data-testid="studio-stimulus-sheet">
      <DsStack gap="md">
        <StimulusFigure v-for="s in stimuli" :key="s.id" :stimulus="s" />
      </DsStack>
    </DsDrawer>
    <StudioPreview v-model:open="previewOpen" :group="groupView" :draft="draft" :question-id="props.id ?? null" />
  </DsPage>
</template>
