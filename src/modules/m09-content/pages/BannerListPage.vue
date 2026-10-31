<script setup lang="ts">
/**
 * S9 `/admin/banners` "Pengurusan Banner - Admin PRESTASIPLUS" (M09; FR-M09-51..53, FR-M09-127,
 * BR-M09-12), v2 staff theme.
 *
 * - Header row ("Jumlah: {n} banner" and "Tambah"), a KPI strip and every banner in one table (no filter,
 *   search or pager), `displayOrder` then id as the API returns them. Below `md` every banner is a card.
 * - Tajuk = thumbnail, title and the description cut to 50 characters under it (2-line clamp), the stored codes
 *   shown raw (DV-M09-11), dates dd/mm/yyyy, "Aktif" badge (inactive: the "Tidak Aktif" placeholder, 8.2).
 * - Delete: confirm (`useConfirm`), DELETE, reload with the success flash. No view action.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsRowActions,
  DsStatRow,
  DsStatusBadge,
  DsTag,
  DsThumb,
  statusMap,
  useConfirm,
} from '@/ds'
import type { CardField, RowAction, StatItem } from '@/ds'

import { deleteBanner, fetchAdminBanners, type AdminBanner } from '../api/admin-media'
import { cellClass } from '../lib/table-cols'
import { COPY, dmy, errorLines, limit50, MEDIA_ROUTES } from '../lib/admin-media/common'

const flash = useFlash()
const confirm = useConfirm()

const { data, error, reload } = useApi((signal) => fetchAdminBanners({ signal }))

const rows = computed<AdminBanner[]>(() => data.value ?? [])
const activeCount = computed(() => rows.value.filter((b) => b.isActive).length)
const firstLoad = computed(() => data.value === null && error.value === null)

const deleting = ref(false)

async function remove(banner: AdminBanner): Promise<void> {
  if (deleting.value) return
  if (!(await confirm({ message: COPY.confirmDeleteBanner, tone: 'error' }))) return
  deleting.value = true
  try {
    const result = await deleteBanner(banner.id)
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    deleting.value = false
  }
}

function actionsOf(banner: AdminBanner): RowAction[] {
  return [
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      to: `/admin/banners/${String(banner.id)}/edit`,
    },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: deleting.value,
      onSelect: () => void remove(banner),
    },
  ]
}

const statItems = computed<StatItem[]>(() => [
  { key: 'k1', label: 'Jumlah banner', value: rows.value.length, icon: 'image', accent: 'action' },
  { key: 'k2', label: 'Aktif', value: activeCount.value, icon: 'check-circle', accent: 'win' },
  {
    key: 'k3',
    label: 'Tidak aktif',
    value: rows.value.length - activeCount.value,
    icon: 'pause-circle',
    accent: 'heat',
  },
])

interface TableRow extends Record<string, unknown> {
  id: number
  no: number
  title: string
  bannerType: string
  targetAudience: string
  displayOrder: number
  start: string
  end: string
  activeText: string
  raw: AdminBanner
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((b, i) => ({
    id: b.id,
    no: i + 1,
    title: b.title,
    bannerType: b.bannerType,
    targetAudience: b.targetAudience,
    displayOrder: b.displayOrder,
    start: dmy(b.startDate),
    end: dmy(b.endDate),
    // The same word as the table's "Aktif?" cell (DsStatusBadge), for the card list below md.
    activeText: statusMap[b.isActive ? 'active' : 'inactive'].word,
    raw: b,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'title', header: 'Tajuk', ...cellClass('') },
  { accessorKey: 'bannerType', header: 'Jenis', ...cellClass('w-32') },
  { accessorKey: 'targetAudience', header: 'Sasaran', ...cellClass('w-24') },
  { accessorKey: 'displayOrder', header: 'Susunan', ...cellClass('w-20') },
  { accessorKey: 'start', header: 'Mula', ...cellClass('w-28') },
  { accessorKey: 'end', header: 'Tamat', ...cellClass('w-28') },
  { id: 'active', header: 'Aktif?', ...cellClass('w-32') },
  { id: 'actions', header: 'Tindakan', ...cellClass('w-24 text-end') },
]
const cardFields: CardField[] = [
  { key: 'bannerType', label: 'Jenis' },
  { key: 'targetAudience', label: 'Sasaran' },
  { key: 'start', label: 'Mula' },
  { key: 'end', label: 'Tamat' },
  { key: 'activeText', label: 'Aktif?' },
]
</script>

<template>
  <DsPage
    :subtitle="`Jumlah: ${rows.length} banner`"
    subtitle-testid="banners-count"
    data-testid="banners-page"
  >
    <template #actions>
      <UButton
        :to="{ name: MEDIA_ROUTES.bannerCreate }"
        icon="i-ph-plus"
        label="Tambah"
        class="min-h-11"
        data-testid="banners-add"
      />
    </template>

    <DsStatRow :items="statItems" prefix="stat" :cols="3" />

    <DsLoadError v-if="error" :message="COPY.loadFailed" testid="banners-error" @retry="reload()" />

    <DsPanel v-else-if="!firstLoad && rows.length === 0" data-testid="banners-empty">
      <DsEmptyState title="Tiada banner" icon="i-ph-image" />
    </DsPanel>

    <DsDataTable
      v-else
      variant="flush"
      layout="fixed"
      density="compact"
      :data="tableRows"
      :columns="columns"
      caption="Senarai banner"
      :loading="firstLoad"
      :total="rows.length"
      :page-size="Math.max(rows.length, 1)"
      card-title="title"
      :card-fields="cardFields"
      data-testid="banners-table"
    >
      <template #title-cell="{ row }">
        <div
          class="flex min-w-40 items-center gap-4"
          data-testid="banner-row"
          :data-banner-id="row.original.id"
        >
          <DsThumb :src="row.original.raw.imageUrl || undefined" :alt="row.original.title" />
          <div class="flex min-w-0 flex-col gap-1">
            <p class="line-clamp-2 text-label text-highlighted" :title="row.original.title" data-testid="banner-title">
              {{ row.original.title }}
            </p>
            <p
              v-if="row.original.raw.description"
              class="line-clamp-1 text-caption text-muted"
              data-testid="banner-description"
            >
              {{ limit50(row.original.raw.description) }}
            </p>
          </div>
        </div>
      </template>
      <template #bannerType-cell="{ row }">
        <DsTag :label="row.original.bannerType" data-testid="banner-type" />
      </template>
      <template #targetAudience-cell="{ row }">
        <span data-testid="banner-audience">{{
          row.original.targetAudience
        }}</span>
      </template>
      <template #displayOrder-cell="{ row }">
        <span data-testid="banner-order">{{ row.original.displayOrder }}</span>
      </template>
      <template #start-cell="{ row }">
        <span class="text-nowrap" data-testid="banner-start">{{ row.original.start }}</span>
      </template>
      <template #end-cell="{ row }">
        <span class="text-nowrap" data-testid="banner-end">{{ row.original.end }}</span>
      </template>
      <template #active-cell="{ row }">
        <DsStatusBadge
          :status="row.original.raw.isActive ? 'active' : 'inactive'"
          data-testid="banner-active"
        />
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="actionsOf(row.original.raw)" :inline="1" />
      </template>
      <template #card-actions="{ row }">
        <DsRowActions :actions="actionsOf((row as unknown as TableRow).raw)" :inline="1" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
