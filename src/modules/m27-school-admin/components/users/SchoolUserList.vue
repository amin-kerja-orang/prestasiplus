<script setup lang="ts">
/**
 * S6 `/admin-sekolah/pelajar` and S7 `/admin-sekolah/guru` (SRS M27 Part B FR-M27-88 to 93, 99 to 103, 119;
 * BR-M27-30, 36, 40). One list for both roles (`role` prop): the role and the school are fixed by the server,
 * there is no role, school or class control. Top to bottom: back link, one count tile, the header-actions row
 * ("{n} pengguna dijumpai", "Eksport CSV", "Tambah Pelajar" / "Cipta Pengguna"), the filter bar, the table
 * (card list below `md`).
 *
 * The query string is the state (`is_active`, `search`, `page`). "Eksport CSV" sends the Status and Cari values
 * as they stand in the form, whether or not "Cari" was pressed (FR-M27-119). The S7 "Aktif?" button asks the
 * confirm (`useConfirm`) and switches the teacher (FR-M27-102); S6 shows a read-only badge (G1-1). Errors: the
 * server message in an alert (FR-M27-48, no M27 copy); a 403 renders the global 403 page in place.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

import { isApiError, type ListResult } from '@/api'
import { isHttpMode } from '@/api/mode'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash, useSession } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  DsBackLink,
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsFormField,
  DsIdentity,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatTile,
  DsStatusBadge,
  useConfirm,
  type CardField,
} from '@/ds'
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
import ImpersonateButton from './ImpersonateButton.vue'
import PendingTeacherCallout from './PendingTeacherCallout.vue'
import UserRowActions from './UserRowActions.vue'
import {
  DASHBOARD_PATH,
  errorLines,
  formatCount,
  formatDate,
  lastLoginText,
  phoneText,
  PUPIL_CREATE_PATH,
  PUPIL_LIST_PATH,
  ROLE_CONFIG,
  TEACHER_CREATE_PATH,
  TEACHER_LIST_PATH,
  type SchoolUserRole,
} from './users-format'

type ListRow = SchoolPupilRow | SchoolTeacherRow

interface Item extends Record<string, unknown> {
  id: number
  index: number
  name: string
  initials: string
  email: string
  phone: string
  grade: string
  kelas: string
  lastLogin: string
  isActive: boolean
  date: string
  canEdit: boolean
  editTo: string
}

const props = defineProps<{ role: SchoolUserRole }>()
/** http mode: impersonation has no endpoint (UD-2, replaced by POST /session/mode), so no "Menyamar" button. */
const http = isHttpMode()

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()
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

const rowCount = computed(() => data.value?.data.length ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)
const from = computed(() => data.value?.meta.from ?? 1)
const activeCount = computed(() => (status.value !== '' ? 1 : 0))

const items = computed<Item[]>(() =>
  (data.value?.data ?? []).map((row, i) => {
    const pupil = isPupil.value ? (row as SchoolPupilRow) : null
    const teacher = isPupil.value ? null : (row as SchoolTeacherRow)
    return {
      id: row.id,
      index: from.value + i,
      name: row.name,
      initials: row.initials,
      email: row.email,
      phone: phoneText(row.phone),
      grade: pupil ? (pupil.gradeLabel ?? '-') : '',
      kelas: pupil
        ? pupil.classNames.length > 0
          ? pupil.classNames.join(', ')
          : '-'
        : teacher && teacher.classCount > 0
          ? `${teacher.classCount} kelas`
          : '-',
      lastLogin: teacher ? lastLoginText(teacher.lastLoginAt) : '',
      isActive: row.isActive,
      date: formatDate(row.createdAt),
      canEdit: row.canEdit,
      editTo: `${isPupil.value ? PUPIL_LIST_PATH : TEACHER_LIST_PATH}/${row.id}`,
    }
  }),
)

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

async function resetFilter(): Promise<void> {
  status.value = ''
  search.value = ''
  await router.push({ path: cfg.value.listPath, query: {} })
}

