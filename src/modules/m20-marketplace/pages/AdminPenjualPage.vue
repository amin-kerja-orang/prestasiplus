<script setup lang="ts">
/**
 * P2-13 `/admin/marketplace/sellers` "Marketplace — Penjual" (R1-ADM-P2-13; API-ADM-19), admin shell.
 *
 * Three global stat cards (`Jumlah Penjual`, `Aktif`, `Menunggu Pengesahan`; not the filtered query), the status
 * filter (`Semua Status`: Pending, Aktif, Digantung, Diharamkan; `Tapis`), the count line "{n} penjual dijumpai" and
 * the seller rows (cards below `md`, status and actions always visible). Each row shows only the transitions the
 * server allows now (`Luluskan`, `Sahkan`, `Gantung`, `Haramkan`), each after a confirm. Sellers are never created or
 * deleted here; the owner is masked.
 */
import {
  MARKETPLACE_SELLER_STATUSES,
  MARKETPLACE_SELLER_STATUS_LABELS,
  type MarketplaceAdminSellerRow,
  type MarketplaceSellerStatus,
} from '@pp/contract'
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsCluster,
  DsPanel,
  DsStack,
  DsStatRow,
  DsStatusBadge,
  DsText,
  type CardField,
  type DsStatus,
  type StatItem,
} from '@/ds'

import { fetchAdminSellers } from '../api'
import {
  ADMIN_COPY,
  ADMIN_SELLERS_PATH,
  errorText,
  queryPage,
  queryText,
} from '../components/admin/copy'
import SellerActions from '../components/admin/SellerActions.vue'

const route = useRoute()
const router = useRouter()

const applied = computed(() => ({
  status: queryText(route.query.status),
  page: queryPage(route.query.page),
}))

