<script setup lang="ts">
/**
 * S6 `/admin/subjects` "Pengurusan Subjek - Admin PRESTASIPLUS" (M03-T2; FR-M03-39..46, FR-98).
 *
 * - Heading "Senarai Subjek", "Jumlah: {n} subjek" and "Tambah"; every subject in one table (no
 *   paging, search or filter; order from the API, BR-08).
 * - Icon tile (BR-05), level line under the name, colour swatch (hex hidden below `sm`), Teras /
 *   Elektif, "Soalan" (number only below `sm`).
 * - The "Aktif?" switch flips at once, PATCHes, and reverts with a native alert on failure
 *   (DV-M03-07). No confirm, no success message.
 * - Delete: native confirm, DELETE, reload with the success flash.
 * - The table fits its card from 1280 and scrolls inside the card below (DV-M03-03).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'

import { alertNative, useApi, useFlash } from '@/composables'
import {
  type CardField,
  DsDataTable,
  DsPage,
  DsPageHeader,
  DsStatRow,
  type StatItem,
} from '@/ds'

import {
  deleteSubject,
  fetchAdminSubjects,
  setSubjectActive,
  type AdminSubjectListItem,
} from '../api/admin-subjects-levels'
import { DsLoadError, DsRowActions, type RowAction } from '@/ds'
import ColorSwatch from '../components/subjects-levels/ColorSwatch.vue'
import SubjectIconTile from '../components/subjects-levels/SubjectIconTile.vue'
import { COPY, SUBJECT_ROUTES, errorLines, isNetworkFailure } from '../lib/subjects-levels'

const flash = useFlash()

const { data, error, reload } = useApi((signal) => fetchAdminSubjects({ signal }))

/** Local copy so the switch can flip before the server answers. */
const rows = ref<AdminSubjectListItem[]>([])
watch(data, (result) => {
  rows.value = result ? result.data.map((row) => ({ ...row })) : []
})
type SubjectRow = AdminSubjectListItem & Record<string, unknown>
const tableRows = computed(() => rows.value as SubjectRow[])
const kpi = computed(() => ({
  active: rows.value.filter((r) => r.isActive).length,
  core: rows.value.filter((r) => r.isCore).length,
  questions: rows.value.reduce((sum, r) => sum + r.questionCount, 0),
}))

const kpiItems = computed<StatItem[]>(() => [
  { key: 'total', label: 'Jumlah Subjek', value: rows.value.length, icon: 'books' },
  { key: 'active', label: 'Aktif', value: kpi.value.active, icon: 'check-circle', accent: 'win' },
  { key: 'core', label: 'Teras', value: kpi.value.core, icon: 'star', accent: 'friend' },
  {
    key: 'questions',
    label: 'Jumlah Soalan',
    value: kpi.value.questions,
    icon: 'question',
    accent: 'trial',
  },
])

const columns: TableColumn<SubjectRow>[] = [
  { accessorKey: 'id', header: '#' },
  { id: 'icon', header: 'Ikon' },
  { accessorKey: 'name', header: 'Nama (BM)' },
  { accessorKey: 'nameEn', header: 'Nama (EN)' },
  { accessorKey: 'code', header: 'Kod' },
  { id: 'color', header: 'Warna' },
  { accessorKey: 'isCore', header: 'Teras?' },
  { accessorKey: 'questionCount', header: 'Soalan' },
  { accessorKey: 'isActive', header: 'Aktif?' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'code', label: 'Kod' },
  { key: 'nameEn', label: 'Nama (EN)' },
  { key: 'questionCount', label: 'Soalan' },
]

/** Rows whose PATCH is in flight: further clicks on them are ignored (no race). */
const switching = new Set<number>()

async function toggle(row: AdminSubjectListItem): Promise<void> {
  if (switching.has(row.id)) return
  switching.add(row.id)
  const next = !row.isActive
  row.isActive = next
  try {
    await setSubjectActive(row.id, next)
  } catch (err) {
    row.isActive = !next
    alertNative(isNetworkFailure(err) ? COPY.networkError : COPY.switchFailed)
  } finally {
    switching.delete(row.id)
  }
}

const deleting = ref(false)

