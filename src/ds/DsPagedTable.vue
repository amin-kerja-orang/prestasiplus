<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Admin report table (Portal Pentadbiran pattern): `UTable` at full width with a sticky header,
 * roomy rows, a page-size selector and `UPagination`. Below `md` the rows render as cards through the
 * `card` slot. Paging is client-side; all `UTable` slots (`<id>-cell`, `<id>-header`) are forwarded.
 * Unlike `DsDataTable` it has no surrounding card, so a page can place it inside a tab panel.
 */
import { computed, watch } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { useMedia } from './useMedia'

const props = withDefaults(
  defineProps<{
    data: T[]
    columns: TableColumn<T>[]
    /** Visually hidden table caption (BM). */
    caption?: string
    emptyLabel?: string
    pageSizes?: number[]
    /** Tighter horizontal cell padding for tables with many columns. */
    dense?: boolean
  }>(),
  {
    caption: undefined,
    emptyLabel: 'Tiada data',
    pageSizes: () => [10, 20, 50],
    dense: false,
  },
)

const page = defineModel<number>('page', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 20 })

const wide = useMedia('(min-width: 768px)')

const count = computed(() => props.data.length)
const rows = computed(() =>
  props.data.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
const from = computed(() => (count.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const to = computed(() => Math.min(page.value * pageSize.value, count.value))
const sizeItems = computed(() => props.pageSizes.map((n) => ({ label: `${n} baris`, value: n })))

watch([() => props.data, pageSize], () => {
  const last = Math.max(1, Math.ceil(count.value / pageSize.value))
  if (page.value > last) page.value = last
})

const tableUi = computed(() => ({
  root: 'max-w-full',
  base: 'min-w-full',
  thead: 'bg-elevated',
  th: props.dense ? 'px-3 py-3 text-overline text-muted' : 'px-4 py-3 text-overline text-muted',
  td: props.dense ? 'px-3 py-4 text-body' : 'px-4 py-4 text-body',
  tr: 'hover:bg-elevated',
  separator: 'hidden',
}))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-ds="paged-table">
    <UTable
      v-if="wide"
      sticky
      :data="rows"
      :columns="columns"
      :caption="caption"
      :empty="emptyLabel"
      :ui="tableUi"
      class="max-h-dvh rounded-card bg-soft"
    >
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </UTable>
    <p
      v-else-if="!rows.length"
      class="py-8 text-center text-body text-muted"
      data-ds="paged-table-empty"
    >
      {{ emptyLabel }}
    </p>
    <ul v-else class="flex flex-col gap-3" data-ds="paged-table-cards">
      <li v-for="(row, i) in rows" :key="i" class="min-w-0 rounded-card bg-soft p-4">
        <slot name="card" :row="row" />
      </li>
    </ul>
    <div
      v-if="count > pageSizes[0]!"
      class="flex flex-wrap items-center justify-between gap-3"
      data-ds="paged-table-pager"
    >
      <div class="flex flex-wrap items-center gap-3">
        <p class="text-body text-muted" role="status">
          Menunjukkan {{ from }}-{{ to }} daripada {{ count }} hasil
        </p>
        <USelect
          v-model="pageSize"
          :items="sizeItems"
          value-key="value"
          size="md"
          class="w-32"
          aria-label="Bilangan baris setiap halaman"
        />
      </div>
      <UPagination
        v-if="count > pageSize"
        v-model:page="page"
        :total="count"
        :items-per-page="pageSize"
        :prev="{ 'aria-label': 'Sebelum' }"
        :next="{ 'aria-label': 'Seterusnya' }"
      />
    </div>
  </div>
</template>
