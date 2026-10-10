<script setup lang="ts">
/**
 * S6 `/admin-sekolah/pelajar` and S7 `/admin-sekolah/guru` (SRS M27 Part B FR-M27-88 to 93, 99 to 103, 119;
 * BR-M27-30, 36, 40). One list for both roles (`role` prop): the role and the school are fixed by the server,
 * there is no role, school or class control. Top to bottom: breadcrumb, one count card, the header-actions row
 * ("{n} pengguna dijumpai", "Eksport CSV", "Tambah Pelajar" / "Cipta Pengguna"), the GET filter card, the table.
 *
 * The query string is the state (`is_active`, `search`, `page`). "Eksport CSV" sends the Status and Cari values
 * as they stand in the form, whether or not "Cari" was pressed (FR-M27-119). The S7 "Aktif?" button asks the native
 * confirm and switches the teacher (FR-M27-102); S6 shows a read-only badge (G1-1). Errors: the server message in a
 * red box (FR-M27-48, no M27 copy); a 403 renders the global 403 page in place.
 */
import { FileSpreadsheet, Funnel, GraduationCap, Presentation, Search, ToggleRight, UserPlus, Users } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { isApiError, type ListResult } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative, useApi, useFlash, useSession } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { formatDateKey } from '@/lib/time'
import { clock } from '@/lib/time/clock'
import { saveBlob } from '@/lib/save-blob'

import {
  downloadPupilsCsv,
  downloadTeachersCsv,
  fetchSchoolPupils,
  fetchSchoolTeachers,
  toggleSchoolTeacherActive,
  type SchoolPupilRow,
  type SchoolTeacherRow,
  type SchoolUserListMeta,
} from '../../api/school-admin'
import PupilRow from './PupilRow.vue'
import TeacherRow from './TeacherRow.vue'
import {
  DASHBOARD_PATH,
  errorLines,
  formatCount,
  PUPIL_CREATE_PATH,
  ROLE_CONFIG,
  TEACHER_CREATE_PATH,
  type SchoolUserRole,
} from './users-format'

type ListRow = SchoolPupilRow | SchoolTeacherRow

const props = defineProps<{ role: SchoolUserRole }>()

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()
const { user: me } = useSession()

const cfg = computed(() => ROLE_CONFIG[props.role])
const isPupil = computed(() => props.role === 'student')

// FR-M27-44: header title, sub-line = the school name (the session user's school).
watch(
  () => [props.role, me.value?.school?.name] as const,
  () => {
    pageMeta.setHeader({
      title: cfg.value.listTitle,
      ...(me.value?.school?.name ? { subtitle: me.value.school.name } : {}),
    })
  },
  { immediate: true },
)

function queryText(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => {
  const active = queryText(route.query.is_active)
  return {
    isActive: active === '1' ? true : active === '0' ? false : null,
    search: queryText(route.query.search).trim(),
    page: Math.max(1, Number.parseInt(queryText(route.query.page), 10) || 1),
  }
})

// Draft values of the form controls; re-synced when the URL changes (back / forward).
const status = ref(queryText(route.query.is_active))
const search = ref(queryText(route.query.search))
watch(
  () => [route.query.is_active, route.query.search] as const,
  ([a, q]) => {
    status.value = queryText(a)
    search.value = queryText(q)
  },
)

function fetchPage(signal: AbortSignal): Promise<ListResult<ListRow, SchoolUserListMeta>> {
  const q = {
    isActive: applied.value.isActive,
    search: applied.value.search || null,
    page: applied.value.page,
    signal,
  }
  return props.role === 'student' ? fetchSchoolPupils(q) : fetchSchoolTeachers(q)
}

const { data, error, reload } = useApi(fetchPage, [
  () => props.role,
  () => route.query.is_active,
  () => route.query.search,
  () => route.query.page,
])

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

