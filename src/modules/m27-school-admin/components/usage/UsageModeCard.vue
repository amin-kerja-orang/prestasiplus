<script setup lang="ts">
/**
 * S1 card "Mengikut Mod Latihan" (FR-M27-54; restyle spec AS-46): a `DsChart` bar of the sessions per mode
 * and, under it, one row per session label with sessions in the window (server order): "Mod", "Sesi",
 * "Ketepatan Purata". With no completed session the empty card replaces it (FR-M27-55): "Tiada data untuk
 * tempoh ini" and the period sentence; for `today` the sentence links "7 Hari" and "30 Hari" to
 * `?period=7days` and `?period=30days`.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsChart, DsDataTable, DsPanel, type CardField } from '@/ds'

import type { SchoolUsage } from '../../api/school-admin'
import { accuracy, count, USAGE_PATH } from './usage-format'

const props = defineProps<{
  modes: SchoolUsage['modes']
  period: SchoolUsage['period']
  label: string
}>()

interface Row extends Record<string, unknown> {
  label: string
  sessions: string
  accuracy: string
}
const rows = computed<Row[]>(() =>
  props.modes.map((m) => ({
    label: m.label,
    sessions: count(m.sessions),
    accuracy: accuracy(m.accuracy),
  })),
)
const columns: TableColumn<Row>[] = [
  { id: 'label', accessorKey: 'label', header: 'Mod' },
  { id: 'sessions', accessorKey: 'sessions', header: 'Sesi' },
  { id: 'accuracy', accessorKey: 'accuracy', header: 'Ketepatan Purata' },
]

const cardFields: CardField[] = [
  { key: 'sessions', label: 'Sesi' },
  { key: 'accuracy', label: 'Ketepatan Purata' },
]

const labels = computed(() => props.modes.map((m) => m.label))
const series = computed(() => [{ label: 'Sesi', data: props.modes.map((m) => m.sessions) }])
</script>

<template>
  <DsPanel v-if="modes.length > 0" data-testid="su-modes">
    <div class="flex flex-col gap-4">
      <h2 class="text-subheading text-highlighted" data-testid="su-modes-title">
        Mengikut Mod Latihan
      </h2>
      <DsChart
        type="bar"
        title="Sesi mengikut mod"
        table-label="Sesi mengikut mod latihan"
        :labels="labels"
        :series="series"
      />
      <div class="max-w-full" data-testid="su-modes-scroll">
        <DsDataTable
          :data="rows"
          :columns="columns"
          variant="bare"
          caption="Sesi dan ketepatan mengikut mod latihan"
          card-title="label"
          :card-fields="cardFields"
          :page-size="Math.max(1, rows.length)"
          data-testid="su-modes-table"
        >
          <template #label-cell="{ row }">
            <span class="text-label text-highlighted" data-testid="su-mode-label">{{
              row.original.label
            }}</span>
          </template>
          <template #sessions-cell="{ row }">
            <span data-testid="su-mode-sessions">{{ row.original.sessions }}</span>
          </template>
          <template #accuracy-cell="{ row }">
            <span data-testid="su-mode-accuracy">{{ row.original.accuracy }}</span>
          </template>
        </DsDataTable>
      </div>
    </div>
  </DsPanel>

  <DsPanel v-else data-testid="su-empty">
    <div class="flex flex-col items-center gap-2 py-6 text-center">
      <UIcon name="i-ph-chart-bar" class="size-8 text-dimmed" aria-hidden="true" />
      <p class="text-subheading text-highlighted" data-testid="su-empty-title">
        Tiada data untuk tempoh ini
      </p>
      <p v-if="period === 'today'" class="text-body text-muted" data-testid="su-empty-text">
        Belum ada pelajar buat latihan hari ini. Cuba lihat
        <RouterLink
          :to="{ path: USAGE_PATH, query: { period: '7days' } }"
          class="inline-flex min-h-11 items-center text-label text-primary-t"
          data-testid="su-empty-7days"
          >7 Hari</RouterLink
        >
        atau
        <RouterLink
          :to="{ path: USAGE_PATH, query: { period: '30days' } }"
          class="inline-flex min-h-11 items-center text-label text-primary-t"
          data-testid="su-empty-30days"
          >30 Hari</RouterLink
        >.
      </p>
      <p v-else class="text-body text-muted" data-testid="su-empty-text">
        Tiada aktiviti latihan dalam tempoh {{ label }} yang lepas.
      </p>
    </div>
  </DsPanel>
</template>
