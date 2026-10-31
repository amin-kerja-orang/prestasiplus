<script setup lang="ts">
/**
 * Pembina Kertas editor (`/admin/spm/kertas/:id`): the blueprint's sections with a live budget
 * check, questions added from the bank (a stimulus group moves as one unit and stays contiguous),
 * a student-view preview and publish. Fixes .cloud N-11 (the blueprint is enforced, not advisory).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { useConfirm, DsCluster, DsLoadError, DsPage, DsPanel, DsStatRow, DsStatusBadge, type StatItem } from '@/ds'

import RichText from '../../components/RichText.vue'
import type { BuilderGroup, BuilderQuestion } from '../../domain/admin-types'
import { addUnit, checkPaper, moveUnit, removeUnit, unitsOf } from '../../domain/paper-builder'
import { INTAKE_MANUAL_PATH } from '../intake/lib/intake-routes'
import { bijakAdminServer } from '../../server/client'
import PaperReferenceEditor from '../builder/components/PaperReferenceEditor.vue'
import PaperQuestionOps from '../builder/components/PaperQuestionOps.vue'
import PaperEditBlocks from '../builder/components/PaperEditBlocks.vue'
import PublishOverride from '../builder/components/PublishOverride.vue'
import PaperMetaForm from '../builder/components/PaperMetaForm.vue'
import ReviewBlock from '../builder/components/ReviewBlock.vue'
import StudentViewDrawer from '../builder/components/StudentViewDrawer.vue'
import { builderCopy as bt } from '../builder/domain/copy'
import { publishGate } from '../builder/domain/publish-gate'
import { usePaperActions } from '../builder/lib/use-paper-actions'
import { uploadQuestionImage } from '@/api/files'
import { builderMessage, builderPath, type ReferencePanel } from '../builder/server/api'
import { builderServer } from '../builder/server/client'
import QuestionPreview from './QuestionPreview.vue'
import { ADMIN_ROUTES, KIND_LABEL, detailMessage } from './ui'

const server = bijakAdminServer()
const confirm = useConfirm()
const route = useRoute()
const flash = useFlash()

const id = computed(() => String(route.params.id))
/** Back from "Tulis soalan baharu": the new question is waiting for review. */
const waitingNote = computed(() => route.query.menunggu === '1')
/** Manual entry opens with this paper's subject and kertas filled in. */
const manualLink = computed(() => ({
  path: INTAKE_MANUAL_PATH,
  query: {
    subject: data.value?.paper.subject ?? '',
    kertas: String(data.value?.paper.kertas ?? ''),
    paper: id.value,
  },
}))
const { data, error, reload } = useApi(() => server.getPaperEditor(id.value), id)

/* Semak Kertas (R1-F09): server review, Salin set, Tarik balik, student view. V2 3.4. */
const actions = usePaperActions({
  api: builderServer(),
  id,
  title: () => data.value?.paper.title ?? title.value,
  onChanged: reload,
  copyTarget: (nid) => `/admin/spm/kertas/${encodeURIComponent(nid)}`,
})
const { review, viewOpen, view, viewError } = actions

const title = ref('')
const durationMin = ref(0)
const ids = reactive<Record<string, string[]>>({})
const dirty = ref(false)
const busy = ref(false)
const publishErrors = ref<string[]>([])

watch(
  data,
  (d) => {
    if (!d) return
    void actions.loadReview()
    title.value = d.paper.title
    durationMin.value = d.paper.durationMin
    for (const k of Object.keys(ids)) delete ids[k]
    for (const s of d.paper.sections) ids[s.id] = [...s.questionIds]
    dirty.value = false
  },
  { immediate: true },
)

const readonly = computed(() => data.value?.paper.status === 'terbit')
const qMap = computed(
  () => new Map<string, BuilderQuestion>((data.value?.questions ?? []).map((q) => [q.id, q])),
)
const gMap = computed(
  () => new Map<string, BuilderGroup>((data.value?.groups ?? []).map((g) => [g.id, g])),
)
const groupOf = (qid: string): string | undefined => qMap.value.get(qid)?.groupId
const membersOf = (gid: string): string[] => gMap.value.get(gid)?.questionIds ?? []

