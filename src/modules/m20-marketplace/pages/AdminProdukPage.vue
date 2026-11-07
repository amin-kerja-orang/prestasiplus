<script setup lang="ts">
/**
 * P2-12 `/admin/marketplace/products` "Marketplace — Produk" (R1-ADM-P2-12; API-ADM-19), admin shell.
 *
 * Two global stat cards (`Jumlah Produk`, `Aktif`; not the filtered query), the filter bar (`Cari produk...`,
 * `Semua Kategori`, `Semua Status`, `Tapis`, `Reset`), the count line "{n} produk dijumpai", and 20 rows per page
 * (cards below `md`). The query string is the state. Row actions: open (active products), edit, `Nyahaktif` /
 * `Aktifkan`, and delete after "Padam produk ini?" (`Batal` / `Ya, Padam`). Nothing blocks a delete (no orders exist).
 */
import { MARKETPLACE_ADMIN_PROPOSED, MARKETPLACE_PRODUCT_STATUSES, MARKETPLACE_PRODUCT_STATUS_LABELS, type MarketplaceAdminProductRow } from '@pp/contract'
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsIcon,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsCluster,
  DsPanel,
  DsStack,
  DsStatRow,
  DsText,
  DsStatusBadge,
  DsThumb,
  useConfirm,
  type CardField,
  type DsStatus,
  type StatItem,
} from '@/ds'

import {
  deleteAdminProduct,
  fetchAdminProducts,
  fetchMarketplaceCategories,
  updateAdminProduct,
} from '../api'
import { formatPrice } from '../components/product/copy'
import {
  ADMIN_COPY,
  ADMIN_PRODUCTS_PATH,
  ADMIN_ROUTES,
  conditionLabel,
  errorText,
  productActivateConfirm,
  productDeleteConfirm,
  queryPage,
  queryText,
  stockLabel,
} from '../components/admin/copy'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

const applied = computed(() => ({
  q: queryText(route.query.q).trim(),
  categoryId: queryText(route.query.categoryId),
  status: queryText(route.query.status),
  page: queryPage(route.query.page),
}))

// Draft values of the controls; re-synced when the URL changes (Reset, back/forward).
const search = ref(queryText(route.query.q))
const category = ref(queryText(route.query.categoryId) || 'all')
const status = ref(queryText(route.query.status) || 'all')
watch(
  () => [route.query.q, route.query.categoryId, route.query.status] as const,
  ([q, c, s]) => {
    search.value = queryText(q)
    category.value = queryText(c) || 'all'
    status.value = queryText(s) || 'all'
  },
)

const categories = useApi((signal) => fetchMarketplaceCategories({ signal }))
const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminProducts(
      {
        q: applied.value.q,
        categoryId: applied.value.categoryId,
        status: applied.value.status as '' | (typeof MARKETPLACE_PRODUCT_STATUSES)[number],
        page: String(applied.value.page),
      },
      { signal },
    ),
  [() => route.query.q, () => route.query.categoryId, () => route.query.status, () => route.query.page],
)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const stats = computed(() => data.value?.meta.stats ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
const filtered = computed(() => applied.value.q !== '' || applied.value.categoryId !== '' || applied.value.status !== '')

const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.q !== '') out.q = applied.value.q
  if (applied.value.categoryId !== '') out.categoryId = applied.value.categoryId
  if (applied.value.status !== '') out.status = applied.value.status
  return out
})

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.q !== '') out.push({ key: 'q', label: `"${applied.value.q}"` })
  const cat = categories.data.value?.find((c) => String(c.id) === applied.value.categoryId)
  if (cat) out.push({ key: 'categoryId', label: cat.name })
  const st = MARKETPLACE_PRODUCT_STATUS_LABELS[applied.value.status as keyof typeof MARKETPLACE_PRODUCT_STATUS_LABELS]
  if (st) out.push({ key: 'status', label: st })
  return out
})

function formQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (search.value.trim() !== '') out.q = search.value.trim()
  if (category.value !== 'all') out.categoryId = category.value
  if (status.value !== 'all') out.status = status.value
  return out
}

