<script setup lang="ts">
/**
 * S6 `/admin/comp-students` "Pelajar Komplimen - Admin Panel" (M02-T7; FR-M02-65…69), v2 staff theme.
 *
 * Header summary "Syiling OFF: {n} / {total} pelajar komplimen" + "Daftar Baru", three KPI tiles, the
 * sticky bulk bar (shown while a row is ticked: "{n} dipilih", four immediate actions without
 * confirmation, "Batal pilihan") and `AdminTable` of 50 rows per page (cards below `md`). After a bulk
 * action the same page reloads, the selection is cleared and the API `status` is the success flash
 * (UNVERIFIED COPY).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsIdentity,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import {
  bulkCompAction,
  fetchCompStudents,
  type CompBulkAction,
  type CompStudentListItem,
} from '../api/comp-students'
import {
  BULK_BUTTONS,
  COMP_CREATE_PATH,
  COMP_LIST_PATH,
  coinsColor,
  compDetailPath,
} from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import { formatUserDate } from '../lib/user-list'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const page = computed(() => {
  const raw = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
  return Math.max(1, Number.parseInt(raw ?? '', 10) || 1)
})

const { data, error, reload } = useApi(
  (signal) => fetchCompStudents({ page: page.value, signal }),
  () => route.query.page,
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
type CompRow = CompStudentListItem & Record<string, unknown>
const tableRows = computed(() => rows.value as CompRow[])
const stats = computed<StatItem[]>(() => {
  const k = counts.value
  if (!k) return []
  return [
    {
      key: 'total',
      label: 'Pelajar Komplimen',
      value: formatNumber(k.total),
      icon: 'graduation-cap',
    },
    {
      key: 'off',
      label: 'Syiling OFF',
      value: formatNumber(k.coinsOff),
      icon: 'prohibit',
      accent: 'heat',
    },
    {
      key: 'on',
      label: 'Syiling ON',
      value: formatNumber(k.total - k.coinsOff),
      icon: 'coins',
      accent: 'trial',
    },
  ]
})

function goToPage(next: number): void {
  void router.push({ path: COMP_LIST_PATH, query: { page: String(next) } })
}

// --- Selection (FR-M02-67): a page change clears it.
const selected = ref<number[]>([])
const pageIds = computed(() => rows.value.map((r) => r.id))
const allSelected = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selected.value.includes(id)),
)
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)

function toggleAll(checked: boolean | 'indeterminate'): void {
  selected.value = checked === true ? [...pageIds.value] : []
}
function toggleOne(id: number, checked: boolean | 'indeterminate'): void {
  selected.value =
    checked === true
      ? [...selected.value.filter((v) => v !== id), id]
      : selected.value.filter((v) => v !== id)
}

const busy = ref(false)
const runningAction = ref<CompBulkAction | null>(null)

async function runBulk(action: CompBulkAction): Promise<void> {
  if (busy.value || selected.value.length === 0) return
  busy.value = true
  runningAction.value = action
  try {
    const result = await bulkCompAction(action, selected.value)
    selected.value = []
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
    runningAction.value = null
  }
}

const COLUMNS: TableColumn<CompRow>[] = [
  { id: 'select', header: '' },
  { id: 'name', header: 'Nama' },
  { id: 'ic', header: 'IC' },
  { id: 'school', header: 'Sekolah' },
  { id: 'class', header: 'Kelas / Cikgu' },
  { id: 'account', header: 'Akaun' },
  { id: 'coins', header: 'Syiling' },
  { id: 'expiry', header: 'Pakej tamat' },
]
</script>

<template>
  <DsPage title="Pelajar Komplimen" data-testid="comp-list-page">
    <template #subtitle>
      <p v-if="counts" class="text-body text-muted" data-testid="comp-summary">
        Syiling OFF: <strong class="text-highlighted">{{ counts.coinsOff }}</strong> /
        {{ counts.total }} pelajar komplimen
      </p>
    </template>
    <template #actions>
      <UButton
        :to="COMP_CREATE_PATH"
        icon="i-ph-user-plus"
        label="Daftar Baru"
        data-testid="comp-add"
      />
    </template>

    <DsStatRow
      :items="stats"
      :loading="counts === null"
      :cols="3"
      aria-label="Ringkasan pelajar komplimen"
    />

    <!-- Sticky bulk bar (FR-M02-67): only while at least one row is ticked. -->
    <DsPanel v-if="selected.length > 0" behavior="bulk" data-testid="comp-bulk-bar">
      <div class="flex flex-wrap items-center gap-3">
        <span class="mr-2 text-body text-highlighted">
          <span data-testid="comp-selected-count">{{ selected.length }}</span> dipilih
        </span>
        <UButton
          v-for="b in BULK_BUTTONS"
          :key="b.action"
          type="button"
          :color="b.color"
          variant="soft"
          :icon="b.icon"
          :label="b.label"
          :loading="runningAction === b.action"
          :disabled="busy"
          :data-testid="`comp-bulk-${b.action}`"
          @click="runBulk(b.action)"
        />
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          label="Batal pilihan"
          data-testid="comp-bulk-clear"
          @click="selected = []"
        />
      </div>
    </DsPanel>

    <DsLoadError
      v-if="error"
      message="Tidak dapat memuatkan senarai pelajar komplimen. Sila cuba semula."
      testid="comp-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="firstLoad" padding="none" data-testid="comp-table">
      <div class="flex flex-col gap-3 p-4">
        <USkeleton v-for="n in 5" :key="n" class="h-12 w-full" data-testid="comp-skeleton" />
      </div>
    </DsPanel>

    <DsDataTable
      v-else
      :data="tableRows"
      :columns="COLUMNS"
      variant="flush"
      caption="Senarai pelajar komplimen"
      :total="data?.meta.totalItems ?? 0"
      :page="data?.meta.page ?? 1"
      :page-size="data?.meta.pageSize ?? 50"
      data-testid="comp-table"
      @update:page="goToPage"
    >
      <template #select-header>
        <UCheckbox
          :model-value="allSelected"
          aria-label="Pilih semua"
          data-testid="comp-select-all"
          @update:model-value="toggleAll"
        />
      </template>
      <template #select-cell="{ row }">
        <UCheckbox
          :model-value="selected.includes(row.original.id)"
          :aria-label="`Pilih ${row.original.name}`"
          data-testid="comp-select"
          @update:model-value="(v: boolean | 'indeterminate') => toggleOne(row.original.id, v)"
        />
      </template>
      <template #name-cell="{ row }">
        <DsIdentity :name="row.original.name" :sub="row.original.username">
          <template #name>
            <RouterLink
              :to="compDetailPath(row.original.id)"
              class="text-primary-t"
              data-testid="comp-name"
              >{{ row.original.name }}</RouterLink
            >
          </template>
        </DsIdentity>
      </template>
      <template #ic-cell="{ row }">
        <span class="text-nowrap text-muted">{{ row.original.icNumber ?? '' }}</span>
      </template>
      <template #school-cell="{ row }">
        <span class="block max-w-32 break-words whitespace-normal" data-testid="comp-school">{{
          row.original.schoolName ?? ''
        }}</span>
      </template>
      <template #class-cell="{ row }">
        <div class="flex min-w-0 flex-col">
          <span class="text-nowrap text-highlighted">{{ row.original.classLabel }}</span>
          <span
            class="block max-w-36 text-label break-words whitespace-normal text-muted"
            data-testid="comp-teacher"
            >{{ row.original.teacherName }}</span
          >
        </div>
      </template>
      <template #account-cell="{ row }">
        <DsStatusBadge
          :status="row.original.isActive ? 'active' : 'inactive'"
          data-testid="comp-account"
        />
      </template>
      <template #coins-cell="{ row }">
        <UBadge
          :color="coinsColor(row.original.coinsEnabled)"
          variant="subtle"
          :label="row.original.coinsEnabled ? 'ON' : 'OFF'"
          data-testid="comp-coins"
        />
      </template>
      <template #expiry-cell="{ row }">
        <span class="text-nowrap">{{ formatUserDate(row.original.packageExpiresAt) }}</span>
      </template>
      <template #empty>
        <!-- Empty page (FR-M02-69). -->
        <p class="px-4 py-12 text-center text-body text-muted" data-testid="comp-empty">
          Tiada pelajar komplimen lagi.
          <RouterLink :to="COMP_CREATE_PATH" class="text-primary-t" data-testid="comp-empty-link"
            >Daftar baru.</RouterLink
          >
        </p>
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 items-start gap-3">
          <UCheckbox
            :model-value="selected.includes(row.id as number)"
            :aria-label="`Pilih ${row.name as string}`"
            data-testid="comp-select"
            @update:model-value="(v: boolean | 'indeterminate') => toggleOne(row.id as number, v)"
          />
          <div class="flex min-w-0 flex-col gap-1">
            <RouterLink
              :to="compDetailPath(row.id as number)"
              class="text-primary-t"
              data-testid="comp-name"
              >{{ row.name }}</RouterLink
            >
            <span class="text-label text-muted">{{ row.classLabel }} · {{ row.teacherName }}</span>
            <div class="flex flex-wrap items-center gap-2">
              <DsStatusBadge :status="row.isActive ? 'active' : 'inactive'" />
              <UBadge
                :color="coinsColor(row.coinsEnabled as boolean)"
                variant="subtle"
                :label="row.coinsEnabled ? 'ON' : 'OFF'"
              />
            </div>
          </div>
        </div>
      </template>
    </DsDataTable>
  </DsPage>
</template>
