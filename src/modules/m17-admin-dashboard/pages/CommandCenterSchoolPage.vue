<script setup lang="ts">
/**
 * S4 "{sekolah} - Command Center" (M17 FR-M17-48..50, FN-M17-5.1.x; DV-M17-22): header, back link
 * "← Kembali ke Gambaran Keseluruhan", breadcrumb, the four cards and "Senarai Guru ({n})" (a row opens S5).
 * The route prefix is a prop so M10 (`/guru/command-center`) and the school-admin alias mount it.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsDrillTable, DsLoadError, DsPanel, DsStatRow, type StatItem } from '@/ds'

import { fetchCcSchool } from '../api/command-center'
import type { CcSchoolTeacher } from '../api/command-center-types'
import { count, pct1 } from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcFrame from '../components/command-center/CcFrame.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcSchoolTeacher]: CcSchoolTeacher[K] }

const props = withDefaults(defineProps<{ schoolId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const router = useRouter()
const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound, reload } = useCcPage(
  (signal) => fetchCcSchool(props.schoolId, { signal }),
  () => props.schoolId,
  (d) => d.school.name,
)

const crumbs = computed(() => [
  { label: 'Command Center', to: paths.value.overview },
  { label: data.value?.school.name ?? '' },
])
const cards = computed<StatItem[]>(() => {
  const c = data.value?.cards
  if (!c) return []
  return [
    { key: 'students', label: 'Jumlah Pelajar', value: count(c.students), icon: 'i-ph-student', accent: 'action' },
    { key: 'active', label: 'Pelajar Aktif', value: count(c.active), icon: 'i-ph-users-three', accent: 'friend' },
    {
      key: 'answers',
      label: 'Jumlah Jawapan',
      value: count(c.answers),
      icon: 'i-ph-clipboard-text', accent: 'trial',
    },
    { key: 'accuracy', label: 'Ketepatan', value: pct1(c.accuracy), icon: 'i-ph-target', accent: 'win' },
  ]
})
const columns: TableColumn<Row>[] = [
  { id: 'no', header: '#' },
  { id: 'name', header: 'Nama Guru' },
  { id: 'subject', header: 'Subjek' },
  { id: 'classes', header: 'Kelas' },
  { id: 'students', header: 'Pelajar' },
  { id: 'active', header: 'Aktif (30h)' },
]

function open(userId: number) {
  void router.push(paths.value.teacher(props.schoolId, userId))
}
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="paths.overview"
    back-label="Kembali ke Gambaran Keseluruhan"
    :crumbs="data ? crumbs : [{ label: 'Command Center', to: paths.overview }]"
  >
    <DsLoadError v-if="error" testid="cc-error" @retry="reload" />
    <p
      v-else-if="!data"
      class="flex items-center gap-2 text-body text-muted"
      data-testid="cc-loading"
    >
      <UProgress class="w-16" aria-hidden="true" />Memuatkan...
    </p>
    <template v-else>
      <DsStatRow :items="cards" prefix="cc-stat" :cols="4" density="roomy" data-testid="cc-school-cards" />

      <DsPanel icon="i-ph-chalkboard-teacher" :title="`Senarai Guru (${data.teachers.length})`">
        <div data-testid="cc-table-scroller">
          <DsDrillTable
            :data="data.teachers"
            :columns="columns"
            caption="Senarai Guru"
            data-testid="cc-teachers-table"
            @drill="(t: Row) => open(t.userId)"
          >
            <template #no-cell="{ row }"
              ><span class="tabular text-caption text-muted">{{ row.index + 1 }}</span></template
            >
            <template #name-cell="{ row }">
              <UButton
                variant="link"
                color="neutral"
                class="h-auto p-0 text-start"
                trailing-icon="i-ph-caret-right"
                :label="row.original.name"
                data-testid="cc-teacher-row"
                :data-user-id="row.original.userId"
                @click.stop="open(row.original.userId)"
              />
            </template>
            <template #subject-cell="{ row }">{{ row.original.subjectText ?? '-' }}</template>
            <template #classes-cell="{ row }"
              ><span class="tabular">{{ row.original.classes }}</span></template
            >
            <template #students-cell="{ row }"
              ><span class="tabular">{{ row.original.students }}</span></template
            >
            <template #active-cell="{ row }"
              ><span class="tabular text-success">{{ row.original.active30d }}</span></template
            >
          </DsDrillTable>
        </div>
      </DsPanel>
    </template>
  </CcFrame>
</template>
