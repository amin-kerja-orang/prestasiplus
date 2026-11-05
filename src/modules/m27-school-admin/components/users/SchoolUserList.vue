<script setup lang="ts">
/**
 * S6 `/admin-sekolah/pelajar` and S7 `/admin-sekolah/guru` (SRS M27 Part B FR-M27-88 to 93, 99 to 103, 119;
 * BR-M27-30, 36, 40). One list for both roles (`role` prop): the role and the school are fixed by the server,
 * there is no role, school or class control. Top to bottom: back link, one count tile, the header-actions row
 * ("{n} pengguna dijumpai", "Eksport CSV", "Tambah Pelajar" / "Cipta Pengguna"), the filter bar, the table
 * (card list below `md`).
 *
 * The query string is the state (`is_active`, `search`, `page`, and for pupils `level` T1..T5 and `classroomId`, R1-AS-51
 * FR-AS-51-1: `/admin-sekolah/pelajar?classroomId={id}` opens the list pre-filtered, the link of Kelas Sekolah "Murid"). "Eksport CSV" sends the Status and Cari values
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
  DsCluster,
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
  DsText,
  useConfirm,
  type CardField,
} from '@/ds'
import { useMedia } from '@/ds/useMedia'
import { formatDateKey } from '@/lib/time'
import { clock } from '@/lib/time/clock'
import { saveBlob } from '@/lib/save-blob'

import {
  downloadPupilsCsv,
  downloadTeachersCsv,
  fetchSchoolClasses,
  fetchSchoolPupils,
  fetchSchoolTeachers,
  toggleSchoolTeacherActive,
  type SchoolClassRow,
  type SchoolPupilRow,
  type SchoolTeacherRow,
  type SchoolUserListMeta,
} from '../../api/school-admin'
import MobileCard from '../MobileCard.vue'
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
  PUPIL_IMPORT_PATH,
  PUPIL_LIST_PATH,
  ROLE_CONFIG,
  TINGKATAN_OPTIONS,
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

const validLevel = (v: string): string => (TINGKATAN_OPTIONS.some((o) => o.value === v) ? v : '')
const validClassroomId = (v: string): string => (/^\d+$/.test(v.trim()) ? v.trim() : '')

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => {
  const active = queryText(route.query.is_active)
  return {
    isActive: active === '1' ? true : active === '0' ? false : null,
    search: queryText(route.query.search).trim(),
    level: isPupil.value ? validLevel(queryText(route.query.level)) : '',
    classroomId: isPupil.value ? validClassroomId(queryText(route.query.classroomId)) : '',
    page: Math.max(1, Number.parseInt(queryText(route.query.page), 10) || 1),
  }
})

// Draft values of the form controls; re-synced when the URL changes (back / forward).
const status = ref(queryText(route.query.is_active))
const search = ref(queryText(route.query.search))
const level = ref(validLevel(queryText(route.query.level)))
const classroomId = ref(validClassroomId(queryText(route.query.classroomId)))
watch(
  () => [route.query.is_active, route.query.search, route.query.level, route.query.classroomId] as const,
  ([a, q, l, c]) => {
    status.value = queryText(a)
    search.value = queryText(q)
    level.value = validLevel(queryText(l))
    classroomId.value = validClassroomId(queryText(c))
  },
)

// "Kelas" select (pupils): the classes of the school, only those of the chosen Tingkatan when one is chosen, Tingkatan then name.
interface ClassOption {
  id: number
  name: string
}
const classOptions = ref<ClassOption[]>([])
const CLASS_PAGES_MAX = 40
const gradeOrder = (label: string): number => {
  const m = /^(Darjah|Tingkatan) (\d+)$/.exec(label)
  return m ? Number(m[2]) + (m[1] === 'Tingkatan' ? 6 : 0) : 99
}
let classLoad = 0

async function loadClassOptions(levelCode: string): Promise<void> {
  if (!isPupil.value) return
  const ticket = ++classLoad
  const tingkatan = /^T([1-5])$/.exec(levelCode)?.[1]
  const rows: SchoolClassRow[] = []
  try {
    for (let page = 1; page <= CLASS_PAGES_MAX; page++) {
      const res = await fetchSchoolClasses({ level: tingkatan ? `tingkatan-${tingkatan}` : null, page })
      rows.push(...res.data)
      if (page >= res.meta.totalPages) break
    }
  } catch {
    // The select keeps the options it has; the list itself reports its own errors.
  }
  if (ticket !== classLoad) return
  classOptions.value = rows
    .filter((c) => !tingkatan || c.levelLabel === `Tingkatan ${tingkatan}`)
    .sort((a, b) => gradeOrder(a.levelLabel) - gradeOrder(b.levelLabel) || a.name.localeCompare(b.name, 'ms'))
    .map((c) => ({ id: c.id, name: c.name }))
  // A class that is not of the chosen Tingkatan cannot stay selected.
  if (tingkatan && classroomId.value !== '' && !classOptions.value.some((c) => String(c.id) === classroomId.value)) {
    classroomId.value = ''
  }
}
watch(level, (l) => void loadClassOptions(l), { immediate: true })

function fetchPage(signal: AbortSignal): Promise<ListResult<ListRow, SchoolUserListMeta>> {
  const q = {
    isActive: applied.value.isActive,
    search: applied.value.search || null,
    ...(isPupil.value ? { level: applied.value.level || null, classroomId: applied.value.classroomId || null } : {}),
    page: applied.value.page,
    signal,
  }
  return props.role === 'student' ? fetchSchoolPupils(q) : fetchSchoolTeachers(q)
}

const { data, error, reload } = useApi(fetchPage, [
  () => props.role,
  () => route.query.is_active,
  () => route.query.search,
  () => route.query.level,
  () => route.query.classroomId,
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
const activeCount = computed(
  () => [status.value, isPupil.value ? level.value : '', isPupil.value ? classroomId.value : ''].filter((v) => v !== '').length,
)

/** R1-AS-51 FR-AS-51-2 / R1-AS-52 FR-AS-52-1: the tile is XS-1 / XS-3 (the school total when the server sends no `xs`). */
const tileCount = computed(() => data.value?.meta.counts?.xs ?? data.value?.meta.counts?.total ?? 0)
/** Pupils the tile leaves out (pending, suspended or deactivated); shown only when there are some. */
const notCounted = computed(() => (isPupil.value ? (data.value?.meta.counts?.notCounted ?? 0) : 0))

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
  if (isPupil.value && level.value !== '') out.level = level.value
  if (isPupil.value && classroomId.value !== '') out.classroomId = classroomId.value
  return out
}

