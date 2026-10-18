<script setup lang="ts">
/**
 * S2 `/admin/tiket` "Tiket Sokongan" (SRS M22 v1.1 FR-M22-28…38), v2 staff theme. Admin shell, platform
 * admin only, read-only (D27): status chips (links, with the counts) and a table, no row link or action.
 * Dates are shown in Asia/Kuala_Lumpur (DV-M22-09). Counts and the total cover all tickets, the table at
 * most 200 rows. The markup keeps the server's no-ARIA rule (CHK-M22-02).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { AdminCard, AdminPageHeader } from '@/ds/admin'
import { useApi } from '@/composables'
import { DsPage } from '@/ds'
import { formatNumber } from '@/lib/number'
import { formatDateTimeRaw } from '@/lib/time'

import { fetchQueue } from '../api/tickets'
import AdminCell from '../components/native/AdminCell.vue'
import AdminRow from '../components/native/AdminRow.vue'
import AdminTable from '../components/native/AdminTable.vue'

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

const COLUMNS = [
  { key: 'date', label: 'Tarikh' },
  { key: 'user', label: 'Pengguna' },
  { key: 'subject', label: 'Subjek' },
  { key: 'status', label: 'Status' },
  { key: 'replied', label: 'Dibalas' },
]
</script>

<template>
  <DsPage data-testid="tq-page">
    <AdminPageHeader title="Tiket Sokongan" subtitle="Permohonan bantuan daripada pengguna." />

    <template v-if="data">
      <AdminCard
        as="nav"
        flush
        class="flex flex-wrap items-center gap-3 p-4"
        data-testid="tq-chips"
      >
        <UButton
          to="/admin/tiket"
          :color="status === '' ? 'primary' : 'neutral'"
          :variant="status === '' ? 'solid' : 'soft'"
          :data-active="status === ''"
          :label="`Semua (${formatNumber(total)})`"
        />
        <UButton
          v-for="c in counts"
          :key="c.status"
          :to="`/admin/tiket?status=${encodeURIComponent(c.status)}`"
          :color="status === c.status ? 'primary' : 'neutral'"
          :variant="status === c.status ? 'solid' : 'soft'"
          :data-active="status === c.status"
          :label="`${c.status} (${formatNumber(c.count)})`"
        />
      </AdminCard>

      <AdminCard
        v-if="rows.length === 0"
        as="div"
        flush
        class="flex flex-col items-center gap-3 p-12 text-center text-body text-muted"
      >
        <UIcon name="i-ph-lifebuoy" class="size-10" />
        <p data-testid="tq-empty">
          {{ status === '' ? 'Belum ada tiket sokongan.' : `Tiada tiket berstatus “${status}”.` }}
        </p>
      </AdminCard>
      <AdminTable v-else :columns="COLUMNS" caption="Senarai tiket sokongan" data-testid="tq-table">
        <AdminRow v-for="r in rows" :key="r.id" data-testid="tq-row">
          <AdminCell label="Tarikh">
            <span class="text-nowrap text-muted">{{ formatDateTimeRaw(r.createdAt) }}</span>
          </AdminCell>
          <AdminCell label="Pengguna">
            <span class="text-highlighted">{{ r.userName ?? '—' }}</span>
          </AdminCell>
          <AdminCell label="Subjek">{{ r.subject }}</AdminCell>
          <AdminCell label="Status">
            <UBadge color="neutral" variant="subtle" :label="r.status" />
          </AdminCell>
          <AdminCell label="Dibalas">{{ r.replied ? 'Ya' : '—' }}</AdminCell>
        </AdminRow>
      </AdminTable>
    </template>
    <div v-else-if="error" class="flex flex-col gap-4" data-testid="tq-error">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :description="error.message"
      />
      <div>
        <UButton label="Cuba lagi" data-testid="tq-retry" @click="reload" />
      </div>
    </div>
    <div v-else-if="loading" class="flex flex-col gap-3" data-testid="tq-loading">
      <USkeleton v-for="n in 5" :key="n" class="h-14 w-full" />
    </div>
  </DsPage>
</template>
