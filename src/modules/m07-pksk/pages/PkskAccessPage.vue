<script setup lang="ts">
/**
 * S8 `/admin/pksk/access` "Akses PKSK" (M07-T4; FR-M07-45..53), v2 staff theme.
 *
 * - Three global KPI tiles (#15), unaffected by the search.
 * - "Beri Akses Baru" toggles the grant card; the form starts hidden on every page load, keeps its values
 *   while hidden and has no cancel button. The grant takes a raw numeric user id (SEC-M07-01); native
 *   validation only. 422 shows the message under "ID Pengguna".
 * - Search bar (GET `search`) with a chip, table (#14) in `grantedAt` desc order (DV-M07-09), 20 per page;
 *   a card per row below `md`.
 * - "Tarik" (active rows only) asks `useConfirm`, revokes (#17) and reloads with the flash.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsDataTable, DsEmptyState, DsFilterBar, DsPage, DsStatTile, useConfirm } from '@/ds'
import type { CardField } from '@/ds'

import {
  fetchPkskAccessList,
  fetchPkskAccessStats,
  fetchPkskPackages,
  grantPkskAccess,
  revokePkskAccess,
  type PkskAccessItem,
} from '../api/admin'
import AdminActiveFilters from '../components/admin/AdminActiveFilters.vue'
import AdminAlert from '../components/admin/AdminAlert.vue'
import AdminField from '../components/admin/AdminField.vue'
import AdminSection from '../components/admin/AdminSection.vue'
import NativeSelect from '../components/admin/native/NativeSelect.vue'
import {
  ACCESS_PATH,
  ACCESS_STATUS,
  COPY,
  displayDate,
  errorLines,
  fieldErrors,
  queryPage,
  queryText,
} from '../lib/admin'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  page: queryPage(route.query.page),
}))

const search = ref(queryText(route.query.search))
watch(
  () => route.query.search,
  (s) => {
    search.value = queryText(s)
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchPkskAccessList({ search: applied.value.search, page: applied.value.page }, { signal }),
  [() => route.query.search, () => route.query.page],
)
const { data: stats, reload: reloadStats } = useApi((signal) => fetchPkskAccessStats({ signal }))
const { data: packages } = useApi((signal) => fetchPkskPackages({ signal }))

const rows = computed<PkskAccessItem[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)
const pagerQuery = computed(() =>
  applied.value.search !== '' ? { search: applied.value.search } : {},
)
const chips = computed(() =>
  applied.value.search !== '' ? [{ key: 'search', label: `"${applied.value.search}"` }] : [],
)

async function submitSearch(): Promise<void> {
  const s = search.value.trim()
  const query = s !== '' ? { search: s } : {}
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: ACCESS_PATH, query })
  }
}

async function resetSearch(): Promise<void> {
  await router.push({ path: ACCESS_PATH })
}

function goToPage(page: number): void {
  void router.push({ path: ACCESS_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

// --- grant form (FR-M07-49..51) ---------------------------------------------------------------

const formOpen = ref(false)
const userId = ref('')
const packageId = ref('')
const expiresAt = ref('')
const granting = ref(false)
const grantErrors = ref<Record<string, string>>({})
const grantTop = ref<string[]>([])

// "Pakej": the first package is selected by default, no empty option.
watch(
  packages,
  (list) => {
    if (list && list.length > 0 && packageId.value === '') packageId.value = String(list[0]!.id)
  },
  { immediate: true },
)

async function refresh(message: string): Promise<void> {
  await Promise.all([reload(), reloadStats()])
  flash.show({ type: 'success', message })
}

async function grant(): Promise<void> {
  if (granting.value) return
  granting.value = true
  grantErrors.value = {}
  grantTop.value = []
  try {
    const result = await grantPkskAccess({
      userId: Number(userId.value),
      packageId: Number(packageId.value),
      expiresAt: expiresAt.value !== '' ? expiresAt.value : null,
    })
    // The page reloads: the form is hidden again and cleared.
    formOpen.value = false
    userId.value = ''
    expiresAt.value = ''
    packageId.value = packages.value && packages.value[0] ? String(packages.value[0].id) : ''
    if (applied.value.page > 1 || applied.value.search !== '') {
      flash.success(result.status)
      await router.push({ path: ACCESS_PATH })
      await Promise.all([reload(), reloadStats()])
    } else {
      await refresh(result.status)
    }
  } catch (err) {
    const fields = fieldErrors(err)
    grantErrors.value = fields
    const unmatched = Object.entries(fields)
      .filter(([name]) => name !== 'userId')
      .map(([, text]) => text)
    grantTop.value = Object.keys(fields).length === 0 ? errorLines(err) : unmatched
  } finally {
    granting.value = false
  }
}

// --- revoke (FR-M07-52) -----------------------------------------------------------------------

const revoking = ref(false)

async function revoke(row: PkskAccessItem): Promise<void> {
  if (revoking.value) return
  if (!(await confirm({ message: COPY.confirmRevoke, tone: 'danger' }))) return
  revoking.value = true
  try {
    const result = await revokePkskAccess(row.id)
    await refresh(result.status)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
    // e.g. 409: the row is no longer active, so drop the stale "Aktif" row and its "Tarik".
    await Promise.all([reload(), reloadStats()])
  } finally {
    revoking.value = false
  }
}

const STAT_TILES = [
  {
    key: 'activeTotal',
    testid: 'stat-active',
    label: 'Jumlah Akses Aktif',
    icon: 'i-ph-key',
    accent: 'action',
  },
  { key: 't1', testid: 'stat-t1', label: 'Akses T1', icon: 'i-ph-number-one', accent: 'friend' },
  { key: 't4', testid: 'stat-t4', label: 'Akses T4', icon: 'i-ph-number-four', accent: 'trial' },
] as const

const statusColor = (s: PkskAccessItem['displayStatus']) => STATUS_COLOR[s]
const statusLabel = (s: PkskAccessItem['displayStatus']) => ACCESS_STATUS[s].label
const STATUS_COLOR = { active: 'success', expired: 'neutral', revoked: 'error' } as const

interface TableRow extends Record<string, unknown> {
  id: number
  userName: string
  packageName: string
  granter: string
  granted: string
  expires: string
  raw: PkskAccessItem
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    userName: r.user.name,
    packageName: r.package.name,
    granter: r.grantedBy?.name ?? '-',
    granted: displayDate(r.grantedAt),
    expires: r.expiresAt ? displayDate(r.expiresAt) : 'Tiada had',
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'userName', header: 'Pengguna' },
  { accessorKey: 'packageName', header: 'Pakej' },
  { accessorKey: 'granter', header: 'Diberi Oleh' },
  { accessorKey: 'granted', header: 'Tarikh' },
  { accessorKey: 'expires', header: 'Tamat' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'packageName', label: 'Pakej' },
  { key: 'granter', label: 'Diberi Oleh' },
  { key: 'granted', label: 'Tarikh' },
  { key: 'expires', label: 'Tamat' },
]
</script>

<template>
  <DsPage data-testid="pksk-access-page">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <p class="min-w-0 text-body text-muted">Urus akses premium PKSK pengguna</p>
      <UButton
        type="button"
        icon="i-ph-plus"
        label="Beri Akses Baru"
        size="md"
        class="min-h-11"
        :aria-expanded="formOpen"
        data-testid="grant-toggle"
        @click="formOpen = !formOpen"
      />
    </div>

    <!-- Three global KPI tiles (#15). -->
    <section v-if="stats" class="grid grid-cols-2 gap-4 sm:grid-cols-3" data-testid="access-stats">
      <div v-for="t in STAT_TILES" :key="t.key" :data-testid="t.testid">
        <DsStatTile :value="stats[t.key]" :unit="t.label" :icon="t.icon" :accent="t.accent" />
      </div>
    </section>

    <!-- "Beri Akses": the grant form. -->
    <div v-show="formOpen" data-testid="grant-card">
      <form method="post" data-testid="grant-form" @submit.prevent="grant">
        <AdminSection title="Beri Akses" icon="i-ph-key" accent="heat">
          <AdminAlert :messages="grantTop" data-testid="grant-alert" />
          <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <AdminField for="grant-user" label="ID Pengguna" :error="grantErrors.userId">
              <UInput
                id="grant-user"
                v-model="userId"
                type="number"
                name="user_id"
                required
                placeholder="User ID"
                size="md"
                class="w-full"
                :color="grantErrors.userId ? 'error' : undefined"
                data-testid="grant-user"
              />
            </AdminField>
            <AdminField for="grant-package" label="Pakej">
              <NativeSelect
                id="grant-package"
                v-model="packageId"
                name="pksk_package_id"
                required
                data-testid="grant-package"
              >
                <option v-for="p in packages ?? []" :key="p.id" :value="String(p.id)">
                  {{ p.name }} ({{ p.level }})
                </option>
              </NativeSelect>
            </AdminField>
            <AdminField for="grant-expires" label="Tamat Tempoh">
              <UInput
                id="grant-expires"
                v-model="expiresAt"
                type="date"
                name="expires_at"
                size="md"
                class="w-full"
                data-testid="grant-expires"
              />
            </AdminField>
          </div>
          <div class="flex justify-end">
            <UButton
              type="submit"
              icon="i-ph-check"
              label="Beri Akses"
              size="md"
              class="min-h-11"
              :loading="granting"
              :disabled="granting"
              data-testid="grant-submit"
            />
          </div>
        </AdminSection>
      </form>
    </div>

    <div class="flex flex-col gap-3">
      <DsFilterBar
        :active-count="chips.length"
        data-testid="access-search-form"
        @apply="submitSearch"
        @reset="resetSearch"
      >
        <template #search>
          <UInput
            v-model="search"
            type="text"
            name="search"
            aria-label="Cari"
            placeholder="Cari nama / email..."
            icon="i-ph-magnifying-glass"
            size="md"
            class="w-full md:min-w-72 md:grow"
            data-testid="access-search"
          />
        </template>
      </DsFilterBar>
      <AdminActiveFilters :chips="chips" @remove="resetSearch" @reset="resetSearch" />
    </div>

    <div v-if="error" class="flex flex-col gap-4" data-testid="pksk-access-error">
      <AdminAlert :messages="errorLines(error)" />
      <div><UButton label="Cuba Lagi" class="min-h-11" @click="reload()" /></div>
    </div>

    <UCard v-else-if="!firstLoad && rows.length === 0" data-testid="access-empty">
      <DsEmptyState :title="COPY.accessEmpty" icon="i-ph-lock" />
    </UCard>

    <DsDataTable
      v-else
      :data="tableRows"
      :columns="columns"
      caption="Senarai akses PKSK"
      :loading="firstLoad"
      :total="total"
      :page-size="data?.meta.pageSize ?? 20"
      :page="applied.page"
      card-title="userName"
      :card-fields="cardFields"
      :empty-label="COPY.accessEmpty"
      data-testid="access-table"
      @update:page="goToPage"
    >
      <template #userName-cell="{ row }">
        <div
          class="flex min-w-40 flex-col gap-1"
          data-testid="access-row"
          :data-access-id="row.original.id"
        >
          <p class="line-clamp-2 text-label text-highlighted" data-testid="a-name">
            {{ row.original.raw.user.name }}
          </p>
          <p class="text-caption break-all text-muted" data-testid="a-email">
            {{ row.original.raw.user.email }}
          </p>
        </div>
      </template>
      <template #packageName-cell="{ row }">
        <UBadge
          color="success"
          variant="subtle"
          :label="row.original.packageName"
          data-testid="a-package"
        />
      </template>
      <template #granter-cell="{ row }">
        <span data-testid="a-granter">{{ row.original.granter }}</span>
      </template>
      <template #granted-cell="{ row }">
        <span class="text-nowrap" data-testid="a-granted">{{ row.original.granted }}</span>
      </template>
      <template #expires-cell="{ row }">
        <span class="text-nowrap" data-testid="a-expires">{{ row.original.expires }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor(row.original.raw.displayStatus)"
          variant="subtle"
          :label="statusLabel(row.original.raw.displayStatus)"
          data-testid="a-status"
        />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          v-if="row.original.raw.displayStatus === 'active'"
          type="button"
          color="error"
          variant="soft"
          icon="i-ph-prohibit"
          label="Tarik"
          class="min-h-11"
          :disabled="revoking"
          data-testid="a-revoke"
          @click="revoke(row.original.raw)"
        />
      </template>
      <template #card-actions="{ row }">
        <UButton
          v-if="(row as unknown as TableRow).raw.displayStatus === 'active'"
          type="button"
          color="error"
          variant="soft"
          icon="i-ph-prohibit"
          label="Tarik"
          class="min-h-11"
          :disabled="revoking"
          @click="revoke((row as unknown as TableRow).raw)"
        />
      </template>
    </DsDataTable>
  </DsPage>
</template>
