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

import { DsBadge, DsDataTable, DsPanel } from '@/ds'

import type { WeeklyCellClass, WeeklyRow } from '../../api/types'
import { count, type UiColor } from './monitoring-format'
import type { MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  weeks: readonly { k: number; from: string; to: string }[]
  rows: readonly WeeklyRow[]
  paths: MonitoringPaths
}>()

/** R1-AS-10: the last 12 weeks only, labelled M1..M12 oldest first (`k` stays the API key of a cell). */
const WEEK_LIMIT = 12
const shown = computed(() => props.weeks.slice(-WEEK_LIMIT).map((w, i) => ({ ...w, n: i + 1 })))
const labelOf = (k: number) => {
  const w = shown.value.find((x) => x.k === k)
  return w ? `M${String(w.n)}` : null
}

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
/** The best week is recomputed over the weeks shown (first week with the highest count > 0). */
const bestOf = (r: WeeklyRow): { k: number; count: number } | null => {
  let best: { k: number; count: number } | null = null
  for (const w of shown.value) {
    const c = cellOf(r, w.k)
    if (c && c.count > 0 && (best === null || c.count > best.count))
      best = { k: w.k, count: c.count }
  }
  return best
}
const isBest = (r: WeeklyRow, k: number) => bestOf(r)?.k === k

type Row = WeeklyRow & Record<string, unknown>
const data = computed<Row[]>(() => props.rows.map((r) => ({ ...r })))
const columns = computed<TableColumn<Row>[]>(() => [
  { id: 'school', header: 'Sekolah', accessorKey: 'name' },
  ...shown.value.map((w): TableColumn<Row> => ({
    id: `w${String(w.k)}`,
    header: () =>
      h(
        'span',
        {
          title: `${w.from} - ${w.to}`,
          class: 'block text-center',
          'data-testid': 'mon-week-head',
        },
        `M${String(w.n)}`,
      ),
    accessorFn: (r) => cellOf(r, w.k)?.count ?? 0,
    meta: { width: 'xs' },
  })),
  { id: 'trend', header: 'Trend', accessorKey: 'trend' },
  { id: 'best', header: 'Best', accessorFn: (r) => bestOf(r)?.k ?? 0 },
])
</script>

<template>
  <section id="section-mingguan" class="flex flex-col gap-6" data-testid="mon-weekly">
    <DsPanel
      title="Tracking Mingguan"
      description="Jumlah soalan dijawab setiap minggu (12 minggu terakhir)."
      icon="calendar-dots"
      accent="action"
    >
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
          <div
            class="flex max-w-64 min-w-48 flex-col gap-1 whitespace-normal"
            data-testid="mon-weekly-row"
          >
            <RouterLink
              :to="paths.school(row.original.schoolId)"
              :title="row.original.name"
              class="line-clamp-2 text-label text-primary-t"
              >{{ row.original.name }}</RouterLink
            >
            <span class="text-body text-muted">{{ row.original.code ?? '-' }}</span>
          </div>
        </template>
        <template v-for="w in shown" :key="w.k" #[`w${String(w.k)}-cell`]="{ row }">
          <DsBadge
            v-if="cellOf(row.original, w.k)"
            :tone="CELL[cellOf(row.original, w.k)!.cls]"
            :emphasis="isBest(row.original, w.k) ? 'strong' : 'soft'"
            :icon="isBest(row.original, w.k) ? 'star' : undefined"
            class="tabular min-w-10 justify-center"
            :data-cls="cellOf(row.original, w.k)!.cls"
            :data-best="isBest(row.original, w.k) ? 'true' : 'false'"
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
            <template v-if="bestOf(row.original)">
              <span class="text-label text-highlighted">{{ labelOf(bestOf(row.original)!.k) }}</span
              >{{ ' ' }}
              <span class="tabular ml-1 text-body text-muted">{{
                count(bestOf(row.original)!.count)
              }}</span>
            </template>
            <span v-else class="text-dimmed">-</span>
          </span>
        </template>
        <template #card="{ row }">
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 flex-col gap-1">
                <RouterLink
                  :to="paths.school((row as Row).schoolId)"
                  class="line-clamp-2 text-label text-primary-t"
                  >{{ (row as Row).name }}</RouterLink
                >
                <span class="text-body text-muted">{{ (row as Row).code ?? '-' }}</span>
              </div>
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
            </div>
            <ul class="flex flex-wrap gap-2">
              <li
                v-for="w in shown"
                :key="w.k"
                class="flex items-center gap-1 text-body text-muted"
              >
                M{{ w.n }}
                <DsBadge
                  v-if="cellOf(row as Row, w.k)"
                  :tone="CELL[cellOf(row as Row, w.k)!.cls]"
                  :emphasis="isBest(row as Row, w.k) ? 'strong' : 'soft'"
                  class="tabular"
                  :label="
                    cellOf(row as Row, w.k)!.count === 0
                      ? '-'
                      : count(cellOf(row as Row, w.k)!.count)
                  "
                />
              </li>
            </ul>
          </div>
        </template>
      </DsDataTable>
    </DsPanel>

    <p class="flex flex-wrap gap-x-4 gap-y-1 text-body text-muted" data-testid="mon-week-footer">
      <span v-for="w in shown" :key="w.k"
        ><strong class="text-default">M{{ w.n }}</strong
        >: {{ w.from }} - {{ w.to }}</span
      >
    </p>
  </section>
</template>
