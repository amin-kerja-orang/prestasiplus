<script setup lang="ts">
/**
 * S8 `/admin/pksk/access` "Akses PKSK" (M07-T4; FR-M07-45..53).
 *
 * - Three global stat cards (#15), `grid-cols-3` at every width, unaffected by the search.
 * - "Beri Akses Baru" toggles the grant form (fade/slide); the form starts hidden on every page
 *   load, keeps its values while hidden and has no cancel button. The grant takes a raw numeric
 *   user id (SEC-M07-01); native validation only. 422 shows the message under "ID Pengguna".
 * - Search card (GET `search`), table (#14) in `grantedAt` desc order (DV-M07-09), 20 per page.
 * - "Tarik" (active rows only) asks a native confirm, revokes (#17) and reloads with the flash.
 */
import { Ban, Check, Key, Lock, Plus, Search } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_ERROR_MODIFIER, FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative, useApi, useFlash } from '@/composables'

import {
  fetchPkskAccessList,
  fetchPkskAccessStats,
  fetchPkskPackages,
  grantPkskAccess,
  revokePkskAccess,
  type PkskAccessItem,
} from '../api/admin'
import AdminStatCard from '../components/admin/AdminStatCard.vue'
import FormField from '../components/admin/FormField.vue'
import {
  ACCESS_PATH,
  ACCESS_STATUS,
  COPY,
  GREEN_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  displayDate,
  errorLines,
  fieldErrors,
  queryPage,
  queryText,
} from '../lib/admin'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

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
const pagerQuery = computed(() =>
  applied.value.search !== '' ? { search: applied.value.search } : {},
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
  if (!confirmNative(COPY.confirmRevoke)) return
  if (revoking.value) return
  revoking.value = true
  try {
    const result = await revokePkskAccess(row.id)
    await refresh(result.status)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    revoking.value = false
  }
}

