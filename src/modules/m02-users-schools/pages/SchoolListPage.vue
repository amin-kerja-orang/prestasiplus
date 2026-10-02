<script setup lang="ts">
/**
 * S9 `/admin/schools` "Urus Sekolah - Admin PRESTASIPLUS" (M02-T8; FR-M02-76..79, FR-M02-18).
 *
 * - Three stat cards (totals over all schools, unaffected by the filters) and the "Tambah Sekolah"
 *   card.
 * - GET filter form (`search`, `state`, `type`, "Cari"); the reset link shows only while a filter is
 *   active. The query string is the state: the form navigates, the list follows the route.
 * - 30 rows per page, name A-Z; the Laravel pager keeps the filters. Edit link and an icon-only
 *   toggle button (no confirmation); after a toggle the list reloads with the same filters and the
 *   success flash (UNVERIFIED COPY, from the API `status`).
 * - The table scrolls inside its card below its natural width (`DataTableCard`, design-system §7.4).
 */
import { Pencil, Plus, School, Search, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'
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

const filterActive = computed(
  () => applied.value.search !== '' || applied.value.state !== '' || applied.value.type !== '',
)

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
  'Nama Sekolah',
  'Kod',
  'Jenis',
  'Negeri',
  'Daerah',
  'Pelajar',
  'Guru',
  'Status',
  'Tindakan',
] as const

