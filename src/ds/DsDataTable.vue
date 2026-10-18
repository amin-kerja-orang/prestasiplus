<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * The one staff table (restyle spec 1.4, design language 9.2): `UTable` + `UPagination` with zebra
 * rows, no lines, tabular numbers and BM pager copy. Three surfaces: `card` (own `UCard`), `flush`
 * (edge-to-edge card for list pages) and `bare` (no surface, for a panel or tab). Below `md` the
 * rows render as a card list (title, label/value pairs, row actions; or the whole card through the
 * `card` slot) with an "Isih" select instead of header sorting. Pagination is client-side unless
 * `total` is given (server paging: the caller slices `data`). At `lg`+ the table never scrolls the
 * page sideways: `layout="fixed"` fits the columns, `auto` scrolls inside its own container.
 */
import UCard from '@nuxt/ui/components/Card.vue'
import type { TableColumn } from '@nuxt/ui'
import { computed, watch } from 'vue'

import { dsCopy, fillCopy } from './copy'
import DsEmptyState from './DsEmptyState.vue'
import { useMedia } from './useMedia'

export interface CardField {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    data: T[]
    columns: TableColumn<T>[]
    /** Visually hidden table caption (BM). */
    caption?: string
    /** Row identity for `selectable` (default: object identity). */
    rowKey?: string
    /** `card` = own card, `flush` = edge-to-edge card (list pages), `bare` = no surface. */
    variant?: 'card' | 'flush' | 'bare'
    /** `fixed` = `table-fixed` full width (the caller sets column widths); `auto` scrolls inside its container when wider. */
    layout?: 'auto' | 'fixed'
    /** `tight` = 4px less cell padding for tables with many columns. */
    density?: 'cozy' | 'tight'
    stickyHeader?: boolean
    /** Default: on for `variant="card"`. */
    stickyFirstColumn?: boolean
    loading?: boolean
    /** Error text (BM); shows an alert with a retry button. */
    error?: string
    retryLabel?: string
    /** Overrides the glossary empty title (live exception). */
    emptyTitle?: string
    emptyDescription?: string
    /** A filter or search is active: "Tiada data dijumpai" instead of "Tiada data". */
    filtered?: boolean
    /** Total rows when paging on the server; defaults to `data.length` (client paging). */
    total?: number
    /** Rows-per-page choices; shows a "{n} / halaman" select beside the pager summary. */
    pageSizeOptions?: number[]
    /** Card title key (< md). */
    cardTitle?: string
    /** Label/value pairs on a card (< md). */
    cardFields?: CardField[]
    /** Options of the "Isih" select (< md). */
    sortItems?: { label: string; value: string }[]
    sortLabel?: string
    /** Adds a checkbox column (and card checkbox); v-model:selection holds the chosen rows. */
    selectable?: boolean
    /** Tighter horizontal cell padding (px-2) for wide tables with many columns. */
    compactCells?: boolean
  }>(),
  {
    caption: undefined,
    rowKey: undefined,
    variant: 'card',
    layout: 'auto',
    density: 'cozy',
    stickyHeader: false,
    stickyFirstColumn: undefined,
    loading: false,
    error: undefined,
    retryLabel: dsCopy.retry,
    emptyTitle: undefined,
    emptyDescription: undefined,
    filtered: false,
    total: undefined,
    pageSizeOptions: () => [],
    cardTitle: undefined,
    cardFields: () => [],
    sortItems: () => [],
    sortLabel: dsCopy.sort,
    selectable: false,
    compactCells: false,
  },
)

const page = defineModel<number>('page', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })
const sort = defineModel<string | undefined>('sort', { default: undefined })
const selection = defineModel<T[]>('selection', { default: () => [] })
const emit = defineEmits<{ retry: []; 'row-click': [row: T] }>()

const wide = useMedia('(min-width: 768px)')

const kind = computed(() => props.variant)
const fixed = computed(() => props.layout === 'fixed')
const bare = computed(() => kind.value === 'bare')
const flush = computed(() => kind.value === 'flush')
const tight = computed(() => props.density === 'tight')
const title = computed(() => props.emptyTitle)