const pupilRows = computed<SchoolPupilRow[]>(() =>
  isPupil.value ? ((data.value?.data ?? []) as SchoolPupilRow[]) : [],
)
const teacherRows = computed<SchoolTeacherRow[]>(() =>
  isPupil.value ? [] : ((data.value?.data ?? []) as SchoolTeacherRow[]),
)
const rowCount = computed(() => data.value?.data.length ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)
const from = computed(() => data.value?.meta.from ?? 1)

function filterQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (status.value !== '') out.is_active = status.value
  const s = search.value.trim()
  if (s !== '') out.search = s
  return out
}

/** The applied filters as the query of the pager links and of the "same filter" comparison. */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
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
    await router.push({ path: cfg.value.listPath, query })
  }
}

function goToPage(page: number): void {
  void router.push({ path: cfg.value.listPath, query: { ...pagerQuery.value, page: String(page) } })
}

// --- "Aktif?" of S7 (FR-M27-102): native confirm, then the toggle and a reload at the same URL.
const togglingId = ref<number | null>(null)

async function toggle(row: SchoolTeacherRow): Promise<void> {
  if (!confirmNative('Pasti untuk menukar status pengguna ini?')) return
  if (togglingId.value !== null) return
  togglingId.value = row.id
  try {
    const result = await toggleSchoolTeacherActive(row.id)
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    togglingId.value = null
  }
}

// --- "Eksport CSV" (FR-M27-119): the form values as they stand.
const exporting = ref(false)

async function exportCsv(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    const q = {
      isActive: status.value === '' ? null : status.value,
      search: search.value.trim() === '' ? null : search.value.trim(),
    }
    const file = isPupil.value ? await downloadPupilsCsv(q) : await downloadTeachersCsv(q)
    const fallback = `users-${isPupil.value ? 'pelajar' : 'guru'}-${formatDateKey(clock.now())}.csv`
    saveBlob(file.blob, file.filename ?? fallback)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    exporting.value = false
  }
}

const SKELETON_ROWS = 5
const COLUMN_COUNT = 9
const HEADERS = computed(() =>
  isPupil.value
    ? ['#', 'Nama', 'Emel', 'Telefon', 'Tingkatan', 'Kelas', 'Aktif?', 'Tarikh', 'Tindakan']
    : ['#', 'Nama', 'Emel', 'Telefon', 'Kelas', 'Login Terakhir', 'Aktif?', 'Tarikh', 'Tindakan'],
)

