<script setup lang="ts">
/**
 * S4 "Senarai Soalan" (FN-M11-4.2.6; FR-M11-67): table newest first, 20 rows at first and "Papar lagi
 * 20" adds 20 until all are shown. A row click asks the page to open the question modal.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { DsDrillTable, DsStack, DsCluster, DsHeading, DsText } from '@/ds'

import type { StudentAnswerRow, StudentDetail } from '../../api/types'
import { dmyHm } from './monitoring-format'

const props = defineProps<{ answers: StudentDetail['answers'] }>()
const emit = defineEmits<{ open: [row: StudentAnswerRow] }>()

const shown = ref(20)
const visible = computed(() => props.answers.rows.slice(0, shown.value))
const more = computed(() => shown.value < props.answers.rows.length)

type Row = StudentAnswerRow & Record<string, unknown>
const data = computed<Row[]>(() => visible.value.map((r) => ({ ...r })))
const columns: TableColumn<Row>[] = [
  { id: 'no', header: '#', accessorFn: (r) => r.questionId },
  { id: 'text', header: 'Soalan', accessorKey: 'textPlain' },
  { id: 'subject', header: 'Subjek', accessorKey: 'subjectName' },
  { id: 'selected', header: 'Jawapan', accessorKey: 'selectedLabel' },
  { id: 'correct', header: 'Betul', accessorKey: 'correctLabel' },
  { id: 'status', header: 'Status', accessorKey: 'isCorrect' },
  { id: 'date', header: 'Tarikh', accessorKey: 'answeredAt' },
]

const excerpt = (text: string) => (text.length > 80 ? `${text.slice(0, 80)}...` : text)
</script>

<template>
  <UCard data-testid="mon-panel-list">
    <DsStack>
      <DsHeading :level="2" variant="label" data-testid="mon-list-heading">
        Senarai Soalan ({{ answers.available }} tersedia daripada {{ answers.total }})
      </DsHeading>
      <DsDrillTable
        :data="data"
        :columns="columns"
        caption="Senarai soalan"
        @drill="(r: Row) => emit('open', r)"
      >
        <template #no-cell="{ row }">
          <DsText variant="caption" as="span" tabular>{{ row.index + 1 }}</DsText>
        </template>
        <template #text-cell="{ row }">
          <UButton
            variant="link"
            color="primary"
            class="h-auto min-w-56 p-0 text-start whitespace-normal"
            trailing-icon="i-ph-arrow-square-out"
            :label="excerpt(row.original.textPlain)"
            :title="row.original.textPlain"
            :data-correct="row.original.isCorrect ? 'true' : 'false'"
            data-testid="mon-list-row"
            @click.stop="emit('open', row.original)"
          />
        </template>
        <template #selected-cell="{ row }">
          <span :class="['text-label', row.original.isCorrect ? 'text-success' : 'text-error']">{{
            row.original.selectedLabel ?? '-'
          }}</span>
        </template>
        <template #correct-cell="{ row }">
          <DsText variant="label" tone="success">{{ row.original.correctLabel ?? '-' }}</DsText>
        </template>
        <template #status-cell="{ row }">
          <UIcon
            v-if="row.original.isCorrect"
            name="i-ph-check-circle"
            class="size-5 text-success"
          />
          <UIcon v-else name="i-ph-x-circle" class="size-5 text-error" />
        </template>
        <template #date-cell="{ row }">
          <span class="tabular whitespace-nowrap">{{ dmyHm(row.original.answeredAt) }}</span>
        </template>
      </DsDrillTable>
      <DsCluster v-if="more" gap="none" align="stretch" justify="center" :wrap="false">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="lg"
          icon="i-ph-caret-down"
          :label="`Papar lagi 20 (${Math.min(shown, answers.rows.length)}/${answers.total})`"
          data-testid="mon-list-more"
          @click="shown += 20"
        />
      </DsCluster>
    </DsStack>
  </UCard>
</template>
