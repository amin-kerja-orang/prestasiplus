<script setup lang="ts">
/**
 * Semak Kertas Simulasi (`/admin/spm/kertas/:id`, PRD30 Q-15, the review and publish view over the SAME Set Builder data): metadata, reference
 * sheet, the budget check, the contract, the blockers and Terbitkan with the audited exception. The Bahagian are read here; they are edited
 * at `Sunting di Set Builder` (D113: one builder), where every function of the old Pembina Kertas lives now.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { useConfirm, DsLoadError, DsPage, DsPanel, DsStatRow, DsStatusBadge, type StatItem } from '@/ds'

import { RichText } from '../../../../components/question-display'
import type { BuilderGroup, BuilderQuestion } from '../../domain/admin-types'
import { checkPaper, unitsOf } from '../../domain/paper-builder'
import { editorGroupLabel } from '../../lib/stimulus-data'
import { INTAKE_LIST_PATH } from '../intake/lib/intake-routes'
import { bijakAdminServer } from '../../server/client'
import PaperReferenceEditor from '../builder/components/PaperReferenceEditor.vue'
import PublishOverride from '../builder/components/PublishOverride.vue'
import PaperMetaForm from '../builder/components/PaperMetaForm.vue'
import ReviewBlock from '../builder/components/ReviewBlock.vue'
import StudentViewDrawer from '../builder/components/StudentViewDrawer.vue'
import { builderCopy as bt } from '../builder/domain/copy'
import { publishGate } from '../builder/domain/publish-gate'
import { usePaperActions } from '../builder/lib/use-paper-actions'
import { uploadQuestionImage } from '@/api/files'
import { BUILDER_PATH, builderMessage, builderPath, type ReferencePanel } from '../builder/server/api'
import { builderServer } from '../builder/server/client'
import QuestionPreview from './QuestionPreview.vue'
import { KIND_LABEL, detailMessage } from './ui'

const server = bijakAdminServer()
const confirm = useConfirm()
const route = useRoute()
const flash = useFlash()

const id = computed(() => String(route.params.id))
/** Back from "Tulis soalan baharu" (Set Builder): the new question is waiting for review. */
const waitingNote = computed(() => route.query.menunggu === '1')
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
const busy = ref(false)

watch(
  data,
  (d) => {
    if (!d) return
    void actions.loadReview()
    title.value = d.paper.title
  },
  { immediate: true },
)

const readonly = computed(() => data.value?.paper.status === 'terbit')
const qMap = computed(() => new Map<string, BuilderQuestion>((data.value?.questions ?? []).map((q): [string, BuilderQuestion] => [q.id, q])))
const gMap = computed(() => new Map<string, BuilderGroup>((data.value?.groups ?? []).map((g) => [g.id, g])))
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
    sections: sections.value.map((s) => ({ questionIds: s.questionIds })),
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

/** Terbitkan stays off while a local check fails, or the server lists a blocker. */
const gate = computed(() =>
  publishGate({
    localIssues: allIssues.value.length,
    dirty: false,
    reviewFailed: actions.reviewError.value,
    blockers: actions.blockers.value.length,
  }),
)
/** Server blocker lines the issue list above does not already show (the live check lists the structural ones). */
const extraBlockers = computed(() => {
  const shown = new Set(allIssues.value)
  return actions.blockers.value.filter((m) => !shown.has(m))
})
const publishBlockedCount = computed(() => gate.value.count)
const publishBlocked = computed(() => gate.value.blocked)
const publishTitle = computed(() => (publishBlocked.value && publishBlockedCount.value ? bt.fixFirst(publishBlockedCount.value) : undefined))
/** FR-ADM-Q07.7 (defect 21): an imported draft is published from its preview only. */
const importedDraft = computed(() => !!data.value?.paper.sourceBatchId && !readonly.value)

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
    value: sections.value.reduce((n, s) => n + s.questionIds.length, 0),
    icon: 'list-numbers',
  },
  { key: 'time', label: 'Minit', value: data.value?.paper.durationMin ?? 0, icon: 'clock' },
])

function unitsFor(sectionId: string) {
  return unitsOf(sections.value.find((s) => s.id === sectionId)?.questionIds ?? [], groupOf)
}
/** Label of a group's stimuli; '' for a stimulus-less group, which stays a unit (D90, REQ-A-008). */
const groupLabelById = (gid: string): string => {
  const g = gMap.value.get(gid)
  return g ? editorGroupLabel(g) : ''
}