const status = ref(queryText(route.query.status) || 'all')
watch(
  () => route.query.status,
  (s) => {
    status.value = queryText(s) || 'all'
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminSellers(
      { status: applied.value.status as '' | MarketplaceSellerStatus, page: String(applied.value.page) },
      { signal },
    ),
  [() => route.query.status, () => route.query.page],
)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const stats = computed(() => data.value?.meta.stats ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const pagerQuery = computed(() => (applied.value.status !== '' ? { status: applied.value.status } : {}))

const chips = computed(() => {
  const label = MARKETPLACE_SELLER_STATUS_LABELS[applied.value.status as MarketplaceSellerStatus]
  return label ? [{ key: 'status', label }] : []
})

async function submitFilter(): Promise<void> {
  const query: Record<string, string> = status.value === 'all' ? {} : { status: status.value }
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) await reload()
  else await router.push({ path: ADMIN_SELLERS_PATH, query })
}
const resetFilter = () => router.push({ path: ADMIN_SELLERS_PATH })
const removeChip = () => router.push({ path: ADMIN_SELLERS_PATH })
function goToPage(page: number): void {
  void router.push({ path: ADMIN_SELLERS_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

const statItems = computed<StatItem[]>(() => [
  { key: 'total', label: ADMIN_COPY.statTotalSellers, value: stats.value?.total ?? null, icon: 'storefront', accent: 'action' },
  { key: 'active', label: ADMIN_COPY.statActive, value: stats.value?.active ?? null, icon: 'check-circle', accent: 'win' },
  { key: 'pending', label: ADMIN_COPY.statPendingSellers, value: stats.value?.pending ?? null, icon: 'hourglass', accent: 'trial' },
])

const BADGE: Record<MarketplaceSellerStatus, DsStatus> = {
  pending: 'pending-approval',
  active: 'active',
  suspended: 'inactive',
  banned: 'rejected',
}

interface TableRow extends Record<string, unknown> {
  id: string
  shopName: string
  ownerText: string
  statusText: string
  countText: string
  raw: MarketplaceAdminSellerRow
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    shopName: r.shopName,
    ownerText: `${ADMIN_COPY.owner}: ${r.ownerMasked}`,
    statusText: MARKETPLACE_SELLER_STATUS_LABELS[r.status],
    countText: ADMIN_COPY.productCount(r.productCount),
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { id: 'seller', header: 'Penjual' },
  { id: 'status', header: 'Status' },
  { accessorKey: 'countText', header: 'Produk' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = []

const detailTo = (id: string): string => `${ADMIN_SELLERS_PATH}/${id}`
</script>

<template>
  <DsPage :subtitle="data ? ADMIN_COPY.sellersFound(total) : undefined" subtitle-testid="admin-sellers-count" data-testid="admin-sellers-page">
    <DsStatRow :items="statItems" prefix="stat" :cols="3" />

    <DsFilterBar
      :chips="chips"
      :apply-label="ADMIN_COPY.apply"
      :reset-label="ADMIN_COPY.reset"
      :sheet-apply-label="ADMIN_COPY.apply"
      data-testid="admin-sellers-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove-chip="removeChip"
    >
      <DsNativeSelect v-model="status" name="status" :aria-label="ADMIN_COPY.allStatuses" class="md:w-48" data-testid="admin-sellers-status">
        <option value="all">{{ ADMIN_COPY.allStatuses }}</option>
        <option v-for="s in MARKETPLACE_SELLER_STATUSES" :key="s" :value="s">{{ MARKETPLACE_SELLER_STATUS_LABELS[s] }}</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsLoadError v-if="error" :message="errorText(error)" testid="admin-sellers-error" @retry="reload()" />

    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="admin-sellers-empty">
      <DsEmptyState :title="ADMIN_COPY.sellersEmpty" icon="storefront" />
    </DsPanel>

    <DsDataTable
      v-else
      variant="flush"
      layout="fixed"
      :data="tableRows"
      :columns="columns"
      caption="Senarai penjual Marketplace"
      :loading="firstLoad"
      :total="total"
      :page-size="data?.meta.pageSize ?? 20"
      :page="applied.page"
      card-title="shopName"
      :card-fields="cardFields"
      data-testid="admin-sellers-table"
      @update:page="goToPage"
    >
      <template #seller-cell="{ row }">
        <DsCluster gap="sm" :wrap="false" data-testid="admin-seller-row" :data-seller-id="row.original.id">
          <UAvatar :text="row.original.raw.initial" size="md" aria-hidden="true" />
          <DsStack gap="none">
            <DsText variant="label" tone="highlighted" data-testid="admin-seller-name">{{ row.original.shopName }}</DsText>
            <DsText variant="caption" data-testid="admin-seller-owner">{{ row.original.ownerText }}</DsText>
          </DsStack>
        </DsCluster>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="BADGE[row.original.raw.status]" :label="row.original.statusText" data-testid="admin-seller-status" />
      </template>
      <template #countText-cell="{ row }">
        <DsText variant="body" as="span" data-testid="admin-seller-products">{{ row.original.countText }}</DsText>
      </template>
      <template #actions-cell="{ row }">
        <SellerActions :id="row.original.id" :actions="row.original.raw.actions" :detail-to="detailTo(row.original.id)" @done="reload()" @failed="reload()" />
      </template>
      <template #card="{ row }">
        <DsStack gap="sm">
          <DsCluster gap="sm" :wrap="false" data-testid="admin-seller-row" :data-seller-id="row.id">
            <UAvatar :text="(row as unknown as TableRow).raw.initial" size="md" aria-hidden="true" />
            <DsStack gap="none">
              <DsText variant="label" tone="highlighted" data-testid="admin-seller-name">{{ row.shopName }}</DsText>
              <DsText variant="caption" data-testid="admin-seller-owner">{{ row.ownerText }}</DsText>
            </DsStack>
          </DsCluster>
          <DsCluster gap="sm">
            <DsStatusBadge :status="BADGE[(row as unknown as TableRow).raw.status]" :label="String(row.statusText)" data-testid="admin-seller-status" />
            <DsText variant="caption" as="span" data-testid="admin-seller-products">{{ row.countText }}</DsText>
          </DsCluster>
          <SellerActions :id="String(row.id)" :actions="(row as unknown as TableRow).raw.actions" :detail-to="detailTo(String(row.id))" @done="reload()" @failed="reload()" />
        </DsStack>
      </template>
    </DsDataTable>
  </DsPage>
</template>
