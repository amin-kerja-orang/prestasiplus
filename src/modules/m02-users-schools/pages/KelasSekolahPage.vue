<script setup lang="ts">
/**
 * U-08 `/admin/classes` "Kelas Sekolah" (PRD-30 R1-ADM-U-08, FR-ADM-U08.1; API-ADM-05). Admin Pusat list of
 * the classes of every school: filters Sekolah, Guru, Tingkatan and Cari, a table (cards below `md`) and the server pager. All filters live in the URL.
 * The list stays on screen while the next filter or page loads.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useDebounce } from '@/composables'
import {
  DsCluster,
  DsDataTable,
  DsFilterBar,
  DsFormField,
  DsLink,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsStateView,
  DsStatusBadge,
  type CardField,
} from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchAdminClasses, fetchSchoolOptions, fetchTeachers } from '../api'
import type { AdminClass } from '../api'

const PATH = '/admin/classes'
const LEVELS = [1, 2, 3, 4, 5].map((n) => ({
  code: `tingkatan-${String(n)}`,
  label: `Tingkatan ${String(n)}`,
}))

const route = useRoute()
const router = useRouter()

const first = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : ''
const idOf = (v: string): string | null => (/^[1-9]\d*$/.test(v) ? v : null)
const positive = (v: string): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const schoolId = computed(() => idOf(first(route.query.schoolId)))
const teacherId = computed(() => idOf(first(route.query.teacherId)))
const level = computed(() => {
  const v = first(route.query.level)
  return LEVELS.some((l) => l.code === v) ? v : ''
})
const search = computed(() => first(route.query.search).slice(0, 100))
const pageNo = computed(() => positive(first(route.query.page)) ?? 1)

const { data, error, loading, reload } = useApi(
  (signal) =>
    fetchAdminClasses({
      schoolId: schoolId.value,
      teacherId: teacherId.value,
      level: level.value || null,
      search: search.value || null,
      page: pageNo.value,
      signal,
    }),
  [schoolId, teacherId, level, search, pageNo],
)

// Sekolah picker options (existing schools client).
const { data: schoolOptions } = useApi((signal) => fetchSchoolOptions({ signal }))

// Guru options: the existing teacher lookup (every teacher, by name).
const { data: teachers } = useApi((signal) => fetchTeachers({ signal }))

function go(next: {
  schoolId?: string | null
  teacherId?: string | null
  level?: string
  search?: string
  page?: number
}) {
  const v = {
    schoolId: next.schoolId === undefined ? schoolId.value : next.schoolId,
    teacherId: next.teacherId === undefined ? teacherId.value : next.teacherId,
    level: next.level ?? level.value,
    search: next.search ?? search.value,
    page: next.page ?? 1,
  }
  void router.push({
    path: PATH,
    query: {
      ...(v.schoolId ? { schoolId: String(v.schoolId) } : {}),
      ...(v.teacherId ? { teacherId: String(v.teacherId) } : {}),
      ...(v.level ? { level: v.level } : {}),
      ...(v.search ? { search: v.search } : {}),
      ...(v.page > 1 ? { page: String(v.page) } : {}),
    },
  })
}

function onSchool(e: Event) {
  go({ schoolId: idOf((e.target as HTMLSelectElement).value) })
}
function onTeacher(e: Event) {
  go({ teacherId: idOf((e.target as HTMLSelectElement).value) })
}

// Tingkatan and Cari: the select applies on change, the search on Enter or after a short pause.
const levelValue = ref(level.value)
const searchValue = ref(search.value)
watch(level, (v) => (levelValue.value = v))
watch(search, (v) => (searchValue.value = v))
const activeCount = computed(
  () =>
    (schoolId.value !== null ? 1 : 0) +
    (teacherId.value !== null ? 1 : 0) +
    (levelValue.value !== '' ? 1 : 0),
)
function apply() {
  go({ level: levelValue.value, search: searchValue.value.trim().slice(0, 100) })
}
const applyLater = useDebounce(apply, 400)
function onSubmit() {
  applyLater.cancel()
  apply()
}
function onReset() {
  applyLater.cancel()
  levelValue.value = ''
  searchValue.value = ''
  go({ schoolId: null, teacherId: null, level: '', search: '' })
}

interface Item extends Record<string, unknown> {
  no: number
  id: string
  name: string
  school: string
  level: string
  teacher: string
  pupils: string
  code: string
  isActive: boolean
}
const items = computed<Item[]>(() => {
  const from = data.value?.meta.from ?? 1
  return (data.value?.data ?? []).map((c: AdminClass, i) => ({
    no: from + i,
    id: c.id,
    name: c.name,
    school: c.school?.name ?? '-',
    level: c.level,
    teacher: c.teacher?.name ?? '-',
    pupils: formatCount(c.pupils),
    code: c.joinCode ?? '-',
    isActive: c.isActive,
  }))
})
const columns: TableColumn<Item>[] = [
  { accessorKey: 'no', header: '#' },
  { accessorKey: 'name', header: 'Kelas' },
  { accessorKey: 'school', header: 'Sekolah' },
  { accessorKey: 'level', header: 'Tingkatan' },
  { accessorKey: 'teacher', header: 'Guru' },
  { accessorKey: 'pupils', header: 'Murid' },
  { accessorKey: 'code', header: 'Kod Kelas' },
]
const cardFields: CardField[] = [
  { key: 'school', label: 'Sekolah' },
  { key: 'level', label: 'Tingkatan' },
  { key: 'teacher', label: 'Guru' },
  { key: 'pupils', label: 'Murid' },
  { key: 'code', label: 'Kod Kelas' },
]
const filtered = computed(
  () =>
    schoolId.value !== null ||
    teacherId.value !== null ||
    level.value !== '' ||
    search.value !== '',
)
function open(row: Item) {
  void router.push(`/admin/command-center/classroom/${String(row.id)}`)
}
</script>

<template>
  <DsPage layout="list" data-testid="akp-page">
    <DsFilterBar
      :active-count="activeCount"
      data-testid="akp-filters"
      @apply="onSubmit"
      @reset="onReset"
    >
      <template #search>
        <DsFormField label="Cari" name="search">
          <UInput
            id="akp-search"
            v-model="searchValue"
            type="search"
            name="search"
            placeholder="Cari kelas..."
            autocomplete="off"
            maxlength="100"
            data-testid="akp-search"
            @input="applyLater"
          />
        </DsFormField>
      </template>
      <DsFormField label="Sekolah" native for="akp-school">
        <DsNativeSelect
          id="akp-school"
          :model-value="schoolId ?? ''"
          data-testid="akp-school"
          @change="onSchool"
        >
          <option value="">Semua Sekolah</option>
          <option v-for="s in schoolOptions ?? []" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField label="Guru" native for="akp-teacher">
        <DsNativeSelect
          id="akp-teacher"
          :model-value="teacherId ?? ''"
          data-testid="akp-teacher"
          @change="onTeacher"
        >
          <option value="">Semua Guru</option>
          <option v-for="t in teachers ?? []" :key="t.id" :value="String(t.id)">
            {{ t.name }}
          </option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField label="Tingkatan" native for="akp-level">
        <DsNativeSelect
          id="akp-level"
          v-model="levelValue"
          data-testid="akp-level"
          @change="onSubmit"
        >
          <option value="">Semua</option>
          <option v-for="l in LEVELS" :key="l.code" :value="l.code">{{ l.label }}</option>
        </DsNativeSelect>
      </DsFormField>
    </DsFilterBar>

    <template v-if="data">
      <DsDataTable
        :data="items"
        :columns="columns"
        :total="data.meta.totalItems"
        :page-size="data.meta.pageSize"
        :page="pageNo"
        :filtered="filtered"
        empty-title="Tiada kelas dijumpai."
        caption="Kelas Sekolah"
        card-title="name"
        :card-fields="cardFields"
        data-testid="akp-table"
        @update:page="go({ page: $event })"
        @row-click="open"
      >
        <template #name-cell="{ row }">
          <DsCluster>
            <DsLink
              :to="`/admin/command-center/classroom/${String(row.original.id)}`"
              data-testid="akp-name"
              >{{ row.original.name }}</DsLink
            >
            <DsStatusBadge
              v-if="!row.original.isActive"
              status="inactive"
              label="Tidak Aktif"
              data-testid="akp-inactive"
            />
          </DsCluster>
        </template>
      </DsDataTable>
    </template>
    <DsLoadError v-else-if="error" testid="akp-error" @retry="reload" />
    <DsStateView v-else-if="loading" status="loading" skeleton="table" data-testid="akp-loading" />
  </DsPage>
</template>
