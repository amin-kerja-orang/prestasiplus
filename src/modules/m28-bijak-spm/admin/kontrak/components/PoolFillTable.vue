<script setup lang="ts">
/**
 * One quota-fill table of the pool preview (design 5.3): Perlu, Ada, Status ("Cukup" / "Kurang n",
 * icon plus word) and "Lihat soalan". A short row also leads with a warning icon so the row scans
 * in grayscale and dark mode. Below `md` DsDataTable renders it as cards.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDataTable } from '@/ds'

import { bankHref, type PoolLine } from '../domain/pool'

type Row = PoolLine & Record<string, unknown>

const props = defineProps<{ title: string; nameHeader: string; lines: PoolLine[] }>()

const rows = computed(() => props.lines as Row[])
const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'name', header: props.nameHeader },
  { accessorKey: 'perlu', header: 'Perlu' },
  { accessorKey: 'ada', header: 'Ada' },
  { accessorKey: 'short', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
])
</script>

<template>
  <section class="min-w-0" :aria-label="title">
    <h4 class="mb-2 text-label text-highlighted">{{ title }}</h4>
    <DsDataTable
      :data="rows"
      :columns="columns"
      :caption="title"
      variant="bare"
      density="tight"
      :page-size="100"
      card-title="name"
      :card-fields="[
        { key: 'perlu', label: 'Perlu' },
        { key: 'ada', label: 'Ada' },
      ]"
      row-key="key"
    >
      <template #name-cell="{ row }">
        <span class="flex items-start gap-1 break-words">
          <UIcon
            v-if="row.original.short > 0"
            name="i-ph-warning-circle"
            class="mt-0.5 size-4 shrink-0 text-error"
            aria-hidden="true"
          />
          <span>{{ row.original.name }}</span>
        </span>
      </template>
      <template #perlu-cell="{ row }"><span class="tabular">{{ row.original.perlu }}</span></template>
      <template #ada-cell="{ row }"><span class="tabular">{{ row.original.ada }}</span></template>
      <template #short-cell="{ row }">
        <UBadge
          :color="row.original.short > 0 ? 'error' : 'success'"
          variant="subtle"
          :icon="row.original.short > 0 ? 'i-ph-warning-circle' : 'i-ph-check-circle'"
          :label="row.original.short > 0 ? `Kurang ${row.original.short}` : 'Cukup'"
        />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          v-if="row.original.short > 0"
          color="neutral"
          variant="ghost"
          size="sm"
          class="min-h-11 min-w-11"
          icon="i-ph-list-magnifying-glass"
          :aria-label="`Lihat soalan ${row.original.name}`"
          :href="bankHref(row.original.query)"
          target="_blank"
          rel="noopener"
        />
      </template>
      <template #card-actions="{ row }">
        <div class="flex flex-col items-stretch gap-2">
          <UBadge
            :color="Number(row.short) > 0 ? 'error' : 'success'"
            variant="subtle"
            :icon="Number(row.short) > 0 ? 'i-ph-warning-circle' : 'i-ph-check-circle'"
            :label="Number(row.short) > 0 ? `Kurang ${row.short}` : 'Cukup'"
          />
          <UButton
            v-if="Number(row.short) > 0"
            color="neutral"
            variant="soft"
            size="sm"
            class="min-h-11"
            label="Lihat soalan"
            :href="bankHref(row.query as Record<string, string>)"
            target="_blank"
            rel="noopener"
          />
        </div>
      </template>
    </DsDataTable>
  </section>
</template>
