<script setup lang="ts">
/**
 * Studio "Cipta soalan" / "Sunting soalan" (R1-F03b, T13). One long page with a tab bar `Kertas`, `Rangsangan`,
 * `Sub-bahagian`, `Tag` (V2 cloud-student-mechanism section 3.1 step 2), a save bar `{n} markah` `· {n} belum lengkap`
 * `Simpan draf`, and these additions of V3: the shared stimulus is a GROUP of questions (D90), every leaf carries TP and
 * Aras pemikiran, the unit and SP come from the DSKP tree, the Bab is a select (D89), and pictures go through the files
 * module. A draft saves with gaps; the gate is at approval. Status buttons (Hantar untuk semakan, Terbitkan, Arkib) are F03a.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useFlash } from '@/composables'
import { DsBadge, DsCallout, DsCluster, DsFormBar, DsFormField, DsFormSection, DsGrid, DsLoadError, DsNativeSelect, DsPage, DsPillNav, DsStack, DsText } from '@/ds'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import {
  createStudioQuestion,
  fetchStudioQuestion,
  STUDIO_UNAVAILABLE,
  studioAvailable,
  updateStudioQuestion,
  type StudioGroup,
  type StudioQuestionDetail,
} from '../api/studio'
import ChapterSelect from '../components/ChapterSelect.vue'
import StudioDskpFields from '../components/studio/StudioDskpFields.vue'
import StudioGroupEditor from '../components/studio/StudioGroupEditor.vue'
import StudioImageField from '../components/studio/StudioImageField.vue'
import StudioLeafEditor from '../components/studio/StudioLeafEditor.vue'
import StudioPreview from '../components/studio/StudioPreview.vue'
import {
  blankDraft,
  blankLeaf,
  draftGaps,
  draftTp,
  hydrate,
  KESUKARAN,
  nextLeafLabel,
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
const originalGroupId = ref<string | null>(null)
/** An approved or published question is read-only until "Edit sebagai draf" (V2 S1.3). */
const unlocked = ref(true)

const groupView = ref<StudioGroup | null>(null)
const previewOpen = ref(false)

/* ---- draft recovery (V2 flow 1 step 2): unsaved work is kept in the browser and offered again ---- */
const store: Storage | null = typeof window === 'undefined' ? null : window.localStorage
const storeKey = computed(() => recoveryKey(props.id))
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
const readOnly = computed(() => !unlocked.value || unsupported.value.length > 0)
const gaps = computed(() => draftGaps(draft.value))
const tabs = [
  { key: 'kertas', label: 'Kertas' },
  { key: 'rangsangan', label: 'Rangsangan' },
  { key: 'sub', label: 'Sub-bahagian' },
  { key: 'tag', label: 'Tag' },
] as const
type TabKey = (typeof tabs)[number]['key']
const active = ref<TabKey>('kertas')

