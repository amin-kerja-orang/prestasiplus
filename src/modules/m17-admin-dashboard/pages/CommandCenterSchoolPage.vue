<script setup lang="ts">
/**
 * S4 "{sekolah} - Command Center" (M17 FR-M17-48..50, FN-M17-5.1.x; DV-M17-22): header, back link
 * "← Kembali ke Overview", breadcrumb, the four cards and "Senarai Guru ({n})" (a row opens S5).
 * The route prefix is a prop so M10 (`/guru/command-center`) and the school-admin alias mount it.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { fetchCcSchool } from '../api/command-center'
import { CC_TABLE as T, count, LOAD_ERROR_COPY, pct1 } from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcFrame from '../components/command-center/CcFrame.vue'
import CcPanel from '../components/command-center/CcPanel.vue'
import CcStatCard from '../components/command-center/CcStatCard.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

const props = withDefaults(defineProps<{ schoolId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const router = useRouter()
const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound } = useCcPage(
  (signal) => fetchCcSchool(props.schoolId, { signal }),
  () => props.schoolId,
  (d) => d.school.name,
)

const crumbs = computed(() => [
  { label: 'Command Center', to: paths.value.overview },
  { label: data.value?.school.name ?? '' },
])
const COLUMNS = ['#', 'Nama Guru', 'Subjek', 'Kelas', 'Pelajar', 'Aktif (30h)']

function open(userId: number) {
  void router.push(paths.value.teacher(props.schoolId, userId))
}
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="paths.overview"
    back-label="← Kembali ke Overview"
    :crumbs="data ? crumbs : [{ label: 'Command Center', to: paths.overview }]"
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
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="cc-school-cards">
        <CcStatCard label="Jumlah Pelajar" :value="count(data.cards.students)" accent="indigo" />
        <CcStatCard label="Pelajar Aktif" :value="count(data.cards.active)" accent="emerald" />
        <CcStatCard label="Jumlah Jawapan" :value="count(data.cards.answers)" accent="amber" />
        <CcStatCard label="Ketepatan" :value="pct1(data.cards.accuracy)" accent="rose" />
      </div>

      <CcPanel icon="👤" :title="`Senarai Guru (${data.teachers.length})`">
        <div class="overflow-x-auto" data-testid="cc-table-scroller">
          <table :class="[T.table, 'min-w-[560px]']" data-testid="cc-teachers-table">
            <thead>
              <tr>
                <th v-for="c in COLUMNS" :key="c" :class="T.th">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(t, i) in data.teachers"
                :key="t.userId"
                :class="[T.row, T.rowLink]"
                data-testid="cc-teacher-row"
                :data-user-id="t.userId"
                @click="open(t.userId)"
              >
                <td :class="[T.td, 'font-mono text-xs text-slate-500']">{{ i + 1 }}</td>
                <td :class="[T.td, 'font-semibold text-slate-50']">
                  {{ t.name }}
                </td>
                <td :class="T.td">{{ t.subjectText ?? '-' }}</td>
                <td :class="[T.td, 'font-mono text-slate-50']">{{ t.classes }}</td>
                <td :class="[T.td, 'font-mono text-slate-50']">{{ t.students }}</td>
                <td :class="[T.td, 'font-mono text-emerald-400']">{{ t.active30d }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CcPanel>
    </template>
  </CcFrame>
</template>