const sections = computed(() => data.value?.paper.sections ?? [])

const check = computed(() =>
  checkPaper({
    specs: sections.value.map((s) => ({
      label: s.label,
      markBudget: s.markBudget,
      questionCount: s.questionCount,
      rule: s.rule,
    })),
    sections: sections.value.map((s) => ({ questionIds: ids[s.id] ?? [] })),
    marksOf: (qid) => qMap.value.get(qid)?.marks ?? 0,
    groupOf,
    membersOf,
    isLive: (qid) => qMap.value.get(qid)?.status === 'terbit',
  }),
)
const allIssues = computed(() => [
  ...check.value.errors,
  ...check.value.sections.flatMap((s) => s.errors.map((e) => `${s.label}: ${e}`)),
])

/** Terbitkan stays off while a local check fails, or (nothing unsaved) the server lists a blocker. */
const gate = computed(() =>
  publishGate({
    localIssues: allIssues.value.length,
    dirty: dirty.value,
    reviewFailed: actions.reviewError.value,
    blockers: actions.blockers.value.length,
  }),
)
const publishBlockedCount = computed(() => gate.value.count)
const publishBlocked = computed(() => gate.value.blocked)

const stats = computed<StatItem[]>(() => [
  {
    key: 'marks',
    label: 'Markah',
    value: `${check.value.totalMarks} / ${check.value.totalBudget}`,
    icon: 'target',
    valueTone: check.value.totalMarks === check.value.totalBudget ? 'success' : 'warning',
  },
  {
    key: 'count',
    label: 'Soalan',
    value: Object.values(ids).reduce((n, l) => n + l.length, 0),
    icon: 'list-numbers',
  },
  { key: 'time', label: 'Minit', value: durationMin.value, icon: 'clock' },
])

/* -------------------------------------------------------------------- edit operations */
function setIds(sectionId: string, next: string[]): void {
  ids[sectionId] = next
  dirty.value = true
  publishErrors.value = []
}
function add(sectionId: string, qid: string): void {
  setIds(sectionId, addUnit(ids[sectionId] ?? [], qid, groupOf, membersOf))
}
function remove(sectionId: string, qid: string): void {
  setIds(sectionId, removeUnit(ids[sectionId] ?? [], qid, groupOf))
}
function move(sectionId: string, index: number, delta: -1 | 1): void {
  setIds(sectionId, moveUnit(ids[sectionId] ?? [], index, delta, groupOf))
}
function unitsFor(sectionId: string) {
  return unitsOf(ids[sectionId] ?? [], groupOf)
}
const stimulusOf = (gid: string) => gMap.value.get(gid)?.stimulus
const unitMarks = (unitIds: string[]): number =>
  unitIds.reduce((n, q) => n + (qMap.value.get(q)?.marks ?? 0), 0)

/* ---------------------------------------------------------------------------- picker */
const pickerSection = ref<string | null>(null)
const search = ref('')
const pickerOpen = computed({
  get: () => pickerSection.value !== null,
  set: (v: boolean) => {
    if (!v) pickerSection.value = null
  },
})
const usedIds = computed(() => new Set(Object.values(ids).flat()))
const candidates = computed(() => {
  const term = search.value.trim().toLowerCase()
  const out: { key: string; ids: string[]; groupId?: string; label: string }[] = []
  const done = new Set<string>()
  for (const q of data.value?.questions ?? []) {
    if (q.status !== 'terbit' || done.has(q.id)) continue
    const unit = q.groupId ? membersOf(q.groupId) : [q.id]
    unit.forEach((x) => done.add(x))
    if (unit.some((x) => usedIds.value.has(x))) continue
    const text = `${q.preview} ${q.topic} ${q.id}`.toLowerCase()
    if (term && !text.includes(term)) continue
    out.push({
      key: q.groupId ?? q.id,
      ids: unit,
      ...(q.groupId ? { groupId: q.groupId } : {}),
      label: q.preview,
    })
  }
  return out
})