const STAT_CARD = 'flex flex-col justify-center rounded-2xl bg-white p-5 text-center shadow'
const STAT_NUMBER = 'font-heading text-3xl font-bold'
const STAT_LABEL = 'text-sm text-slate-500'
const ICON_BUTTON =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg transition lg:h-9 lg:w-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="schools-page">
    <!-- Stat cards: 2 x 2 below lg, four across from lg (live 1280: 4 across). -->
    <section class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <div :class="STAT_CARD" data-testid="schools-stat-total">
        <div v-if="counts" :class="[STAT_NUMBER, 'text-indigo-500']">
          {{ formatNumber(counts.total) }}
        </div>
        <div v-else class="mx-auto h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p :class="STAT_LABEL">Jumlah Sekolah</p>
      </div>
      <div :class="STAT_CARD" data-testid="schools-stat-active">
        <div v-if="counts" :class="[STAT_NUMBER, 'text-green-600']">
          {{ formatNumber(counts.active) }}
        </div>
        <div v-else class="mx-auto h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p :class="STAT_LABEL">Aktif</p>
      </div>
      <div :class="STAT_CARD" data-testid="schools-stat-inactive">
        <div v-if="counts" :class="[STAT_NUMBER, 'text-orange-600']">
          {{ formatNumber(counts.inactive) }}
        </div>
        <div v-else class="mx-auto h-9 w-20 animate-pulse rounded-lg bg-slate-100"></div>
        <p :class="STAT_LABEL">Tidak Aktif</p>
      </div>
      <div :class="[STAT_CARD, 'max-sm:p-3']">
        <RouterLink
          :to="{ name: SCHOOL_ROUTES.create }"
          class="inline-flex min-h-11 items-center justify-center gap-1.5 self-center rounded-xl bg-indigo-500 px-3 py-2.5 text-xs font-bold whitespace-nowrap text-white shadow transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:gap-2 sm:px-5 sm:text-sm"
          data-testid="schools-add"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          Tambah Sekolah
        </RouterLink>
      </div>
    </section>

    <!-- Filter (GET form): stacked below md, one row from md. -->
    <form
      method="get"
      class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow sm:p-5 md:flex-row md:items-center"
      data-testid="schools-filter"
      @submit.prevent="submitFilter"
    >
      <input
        v-model="search"
        type="text"
        name="search"
        placeholder="Cari nama atau kod sekolah..."
        :class="[FORM_INPUT_CLASS, 'min-h-11 md:min-w-0 md:flex-1']"
        data-testid="schools-search"
      />
      <select
        v-model="state"
        name="state"
        :class="[FORM_INPUT_CLASS, 'min-h-11 md:w-auto']"
        data-testid="schools-state"
      >
        <option value="">Semua Negeri</option>
        <option v-for="name in SCHOOL_STATE_OPTIONS" :key="name" :value="name">{{ name }}</option>
      </select>
      <select
        v-model="type"
        name="type"
        :class="[FORM_INPUT_CLASS, 'min-h-11 md:w-auto']"
        data-testid="schools-type"
      >
        <option value="">Semua Jenis</option>
        <option v-for="name in types" :key="name" :value="name">{{ name }}</option>
      </select>
      <button
        type="submit"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="schools-search-submit"
      >
        <Search class="h-4 w-4" aria-hidden="true" />
        Cari
      </button>
      <RouterLink
        v-if="filterActive"
        :to="SCHOOLS_LIST_PATH"
        title="Reset"
        class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-200 text-slate-500 transition hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="schools-reset"
      >
        <X class="h-4 w-4" aria-hidden="true" />
      </RouterLink>
    </form>

    <!-- Load failure: red box in place of the table + retry (design-system §7.4, INFERRED copy). -->
    <div v-if="error" class="space-y-3" data-testid="schools-error">
      <AlertBox :messages="errorLines(error)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-600"
        data-testid="schools-retry"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <DataTableCard v-else :min-width="820">
      <table :class="T.table" data-testid="schools-table">
        <thead>
          <tr>
            <th
              v-for="(label, index) in COLUMNS"
              :key="label"
              scope="col"
              :class="[
                T.th,
                'text-sm! font-semibold! tracking-normal! normal-case!',
                index >= 5 && index <= 7 ? 'text-center' : '',
              ]"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading: skeleton rows matching the column count (design-system §7.4, INFERRED). -->
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="schools-skeleton">
              <td v-for="label in COLUMNS" :key="label" :class="T.td">
                <div class="h-4 w-full max-w-32 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <tr v-else-if="rows.length === 0" :class="T.row" data-testid="schools-empty">
            <td :colspan="COLUMNS.length" class="px-4 py-12 text-center text-slate-400">
              <School
                class="mr-2 inline-block h-10 w-10 align-middle text-slate-400"
                aria-hidden="true"
              />
              <span class="align-middle">Tiada sekolah dijumpai</span>
            </td>
          </tr>

          <template v-else>
            <tr
              v-for="school in rows"
              :key="school.id"
              :class="[T.row, 'align-middle']"
              data-testid="school-row"
              :data-school-id="school.id"
            >
              <td :class="[T.td, 'min-w-44 font-semibold text-slate-800!']">{{ school.name }}</td>
              <td :class="[T.td, 'font-mono text-xs whitespace-nowrap text-slate-500']">
                {{ school.code }}
              </td>
              <td :class="T.td">
                <span
                  class="inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-purple-700"
                  >{{ school.type }}</span
                >
              </td>
              <td :class="[T.td, 'whitespace-nowrap']">{{ school.state }}</td>
              <td :class="[T.td, 'text-xs text-slate-500! uppercase']">{{ school.district }}</td>
              <td
                :class="[
                  T.td,
                  'text-center font-semibold',
                  school.studentCount > 0 ? 'text-indigo-600!' : 'font-normal! text-slate-300!',
                ]"
              >
                {{ formatNumber(school.studentCount) }}
              </td>
              <td
                :class="[
                  T.td,
                  'text-center font-semibold',
                  school.teacherCount > 0 ? 'text-emerald-600!' : 'font-normal! text-slate-300!',
                ]"
              >
                {{ formatNumber(school.teacherCount) }}
              </td>
              <td :class="[T.td, 'text-center']">
                <span
                  :class="[
                    'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                    school.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                  ]"
                  data-testid="school-status"
                  >{{ school.isActive ? 'Aktif' : 'Tidak Aktif' }}</span
                >
              </td>
              <td :class="T.td">
                <div class="flex items-center justify-center gap-1.5">
                  <RouterLink
                    :to="{ name: SCHOOL_ROUTES.edit, params: { id: school.id } }"
                    title="Edit"
                    :class="[ICON_BUTTON, 'bg-slate-100 text-slate-500 hover:bg-slate-200']"
                    data-testid="school-edit"
                  >
                    <Pencil class="h-4 w-4" aria-hidden="true" />
                  </RouterLink>
                  <form method="post" class="inline-flex" @submit.prevent="toggle(school)">
                    <button
                      type="submit"
                      :title="school.isActive ? 'Nyahaktif' : 'Aktifkan'"
                      :disabled="toggling !== null"
                      :class="[
                        ICON_BUTTON,
                        'disabled:cursor-wait disabled:opacity-60',
                        school.isActive
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200',
                      ]"
                      data-testid="school-toggle"
                    >
                      <LoadingSpinner v-if="toggling === school.id" class="h-4 w-4" />
                      <!-- Live FA toggle: filled pill with a white knob (right = on, left = off). -->
                      <svg
                        v-else
                        viewBox="0 0 24 24"
                        class="h-5 w-5"
                        fill="currentColor"
                        aria-hidden="true"
                        data-testid="school-toggle-icon"
                      >
                        <rect x="1" y="6" width="22" height="12" rx="6" />
                        <circle :cx="school.isActive ? 17 : 7" cy="12" r="4" fill="white" />
                      </svg>
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <template #footer>
        <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="schools-pager">
          <LaravelPager
            v-if="data"
            :page="data.meta.page"
            :total="data.meta.totalItems"
            :per-page="data.meta.pageSize"
            :path="SCHOOLS_LIST_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
