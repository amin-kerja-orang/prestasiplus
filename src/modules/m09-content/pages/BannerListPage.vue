<script setup lang="ts">
/**
 * S9 `/admin/banners` "Pengurusan Banner - Admin PRESTASIPLUS" (M09; FR-M09-51..53, FR-M09-127,
 * BR-M09-12).
 *
 * - "Senarai Banner", "Jumlah: {n} banner" and "Tambah"; every banner in one table (no filter,
 *   search or pager), `displayOrder` then id as the API returns them.
 * - Tajuk = title with the description cut to 50 characters under it, the stored codes shown raw
 *   (DV-M09-11), dates dd/mm/yyyy, "Aktif" pill (inactive: the "Tidak Aktif" placeholder, §8.2).
 * - Delete: native confirm, DELETE, reload with the success flash. No view action.
 * - The table scrolls inside its card below the width it needs (DV-M09-16).
 */
import { CircleCheck, Plus, SquarePen, Trash } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { confirmNative, useApi, useFlash } from '@/composables'

import { deleteBanner, fetchAdminBanners, type AdminBanner } from '../api/admin-media'
import { COPY, dmy, errorLines, limit50, MEDIA_ROUTES } from '../lib/admin-media/common'

const flash = useFlash()

const { data, error, reload } = useApi((signal) => fetchAdminBanners({ signal }))

const COLUMNS = [
  '#',
  'Tajuk',
  'Jenis',
  'Sasaran',
  'Susunan',
  'Mula',
  'Tamat',
  'Aktif?',
  'Tindakan',
] as const

const ICON_BUTTON =
  'inline-flex h-11 min-h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition lg:h-9 lg:min-h-9 lg:w-9 lg:min-w-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'

const deleting = ref(false)

async function remove(banner: AdminBanner): Promise<void> {
  if (!confirmNative(COPY.confirmDeleteBanner)) return
  if (deleting.value) return
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
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="banners-page">
    <AlertBox v-if="error" :messages="COPY.loadFailed" data-testid="banners-error" />

    <DataTableCard v-else-if="data" :min-width="900">
      <template #header>
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div>
            <h2 class="font-heading text-lg font-bold text-slate-800">Senarai Banner</h2>
            <p class="text-sm text-slate-500" data-testid="banners-count">
              Jumlah: {{ data.length }} banner
            </p>
          </div>
          <RouterLink
            :to="{ name: MEDIA_ROUTES.bannerCreate }"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            data-testid="banners-add"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            Tambah
          </RouterLink>
        </div>
      </template>

      <table :class="T.table" data-testid="banners-table">
        <thead>
          <tr>
            <th
              v-for="label in COLUMNS"
              :key="label"
              scope="col"
              :class="T.th"
              data-testid="banners-th"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(banner, index) in data"
            :key="banner.id"
            :class="[T.row, 'align-middle']"
            data-testid="banner-row"
            :data-banner-id="banner.id"
          >
            <td :class="[T.td, 'text-xs text-slate-500']">{{ index + 1 }}</td>
            <td :class="[T.td, 'max-w-xs min-w-48']">
              <div class="font-medium text-slate-800" data-testid="banner-title">
                {{ banner.title }}
              </div>
              <div
                v-if="banner.description"
                class="mt-0.5 text-xs text-slate-500"
                data-testid="banner-description"
              >
                {{ limit50(banner.description) }}
              </div>
            </td>
            <td :class="T.td">
              <span
                class="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-slate-700"
                data-testid="banner-type"
                >{{ banner.bannerType }}</span
              >
            </td>
            <td :class="T.td" data-testid="banner-audience">{{ banner.targetAudience }}</td>
            <td :class="T.td">
              <span
                class="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                data-testid="banner-order"
                >{{ banner.displayOrder }}</span
              >
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="banner-start">
              {{ dmy(banner.startDate) }}
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="banner-end">
              {{ dmy(banner.endDate) }}
            </td>
            <td :class="T.td">
              <span
                v-if="banner.isActive"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700"
                data-testid="banner-active"
              >
                <CircleCheck class="h-3 w-3" aria-hidden="true" />Aktif
              </span>
              <span
                v-else
                class="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-slate-700"
                data-testid="banner-active"
                >Tidak Aktif</span
              >
            </td>
            <td :class="T.td">
              <div class="flex items-center gap-1.5">
                <RouterLink
                  :to="{ name: MEDIA_ROUTES.bannerEdit, params: { id: banner.id } }"
                  title="Edit"
                  :class="[ICON_BUTTON, 'text-indigo-600 hover:bg-indigo-50']"
                  data-testid="banner-edit"
                >
                  <SquarePen class="h-4 w-4" aria-hidden="true" />
                </RouterLink>
                <button
                  type="button"
                  title="Padam"
                  :disabled="deleting"
                  :class="[ICON_BUTTON, 'text-red-600 hover:bg-red-50 disabled:opacity-60']"
                  data-testid="banner-delete"
                  @click="remove(banner)"
                >
                  <Trash class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </DataTableCard>
  </div>
</template>
