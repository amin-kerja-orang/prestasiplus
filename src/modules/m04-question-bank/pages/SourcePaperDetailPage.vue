<script setup lang="ts">
/**
 * Butiran Sumber Kertas (`/admin/source-papers/:id`, S2-T09, PRD30 R1-ADM-Q-19, FR-ADM-Q19.2): the facts of one registry paper
 * (Subjek, Tahun, Negeri, Kertas, Jenis, Sumber, Skema?, Perlu Semakan, Fail), the "Isu Import" section when there are issues, and the
 * imported questions (all Draf) with a Sunting di Studio link each. Read-only. An unknown id is the standard 404 page.
 */
import type { TableColumn } from '@nuxt/ui'
import { INTAKE_PAPER_TYPE_LABELS, SOURCE_PAPER_MESSAGES } from '@pp/contract'
import { computed, watch } from 'vue'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables/useApi'
import { DsCallout, DsDataTable, DsLink, DsLoadError, DsPage, DsSection, DsStack, DsText, type DefinitionItem, DsDefinitionList } from '@/ds'

import { fetchSourcePaper } from '../api/imports'
import { isNotFound, LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{ id: string }>()

const { data, error, reload } = useApi((signal) => fetchSourcePaper(props.id, signal), () => props.id)

const notFound = computed(() => isNotFound(error.value))
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const yesNo = (v: boolean): string => (v ? 'Ya' : 'Tidak')
const facts = computed<DefinitionItem[]>(() => {
  const p = data.value
  if (!p) return []
  return [
    { key: 'subject', label: 'Subjek', value: p.subjectName || p.subject || '—' },
    { key: 'year', label: 'Tahun', value: p.year },
    { key: 'negeri', label: 'Negeri', value: p.negeri || '—' },
    { key: 'kertas', label: 'Kertas', value: p.kertas === null ? '—' : `Kertas ${String(p.kertas)}` },
    { key: 'jenis', label: 'Jenis', value: INTAKE_PAPER_TYPE_LABELS[p.paperType] },
    { key: 'source', label: 'Sumber', value: p.sourceLabel },
    { key: 'scheme', label: 'Skema?', value: yesNo(p.hasScheme) },
    { key: 'review', label: 'Perlu Semakan', value: yesNo(p.needsReview) },
    { key: 'files', label: 'Fail:', value: p.fileNames.join(', ') || '—' },
  ]
})

interface QuestionRow extends Record<string, unknown> {
  no: string
  questionId: string
  excerpt: string
  parts: number
}
const questions = computed<QuestionRow[]>(() => (data.value?.questionList ?? []).map((q) => ({ ...q })))
const columns: TableColumn<QuestionRow>[] = [
  { accessorKey: 'no', header: 'No.' },
  { accessorKey: 'excerpt', header: 'Soalan' },
  { accessorKey: 'parts', header: 'Bilangan Bahagian' },
  { id: 'actions', header: '' },
]
const studioPath = (questionId: unknown): string => `/admin/studio/questions/${String(questionId)}/sunting`
</script>

<template>
  <DsPage layout="detail" back-to="/admin/source-papers" data-testid="source-paper-detail">
    <DsLoadError v-if="error && !notFound" :message="LOAD_ERROR" testid="source-paper-error" retry-testid="source-paper-retry" @retry="reload()" />

    <DsStack v-else-if="data" gap="lg">
      <DsDefinitionList :items="facts" data-testid="source-paper-facts" />

      <DsSection v-if="data.issues.length > 0" title="Isu Import" data-testid="source-paper-issues">
        <DsStack gap="sm">
          <DsCallout v-for="(issue, i) in data.issues" :key="i" tone="warning" data-testid="source-paper-issue">
            <DsText as="span" variant="label">{{ issue.where }}</DsText>
            <DsText as="span" variant="body">{{ issue.message }}</DsText>
          </DsCallout>
        </DsStack>
      </DsSection>

      <DsSection :title="`Soalan Diimport (${data.questionList.length}) — semuanya draf`" data-testid="source-paper-questions">
        <DsDataTable
          :data="questions"
          :columns="columns"
          :total="questions.length"
          :page-size="Math.max(questions.length, 1)"
          caption="Soalan diimport"
          variant="flush"
          density="compact"
          :empty-title="SOURCE_PAPER_MESSAGES.emptyQuestions"
          empty-description=""
          card-title="no"
          :card-fields="[
            { key: 'excerpt', label: 'Soalan' },
            { key: 'parts', label: 'Bilangan Bahagian' },
          ]"
          row-key="questionId"
          data-testid="source-paper-questions-table"
        >
          <template #empty>
            <DsText as="span" variant="body" data-testid="source-paper-questions-empty">{{ SOURCE_PAPER_MESSAGES.emptyQuestions }}</DsText>
          </template>
          <template #actions-cell="{ row }">
            <DsLink :to="studioPath(row.original.questionId)" data-testid="source-paper-studio">Sunting di Studio</DsLink>
          </template>
          <template #card-actions="{ row }">
            <DsLink :to="studioPath(row.questionId)" data-testid="source-paper-studio">Sunting di Studio</DsLink>
          </template>
        </DsDataTable>
      </DsSection>
    </DsStack>
  </DsPage>
</template>