/* --------------------------------------------------------------------- save / publish */
function patch() {
  return {
    title: title.value,
    durationMin: durationMin.value,
    sections: sections.value.map((s) => ({ id: s.id, questionIds: ids[s.id] ?? [] })),
  }
}
async function save(): Promise<boolean> {
  busy.value = true
  try {
    await server.savePaper(id.value, patch())
    dirty.value = false
    void actions.loadReview()
    return true
  } catch (e) {
    flash.show({ type: 'error', message: detailMessage(e) })
    return false
  } finally {
    busy.value = false
  }
}
async function onSave(): Promise<void> {
  if (await save()) flash.show({ type: 'success', message: 'Draf kertas disimpan.' })
}
async function publish(): Promise<void> {
  if (publishBlocked.value) return
  // V2 native paper: confirm before it goes live (R8; a composite set in the Set Builder has none).
  if (!(await confirm({ message: bt.publishConfirm, confirmLabel: bt.publish }))) return
  if (!(await save())) return
  busy.value = true
  try {
    const res = await server.publishPaper(id.value)
    if (!res.ok) {
      publishErrors.value = res.errors
      return
    }
    flash.show({
      type: 'success',
      message: 'Kertas diterbitkan. Ia kini ada dalam hab Bijak SPM pelajar.',
    })
    await reload()
  } finally {
    busy.value = false
  }
}
async function overridePublish(reason: string): Promise<void> {
  if (!(await confirm({ message: bt.publishConfirm, confirmLabel: bt.publish }))) return
  await actions.publish({ override: true, reason })
}
async function unpublish(): Promise<void> {
  busy.value = true
  try {
    await server.unpublishPaper(id.value)
    flash.show({ type: 'success', message: 'Kertas ditarik balik ke Draf.' })
    await reload()
  } finally {
    busy.value = false
  }
}

/* ---------------------------------------------------------------------------- metadata */
async function saveMeta(patchData: Parameters<ReturnType<typeof builderServer>['updateHeader']>[1]): Promise<void> {
  if (dirty.value && !(await save())) return
  busy.value = true
  try {
    await builderServer().updateHeader(id.value, patchData)
    flash.show({ type: 'success', message: bt.metaSaved(data.value?.paper.title ?? title.value) })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, bt.errRename) })
  } finally {
    busy.value = false
  }
}

/** Sunting bahagian / petikan: unsaved placements go first (the reload resets them), then one call. */
async function editThen(run: () => Promise<unknown>, okMessage: string, fallback: string = bt.errRename): Promise<void> {
  if (dirty.value && !(await save())) return
  busy.value = true
  try {
    await run()
    flash.show({ type: 'success', message: okMessage })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, fallback) })
  } finally {
    busy.value = false
  }
}
const saveSection = (sid: string, p: Parameters<ReturnType<typeof builderServer>['updateSection']>[2]): Promise<void> =>
  editThen(() => builderServer().updateSection(id.value, sid, p), bt.sectionSaved(p.label ?? ''))
const loadOpsPool = (sid: string, q: string) => builderServer().pool(id.value, sid, { q, pageSize: 20 })
const addQuestion = (sid: string, qid: string): Promise<void> =>
  editThen(() => builderServer().addPlacement(id.value, sid, qid), bt.questionAdded, bt.errAdd)
const deleteQuestion = (qid: string): Promise<void> =>
  editThen(() => builderServer().removePlacement(id.value, qid), bt.questionDeleted, bt.errRemove)
const referencePanels = computed(
  () => ((data.value?.paper as { reference?: ReferencePanel[] } | undefined)?.reference ?? []),
)
/** Reference images use the question image upload (security-reviewed input); the mock keeps a placeholder token. */
const uploadReferenceImage = (file: File): Promise<string> =>
  import.meta.env.VITE_API_MODE === 'http'
    ? uploadQuestionImage(file, 'reference')
    : Promise.resolve(`mock-${file.name}`)
