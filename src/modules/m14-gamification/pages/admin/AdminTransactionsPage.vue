<script setup lang="ts">
/**
 * `/admin/gamification/transactions` "Transaksi Syiling" (V2 `admin/gamification/transactions.blade.php`; M14 S5), read
 * only: the type chips (Semua Jenis, Dapat, Belanja, Tukar, Bonus, Refund; `?type=`) over the coin ledger, newest first,
 * 25 a page, "Baki Selepas" included.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsBadge, DsDataTable, DsPage, DsPillNav, DsStack, DsText, formatCount, type PillItem } from '@/ds'

import { fetchAdminTransactions } from '../../api/admin'
import type { AdminTransactionRow, LedgerType } from '../../api/types'
import { ADMIN_COMMON, TRANSACTIONS_COPY as COPY, TYPE_PILLS } from '../../lib/admin/copy'
import { amountTone, formatDateTime, LEDGER_TONE, signedAmount } from '../../lib/admin/format'

const PAGE_SIZE = 25
const ALL = 'all'

const route = useRoute()
const router = useRouter()

const TYPES = new Set<string>(TYPE_PILLS.map((p) => p.key).filter(Boolean))
/** The applied type from `?type=`; anything else is "Semua Jenis". */
const typeOf = (raw: unknown): LedgerType | '' => {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && TYPES.has(value) ? (value as LedgerType) : ''
}

const type = computed(() => typeOf(route.query.type))
const page = ref(1)
watch(type, () => {
  page.value = 1
})

const list = useApi(
  (signal) => fetchAdminTransactions({ type: type.value, page: page.value, signal }),
  [type, page],
)

type Row = AdminTransactionRow & Record<string, unknown>
const rows = computed(() => (list.data.value?.data ?? []) as Row[])
const total = computed(() => list.data.value?.meta.totalItems ?? 0)

const pills = computed<PillItem<string>[]>(() =>
  TYPE_PILLS.map((p) => ({ key: p.key === '' ? ALL : p.key, label: p.label, testid: p.key === '' ? ALL : p.key })),
)
function select(key: string): void {
  void router.push({ path: '/admin/gamification/transactions', query: key === ALL ? {} : { type: key } })
}

const COLUMNS: TableColumn<Row>[] = [
  { accessorKey: 'id', header: COPY.columns.id },
  { accessorKey: 'name', header: COPY.columns.student },
  { accessorKey: 'type', header: COPY.columns.type },
  { accessorKey: 'amount', header: COPY.columns.amount },
  { accessorKey: 'balanceAfter', header: COPY.columns.balanceAfter },
  { accessorKey: 'source', header: COPY.columns.source },
  { accessorKey: 'description', header: COPY.columns.description },
  { accessorKey: 'createdAt', header: COPY.columns.date },
]
</script>

<template>
  <DsPage layout="list" data-testid="gam-transactions">
    <DsPillNav
      :items="pills"
      :active="type === '' ? ALL : type"
      :label="COPY.pillsLabel"
      wrap
      testid-prefix="gam-transactions-pill"
      @select="select"
    />

    <DsDataTable
      v-model:page="page"
      :data="rows"
      :columns="COLUMNS"
      :caption="COPY.caption"
      variant="flush"
      density="tight"
      :page-size="PAGE_SIZE"
      :total="total"
      :filtered="type !== ''"
      :loading="list.loading.value && !list.data.value"
      :error="list.error.value ? ADMIN_COMMON.loadFailed : undefined"
      :empty-title="type === '' ? COPY.empty : COPY.emptyForType"
      row-key="id"
      data-testid="gam-transactions-table"
      @retry="list.reload()"
    >
      <template #id-cell="{ row }">#{{ row.original.id }}</template>
      <template #name-cell="{ row }">
        <DsStack gap="xs">
          <DsText variant="body" truncate>{{ row.original.name }}</DsText>
          <DsText variant="caption" tone="muted">ID: {{ row.original.userId }}</DsText>
        </DsStack>
      </template>
      <template #type-cell="{ row }">
        <DsBadge :label="row.original.type" :tone="LEDGER_TONE[row.original.type]" size="sm" />
      </template>
      <template #amount-cell="{ row }">
        <DsText variant="body-strong" :tone="amountTone(row.original.amount)" tabular>
          {{ signedAmount(row.original.amount) }}
        </DsText>
      </template>
      <template #balanceAfter-cell="{ row }">{{ formatCount(row.original.balanceAfter) }}</template>
      <template #description-cell="{ row }">{{ row.original.description || '—' }}</template>
      <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
    </DsDataTable>
  </DsPage>
</template>
