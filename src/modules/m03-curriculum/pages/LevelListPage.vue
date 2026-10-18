<script setup lang="ts">
/**
 * S9 `/admin/education-levels` "Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS" (M03-T2;
 * FR-M03-57..62, FR-98).
 *
 * - Heading "Senarai Tahap Pendidikan", "Jumlah: {n} tahap" and the pink "Tambah Tahap" button.
 * - Table with fixed cell sizes (`text-xs`, `px-4 py-3`) at every width: stage badge, "Soalan" and
 *   "Subjek" counts, the "Aktif?" switch (same failure handling as S6) and edit / delete actions.
 * - The table fits its card from 1280 and scrolls inside the card below (FR-46).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'

import { AdminKpiStrip, AdminPageHeader } from '@/ds/admin'
import { alertNative, useApi, useFlash } from '@/composables'
import { DsDataTable, DsPage, DsStatTile, type CardField } from '@/ds'

import {
  deleteLevel,
  fetchAdminLevels,
  setLevelActive,
  type AdminEducationLevelListItem,
} from '../api/admin-subjects-levels'
import { DsLoadError, DsRowActions, type RowAction } from '@/ds'
import {
  COPY,
  LEVEL_ROUTES,
  STAGE_LABELS,
  errorLines,
  isNetworkFailure,
} from '../lib/subjects-levels'

const flash = useFlash()

const { data, error, reload } = useApi((signal) => fetchAdminLevels({ signal }))

/** Local copy so the switch can flip before the server answers. */
const rows = ref<AdminEducationLevelListItem[]>([])
watch(data, (result) => {
  rows.value = result ? result.data.map((row) => ({ ...row })) : []
})
type LevelRow = AdminEducationLevelListItem & Record<string, unknown>
const tableRows = computed(() => rows.value as LevelRow[])
const kpi = computed(() => ({
  active: rows.value.filter((r) => r.isActive).length,
  subjects: rows.value.reduce((sum, r) => sum + r.subjectCount, 0),
  questions: rows.value.reduce((sum, r) => sum + r.questionCount, 0),
}))

const columns: TableColumn<LevelRow>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'name', header: 'Nama (BM)' },
  { accessorKey: 'nameEn', header: 'Nama (EN)' },
  { accessorKey: 'code', header: 'Kod' },
  { accessorKey: 'stage', header: 'Peringkat' },
  { accessorKey: 'curriculum', header: 'Kurikulum' },
  { accessorKey: 'questionCount', header: 'Soalan' },
  { accessorKey: 'subjectCount', header: 'Subjek' },
  { accessorKey: 'isActive', header: 'Aktif?' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'code', label: 'Kod' },
  { key: 'nameEn', label: 'Nama (EN)' },
  { key: 'curriculum', label: 'Kurikulum' },
]

const STAGE_ICON = {
  primary: 'i-ph-baby',
  lower_secondary: 'i-ph-book-open-text',
  upper_secondary: 'i-ph-graduation-cap',
} as const

/** Rows whose PATCH is in flight: further clicks on them are ignored (no race). */
const switching = new Set<number>()

async function toggle(row: AdminEducationLevelListItem): Promise<void> {
  if (switching.has(row.id)) return
  switching.add(row.id)
  const next = !row.isActive
  row.isActive = next
  try {
    await setLevelActive(row.id, next)
  } catch (err) {
    row.isActive = !next
    alertNative(isNetworkFailure(err) ? COPY.networkError : COPY.switchFailed)
  } finally {
    switching.delete(row.id)
  }
}

const deleting = ref(false)

/** Edit stays one click away; the menu holds the destructive "Padam" (confirmed first). */
function rowActions(row: AdminEducationLevelListItem): RowAction[] {
  return [
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      to: { name: LEVEL_ROUTES.edit, params: { id: row.id } },
      testid: 'level-edit',
    },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: deleting.value,
      testid: 'level-delete',
      confirm: { title: 'Padam Tahap?', body: COPY.confirmDeleteLevel, confirmLabel: 'Padam' },
      onSelect: () => void remove(row),
    },
  ]
}

