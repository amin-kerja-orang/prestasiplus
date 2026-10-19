<script setup lang="ts">
/**
 * S2 "Tracking Mingguan", `#section-mingguan` (FN-M11-3.6.1 / 3.6.2; FR-M11-43, 44). The Sekolah column
 * is the sticky first column of the drill table (as live; SRS FR-M11-43); the table scrolls inside its
 * card. Cell classes come from the handler (`cls`): zero muted, info (first week or equal to the
 * previous), success up, error down; the best week gets the solid badge variant and a star. Paged at 20
 * rows; cards below md.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, h, ref } from 'vue'

import { DsDataTable, DsStack, DsCluster, DsText } from '@/ds'

import type { WeeklyCellClass, WeeklyRow } from '../../api/types'
import { count, type UiColor } from './monitoring-format'
import type { MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  weeks: readonly { k: number; from: string; to: string }[]
  rows: readonly WeeklyRow[]
  paths: MonitoringPaths
}>()

/** Paged at 20 rows (FN-M11-3.6.1). */
const pageSize = ref(20)
const PAGE_SIZES = [10, 20, 50]

const CELL: Record<WeeklyCellClass, UiColor> = {
  zero: 'neutral',
  first: 'info',
  up: 'success',
  down: 'error',
}
const TREND_TITLE = { up: 'Meningkat', down: 'Menurun', same: 'Sama' } as const
const trendTitle = (t: WeeklyRow['trend']) => TREND_TITLE[t]

const cellOf = (r: WeeklyRow, k: number) => r.cells.find((c) => c.k === k)

type Row = WeeklyRow & Record<string, unknown>
const data = computed<Row[]>(() => props.rows.map((r) => ({ ...r })))
const columns = computed<TableColumn<Row>[]>(() => [
  { id: 'school', header: 'Sekolah', accessorKey: 'name' },
  ...props.weeks.map((w): TableColumn<Row> => ({
    id: `w${String(w.k)}`,
    header: () =>
      h(
        'span',
        { title: `${w.from} - ${w.to}`, 'data-testid': 'mon-week-head' },
        `M${String(w.k)}`,
      ),
    accessorFn: (r) => cellOf(r, w.k)?.count ?? 0,
  })),
  { id: 'trend', header: 'Trend', accessorKey: 'trend' },
  { id: 'best', header: 'Best', accessorFn: (r) => r.best?.k ?? 0 },
])
</script>

<template>
  <DsStack id="section-mingguan" as="section" gap="lg" data-testid="mon-weekly">
    <DsStack gap="2xs">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <UIcon name="i-ph-calendar-dots" class="size-6 text-primary-t" />Tracking Mingguan
      </h2>
      <DsText variant="body" tone="muted">
        Jumlah soalan dijawab mengikut minggu — warna menunjukkan trend naik/turun
      </DsText>
    </DsStack>

    <DsDataTable
      v-model:page-size="pageSize"
      variant="bare"
      density="tight"
      :page-size-options="PAGE_SIZES"
      :data="data"
      :columns="columns"
      caption="Tracking mingguan"
    >
      <template #school-cell="{ row }">
        <DsStack gap="2xs" class="max-w-56 min-w-36" data-testid="mon-weekly-row">
          <RouterLink
            :to="paths.school(row.original.schoolId)"
            :title="row.original.name"
            class="line-clamp-2 text-label text-primary-t"
            >{{ row.original.name }}</RouterLink
          >
          <DsText variant="body" as="span" tone="muted">{{ row.original.code ?? '-' }}</DsText>
        </DsStack>
      </template>
      <template v-for="w in weeks" :key="w.k" #[`w${String(w.k)}-cell`]="{ row }">
        <UBadge
          v-if="cellOf(row.original, w.k)"
          :color="CELL[cellOf(row.original, w.k)!.cls]"
          :variant="cellOf(row.original, w.k)!.best ? 'solid' : 'subtle'"
          :icon="cellOf(row.original, w.k)!.best ? 'i-ph-star-fill' : undefined"
          size="lg"
          class="tabular min-w-11 justify-center"
          :data-cls="cellOf(row.original, w.k)!.cls"
          :data-best="cellOf(row.original, w.k)!.best ? 'true' : 'false'"
          data-testid="mon-weekly-cell"
          :label="
            cellOf(row.original, w.k)!.count === 0 ? '-' : count(cellOf(row.original, w.k)!.count)
          "
        />
      </template>
      <template #trend-cell="{ row }">
        <span
          :title="trendTitle(row.original.trend)"
          class="inline-flex"
          data-testid="mon-weekly-trend-icon"
        >
          <UIcon
            v-if="row.original.trend === 'up'"
            name="i-ph-arrow-up"
            class="size-5 text-success"
          />
          <UIcon
            v-else-if="row.original.trend === 'down'"
            name="i-ph-arrow-down"
            class="size-5 text-error"
          />
          <UIcon v-else name="i-ph-minus" class="size-5 text-muted" />
        </span>
      </template>
      <template #best-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="mon-weekly-best">
          <template v-if="row.original.best">
            <DsText variant="label" tone="highlighted">M{{ row.original.best.k }}</DsText
            >{{ ' ' }}
            <span class="tabular ml-1 text-body text-muted">{{
              count(row.original.best.count)
            }}</span>
          </template>
          <span v-else class="text-dimmed">-</span>
        </span>
      </template>
      <template #card="{ row }">
        <DsStack gap="sm">
          <DsCluster align="start" justify="between" :wrap="false">
            <DsStack gap="2xs">
              <RouterLink
                :to="paths.school((row as Row).schoolId)"
                class="line-clamp-2 text-label text-primary-t"
                >{{ (row as Row).name }}</RouterLink
              >
              <DsText variant="body" as="span" tone="muted">{{ (row as Row).code ?? '-' }}</DsText>
            </DsStack>
            <UIcon
              v-if="(row as Row).trend === 'up'"
              name="i-ph-arrow-up"
              class="size-5 text-success"
            />
            <UIcon
              v-else-if="(row as Row).trend === 'down'"
              name="i-ph-arrow-down"
              class="size-5 text-error"
            />
            <UIcon v-else name="i-ph-minus" class="size-5 text-muted" />
          </DsCluster>
          <DsCluster as="ul" gap="xs" align="stretch">
            <li v-for="w in weeks" :key="w.k" class="flex items-center gap-1 text-body text-muted">
              M{{ w.k }}
              <UBadge
                v-if="cellOf(row as Row, w.k)"
                :color="CELL[cellOf(row as Row, w.k)!.cls]"
                :variant="cellOf(row as Row, w.k)!.best ? 'solid' : 'subtle'"
                size="lg"
                class="tabular"
                :label="
                  cellOf(row as Row, w.k)!.count === 0 ? '-' : count(cellOf(row as Row, w.k)!.count)
                "
              />
            </li>
          </DsCluster>
        </DsStack>
      </template>
    </DsDataTable>

    <p class="flex flex-wrap gap-x-4 gap-y-1 text-body text-muted" data-testid="mon-week-footer">
      <span v-for="w in weeks" :key="w.k"
        ><strong class="text-default">M{{ w.k }}</strong
        >: {{ w.from }} - {{ w.to }}</span
      >
    </p>
  </DsStack>
</template>
