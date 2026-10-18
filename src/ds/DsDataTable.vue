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
    /** Tighter cell padding (wide admin tables with many columns). */
    dense?: boolean
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
  },
)

const page = defineModel<number>('page', { default: 1 })
const sort = defineModel<string | undefined>('sort', { default: undefined })
const emit = defineEmits<{ retry: []; 'row-click': [row: T] }>()

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
    i === 0 ? { ...c, meta: { ...c.meta, [META_CLASS]: stickyFirst } } : c,
  ),
)

const tableUi = computed(() => ({
  root: 'max-w-full',
  th: props.dense ? 'text-overline text-muted px-2' : 'text-overline text-muted',
  td: props.dense ? 'tabular min-h-11 px-2' : 'tabular min-h-11',
  tr: 'even:bg-soft hover:bg-elevated',
}))

function cell(row: T, key: string): string {
  const v = row[key]
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
}
</script>

<template>
  <UCard data-ds="data-table">
    <UAlert
      v-if="error"
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
      <template v-else-if="!wide">
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
                class="justify-start truncate p-0 text-label"
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
      </template>
      <div v-else class="max-w-full overflow-x-auto">
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
        v-if="count > pageSize"
        class="mt-3 flex flex-wrap items-center justify-between gap-3"
        data-ds="data-table-pager"
      >
        <p class="text-caption text-muted" role="status">{{ summary }}</p>
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
