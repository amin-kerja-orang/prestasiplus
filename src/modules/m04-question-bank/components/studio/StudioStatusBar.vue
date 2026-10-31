<script setup lang="ts">
/**
 * Studio status bar (R1-F03a, design S1.3 and 9.1). The V2 status row of the edit page: badge, state sentence, the moves of
 * the state ("Hantar untuk semakan", "Terbitkan", "Arkib", "Edit sebagai draf", plus the PROPOSED way back to draft), the
 * approval refusal list when the gate says no, and "Dilihat murid di x daripada n aktiviti" with a `Lihat` disclosure.
 * "Terbitkan" asks for no confirmation (V2); "Arkib" uses the Panel dialog "Arkibkan soalan ini?". The page reloads on `changed`.
 */
import type { QuestionGateIssue, ServabilityReport } from '@pp/contract'
import { computed, onMounted, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { useFlash } from '@/composables'
import { DsBadge, DsCallout, DsCluster, DsStack, DsText, useConfirm } from '@/ds'

import {
  editAsDraft,
  EditAsDraftRefused,
  fetchGateCheck,
  fetchServability,
  moveQuestionStatus,
} from '../../api/studio'
import { errorLines } from '../../lib/ui-errors'
import {
  APPROVED_NOTE,
  archiveBody,
  ARCHIVE_DIALOG,
  draftCreatedFlash,
  GATE_HEADING,
  gateLines,
  moveFlash,
  REASON,
  SERVED_NO,
  SERVED_TITLE,
  SERVED_YES,
  servedRows,
  servedSummary,
  statusBadge,
  statusButtons,
  statusTone,
  STATUS_TEXT,
  isStudioStatus,
  UNSAVED_HINT,
  type StatusAction,
} from '../../lib/studio/status'

const props = defineProps<{
  questionId: string
  status: string
  /** The form has changes that are not saved: a move would act on the stored version, so it waits for "Simpan draf". */
  dirty: boolean
  /** The editor cannot hold this question (a mode it does not know): no "Edit sebagai draf". */
  unsupported: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const flash = useFlash()
const confirm = useConfirm()

const report = ref<ServabilityReport | null>(null)
const reportFailed = ref(false)
const listOpen = ref(false)
const busy = ref<StatusAction | null>(null)
const refusal = ref<{ heading: string; lines: { text: string; step: string }[] } | null>(null)
const notServed = ref<{ label: string; reason: string }[]>([])
const refusalEl = ref<{ focus: () => void } | null>(null)

const buttons = computed(() => statusButtons(props.status))
const rows = computed(() => (report.value ? servedRows(report.value) : []))
const unservedCount = computed(() => rows.value.filter((r) => !r.served).length)
const stateText = computed(() => (isStudioStatus(props.status) ? STATUS_TEXT[props.status] : ''))
const waitForSave = computed(() => props.dirty)

async function loadReport(): Promise<void> {
  reportFailed.value = false
  try {
    report.value = await fetchServability(props.questionId)
  } catch {
    report.value = null
    reportFailed.value = true
  }
}
onMounted(() => void loadReport())
watch(
  () => [props.questionId, props.status],
  () => void loadReport(),
)

/** The server refused the gate: name every gap (S14). The gate-check read gives the step; the 422 fields are the fallback. */
async function explainRefusal(to: 'review' | 'approved', err: unknown): Promise<void> {
  let issues: QuestionGateIssue[] = []
  try {
    issues = (await fetchGateCheck(props.questionId, to === 'approved' ? 'approve' : 'submit')).issues
  } catch {
    issues = []
  }
  const lines =
    issues.length > 0
      ? gateLines(issues)
      : (isApiError(err) && err.fields ? [...new Set(Object.values(err.fields))] : errorLines(err)).map((text) => ({ text, step: '' }))
  refusal.value = {
    heading: to === 'approved' ? GATE_HEADING : 'Soalan belum boleh dihantar untuk semakan — sila betulkan isu di bawah.',
    lines,
  }
  queueMicrotask(() => refusalEl.value?.focus())
}

async function move(to: 'review' | 'approved' | 'archived' | 'draft'): Promise<void> {
  const from = props.status
  const reason = to === 'archived' ? REASON.archive : to === 'draft' && from === 'review' ? REASON.backToDraft : undefined
  const res = await moveQuestionStatus(props.questionId, to, reason)
  flash.show({ type: 'success', message: moveFlash(from, to) })
  if (to === 'approved' && res.servability) {
    notServed.value = servedRows(res.servability)
      .filter((r) => !r.served)
      .map((r) => ({ label: r.label, reason: r.reason }))
  }
  emit('changed')
}

async function run(action: StatusAction): Promise<void> {
  if (busy.value !== null) return
  refusal.value = null
  notServed.value = []
  if (action === 'archived') {
    const servedIn = report.value ? report.value.servedCount : null
    const ok = await confirm({
      title: ARCHIVE_DIALOG.title,
      message: archiveBody(servedIn),
      confirmLabel: ARCHIVE_DIALOG.confirm,
      cancelLabel: ARCHIVE_DIALOG.cancel,
      tone: 'error',
    })
    if (!ok) return
  }
  busy.value = action
  try {
    if (action === 'edit-as-draft') {
      const id = await editAsDraft(props.questionId)
      flash.show({ type: 'success', message: draftCreatedFlash(id) })
      emit('changed')
    } else {
      await move(action)
    }
  } catch (err) {
    if (err instanceof EditAsDraftRefused) flash.show({ type: 'error', message: err.lines })
    else if ((action === 'approved' || action === 'review') && isApiError(err) && err.status === 422) await explainRefusal(action, err)
    else flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <DsStack gap="sm" data-testid="studio-status">
    <DsCluster gap="sm">
      <DsText variant="label">Status</DsText>
      <DsBadge :label="statusBadge(status)" :tone="statusTone(status)" data-testid="studio-status-badge" />
      <DsText variant="body" tone="muted" data-testid="studio-status-text">{{ stateText }}</DsText>
    </DsCluster>

    <DsCluster gap="sm" data-testid="studio-status-actions">
      <UButton
        v-for="b in buttons"
        :key="b.action"
        type="button"
        :color="b.action === 'archived' ? 'error' : b.primary ? 'primary' : 'neutral'"
        :variant="b.primary ? 'solid' : 'soft'"
        class="min-h-11"
        :loading="busy === b.action"
        :disabled="busy !== null || (b.action !== 'archived' && waitForSave) || (b.action === 'edit-as-draft' && unsupported)"
        :data-testid="`studio-action-${b.action}`"
        @click="run(b.action)"
      >
        {{ b.label }}
      </UButton>
    </DsCluster>
    <DsText v-if="waitForSave && buttons.length > 0" variant="caption" tone="muted" data-testid="studio-status-unsaved">{{ UNSAVED_HINT }}</DsText>

    <DsCallout v-if="status === 'approved'" tone="info" data-testid="studio-approved-note">{{ APPROVED_NOTE }}</DsCallout>

    <DsCallout v-if="refusal" ref="refusalEl" tone="error" :title="refusal.heading" data-testid="studio-gate-refusal">
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="l in refusal.lines" :key="l.text" data-testid="studio-gate-line">
          {{ l.text }}<span v-if="l.step" class="text-muted"> — {{ l.step }}</span>
        </li>
      </ul>
    </DsCallout>

    <DsCallout v-if="notServed.length > 0" tone="info" :title="`Tidak dihidangkan di ${notServed.length} aktiviti`" data-testid="studio-not-served">
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="n in notServed" :key="n.label">{{ n.label }} — {{ n.reason }}</li>
      </ul>
    </DsCallout>

    <DsCluster gap="sm" data-testid="studio-served">
      <DsText v-if="report" variant="body" data-testid="studio-served-summary">{{ servedSummary(report) }}</DsText>
      <DsText v-else-if="reportFailed" variant="body" tone="muted" data-testid="studio-served-error">{{ SERVED_TITLE }}: tidak dapat dimuat.</DsText>
      <UButton
        v-if="report || reportFailed"
        type="button"
        color="neutral"
        variant="link"
        class="min-h-11"
        :aria-expanded="listOpen"
        aria-controls="studio-served-list"
        data-testid="studio-served-toggle"
        @click="reportFailed ? loadReport() : (listOpen = !listOpen)"
      >
        {{ reportFailed ? 'Cuba semula' : listOpen ? 'Tutup' : 'Lihat' }}
      </UButton>
    </DsCluster>
    <div v-if="report && listOpen" id="studio-served-list" data-testid="studio-served-list">
      <DsText variant="label">{{ SERVED_TITLE }}</DsText>
      <ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        <li v-for="r in rows" :key="r.activity" class="flex flex-col gap-1 sm:flex-row sm:gap-3" :data-testid="`studio-served-${r.activity}`">
          <span class="min-w-0 sm:w-56">{{ r.label }}</span>
          <span :class="r.served ? 'text-success' : 'text-warning'">{{ r.served ? SERVED_YES : SERVED_NO }}<span v-if="r.reason" class="text-muted"> — {{ r.reason }}</span></span>
        </li>
      </ul>
      <DsText v-if="unservedCount === 0" variant="caption" tone="muted">Soalan ini dipaparkan di semua aktiviti.</DsText>
    </div>
  </DsStack>
</template>
