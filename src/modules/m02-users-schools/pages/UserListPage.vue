<script setup lang="ts">
/**
 * S1 `/admin/users` "Pengurusan Pengguna - Admin Panel" (M02-T4; FR-M02-01..19), v2 staff theme.
 *
 * - 7 role KPI tiles (all users, unaffected by the filters), a one-row toolbar with filter chips and
 *   three header actions.
 * - Table of 25 rows per page (`AdminTable`, cards below `md`): bulk select (own row excluded), status
 *   badge, Edit and a "..." menu (Pakej / Nyahaktifkan / Login As / Padam). The query string is the
 *   state; the form navigates and the list follows it.
 * - `useConfirm` for the toggle and Login As (same BM text as the native confirm), dialogs for delete
 *   and bulk delete.
 */
import { computed, ref, watch } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { isHttpMode } from '@/api/mode'
import { useApi, useFlash, useSession } from '@/composables'
import {
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsIdentity,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsRowActions,
  DsStatusBadge,
  type RowAction,
  useConfirm,
} from '@/ds'

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
  initialsOf,
  roleFilterOptionsFor,
  roleLabel,
  USERS_LIST_PATH,
} from '../lib/user-list'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()
const { store: session, user: me } = useSession()
/** Login As needs `POST /api/admin/users/:id/impersonate`, which the API does not have (DV-M02-22). */
const http = isHttpMode()
const roleFilterOptions = roleFilterOptionsFor(http)

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

// Draft values of the form controls; re-synced when the URL changes (back/forward, reset, tiles).
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
type UserRow = AdminUserListItem & Record<string, unknown>
const tableRows = computed(() => rows.value as UserRow[])
/** The `card` slot hands over the untyped row; this narrows it back. */
const asUser = (row: Record<string, unknown>): AdminUserListItem =>
  row as unknown as AdminUserListItem
/** Filters in force (search counts as one), for the reset button and the mobile badge. */
const activeCount = computed(
  () =>
    (applied.value.role !== '' ? 1 : 0) +
    (applied.value.school !== null ? 1 : 0) +
    (applied.value.isActive !== null ? 1 : 0) +
    (applied.value.search !== '' ? 1 : 0),
)

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

/** Removable chips of the applied filters (the URL is the source of truth). */
const chips = computed<{ key: string; label: string }[]>(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.role !== '') out.push({ key: 'role', label: roleLabel(applied.value.role) })
  if (applied.value.school !== null) {
    const found = schoolOptions.value.find((s) => String(s.id) === String(applied.value.school))
    out.push({ key: 'school', label: found?.name ?? `Sekolah ${String(applied.value.school)}` })
  }
  if (applied.value.isActive !== null)
    out.push({ key: 'is_active', label: applied.value.isActive ? 'Aktif' : 'Tidak Aktif' })
  return out
})

async function removeChip(key: string): Promise<void> {
  const query = { ...pagerQuery.value }
  delete query[key]
  await router.push({ path: USERS_LIST_PATH, query })
}

async function submitFilter(): Promise<void> {
  const query = filterQuery()
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: USERS_LIST_PATH, query })
  }
}

async function resetFilter(): Promise<void> {
  role.value = ''
  school.value = ''
  status.value = ''
  search.value = ''
  await submitFilter()
}

