<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * @deprecated Use `DsDataTable variant="bare"`. Thin wrapper kept for existing pages until the
 * module migration (consolidation plan T9 deletes it): `pageSizes` maps to `pageSizeOptions`,
 * `dense` to `density="tight"`, and every slot (`<id>-cell`, `<id>-header`, `card`) is forwarded.
 */
import type { TableColumn } from '@nuxt/ui'

import DsDataTable from './DsDataTable.vue'

withDefaults(
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
  { caption: undefined, emptyLabel: undefined, pageSizes: () => [10, 20, 50], dense: false },
)

const page = defineModel<number>('page', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 20 })
defineSlots<{
  card?: (props: { row: T }) => unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable slot props are typed per column id
  [name: string]: ((props: any) => unknown) | undefined
}>()
</script>

<template>
  <DsDataTable
    v-model:page="page"
    v-model:page-size="pageSize"
    variant="bare"
    :density="dense ? 'tight' : 'cozy'"
    :data="data"
    :columns="columns"
    :caption="caption"
    :empty-title="emptyLabel"
    :page-size-options="pageSizes"
    data-ds="paged-table"
  >
    <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </DsDataTable>
</template>