/** The confirmation ran in `DsRowActions` (live message); this only calls the API. */
async function remove(row: AdminEducationLevelListItem): Promise<void> {
  if (deleting.value) return
  deleting.value = true
  try {
    const result = await deleteLevel(row.id)
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
  <DsPage data-testid="levels-page">
    <DsLoadError
      v-if="error"
      :message="COPY.loadFailed"
      testid="levels-error"
      @retry="reload()"
    />

    <template v-else-if="data">
      <AdminPageHeader>
        <template #subtitle>
          <div>
            <h2 class="text-subheading text-highlighted">Senarai Tahap Pendidikan</h2>
            <p class="text-body text-muted" data-testid="levels-count">
              Jumlah: {{ rows.length }} tahap
            </p>
          </div>
        </template>
        <template #actions>
          <UButton :to="{ name: LEVEL_ROUTES.create }" icon="i-ph-plus" data-testid="levels-add">
            Tambah Tahap
          </UButton>
        </template>
      </AdminPageHeader>

      <AdminKpiStrip label="Ringkasan tahap" class="xl:grid-cols-4 2xl:grid-cols-4">
        <DsStatTile compact :value="rows.length" unit="Jumlah Tahap" icon="i-ph-graduation-cap" />
        <DsStatTile
          compact
          accent="win"
          :value="kpi.active"
          unit="Aktif"
          icon="i-ph-check-circle"
        />
        <DsStatTile compact accent="friend" :value="kpi.subjects" unit="Subjek" icon="i-ph-books" />
        <DsStatTile
          compact
          accent="trial"
          :value="kpi.questions"
          unit="Jumlah Soalan"
          icon="i-ph-question"
        />
      </AdminKpiStrip>

      <DsDataTable
        :data="tableRows"
        :columns="columns"
        caption="Senarai tahap pendidikan"
        compact-cells
        :page-size="Math.max(tableRows.length, 1)"
        card-title="name"
        :card-fields="cardFields"
        data-testid="levels-table"
      >
        <template #code-cell="{ row }">
          <UBadge color="neutral" variant="subtle" :label="row.original.code" />
        </template>
        <template #stage-cell="{ row }">
          <UBadge
            color="neutral"
            variant="subtle"
            :icon="STAGE_ICON[row.original.stage]"
            :label="STAGE_LABELS[row.original.stage]"
            data-testid="level-stage"
          />
        </template>
        <template #questionCount-cell="{ row }">
          <UBadge
            color="warning"
            variant="subtle"
            :label="`${row.original.questionCount} soalan`"
            data-testid="level-questions"
          />
        </template>
        <template #subjectCount-cell="{ row }">
          <UBadge
            color="success"
            variant="subtle"
            :label="`${row.original.subjectCount} subjek`"
            data-testid="level-subjects"
          />
        </template>
        <template #isActive-cell="{ row }">
          <span class="inline-flex min-h-11 min-w-11 items-center justify-center">
            <USwitch
              :model-value="row.original.isActive"
              aria-label="Aktif"
              color="success"
              data-testid="level-switch"
              @update:model-value="toggle(row.original)"
            />
          </span>
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="rowActions(row.original)" :inline="1" testid="level-more" />
        </template>
        <template #card-actions="{ row }">
          <div class="flex items-center gap-1">
            <span class="inline-flex min-h-11 min-w-11 items-center justify-center">
              <USwitch
                :model-value="row.isActive as boolean"
                aria-label="Aktif"
                color="success"
                @update:model-value="toggle(row as AdminEducationLevelListItem)"
              />
            </span>
            <DsRowActions
              :actions="rowActions(row as AdminEducationLevelListItem)"
              :inline="1"
              testid="level-more"
            />
          </div>
        </template>
      </DsDataTable>
    </template>
  </DsPage>
</template>
