<script setup lang="ts">
/**
 * S5 "{guru} - Command Center" (M17 FR-M17-51, FN-M17-5.2.x): back link "← Kembali ke Sekolah",
 * breadcrumb, the info bar "Sekolah:" and "Senarai Kelas ({n})" (a row opens S6; no class = the row
 * "Tiada kelas aktif"). The route prefix is a prop (M10 and school-admin mounts).
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { fetchCcTeacher } from '../api/command-center'
import { CC_TABLE as T, count, LOAD_ERROR_COPY } from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcAccuracyBar from '../components/command-center/CcAccuracyBar.vue'
import CcFrame from '../components/command-center/CcFrame.vue'
import CcPanel from '../components/command-center/CcPanel.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

const props = withDefaults(defineProps<{ schoolId: number; userId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const router = useRouter()
const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound } = useCcPage(
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
const COLUMNS = [
  '#',
  'Nama Kelas',
  'Tahap',
  'Pelajar',
  'Aktif (30h)',
  'Jumlah Jawapan',
  'Ketepatan',
]

function open(classId: number) {
  void router.push(paths.value.classroom(classId))
}
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="data ? paths.school(data.school.id) : paths.overview"
    back-label="← Kembali ke Sekolah"
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
      <p class="text-sm text-slate-400" data-testid="cc-info">
        Sekolah: <strong class="text-slate-50">{{ data.school.name }}</strong>
      </p>

      <CcPanel icon="📚" :title="`Senarai Kelas (${data.classes.length})`">
        <div class="overflow-x-auto" data-testid="cc-table-scroller">
          <table :class="[T.table, 'min-w-[640px]']" data-testid="cc-classes-table">
            <thead>
              <tr>
                <th v-for="c in COLUMNS" :key="c" :class="T.th">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="data.classes.length === 0" :class="T.row" data-testid="cc-empty-row">
                <td :class="[T.td, 'text-slate-400']" colspan="7">Tiada kelas aktif</td>
              </tr>
              <tr
                v-for="(c, i) in data.classes"
                :key="c.id"
                :class="[T.row, T.rowLink]"
                data-testid="cc-class-row"
                :data-class-id="c.id"
                @click="open(c.id)"
              >
                <td :class="[T.td, 'font-mono text-xs text-slate-500']">{{ i + 1 }}</td>
                <td :class="[T.td, 'font-semibold text-slate-50']">
                  {{ c.name }}
                </td>
                <td :class="T.td">{{ c.level }}</td>
                <td :class="[T.td, 'font-mono text-slate-50']">{{ c.students }}</td>
                <td :class="[T.td, 'font-mono text-emerald-400']">{{ c.active30d }}</td>
                <td :class="[T.td, 'font-mono text-slate-50']">{{ count(c.answers) }}</td>
                <td :class="T.td"><CcAccuracyBar :value="c.accuracy" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CcPanel>
    </template>
  </CcFrame>
</template>