function goToPage(page: number): void {
  void router.push({ path: cfg.value.listPath, query: { ...pagerQuery.value, page: String(page) } })
}

// --- "Aktif?" of S7 (FR-M27-102): confirm, then the toggle and a reload at the same URL.
const togglingId = ref<number | null>(null)

async function toggle(id: number): Promise<void> {
  if (togglingId.value !== null) return
  if (!(await confirm({ message: 'Pasti untuk menukar status pengguna ini?' }))) return
  togglingId.value = id
  try {
    const result = await toggleSchoolTeacherActive(id)
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

// Fixed layout: a width per column, and the lower-priority columns drop out below a breakpoint so every kept column
// is readable without clipping (SW6-01, DV-M27-24). The table card is ~696px wide at 768 and ~952px at 1280:
//   below `xl`  #, Nama, Emel, Aktif?, Tindakan;
//   from `xl`   + Tingkatan and Kelas (pupil) / Kelas (teacher);
//   from `2xl`  + Telefon (pupil) / Telefon and Login Terakhir (teacher).
// Tarikh never shows in the table: the card is capped at ~1080px inside, and nine columns plus a 20-character name
// need ~1110px. The column stays in the DOM (header and cell texts) for the unit and e2e specs.
// `UTable` reads per-cell classes from the column meta key `class`; the key is computed so the class linter
// does not read it as a class list. Full class strings: Tailwind reads the source text.
// eslint-disable-next-line pp/ds-class-allowlist -- an object key, not a class list
const META_CLASS = 'class'
const XL = 'hidden xl:table-cell'
const XXL = 'hidden 2xl:table-cell'
const WIDTHS: Record<string, string> = {
  index: 'w-12',
  name: 'w-48 xl:w-64',
  email: 'w-44',
  phone: `w-28 ${XXL}`,
  grade: `w-24 ${XL}`,
  kelas: `w-28 ${XL}`,
  lastLogin: `w-32 ${XXL}`,
  isActive: 'w-24',
  date: 'hidden',
  actions: 'w-40',
}
const sized = (cols: TableColumn<Item>[]): TableColumn<Item>[] =>
  cols.map((c) => {
    const key = String(c.id ?? (c as { accessorKey?: string }).accessorKey)
    // The teacher has one more visible column from `2xl` and an "Aktif?" button (icon + label, wider than the
    // pupil's badge), so the name and that column give way a little.
    const w = isPupil.value
      ? WIDTHS[key]
      : key === 'name'
        ? 'w-48 xl:w-64 2xl:w-56'
        : key === 'isActive'
          ? 'w-28'
          : WIDTHS[key]
    return w ? { ...c, meta: { [META_CLASS]: { th: w, td: w } } } : c
  })

const columns = computed<TableColumn<Item>[]>(() =>
  sized(
    isPupil.value
      ? [
          { accessorKey: 'index', header: '#' },
          { accessorKey: 'name', header: 'Nama' },
          { accessorKey: 'email', header: 'Emel' },
          { accessorKey: 'phone', header: 'Telefon' },
          { accessorKey: 'grade', header: 'Tingkatan' },
          { accessorKey: 'kelas', header: 'Kelas' },
          { accessorKey: 'isActive', header: 'Aktif?' },
          { accessorKey: 'date', header: 'Tarikh' },
          { id: 'actions', header: 'Tindakan' },
        ]
      : [
          { accessorKey: 'index', header: '#' },
          { accessorKey: 'name', header: 'Nama' },
          { accessorKey: 'email', header: 'Emel' },
          { accessorKey: 'phone', header: 'Telefon' },
          { accessorKey: 'kelas', header: 'Kelas' },
          { accessorKey: 'lastLogin', header: 'Login Terakhir' },
          { accessorKey: 'isActive', header: 'Aktif?' },
          { accessorKey: 'date', header: 'Tarikh' },
          { id: 'actions', header: 'Tindakan' },
        ],
  ),
)

const cardFields = computed<CardField[]>(() =>
  isPupil.value
    ? [
        { key: 'email', label: 'Emel' },
        { key: 'phone', label: 'Telefon' },
        { key: 'grade', label: 'Tingkatan' },
        { key: 'kelas', label: 'Kelas' },
      ]
    : [
        { key: 'email', label: 'Emel' },
        { key: 'phone', label: 'Telefon' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'lastLogin', label: 'Login Terakhir' },
      ],
)

function openRow(row: Item): void {
  if (row.canEdit) void router.push(row.editTo)
}
</script>

<template>
  <DsPage :data-testid="`${cfg.testid}-page`">
    <DsBackLink :to="DASHBOARD_PATH" label="Dashboard Sekolah" data-testid="user-crumb-back" />

    <!-- FR-M27-88 / 99: one count tile, unaffected by the filters. -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" data-testid="user-count-card">
      <USkeleton v-if="!data" class="h-24 w-full" />
      <DsStatTile
        v-else
        :value="formatCount(data.meta.counts?.total ?? 0)"
        :unit="cfg.cardLabel"
        :icon="isPupil ? 'graduation-cap' : 'chalkboard-teacher'"
        :accent="isPupil ? 'action' : 'friend'"
      />
    </section>

    <!-- FR-M27-88: text left, buttons right; at 375 the buttons wrap below the text. -->
    <div
      class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      data-testid="user-actions-row"
    >
      <p class="text-body text-muted" data-testid="user-found">
        <template v-if="data">{{ formatCount(data.meta.totalItems) }} pengguna dijumpai</template>
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-file-csv"
          title="Muat turun senarai mengikut tapisan di atas"
          :loading="exporting"
          :disabled="exporting"
          class="min-h-11 justify-center"
          data-testid="user-export"
          @click="exportCsv"
          >Eksport CSV</UButton
        >
        <UButton
          :to="isPupil ? PUPIL_CREATE_PATH : TEACHER_CREATE_PATH"
          size="lg"
          icon="i-ph-user-plus"
          class="min-h-11 justify-center"
          data-testid="user-add"
          >{{ isPupil ? 'Tambah Pelajar' : 'Cipta Pengguna' }}</UButton
        >
      </div>
    </div>

    <PendingTeacherCallout v-if="!isPupil" />

    <!-- FR-M27-89: Status, Cari, submit "Cari"; no role, school or class control. -->
    <DsFilterBar
      :active-count="activeCount"
      data-testid="user-filter"
      @apply="submitFilter"
      @reset="resetFilter"
    >
      <template #search>
        <DsFormField label="Cari" name="search" class="min-w-0 grow">
          <UInput
            v-model="search"
            type="text"
            name="search"
            icon="i-ph-magnifying-glass"
            placeholder="Nama atau emel..."
            class="w-full"
            data-testid="user-search"
          />
        </DsFormField>
      </template>
      <DsFormField label="Status" native for="user-status" class="min-w-40">
        <DsNativeSelect
          id="user-status"
          v-model="status"
          name="is_active"
          data-testid="user-status-filter"
        >
          <option value="">Semua</option>
          <option value="1">Aktif</option>
          <option value="0">Tidak Aktif</option>
        </DsNativeSelect>
      </DsFormField>
    </DsFilterBar>

    <DsLoadError
      v-if="error && !refused"
      :message="errorLines(error).join(' ')"
      testid="user-error"
      @retry="reload"
    />

    <template v-else-if="!refused">
      <DsPanel v-if="!firstLoad && rowCount === 0" data-testid="user-empty">
        <DsEmptyState
          title="Tiada pengguna dijumpai"
          description="Cuba ubah kriteria carian anda"
          icon="users"
        />
      </DsPanel>
      <DsDataTable
        v-else
        :data="items"
        :columns="columns"
        :loading="firstLoad"
        :total="data?.meta.totalItems ?? 0"
        :page-size="data?.meta.pageSize ?? 25"
        :page="applied.page"
        :caption="cfg.listTitle"
        layout="fixed"
        density="tight"
        :sticky-first-column="false"
        card-title="name"
        :card-fields="cardFields"
        data-testid="user-table"
        @update:page="goToPage"
        @row-click="openRow"
      >
        <template #index-cell="{ row }">
          <span data-testid="user-index">{{ row.original.index }}</span>
        </template>
        <template #name-cell="{ row }">
          <DsIdentity
            :name="row.original.name"
            :initials="row.original.initials"
            data-testid="user-row"
            :data-user-id="row.original.id"
          >
            <template #name>
              <RouterLink
                v-if="row.original.canEdit"
                :to="row.original.editTo"
                class="flex min-h-11 min-w-0 items-center"
                :title="row.original.name"
                data-testid="user-name"
                ><span class="truncate">{{ row.original.name }}</span></RouterLink
              >
              <span v-else :title="row.original.name" data-testid="user-name">{{
                row.original.name
              }}</span>
            </template>
          </DsIdentity>
        </template>
        <template #email-cell="{ row }">
          <span class="block truncate" :title="row.original.email" data-testid="user-email">{{
            row.original.email
          }}</span>
        </template>
        <template #phone-cell="{ row }">
          <span class="text-nowrap" data-testid="user-phone">{{ row.original.phone }}</span>
        </template>
        <template #grade-cell="{ row }">
          <span class="break-words" data-testid="user-grade">{{ row.original.grade }}</span>
        </template>
        <template #kelas-cell="{ row }">
          <span data-testid="user-classes">{{ row.original.kelas }}</span>
        </template>
        <template #lastLogin-cell="{ row }">
          <span data-testid="user-last-login">{{ row.original.lastLogin }}</span>
        </template>
        <template #isActive-cell="{ row }">
          <DsStatusBadge
            v-if="isPupil"
            :status="row.original.isActive ? 'active' : 'inactive'"
            :label="row.original.isActive ? 'Aktif' : 'Tidak'"
            data-testid="user-status"
          />
          <UButton
            v-else
            type="button"
            size="lg"
            variant="soft"
            :color="row.original.isActive ? 'success' : 'error'"
            :icon="row.original.isActive ? 'i-ph-check-circle' : 'i-ph-x-circle'"
            :loading="togglingId === row.original.id"
            :disabled="togglingId === row.original.id"
            class="min-h-11"
            data-testid="user-toggle"
            @click="toggle(row.original.id)"
            >{{ row.original.isActive ? 'Aktif' : 'Tidak' }}</UButton
          >
        </template>
        <template #date-cell="{ row }">
          <span class="text-nowrap" data-testid="user-date">{{ row.original.date }}</span>
        </template>
        <template #actions-cell="{ row }">
          <UserRowActions :edit-to="row.original.editTo" :can-edit="row.original.canEdit">
            <ImpersonateButton
              v-if="!http"
              :user-id="row.original.id"
              :name="row.original.name"
              :is-active="row.original.isActive"
              :role="role"
            />
          </UserRowActions>
        </template>
        <template #card-actions="{ row }">
          <div class="flex flex-col items-end gap-2">
            <DsStatusBadge
              v-if="isPupil"
              :status="row.isActive ? 'active' : 'inactive'"
              :label="row.isActive ? 'Aktif' : 'Tidak'"
            />
            <UButton
              v-else
              type="button"
              size="lg"
              variant="soft"
              :color="row.isActive ? 'success' : 'error'"
              :loading="togglingId === row.id"
              class="min-h-11"
              @click="toggle(row.id)"
              >{{ row.isActive ? 'Aktif' : 'Tidak' }}</UButton
            >
            <UserRowActions :edit-to="row.editTo" :can-edit="row.canEdit">
              <ImpersonateButton
                v-if="!http"
                :user-id="row.id"
                :name="row.name"
                :is-active="row.isActive"
                :role="role"
              />
            </UserRowActions>
          </div>
        </template>
      </DsDataTable>
    </template>
  </DsPage>
</template>
