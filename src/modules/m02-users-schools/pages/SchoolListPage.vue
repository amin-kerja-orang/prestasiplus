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
 * - The table scrolls inside its card from `md`; below `md` every school is a card (`CardTable`).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsFilterBar, DsPage, DsStatTile } from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchAdminSchools, toggleSchool, type AdminSchool } from '../api/schools-admin'
import AdminAlert from '../components/AdminAlert.vue'
import CardCell from '../components/native/CardCell.vue'
import CardRow from '../components/native/CardRow.vue'
import CardTable from '../components/native/CardTable.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
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
const activeCount = computed(() => [state.value, type.value].filter((v) => v !== '').length)
const summary = computed(() => {
  const meta = data.value?.meta
  if (!meta || rows.value.length === 0) return ''
  const first = (meta.page - 1) * meta.pageSize + 1
  const last = Math.min(meta.page * meta.pageSize, meta.totalItems)
  return `Menunjukkan ${String(first)}-${String(last)} daripada ${String(meta.totalItems)} hasil`
})

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

const SKELETON_ROWS = 5
const COLUMNS = [
  { key: 'name', label: 'Nama Sekolah' },
  { key: 'code', label: 'Kod' },
  { key: 'type', label: 'Jenis' },
  { key: 'state', label: 'Negeri' },
  { key: 'district', label: 'Daerah' },
  { key: 'students', label: 'Pelajar' },
  { key: 'teachers', label: 'Guru' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Tindakan' },
]
</script>

<template>
  <DsPage data-testid="schools-page">
    <template #actions>
      <UButton
        :to="{ name: SCHOOL_ROUTES.create }"
        icon="i-ph-plus"
        label="Tambah Sekolah"
        data-testid="schools-add"
      />
    </template>

    <!-- Stat tiles: 2 x 2 below lg, three across from lg. -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <div data-testid="schools-stat-total">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.total)"
          unit="Jumlah Sekolah"
          icon="i-ph-buildings"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
      <div data-testid="schools-stat-active">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.active)"
          unit="Aktif"
          icon="i-ph-check-circle"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
      <div data-testid="schools-stat-inactive">
        <DsStatTile
          v-if="counts"
          :value="formatNumber(counts.inactive)"
          unit="Tidak Aktif"
          icon="i-ph-pause-circle"
        />
        <USkeleton v-else class="h-24 w-full" />
      </div>
    </section>

    <DsFilterBar
      :active-count="activeCount"
      data-testid="schools-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari nama atau kod sekolah..."
          icon="i-ph-magnifying-glass"
          size="lg"
          class="md:w-72"
          data-testid="schools-search"
        />
      </template>
      <NativeSelect
        v-model="state"
        name="state"
        aria-label="Negeri"
        class="md:w-48"
        data-testid="schools-state"
      >
        <option value="">Semua Negeri</option>
        <option v-for="name in SCHOOL_STATE_OPTIONS" :key="name" :value="name">{{ name }}</option>
      </NativeSelect>
      <NativeSelect
        v-model="type"
        name="type"
        aria-label="Jenis"
        class="md:w-48"
        data-testid="schools-type"
      >
        <option value="">Semua Jenis</option>
        <option v-for="name in types" :key="name" :value="name">{{ name }}</option>
      </NativeSelect>
    </DsFilterBar>

    <!-- Load failure: red box in place of the table + retry (design-system 7.4, INFERRED copy). -->
    <div v-if="error" class="flex flex-col gap-3" data-testid="schools-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="schools-retry" @click="reload()" />
      </div>
    </div>

    <CardTable v-else :columns="COLUMNS" caption="Senarai sekolah" data-testid="schools-table">
      <!-- Loading: skeleton rows matching the column count (design-system 7.4, INFERRED). -->
      <template v-if="firstLoad">
        <CardRow v-for="n in SKELETON_ROWS" :key="n" data-testid="schools-skeleton">
          <CardCell v-for="c in COLUMNS" :key="c.key">
            <USkeleton class="h-4 w-full max-w-32" />
          </CardCell>
        </CardRow>
      </template>

      <CardRow v-else-if="rows.length === 0" data-testid="schools-empty">
        <CardCell :colspan="COLUMNS.length">
          <UIcon name="i-ph-buildings" class="mx-auto mb-2 size-8 text-muted" aria-hidden="true" />
          <p class="text-label text-default">Tiada sekolah dijumpai</p>
        </CardCell>
      </CardRow>

      <template v-else>
        <CardRow
          v-for="school in rows"
          :key="school.id"
          data-testid="school-row"
          :data-school-id="school.id"
        >
          <CardCell label="Nama Sekolah">
            <span class="text-label text-highlighted">{{ school.name }}</span>
          </CardCell>
          <CardCell label="Kod">
            <span class="text-caption text-muted text-nowrap">{{ school.code }}</span>
          </CardCell>
          <CardCell label="Jenis">
            <UBadge color="neutral" variant="subtle" :label="school.type" />
          </CardCell>
          <CardCell label="Negeri">
            <span class="text-nowrap">{{ school.state }}</span>
          </CardCell>
          <CardCell label="Daerah">
            <span class="text-caption text-muted">{{ school.district }}</span>
          </CardCell>
          <CardCell label="Pelajar">
            <span :class="school.studentCount > 0 ? 'text-highlighted' : 'text-dimmed'">{{
              formatNumber(school.studentCount)
            }}</span>
          </CardCell>
          <CardCell label="Guru">
            <span :class="school.teacherCount > 0 ? 'text-highlighted' : 'text-dimmed'">{{
              formatNumber(school.teacherCount)
            }}</span>
          </CardCell>
          <CardCell label="Status">
            <UBadge
              :color="school.isActive ? 'success' : 'neutral'"
              variant="subtle"
              :label="school.isActive ? 'Aktif' : 'Tidak Aktif'"
              data-testid="school-status"
            />
          </CardCell>
          <CardCell label="Tindakan">
            <div class="flex items-center justify-end gap-2">
              <UButton
                :to="{ name: SCHOOL_ROUTES.edit, params: { id: school.id } }"
                color="neutral"
                variant="soft"
                icon="i-ph-pencil-simple"
                title="Edit"
                aria-label="Edit"
                data-testid="school-edit"
              />
              <form method="post" @submit.prevent="toggle(school)">
                <UButton
                  type="submit"
                  color="neutral"
                  variant="soft"
                  :title="school.isActive ? 'Nyahaktif' : 'Aktifkan'"
                  :aria-label="school.isActive ? 'Nyahaktif' : 'Aktifkan'"
                  :loading="toggling === school.id"
                  :disabled="toggling !== null"
                  data-testid="school-toggle"
                >
                  <UIcon
                    v-if="toggling !== school.id"
                    :name="school.isActive ? 'i-ph-toggle-right' : 'i-ph-toggle-left'"
                    class="size-5"
                    aria-hidden="true"
                    data-testid="school-toggle-icon"
                  />
                </UButton>
              </form>
            </div>
          </CardCell>
        </CardRow>
      </template>

      <template #footer>
        <div
          class="flex flex-wrap items-center justify-between gap-3 p-3 empty:hidden"
          data-testid="schools-pager"
        >
          <template v-if="data && rows.length > 0">
            <p class="text-caption text-muted" role="status">{{ summary }}</p>
            <UPagination
              v-if="data.meta.totalItems > data.meta.pageSize"
              :page="data.meta.page"
              :total="data.meta.totalItems"
              :items-per-page="data.meta.pageSize"
              :prev="{ 'aria-label': 'Sebelum' }"
              :next="{ 'aria-label': 'Seterusnya' }"
              @update:page="goToPage"
            />
          </template>
        </div>
      </template>
    </CardTable>
  </DsPage>
</template>
