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
import type { DropdownMenuItem } from '@nuxt/ui'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import {
  AdminIdentity,
  AdminPageHeader,
  AdminPager,
  AdminRowMenu,
  AdminToolbar,
  type ToolbarChip,
} from '@/ds/admin'
import { useApi, useFlash, useSession } from '@/composables'
import { DsPage, useConfirm } from '@/ds'

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
import AdminAlert from '../components/AdminAlert.vue'
import NativeCheckbox from '../components/native/NativeCheckbox.vue'
import UserDeleteModals from '../components/UserDeleteModals.vue'
import UserStatCards from '../components/UserStatCards.vue'
import AdminCell from '../components/native/AdminCell.vue'
import AdminRow from '../components/native/AdminRow.vue'
import AdminSelect from '../components/native/AdminSelect.vue'
import AdminTable from '../components/native/AdminTable.vue'
import {
  errorLines,
  formatUserDate,
  initialsOf,
  ROLE_FILTER_OPTIONS,
  roleLabel,
  USERS_LIST_PATH,
} from '../lib/user-list'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()
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
const summary = computed(() => {
  const meta = data.value?.meta
  if (!meta || rows.value.length === 0) return ''
  return `Menunjukkan ${String(meta.from ?? 1)}-${String(meta.to ?? rows.value.length)} daripada ${String(meta.totalItems)} hasil`
})

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
const chips = computed<ToolbarChip[]>(() => {
  const out: ToolbarChip[] = []
  if (applied.value.role !== '') out.push({ key: 'role', label: roleLabel(applied.value.role) })
  if (applied.value.school !== null) {
    const found = schoolOptions.value.find((s) => s.id === applied.value.school)
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
function menuItems(user: AdminUserListItem): DropdownMenuItem[][] {
  const main: DropdownMenuItem[] = []
  if (user.role === 'school_admin')
    main.push({
      label: 'Pakej',
      icon: 'i-ph-package',
      to: `/admin/users/${String(user.id)}/packages`,
    })
  main.push({
    label: user.isActive ? 'Nyahaktifkan' : 'Aktifkan',
    icon: user.isActive ? 'i-ph-x-circle' : 'i-ph-check-circle',
    onSelect: () => void toggle(user),
  })
  if (user.id === ownId.value) return [main]
  main.push({ label: 'Login As', icon: 'i-ph-sign-in', onSelect: () => void loginAs(user) })
  return [
    main,
    [
      {
        label: 'Padam',
        icon: 'i-ph-trash',
        color: 'error',
        onSelect: () => {
          deleting.value = { id: user.id, name: user.name }
        },
      },
    ],
  ]
}

const SKELETON_ROWS = 6
const COLUMNS = [
  { key: 'select', label: 'Pilih', cls: 'w-14' },
  { key: 'name', label: 'Nama' },
  { key: 'phone', label: 'Telefon' },
  { key: 'role', label: 'Peranan' },
  { key: 'school', label: 'Sekolah' },
  { key: 'active', label: 'Status' },
  { key: 'date', label: 'Tarikh' },
  { key: 'actions', label: 'Tindakan', cls: 'w-32 text-end' },
]
</script>

<template>
  <DsPage data-testid="users-page">
    <AdminPageHeader
      title="Pengurusan Pengguna"
      subtitle="Cari, tapis dan urus akaun pelajar, guru dan pentadbir."
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
    </AdminPageHeader>

    <UserStatCards :counts="counts" :active-role="applied.role" />

    <AdminToolbar
      :chips="chips"
      data-testid="users-filter"
      @apply="submitFilter"
      @reset="resetFilter"
      @remove="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Cari nama atau emel..."
          icon="i-ph-magnifying-glass"
          class="w-full"
          data-testid="users-search"
        />
      </template>
      <AdminSelect
        id="users-role"
        v-model="role"
        name="role"
        aria-label="Peranan"
        class="md:w-44"
        data-testid="users-role"
      >
        <option value="">Semua Peranan</option>
        <option v-for="o in ROLE_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </AdminSelect>
      <AdminSelect
        id="users-school"
        v-model="school"
        name="school"
        aria-label="Sekolah"
        class="md:w-52"
        data-testid="users-school"
      >
        <option value="">Semua Sekolah</option>
        <option v-for="s in schoolOptions" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </AdminSelect>
      <AdminSelect
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
      </AdminSelect>
    </AdminToolbar>

    <!-- Load failure: red box in place of the table + retry (design-system 7.4, INFERRED copy). -->
    <div v-if="error" class="flex flex-col gap-4" data-testid="users-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="users-retry" @click="reload()" />
      </div>
    </div>

    <AdminTable v-else :columns="COLUMNS" caption="Senarai pengguna" data-testid="users-table">
      <template #header>
        <div
          v-if="selected.length > 0"
          class="flex items-center justify-between gap-4 bg-elevated p-4"
          data-testid="users-bulk-bar"
        >
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
      </template>

      <template #head-select>
        <NativeCheckbox
          :model-value="allSelected"
          aria-label="Pilih semua"
          data-testid="users-select-all"
          @change="toggleAll"
        />
      </template>

      <template v-if="firstLoad">
        <AdminRow v-for="n in SKELETON_ROWS" :key="n" data-testid="users-skeleton">
          <AdminCell v-for="c in COLUMNS.length" :key="c">
            <USkeleton class="h-5 w-full max-w-28" />
          </AdminCell>
        </AdminRow>
      </template>

      <AdminRow v-else-if="rows.length === 0" data-testid="users-empty">
        <AdminCell :colspan="COLUMNS.length">
          <UIcon name="i-ph-users" class="mx-auto mb-3 size-10 text-muted" aria-hidden="true" />
          <p class="text-body text-default">Tiada pengguna dijumpai</p>
          <p class="text-body text-muted">Cuba ubah kriteria carian anda</p>
        </AdminCell>
      </AdminRow>

      <template v-else>
        <AdminRow
          v-for="user in rows"
          :key="user.id"
          data-testid="user-row"
          :data-user-id="user.id"
        >
          <AdminCell label="Pilih">
            <NativeCheckbox
              v-if="user.id !== ownId"
              v-model="selected"
              :value="user.id"
              :aria-label="`Pilih ${user.name}`"
              data-testid="user-select"
            />
          </AdminCell>
          <AdminCell>
            <AdminIdentity
              :name="user.name"
              :sub="user.email"
              :src="user.avatarUrl"
              :initials="initialsOf(user.name)"
            >
              <template #name
                ><span data-testid="user-name">{{ user.name }}</span></template
              >
            </AdminIdentity>
          </AdminCell>
          <AdminCell label="Telefon"
            ><span class="text-nowrap">{{ user.phone || '-' }}</span></AdminCell
          >
          <AdminCell label="Peranan">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="roleLabel(user.role)"
              data-testid="user-role"
            />
          </AdminCell>
          <AdminCell label="Sekolah">
            <span class="block max-w-28 truncate" :title="user.school?.name">{{
              user.school?.name || '-'
            }}</span>
          </AdminCell>
          <AdminCell label="Status">
            <UBadge
              :color="user.isActive ? 'success' : 'neutral'"
              variant="subtle"
              :label="user.isActive ? 'Aktif' : 'Tidak Aktif'"
              data-testid="user-status"
            />
          </AdminCell>
          <AdminCell label="Tarikh"
            ><span class="text-nowrap">{{ formatUserDate(user.createdAt) }}</span></AdminCell
          >
          <AdminCell label="Tindakan">
            <div class="flex items-center justify-end gap-1">
              <UButton
                :to="`/admin/users/${String(user.id)}/edit`"
                color="neutral"
                variant="soft"
                icon="i-ph-pencil-simple"
                aria-label="Edit"
                title="Edit"
                data-testid="user-edit"
              />
              <AdminRowMenu :items="menuItems(user)" :label="`Tindakan lain untuk ${user.name}`" />
            </div>
          </AdminCell>
        </AdminRow>
      </template>

      <template #footer>
        <AdminPager
          :summary="summary"
          :total="data?.meta.totalItems ?? 0"
          :page="data?.meta.page ?? 1"
          :page-size="data?.meta.pageSize ?? 25"
          data-testid="users-pager"
          @update:page="goToPage"
        />
      </template>
    </AdminTable>

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