async function submitFilter(): Promise<void> {
  const query = formQuery()
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) await reload()
  else await router.push({ path: ADMIN_PRODUCTS_PATH, query })
}
const resetFilter = () => router.push({ path: ADMIN_PRODUCTS_PATH })
function removeChip(key: string): void {
  const query = { ...pagerQuery.value }
  delete query[key]
  void router.push({ path: ADMIN_PRODUCTS_PATH, query })
}
function goToPage(page: number): void {
  void router.push({ path: ADMIN_PRODUCTS_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

const busyId = ref<string | null>(null)

/** `Nyahaktif` sets `draft`; the way back is `Aktifkan` (decision 6 on #506). */
async function toggle(row: MarketplaceAdminProductRow): Promise<void> {
  if (busyId.value !== null) return
  // `Aktifkan` on a rejected product overrides the rejection: ask first (R-1 minor on #912).
  if (row.status === 'rejected') {
    const yes = await confirm({
      message: productActivateConfirm.message,
      confirmLabel: productActivateConfirm.confirmLabel,
      cancelLabel: ADMIN_COPY.cancel,
    })
    if (!yes) return
  }
  busyId.value = row.id
  try {
    await updateAdminProduct(row.id, { status: row.status === 'active' ? 'draft' : 'active' })
    flash.show({ type: 'success', message: MARKETPLACE_ADMIN_PROPOSED.flash.productUpdated })
    await reload()
  } catch (err) {
    flash.show({ type: 'error', message: errorText(err) })
  } finally {
    busyId.value = null
  }
}

async function remove(row: MarketplaceAdminProductRow): Promise<void> {
  if (busyId.value !== null) return
  const yes = await confirm({
    message: productDeleteConfirm,
    confirmLabel: ADMIN_COPY.deleteConfirmYes,
    cancelLabel: ADMIN_COPY.cancel,
    tone: 'error',
  })
  if (!yes) return
  busyId.value = row.id
  try {
    await deleteAdminProduct(row.id)
    flash.show({ type: 'success', message: MARKETPLACE_ADMIN_PROPOSED.flash.productDeleted })
    await reload()
    // The page became empty after the delete: step back one page.
    if (rows.value.length === 0 && applied.value.page > 1) goToPage(applied.value.page - 1)
  } catch (err) {
    flash.show({ type: 'error', message: errorText(err) })
  } finally {
    busyId.value = null
  }
}

const statItems = computed<StatItem[]>(() => [
  { key: 'total', label: ADMIN_COPY.statTotalProducts, value: stats.value?.total ?? null, icon: 'storefront', accent: 'action' },
  { key: 'active', label: ADMIN_COPY.statActive, value: stats.value?.active ?? null, icon: 'check-circle', accent: 'win' },
])

const BADGE: Record<MarketplaceAdminProductRow['status'], DsStatus> = { active: 'active', draft: 'draft', rejected: 'rejected' }

interface TableRow extends Record<string, unknown> {
  id: string
  name: string
  priceText: string
  sellerName: string
  categoryName: string
  stockText: string
  statusText: string
  raw: MarketplaceAdminProductRow
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    name: r.name,
    priceText: formatPrice(r.price),
    sellerName: r.sellerName,
    categoryName: r.categoryName,
    stockText: stockLabel(r.stockStatus),
    statusText: MARKETPLACE_PRODUCT_STATUS_LABELS[r.status],
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { id: 'product', header: 'Produk' },
  { accessorKey: 'priceText', header: 'Harga' },
  { accessorKey: 'sellerName', header: 'Penjual' },
  { accessorKey: 'categoryName', header: 'Kategori' },
  { accessorKey: 'stockText', header: 'Stok' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'priceText', label: 'Harga' },
  { key: 'sellerName', label: 'Penjual' },
  { key: 'categoryName', label: 'Kategori' },
  { key: 'stockText', label: 'Stok' },
  { key: 'statusText', label: 'Status' },
]
</script>

<template>
  <DsPage layout="list" :subtitle="data ? ADMIN_COPY.productsFound(total) : undefined" subtitle-testid="admin-products-count" data-testid="admin-products-page">
    <template #actions>
      <UButton :to="{ name: ADMIN_ROUTES.productCreate }" data-testid="admin-products-add">
        <DsIcon name="plus" />{{ ADMIN_COPY.add }}
      </UButton>
    </template>

    <DsStatRow :items="statItems" prefix="stat" :cols="2" />

    <DsFilterBar
      :chips="chips"
      :show-reset="true"
      :apply-label="ADMIN_COPY.apply"
      :reset-label="ADMIN_COPY.reset"
      :sheet-apply-label="ADMIN_COPY.apply"
      data-testid="admin-products-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="q"
          :aria-label="ADMIN_COPY.searchPlaceholder"
          :placeholder="ADMIN_COPY.searchPlaceholder"
          size="md"
          data-testid="admin-products-search"
        >
          <template #leading><DsIcon name="magnifying-glass" /></template>
        </UInput>
      </template>
      <DsNativeSelect v-model="category" :aria-label="ADMIN_COPY.allCategories" data-testid="admin-products-category">
        <option value="all">{{ ADMIN_COPY.allCategories }}</option>
        <option v-for="c in categories.data.value ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="status" :aria-label="ADMIN_COPY.allStatuses" data-testid="admin-products-status">
        <option value="all">{{ ADMIN_COPY.allStatuses }}</option>
        <option v-for="s in MARKETPLACE_PRODUCT_STATUSES" :key="s" :value="s">{{ MARKETPLACE_PRODUCT_STATUS_LABELS[s] }}</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsLoadError v-if="error" :message="errorText(error)" testid="admin-products-error" @retry="reload()" />

    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="admin-products-empty">
      <DsEmptyState
        :title="filtered ? ADMIN_COPY.productsNoMatch : ADMIN_COPY.productsEmptyTitle"
        :description="filtered ? undefined : ADMIN_COPY.productsEmptyHint"
        icon="storefront"
      />
    </DsPanel>

    <DsDataTable
      v-else
      variant="flush"
      layout="fixed"
      :data="tableRows"
      :columns="columns"
      caption="Senarai produk Marketplace"
      :loading="firstLoad"
      :total="total"
      :page-size="data?.meta.pageSize ?? 20"
      :page="applied.page"
      :filtered="filtered"
      card-title="name"
      :card-fields="cardFields"
      data-testid="admin-products-table"
      @update:page="goToPage"
    >
      <template #product-cell="{ row }">
        <DsCluster gap="sm" :wrap="false" data-testid="admin-product-row" :data-product-id="row.original.id">
          <DsThumb :src="row.original.raw.thumbnailUrl ?? undefined" :alt="row.original.name" />
          <DsStack gap="none">
            <DsText variant="label" tone="highlighted" :clamp="2" data-testid="admin-product-name">{{ row.original.name }}</DsText>
            <DsText variant="caption">{{ conditionLabel(row.original.raw.condition) }}</DsText>
          </DsStack>
        </DsCluster>
      </template>
      <template #priceText-cell="{ row }">
        <DsText variant="body" as="span" data-testid="admin-product-price">{{ row.original.priceText }}</DsText>
      </template>
      <template #stockText-cell="{ row }">
        <DsText variant="body" as="span" data-testid="admin-product-stock">{{ row.original.stockText }}</DsText>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="BADGE[row.original.raw.status]" data-testid="admin-product-status" />
      </template>
      <template #actions-cell="{ row }">
        <DsCluster gap="2xs" justify="end" :wrap="false">
          <UButton v-if="row.original.raw.status === 'active'" :to="`/marketplace/${row.original.raw.slug}`" color="neutral" variant="ghost" aria-label="Buka" title="Buka" data-testid="admin-product-open"><DsIcon name="arrow-square-out" /></UButton>
          <UButton :to="{ name: ADMIN_ROUTES.productEdit, params: { id: row.original.id } }" color="neutral" variant="ghost" :aria-label="ADMIN_COPY.edit" :title="ADMIN_COPY.edit" data-testid="admin-product-edit"><DsIcon name="pencil-simple" /></UButton>
          <UButton type="button" color="neutral" variant="ghost" :label="row.original.raw.status === 'active' ? MARKETPLACE_ADMIN_PROPOSED.productDeactivateLabel : MARKETPLACE_ADMIN_PROPOSED.productActivateLabel" :disabled="busyId !== null" data-testid="admin-product-toggle" @click="toggle(row.original.raw)" />
          <UButton type="button" color="error" variant="ghost" :aria-label="ADMIN_COPY.delete" :title="ADMIN_COPY.delete" :disabled="busyId !== null" data-testid="admin-product-delete" @click="remove(row.original.raw)"><DsIcon name="trash" /></UButton>
        </DsCluster>
      </template>
      <template #card="{ row }">
        <DsStack gap="sm">
          <DsCluster gap="sm" align="start" :wrap="false" data-testid="admin-product-row" :data-product-id="row.id">
            <DsThumb :src="(row as unknown as TableRow).raw.thumbnailUrl ?? undefined" :alt="String(row.name)" />
            <DsStack gap="2xs">
              <DsText variant="label" tone="highlighted" data-testid="admin-product-name">{{ row.name }}</DsText>
              <DsText variant="body-strong" as="span">{{ row.priceText }}</DsText>
              <DsText variant="caption">{{ row.sellerName }} · {{ row.categoryName }}</DsText>
              <DsText variant="caption">{{ row.stockText }}</DsText>
              <DsStatusBadge :status="BADGE[(row as unknown as TableRow).raw.status]" data-testid="admin-product-status" />
            </DsStack>
          </DsCluster>
          <DsCluster gap="2xs">
            <UButton v-if="(row as unknown as TableRow).raw.status === 'active'" :to="`/marketplace/${(row as unknown as TableRow).raw.slug}`" color="neutral" variant="ghost" aria-label="Buka" title="Buka" data-testid="admin-product-open"><DsIcon name="arrow-square-out" /></UButton>
            <UButton :to="{ name: ADMIN_ROUTES.productEdit, params: { id: String(row.id) } }" color="neutral" variant="ghost" :aria-label="ADMIN_COPY.edit" data-testid="admin-product-edit"><DsIcon name="pencil-simple" /></UButton>
            <UButton type="button" color="neutral" variant="ghost" :label="(row as unknown as TableRow).raw.status === 'active' ? MARKETPLACE_ADMIN_PROPOSED.productDeactivateLabel : MARKETPLACE_ADMIN_PROPOSED.productActivateLabel" :disabled="busyId !== null" data-testid="admin-product-toggle" @click="toggle((row as unknown as TableRow).raw)" />
            <UButton type="button" color="error" variant="ghost" :aria-label="ADMIN_COPY.delete" :disabled="busyId !== null" data-testid="admin-product-delete" @click="remove((row as unknown as TableRow).raw)"><DsIcon name="trash" /></UButton>
          </DsCluster>
        </DsStack>
      </template>
    </DsDataTable>
  </DsPage>
</template>