const count = computed(() => props.total ?? props.data.length)
const rows = computed(() =>
  props.total === undefined
    ? props.data.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
    : props.data,
)
const from = computed(() => (count.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const to = computed(() => Math.min(page.value * pageSize.value, count.value))
const summary = computed(() =>
  count.value === 0
    ? dsCopy.pagerSummaryEmpty
    : fillCopy(dsCopy.pagerSummary, { from: from.value, to: to.value, total: count.value }),
)

watch([() => props.data, pageSize], () => {
  if (props.total !== undefined) return
  const last = Math.max(1, Math.ceil(count.value / pageSize.value))
  if (page.value > last) page.value = last
})

// `UTable` column meta takes per-cell classes under the key `class`; the key is computed so the
// class linter does not read it as a class list (the values are token-free layout utilities).
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const stickyFirst = { th: 'sticky left-0 bg-default', td: 'sticky left-0 bg-inherit' }
const SELECT_COL = { id: 'select', meta: { [META_CLASS]: { th: 'w-12', td: 'w-12' } } }
const cols = computed<TableColumn<T>[]>(() => {
  const first = props.stickyFirstColumn ?? kind.value === 'card'
  const body = props.columns.map((c, i) =>
    i === 0 && first ? { ...c, meta: { ...c.meta, [META_CLASS]: stickyFirst } } : c,
  )
  return props.selectable ? [SELECT_COL, ...body] : body
})

const tableUi = computed(() => {
  const sticky = flush.value || bare.value || props.stickyHeader
  const th = [
    'text-th whitespace-nowrap text-muted',
    props.compactCells ? 'px-3 py-3' : tight.value ? 'px-3 py-2.5' : 'px-4 py-3',
    sticky ? `sticky top-0 z-10 ${bare.value ? 'bg-elevated' : 'bg-default shadow-bar'}` : '',
  ].join(' ')
  return {
    root: flush.value ? 'max-w-full overflow-visible rounded-none shadow-none' : 'max-w-full',
    base: fixed.value ? 'table-fixed w-full' : bare.value ? 'min-w-full' : 'w-full',
    thead: bare.value ? 'bg-elevated' : 'bg-default',
    th,
    td: [
      'tabular align-middle text-body font-normal',
      props.compactCells ? 'px-3 py-3' : tight.value ? 'px-3 py-2.5' : 'px-4 py-3',
      fixed.value ? 'whitespace-normal' : '',
    ].join(' '),
    tr: bare.value
      ? 'hover:bg-elevated data-[selected=true]:bg-primary/10'
      : 'even:bg-soft hover:bg-elevated data-[selected=true]:bg-primary/10',
    separator: 'hidden',
  }
})

const pageSizeItems = computed(() =>
  props.pageSizeOptions.map((n) => ({ label: fillCopy(dsCopy.pageSize, { n }), value: n })),
)
const showPager = computed(() => {
  if (props.pageSizeOptions.length === 0) return count.value > pageSize.value
  return bare.value ? count.value > Math.min(...props.pageSizeOptions) : count.value > 0
})
const showPagination = computed(() => !bare.value || count.value > pageSize.value)

// Reserved slots are ours; every other slot is a `UTable` slot (`<id>-cell`, `<id>-header`).
const OWN_SLOTS = new Set(['empty', 'card', 'card-actions', 'toolbar'])

// Selection. `UTable` keeps a row-index keyed record; the model holds the row objects, so a
// selection survives paging.
function same(a: T, b: T): boolean {
  return props.rowKey ? a[props.rowKey] === b[props.rowKey] : a === b
}
const isSelected = (row: T): boolean => selection.value.some((s) => same(s, row))
const rowSelection = computed<Record<string, boolean>>({
  get: () =>
    Object.fromEntries(
      rows.value.map((r, i) => [String(i), isSelected(r)] as const).filter(([, v]) => v),
    ),
  set: (v) => {
    const kept = selection.value.filter((s) => !rows.value.some((r) => same(r, s)))
    selection.value = [...kept, ...rows.value.filter((_, i) => v[String(i)])]
  },
})
function toggle(row: T, on: boolean): void {
  selection.value = on
    ? [...selection.value, row]
    : selection.value.filter((s) => !same(s, row))
}

function cell(row: T, key: string): string {
  const v = row[key]
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
}
</script>

<template>
  <component
    :is="bare ? 'div' : UCard"
    v-bind="bare ? {} : { ui: flush ? { root: 'overflow-clip', body: 'p-0 sm:p-0' } : {} }"
    :class="bare ? 'flex min-w-0 flex-col gap-4' : ''"
    data-ds="data-table"
    :data-variant="kind"
  >
    <slot name="toolbar" />
    <UAlert
      v-if="error"
      :class="flush ? 'm-4' : ''"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      :title="error"
      :actions="[
        { label: retryLabel, color: 'neutral', variant: 'soft', onClick: () => emit('retry') },
      ]"
      role="alert"
    />
    <template v-else>
      <div v-if="loading && !wide" class="flex flex-col gap-3" data-ds="data-table-loading">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>
      <div v-else-if="!wide" :class="flush ? 'p-3' : ''">
        <USelect
          v-if="sortItems.length"
          v-model="sort"
          :items="sortItems"
          :placeholder="sortLabel"
          :aria-label="sortLabel"
          class="mb-3 w-full"
          data-ds="data-table-sort"
        />
        <div v-if="!rows.length" class="py-4">
          <slot name="empty">
            <DsEmptyState
              size="sm"
              :title="title"
              :description="emptyDescription"
              :filtered="filtered"
            />
          </slot>
        </div>
        <ul v-else class="flex flex-col gap-2" data-ds="data-table-cards">
          <li
            v-for="(row, i) in rows"
            :key="i"
            class="flex min-h-16 min-w-0 items-center gap-3 bg-soft p-3"
            :class="bare ? 'rounded-card' : 'rounded-chip'"
          >
            <UCheckbox
              v-if="selectable"
              :model-value="isSelected(row)"
              :aria-label="dsCopy.selectRow"
              @update:model-value="(v: boolean | 'indeterminate') => toggle(row, v === true)"
            />
            <div class="flex min-w-0 grow flex-col gap-1">
              <slot name="card" :row="row">
                <UButton
                  v-if="cardTitle"
                  type="button"
                  color="neutral"
                  variant="link"
                  class="h-auto justify-start p-0 text-start text-label whitespace-normal"
                  :label="cell(row, cardTitle)"
                  @click="emit('row-click', row)"
                />
                <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div v-for="f in cardFields" :key="f.key" class="min-w-0">
                    <dt class="text-caption text-muted">{{ f.label }}</dt>
                    <dd class="tabular truncate text-body">{{ cell(row, f.key) }}</dd>
                  </div>
                </dl>
              </slot>
            </div>
            <slot name="card-actions" :row="row" />
          </li>
        </ul>
      </div>
      <div v-else :class="fixed ? 'max-w-full' : 'max-w-full overflow-x-auto'">
        <UTable
          v-model:row-selection="rowSelection"
          :sticky="bare"
          :data="rows"
          :columns="cols"
          :loading="loading"
          :caption="caption"
          :ui="tableUi"
          :class="bare ? 'max-h-dvh rounded-card bg-soft' : ''"
          @select="(_e: Event, row: { original: T }) => emit('row-click', row.original)"
        >
          <template
            v-for="name in Object.keys($slots).filter((n) => !OWN_SLOTS.has(n))"
            :key="name"
            #[name]="slotProps"
          >
            <slot :name="name" v-bind="slotProps ?? {}" />
          </template>
          <template #empty>
            <slot name="empty">
              <DsEmptyState
                size="sm"
                :title="title"
                :description="emptyDescription"
                :filtered="filtered"
              />
            </slot>
          </template>
          <template v-if="selectable" #select-header="{ table }">
            <UCheckbox
              :model-value="
                table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected()
              "
              :aria-label="dsCopy.selectAll"
              @update:model-value="(v: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(v === true)"
            />
          </template>
          <template v-if="selectable" #select-cell="{ row }">
            <UCheckbox
              :model-value="row.getIsSelected()"
              :aria-label="dsCopy.selectRow"
              @update:model-value="(v: boolean | 'indeterminate') => row.toggleSelected(v === true)"
            />
          </template>
        </UTable>
      </div>
      <div
        v-if="showPager"
        class="flex flex-wrap items-center justify-between gap-3"
        :class="flush ? 'bg-default p-4' : bare ? '' : 'mt-3'"
        data-ds="data-table-pager"
      >
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-label text-muted" role="status">{{ summary }}</p>
          <USelect
            v-if="pageSizeOptions.length"
            v-model="pageSize"
            :items="pageSizeItems"
            value-key="value"
            class="w-40"
            :aria-label="dsCopy.pageSizeAria"
            data-ds="data-table-page-size"
          />
        </div>
        <UPagination
          v-if="showPagination"
          v-model:page="page"
          :total="count"
          :items-per-page="pageSize"
          :prev="{ 'aria-label': dsCopy.pagePrev }"
          :next="{ 'aria-label': dsCopy.pageNext }"
        />
      </div>
    </template>
  </component>
</template>
