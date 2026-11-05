<script setup lang="ts">
/**
 * FN-M11-5.1.5 / FR-GUR-6-5: # · Soalan · Subjek · Cubaan · Betul · Salah · % Betul (Tahap badge, whole number) ·
 * Diskriminasi (2 decimals + "baik" / "semak semula"; "Data Tidak Mencukupi" when it cannot be computed).
 * Scrolls inside its card, never the page. Every cell element carries `data-question-id`, so a row is found by
 * its question id. `offset` is the number of rows on earlier pages (the # column continues across pages).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDrillTable, DsText } from '@/ds'

import type { ItemAnalysisRow } from '../../api/types'
import { BAND_COLOR, clip80, discLabel, discNote, pctLabel, tahapOf } from './bands'
import { ITEM_COPY } from './copy'

const props = withDefaults(defineProps<{ rows: ItemAnalysisRow[]; offset?: number }>(), { offset: 0 })
const bandColor = (b: ItemAnalysisRow['band']) => BAND_COLOR[b]

type Row = ItemAnalysisRow & Record<string, unknown> & { index: number; tahap: ItemAnalysisRow['band'] }
const data = computed<Row[]>(() =>
  props.rows.map((r, i) => ({ ...r, index: props.offset + i + 1, tahap: tahapOf(r.pct) })),
)
const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'index', header: ITEM_COPY.colIndex },
  { accessorKey: 'textPlain', header: ITEM_COPY.colQuestion },
  { accessorKey: 'subjectName', header: ITEM_COPY.colSubject },
  { accessorKey: 'attempts', header: ITEM_COPY.colAttempts },
  { accessorKey: 'correct', header: ITEM_COPY.colCorrect },
  { accessorKey: 'wrong', header: ITEM_COPY.colWrong },
  { accessorKey: 'pct', header: ITEM_COPY.colPct },
  { accessorKey: 'discrimination', header: ITEM_COPY.colDiscrimination },
])
</script>

<template>
  <UCard data-testid="item-table-card">
    <DsDrillTable :data="data" :columns="columns" caption="Analisis item soalan">
      <template #index-cell="{ row }">
        <DsText as="span" variant="meta" data-testid="item-index">{{ row.original.index }}</DsText>
      </template>
      <template #textPlain-cell="{ row }">
        <div
          class="max-w-48 min-w-32 break-words whitespace-normal xl:max-w-72"
          data-testid="item-row"
          :data-question-id="row.original.questionId"
          :data-band="row.original.tahap"
        >
          <span data-testid="item-question" :data-question-id="row.original.questionId">{{
            clip80(row.original.textPlain)
          }}</span>
        </div>
      </template>
      <template #subjectName-cell="{ row }">
        <span
          class="whitespace-nowrap"
          data-testid="item-subject"
          :data-question-id="row.original.questionId"
          >{{ row.original.subjectName }}</span
        >
      </template>
      <template #attempts-cell="{ row }">
        <span
          class="tabular"
          data-testid="item-attempts"
          :data-question-id="row.original.questionId"
          >{{ row.original.attempts }}</span
        >
      </template>
      <template #correct-cell="{ row }">
        <DsText
          as="span"
          variant="label"
          tone="success"
          tabular
          data-testid="item-correct"
          :data-question-id="row.original.questionId"
          >{{ row.original.correct }}</DsText
        >
      </template>
      <template #wrong-cell="{ row }">
        <DsText
          as="span"
          variant="label"
          tone="error"
          tabular
          data-testid="item-wrong"
          :data-question-id="row.original.questionId"
          >{{ row.original.wrong }}</DsText
        >
      </template>
      <template #pct-cell="{ row }">
        <UBadge
          :color="bandColor(row.original.tahap)"
          variant="subtle"
          icon="i-ph-circle-fill"
          :data-band="row.original.tahap"
          :data-question-id="row.original.questionId"
          data-testid="item-dot"
        >
          <span
            class="tabular"
            data-testid="item-pct"
            :data-question-id="row.original.questionId"
            >{{ pctLabel(row.original.pct) }}</span
          >
        </UBadge>
      </template>
      <template #discrimination-cell="{ row }">
        <span class="tabular whitespace-nowrap">
          <span data-testid="item-disc" :data-question-id="row.original.questionId">{{
            discLabel(row.original.discrimination)
          }}</span>
          <span
            v-if="discNote(row.original.discrimination)"
            :class="[
              'ml-2 text-caption',
              discNote(row.original.discrimination) === 'baik' ? 'text-success' : 'text-error',
            ]"
            data-testid="item-disc-note"
            :data-question-id="row.original.questionId"
            >{{ discNote(row.original.discrimination) }}</span
          >
        </span>
      </template>
    </DsDrillTable>
  </UCard>
</template>
