<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Staff flat table (restyle spec 1.4): `UCard` + `UTable` + `UPagination`. Zebra rows, no lines,
 * tabular numbers, sticky first column, BM pager copy. Below `md` the rows render as a card list
 * (title, 2-3 label/value pairs, row actions) with a "Isih" select instead of header sorting.
 * Pagination is client-side unless `total` is given (server paging: the caller slices `data`).
 */
import { computed } from 'vue'
import type { TableColumn } from '@nuxt/ui'

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
    loading?: boolean
    /** Error text (BM); shows an alert with a retry button. */
    error?: string
    emptyLabel?: string
    /** Total rows when paging on the server; defaults to `data.length` (client paging). */
    total?: number
    pageSize?: number
    /** Card title key (< md). */
    cardTitle?: string
    /** Label/value pairs on a card (< md). */
    cardFields?: CardField[]
    /** Options of the "Isih" select (< md). */
    sortItems?: { label: string; value: string }[]
    sortLabel?: string
    retryLabel?: string
    /** Admin list mode: flush card, sticky header, no sticky first column, always-on pager. */
    dense?: boolean
    /** With `dense`: `table-fixed` full width (the caller sets column widths); otherwise the table scrolls sideways in its card when wider. */
    fixedLayout?: boolean
    /** Rows-per-page choices; shows a "halaman" select beside the pager summary. */
    pageSizeOptions?: number[]
  }>(),
  {
    caption: undefined,
    loading: false,
    error: undefined,
    emptyLabel: 'Tiada data',
    total: undefined,
    pageSize: 10,
    cardTitle: undefined,
    cardFields: () => [],
    sortItems: () => [],
    sortLabel: 'Isih',
    retryLabel: 'Cuba Lagi',
    dense: false,
    fixedLayout: false,
    pageSizeOptions: () => [],
  },
)

const page = defineModel<number>('page', { default: 1 })
const sort = defineModel<string | undefined>('sort', { default: undefined })
const emit = defineEmits<{
  retry: []
  'row-click': [row: T]
  'update:pageSize': [size: number]
}>()

const wide = useMedia('(min-width: 768px)')

const count = computed(() => props.total ?? props.data.length)
const rows = computed(() =>
  props.total === undefined
    ? props.data.slice((page.value - 1) * props.pageSize, page.value * props.pageSize)
    : props.data,
)
const from = computed(() => (count.value === 0 ? 0 : (page.value - 1) * props.pageSize + 1))
const to = computed(() => Math.min(page.value * props.pageSize, count.value))
const summary = computed(
  () => `Menunjukkan ${from.value}-${to.value} daripada ${count.value} hasil`,
)

// `UTable` column meta takes per-cell classes under the key `class`; the key is computed so the
// class linter does not read it as a class list (the values are token-free layout utilities).
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const stickyFirst = { th: 'sticky left-0 bg-default', td: 'sticky left-0 bg-inherit' }
const cols = computed<TableColumn<T>[]>(() =>
  props.columns.map((c, i) =>
    i === 0 && !props.dense ? { ...c, meta: { ...c.meta, [META_CLASS]: stickyFirst } } : c,
  ),
)

const tableUi = computed(() =>
  props.dense
    ? {
        root: 'max-w-full overflow-visible rounded-none shadow-none',
        base: props.fixedLayout ? 'table-fixed w-full' : 'w-full',
        thead: 'bg-default',
        th: 'sticky top-0 z-10 bg-default px-4 py-3.5 text-overline whitespace-nowrap text-muted shadow-bar',
        td: 'tabular px-4 py-3.5 align-middle text-body font-normal whitespace-normal',
        tr: 'even:bg-soft hover:bg-elevated data-[selected=true]:bg-primary/10',
      }
    : {
        root: 'max-w-full',
        th: 'text-overline text-muted',
        td: 'tabular min-h-11',
        tr: 'even:bg-soft hover:bg-elevated',
      },
)
const pageSizeItems = computed(() =>
  props.pageSizeOptions.map((n) => ({ label: `${String(n)} / halaman`, value: n })),
)
const showPager = computed(() =>
  props.pageSizeOptions.length > 0 ? count.value > 0 : count.value > props.pageSize,
)

function cell(row: T, key: string): string {
  const v = row[key]
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
}
</script>

<template>
  <UCard
    data-ds="data-table"
    :ui="dense ? { root: 'overflow-clip', body: 'p-0 sm:p-0' } : {}"
  >
    <UAlert
v-if="error"
      :class="dense ? 'm-4' : ''"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      :title="error"
      :actions="[{ label: retryLabel, color: 'neutral', variant: 'soft', onClick: () => emit('retry') }]"
      role="alert"
    />
    <template v-else>
      <div v-if="loading && !wide" class="flex flex-col gap-3" data-ds="data-table-loading">
        <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
      </div>
      <div v-else-if="!wide" :class="dense ? 'p-3' : ''">
        <USelect
          v-if="sortItems.length"
          v-model="sort"
          :items="sortItems"
          :placeholder="sortLabel"
          :aria-label="sortLabel"
          class="mb-3 w-full"
          data-ds="data-table-sort"
        />
        <p v-if="!rows.length" class="py-4 text-center text-body text-muted">
          <slot name="empty">{{ emptyLabel }}</slot>
        </p>
        <ul v-else class="flex flex-col gap-2" data-ds="data-table-cards">
          <li
            v-for="(row, i) in rows"
            :key="i"
            class="flex min-h-16 items-center gap-3 rounded-card bg-soft p-3"
          >
            <div class="flex min-w-0 grow flex-col gap-1">
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
            </div>
            <slot name="card-actions" :row="row" />
          </li>
        </ul>
      </div>
      <div v-else :class="dense && fixedLayout ? 'max-w-full' : 'max-w-full overflow-x-auto'">
        <UTable
          :data="rows"
          :columns="cols"
          :loading="loading"
          :empty="emptyLabel"
          :caption="caption"
          :ui="tableUi"
          @select="(_e: Event, row: { original: T }) => emit('row-click', row.original)"
        >
          <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps ?? {}" />
          </template>
        </UTable>
      </div>
      <div
        v-if="showPager"
        class="flex flex-wrap items-center justify-between gap-3"
        :class="dense ? 'bg-default p-4' : 'mt-3'"
        data-ds="data-table-pager"
      >
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-label text-muted" role="status">{{ summary }}</p>
          <USelect
            v-if="pageSizeOptions.length"
            :model-value="pageSize"
            :items="pageSizeItems"
            class="w-40"
            aria-label="Baris setiap halaman"
            data-ds="data-table-page-size"
            @update:model-value="(v: number) => emit('update:pageSize', v)"
          />
        </div>
        <UPagination
          v-model:page="page"
          :total="count"
          :items-per-page="pageSize"
          :prev="{ 'aria-label': 'Sebelum' }"
          :next="{ 'aria-label': 'Seterusnya' }"
        />
      </div>
    </template>
  </UCard>
</template>
