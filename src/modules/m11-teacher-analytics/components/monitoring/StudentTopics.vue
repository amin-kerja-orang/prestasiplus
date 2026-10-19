<script setup lang="ts">
/** S4 "Mengikut Tajuk" (FN-M11-4.2.5; FR-M11-66): topics grouped by subject with a Kuat / Sederhana / Lemah badge. */
import type { TableColumn } from '@nuxt/ui'

import { DsDrillTable, DsStack, DsHeading, DsText } from '@/ds'

import type { StudentDetail, TopicBadge } from '../../api/types'
import { ACCURACY_TEXT, TOPIC_COLOR, accuracyBand, count, pct1 } from './monitoring-format'

defineProps<{ topics: StudentDetail['topics'] }>()

type Row = StudentDetail['topics'][number]['rows'][number] & Record<string, unknown>
const columns: TableColumn<Row>[] = [
  { id: 'bab', header: 'Bab', accessorKey: 'bab' },
  { id: 'name', header: 'Tajuk', accessorKey: 'name' },
  { id: 'pct', header: 'Ketepatan', accessorKey: 'pct' },
  {
    id: 'score',
    header: 'Betul/Jumlah',
    accessorFn: (r) => `${String(r.correct)}/${String(r.total)}`,
  },
  { id: 'badge', header: 'Tahap', accessorKey: 'badge' },
]
const topicColor = (b: TopicBadge) => TOPIC_COLOR[b]
const rowsOf = (g: StudentDetail['topics'][number]): Row[] => g.rows.map((r) => ({ ...r }))
</script>

<template>
  <UCard data-testid="mon-panel-topic">
    <DsStack>
      <h2 class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-stack" class="size-5 text-primary-t" />Mengikut Tajuk
      </h2>
      <DsStack v-for="g in topics" :key="g.subjectId" gap="2xs" data-testid="mon-topic-group">
        <DsHeading :level="3" variant="overline" tone="primary">{{ g.subjectName }}</DsHeading>
        <DsDrillTable :data="rowsOf(g)" :columns="columns" :caption="g.subjectName">
          <template #bab-cell="{ row }">
            <DsText
              variant="caption"
              as="span"
              class="whitespace-nowrap"
              data-testid="mon-topic-row"
              >{{ row.original.bab === null ? '' : `Bab ${String(row.original.bab)}` }}</DsText
            >
          </template>
          <template #pct-cell="{ row }">
            <span
              :class="[
                'tabular text-label whitespace-nowrap',
                ACCURACY_TEXT[accuracyBand(row.original.pct)],
              ]"
              >{{ pct1(row.original.pct) }}</span
            >
          </template>
          <template #score-cell="{ row }">
            <DsText variant="caption" as="span" tabular class="whitespace-nowrap"
              >{{ count(row.original.correct) }}/{{ count(row.original.total) }}</DsText
            >
          </template>
          <template #badge-cell="{ row }">
            <UBadge
              :color="topicColor(row.original.badge)"
              variant="subtle"
              :label="row.original.badge"
            />
          </template>
        </DsDrillTable>
      </DsStack>
    </DsStack>
  </UCard>
</template>
