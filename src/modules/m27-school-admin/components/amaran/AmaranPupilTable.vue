<script setup lang="ts">
/**
 * S4 card "Senarai Pelajar Berisiko" (FR-M27-76, BR-M18-22; restyle spec AS-49): sub-line "Disusun mengikut
 * skor risiko tertinggi"; a `DsDataTable` with "#", "Pelajar", "Tingkatan / Kelas", "Skor", "Status" (badge
 * with icon and word), "Ketepatan", "Penglibatan", "Penguasaan"; below `md` every pupil is a card. Without
 * pupils only the head shows (FR-M27-79).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDataTable, type CardField } from '@/ds'

import type { PupilRiskView, RiskStatus } from '../../api/amaran'
import { STATUS_LABEL } from './amaran-format'

const props = defineProps<{ rows: PupilRiskView[] }>()

interface Row extends Record<string, unknown> {
  userId: number
  rank: string
  name: string
  classLabel: string
  score: string
  status: RiskStatus
  statusLabel: string
  accuracy: string
  engagement: string
  mastery: string
}

const data = computed<Row[]>(() =>
  props.rows.map((p) => ({
    userId: p.userId,
    rank: String(p.rank),
    name: p.name,
    classLabel: p.classLabel,
    score: String(p.score),
    status: p.status,
    statusLabel: STATUS_LABEL[p.status],
    accuracy: p.accuracyText,
    engagement: p.engagementText,
    mastery: p.masteryText,
  })),
)

const columns: TableColumn<Row>[] = [
  { id: 'rank', accessorKey: 'rank', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Pelajar' },
  { id: 'classLabel', accessorKey: 'classLabel', header: 'Tingkatan / Kelas' },
  { id: 'score', accessorKey: 'score', header: 'Skor' },
  { id: 'status', accessorKey: 'statusLabel', header: 'Status' },
  { id: 'accuracy', accessorKey: 'accuracy', header: 'Ketepatan' },
  { id: 'engagement', accessorKey: 'engagement', header: 'Penglibatan' },
  { id: 'mastery', accessorKey: 'mastery', header: 'Penguasaan' },
]
const cardFields: CardField[] = [
  { key: 'classLabel', label: 'Tingkatan / Kelas' },
  { key: 'score', label: 'Skor' },
  { key: 'statusLabel', label: 'Status' },
  { key: 'accuracy', label: 'Ketepatan' },
  { key: 'engagement', label: 'Penglibatan' },
  { key: 'mastery', label: 'Penguasaan' },
]
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" data-testid="am-pupils">
    <div>
      <h2 class="text-subheading text-highlighted">Senarai Pelajar Berisiko</h2>
      <p class="text-caption text-muted">Disusun mengikut skor risiko tertinggi</p>
    </div>
    <DsDataTable
      :data="data"
      :columns="columns"
      caption="Senarai pelajar berisiko"
      card-title="name"
      :card-fields="cardFields"
      :page-size="Math.max(1, data.length)"
      data-testid="am-table"
    >
      <template #rank-cell="{ row }">
        <span data-testid="am-rank">{{ row.original.rank }}</span>
      </template>
      <template #name-cell="{ row }">
        <span class="text-label text-highlighted" data-testid="am-name">{{
          row.original.name
        }}</span>
      </template>
      <template #classLabel-cell="{ row }">
        <span data-testid="am-class">{{ row.original.classLabel }}</span>
      </template>
      <template #score-cell="{ row }">
        <span class="text-label" data-testid="am-score">{{ row.original.score }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="
            row.original.status === 'high'
              ? 'error'
              : row.original.status === 'watch'
                ? 'warning'
                : 'success'
          "
          variant="soft"
          :icon="
            row.original.status === 'high'
              ? 'i-ph-warning-octagon'
              : row.original.status === 'watch'
                ? 'i-ph-warning'
                : 'i-ph-check-circle'
          "
          :label="row.original.statusLabel"
          :data-status="row.original.status"
          data-testid="am-status"
        />
      </template>
      <template #accuracy-cell="{ row }">
        <span data-testid="am-accuracy">{{ row.original.accuracy }}</span>
      </template>
      <template #engagement-cell="{ row }">
        <span data-testid="am-engagement">{{ row.original.engagement }}</span>
      </template>
      <template #mastery-cell="{ row }">
        <span data-testid="am-mastery">{{ row.original.mastery }}</span>
      </template>
    </DsDataTable>
  </section>
</template>
