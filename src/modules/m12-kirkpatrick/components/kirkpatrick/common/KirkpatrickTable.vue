<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * The report table of the Kirkpatrick screens: `DsPagedTable` (sticky header, roomy rows, page-size
 * selector, `UPagination`) in a raised card; below `md` each row is a card (title plus label/value
 * pairs). Same props as the former `DsDataTable` usage; every `UTable` cell slot is forwarded.
 */
import type { TableColumn } from '@nuxt/ui'
import { ref } from 'vue'

import { DsPagedTable } from '@/ds'

const props = defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  caption?: string
  emptyLabel?: string
  /** Card title key (< md). */
  cardTitle?: string
  /** Label/value pairs on a card (< md). */
  cardFields?: { key: string; label: string }[]
  /** First page size (default 20). */
  pageSize?: number
}>()

const size = ref(props.pageSize ?? 20)

function cell(row: T, key: string): string {
  const v = row[key]
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
}
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-4' }" data-ds="data-table">
    <DsPagedTable
      v-model:page-size="size"
      :data="data"
      :columns="columns"
      :caption="caption"
      :empty-label="emptyLabel"
    >
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 flex-col gap-3">
          <p v-if="cardTitle" class="line-clamp-2 text-label text-highlighted">
            {{ cell(row as T, cardTitle) }}
          </p>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-body">
            <div v-for="f in cardFields" :key="f.key" class="min-w-0">
              <dt class="text-muted">{{ f.label }}</dt>
              <dd class="tabular line-clamp-2 text-default">{{ cell(row as T, f.key) }}</dd>
            </div>
          </dl>
        </div>
      </template>
    </DsPagedTable>
  </UCard>
</template>
