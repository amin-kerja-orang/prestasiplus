<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Drill-down table for Pemantauan (sekolah > guru > kelas > murid): a thin `UTable` wrapper that
 * scrolls inside its own container. The keyboard path to drill down is a link / button the caller
 * puts in a cell slot (all `UTable` slots are forwarded); `drill` also fires on row click.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import DsLoadError from './DsLoadError.vue'

const props = defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  /** Visually hidden table caption (BM). */
  caption?: string
  loading?: boolean
  /** Failed to load: a retryable error replaces the table. */
  error?: boolean
  errorMessage?: string
  /** Text when `data` is empty (BM). */
  emptyLabel?: string
  /** The first column stays in view while the table scrolls sideways (a wide weekly grid). */
  stickyFirstColumn?: boolean
}>()

const emit = defineEmits<{ drill: [row: T]; retry: [] }>()

// `UTable` column meta takes per-cell classes under the key `class`; the key is computed so the class
// linter does not read it as a class list (same approach as `DsDataTable`).
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const stickyFirst = { th: 'sticky left-0 z-10 bg-default', td: 'sticky left-0 bg-default' }
const cols = computed<TableColumn<T>[]>(() =>
  props.stickyFirstColumn
    ? props.columns.map((c, i) =>
        i === 0 ? { ...c, meta: { ...c.meta, [META_CLASS]: stickyFirst } } : c,
      )
    : props.columns,
)
</script>

<template>
  <div class="max-w-full overflow-x-auto" :aria-busy="loading ? 'true' : undefined" data-ds="drill-table">
    <DsLoadError v-if="error" :message="errorMessage" variant="inline" @retry="emit('retry')" />
    <UTable
      v-else
      :data="data"
      :columns="cols"
      :loading="loading"
      :empty="emptyLabel"
      :caption="caption"
      @select="(_event: Event, row: { original: T }) => emit('drill', row.original)"
    >
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </UTable>
  </div>
</template>