/* ---------------------------------------------------------------------------- publish */
async function publish(): Promise<void> {
  if (publishBlocked.value) return
  // V2 native paper: confirm before it goes live (R8; a composite set in the Set Builder has none).
  if (!(await confirm({ message: bt.publishConfirm, confirmLabel: bt.publish }))) return
  // The builder API applies the T34 rule (hard blockers refuse; a Kontrak not Disahkan needs the audited override below).
  await actions.loadReview()
  if (actions.publishBlocked.value) {
    flash.show({ type: 'error', message: bt.notPublishable(actions.blockers.value.length) })
    return
  }
  if (await actions.publish()) viewOpen.value = false
}
async function overridePublish(reason: string): Promise<void> {
  if (!(await confirm({ message: bt.publishConfirm, confirmLabel: bt.publish }))) return
  await actions.publish({ override: true, reason })
}
async function unpublish(): Promise<void> {
  if (!(await confirm({ message: bt.withdrawConfirm, confirmLabel: bt.withdrawConfirmLabel, tone: 'error' }))) return
  busy.value = true
  try {
    await server.unpublishPaper(id.value)
    flash.show({ type: 'success', message: bt.withdrawnFlash(data.value?.paper.title ?? title.value) })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: detailMessage(e) })
  } finally {
    busy.value = false
  }
}

/* ---------------------------------------------------------------------------- metadata */
async function saveMeta(patchData: Parameters<ReturnType<typeof builderServer>['updateHeader']>[1]): Promise<void> {
  busy.value = true
  try {
    await builderServer().updateHeader(id.value, patchData)
    flash.show({ type: 'success', message: bt.metaSaved(data.value?.paper.title ?? title.value) })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, bt.errMeta) })
  } finally {
    busy.value = false
  }
}

const referencePanels = computed(
  () => ((data.value?.paper as { reference?: ReferencePanel[] } | undefined)?.reference ?? []),
)
/** Reference images use the question image upload (security-reviewed input); the mock keeps a placeholder token. */
const uploadReferenceImage = (file: File): Promise<string> =>
  import.meta.env.VITE_API_MODE === 'http'
    ? uploadQuestionImage(file, 'reference')
    : Promise.resolve(`mock-${file.name}`)
async function saveReference(panels: ReferencePanel[]): Promise<void> {
  busy.value = true
  try {
    await builderServer().updateReference(id.value, panels)
    flash.show({ type: 'success', message: bt.refSaved })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, bt.errReference) })
  } finally {
    busy.value = false
  }
}