const saveReference = (panels: ReferencePanel[]): Promise<void> =>
  editThen(() => builderServer().updateReference(id.value, panels), bt.refSaved)
const savePassage = (gid: string, label: string): Promise<void> =>
  editThen(() => builderServer().updateGroupLabel(id.value, gid, label), bt.passageSaved(label))

/* -------------------------------------------------------------------------- preview */
const previewOpen = ref(false)
const preview = ref<Awaited<ReturnType<typeof server.previewQuestions>> | null>(null)
async function openPreview(): Promise<void> {
  preview.value = await server.previewQuestions(sections.value.flatMap((s) => ids[s.id] ?? []))
  previewOpen.value = true
}
const previewBlocks = computed(() => {
  const p = preview.value
  if (!p) return []
  const byId = new Map(p.questions.map((q) => [q.id, q]))
  let n = 1
  return sections.value.map((s) => ({
    label: s.label,
    instruction:
      s.instruction ??
      (s.rule.type === 'all'
        ? 'Jawab semua soalan.'
        : `Jawab ${s.rule.n} daripada ${s.questionCount} soalan.`),
    marks: check.value.sections.find((c) => c.label === s.label)?.marks ?? 0,
    units: unitsFor(s.id).map((u) => {
      const start = n
      n += u.ids.length
      return {
        start,
        questions: u.ids.map((q) => byId.get(q)!).filter(Boolean),
        stimulus: u.groupId ? p.stimuli[u.groupId] : undefined,
        optionBank: u.groupId ? p.optionBanks[u.groupId] : undefined,
      }
    }),
  }))
})
</script>

