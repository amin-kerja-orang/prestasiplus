<script setup lang="ts">
/**
 * S6 "{kelas} - Command Center" (M17 FR-M17-52, FN-M17-5.3.x): back link "← Kembali ke Guru",
 * breadcrumb, the info bar ("Sekolah:", "Guru:", "Tahap:") and "Senarai Pelajar ({n})" (a row opens S7).
 * "Status" is "Aktif" when the latest answer is within 7 days (INFERRED, decided by the API). The route
 * prefix is a prop (M10 and school-admin mounts).
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { fetchCcClass } from '../api/command-center'
import {
  CC_TABLE as T,
  count,
  dayMonthTime,
  MOOD,
  LOAD_ERROR_COPY,
} from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcAccuracyBar from '../components/command-center/CcAccuracyBar.vue'
import CcFrame from '../components/command-center/CcFrame.vue'
import CcPanel from '../components/command-center/CcPanel.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

const props = withDefaults(defineProps<{ classroomId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const router = useRouter()
const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound } = useCcPage(
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
const COLUMNS = [
  '#',
  'Nama Pelajar',
  'Jumlah Jawapan',
  'Ketepatan',
  'Terakhir Aktif',
  'Status',
  'Mood',
]

function open(userId: number) {
  void router.push(paths.value.student(userId))
}
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="teacherLink ?? paths.overview"
    back-label="← Kembali ke Guru"
    :crumbs="crumbs"
  >
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-error">{{ LOAD_ERROR_COPY }}</p>
    <p
      v-else-if="!data"
      class="flex items-center gap-2 text-sm text-slate-400"
      data-testid="cc-loading"
    >
      <LoadingSpinner class="h-4 w-4" aria-hidden="true" />Memuatkan...
    </p>
    <template v-else>
      <p class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400" data-testid="cc-info">
        <span v-if="data.school"
          >Sekolah: <strong class="text-slate-50">{{ data.school.name }}</strong></span
        >
        <span
          >Guru: <strong class="text-slate-50">{{ data.teacher.name }}</strong></span
        >
        <span
          >Tahap: <strong class="text-slate-50">{{ data.class.level }}</strong></span
        >
      </p>

      <CcPanel icon="👤" :title="`Senarai Pelajar (${data.students.length})`">
        <div class="overflow-x-auto" data-testid="cc-table-scroller">
          <table :class="[T.table, 'min-w-[760px]']" data-testid="cc-students-table">
            <thead>
              <tr>
                <th v-for="c in COLUMNS" :key="c" :class="T.th">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(s, i) in data.students"
                :key="s.userId"
                :class="[T.row, T.rowLink]"
                data-testid="cc-student-row"
                :data-user-id="s.userId"
                @click="open(s.userId)"
              >
                <td :class="[T.td, 'font-mono text-xs text-slate-500']">{{ i + 1 }}</td>
                <td :class="[T.td, 'font-semibold text-slate-50']">
                  {{ s.name }}
                </td>
                <td :class="[T.td, 'font-mono text-slate-50']">{{ count(s.answers) }}</td>
                <td :class="T.td"><CcAccuracyBar :value="s.accuracy" /></td>
                <td :class="[T.td, 'font-mono whitespace-nowrap text-slate-400']">
                  {{ dayMonthTime(s.lastActiveAt) }}
                </td>
                <td :class="T.td">
                  <span
                    v-if="s.status === 'aktif'"
                    class="status-active inline-block rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-emerald-300 uppercase"
                    data-testid="cc-status"
                    >Aktif</span
                  >
                  <span
                    v-else
                    class="status-inactive inline-block rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-amber-300 uppercase"
                    data-testid="cc-status"
                    >Tidak Aktif</span
                  >
                </td>
                <td :class="T.td" data-testid="cc-mood">
                  <span v-if="s.mood" :title="MOOD[s.mood].label">{{ MOOD[s.mood].emoji }}</span>
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CcPanel>
    </template>
  </CcFrame>
</template>
