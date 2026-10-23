<script setup lang="ts">
/** Pembina Kertas (`/admin/spm/kertas`): the papers assembled by the admin, draft and published. */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { DsDataTable, DsLoadError, DsPage, DsStatRow, DsStatusBadge, type StatItem } from '@/ds'

import type { AdminPaperSummary } from '../../domain/admin-types'
import { formatDateTime } from '../../lib/use-bijak'
import { bijakServer } from '../../server/client'
import { ADMIN_ROUTES, detailMessage } from './ui'

type Row = AdminPaperSummary & Record<string, unknown>

const server = bijakServer()
const router = useRouter()
const flash = useFlash()
const { data, error, loading, reload } = useApi(() => server.listAdminPapers())
const rows = computed(() => (data.value ?? []) as Row[])

const stats = computed<StatItem[]>(() => [
  { key: 'all', label: 'Jumlah kertas', value: rows.value.length, icon: 'scroll' },
  {
    key: 'draf',
    label: 'Draf',
    value: rows.value.filter((r) => r.status === 'draf').length,
    icon: 'pencil-simple',
  },
  {
    key: 'terbit',
    label: 'Diterbitkan',
    value: rows.value.filter((r) => r.status === 'terbit').length,
    icon: 'upload-simple',
    accent: 'win',
  },
])

const columns: TableColumn<Row>[] = [
  { accessorKey: 'title', header: 'Kertas' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'questionCount', header: 'Soalan' },
  { accessorKey: 'marks', header: 'Markah' },
  { accessorKey: 'ok', header: 'Blueprint' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'updatedAt', header: 'Dikemas kini' },
  { id: 'actions', header: 'Tindakan' },
]

function open(row: Row): void {
  void router.push({ name: ADMIN_ROUTES.paperEdit, params: { id: row.id } })
}

async function remove(row: Row): Promise<void> {
  try {
    await server.deletePaper(row.id)
    flash.show({ type: 'success', message: 'Kertas dipadam.' })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: detailMessage(e) })
  }
}
</script>

<template>
  <DsPage layout="list" data-testid="papers-page">
    <template #subtitle>
      <p class="text-body text-muted">
        Bina kertas SPM mengikut blueprint dari bank soalan, kemudian terbitkan ke Bijak SPM.
      </p>
    </template>
    <template #actions>
      <UButton
        icon="i-ph-plus"
        label="Kertas Baharu"
        class="min-h-11"
        :to="{ name: ADMIN_ROUTES.paperNew }"
        data-testid="paper-new"
      />
    </template>

    <DsStatRow :items="stats" density="compact" :cols="3" aria-label="Ringkasan kertas" />

    <DsLoadError v-if="error" message="Tidak dapat memuatkan senarai kertas." @retry="reload()" />
    <DsDataTable
      v-else
      :data="rows"
      :columns="columns"
      caption="Senarai kertas"
      variant="flush"
      density="compact"
      :loading="loading && !data"
      empty-title="Belum ada kertas"
      empty-description="Tekan Kertas Baharu untuk mula."
      card-title="title"
      :card-fields="[
        { key: 'subjectName', label: 'Subjek' },
        { key: 'marks', label: 'Markah', cell: true },
        { key: 'status', label: 'Status', cell: true, wide: true },
        { key: 'ok', label: 'Blueprint', cell: true, wide: true },
      ]"
      :page-size="20"
      row-key="id"
      data-testid="papers-table"
      @row-click="open"
    >
      <template #title-cell="{ row }">
        <div class="flex flex-col">
          <span class="text-body text-default">{{ row.original.title }}</span>
          <span class="text-caption text-muted"
            >{{ row.original.code }} · Kertas {{ row.original.kertas }}</span
          >
        </div>
      </template>
      <template #marks-cell="{ row }"
        >{{ row.original.marks }} / {{ row.original.budget }}</template
      >
      <template #ok-cell="{ row }">
        <UBadge
          :color="row.original.ok ? 'success' : 'warning'"
          variant="subtle"
          :icon="row.original.ok ? 'i-ph-check-circle' : 'i-ph-warning'"
          :label="row.original.ok ? 'Sepadan' : 'Belum sepadan'"
        />
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="row.original.status === 'terbit' ? 'published' : 'draft'" />
      </template>
      <template #updatedAt-cell="{ row }">{{ formatDateTime(row.original.updatedAt) }}</template>
      <template #actions-cell="{ row }">
        <div class="flex gap-1">
          <UButton
            size="sm"
            icon="i-ph-pencil-simple"
            label="Buka"
            class="min-h-11"
            :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: row.original.id } }"
            :data-testid="`paper-open-${row.original.id}`"
          />
          <UButton
            v-if="row.original.status === 'draf'"
            size="sm"
            color="error"
            variant="ghost"
            icon="i-ph-trash"
            aria-label="Padam kertas"
            class="min-h-11 min-w-11"
            @click.stop="remove(row.original)"
          />
        </div>
      </template>
      <template #card-actions="{ row }">
        <div class="flex flex-col gap-1">
          <UButton
            size="sm"
            icon="i-ph-pencil-simple"
            label="Buka"
            class="min-h-11"
            :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: row.id } }"
            :data-testid="`paper-open-${row.id}`"
          />
          <UButton
            v-if="row.status === 'draf'"
            size="sm"
            color="error"
            variant="ghost"
            icon="i-ph-trash"
            aria-label="Padam kertas"
            class="min-h-11 min-w-11"
            @click.stop="remove(row)"
          />
        </div>
      </template>
    </DsDataTable>
  </DsPage>
</template>