<template>
  <DsPage
    layout="detail"
    width="wide"
    :back-to="{ name: ADMIN_ROUTES.papers }"
    back-label="Pembina Kertas"
    data-testid="paper-editor-page"
  >
    <DsLoadError v-if="error" message="Tidak dapat memuatkan kertas." @retry="reload()" />

    <template v-else-if="data">
      <UAlert
        v-if="waitingNote"
        color="info"
        variant="subtle"
        icon="i-ph-hourglass"
        title="Soalan baharu menunggu semakan"
        description="Soalan anda sudah dihantar. Ia mesti lulus semakan dan diterbitkan di Baris Gilir Semakan sebelum boleh ditambah ke kertas ini."
        data-testid="paper-waiting-note"
      >
        <template #actions>
          <UButton
            :to="{ name: ADMIN_ROUTES.review }"
            size="sm"
            color="info"
            variant="outline"
            icon="i-ph-seal-check"
          >
            Buka Baris Gilir Semakan
          </UButton>
        </template>
      </UAlert>
      <DsPanel>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex min-w-0 grow flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <DsStatusBadge :status="readonly ? 'published' : 'draft'" />
              <span class="text-caption text-muted">
                {{ data.blueprint?.subjectName }} · Kertas {{ data.paper.kertas }} · blueprint
                {{ data.blueprint?.source }} · {{ data.paper.code }}
              </span>
            </div>
            <UFormField label="Tajuk kertas">
              <UInput
                v-model="title"
                class="w-full"
                :disabled="readonly"
                data-testid="paper-title"
                @update:model-value="dirty = true"
              />
            </UFormField>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-ph-eye"
              label="Pratonton sebagai pelajar"
              class="min-h-11"
              data-testid="paper-preview"
              @click="openPreview"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-ph-student"
              :label="bt.studentView + ' (disimpan)'"
              class="min-h-11"
              :disabled="dirty"
              data-testid="paper-student-view"
              @click="actions.openStudentView"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-ph-copy"
              :label="bt.copy"
              class="min-h-11"
              :loading="actions.busy.value"
              data-testid="paper-copy"
              @click="actions.copy"
            />
            <UButton
              :to="builderPath(id)"
              color="neutral"
              variant="ghost"
              icon="i-ph-hammer"
              :label="bt.openBuilder"
              class="min-h-11"
              data-testid="paper-open-builder"
            />
            <template v-if="!readonly">
              <UButton
                color="neutral"
                variant="soft"
                icon="i-ph-floppy-disk"
                label="Simpan draf"
                class="min-h-11"
                :loading="busy"
                :disabled="!dirty"
                data-testid="paper-save"
                @click="onSave"
              />
              <UButton
                icon="i-ph-upload-simple"
                label="Terbitkan"
                class="min-h-11"
                :loading="busy"
                :disabled="publishBlocked"
                data-testid="paper-publish"
                @click="publish"
              />
            </template>
            <template v-else>
              <UButton
                icon="i-ph-student"
                label="Lihat di Bijak SPM"
                class="min-h-11"
                to="/spm/bijak"
                data-testid="paper-view-student"
              />
              <UButton
                color="warning"
                variant="soft"
                icon="i-ph-arrow-u-up-left"
                label="Sembunyikan"
                class="min-h-11"
                :loading="busy || actions.busy.value"
                data-testid="paper-unpublish"
                @click="unpublish"
              />
            </template>
          </div>
        </div>
      </DsPanel>

      <DsStatRow
        :items="stats"
        density="compact"
        :cols="3"
        aria-label="Ringkasan kertas"
        prefix="paper-stat"
      />

      <DsPanel data-testid="budget-check" role="status" aria-live="polite">
        <div class="flex items-center gap-2">
          <UIcon
            :name="allIssues.length ? 'i-ph-warning' : 'i-ph-check-circle'"
            :class="allIssues.length ? 'text-warning' : 'text-success'"
            class="size-5"
          />
          <h3 class="text-subheading text-highlighted">
            {{
              allIssues.length
                ? `Belum sepadan dengan blueprint (${allIssues.length} perkara)`
                : 'Sepadan dengan blueprint'
            }}
          </h3>
        </div>
        <ul
          v-if="allIssues.length"
          class="mt-2 flex list-disc flex-col gap-1 ps-6 text-body text-default"
          data-testid="budget-issues"
        >
          <li v-for="e in allIssues" :key="e">{{ e }}</li>
        </ul>
        <p
          v-if="publishBlocked && !readonly"
          class="mt-2 text-body font-semibold text-error"
          role="status"
          data-testid="publish-errors"
        >
          <template v-if="publishBlockedCount">
            Kertas belum boleh diterbitkan: selesaikan {{ publishBlockedCount }} perkara di atas.
          </template>
          <template v-else>{{ gate.reason }}</template>
        </p>
        <p v-else-if="publishErrors.length" class="mt-2 text-body font-semibold text-error" role="alert">
          Kertas belum boleh diterbitkan: selesaikan {{ publishErrors.length }} perkara di atas.
        </p>
      </DsPanel>

      <DsPanel data-testid="paper-review" aria-live="polite">
        <h3 class="mb-2 text-heading text-highlighted">{{ bt.review }}</h3>
        <div v-if="readonly" class="mb-2 flex flex-wrap items-center gap-3" data-testid="paper-live-note">
          <p class="text-body text-muted">{{ bt.live }} {{ bt.lockedNote }}</p>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-ph-copy"
            :label="bt.copyForEdit"
            class="min-h-11"
            :loading="actions.busy.value"
            data-testid="paper-copy-for-edit"
            @click="actions.copy"
          />
        </div>
        <ReviewBlock v-if="review" :review="review" />
        <p v-else-if="actions.reviewError.value" class="text-body text-error" role="alert">
          {{ bt.reviewError }}
        </p>
        <p v-if="dirty" class="mt-2 text-caption text-muted">{{ bt.reviewStale }}</p>
        <UButton
          :to="{ name: 'm28.admin.kontrak.edit', params: { subjek: data.paper.subject, kertas: String(data.paper.kertas) } }"
          color="neutral"
          variant="link"
          class="mt-2 min-h-11"
          :label="bt.editContract"
          data-testid="paper-edit-contract"
        />
      </DsPanel>

      <DsPanel data-testid="paper-meta">
        <PaperMetaForm
          v-model:title="title"
          :paper="data.paper"
          :readonly="readonly"
          :busy="busy"
          @update:title="dirty = true"
          @save="saveMeta"
        />
      </DsPanel>

      <DsPanel data-testid="paper-question-ops">
        <PaperQuestionOps
          :editor="data"
          :readonly="readonly"
          :busy="busy"
          :load-pool="loadOpsPool"
          @add="addQuestion"
          @remove="deleteQuestion"
        />
      </DsPanel>

      <DsPanel data-testid="paper-reference">
        <PaperReferenceEditor
          :panels="referencePanels"
          :readonly="readonly"
          :busy="busy"
          :upload="uploadReferenceImage"
          @save="saveReference"
        />
      </DsPanel>

      <DsPanel data-testid="paper-edit-blocks">
        <PaperEditBlocks
          :editor="data"
          :readonly="readonly"
          :busy="busy"
          @section="saveSection"
          @passage="savePassage"
        />
        <PublishOverride
          v-if="!readonly"
          class="mt-4"
          :blockers="actions.blockers.value"
          :available="actions.overrideAvailable.value"
          :busy="actions.busy.value"
          @override="overridePublish"
        />
      </DsPanel>

      <DsPanel v-for="(s, si) in sections" :key="s.id" :data-testid="`section-${si}`">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <h3 class="text-heading text-highlighted">{{ s.label }}</h3>
              <p class="text-caption text-muted">
                {{
                  s.instruction ??
                  (s.rule.type === 'all'
                    ? 'Jawab semua soalan.'
                    : `Jawab ${s.rule.n} daripada ${s.questionCount} soalan.`)
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2" :data-testid="`section-${si}-badges`">
              <UBadge
                :color="check.sections[si]?.count === s.questionCount ? 'success' : 'warning'"
                variant="subtle"
                :label="`Soalan ${check.sections[si]?.count ?? 0} / ${s.questionCount}`"
              />
              <UBadge
                :color="check.sections[si]?.marks === s.markBudget ? 'success' : 'warning'"
                variant="subtle"
                :label="`Markah ${check.sections[si]?.marks ?? 0} / ${s.markBudget}`"
              />
            </div>
          </div>

          <ul class="flex flex-col gap-2">
            <li
              v-for="(u, ui) in unitsFor(s.id)"
              :key="u.ids.join('|')"
              class="flex items-start gap-2 rounded-lg bg-muted p-3"
              :data-testid="u.groupId ? `unit-group-${u.groupId}` : `unit-${u.ids[0]}`"
            >
              <div class="flex min-w-0 grow flex-col gap-2">
                <p
                  v-if="u.groupId"
                  class="flex flex-wrap items-center gap-2 text-caption font-semibold text-info"
                >
                  <UIcon name="i-ph-image" class="size-4" />
                  Kumpulan rangsangan {{ stimulusOf(u.groupId)?.label }} · {{ u.ids.length }} soalan
                  bergerak bersama
                </p>
                <div v-for="qid in u.ids" :key="qid" class="flex flex-col gap-1">
                  <span class="line-clamp-2 text-body text-default"
                    ><RichText :text="qMap.get(qid)?.preview ?? qid"
                  /></span>
                  <span class="text-caption text-muted">
                    {{ qMap.get(qid)?.marks }} markah ·
                    {{ KIND_LABEL[qMap.get(qid)?.kind ?? 'objektif'] }} · {{ qMap.get(qid)?.topic }}
                  </span>
                </div>
              </div>
              <div v-if="!readonly" class="flex shrink-0 gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-ph-arrow-up"
                  aria-label="Naik"
                  class="min-h-11 min-w-11"
                  :disabled="ui === 0"
                  @click="move(s.id, ui, -1)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-ph-arrow-down"
                  aria-label="Turun"
                  class="min-h-11 min-w-11"
                  :disabled="ui === unitsFor(s.id).length - 1"
                  @click="move(s.id, ui, 1)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-ph-x"
                  :aria-label="u.groupId ? 'Buang kumpulan' : 'Buang soalan'"
                  class="min-h-11 min-w-11"
                  :data-testid="`remove-${u.ids[0]}`"
                  @click="remove(s.id, u.ids[0]!)"
                />
              </div>
            </li>
            <li v-if="!unitsFor(s.id).length" class="text-body text-muted">
              Belum ada soalan dalam bahagian ini.
            </li>
          </ul>

          <DsCluster v-if="!readonly">
            <UButton
              icon="i-ph-plus"
              label="Tambah soalan dari bank"
              color="neutral"
              variant="soft"
              class="min-h-11"
              :data-testid="`add-${si}`"
              @click="((pickerSection = s.id), (search = ''))"
            />
            <UButton
              icon="i-ph-pencil-simple-line"
              label="Tulis soalan baharu"
              color="neutral"
              variant="soft"
              class="min-h-11"
              :to="manualLink"
              :data-testid="`write-${si}`"
            />
          </DsCluster>
        </div>
      </DsPanel>

      <USlideover
        v-model:open="pickerOpen"
        title="Tambah dari bank"
        description="Hanya soalan Terbit untuk subjek dan kertas ini. Soalan rangsangan ditambah sekali gus."
        :ui="{ content: 'max-w-xl' }"
      >
        <template #body>
          <div class="flex flex-col gap-3" data-testid="picker">
            <UInput
              v-model="search"
              icon="i-ph-magnifying-glass"
              aria-label="Cari soalan"
              placeholder="Cari teks atau topik..."
              class="w-full"
              data-testid="picker-search"
            />
            <p v-if="!candidates.length" class="text-body text-muted">
              Tiada soalan Terbit yang tersedia.
            </p>
            <ul class="flex flex-col gap-2">
              <li
                v-for="c in candidates"
                :key="c.key"
                class="flex items-start gap-2 rounded-lg bg-muted p-3"
                :data-testid="`pick-${c.key}`"
              >
                <div class="flex min-w-0 grow flex-col gap-1">
                  <span class="line-clamp-2 text-body"><RichText :text="c.label" /></span>
                  <span class="text-caption text-muted">
                    <template v-if="c.groupId"
                      >Kumpulan {{ stimulusOf(c.groupId)?.label }} · {{ c.ids.length }} soalan ·
                    </template>
                    {{ unitMarks(c.ids) }} markah
                  </span>
                </div>
                <UButton
                  size="sm"
                  icon="i-ph-plus"
                  label="Tambah"
                  class="min-h-11"
                  :data-testid="`pick-add-${c.key}`"
                  @click="pickerSection && add(pickerSection, c.ids[0]!)"
                />
              </li>
            </ul>
          </div>
        </template>
      </USlideover>

      <StudentViewDrawer v-model:open="viewOpen" :view="view" :error="viewError" />

      <USlideover
        v-model:open="previewOpen"
        title="Pratonton sebagai pelajar"
        description="Paparan kertas tanpa skema."
        :ui="{ content: 'max-w-2xl' }"
      >
        <template #body>
          <div class="flex flex-col gap-6" data-testid="student-preview">
            <section v-for="b in previewBlocks" :key="b.label" class="flex flex-col gap-3">
              <header>
                <h3 class="text-heading text-highlighted">{{ b.label }}</h3>
                <p class="text-caption text-muted">{{ b.instruction }} [{{ b.marks }} markah]</p>
              </header>
              <template v-for="u in b.units" :key="u.start">
                <QuestionPreview
                  :questions="u.questions"
                  :stimulus="u.stimulus"
                  :option-bank="u.optionBank"
                  :start="u.start"
                  hide-scheme
                />
              </template>
            </section>
          </div>
        </template>
      </USlideover>
    </template>
  </DsPage>
</template>
