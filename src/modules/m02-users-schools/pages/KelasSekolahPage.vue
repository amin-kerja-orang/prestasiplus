<script setup lang="ts">
/**
 * U-08 `/admin/classes` "Kelas Sekolah" (PRD-30 R1-ADM-U-08, FR-ADM-U08.1; API-ADM-05). Admin Pusat list of
 * the classes of every school: filters Sekolah, Guru (teachers of the chosen school), Tingkatan and Cari
 * (the M27 `ClassFilters`), a table (cards below `md`) and the server pager. All filters live in the URL.
 * The list stays on screen while the next filter or page loads.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsCluster,
  DsDataTable,
  DsFormField,
  DsGrid,
  DsLink,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsStateView,
  DsStatusBadge,
  type CardField,
} from '@/ds'
import { formatCount } from '@/lib/number'
// eslint-disable-next-line no-restricted-imports -- S6-T11: composes the M27 filter bar; M27 exports no components from its entry
import ClassFilters from '@/modules/m27-school-admin/components/classes/ClassFilters.vue'

import { fetchAdminClasses, fetchAdminUsers, fetchSchoolOptions } from '../api'
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
const positive = (v: string): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const schoolId = computed(() => positive(first(route.query.schoolId)))
const teacherId = computed(() => positive(first(route.query.teacherId)))
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

// Guru options: the teachers of the chosen school.
const teachers = ref<{ id: number; name: string }[]>([])
watch(
  schoolId,
  async (id) => {
    teachers.value = []
    if (id === null) return
    try {
      const res = await fetchAdminUsers({ role: 'teacher', schoolId: id })
      if (schoolId.value === id)
        teachers.value = res.data.map((u) => ({ id: Number(u.id), name: u.name }))
    } catch {
      teachers.value = []
    }
  },
  { immediate: true },
)

function go(next: {
  schoolId?: number | null
  teacherId?: number | null
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
  go({ schoolId: positive((e.target as HTMLSelectElement).value), teacherId: null })
}
function onTeacher(e: Event) {
  go({ teacherId: positive((e.target as HTMLSelectElement).value) })
}
function onApply(f: { level: string; search: string }) {
  go({ level: f.level, search: f.search })
}

interface Item extends Record<string, unknown> {
  no: number
  id: number
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
    <DsPanel padding="md">
      <DsStack gap="sm">
        <DsGrid :cols="{ base: 1, sm: 2 }" gap="sm">
          <DsFormField label="Sekolah" native for="akp-school">
            <DsNativeSelect
              id="akp-school"
              :model-value="schoolId === null ? '' : String(schoolId)"
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
              :model-value="teacherId === null ? '' : String(teacherId)"
              :disabled="schoolId === null"
              data-testid="akp-teacher"
              @change="onTeacher"
            >
              <option value="">Semua Guru</option>
              <option v-for="t in teachers" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
            </DsNativeSelect>
          </DsFormField>
        </DsGrid>
        <ClassFilters :levels="LEVELS" :level="level" :search="search" @apply="onApply" />
      </DsStack>
    </DsPanel>

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
