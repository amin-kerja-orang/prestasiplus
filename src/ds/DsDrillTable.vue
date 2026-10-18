<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Drill-down table for Pemantauan (sekolah > guru > kelas > murid): a thin `UTable` wrapper that
 * scrolls inside its own container. The keyboard path to drill down is a link / button the caller
 * puts in a cell slot (all `UTable` slots are forwarded); `drill` also fires on row click.
 */
import type { TableColumn } from '@nuxt/ui'

import DsLoadError from './DsLoadError.vue'

defineProps<{
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
}>()

const emit = defineEmits<{ drill: [row: T]; retry: [] }>()
</script>

<template>
  <div class="max-w-full overflow-x-auto" :aria-busy="loading ? 'true' : undefined" data-ds="drill-table">
    <DsLoadError v-if="error" :message="errorMessage" variant="inline" @retry="emit('retry')" />
    <UTable
      v-else
      :data="data"
      :columns="columns"
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