const COLUMNS = [
  'Pengguna',
  'Pakej',
  'Diberi Oleh',
  'Tarikh',
  'Tamat',
  'Status',
  'Tindakan',
] as const
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="pksk-access-page">
    <!-- Three global stat cards (#15). -->
    <div v-if="stats" class="grid grid-cols-3 gap-3 sm:gap-4" data-testid="access-stats">
      <AdminStatCard
        testid="stat-active"
        :value="stats.activeTotal"
        label="Jumlah Akses Aktif"
        color-class="text-indigo-600"
      />
      <AdminStatCard
        testid="stat-t1"
        :value="stats.t1"
        label="Akses T1"
        color-class="text-blue-600"
      />
      <AdminStatCard
        testid="stat-t4"
        :value="stats.t4"
        label="Akses T4"
        color-class="text-purple-600"
      />
    </div>

    <!-- "Beri Akses": the toggle and the grant form. -->
    <section class="rounded-2xl bg-white p-4 shadow sm:p-6" data-testid="grant-card">
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
          <Key class="h-5 w-5 text-amber-500" aria-hidden="true" />
          Beri Akses
        </h2>
        <button
          type="button"
          :class="GREEN_BUTTON_CLASS"
          data-testid="grant-toggle"
          @click="formOpen = !formOpen"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          Beri Akses Baru
        </button>
      </div>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <form
          v-show="formOpen"
          method="post"
          class="mt-4 grid gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4 md:items-end"
          data-testid="grant-form"
          @submit.prevent="grant"
        >
          <AlertBox
            :messages="grantTop"
            box-class="md:col-span-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            data-testid="grant-alert"
          />
          <FormField id="grant-user" label="ID Pengguna" :error="grantErrors.userId">
            <input
              id="grant-user"
              v-model="userId"
              type="number"
              name="user_id"
              required
              placeholder="User ID"
              :class="[FORM_INPUT_CLASS, 'min-h-11', grantErrors.userId ? FORM_ERROR_MODIFIER : '']"
              data-testid="grant-user"
            />
          </FormField>
          <FormField id="grant-package" label="Pakej">
            <select
              id="grant-package"
              v-model="packageId"
              name="pksk_package_id"
              required
              :class="[FORM_INPUT_CLASS, 'min-h-11']"
              data-testid="grant-package"
            >
              <option v-for="p in packages ?? []" :key="p.id" :value="String(p.id)">
                {{ p.name }} ({{ p.level }})
              </option>
            </select>
          </FormField>
          <FormField id="grant-expires" label="Tamat Tempoh">
            <input
              id="grant-expires"
              v-model="expiresAt"
              type="date"
              name="expires_at"
              :class="[FORM_INPUT_CLASS, 'min-h-11']"
              data-testid="grant-expires"
            />
          </FormField>
          <button
            type="submit"
            :disabled="granting"
            :class="[PRIMARY_BUTTON_CLASS, 'disabled:cursor-not-allowed disabled:opacity-50']"
            data-testid="grant-submit"
          >
            <LoadingSpinner v-if="granting" class="h-4 w-4" />
            <Check v-else class="h-4 w-4" aria-hidden="true" />
            Beri Akses
          </button>
        </form>
      </Transition>
    </section>

    <!-- Search card: GET form. -->
    <form
      method="get"
      class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow"
      data-testid="access-search-form"
      @submit.prevent="submitSearch"
    >
      <input
        v-model="search"
        type="text"
        name="search"
        placeholder="Cari nama / email..."
        :class="[FORM_INPUT_CLASS, 'min-h-11 min-w-0 flex-1 basis-48']"
        data-testid="access-search"
      />
      <button type="submit" :class="PRIMARY_BUTTON_CLASS" data-testid="access-search-submit">
        <Search class="h-4 w-4" aria-hidden="true" />
        Cari
      </button>
    </form>

    <AlertBox v-if="error" :messages="errorLines(error)" data-testid="pksk-access-error" />

    <DataTableCard v-else-if="data" :min-width="760">
      <table :class="T.table" data-testid="access-table">
        <thead class="bg-slate-50">
          <tr>
            <th v-for="label in COLUMNS" :key="label" scope="col" :class="T.th">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0" :class="T.row" data-testid="access-empty">
            <td :colspan="COLUMNS.length" class="px-4 py-12 text-center text-slate-400">
              <Lock class="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
              <p class="font-medium text-slate-500">{{ COPY.accessEmpty }}</p>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="[T.row, 'align-middle']"
            data-testid="access-row"
            :data-access-id="row.id"
          >
            <td :class="T.td">
              <p class="font-semibold text-slate-800" data-testid="a-name">{{ row.user.name }}</p>
              <p class="text-xs text-slate-500" data-testid="a-email">{{ row.user.email }}</p>
            </td>
            <td :class="T.td">
              <span
                class="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-green-700"
                data-testid="a-package"
                >{{ row.package.name }}</span
              >
            </td>
            <td :class="T.td" data-testid="a-granter">{{ row.grantedBy?.name ?? '-' }}</td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="a-granted">
              {{ displayDate(row.grantedAt) }}
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="a-expires">
              {{ row.expiresAt ? displayDate(row.expiresAt) : 'Tiada had' }}
            </td>
            <td :class="T.td">
              <span
                :class="[
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                  ACCESS_STATUS[row.displayStatus].pill,
                ]"
                data-testid="a-status"
                >{{ ACCESS_STATUS[row.displayStatus].label }}</span
              >
            </td>
            <td :class="T.td">
              <button
                v-if="row.displayStatus === 'active'"
                type="button"
                class="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 lg:min-h-9"
                :disabled="revoking"
                data-testid="a-revoke"
                @click="revoke(row)"
              >
                <Ban class="h-4 w-4" aria-hidden="true" />
                Tarik
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <div v-if="data.meta.totalPages > 1" class="border-t border-slate-100 px-4 py-3">
          <LaravelPager
            :page="applied.page"
            :total="total"
            :per-page="data.meta.pageSize"
            :path="ACCESS_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
