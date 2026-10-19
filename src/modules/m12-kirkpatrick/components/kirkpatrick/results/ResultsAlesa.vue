<script setup lang="ts">
/**
 * "Ramalan ALESA (Predictive Grade)" (FN-M12-6.7.1 ... 6.7.4; FR-M12-54 ... 57; BR-M12-22): visible heading icon (DV-M12-06), three
 * tiles and the footer computed by the API from the listed rows, the stored rows by grade, Keyakinan badges and the
 * Cadangan text of the stored band. Staff table (`DsDataTable`).
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable, DsPanel, DsText } from '@/ds'

import type { Results, SpmGrade } from '../../../api/types'
import { pct, plain } from '../common/kirkpatrick-format'
import { CADANGAN, CONFIDENCE, GRADE_PILL } from './results-format'

const props = defineProps<{ alesa: Results['alesa'] }>()

type ConfKey = keyof typeof CONFIDENCE
/** Slot rows are untyped; this narrows the grade for the badge colour. */
const gradeColor = (grade: unknown) => GRADE_PILL[grade as SpmGrade]

type Row = Record<string, unknown> & {
  userId: number
  index: number
  name: string
  schoolName: string
  accuracy: string
  grade: Results['alesa']['rows'][number]['grade']
  confidence: Results['alesa']['rows'][number]['confidence']
  confidenceText: string
  cadangan: string
}

const data = computed<Row[]>(() =>
  props.alesa.rows.map((r, i) => ({
    userId: r.userId,
    index: i + 1,
    name: r.name,
    schoolName: r.schoolName,
    accuracy: pct(r.accuracy),
    grade: r.grade,
    confidence: r.confidence,
    confidenceText: CONFIDENCE[r.confidence].label,
    cadangan: CADANGAN[r.cadanganBand],
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  { accessorKey: 'accuracy', header: 'Ketepatan' },
  { accessorKey: 'grade', header: 'Ramalan Gred' },
  { accessorKey: 'confidenceText', header: 'Keyakinan' },
  { accessorKey: 'cadangan', header: 'Cadangan' },
]
const cardFields = [
  { key: 'schoolName', label: 'Sekolah' },
  { key: 'accuracy', label: 'Ketepatan' },
  { key: 'grade', label: 'Ramalan Gred' },
  { key: 'confidenceText', label: 'Keyakinan' },
  { key: 'cadangan', label: 'Cadangan' },
]

/** Paged at 20 rows. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
</script>

<template>
  <DsPanel
    title="Ramalan ALESA (Predictive Grade)"
    description="Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar"
    icon="i-ph-sparkle"
    data-testid="res-alesa"
  >
    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      <UCard variant="soft" class="min-w-0 text-center" data-testid="alesa-lulus">
        <DsText variant="heading" tone="success" tabular data-testid="tile-value">
          {{ plain(alesa.lulus) }}
        </DsText>
        <DsText variant="body" tone="muted">Dijangka Lulus</DsText>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="alesa-gagal">
        <DsText variant="heading" tone="error" tabular data-testid="tile-value">
          {{ plain(alesa.gagal) }}
        </DsText>
        <DsText variant="body" tone="muted">Dijangka Gagal</DsText>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="alesa-intervensi">
        <DsText variant="heading" tone="warning" tabular data-testid="tile-value">
          {{ plain(alesa.intervensi) }}
        </DsText>
        <DsText variant="body" tone="muted">Perlu Intervensi</DsText>
      </UCard>
    </div>
    <DsDataTable
      v-model:page-size="pageSize"
      variant="bare"
      :page-size-options="PAGE_SIZES"
      :data="data"
      :columns="columns"
      caption="Ramalan ALESA"
      card-title="name"
      :card-fields="cardFields"
    >
      <template #name-cell="{ row }">
        <span class="flex flex-col" data-testid="alesa-row">
          <DsText variant="label" tone="highlighted" data-testid="alesa-name">{{
            row.original.name
          }}</DsText>
          <DsText variant="body" as="span" tone="muted">{{ row.original.schoolName }}</DsText>
        </span>
      </template>
      <template #grade-cell="{ row }">
        <UBadge
          :color="gradeColor(row.original.grade)"
          variant="soft"
          :label="row.original.grade"
          data-testid="alesa-grade"
        />
      </template>
      <template #confidenceText-cell="{ row }">
        <UBadge
          :color="CONFIDENCE[row.original.confidence as ConfKey].color"
          variant="soft"
          :label="row.original.confidenceText"
          data-testid="alesa-confidence"
        />
      </template>
      <template #cadangan-cell="{ row }">
        <DsText
          variant="body"
          as="span"
          class="block min-w-56 whitespace-normal"
          data-testid="alesa-cadangan"
          >{{ row.original.cadangan }}</DsText
        >
      </template>
    </DsDataTable>
    <UAlert color="primary" variant="soft" icon="i-ph-info" data-testid="alesa-footer">
      <template #description>
        <strong>{{ plain(alesa.lulus) }} pelajar dijangka lulus</strong>,
        {{ plain(alesa.intervensi) }} pelajar perlu intervensi segera. Ramalan ini berdasarkan
        formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%).
      </template>
    </UAlert>
  </DsPanel>
</template>
