<script setup lang="ts">
/**
 * S2 card "Peta DSKP — Standard Pembelajaran" (FR-M27-58, 60…64; restyle spec AS-47): the caption "KSSM
 * {Subjek} Tingkatan {n}" and a `DsHeatGrid` in the staff kobalt ramp. One row per Bidang ("{code} {name}",
 * a Bidang with more than 11 SP continues on further rows), one column per SP position, the percent in every
 * answered cell and a dash where the SP was not attempted. The popover of a cell names the SP, its status
 * and, when answered, "{n} cuba · {p}% betul" (FR-M27-63). The legend line explains the ramp and the
 * "Belum Cuba" cells. The empty text shows when the level or subject has no SP.
 */
import { computed } from 'vue'

import { DsHeatGrid, DsPanel, type HeatRow } from '@/ds'

import type { HeatmapBidang, HeatmapSp } from '../../api/school-admin'
import { LEGEND, tileTitle } from './dskp-status'

const props = defineProps<{ caption: string | null; bidang: HeatmapBidang[]; empty: boolean }>()

const MAX_COLUMNS = 11

const columns = computed(() => {
  const widest = Math.min(MAX_COLUMNS, Math.max(1, ...props.bidang.map((b) => b.sp.length)))
  return Array.from({ length: widest }, (_, i) => String(i + 1))
})

interface RowSp {
  id: string
  sp: (HeatmapSp | null)[]
}
const spRows = computed<RowSp[]>(() =>
  props.bidang.flatMap((b) => {
    const chunks: (HeatmapSp | null)[][] = []
    for (let i = 0; i < b.sp.length; i += MAX_COLUMNS) chunks.push(b.sp.slice(i, i + MAX_COLUMNS))
    return chunks.map((sp, n) => ({ id: `${String(b.id)}-${String(n)}`, sp }))
  }),
)
const rows = computed<HeatRow[]>(() =>
  props.bidang.flatMap((b) => {
    const chunkCount = Math.max(1, Math.ceil(b.sp.length / MAX_COLUMNS))
    return Array.from({ length: chunkCount }, (_, n) => ({
      id: `${String(b.id)}-${String(n)}`,
      label: n === 0 ? (b.code ? `${b.code} ${b.name}` : b.name) : '…',
      cells: columns.value.map((_, c) => b.sp[n * MAX_COLUMNS + c]?.pct ?? null),
    }))
  }),
)

function titleOf(rowId: string, column: number): string {
  const sp = spRows.value.find((r) => r.id === rowId)?.sp[column]
  return sp ? tileTitle(sp) : 'Tiada Standard Pembelajaran'
}
</script>

<template>
  <DsPanel data-testid="dh-card">
    <div class="flex min-w-0 flex-col gap-4">
      <h2 class="flex items-center gap-2 text-subheading text-highlighted" data-testid="dh-heading">
        <UIcon name="i-ph-map-trifold" class="size-5 shrink-0 text-primary-t" aria-hidden="true" />Peta
        DSKP — Standard Pembelajaran
      </h2>

      <p v-if="empty" class="py-6 text-center text-body text-muted" data-testid="dh-empty">
        Tiada Standard Pembelajaran untuk subjek dan tingkatan ini.
      </p>
      <template v-else>
        <p v-if="caption" class="text-overline text-muted" data-testid="dh-caption">
          {{ caption }}
        </p>

        <DsHeatGrid
          :columns="columns"
          :rows="rows"
          label="Peta DSKP mengikut Bidang dan Standard Pembelajaran"
          low-label="Lemah (<50%)"
          high-label="Mahir (75%+)"
          no-data-label="Belum Cuba"
          :legend="false"
          data-testid="dh-tiles"
        >
          <template #popover="{ row, column }">
            <span data-testid="dh-tile-title">{{ titleOf(row.id, column) }}</span>
          </template>
        </DsHeatGrid>
      </template>

      <ul class="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted" data-testid="dh-legend">
        <li v-for="l in LEGEND" :key="l.status">{{ l.label }}</li>
      </ul>
    </div>
  </DsPanel>
</template>
