<script setup lang="ts">
/**
 * S9 `/admin/schools` "Urus Sekolah - Admin PRESTASIPLUS" (M02-T8; FR-M02-76..79, FR-M02-18), v2 staff theme.
 *
 * - Three stat tiles (totals over all schools, unaffected by the filters) and the "Tambah Sekolah" button.
 * - Filter bar (`search`, `state`, `type`); "Set Semula" clears the filters. The query string is the
 *   state: the form navigates, the list follows the route.
 * - 30 rows per page, name A-Z; the pager keeps the filters. Edit link and an icon-only toggle button
 *   (no confirmation); after a toggle the list reloads with the same filters and the success flash
 *   (UNVERIFIED COPY, from the API `status`).
 * - The table scrolls inside its card from `md`; below `md` every school is a card (`AdminTable`).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
  DsCluster,
  DsText,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchAdminSchools, toggleSchool, type AdminSchool } from '../api/schools-admin'
import { errorLines } from '../lib/school-errors'
import { SCHOOL_ROUTES, SCHOOLS_LIST_PATH, SCHOOL_STATE_OPTIONS } from '../lib/school-options'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  state: queryText(route.query.state),
  type: queryText(route.query.type),
  page: Math.max(1, Number.parseInt(queryText(route.query.page), 10) || 1),
}))

// Draft values of the form controls; re-synced when the URL changes (back/forward, reset).
const search = ref(queryText(route.query.search))
const state = ref(queryText(route.query.state))
const type = ref(queryText(route.query.type))
watch(
  () => [route.query.search, route.query.state, route.query.type] as const,
  ([s, st, ty]) => {
    search.value = queryText(s)
    state.value = queryText(st)
    type.value = queryText(ty)
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminSchools({
      search: applied.value.search || null,
      state: applied.value.state || null,
      type: applied.value.type || null,
      page: applied.value.page,
      signal,
    }),
  [
    () => route.query.search,
    () => route.query.state,
    () => route.query.type,
    () => route.query.page,
  ],
)

const rows = computed<AdminSchool[]>(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const types = computed<string[]>(() => data.value?.meta.types ?? [])
const firstLoad = computed(() => data.value === null && error.value === null)
/** Removable chips of the applied filters (the URL is the source of truth). */
const chips = computed<{ key: string; label: string }[]>(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.state !== '') out.push({ key: 'state', label: applied.value.state })
  if (applied.value.type !== '') out.push({ key: 'type', label: applied.value.type })
  return out
})

async function removeChip(key: string): Promise<void> {
  const query: Record<string, string> = {}
  if (applied.value.search !== '') query.search = applied.value.search
  if (applied.value.state !== '' && key !== 'state') query.state = applied.value.state
  if (applied.value.type !== '' && key !== 'type') query.type = applied.value.type
  await router.push({ path: SCHOOLS_LIST_PATH, query })
}
/** Filters in force (search counts as one), for the reset button and the mobile badge. */
const activeCount = computed(() => chips.value.length + (applied.value.search !== '' ? 1 : 0))

/** Filter values as the query string of the GET form (empty values dropped, page reset). */
function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  const s = search.value.trim()
  if (s !== '') out.search = s
  if (state.value !== '') out.state = state.value
  if (type.value !== '') out.type = type.value
  return out
}

function sameQuery(next: Record<string, string>): boolean {
  const current: Record<string, string> = {}
  if (applied.value.search !== '') current.search = applied.value.search
  if (applied.value.state !== '') current.state = applied.value.state
  if (applied.value.type !== '') current.type = applied.value.type
  return (
    applied.value.page === 1 &&
    JSON.stringify(current) === JSON.stringify(next) &&
    !route.query.page
  )
}

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  // Submitting the same filter reloads the page, as a live GET form does.
  if (sameQuery(query)) await reload()
  else await router.push({ path: SCHOOLS_LIST_PATH, query })
}

async function resetFilter(): Promise<void> {
  search.value = ''
  state.value = ''
  type.value = ''
  await submitFilter()
}

const pagerQuery = computed(() => ({
  search: applied.value.search,
  state: applied.value.state,
  type: applied.value.type,
}))

function goToPage(page: number): void {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(pagerQuery.value)) if (value !== '') query[key] = value
  void router.push({ path: SCHOOLS_LIST_PATH, query: { ...query, page: String(page) } })
}

// FR-M02-79: POST the toggle, then reload the list (filters and page kept) with the flash.
const toggling = ref<number | null>(null)

async function toggle(school: AdminSchool): Promise<void> {
  if (toggling.value !== null) return
  toggling.value = school.id
  try {
    const result = await toggleSchool(school.id)
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    toggling.value = null
  }
}