/** The applied filters as the query of the pager links and of the "same filter" comparison. */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.isActive !== null) out.is_active = applied.value.isActive ? '1' : '0'
  if (applied.value.search !== '') out.search = applied.value.search
  if (applied.value.level !== '') out.level = applied.value.level
  if (applied.value.classroomId !== '') out.classroomId = applied.value.classroomId
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
  level.value = ''
  classroomId.value = ''
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
      ...(isPupil.value && level.value !== '' ? { level: level.value } : {}),
      ...(isPupil.value && classroomId.value !== '' ? { classroomId: classroomId.value } : {}),
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
// Tarikh never gets its own column: the card is capped at ~1080px inside, and nine columns plus a 20-character name
// need ~1110px. No field is dropped: every value of a hidden column shows as a small muted line under the name
// (`SUB_FIELDS`, hidden by the inverse breakpoint class), so the registration date is always reachable. The hidden
// "Tarikh" column stays in the DOM (header and cell texts) for the unit and e2e specs.
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
// The pupil table at `xl` (933px of scroller at 1280) needs "Tingkatan 5" unbroken (~90px of text) and a Kelas column
// that does not run to four lines, so the pupil's #, Nama, Emel, Tingkatan and Kelas take these widths from `xl`
// (920px summed; below `xl` the widths stay as they were).
const PUPIL_WIDTHS: Record<string, string> = {
  index: 'w-12 xl:w-10',
  name: 'w-48',
  email: 'w-44 xl:w-40',
  grade: `w-32 ${XL}`,
  kelas: `w-36 ${XL}`,
}
// Same breakpoints as the column classes (`xl` 1280, `2xl` 1536); `useMedia` is true without `matchMedia` (jsdom).
const minWidth = (px: number) => useMedia(`(width >= ${px}px)`)
const xl = minWidth(1280)
const xxl = minWidth(1536)