const HEAD = 'px-2.5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap'
const LABEL = 'mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700'
const ACTION_BTN =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60 sm:w-auto'
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" :data-testid="`${cfg.testid}-page`">
    <!-- FR-M27-44: breadcrumb "← Dashboard Sekolah", separator, the screen title in bold (not a link). -->
    <nav class="flex min-w-0 flex-wrap items-center gap-x-2 text-sm" data-testid="user-breadcrumb">
      <RouterLink
        :to="DASHBOARD_PATH"
        class="inline-flex min-h-11 items-center text-slate-500 hover:text-slate-700"
        data-testid="user-crumb-back"
        >← Dashboard Sekolah</RouterLink
      >
      <span class="text-slate-300">/</span>
      <span class="font-bold text-slate-700" data-testid="user-crumb-current">{{
        cfg.listTitle
      }}</span>
    </nav>

    <!-- FR-M27-88 / 99: one count card, unaffected by the filters. -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" data-testid="user-count-card">
      <div class="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4 shadow">
        <span
          :class="[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            isPupil ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600',
          ]"
          aria-hidden="true"
        >
          <GraduationCap v-if="isPupil" class="h-5 w-5" />
          <Presentation v-else class="h-5 w-5" />
        </span>
        <span class="min-w-0">
          <span
            v-if="data"
            class="block font-heading text-xl leading-tight font-bold text-slate-800"
            data-testid="user-count"
            >{{ formatCount(data.meta.counts?.total ?? 0) }}</span
          >
          <span v-else class="block h-6 w-10 animate-pulse rounded bg-slate-100"></span>
          <span class="block text-xs leading-tight text-slate-500" data-testid="user-count-label">{{
            cfg.cardLabel
          }}</span>
        </span>
      </div>
    </section>

    <!-- FR-M27-88: text left, buttons right; at 375 the buttons wrap below the text, each full width. -->
    <div
      class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      data-testid="user-actions-row"
    >
      <p class="text-sm font-medium text-slate-600" data-testid="user-found">
        <template v-if="data">{{ formatCount(data.meta.totalItems) }} pengguna dijumpai</template>
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          title="Muat turun senarai mengikut tapisan di atas"
          :disabled="exporting"
          :class="[ACTION_BTN, 'bg-teal-600 hover:bg-teal-700']"
          data-testid="user-export"
          @click="exportCsv"
        >
          <FileSpreadsheet class="h-4 w-4" aria-hidden="true" />
          Eksport CSV
        </button>
        <RouterLink
          :to="isPupil ? PUPIL_CREATE_PATH : TEACHER_CREATE_PATH"
          :class="[ACTION_BTN, 'bg-indigo-600 hover:bg-indigo-700']"
          data-testid="user-add"
        >
          <UserPlus class="h-4 w-4" aria-hidden="true" />
          {{ isPupil ? 'Tambah Pelajar' : 'Cipta Pengguna' }}
        </RouterLink>
      </div>
    </div>

    <!-- FR-M27-89: Status, Cari, submit "Cari"; no role, school or class control. -->
    <form
      method="get"
      class="grid grid-cols-1 items-end gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_2fr_auto]"
      data-testid="user-filter"
      @submit.prevent="submitFilter"
    >
      <div class="min-w-0">
        <label for="user-status" :class="LABEL"
          ><ToggleRight class="h-4 w-4" aria-hidden="true" />Status</label
        >
        <select
          id="user-status"
          v-model="status"
          name="is_active"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="user-status-filter"
        >
          <option value="">Semua</option>
          <option value="1">Aktif</option>
          <option value="0">Tidak Aktif</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="user-search" :class="LABEL"
          ><Search class="h-4 w-4" aria-hidden="true" />Cari</label
        >
        <input
          id="user-search"
          v-model="search"
          type="text"
          name="search"
          placeholder="Nama atau emel..."
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="user-search"
        />
      </div>
      <button
        type="submit"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:col-span-2 lg:col-span-1"
        data-testid="user-search-submit"
      >
        <Funnel class="h-4 w-4" aria-hidden="true" />
        Cari
      </button>
    </form>

    <AlertBox
      v-if="error && !refused"
      :messages="errorLines(error)"
      data-testid="user-error"
    />

    <DataTableCard v-else-if="!refused" :min-width="880">
      <table :class="T.table" data-testid="user-table">
        <thead class="bg-slate-50">
          <tr>
            <th v-for="label in HEADERS" :key="label" scope="col" :class="HEAD">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="user-skeleton">
              <td v-for="c in COLUMN_COUNT" :key="c" class="px-2.5 py-3">
                <div class="h-4 w-full max-w-24 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <tr v-else-if="rowCount === 0" :class="T.row" data-testid="user-empty">
            <td :colspan="COLUMN_COUNT" class="px-4 py-12 text-center text-slate-400">
              <Users class="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
              <p class="font-medium text-slate-500">Tiada pengguna dijumpai</p>
              <p class="text-sm">Cuba ubah kriteria carian anda</p>
            </td>
          </tr>

          <template v-else-if="isPupil">
            <PupilRow
              v-for="(row, i) in pupilRows"
              :key="row.id"
              :row="row"
              :index="from + i"
            />
          </template>
          <template v-else>
            <TeacherRow
              v-for="(row, i) in teacherRows"
              :key="row.id"
              :row="row"
              :index="from + i"
              :toggling="togglingId === row.id"
              @toggle="toggle"
            />
          </template>
        </tbody>
      </table>

      <template #footer>
        <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="user-pager">
          <LaravelPager
            v-if="data && rowCount > 0"
            :page="data.meta.page"
            :total="data.meta.totalItems"
            :per-page="data.meta.pageSize"
            :path="cfg.listPath"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
