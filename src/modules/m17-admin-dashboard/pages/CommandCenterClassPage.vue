<script setup lang="ts">
/**
 * S6 "{kelas} - Command Center" (M17 FR-M17-52, FN-M17-5.3.x): back link "← Kembali ke Guru",
 * breadcrumb, the info bar ("Sekolah:", "Guru:", "Tahap:") and "Senarai Pelajar ({n})" (a row opens S7).
 * "Status" is "Aktif" when the latest answer is within 7 days (INFERRED, decided by the API). The route
 * prefix is a prop (M10 and school-admin mounts).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsDrillTable, DsLoadError, DsPanel } from '@/ds'

import { fetchCcClass } from '../api/command-center'
import type { CcClassStudent, Mood } from '../api/command-center-types'
import { count, dayMonthTime, MOOD, type MoodInfo } from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcAccuracyBar from '../components/command-center/CcAccuracyBar.vue'
import CcFrame from '../components/command-center/CcFrame.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcClassStudent]: CcClassStudent[K] }

const props = withDefaults(defineProps<{ classroomId: number | string; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const router = useRouter()
const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound, reload } = useCcPage(
  (signal) => fetchCcClass(props.classroomId, { signal }),
  () => props.classroomId,
  (d) => d.class.name,
)

/** A level the viewer's scope cannot open (no school) is shown as text, not a link. */
const schoolLink = computed(() => {
  const s = data.value?.school
  return s ? paths.value.school(s.id) : undefined
})
const teacherLink = computed(() => {
  const d = data.value
  return d?.school ? paths.value.teacher(d.school.id, d.teacher.id) : undefined
})
const crumbs = computed(() => {
  const d = data.value
  if (!d) return [{ label: 'Command Center', to: paths.value.overview }]
  return [
    { label: 'Command Center', to: paths.value.overview },
    ...(d.school ? [{ label: d.school.name, to: schoolLink.value }] : []),
    { label: d.teacher.name, to: teacherLink.value },
    { label: d.class.name },
  ]
})
const columns: TableColumn<Row>[] = [
  { id: 'no', header: '#' },
  { id: 'name', header: 'Nama Pelajar' },
  { id: 'answers', header: 'Jumlah Jawapan' },
  { id: 'acc', header: 'Ketepatan' },
  { id: 'last', header: 'Terakhir Aktif' },
  { id: 'status', header: 'Status' },
  { id: 'mood', header: 'Mood' },
]

const moodInfo = (mood: Mood): MoodInfo => MOOD[mood]

function open(userId: number | string) {
  void router.push(paths.value.student(userId))
}
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="teacherLink ?? paths.overview"
    back-label="Kembali ke Guru"
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
      <p class="flex flex-wrap gap-x-6 gap-y-1 text-body text-muted" data-testid="cc-info">
        <span v-if="data.school"
          >Sekolah: <strong class="text-highlighted">{{ data.school.name }}</strong></span
        >
        <span
          >Guru: <strong class="text-highlighted">{{ data.teacher.name }}</strong></span
        >
        <span
          >Tahap: <strong class="text-highlighted">{{ data.class.level }}</strong></span
        >
      </p>

      <DsPanel icon="i-ph-student" :title="`Senarai Pelajar (${data.students.length})`">
        <div class="max-w-full overflow-x-auto" data-testid="cc-table-scroller">
          <DsDrillTable
            class="min-w-140 max-md:w-fit max-md:max-w-none"
            :data="data.students"
            :columns="columns"
            caption="Senarai Pelajar"
            data-testid="cc-students-table"
            @drill="(s: Row) => open(s.userId)"
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
                data-testid="cc-student-row"
                :data-user-id="row.original.userId"
                @click.stop="open(row.original.userId)"
              />
            </template>
            <template #answers-cell="{ row }"
              ><span class="tabular">{{ count(row.original.answers) }}</span></template
            >
            <template #acc-cell="{ row }"
              ><CcAccuracyBar :value="row.original.accuracy"
            /></template>
            <template #last-cell="{ row }"
              ><span class="tabular text-muted">{{
                dayMonthTime(row.original.lastActiveAt)
              }}</span></template
            >
            <template #status-cell="{ row }">
              <UBadge
                v-if="row.original.status === 'aktif'"
                color="success"
                variant="soft"
                icon="i-ph-check-circle"
                data-testid="cc-status"
                >Aktif</UBadge
              >
              <UBadge
                v-else
                color="warning"
                variant="soft"
                icon="i-ph-clock"
                data-testid="cc-status"
                >Tidak Aktif</UBadge
              >
            </template>
            <template #mood-cell="{ row }">
              <span data-testid="cc-mood">
                <UIcon
                  v-if="row.original.mood"
                  :name="moodInfo(row.original.mood).icon"
                  class="size-5"
                  :title="moodInfo(row.original.mood).label"
                />
                <span v-if="row.original.mood" class="sr-only">{{
                  moodInfo(row.original.mood).label
                }}</span>
                <span v-else>-</span>
              </span>
            </template>
          </DsDrillTable>
        </div>
      </DsPanel>
    </template>
  </CcFrame>
</template>
