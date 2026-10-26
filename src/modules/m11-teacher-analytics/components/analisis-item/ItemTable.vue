<script setup lang="ts">
/**
 * FN-M11-5.1.5 (provisional, PROPOSED layout): Soalan · Subjek · Percubaan · % Betul (band badge) ·
 * Diskriminasi (+ "baik" / "semak semula"). Scrolls inside its card, never the page. Every cell element
 * carries `data-question-id`, so a row is found by its question id.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDrillTable } from '@/ds'

import type { ItemAnalysisRow } from '../../api/types'
import { BAND_COLOR, clip80, discLabel, discNote, pctLabel } from './bands'
import { ITEM_COPY } from './copy'

const props = defineProps<{ rows: ItemAnalysisRow[] }>()
const bandColor = (b: ItemAnalysisRow['band']) => BAND_COLOR[b]

type Row = ItemAnalysisRow & Record<string, unknown>
const data = computed<Row[]>(() => props.rows.map((r) => ({ ...r })))
const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'textPlain', header: ITEM_COPY.colQuestion },
  { accessorKey: 'subjectName', header: ITEM_COPY.colSubject },
  { accessorKey: 'attempts', header: ITEM_COPY.colAttempts },
  { accessorKey: 'pct', header: ITEM_COPY.colPct },
  { accessorKey: 'discrimination', header: ITEM_COPY.colDiscrimination },
])
</script>

<template>
  <UCard data-testid="item-table-card">
    <DsDrillTable :data="data" :columns="columns" caption="Analisis item soalan">
      <template #textPlain-cell="{ row }">
        <div
          class="max-w-48 min-w-32 break-words whitespace-normal xl:max-w-72"
          data-testid="item-row"
          :data-question-id="row.original.questionId"
          :data-band="row.original.band"
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
      <template #pct-cell="{ row }">
        <UBadge
          :color="bandColor(row.original.band)"
          variant="subtle"
          icon="i-ph-circle-fill"
          :data-band="row.original.band"
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
