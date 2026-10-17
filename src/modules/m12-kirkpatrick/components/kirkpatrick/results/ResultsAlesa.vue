<script setup lang="ts">
/**
 * "Ramalan ALESA (Predictive Grade)" (FN-M12-6.7.1 ... 6.7.4; FR-M12-54 ... 57; BR-M12-22): visible heading icon (DV-M12-06), three
 * tiles and the footer computed by the API from the listed rows, the stored rows by grade, Keyakinan badges and the
 * Cadangan text of the stored band. Staff table (`DsDataTable`).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { DsDataTable } from '@/ds'

import type { Results, SpmGrade } from '../../../api/types'
import KirkpatrickTableSection from '../common/KirkpatrickTableSection.vue'
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
</script>

<template>
  <KirkpatrickTableSection
    title="Ramalan ALESA (Predictive Grade)"
    subtitle="Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar"
    icon="i-ph-sparkle"
    data-testid="res-alesa"
  >
    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      <UCard variant="soft" class="min-w-0 text-center" data-testid="alesa-lulus">
        <p class="tabular text-heading text-success" data-testid="tile-value">
          {{ plain(alesa.lulus) }}
        </p>
        <p class="text-caption text-muted">Dijangka Lulus</p>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="alesa-gagal">
        <p class="tabular text-heading text-error" data-testid="tile-value">
          {{ plain(alesa.gagal) }}
        </p>
        <p class="text-caption text-muted">Dijangka Gagal</p>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="alesa-intervensi">
        <p class="tabular text-heading text-warning" data-testid="tile-value">
          {{ plain(alesa.intervensi) }}
        </p>
        <p class="text-caption text-muted">Perlu Intervensi</p>
      </UCard>
    </div>
    <DsDataTable
      :data="data"
      :columns="columns"
      caption="Ramalan ALESA"
      card-title="name"
      :card-fields="cardFields"
      :page-size="Math.max(data.length, 1)"
    >
      <template #name-cell="{ row }">
        <span class="flex flex-col" data-testid="alesa-row">
          <span class="text-label text-highlighted" data-testid="alesa-name">{{
            row.original.name
          }}</span>
          <span class="text-caption text-muted">{{ row.original.schoolName }}</span>
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
        <span class="block min-w-56 text-caption whitespace-normal" data-testid="alesa-cadangan">{{
          row.original.cadangan
        }}</span>
      </template>
    </DsDataTable>
    <UAlert color="primary" variant="soft" icon="i-ph-info" data-testid="alesa-footer">
      <template #description>
        <strong>{{ plain(alesa.lulus) }} pelajar dijangka lulus</strong>,
        {{ plain(alesa.intervensi) }} pelajar perlu intervensi segera. Ramalan ini berdasarkan
        formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%).
      </template>
    </UAlert>
  </KirkpatrickTableSection>
</template>
