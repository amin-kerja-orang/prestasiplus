<script setup lang="ts">
/**
 * S12 `/headcount` "Headcount" (M08-T6; FR-M08-75…81, FR-M08-122, BR-M08-21). The viewer's own configs
 * newest first (the admin and the school admin own none: the empty state, OD-R3); the Persediaan Auto dialog
 * creates configs for the ticked levels. The table (cards below `md`) is PROPOSED (UNVERIFIED L-4, OQ-M08-03).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { DsDataTable, DsEmptyState, DsLoadError, DsPage, DsPageHeader } from '@/ds'

import { fetchHeadcounts } from '../api/headcount'
import AutoSetupModal from '../components/headcount/AutoSetupModal.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchHeadcounts({ signal }))
const showAutoSetup = ref(false)

interface Row extends Record<string, unknown> {
  id: number
  className: string
  subjectName: string
  levelYear: string
  modeText: string
  otrText: string
  studentsText: string
}
const rows = computed<Row[]>(() =>
  (data.value ?? []).map((c) => ({
    id: c.id,
    className: c.className,
    subjectName: c.subjectName,
    levelYear: `${c.levelName} · ${String(c.year)}`,
    modeText: c.mode === 'auto' ? 'Auto' : 'Manual',
    otrText: `${String(c.activeOtrs)} OTR`,
    studentsText: `${String(c.students)} murid`,
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'className', header: 'Kelas' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'levelYear', header: 'Tingkatan' },
  { accessorKey: 'modeText', header: 'Mod' },
  { accessorKey: 'otrText', header: 'OTR' },
  { accessorKey: 'studentsText', header: 'Murid' },
]
const cardFields = [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelYear', label: 'Tingkatan' },
  { key: 'modeText', label: 'Mod' },
  { key: 'otrText', label: 'OTR' },
  { key: 'studentsText', label: 'Murid' },
]
</script>

<template>
  <DsPage data-testid="headcount-list-page">
    <DsPageHeader
      title="Headcount"
      subtitle="Penjejakan prestasi murid — TOV, OTR, AR & RS"
      data-testid="headcount-hero"
    >
      <template #actions>
        <UButton
          to="/headcount/dashboard"
          color="neutral"
          variant="soft"
          icon="i-ph-gauge"
          label="Dashboard"
          data-testid="hero-dashboard"
        />
        <UButton
          to="/headcount/create"
          icon="i-ph-plus"
          label="Buat Baru"
          data-testid="hero-create"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-magic-wand"
          label="Persediaan Auto"
          data-testid="hero-auto-setup"
          @click="showAutoSetup = true"
        />
      </template>
    </DsPageHeader>

    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div v-if="data.length === 0" data-testid="headcount-empty">
        <DsEmptyState title="Belum ada headcount." icon="clipboard-text">
          <template #actions>
            <UButton
              to="/headcount/create"
              icon="i-ph-plus"
              label="Buat Sekarang"
              data-testid="headcount-create-now"
            />
          </template>
        </DsEmptyState>
      </div>

      <div v-else data-testid="headcount-list">
        <DsDataTable
          :data="rows"
          :columns="columns"
          caption="Senarai headcount"
          card-title="className"
          :card-fields="cardFields"
          :page-size="100"
        >
          <template #className-cell="{ row }">
            <RouterLink
              :to="`/headcount/${String(row.original.id)}`"
              class="inline-flex min-h-11 items-center text-label text-highlighted"
              :data-testid="`headcount-card-${String(row.original.id)}`"
              >{{ row.original.className }}</RouterLink
            >
          </template>
          <template #modeText-cell="{ row }">
            <UBadge
              :color="row.original.modeText === 'Auto' ? 'primary' : 'neutral'"
              variant="subtle"
              :label="row.original.modeText"
            />
          </template>
          <template #card-actions="{ row }">
            <UButton
              :to="`/headcount/${String(row.id)}`"
              color="neutral"
              variant="soft"
              size="lg"
              icon="i-ph-arrow-right"
              :aria-label="`Buka ${row.className}`"
              :data-testid="`headcount-open-${String(row.id)}`"
            />
          </template>
        </DsDataTable>
      </div>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>

    <AutoSetupModal v-model:open="showAutoSetup" @done="reload()" />
  </DsPage>
</template>