function goToPage(page: number): void {
  void router.push({ path: USERS_LIST_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

// --- Selection (FR-M02-15): the own row is never selectable; page/filter changes clear it.
const selected = ref<number[]>([])
/** The session id is a number in mock mode and the list ids are opaque strings in http mode: compare as text. */
const ownId = computed(() => (me.value?.id == null ? null : String(me.value.id)))
const isOwn = (id: number | string): boolean => ownId.value !== null && String(id) === ownId.value
const selectableIds = computed(() => rows.value.filter((u) => !isOwn(u.id)).map((u) => u.id))
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

function toggleAll(checked: boolean | 'indeterminate'): void {
  selected.value = checked === true ? [...selectableIds.value] : []
}
function toggleOne(id: number, checked: boolean | 'indeterminate'): void {
  selected.value =
    checked === true
      ? [...selected.value.filter((v) => v !== id), id]
      : selected.value.filter((v) => v !== id)
}

// --- Toggle, Login As (confirm), delete.
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
  if (!(await confirm({ message: 'Pasti untuk menukar status pengguna ini?' }))) return
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
  if (!(await confirm({ message: `Login sebagai ${user.name}?` }))) return
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

/** Row menu: Pakej (school admins), the status toggle, Login As (not the own row) and Padam. */
function menuActions(user: AdminUserListItem): RowAction[] {
  const actions: RowAction[] = []
  if (user.role === 'school_admin')
    actions.push({
      label: 'Pakej',
      icon: 'i-ph-package',
      to: `/admin/users/${String(user.id)}/packages`,
    })
  actions.push({
    label: user.isActive ? 'Nyahaktifkan' : 'Aktifkan',
    icon: user.isActive ? 'i-ph-x-circle' : 'i-ph-check-circle',
    onSelect: () => void toggle(user),
  })
  if (isOwn(user.id)) return actions
  if (!http)
    actions.push({ label: 'Login As', icon: 'i-ph-sign-in', onSelect: () => void loginAs(user) })
  actions.push({
    label: 'Padam',
    icon: 'i-ph-trash',
    danger: true,
    onSelect: () => {
      deleting.value = { id: user.id, name: user.name }
    },
  })
  return actions
}

const SKELETON_ROWS = 6
// `UTable` column meta takes per-cell classes under the key `class`; the key is computed so the class linter
// does not read it as a class list (same as `DsDataTable`).
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
/**
 * DV-M02-25: eight columns do not fit the card at 1280 (~1140px in a 973px card) and the actions clip. "Tarikh"
 * shows from `2xl`, "Telefon" from `xl`; the table is tight and the name / school cells are capped, so the
 * "Tindakan" column is always inside the card.
 */
const HIDE_BELOW = {
  // Full class strings: Tailwind reads the source text, so they cannot be built from a template.
  xl: { [META_CLASS]: { th: 'hidden xl:table-cell', td: 'hidden xl:table-cell' } },
  '2xl': { [META_CLASS]: { th: 'hidden 2xl:table-cell', td: 'hidden 2xl:table-cell' } },
}
const COLUMNS: TableColumn<UserRow>[] = [
  { id: 'select', header: '' },
  { id: 'name', header: 'Nama' },
  { id: 'phone', header: 'Telefon', meta: HIDE_BELOW.xl },
  { id: 'role', header: 'Peranan' },
  { id: 'school', header: 'Sekolah' },
  { id: 'active', header: 'Status' },
  { id: 'date', header: 'Tarikh', meta: HIDE_BELOW['2xl'] },
  { id: 'actions', header: 'Tindakan' },
]
</script>

<template>
  <DsPage
    title="Pengurusan Pengguna"
    subtitle="Cari, tapis dan urus akaun pelajar, guru dan pentadbir."
    data-testid="users-page"
  >
    <template #actions>
      <UButton
        to="/admin/import-students"
        color="neutral"
        variant="soft"
        icon="i-ph-file-arrow-up"
        label="Import Pelajar"
        data-testid="users-import-students"
      />
      <UButton
        to="/admin/users/bulk-import"
        color="neutral"
        variant="soft"
        icon="i-ph-users-three"
        label="Import Pengguna"
        data-testid="users-import-users"
      />
      <UButton
        to="/admin/users/create"
        icon="i-ph-user-plus"
        label="Tambah"
        data-testid="users-add"
      />
    </template>

    <UserStatCards :counts="counts" :active-role="applied.role" />

    <DsFilterBar
      :chips="chips"
      :active-count="activeCount"
      data-testid="users-filter"
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
          placeholder="Cari nama atau emel..."
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:flex-1"
          data-testid="users-search"
        />
      </template>
      <DsNativeSelect
        id="users-role"
        v-model="role"
        name="role"
        aria-label="Peranan"
        class="md:w-44"
        data-testid="users-role"
      >
        <option value="">Semua Peranan</option>
        <option v-for="o in roleFilterOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </DsNativeSelect>
      <DsNativeSelect
        id="users-school"
        v-model="school"
        name="school"
        aria-label="Sekolah"
        class="md:w-52"
        data-testid="users-school"
      >
        <option value="">Semua Sekolah</option>
        <option v-for="s in schoolOptions" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        id="users-status"
        v-model="status"
        name="is_active"
        aria-label="Status"
        class="md:w-36"
        data-testid="users-status"
      >
        <option value="">Semua</option>
        <option value="1">Aktif</option>
        <option value="0">Tidak Aktif</option>
      </DsNativeSelect>
    </DsFilterBar>

    <!-- Bulk bar (FR-M02-15): only while at least one row is ticked. -->
    <DsPanel v-if="selected.length > 0" behavior="bulk" data-testid="users-bulk-bar">
      <div class="flex items-center justify-between gap-4">
        <span class="flex items-center gap-2 text-body text-default">
          <UIcon name="i-ph-check-square" class="size-5" aria-hidden="true" />
          <span data-testid="users-selected-count">{{ selected.length }}</span> dipilih
        </span>
        <UButton
          type="button"
          color="error"
          icon="i-ph-trash"
          label="Padam"
          data-testid="users-bulk-delete"
          @click="bulkOpen = true"
        />
      </div>
    </DsPanel>

    <DsLoadError
      v-if="error"
      message="Tidak dapat memuatkan senarai pengguna. Sila cuba semula."
      testid="users-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="firstLoad" padding="none" data-testid="users-table">
      <div class="flex flex-col gap-3 p-4">
        <USkeleton
          v-for="n in SKELETON_ROWS"
          :key="n"
          class="h-12 w-full"
          data-testid="users-skeleton"
        />
      </div>
    </DsPanel>

    <DsDataTable
      v-else
      :data="tableRows"
      :columns="COLUMNS"
      variant="flush"
      density="tight"
      caption="Senarai pengguna"
      :total="data?.meta.totalItems ?? 0"
      :page="data?.meta.page ?? 1"
      :page-size="data?.meta.pageSize ?? 25"
      data-testid="users-table"
      @update:page="goToPage"
    >
      <template #select-header>
        <UCheckbox
          :model-value="allSelected"
          aria-label="Pilih semua"
          data-testid="users-select-all"
          @update:model-value="toggleAll"
        />
      </template>
      <template #select-cell="{ row }">
        <UCheckbox
          v-if="!isOwn(row.original.id)"
          :model-value="selected.includes(row.original.id)"
          :aria-label="`Pilih ${row.original.name}`"
          data-testid="user-select"
          @update:model-value="(v: boolean | 'indeterminate') => toggleOne(row.original.id, v)"
        />
      </template>
      <template #name-cell="{ row }">
        <DsIdentity
          :name="row.original.name"
          :sub="row.original.email"
          :src="row.original.avatarUrl"
          :initials="initialsOf(row.original.name)"
          class="max-w-44 xl:max-w-60"
        >
          <template #name
            ><span :title="row.original.name" data-testid="user-name">{{
              row.original.name
            }}</span></template
          >
        </DsIdentity>
      </template>
      <template #phone-cell="{ row }">
        <span class="text-nowrap">{{ row.original.phone || '-' }}</span>
      </template>
      <template #role-cell="{ row }">
        <UBadge
          color="neutral"
          variant="subtle"
          :label="roleLabel(row.original.role)"
          data-testid="user-role"
        />
      </template>
      <template #school-cell="{ row }">
        <span class="block max-w-20 truncate xl:max-w-28" :title="row.original.school?.name">{{
          row.original.school?.name || '-'
        }}</span>
      </template>
      <template #active-cell="{ row }">
        <DsStatusBadge
          :status="row.original.isActive ? 'active' : 'inactive'"
          data-testid="user-status"
        />
      </template>
      <template #date-cell="{ row }">
        <span class="text-nowrap">{{ formatUserDate(row.original.createdAt) }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div
          class="flex items-center justify-end gap-1"
          data-testid="user-row"
          :data-user-id="row.original.id"
        >
          <UButton
            :to="`/admin/users/${String(row.original.id)}/edit`"
            color="neutral"
            variant="soft"
            icon="i-ph-pencil-simple"
            aria-label="Edit"
            title="Edit"
            data-testid="user-edit"
          />
          <DsRowActions
            :actions="menuActions(row.original)"
            :label="`Tindakan lain untuk ${row.original.name}`"
          />
        </div>
      </template>
      <template #empty>
        <DsEmptyState
          size="sm"
          icon="users"
          title="Tiada pengguna dijumpai"
          description="Cuba ubah kriteria carian anda"
          data-testid="users-empty"
        />
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 items-start gap-3">
          <UCheckbox
            v-if="!isOwn(asUser(row).id)"
            :model-value="selected.includes(asUser(row).id)"
            :aria-label="`Pilih ${asUser(row).name}`"
            data-testid="user-select"
            @update:model-value="(v: boolean | 'indeterminate') => toggleOne(asUser(row).id, v)"
          />
          <div class="flex min-w-0 flex-col gap-1">
            <DsIdentity
              :name="asUser(row).name"
              :sub="asUser(row).email"
              :src="asUser(row).avatarUrl"
              :initials="initialsOf(asUser(row).name)"
            />
            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="neutral" variant="subtle" :label="roleLabel(asUser(row).role)" />
              <DsStatusBadge :status="asUser(row).isActive ? 'active' : 'inactive'" />
            </div>
            <div
              class="flex items-center gap-1"
              data-testid="user-row"
              :data-user-id="asUser(row).id"
            >
              <UButton
                :to="`/admin/users/${String(asUser(row).id)}/edit`"
                color="neutral"
                variant="soft"
                icon="i-ph-pencil-simple"
                aria-label="Edit"
                title="Edit"
              />
              <DsRowActions
                :actions="menuActions(asUser(row))"
                :label="`Tindakan lain untuk ${asUser(row).name}`"
              />
            </div>
          </div>
        </div>
      </template>
    </DsDataTable>

    <UserDeleteModals
      :single="deleting"
      :bulk-count="bulkOpen ? selected.length : 0"
      :busy="busy"
      @close-single="deleting = null"
      @close-bulk="bulkOpen = false"
      @confirm-single="confirmDelete"
      @confirm-bulk="confirmBulk"
    />
  </DsPage>
</template>