type SchoolRow = AdminSchool & Record<string, unknown>
const tableRows = computed(() => rows.value as SchoolRow[])
const stats = computed<StatItem[]>(() => {
  const k = counts.value
  if (!k) return []
  return [
    { key: 'total', label: 'Jumlah Sekolah', value: formatNumber(k.total), icon: 'buildings' },
    {
      key: 'active',
      label: 'Aktif',
      value: formatNumber(k.active),
      icon: 'check-circle',
      accent: 'win',
    },
    {
      key: 'inactive',
      label: 'Tidak Aktif',
      value: formatNumber(k.inactive),
      icon: 'pause-circle',
      accent: 'heat',
    },
  ]
})
const COLUMNS: TableColumn<SchoolRow>[] = [
  { accessorKey: 'name', header: 'Nama Sekolah' },
  { accessorKey: 'code', header: 'Kod' },
  { accessorKey: 'type', header: 'Jenis' },
  { accessorKey: 'state', header: 'Negeri' },
  { accessorKey: 'district', header: 'Daerah' },
  { accessorKey: 'studentCount', header: 'Pelajar' },
  { accessorKey: 'teacherCount', header: 'Guru' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]
</script>

<template>
  <DsPage
    title="Urus Sekolah"
    subtitle="Senarai sekolah berdaftar, status dan bilangan pelajar serta guru."
    data-testid="schools-page"
  >
    <template #actions>
      <UButton
        :to="{ name: SCHOOL_ROUTES.create }"
        icon="i-ph-plus"
        label="Tambah Sekolah"
        data-testid="schools-add"
      />
    </template>

    <DsStatRow
      prefix="schools-stat"
      :items="stats"
      :loading="counts === null"
      density="compact"
      :cols="3"
      aria-label="Ringkasan sekolah"
    />

    <DsFilterBar
      :chips="chips"
      :active-count="activeCount"
      data-testid="schools-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari nama atau kod sekolah..."
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:flex-1"
          data-testid="schools-search"
        />
      </template>
      <DsNativeSelect
        v-model="state"
        name="state"
        aria-label="Negeri"
        class="md:w-48"
        data-testid="schools-state"
      >
        <option value="">Semua Negeri</option>
        <option v-for="name in SCHOOL_STATE_OPTIONS" :key="name" :value="name">{{ name }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        v-model="type"
        name="type"
        aria-label="Jenis"
        class="md:w-48"
        data-testid="schools-type"
      >
        <option value="">Semua Jenis</option>
        <option v-for="name in types" :key="name" :value="name">{{ name }}</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsLoadError
      v-if="error"
      message="Tidak dapat memuatkan senarai sekolah. Sila cuba semula."
      testid="schools-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="firstLoad" padding="none" data-testid="schools-table">
      <div class="flex flex-col gap-3 p-4">
        <USkeleton v-for="n in 5" :key="n" class="h-12 w-full" data-testid="schools-skeleton" />
      </div>
    </DsPanel>

    <DsDataTable
      v-else
      :data="tableRows"
      :columns="COLUMNS"
      variant="flush"
      caption="Senarai sekolah"
      :total="data?.meta.totalItems ?? 0"
      :page="data?.meta.page ?? 1"
      :page-size="data?.meta.pageSize ?? 30"
      card-title="name"
      data-testid="schools-table"
      @update:page="goToPage"
    >
      <template #name-cell="{ row }">
        <DsText
          variant="body"
          as="span"
          tone="highlighted"
          class="block max-w-72 whitespace-normal"
          data-testid="school-row"
          :data-school-id="row.original.id"
          >{{ row.original.name }}</DsText
        >
      </template>
      <template #code-cell="{ row }">
        <DsText variant="label" tone="muted" class="text-nowrap">{{ row.original.code }}</DsText>
      </template>
      <template #type-cell="{ row }">
        <UBadge color="neutral" variant="subtle" :label="row.original.type" />
      </template>
      <template #state-cell="{ row }">
        <span class="text-nowrap">{{ row.original.state }}</span>
      </template>
      <template #district-cell="{ row }">
        <DsText variant="label" tone="muted">{{ row.original.district }}</DsText>
      </template>
      <template #studentCount-cell="{ row }">
        <span :class="row.original.studentCount > 0 ? 'text-highlighted' : 'text-dimmed'">{{
          formatNumber(row.original.studentCount)
        }}</span>
      </template>
      <template #teacherCount-cell="{ row }">
        <span :class="row.original.teacherCount > 0 ? 'text-highlighted' : 'text-dimmed'">{{
          formatNumber(row.original.teacherCount)
        }}</span>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          :status="row.original.isActive ? 'active' : 'inactive'"
          data-testid="school-status"
        />
      </template>
      <template #actions-cell="{ row }">
        <DsCluster gap="xs" justify="end" :wrap="false">
          <UButton
            :to="{ name: SCHOOL_ROUTES.edit, params: { id: row.original.id } }"
            color="neutral"
            variant="soft"
            icon="i-ph-pencil-simple"
            title="Edit"
            aria-label="Edit"
            data-testid="school-edit"
          />
          <form method="post" @submit.prevent="toggle(row.original)">
            <UButton
              type="submit"
              color="neutral"
              variant="soft"
              :title="row.original.isActive ? 'Nyahaktif' : 'Aktifkan'"
              :aria-label="row.original.isActive ? 'Nyahaktif' : 'Aktifkan'"
              :loading="toggling === row.original.id"
              :disabled="toggling !== null"
              data-testid="school-toggle"
            >
              <UIcon
                v-if="toggling !== row.original.id"
                :name="row.original.isActive ? 'i-ph-toggle-right' : 'i-ph-toggle-left'"
                class="size-5"
                aria-hidden="true"
                data-testid="school-toggle-icon"
              />
            </UButton>
          </form>
        </DsCluster>
      </template>
      <template #empty>
        <DsEmptyState
          size="sm"
          icon="buildings"
          title="Tiada sekolah dijumpai"
          data-testid="schools-empty"
        />
      </template>
      <template #card="{ row }">
        <DsText variant="body" tone="highlighted" data-testid="school-row" :data-school-id="row.id">
          {{ row.name }}
        </DsText>
        <DsText variant="label" as="p" tone="muted"
          >{{ row.code }} · {{ row.type }} · {{ row.state }}</DsText
        >
        <DsCluster gap="xs" :wrap="false">
          <DsStatusBadge :status="row.isActive ? 'active' : 'inactive'" />
          <UButton
            :to="{ name: SCHOOL_ROUTES.edit, params: { id: row.id as number } }"
            color="neutral"
            variant="soft"
            icon="i-ph-pencil-simple"
            aria-label="Edit"
          />
        </DsCluster>
      </template>
    </DsDataTable>
  </DsPage>
</template>
