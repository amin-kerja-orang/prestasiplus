<script setup lang="ts">
/**
 * S1 `/admin/users` "Pengurusan Pengguna - Admin Panel" (M02-T4; FR-M02-01..19).
 *
 * - 7 role stat cards (all users, unaffected by the filters), GET filter form, three action links.
 * - Table of 25 rows per page: bulk select (own row excluded), "Aktif?" toggle, Edit / Pakej /
 *   Login As / Padam. The query string is the state; the form navigates and the list follows it.
 * - Native `confirm` for the toggle and Login As, modals for delete and bulk delete.
 * - DV-M02-01: the table fits from 1280, scrolls inside its card below (`DataTableCard`).
 */
import {
  CircleCheck,
  CircleX,
  Funnel,
  FileInput,
  LoaderCircle,
  LogIn,
  PackageOpen,
  Search,
  School as SchoolIcon,
  SquareCheckBig,
  SquarePen,
  ToggleRight,
  Trash,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative, useApi, useFlash, useSession } from '@/composables'
import { initialsAvatarUrl } from '@/shells/shared/avatar'

import {
  bulkDeleteAdminUsers,
  deleteAdminUser,
  fetchAdminUsers,
  fetchUserFilters,
  impersonateUser,
  toggleUserActive,
  type AdminUserListItem,
  type AdminUserRole,
} from '../api/users'
import UserDeleteModals from '../components/UserDeleteModals.vue'
import UserStatCards from '../components/UserStatCards.vue'
import {
  errorLines,
  formatUserDate,
  roleBadgeClass,
  roleLabel,
  ROLE_FILTER_OPTIONS,
  USERS_LIST_PATH,
} from '../lib/user-list'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const { store: session, user: me } = useSession()

function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => {
  const active = queryText(route.query.is_active)
  const school = Number.parseInt(queryText(route.query.school), 10)
  return {
    role: queryText(route.query.role),
    school: Number.isFinite(school) && school > 0 ? school : null,
    isActive: active === '1' ? true : active === '0' ? false : null,
    search: queryText(route.query.search).trim(),
    page: Math.max(1, Number.parseInt(queryText(route.query.page), 10) || 1),
  }
})

// Draft values of the form controls; re-synced when the URL changes (back/forward, reset, cards).
const role = ref(queryText(route.query.role))
const school = ref(queryText(route.query.school))
const status = ref(queryText(route.query.is_active))
const search = ref(queryText(route.query.search))
watch(
  () => [route.query.role, route.query.school, route.query.is_active, route.query.search] as const,
  ([r, s, a, q]) => {
    role.value = queryText(r)
    school.value = queryText(s)
    status.value = queryText(a)
    search.value = queryText(q)
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminUsers({
      role: (applied.value.role || null) as AdminUserRole | null,
      schoolId: applied.value.school,
      isActive: applied.value.isActive,
      search: applied.value.search || null,
      page: applied.value.page,
      signal,
    }),
  [
    () => route.query.role,
    () => route.query.school,
    () => route.query.is_active,
    () => route.query.search,
    () => route.query.page,
  ],
)

const schoolFilters = useApi((signal) => fetchUserFilters({ signal }))
const schoolOptions = computed(() => schoolFilters.data.value ?? [])

const rows = computed<AdminUserListItem[]>(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.roleCounts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)
const from = computed(() => data.value?.meta.from ?? 1)

function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (role.value !== '') out.role = role.value
  if (school.value !== '') out.school = school.value
  if (status.value !== '') out.is_active = status.value
  const s = search.value.trim()
  if (s !== '') out.search = s
  return out
}

/** The applied filters as the query of the pager links and of "same filter" comparisons. */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.role !== '') out.role = applied.value.role
  if (applied.value.school !== null) out.school = String(applied.value.school)
  if (applied.value.isActive !== null) out.is_active = applied.value.isActive ? '1' : '0'
  if (applied.value.search !== '') out.search = applied.value.search
  return out
})

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: USERS_LIST_PATH, query })
  }
}