function go(key: TabKey): void {
  active.value = key
  document.getElementById(`studio-section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function load(): Promise<void> {
  loading.value = true
  loadFailed.value = false
  try {
    const [s, l] = await Promise.all([fetchSubjects(), fetchEducationLevels()])
    subjects.value = s.data.map((x) => ({ id: String(x.id), name: x.name }))
    levels.value = l.data.map((x) => ({ id: String(x.id), name: x.name }))
    if (props.id !== undefined) {
      const q: StudioQuestionDetail = await fetchStudioQuestion(props.id)
      const h = hydrate(q)
      draft.value = h.draft
      unsupported.value = h.unsupported
      status.value = q.status
      originalGroupId.value = h.draft.groupId
      unlocked.value = !SERVING.includes(q.status)
    }
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
  if (!loadFailed.value) startRecovery()
}
onMounted(() => {
  if (studioAvailable()) void load()
  else loading.value = false
})

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
      const res = await updateStudioQuestion(props.id, toRequestBody(draft.value, { groupId: originalGroupId.value }))
      flash.success(res.status)
      if (store !== null) clearSnapshot(store, storeKey.value)
      originalGroupId.value = res.data ? draft.value.groupId : originalGroupId.value
      await load()
      unlocked.value = !SERVING.includes(status.value)
    } else {
      const res = await createStudioQuestion(toRequestBody(draft.value))
      flash.success('Soalan draf disimpan. Terbitkan melalui semakan apabila sedia.')
      clearTimeout(keepTimer)
      if (store !== null) clearSnapshot(store, storeKey.value)
      await router.replace(`/admin/studio/questions/${res.data.id}/sunting`)
    }
  } catch (err) {
    fieldProblems.value = isApiError(err) ? { ...(err.fields ?? {}) } : {}
    problems.value = errorLines(err)
    if (problems.value.length === 0) problems.value = [GENERIC_ERROR]
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage layout="form" back-to="/admin/questions" data-testid="studio-editor-page">
    <DsCallout v-if="!studioAvailable()" tone="info" data-testid="studio-unavailable">{{ STUDIO_UNAVAILABLE }}</DsCallout>
    <DsLoadError v-else-if="loadFailed" :message="LOAD_ERROR" testid="studio-load-error" retry-testid="studio-load-retry" @retry="load" />
    <DsText v-else-if="loading" variant="body" tone="muted" data-testid="studio-loading">Memuatkan…</DsText>

    <DsStack v-else as="form" gap="lg" data-testid="studio-form" @submit.prevent="save">
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

      <DsCluster v-if="edit" gap="sm" data-testid="studio-status">
        <DsText variant="label">Status</DsText>
        <DsBadge :label="status" :tone="status === 'draft' ? 'neutral' : 'info'" />
        <DsText v-if="SERVING.includes(status)" variant="body" tone="muted">Soalan ini boleh dijawab oleh pelajar.</DsText>
        <DsText v-else-if="status === 'draft'" variant="body" tone="muted">Belum dipapar kepada pelajar.</DsText>
        <UButton v-if="SERVING.includes(status) && !unlocked" type="button" color="primary" variant="soft" data-testid="studio-edit-as-draft" @click="unlocked = true">
          Edit sebagai draf
        </UButton>
      </DsCluster>
      <DsCallout v-if="SERVING.includes(status) && !unlocked" tone="info" data-testid="studio-approved-note">
        Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya.
      </DsCallout>
      <DsCallout v-if="unsupported.length > 0" tone="warning" title="Soalan ini belum boleh disunting di Studio" data-testid="studio-unsupported">
        <DsText v-for="u in unsupported" :key="u" variant="body">{{ u }}</DsText>
      </DsCallout>

      <DsCluster gap="sm">
        <UButton type="button" color="neutral" variant="soft" data-testid="studio-preview-open" @click="previewOpen = true">Pratonton</UButton>
      </DsCluster>

      <DsPillNav :items="tabs" :active="active" label="Bahagian borang" testid-prefix="studio-tab" @select="go" />

      <!-- Langkah 1 -->
      <DsStack id="studio-section-kertas" as="section">
        <DsFormSection title="Langkah 1 Kertas & bahagian" description="Letak soalan dalam kertas peperiksaan, atau simpan sebagai soalan bank." icon="book-open">
          <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
            <DsFormField v-slot="{ id: fid }" native label="Subjek" for="studio-subject" required :error="fieldProblems.subjectId">
              <DsNativeSelect :id="fid" v-model="draft.subjectId" placeholder="Pilih subjek" :disabled="readOnly" data-testid="studio-subject">
                <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
              </DsNativeSelect>
            </DsFormField>
            <DsFormField v-slot="{ id: fid }" native label="Tahap" for="studio-level" required :error="fieldProblems.educationLevelId">
              <DsNativeSelect :id="fid" v-model="draft.educationLevelId" placeholder="Pilih tahap" :disabled="readOnly" data-testid="studio-level">
                <option v-for="l in levels" :key="l.id" :value="l.id">{{ l.name }}</option>
              </DsNativeSelect>
            </DsFormField>
            <DsFormField v-slot="{ id: fid }" native label="Kertas (pilihan)" for="studio-kertas" :error="fieldProblems.kertas">
              <DsNativeSelect :id="fid" v-model="draft.kertas" :disabled="readOnly" data-testid="studio-kertas">
                <option value="">— Soalan bank (tiada kertas) —</option>
                <option value="1">Kertas 1</option>
                <option value="2">Kertas 2</option>
                <option value="3">Kertas 3</option>
              </DsNativeSelect>
            </DsFormField>
          </DsGrid>
          <DsFormField v-slot="{ id: fid }" native label="Teks soalan (stem)" for="studio-stem" required :error="fieldProblems.questionText">
            <UTextarea :id="fid" v-model="draft.stem" :rows="4" placeholder="Contoh: Rajah 1 menunjukkan litar bersiri." :disabled="readOnly" data-testid="studio-stem" />
          </DsFormField>
          <DsFormField label="Gambar soalan (pilihan)">
            <StudioImageField v-model="draft.stemImageToken" testid="studio-stem-image" :disabled="readOnly" />
          </DsFormField>
        </DsFormSection>
      </DsStack>

      <!-- Langkah 2 -->
      <DsStack id="studio-section-rangsangan" as="section">
        <DsFormSection title="Langkah 2 Rangsangan (stimulus)" description="Satu rangsangan dikongsi oleh semua soalan yang merujuknya. Ia dipaparkan sekali." icon="book-open-text">
          <StudioGroupEditor v-model:group-id="draft.groupId" :current-question-id="props.id ?? null" :disabled="readOnly" @changed="groupView = $event" />
        </DsFormSection>
      </DsStack>

      <!-- Langkah 3 -->
      <DsStack id="studio-section-sub" as="section">
        <DsFormSection title="Langkah 3 Sub-bahagian" description="Setiap bahagian membawa jenis jawapan, markah dan skema tersendiri." icon="list">
          <DsText variant="label" data-testid="studio-total-marks">Jumlah markah: {{ totalMarks(draft) }}</DsText>
          <DsText v-if="draftTp(draft) !== null" variant="body" tone="muted" data-testid="studio-question-tp">TP soalan: {{ draftTp(draft) }} (tertinggi antara bahagian)</DsText>
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
        </DsFormSection>
      </DsStack>

      <!-- Langkah 4 -->
      <DsStack id="studio-section-tag" as="section">
        <DsFormSection title="Langkah 4 Tag & pengelasan" description="Bab, topik dan aras kesukaran untuk penapisan dan pelaporan." icon="stack">
          <ChapterSelect v-model="draft.chapterId" :subject-id="draft.subjectId" :level-id="draft.educationLevelId" :error="fieldProblems.curriculumChapterId" />
          <StudioDskpFields v-model:unit-id="draft.unitId" v-model:sp-ids="draft.spIds" :subject-id="draft.subjectId" :level-id="draft.educationLevelId" :disabled="readOnly" :error="fieldProblems['tag.unitId']" />
          <DsFormField v-slot="{ id: fid }" native label="Kesukaran" for="studio-difficulty" hint="Kesukaran ialah anggaran guru; TP ialah tahap DSKP.">
            <DsNativeSelect :id="fid" v-model.number="draft.difficulty" :disabled="readOnly" data-testid="studio-difficulty">
              <option v-for="k in KESUKARAN" :key="k.value" :value="k.value">{{ k.label }}</option>
            </DsNativeSelect>
          </DsFormField>
        </DsFormSection>
      </DsStack>

      <DsFormBar submit-label="Simpan draf" :saving="saving" :disabled="readOnly" cancel-to="/admin/questions" data-testid="studio-save-bar">
        <template #status>
          <DsText as="span" variant="caption" data-testid="studio-save-marks">{{ totalMarks(draft) }} markah</DsText>
          <DsText v-if="gaps.length > 0" as="span" variant="caption" data-testid="studio-save-gaps"> · {{ gaps.length }} belum lengkap</DsText>
        </template>
      </DsFormBar>
    </DsStack>
    <StudioPreview v-model:open="previewOpen" :group="groupView" :draft="draft" :question-id="props.id ?? null" />
  </DsPage>
</template>
