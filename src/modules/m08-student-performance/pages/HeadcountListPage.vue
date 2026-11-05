<script setup lang="ts">
/**
 * S12 `/headcount` "Headcount" (M08-T6; FR-M08-75…81, FR-M08-122, BR-M08-21). The viewer's own configs
 * newest first (the admin and the school admin own none: the empty state, OD-R3); the Auto-Setup dialog
 * creates configs for the ticked levels. The table (cards below `md`) is PROPOSED (UNVERIFIED L-4, OQ-M08-03).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { DsDataTable, DsEmptyState, DsLoadError, DsPage, DsPageHeader } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { fetchHeadcounts, HEADCOUNT_CENTRAL_EMPTY } from '../api/headcount'
import AutoSetupModal from '../components/headcount/AutoSetupModal.vue'
import { useHeadcountReadOnly } from '../lib/headcount-access'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

/**
 * Central view (M17 `/admin/laporan-sekolah/headcount`, S6-T13 PM-24): `schoolId` is the school Admin Pusat picked
 * (sent as `?schoolId=`). The list is read-only, as the school admin's. Without it the list is the viewer's own.
 */
const props = defineProps<{ schoolId?: number | string }>()
const central = computed(() => props.schoolId !== undefined)
const session = useSessionStore()
// the API lists one school for the admin: without a picked school the admin owns none (the empty state, OD-R3)
const { data, error, reload } = useRouteData(
  async (signal) =>
    session.role === 'admin' && !central.value
      ? []
      : fetchHeadcounts({ schoolId: props.schoolId, signal }),
  [() => props.schoolId],
  { skipNotFound: props.schoolId !== undefined },
)
const showAutoSetup = ref(false)
/** The school admin reads the school's list: no create / Auto-Setup (R1-AS-3). The central view too. */
const schoolAdminReadOnly = useHeadcountReadOnly()
const readOnly = computed(() => schoolAdminReadOnly.value || central.value)
/** An unknown school (404) or a refused `schoolId` (422): the M-07 empty copy. */
const missing = computed(
  () => central.value && isApiError(error.value) && (error.value.status === 404 || error.value.status === 422),
)
/** "Guru" (API-AS-15): the owner of a config; the teacher's own list is all theirs, so no column there. */
const showTeacher = computed(() => session.role === 'school_admin' || session.role === 'admin')

interface Row extends Record<string, unknown> {
  id: number
  className: string
  subjectName: string
  levelYear: string
  modeText: string
  otrText: string
  studentsText: string
  teacherName: string
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
    teacherName: c.teacherName,
  })),
)
const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'className', header: 'Kelas' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'levelYear', header: 'Tingkatan' },
  ...(showTeacher.value ? [{ accessorKey: 'teacherName', header: 'Guru' }] : []),
  { accessorKey: 'modeText', header: 'Mod' },
  { accessorKey: 'otrText', header: 'OTR' },
  { accessorKey: 'studentsText', header: 'Murid' },
])
const cardFields = computed(() => [
  { key: 'subjectName', label: 'Subjek' },
  { key: 'levelYear', label: 'Tingkatan' },
  ...(showTeacher.value ? [{ key: 'teacherName', label: 'Guru' }] : []),
  { key: 'modeText', label: 'Mod' },
  { key: 'otrText', label: 'OTR' },
  { key: 'studentsText', label: 'Murid' },
])
</script>

<template>
  <DsPage data-testid="headcount-list-page">
    <DsPageHeader
      title="Headcount"
      subtitle="Tracking prestasi murid — TOV, OTR, AR & RS"
      data-testid="headcount-hero"
    >
      <template #actions>
        <UButton
          v-if="!central"
          to="/headcount/dashboard"
          color="neutral"
          variant="soft"
          icon="i-ph-gauge"
          label="Dashboard"
          data-testid="hero-dashboard"
        />
        <UButton
          v-if="!readOnly"
          to="/headcount/create"
          icon="i-ph-plus"
          label="Buat Baru"
          data-testid="hero-create"
        />
        <UButton
          v-if="!readOnly"
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-magic-wand"
          label="Auto-Setup"
          data-testid="hero-auto-setup"
          @click="showAutoSetup = true"
        />
      </template>
    </DsPageHeader>

    <DsEmptyState
      v-if="missing"
      :title="HEADCOUNT_CENTRAL_EMPTY"
      icon="buildings"
      data-testid="headcount-central-empty"
    />
    <DsLoadError v-else-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div v-if="data.length === 0" data-testid="headcount-empty">
        <DsEmptyState title="Belum ada headcount." icon="clipboard-text">
          <template v-if="!readOnly" #actions>
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

    <AutoSetupModal v-if="!readOnly" v-model:open="showAutoSetup" @done="reload()" />
  </DsPage>
</template>