function goToPage(page: number): void {
  void router.push({ path: USERS_LIST_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

// --- Selection (FR-M02-15): the own row is never selectable; page/filter changes clear it.
const selected = ref<number[]>([])
const ownId = computed(() => me.value?.id ?? null)
const selectableIds = computed(() =>
  rows.value.filter((u) => u.id !== ownId.value).map((u) => u.id),
)
const allSelected = computed(
  () =>
    selectableIds.value.length > 0 &&
    selectableIds.value.every((id) => selected.value.includes(id)),
)
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)

function toggleAll(event: Event): void {
  selected.value = (event.target as HTMLInputElement).checked ? [...selectableIds.value] : []
}

// --- Toggle, Login As (native confirm), delete.
const busy = ref(false)
const togglingId = ref<number | null>(null)

/** Reloads after a mutation; steps back a page when the current one became empty (FR-M02-14). */
async function reloadAfterMutation(): Promise<void> {
  await reload()
  if (rows.value.length === 0 && applied.value.page > 1) {
    await router.push({
      path: USERS_LIST_PATH,
      query: { ...pagerQuery.value, page: String(applied.value.page - 1) },
    })
  }
}

async function toggle(user: AdminUserListItem): Promise<void> {
  if (!confirmNative('Pasti untuk menukar status pengguna ini?')) return
  if (togglingId.value !== null) return
  togglingId.value = user.id
  try {
    const result = await toggleUserActive(user.id)
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    togglingId.value = null
  }
}

async function loginAs(user: AdminUserListItem): Promise<void> {
  if (!confirmNative(`Login sebagai ${user.name}?`)) return
  if (busy.value) return
  busy.value = true
  try {
    const next = await impersonateUser(user.id)
    // FR-M02-12: replace the client session (pp.auth) and go to the target's landing page.
    session.setSession({
      token: next.token,
      remember: false,
      expiresAt: next.expiresAt,
      user: next.user,
    })
    await router.push(next.user.landingPath)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

const deleting = ref<{ id: number; name: string } | null>(null)
const bulkOpen = ref(false)

async function confirmDelete(): Promise<void> {
  const target = deleting.value
  if (!target || busy.value) return
  busy.value = true
  try {
    const result = await deleteAdminUser(target.id)
    deleting.value = null
    selected.value = selected.value.filter((id) => id !== target.id)
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    deleting.value = null
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

async function confirmBulk(): Promise<void> {
  if (busy.value || selected.value.length === 0) return
  busy.value = true
  try {
    const result = await bulkDeleteAdminUsers(selected.value)
    bulkOpen.value = false
    selected.value = []
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    bulkOpen.value = false
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

const SKELETON_ROWS = 5
const COLUMN_COUNT = 10
const HEADERS = [
  '#',
  'Nama',
  'Emel',
  'Telefon',
  'Peranan',
  'Sekolah',
  'Aktif?',
  'Tarikh',
  'Tindakan',
]

const CELL = 'px-2.5 py-3 text-sm text-slate-700'
const HEAD = 'px-2.5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide'
const LABEL = 'mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700'
const ACTION =
  'inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:min-h-8'
const LINK_BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="users-page">
    <UserStatCards :counts="counts" :active-role="applied.role" />

    <!-- Filter (GET form): 2 columns below lg, one row from lg. -->
    <form
      method="get"
      class="grid grid-cols-2 items-end gap-3 rounded-2xl bg-white p-4 shadow sm:p-5 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      data-testid="users-filter"
      @submit.prevent="submitFilter"
    >
      <div class="min-w-0">
        <label for="users-role" :class="LABEL"
          ><UserCog class="h-4 w-4" aria-hidden="true" />Peranan</label
        >
        <select
          id="users-role"
          v-model="role"
          name="role"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="users-role"
        >
          <option value="">Semua Peranan</option>
          <option v-for="o in ROLE_FILTER_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="users-school" :class="LABEL"
          ><SchoolIcon class="h-4 w-4" aria-hidden="true" />Sekolah</label
        >
        <select
          id="users-school"
          v-model="school"
          name="school"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="users-school"
        >
          <option value="">Semua Sekolah</option>
          <option v-for="s in schoolOptions" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="users-status" :class="LABEL"
          ><ToggleRight class="h-4 w-4" aria-hidden="true" />Status</label
        >
        <select
          id="users-status"
          v-model="status"
          name="is_active"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="users-status"
        >
          <option value="">Semua</option>
          <option value="1">Aktif</option>
          <option value="0">Tidak Aktif</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="users-search" :class="LABEL"
          ><Search class="h-4 w-4" aria-hidden="true" />Cari</label
        >
        <input
          id="users-search"
          v-model="search"
          type="text"
          name="search"
          placeholder="Nama atau emel..."
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="users-search"
        />
      </div>
      <button
        type="submit"
        class="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:col-span-1"
        data-testid="users-search-submit"
      >
        <Funnel class="h-4 w-4" aria-hidden="true" />
        Cari
      </button>
    </form>

    <div class="flex flex-wrap gap-3">
      <RouterLink
        to="/admin/users/create"
        :class="[LINK_BTN, 'bg-indigo-600 hover:bg-indigo-700']"
        data-testid="users-add"
      >
        <UserPlus class="h-4 w-4" aria-hidden="true" />
        Tambah
      </RouterLink>
      <RouterLink
        to="/admin/import-students"
        :class="[LINK_BTN, 'bg-teal-600 hover:bg-teal-700']"
        data-testid="users-import-students"
      >
        <FileInput class="h-4 w-4" aria-hidden="true" />
        Import Pelajar
      </RouterLink>
      <RouterLink
        to="/admin/users/bulk-import"
        :class="[LINK_BTN, 'bg-purple-600 hover:bg-purple-700']"
        data-testid="users-import-users"
      >
        <UsersRound class="h-4 w-4" aria-hidden="true" />
        Import Pengguna
      </RouterLink>
    </div>

    <!-- Load failure: red box in place of the table + retry (design-system §7.4, INFERRED copy). -->
    <div v-if="error" class="space-y-3" data-testid="users-error">
      <AlertBox :messages="errorLines(error)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="users-retry"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <DataTableCard v-else :min-width="880">
      <template #header>
        <div
          v-if="selected.length > 0"
          class="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3"
          data-testid="users-bulk-bar"
        >
          <span class="inline-flex items-center gap-2 text-sm font-medium text-red-700">
            <SquareCheckBig class="h-4 w-4" aria-hidden="true" />
            <span data-testid="users-selected-count">{{ selected.length }}</span> dipilih
          </span>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            data-testid="users-bulk-delete"
            @click="bulkOpen = true"
          >
            <Trash class="h-4 w-4" aria-hidden="true" />
            Padam
          </button>
        </div>
      </template>

      <table :class="T.table" data-testid="users-table">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" :class="[HEAD, 'w-10']">
              <input
                type="checkbox"
                class="h-5 w-5 rounded border-slate-300 accent-indigo-600"
                :checked="allSelected"
                data-testid="users-select-all"
                @change="toggleAll"
              />
            </th>
            <th v-for="label in HEADERS" :key="label" scope="col" :class="HEAD">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="users-skeleton">
              <td v-for="c in COLUMN_COUNT" :key="c" :class="CELL">
                <div class="h-4 w-full max-w-24 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <tr v-else-if="rows.length === 0" :class="T.row" data-testid="users-empty">
            <td :colspan="COLUMN_COUNT" class="px-4 py-12 text-center text-slate-400">
              <Users class="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
              <p class="font-medium text-slate-500">Tiada pengguna dijumpai</p>
              <p class="text-sm">Cuba ubah kriteria carian anda</p>
            </td>
          </tr>

          <template v-else>
            <tr
              v-for="(user, index) in rows"
              :key="user.id"
              :class="[T.row, 'align-middle']"
              data-testid="user-row"
              :data-user-id="user.id"
            >
              <td :class="CELL">
                <input
                  v-if="user.id !== ownId"
                  v-model="selected"
                  type="checkbox"
                  :value="user.id"
                  class="h-5 w-5 rounded border-slate-300 accent-indigo-600"
                  data-testid="user-select"
                />
              </td>
              <td :class="CELL">{{ from + index }}</td>
              <td :class="[CELL, 'min-w-36 font-medium text-slate-800']">
                <div class="flex items-center gap-2">
                  <img
                    :src="user.avatarUrl || initialsAvatarUrl(user.name, '#4F46E5')"
                    alt=""
                    class="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                  <span class="min-w-0 break-words" data-testid="user-name">{{ user.name }}</span>
                </div>
              </td>
              <td :class="[CELL, 'min-w-36 break-all']">{{ user.email }}</td>
              <td :class="[CELL, 'whitespace-nowrap']">{{ user.phone || '-' }}</td>
              <td :class="CELL">
                <span :class="roleBadgeClass(user.role)" data-testid="user-role">{{
                  roleLabel(user.role)
                }}</span>
              </td>
              <td :class="[CELL, 'min-w-32 break-words']">{{ user.school?.name || '-' }}</td>
              <td :class="CELL">
                <form method="post" @submit.prevent="toggle(user)">
                  <button
                    type="submit"
                    :disabled="togglingId === user.id"
                    :class="[
                      ACTION,
                      'disabled:cursor-wait',
                      user.isActive
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200',
                    ]"
                    data-testid="user-toggle"
                  >
                    <LoaderCircle
                      v-if="togglingId === user.id"
                      class="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <template v-else-if="user.isActive">
                      <CircleCheck class="h-3.5 w-3.5" aria-hidden="true" />Aktif
                    </template>
                    <template v-else>
                      <CircleX class="h-3.5 w-3.5" aria-hidden="true" />Tidak
                    </template>
                  </button>
                </form>
              </td>
              <td :class="[CELL, 'whitespace-nowrap']">{{ formatUserDate(user.createdAt) }}</td>
              <td :class="CELL">
                <div class="flex flex-wrap items-center gap-1.5">
                  <RouterLink
                    :to="`/admin/users/${user.id}/edit`"
                    title="Edit"
                    :class="[ACTION, 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200']"
                    data-testid="user-edit"
                  >
                    <SquarePen class="h-3.5 w-3.5" aria-hidden="true" />Edit
                  </RouterLink>
                  <RouterLink
                    v-if="user.role === 'school_admin'"
                    :to="`/admin/users/${user.id}/packages`"
                    title="Pakej"
                    :class="[ACTION, 'bg-teal-100 text-teal-700 hover:bg-teal-200']"
                    data-testid="user-packages"
                  >
                    <PackageOpen class="h-3.5 w-3.5" aria-hidden="true" />Pakej
                  </RouterLink>
                  <form
                    v-if="user.id !== ownId"
                    method="post"
                    class="inline-flex"
                    @submit.prevent="loginAs(user)"
                  >
                    <button
                      type="submit"
                      title="Login As"
                      :disabled="busy"
                      :class="[
                        ACTION,
                        'bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-60',
                      ]"
                      data-testid="user-login-as"
                    >
                      <LogIn class="h-3.5 w-3.5" aria-hidden="true" />
                      <span class="hidden sm:inline">Login As</span
                      ><span class="sm:hidden">LA</span>
                    </button>
                  </form>
                  <button
                    v-if="user.id !== ownId"
                    type="button"
                    title="Padam"
                    :class="[
                      ACTION,
                      'min-w-11 bg-red-100 text-red-700 hover:bg-red-200 lg:min-w-8',
                    ]"
                    data-testid="user-delete"
                    @click="deleting = { id: user.id, name: user.name }"
                  >
                    <Trash class="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <template #footer>
        <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="users-pager">
          <LaravelPager
            v-if="data && rows.length > 0"
            :page="data.meta.page"
            :total="data.meta.totalItems"
            :per-page="data.meta.pageSize"
            :path="USERS_LIST_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>

    <UserDeleteModals
      :single="deleting"
      :bulk-count="bulkOpen ? selected.length : 0"
      :busy="busy"
      @close-single="deleting = null"
      @close-bulk="bulkOpen = false"
      @confirm-single="confirmDelete"
      @confirm-bulk="confirmBulk"
    />
  </div>
</template>
