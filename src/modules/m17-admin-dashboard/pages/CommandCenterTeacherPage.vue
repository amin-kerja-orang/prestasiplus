<script setup lang="ts">
/**
 * S5 "{guru} - Command Center" (M17 FR-M17-51, FN-M17-5.2.x): back link "← Kembali ke Sekolah",
 * breadcrumb, the info bar "Sekolah:" and "Senarai Kelas ({n})" (a row opens S6; no class = the row
 * "Tiada kelas aktif"). The route prefix is a prop (M10 and school-admin mounts).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsDrillTable, DsLoadError, DsPanel } from '@/ds'

import { fetchCcTeacher } from '../api/command-center'
import type { CcTeacherClass } from '../api/command-center-types'
import { count } from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcAccuracyBar from '../components/command-center/CcAccuracyBar.vue'
import CcFrame from '../components/command-center/CcFrame.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcTeacherClass]: CcTeacherClass[K] }

const props = withDefaults(defineProps<{ schoolId: number; userId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const router = useRouter()
const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound, reload } = useCcPage(
  (signal) => fetchCcTeacher(props.schoolId, props.userId, { signal }),
  [() => props.schoolId, () => props.userId],
  (d) => d.teacher.name,
)

const crumbs = computed(() => {
  const d = data.value
  if (!d) return [{ label: 'Command Center', to: paths.value.overview }]
  return [
    { label: 'Command Center', to: paths.value.overview },
    { label: d.school.name, to: paths.value.school(d.school.id) },
    { label: d.teacher.name },
  ]
})
const columns: TableColumn<Row>[] = [
  { id: 'no', header: '#' },
  { id: 'name', header: 'Nama Kelas' },
  { id: 'level', header: 'Tahap' },
  { id: 'students', header: 'Pelajar' },
  { id: 'active', header: 'Aktif (30h)' },
  { id: 'answers', header: 'Jumlah Jawapan' },
  { id: 'acc', header: 'Ketepatan' },
]

function open(classId: number) {
  void router.push(paths.value.classroom(classId))
}
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="data ? paths.school(data.school.id) : paths.overview"
    back-label="Kembali ke Sekolah"
    :crumbs="crumbs"
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
      <p class="text-body text-muted" data-testid="cc-info">
        Sekolah: <strong class="text-highlighted">{{ data.school.name }}</strong>
      </p>

      <DsPanel icon="i-ph-chalkboard" :title="`Senarai Kelas (${data.classes.length})`">
        <p v-if="data.classes.length === 0" class="text-body text-muted" data-testid="cc-empty-row">
          Tiada kelas aktif
        </p>
        <div v-else data-testid="cc-table-scroller">
          <DsDrillTable
            :data="data.classes"
            :columns="columns"
            caption="Senarai Kelas"
            data-testid="cc-classes-table"
            @drill="(c: Row) => open(c.id)"
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
                data-testid="cc-class-row"
                :data-class-id="row.original.id"
                @click.stop="open(row.original.id)"
              />
            </template>
            <template #level-cell="{ row }">{{ row.original.level }}</template>
            <template #students-cell="{ row }"
              ><span class="tabular">{{ row.original.students }}</span></template
            >
            <template #active-cell="{ row }"
              ><span class="tabular text-success">{{ row.original.active30d }}</span></template
            >
            <template #answers-cell="{ row }"
              ><span class="tabular">{{ count(row.original.answers) }}</span></template
            >
            <template #acc-cell="{ row }"
              ><CcAccuracyBar :value="row.original.accuracy"
            /></template>
          </DsDrillTable>
        </div>
      </DsPanel>
    </template>
  </CcFrame>
</template>
