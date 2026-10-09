<script setup lang="ts">
/**
 * S2 `/admin/tiket` "Tiket Sokongan" (SRS M22 v1.1 FR-M22-28…38). Admin shell, platform admin only, read-only
 * (D27): status chips and a table, no row link or action. Markup follows `admin/tiket.blade.php`. Dates are
 * shown in Asia/Kuala_Lumpur (DV-M22-09). Counts and the total cover all tickets, the table at most 200 rows.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { useApi } from '@/composables'
import { formatNumber } from '@/lib/number'
import { formatDateTimeRaw } from '@/lib/time'

import { fetchQueue } from '../api/tickets'

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

const chipClass = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
    active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
  }`
</script>

<template>
  <div class="min-w-0" data-testid="tq-page">
    <h1 class="mb-1 text-xl font-bold text-slate-800 sm:text-2xl">Tiket Sokongan</h1>
    <p class="mb-4 text-sm text-slate-500">Permohonan bantuan daripada pengguna.</p>

    <template v-if="data">
      <div class="mb-4 flex flex-wrap gap-2" data-testid="tq-chips">
        <RouterLink to="/admin/tiket" :class="chipClass(status === '')" :data-active="status === ''"
          >Semua ({{ formatNumber(total) }})</RouterLink
        >
        <RouterLink
          v-for="c in counts"
          :key="c.status"
          :to="`/admin/tiket?status=${encodeURIComponent(c.status)}`"
          :class="chipClass(status === c.status)"
          :data-active="status === c.status"
          >{{ c.status }} ({{ formatNumber(c.count) }})</RouterLink
        >
      </div>

      <div
        v-if="rows.length === 0"
        class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500"
        data-testid="tq-empty"
      >
        {{ status === '' ? 'Belum ada tiket sokongan.' : `Tiada tiket berstatus “${status}”.` }}
      </div>
      <DataTableCard v-else :min-width="640">
        <table :class="T.table" data-testid="tq-table">
          <thead class="bg-slate-50">
            <tr>
              <th :class="T.th">Tarikh</th>
              <th :class="T.th">Pengguna</th>
              <th :class="T.th">Subjek</th>
              <th :class="T.th">Status</th>
              <th :class="T.th">Dibalas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" :class="T.row" data-testid="tq-row">
              <td :class="[T.td, 'whitespace-nowrap text-slate-500']">
                {{ formatDateTimeRaw(r.createdAt) }}
              </td>
              <td :class="[T.td, 'font-semibold text-slate-800']">{{ r.userName ?? '—' }}</td>
              <td :class="T.td">{{ r.subject }}</td>
              <td :class="T.td">
                <span
                  class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                  >{{ r.status }}</span
                >
              </td>
              <td :class="T.td">{{ r.replied ? 'Ya' : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>
    </template>
    <div v-else-if="error" class="space-y-3" data-testid="tq-error">
      <AlertBox :messages="error.message" />
      <div class="text-center">
        <button
          type="button"
          class="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="tq-retry"
          @click="reload"
        >
          Cuba lagi
        </button>
      </div>
    </div>
    <p
      v-else-if="loading"
      class="flex justify-center py-10 text-slate-500"
      data-testid="tq-loading"
    >
      <LoadingSpinner class="h-6 w-6" />
    </p>
  </div>
</template>