/* -------------------------------------------------------------------------- preview */
const previewOpen = ref(false)
const preview = ref<Awaited<ReturnType<typeof server.previewQuestions>> | null>(null)
async function openPreview(): Promise<void> {
  preview.value = await server.previewQuestions(sections.value.flatMap((s) => s.questionIds))
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
        : `Jawab ${s.rule.n} soalan sahaja.`),
    marks: check.value.sections.find((c) => c.label === s.label)?.marks ?? 0,
    units: unitsFor(s.id).map((u) => {
      const start = n
      n += u.ids.length
      return {
        start,
        questions: u.ids.map((q) => byId.get(q)!).filter(Boolean),
        stimuli: u.groupId ? (p.groupStimuli[u.groupId] ?? (p.stimuli[u.groupId] ? [p.stimuli[u.groupId]!] : [])) : [],
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
    :back-to="BUILDER_PATH"
    back-label="Kembali ke Simulasi"
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
            :to="INTAKE_LIST_PATH"
            size="sm"
            color="info"
            variant="outline"
            icon="i-ph-seal-check"
            data-testid="paper-open-import"
          >
            {{ bt.importQueue }}
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
            <h2 class="text-heading text-highlighted break-words" data-testid="paper-heading">{{ data.paper.title }}</h2>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              :to="builderPath(id)"
              icon="i-ph-hammer"
              :label="bt.editInBuilder"
              class="min-h-11"
              data-testid="paper-edit-in-builder"
            />
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
            <template v-if="!readonly">
              <UButton
                v-if="!importedDraft"
                icon="i-ph-upload-simple"
                :label="bt.publish"
                class="min-h-11"
                :title="publishTitle"
                :loading="busy"
                :disabled="publishBlocked"
                data-testid="paper-publish"
                @click="publish"
              />
            </template>
            <template v-else>
              <UButton
                icon="i-ph-student"
                :label="bt.viewInBijak"
                class="min-h-11"
                to="/spm/bijak"
                data-testid="paper-view-student"
              />
              <UButton
                color="warning"
                variant="soft"
                icon="i-ph-arrow-u-up-left"
                :label="bt.hide"
                class="min-h-11"
                :loading="busy || actions.busy.value"
                data-testid="paper-unpublish"
                @click="unpublish"
              />
            </template>
          </div>
        </div>
        <p v-if="importedDraft" class="mt-2 text-caption text-muted" data-testid="paper-publish-from-preview">{{ bt.terbitFromPreview }}</p>
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
            :name="allIssues.length || publishBlocked ? 'i-ph-warning' : 'i-ph-check-circle'"
            :class="allIssues.length || publishBlocked ? 'text-warning' : 'text-success'"
            class="size-5"
          />
          <h3 class="text-subheading text-highlighted">
            {{ allIssues.length ? bt.budgetIssues(allIssues.length) : bt.budgetOk }}
          </h3>
        </div>
        <ul
          v-if="allIssues.length"
          class="mt-2 flex list-disc flex-col gap-1 ps-6 text-body text-default"
          data-testid="budget-issues"
        >
          <li v-for="e in allIssues" :key="e">{{ e }}</li>
        </ul>
        <div
          v-if="publishBlocked && !readonly"
          class="mt-2 flex flex-col gap-2"
          role="status"
          data-testid="publish-errors"
        >
          <p class="text-body font-semibold text-error">
            <template v-if="allIssues.length">
              Kertas belum boleh diterbitkan: selesaikan {{ publishBlockedCount }} perkara di atas.
            </template>
            <template v-else>{{ gate.reason }}</template>
          </p>
          <!-- REQ-B-054: the server's reason for each blocker not already listed above (the Kontrak is not Disahkan). -->
          <ul
            v-if="extraBlockers.length"
            class="flex list-disc flex-col gap-1 ps-6 text-body text-error"
            data-testid="publish-blockers"
          >
            <li v-for="b in extraBlockers" :key="b">{{ b }}</li>
          </ul>
        </div>
        <PublishOverride
          v-if="!readonly"
          class="mt-3"
          :blockers="actions.blockers.value"
          :available="actions.overrideAvailable.value"
          :busy="actions.busy.value"
          @override="overridePublish"
        />
      </DsPanel>

      <DsPanel data-testid="paper-review" aria-live="polite">
        <h3 class="mb-2 text-heading text-highlighted">{{ bt.review }}</h3>
        <p class="mb-2 text-body" data-testid="paper-contract">
          <span class="font-semibold">{{ bt.contractTitle }}:</span>
          {{
            data.blueprint
              ? bt.contractLine(data.blueprint.subjectName, data.paper.kertas, data.blueprint.source)
              : bt.contractNone
          }}
        </p>
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
        <ReviewBlock v-if="review" :review="review" :scope="{ levelScope: data.paper.levelScope, subject: data.blueprint?.subjectName ?? data.paper.subject }" />
        <p v-else-if="actions.reviewError.value" class="text-body text-error" role="alert">
          {{ bt.reviewError }}
        </p>
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
          @save="saveMeta"
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
                    : `Jawab ${s.rule.n} soalan sahaja.`)
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2" :data-testid="`section-${si}-badges`">
              <UBadge
                :color="check.sections[si]?.count === s.questionCount ? 'success' : 'warning'"
                variant="subtle"
                :label="bt.questionsChip(check.sections[si]?.count ?? 0, s.questionCount)"
              />
              <UBadge
                :color="check.sections[si]?.marks === s.markBudget ? 'success' : 'warning'"
                variant="subtle"
                :label="bt.marksChip(check.sections[si]?.marks ?? 0, s.markBudget)"
              />
            </div>
          </div>

          <ul class="flex flex-col gap-2">
            <li
              v-for="u in unitsFor(s.id)"
              :key="u.ids.join('|')"
              class="flex flex-col gap-2 rounded-lg bg-muted p-3"
              :data-testid="u.groupId ? `unit-group-${u.groupId}` : `unit-${u.ids[0]}`"
            >
              <p
                v-if="u.groupId"
                class="flex flex-wrap items-center gap-2 text-caption font-semibold text-info"
              >
                <UIcon name="i-ph-image" class="size-4" />
                {{ bt.groupBadge(groupLabelById(u.groupId), u.ids.length) }}
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
            </li>
            <li v-if="!unitsFor(s.id).length" class="text-body text-muted">
              Belum ada soalan dalam bahagian ini.
            </li>
          </ul>
        </div>
      </DsPanel>

      <StudentViewDrawer
        v-model:open="viewOpen"
        :view="view"
        :error="viewError"
        :publishable="importedDraft"
        :publish-blocked="publishBlocked"
        :publish-title="publishTitle"
        :busy="actions.busy.value"
        @publish="publish"
      />

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
                  :stimuli="u.stimuli"
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
