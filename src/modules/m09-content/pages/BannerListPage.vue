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
import { DsArt3D, DsDataTable, DsEmptyState, DsPage, DsStatTile, useConfirm } from '@/ds'
import type { CardField } from '@/ds'

import { deleteBanner, fetchAdminBanners, type AdminBanner } from '../api/admin-media'
import AdminAlert from '../components/admin-kit/AdminAlert.vue'
import AdminRowMenu from '../components/admin-kit/AdminRowMenu.vue'
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
  if (!(await confirm({ message: COPY.confirmDeleteBanner, tone: 'danger' }))) return
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

function actionsOf(banner: AdminBanner) {
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

interface TableRow extends Record<string, unknown> {
  id: number
  no: number
  title: string
  bannerType: string
  targetAudience: string
  displayOrder: number
  start: string
  end: string
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
    raw: b,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'no', header: '#' },
  { accessorKey: 'title', header: 'Tajuk' },
  { accessorKey: 'bannerType', header: 'Jenis' },
  { accessorKey: 'targetAudience', header: 'Sasaran' },
  { accessorKey: 'displayOrder', header: 'Susunan' },
  { accessorKey: 'start', header: 'Mula' },
  { accessorKey: 'end', header: 'Tamat' },
  { id: 'active', header: 'Aktif?' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'bannerType', label: 'Jenis' },
  { key: 'targetAudience', label: 'Sasaran' },
  { key: 'start', label: 'Mula' },
  { key: 'end', label: 'Tamat' },
]
</script>

<template>
  <DsPage data-testid="banners-page">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <p class="min-w-0 text-body text-muted" data-testid="banners-count">
        Jumlah: {{ rows.length }} banner
      </p>
      <UButton
        :to="{ name: MEDIA_ROUTES.bannerCreate }"
        icon="i-ph-plus"
        label="Tambah"
        size="md"
        class="min-h-11"
        data-testid="banners-add"
      />
    </div>

    <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <DsStatTile :value="rows.length" unit="Jumlah banner" icon="i-ph-image" accent="action" />
      <DsStatTile :value="activeCount" unit="Aktif" icon="i-ph-check-circle" accent="win" />
      <DsStatTile
        :value="rows.length - activeCount"
        unit="Tidak aktif"
        icon="i-ph-pause-circle"
        accent="heat"
      />
    </section>

    <div v-if="error" class="flex flex-col gap-4" data-testid="banners-error">
      <AdminAlert :messages="[COPY.loadFailed]" />
      <div><UButton label="Cuba Lagi" class="min-h-11" @click="reload()" /></div>
    </div>

    <UCard v-else-if="!firstLoad && rows.length === 0" data-testid="banners-empty">
      <DsEmptyState title="Tiada banner" icon="i-ph-image" />
    </UCard>

    <DsDataTable
      v-else
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
      <template #no-cell="{ row }">
        <span class="text-muted">{{ row.original.no }}</span>
      </template>
      <template #title-cell="{ row }">
        <div
          class="flex min-w-64 items-center gap-4"
          data-testid="banner-row"
          :data-banner-id="row.original.id"
        >
          <div class="w-24 shrink-0">
            <DsArt3D
              v-if="row.original.raw.imageUrl"
              variant="plain"
              ratio="video"
              :src="row.original.raw.imageUrl"
              :alt="row.original.title"
            />
            <div
              v-else
              class="grid aspect-video place-items-center bg-soft text-dimmed"
              aria-hidden="true"
            >
              <UIcon name="i-ph-image" class="size-6" />
            </div>
          </div>
          <div class="flex min-w-0 flex-col gap-1">
            <p class="line-clamp-2 text-label text-highlighted" data-testid="banner-title">
              {{ row.original.title }}
            </p>
            <p
              v-if="row.original.raw.description"
              class="line-clamp-2 text-caption text-muted"
              data-testid="banner-description"
            >
              {{ limit50(row.original.raw.description) }}
            </p>
          </div>
        </div>
      </template>
      <template #bannerType-cell="{ row }">
        <UBadge
          color="neutral"
          variant="subtle"
          :label="row.original.bannerType"
          data-testid="banner-type"
        />
      </template>
      <template #targetAudience-cell="{ row }">
        <span data-testid="banner-audience">{{ row.original.targetAudience }}</span>
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
        <UBadge
          :color="row.original.raw.isActive ? 'success' : 'neutral'"
          variant="subtle"
          :icon="row.original.raw.isActive ? 'i-ph-check-circle' : undefined"
          :label="row.original.raw.isActive ? 'Aktif' : 'Tidak Aktif'"
          data-testid="banner-active"
        />
      </template>
      <template #actions-cell="{ row }">
        <AdminRowMenu :actions="actionsOf(row.original.raw)" />
      </template>
      <template #card-actions="{ row }">
        <AdminRowMenu :actions="actionsOf((row as unknown as TableRow).raw)" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
