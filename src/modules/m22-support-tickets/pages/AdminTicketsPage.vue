<script setup lang="ts">
/**
 * S2 `/admin/tiket` "Tiket Sokongan" (SRS M22 v1.1 FR-M22-28…38), v2 staff theme. Admin shell, platform
 * admin only, read-only (D27): status chips (links, with the counts) and a table, no row link or action.
 * Dates are shown in Asia/Kuala_Lumpur (DV-M22-09). Counts and the total cover all tickets, the table at
 * most 200 rows. The markup keeps the server's no-ARIA rule (CHK-M22-02).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  type PillItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDateTimeRaw } from '@/lib/time'

import { fetchQueue } from '../api/tickets'
import type { QueueRow } from '../api/types'

const route = useRoute()

/** BR-M22-08: any non-empty `status` filters by exact equality. */
const status = computed(() => {
  const q = route.query.status
  const first = Array.isArray(q) ? q[0] : q
  return first ?? ''
})

const { data, error, loading, reload } = useApi(
  (signal) => fetchQueue({ status: status.value, signal }),
  () => route.query.status,
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? [])
const total = computed(() => data.value?.meta.total ?? 0)

type TicketRow = QueueRow & Record<string, unknown>
const tableRows = computed(() => rows.value as TicketRow[])
const COLUMNS: TableColumn<TicketRow>[] = [
  { id: 'date', header: 'Tarikh' },
  { id: 'user', header: 'Pengguna' },
  { accessorKey: 'subject', header: 'Subjek' },
  { id: 'status', header: 'Status' },
  { id: 'replied', header: 'Dibalas' },
]
/** Status chips (links with the counts); the filter lives in the URL. */
const chipItems = computed<PillItem<string>[]>(() => [
  { key: '', label: `Semua (${formatNumber(total.value)})`, to: '/admin/tiket', testid: 'all' },
  ...counts.value.map((c) => ({
    key: c.status,
    label: `${c.status} (${formatNumber(c.count)})`,
    to: `/admin/tiket?status=${encodeURIComponent(c.status)}`,
  })),
])
</script>

<template>
  <DsPage
    title="Tiket Sokongan"
    subtitle="Permohonan bantuan daripada pengguna."
    data-testid="tq-page"
  >
    <template v-if="data">
      <div data-testid="tq-chips">
        <DsPillNav
          :items="chipItems"
          :active="status"
          label="Status tiket"
          testid-prefix="tq-chip"
        />
      </div>

      <DsPanel v-if="tableRows.length === 0" padding="none">
        <DsEmptyState
          size="sm"
          icon="lifebuoy"
          :title="
            status === '' ? 'Belum ada tiket sokongan.' : `Tiada tiket berstatus “${status}”.`
          "
          data-testid="tq-empty"
        />
      </DsPanel>
      <DsDataTable
        v-else
        :data="tableRows"
        :columns="COLUMNS"
        variant="flush"
        caption="Senarai tiket sokongan"
        :page-size="Math.max(tableRows.length, 1)"
        card-title="subject"
        data-testid="tq-table"
      >
        <template #date-cell="{ row }">
          <span class="text-nowrap text-muted" data-testid="tq-row">{{
            formatDateTimeRaw(row.original.createdAt)
          }}</span>
        </template>
        <template #user-cell="{ row }">
          <span class="text-highlighted">{{ row.original.userName ?? '—' }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge color="neutral" variant="subtle" :label="row.original.status" />
        </template>
        <template #replied-cell="{ row }">{{ row.original.replied ? 'Ya' : '—' }}</template>
        <template #card="{ row }">
          <p class="text-body text-highlighted" data-testid="tq-row">{{ row.subject }}</p>
          <p class="text-label text-muted">
            {{ row.userName ?? '—' }} · {{ formatDateTimeRaw(row.createdAt as string) }}
          </p>
          <UBadge class="w-fit" color="neutral" variant="subtle" :label="row.status as string" />
        </template>
      </DsDataTable>
    </template>
    <DsLoadError v-else-if="error" :message="error.message" testid="tq-error" @retry="reload" />
    <div v-else-if="loading" class="flex flex-col gap-3" data-testid="tq-loading">
      <USkeleton v-for="n in 5" :key="n" class="h-14 w-full" />
    </div>
  </DsPage>
</template>