const sized = (cols: TableColumn<Item>[]): TableColumn<Item>[] =>
  cols.map((c) => {
    const key = String(c.id ?? (c as { accessorKey?: string }).accessorKey)
    // The teacher has one more visible column from `2xl` and an "Aktif?" button (icon + label, wider than the
    // pupil's badge), so the name and that column give way a little.
    const w = isPupil.value
      ? (PUPIL_WIDTHS[key] ?? WIDTHS[key])
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
        { key: 'date', label: 'Tarikh' },
      ]
    : [
        { key: 'email', label: 'Emel' },
        { key: 'phone', label: 'Telefon' },
        { key: 'kelas', label: 'Kelas' },
        { key: 'lastLogin', label: 'Login Terakhir' },
        { key: 'date', label: 'Tarikh' },
      ],
)

function openRow(row: Item): void {
  if (row.canEdit) void router.push(row.editTo)
}
</script>

<template>
  <DsPage :data-testid="`${cfg.testid}-page`">
    <DsBackLink :to="DASHBOARD_PATH" label="Dashboard Sekolah" data-testid="user-crumb-back" />

    <!-- FR-M27-88 / 99: one count tile, unaffected by the filters. The figure is XS-1 / XS-3 (FR-AS-51-2, FR-AS-52-1);
         pupils XS-1 leaves out are named beside it, only when there are some. -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" data-testid="user-count-card">
      <USkeleton v-if="!data" class="h-24 w-full" />
      <DsStatTile
        v-else
        :value="formatCount(tileCount)"
        :unit="cfg.cardLabel"
        :icon="isPupil ? 'graduation-cap' : 'chalkboard-teacher'"
        :accent="isPupil ? 'action' : 'friend'"
      />
      <p v-if="notCounted > 0" class="text-body text-muted self-center" data-testid="user-not-counted">
        {{ formatCount(notCounted) }} menunggu kelulusan atau tidak aktif
      </p>
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
          v-if="isPupil"
          :to="PUPIL_IMPORT_PATH"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-upload-simple"
          class="min-h-11 justify-center"
          data-testid="user-import"
          >Import Pelajar</UButton
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

    <!-- FR-M27-89: Status, Cari, submit "Cari"; no role or school control (pupils: Tingkatan and Kelas, FR-AS-51-1). -->
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
      <!-- FR-AS-51-1: Tingkatan and Kelas (pupils only); the classes follow the chosen Tingkatan. -->
      <DsFormField v-if="isPupil" label="Tingkatan" native for="user-level" class="min-w-40">
        <DsNativeSelect id="user-level" v-model="level" name="level" data-testid="user-level-filter">
          <option value="">Semua Tingkatan</option>
          <option v-for="o in TINGKATAN_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-if="isPupil" label="Kelas" native for="user-class" class="min-w-40">
        <DsNativeSelect
          id="user-class"
          v-model="classroomId"
          name="classroomId"
          data-testid="user-class-filter"
        >
          <option value="">Semua Kelas</option>
          <option v-for="c in classOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
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
          <!-- The values of the columns hidden at this width (the breakpoints of `WIDTHS`), no field is dropped. -->
          <DsCluster gap="sm" align="start" data-testid="user-sub">
            <DsText
              v-if="isPupil && !xl"
              as="span"
              variant="caption"
              data-testid="user-sub-grade"
              >{{ row.original.grade === '-' ? 'Tingkatan: -' : row.original.grade }}</DsText
            >
            <DsText v-if="!xl" as="span" variant="caption" data-testid="user-sub-kelas"
              >Kelas: {{ row.original.kelas }}</DsText
            >
            <DsText v-if="!xxl" as="span" variant="caption" data-testid="user-sub-phone"
              >Telefon: {{ row.original.phone }}</DsText
            >
            <DsText
              v-if="!isPupil && !xxl"
              as="span"
              variant="caption"
              data-testid="user-sub-last-login"
              >Login Terakhir: {{ row.original.lastLogin }}</DsText
            >
            <DsText as="span" variant="caption" data-testid="user-sub-date"
              >Tarikh: {{ row.original.date }}</DsText
            >
          </DsCluster>
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
        <template #card="{ row }">
          <MobileCard title="name" :fields="cardFields" :row="row" @open="openRow(row)">
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
          </MobileCard>
        </template>
      </DsDataTable>
    </template>
  </DsPage>
</template>
