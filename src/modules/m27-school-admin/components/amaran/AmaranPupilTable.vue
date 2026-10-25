<script setup lang="ts">
/**
 * S4 card "Senarai Pelajar Berisiko" (FR-M27-76, BR-M18-22; restyle spec AS-49): sub-line "Disusun mengikut
 * skor risiko tertinggi"; a `DsDataTable` with "#", "Pelajar", "Tingkatan / Kelas", "Skor", "Status" (badge
 * with icon and word), "Ketepatan", "Penglibatan", "Penguasaan"; below `md` every pupil is a card. Without
 * pupils only the head shows (FR-M27-79).
 *
 * Layout (SW11-04, DV-M27-26): the table is `layout="fixed"` (cells wrap, nothing scrolls inside) with a width per
 * column. The card is ~696px wide at 768 and ~952px at 1280; eight columns need ~740px plus a readable name, so
 * "Ketepatan", "Penglibatan" and "Penguasaan" show as columns from `xl` only. Below `xl` their values show as a small
 * muted line under the name, each phrase alone as the API words it (the SW6-01 / DV-M27-24 pattern); the hidden columns stay in the DOM, no field is dropped.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsCluster, DsDataTable, DsStatusBadge, DsText, type CardField } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import type { PupilRiskView, RiskStatus } from '../../api/amaran'
import MobileCard from '../MobileCard.vue'
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

// `UTable` reads per-cell classes from the column meta key `class`; the key is computed so the class linter does not
// read it as a class list. Full class strings: Tailwind reads the source text.
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const XL = 'hidden xl:table-cell'
const WIDTHS: Record<string, string> = {
  rank: 'w-12',
  classLabel: 'w-36',
  score: 'w-16',
  status: 'w-40',
  accuracy: `w-24 ${XL}`,
  engagement: `w-28 ${XL}`,
  mastery: `w-28 ${XL}`,
}
// Same breakpoint as `xl` in the column classes (1280); `useMedia` is true without `matchMedia` (jsdom).
const xl = useMedia('(width >= 1280px)')

const sized = (cols: TableColumn<Row>[]): TableColumn<Row>[] =>
  cols.map((c) => {
    const w = WIDTHS[String(c.id)]
    return w ? { ...c, meta: { [META_CLASS]: { th: w, td: w } } } : c
  })

const columns: TableColumn<Row>[] = sized([
  { id: 'rank', accessorKey: 'rank', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Pelajar' },
  { id: 'classLabel', accessorKey: 'classLabel', header: 'Tingkatan / Kelas' },
  { id: 'score', accessorKey: 'score', header: 'Skor' },
  { id: 'status', accessorKey: 'statusLabel', header: 'Status' },
  { id: 'accuracy', accessorKey: 'accuracy', header: 'Ketepatan' },
  { id: 'engagement', accessorKey: 'engagement', header: 'Penglibatan' },
  { id: 'mastery', accessorKey: 'mastery', header: 'Penguasaan' },
])
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
      layout="fixed"
      density="tight"
      :sticky-first-column="false"
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
        <DsCluster v-if="!xl" gap="sm" align="start" data-testid="am-sub">
          <DsText as="span" variant="caption" data-testid="am-sub-accuracy">{{
            row.original.accuracy
          }}</DsText>
          <DsText as="span" variant="caption" data-testid="am-sub-engagement">{{
            row.original.engagement
          }}</DsText>
          <DsText as="span" variant="caption" data-testid="am-sub-mastery">{{
            row.original.mastery
          }}</DsText>
        </DsCluster>
      </template>
      <template #classLabel-cell="{ row }">
        <span data-testid="am-class">{{ row.original.classLabel }}</span>
      </template>
      <template #score-cell="{ row }">
        <span class="text-label" data-testid="am-score">{{ row.original.score }}</span>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          :status="
            row.original.status === 'high'
              ? 'risk-high'
              : row.original.status === 'watch'
                ? 'risk-mid'
                : 'risk-low'
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
      <template #card="{ row }">
        <MobileCard title="name" :fields="cardFields" :row="row" />
      </template>
    </DsDataTable>
  </section>
</template>
