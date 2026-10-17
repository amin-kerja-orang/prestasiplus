<script setup lang="ts">
/**
 * S1 `/admin/users` "Pengurusan Pengguna - Admin Panel" (M02-T4; FR-M02-01..19), v2 staff theme.
 *
 * - 7 role stat tiles (all users, unaffected by the filters), a filter bar, three action buttons.
 * - Table of 25 rows per page: bulk select (own row excluded), "Aktif?" toggle, Edit / Pakej /
 *   Login As / Padam. The query string is the state; the form navigates and the list follows it.
 * - `useConfirm` for the toggle and Login As (same BM text as the native confirm), dialogs for delete
 *   and bulk delete.
 * - The table scrolls inside its card from `md`; below `md` every row is a card (`CardTable`).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { useApi, useFlash, useSession } from '@/composables'
import { DsFilterBar, DsPage, useConfirm } from '@/ds'

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
import CardCell from '../components/native/CardCell.vue'
import CardRow from '../components/native/CardRow.vue'
import CardTable from '../components/native/CardTable.vue'
import NativeCheckbox from '../components/native/NativeCheckbox.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
import UserDeleteModals from '../components/UserDeleteModals.vue'
import UserStatCards from '../components/UserStatCards.vue'
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
const from = computed(() => data.value?.meta.from ?? 1)
const summary = computed(() => {
  const meta = data.value?.meta
  if (!meta || rows.value.length === 0) return ''
  return `Menunjukkan ${String(meta.from ?? 1)}-${String(meta.to ?? rows.value.length)} daripada ${String(meta.totalItems)} hasil`
})
const activeCount = computed(
  () => [role.value, school.value, status.value].filter((v) => v !== '').length,
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

const SKELETON_ROWS = 5
const COLUMNS = [
  { key: 'select', label: 'Pilih' },
  { key: 'no', label: '#' },
  { key: 'name', label: 'Nama' },
  { key: 'email', label: 'Emel' },
  { key: 'phone', label: 'Telefon' },
  { key: 'role', label: 'Peranan' },
  { key: 'school', label: 'Sekolah' },
  { key: 'active', label: 'Aktif?' },
  { key: 'date', label: 'Tarikh' },
  { key: 'actions', label: 'Tindakan' },
]
</script>

<template>
  <DsPage data-testid="users-page">
    <template #actions>
      <UButton
        to="/admin/users/create"
        icon="i-ph-user-plus"
        label="Tambah"
        data-testid="users-add"
      />
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
    </template>

    <UserStatCards :counts="counts" :active-role="applied.role" />

    <DsFilterBar
      :active-count="activeCount"
      data-testid="users-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <template #search>
        <UInput
          v-model="search"
          type="text"
          name="search"
          aria-label="Cari"
          placeholder="Nama atau emel..."
          icon="i-ph-magnifying-glass"
          size="lg"
          class="md:w-64"
          data-testid="users-search"
        />
      </template>
      <NativeSelect
        id="users-role"
        v-model="role"
        name="role"
        aria-label="Peranan"
        class="md:w-48"
        data-testid="users-role"
      >
        <option value="">Semua Peranan</option>
        <option v-for="o in ROLE_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </NativeSelect>
      <NativeSelect
        id="users-school"
        v-model="school"
        name="school"
        aria-label="Sekolah"
        class="md:w-56"
        data-testid="users-school"
      >
        <option value="">Semua Sekolah</option>
        <option v-for="s in schoolOptions" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </NativeSelect>
      <NativeSelect
        id="users-status"
        v-model="status"
        name="is_active"
        aria-label="Status"
        class="md:w-40"
        data-testid="users-status"
      >
        <option value="">Semua</option>
        <option value="1">Aktif</option>
        <option value="0">Tidak Aktif</option>
      </NativeSelect>
    </DsFilterBar>

    <!-- Load failure: red box in place of the table + retry (design-system 7.4, INFERRED copy). -->
    <div v-if="error" class="flex flex-col gap-3" data-testid="users-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="users-retry" @click="reload()" />
      </div>
    </div>

    <CardTable v-else :columns="COLUMNS" caption="Senarai pengguna" data-testid="users-table">
      <template #header>
        <div
          v-if="selected.length > 0"
          class="flex items-center justify-between gap-3 bg-elevated p-3"
          data-testid="users-bulk-bar"
        >
          <span class="flex items-center gap-2 text-label text-default">
            <UIcon name="i-ph-check-square" class="size-4" aria-hidden="true" />
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
        <CardRow v-for="n in SKELETON_ROWS" :key="n" data-testid="users-skeleton">
          <CardCell v-for="c in COLUMNS.length" :key="c">
            <USkeleton class="h-4 w-full max-w-24" />
          </CardCell>
        </CardRow>
      </template>

      <CardRow v-else-if="rows.length === 0" data-testid="users-empty">
        <CardCell :colspan="COLUMNS.length">
          <UIcon name="i-ph-users" class="mx-auto mb-2 size-8 text-muted" aria-hidden="true" />
          <p class="text-label text-default">Tiada pengguna dijumpai</p>
          <p class="text-label text-muted">Cuba ubah kriteria carian anda</p>
        </CardCell>
      </CardRow>

      <template v-else>
        <CardRow
          v-for="(user, index) in rows"
          :key="user.id"
          data-testid="user-row"
          :data-user-id="user.id"
        >
          <CardCell label="Pilih">
            <NativeCheckbox
              v-if="user.id !== ownId"
              v-model="selected"
              :value="user.id"
              :aria-label="`Pilih ${user.name}`"
              data-testid="user-select"
            />
          </CardCell>
          <CardCell label="#">{{ from + index }}</CardCell>
          <CardCell label="Nama">
            <div class="flex min-w-0 items-center gap-2 text-label text-highlighted">
              <UAvatar
                :src="user.avatarUrl || undefined"
                :text="initialsOf(user.name)"
                alt=""
                size="sm"
              />
              <span class="min-w-0 break-words" data-testid="user-name">{{ user.name }}</span>
            </div>
          </CardCell>
          <CardCell label="Emel"
            ><span class="break-all">{{ user.email }}</span></CardCell
          >
          <CardCell label="Telefon"
            ><span class="text-nowrap">{{ user.phone || '-' }}</span></CardCell
          >
          <CardCell label="Peranan">
            <UBadge
              color="neutral"
              variant="subtle"
              :label="roleLabel(user.role)"
              data-testid="user-role"
            />
          </CardCell>
          <CardCell label="Sekolah">{{ user.school?.name || '-' }}</CardCell>
          <CardCell label="Aktif?">
            <form method="post" @submit.prevent="toggle(user)">
              <UButton
                type="submit"
                size="sm"
                variant="soft"
                :color="user.isActive ? 'success' : 'neutral'"
                :icon="user.isActive ? 'i-ph-check-circle' : 'i-ph-x-circle'"
                :label="user.isActive ? 'Aktif' : 'Tidak'"
                :loading="togglingId === user.id"
                :disabled="togglingId === user.id"
                data-testid="user-toggle"
              />
            </form>
          </CardCell>
          <CardCell label="Tarikh"
            ><span class="text-nowrap">{{ formatUserDate(user.createdAt) }}</span></CardCell
          >
          <CardCell label="Tindakan">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <UButton
                :to="`/admin/users/${user.id}/edit`"
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-ph-pencil-simple"
                label="Edit"
                data-testid="user-edit"
              />
              <UButton
                v-if="user.role === 'school_admin'"
                :to="`/admin/users/${user.id}/packages`"
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-ph-package"
                label="Pakej"
                data-testid="user-packages"
              />
              <form v-if="user.id !== ownId" method="post" @submit.prevent="loginAs(user)">
                <UButton
                  type="submit"
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-ph-sign-in"
                  label="Login As"
                  :disabled="busy"
                  data-testid="user-login-as"
                />
              </form>
              <UButton
                v-if="user.id !== ownId"
                type="button"
                size="sm"
                color="error"
                variant="soft"
                icon="i-ph-trash"
                aria-label="Padam"
                data-testid="user-delete"
                @click="deleting = { id: user.id, name: user.name }"
              />
            </div>
          </CardCell>
        </CardRow>
      </template>

      <template #footer>
        <div
          class="flex flex-wrap items-center justify-between gap-3 p-3 empty:hidden"
          data-testid="users-pager"
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