/** Edit stays one click away; the menu holds the destructive "Padam" (confirmed first). */
function rowActions(row: AdminSubjectListItem): RowAction[] {
  return [
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      to: { name: SUBJECT_ROUTES.edit, params: { id: row.id } },
      testid: 'subject-edit',
    },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: deleting.value,
      testid: 'subject-delete',
      confirm: { title: 'Padam Subjek?', body: COPY.confirmDeleteSubject, confirmLabel: 'Padam' },
      onSelect: () => void remove(row),
    },
  ]
}

/** The confirmation ran in `DsRowActions` (live message); this only calls the API. */
async function remove(row: AdminSubjectListItem): Promise<void> {
  if (deleting.value) return
  deleting.value = true
  try {
    const result = await deleteSubject(row.id)
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
  <DsPage data-testid="subjects-page">
    <DsLoadError
      v-if="error"
      :message="COPY.loadFailed"
      testid="subjects-error"
      @retry="reload()"
    />

    <template v-else-if="data">
      <DsPageHeader>
        <template #subtitle>
          <div>
            <h2 class="text-subheading text-highlighted">Senarai Subjek</h2>
            <p class="text-body text-muted" data-testid="subjects-count">
              Jumlah: {{ rows.length }} subjek
            </p>
          </div>
        </template>
        <template #actions>
          <UButton
            :to="{ name: SUBJECT_ROUTES.create }"
            icon="i-ph-plus"
            data-testid="subjects-add"
          >
            Tambah
          </UButton>
        </template>
      </DsPageHeader>

      <DsStatRow :items="kpiItems" density="compact" :cols="4" aria-label="Ringkasan subjek" />

      <DsDataTable
        :data="tableRows"
        :columns="columns"
        caption="Senarai subjek"
        density="compact"
        :page-size="Math.max(tableRows.length, 1)"
        card-title="name"
        :card-fields="cardFields"
        data-testid="subjects-table"
      >
        <template #icon-cell="{ row }">
          <SubjectIconTile :icon="row.original.icon" :color="row.original.color" />
        </template>
        <template #name-cell="{ row }">
          <div class="max-w-40 min-w-32 whitespace-normal" data-testid="subject-name-cell">
            <div class="text-label text-highlighted">{{ row.original.name }}</div>
            <div
              v-if="row.original.levels.length > 0"
              class="mt-1 flex items-start gap-1 text-caption text-muted"
              data-testid="subject-levels"
            >
              <UIcon name="i-ph-graduation-cap" class="mt-1 size-4 shrink-0" />
              <span
                class="line-clamp-2 min-w-0"
                :title="row.original.levels.map((level) => level.name).join(', ')"
                >{{ row.original.levels.map((level) => level.name).join(', ') }}</span
              >
            </div>
          </div>
        </template>
        <template #code-cell="{ row }">
          <UBadge
            color="neutral"
            variant="subtle"
            :label="row.original.code"
            data-testid="subject-code"
          />
        </template>
        <template #color-cell="{ row }">
          <ColorSwatch :color="row.original.color" />
        </template>
        <template #isCore-cell="{ row }">
          <UBadge
            v-if="row.original.isCore"
            color="success"
            variant="subtle"
            icon="i-ph-star"
            label="Teras"
            data-testid="subject-core"
          />
          <UBadge
            v-else
            color="neutral"
            variant="subtle"
            label="Elektif"
            data-testid="subject-core"
          />
        </template>
        <template #questionCount-cell="{ row }">
          <UBadge color="warning" variant="subtle" data-testid="subject-questions"
            >{{ row.original.questionCount
            }}<span class="hidden 2xl:inline">{{ ' soalan' }}</span></UBadge
          >
        </template>
        <template #isActive-cell="{ row }">
          <span class="inline-flex min-h-11 min-w-11 items-center justify-center">
            <USwitch
              :model-value="row.original.isActive"
              aria-label="Aktif"
              color="success"
              data-testid="subject-switch"
              @update:model-value="toggle(row.original)"
            />
          </span>
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="rowActions(row.original)" :inline="1" testid="subject-more" />
        </template>
        <template #card-actions="{ row }">
          <div class="flex items-center gap-1">
            <span class="inline-flex min-h-11 min-w-11 items-center justify-center">
              <USwitch
                :model-value="row.isActive as boolean"
                aria-label="Aktif"
                color="success"
                @update:model-value="toggle(row as AdminSubjectListItem)"
              />
            </span>
            <DsRowActions
              :actions="rowActions(row as AdminSubjectListItem)"
              :inline="1"
              testid="subject-more"
            />
          </div>
        </template>
      </DsDataTable>
    </template>
  </DsPage>
</template>
