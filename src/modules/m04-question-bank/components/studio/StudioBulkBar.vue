<script setup lang="ts">
/**
 * The bulk bar of the Studio list (FR-ADM-Q03.5, field 03-15): selected rows take `Hantar untuk semakan`, `Terbitkan` and `Arkib`
 * (API-Q-04, group-aware, at most 64 ids); "all results of the filter" takes `Terbitkan` and `Arkib` only (the filter route). A
 * selection holding part of a stimulus group is refused whole by the server, and its text is shown here.
 */
import { computed, ref, watch } from 'vue'

import { DsCluster, DsStack, DsText, useConfirm } from '@/ds'

import { bulkQuestionsByFilter, type QuestionBulkFilter, type QuestionFilterAction, type QuestionFilterBulkResult } from '../../api/questions'
import { bulkStudioAction, type StudioBulkAction, type StudioBulkResult } from '../../api/studio'
import { bulkFilterCountLine } from '../../lib/bulk-filter'
import { errorLines } from '../../lib/ui-errors'
import BulkFilterResult from '../BulkFilterResult.vue'

/** `BULK_MAX` is the id cap of API-Q-04. */
const BULK_MAX = 64
const LABELS: Readonly<Record<StudioBulkAction, string>> = { review: 'Hantar untuk semakan', approved: 'Terbitkan', archived: 'Arkib' }

const props = defineProps<{
  selectedIds: readonly string[]
  /** The applied list filter; empty = no "all results" (never the whole bank). */
  filter: QuestionBulkFilter
  /** Rows of the filter, as the list shows. */
  matched: number
}>()
const emit = defineEmits<{ done: [] }>()
const confirm = useConfirm()

const allResults = ref(false)
const busy = ref(false)
const problems = ref<string[]>([])
const rowsResult = ref<StudioBulkResult | null>(null)
const filterResult = ref<{ action: QuestionFilterAction; result: QuestionFilterBulkResult } | null>(null)

const hasFilter = computed(() => Object.keys(props.filter).length > 0)
watch(hasFilter, (has) => {
  if (!has) allResults.value = false
})
const count = computed(() => (allResults.value ? props.matched : props.selectedIds.length))
// A result stays on screen after the run has cleared the selection.
const visible = computed(() => props.selectedIds.length > 0 || hasFilter.value || rowsResult.value !== null || filterResult.value !== null || problems.value.length > 0)
const tooMany = computed(() => !allResults.value && props.selectedIds.length > BULK_MAX)
const actions = computed<StudioBulkAction[]>(() => (allResults.value ? ['approved', 'archived'] : ['review', 'approved', 'archived']))
const summary = computed(() => {
  const r = rowsResult.value
  return r === null ? '' : `${String(r.affected)} berjaya, ${String(r.failed.length + (r.skipped?.length ?? 0))} dilangkau`
})

async function run(action: StudioBulkAction): Promise<void> {
  problems.value = []
  rowsResult.value = null
  filterResult.value = null
  if (count.value === 0) {
    problems.value = ['Sila pilih sekurang-kurangnya satu soalan.']
    return
  }
  busy.value = true
  try {
    if (allResults.value) await runFilter(action as QuestionFilterAction)
    else await runRows(action)
  } catch (err) {
    problems.value = errorLines(err)
  } finally {
    busy.value = false
  }
}

async function runRows(action: StudioBulkAction): Promise<void> {
  if (action === 'archived') {
    const ok = await confirm({ title: LABELS.archived, message: `Arkibkan ${String(props.selectedIds.length)} soalan yang dipilih?`, confirmLabel: LABELS.archived, tone: 'error' })
    if (!ok) return
  }
  rowsResult.value = (await bulkStudioAction(action, props.selectedIds)).data
  emit('done')
}

async function runFilter(action: QuestionFilterAction): Promise<void> {
  const dry = (await bulkQuestionsByFilter(action, props.filter, { dryRun: true })).data
  if (dry.eligible === 0) {
    problems.value = ['Tiada soalan hasil tapisan ini yang boleh diproses.']
    return
  }
  const ok = await confirm({ title: LABELS[action], message: bulkFilterCountLine(action, dry), confirmLabel: LABELS[action], tone: action === 'archived' ? 'error' : 'primary' })
  if (!ok) return
  const done = await bulkQuestionsByFilter(action, props.filter, { expectedCount: dry.matched })
  filterResult.value = { action, result: done.data }
  emit('done')
}
</script>

<template>
  <DsStack v-if="visible" gap="sm" data-testid="studio-bulk">
    <DsCluster gap="sm">
      <DsText variant="label" tabular data-testid="studio-bulk-count">{{ count }} soalan dipilih</DsText>
      <UCheckbox v-if="hasFilter" v-model="allResults" :label="`Semua hasil tapisan (${String(matched)})`" data-testid="studio-bulk-all" />
      <UButton
        v-for="a in actions"
        :key="a"
        type="button"
        :color="a === 'archived' ? 'error' : a === 'approved' ? 'primary' : 'neutral'"
        variant="soft"
        :loading="busy"
        :disabled="tooMany"
        :data-testid="`studio-bulk-${a}`"
        @click="run(a)"
      >
        {{ LABELS[a] }}
      </UButton>
    </DsCluster>
    <DsText v-if="tooMany" variant="caption" tone="warning" data-testid="studio-bulk-cap">Pilih paling banyak {{ BULK_MAX }} soalan, atau gunakan semua hasil tapisan.</DsText>
    <DsStack v-if="problems.length > 0" gap="2xs" role="alert" data-testid="studio-bulk-problems">
      <DsText v-for="p in problems" :key="p" variant="body" tone="error">{{ p }}</DsText>
    </DsStack>
    <DsStack v-if="rowsResult" gap="2xs" role="status" data-testid="studio-bulk-result">
      <DsText variant="body">{{ summary }}</DsText>
      <DsText v-for="f in rowsResult.failed" :key="f.id" variant="caption" tone="warning">Soalan #{{ f.id }} — {{ f.message }}</DsText>
      <DsText v-for="f in rowsResult.skipped ?? []" :key="f.id" variant="caption" tone="muted">Soalan #{{ f.id }} — {{ f.message }}</DsText>
    </DsStack>
    <BulkFilterResult v-if="filterResult" :action="filterResult.action" :result="filterResult.result" />
  </DsStack>
</template>
