<script setup lang="ts">
/**
 * "Ramalan Prestasi Pelajar Aktif" (FN-M12-6.6.1; FR-M12-53; BR-M12-21; NFR-M12-01): every active student, no pager
 * (946 rows). Rows are plain cells with no per-row component or watcher; the two links of a row are plain
 * anchors handled by one delegated click listener, so the table stays interactive within 2 s.
 */
import { useRouter } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AppIcon } from '@/components/icon'

import { count, pct } from '../common/kirkpatrick-format'
import { GRADE_PILL, GRADE_TEXT } from './results-format'
import type { ResultsPrediction } from './results-types'

const props = defineProps<{
  rows: ResultsPrediction[]
  schoolPath: (id: number) => string
}>()

const router = useRouter()

const studentHref = (r: ResultsPrediction) => `${props.schoolPath(r.schoolId)}/pelajar/${r.userId}`

/** One listener for both link columns: an in-app navigation unless a modifier key asks for a new tab. */
function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return
  const a = (e.target as HTMLElement).closest('a[href]')
  const href = a?.getAttribute('href')
  if (!href) return
  e.preventDefault()
  void router.push(href)
}

const HEAD = `${T.th} text-center`
const NUM = `${T.td} text-center`
</script>

<template>
  <DataTableCard :min-width="680" data-testid="res-predictions">
    <template #header>
      <div class="px-4 pt-4 sm:px-5">
        <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
          <AppIcon name="fa-magic" class="h-4 w-4 text-purple-600" />Ramalan Prestasi Pelajar Aktif
        </h2>
        <p class="text-xs text-slate-400">Berdasarkan ketepatan menjawab soalan dalam platform</p>
      </div>
    </template>
    <table :class="T.table" @click="onClick">
      <thead>
        <tr>
          <th :class="T.th">#</th>
          <th :class="T.th">Pelajar</th>
          <th :class="T.th">Sekolah</th>
          <th :class="HEAD">Soalan</th>
          <th :class="HEAD">Ketepatan</th>
          <th :class="HEAD">Anggaran Gred</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.userId" :class="T.row" data-testid="res-pred-row">
          <td :class="`${T.td} text-slate-400`">{{ i + 1 }}</td>
          <td :class="T.td">
            <a
              :href="studentHref(r)"
              class="font-medium text-indigo-600 hover:underline"
              data-testid="pred-student"
              >{{ r.name }}</a
            >
          </td>
          <td :class="T.td">
            <a
              :href="schoolPath(r.schoolId)"
              class="text-indigo-600 hover:underline"
              data-testid="pred-school"
              >{{ r.schoolName }}</a
            >
          </td>
          <td :class="NUM">{{ count(r.answers) }}</td>
          <td :class="[NUM, 'font-semibold', GRADE_TEXT[r.grade]]" data-testid="pred-accuracy">
            {{ pct(r.accuracy) }}
          </td>
          <td :class="NUM">
            <span
              :class="[
                'inline-block min-w-8 rounded-full px-2 py-0.5 text-xs font-bold text-white',
                GRADE_PILL[r.grade],
              ]"
              data-testid="pred-grade"
              >{{ r.grade }}</span
            >
          </td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <p class="flex items-start gap-1.5 px-4 py-3 text-xs text-slate-400 sm:px-5">
        <AppIcon name="fa-info-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />Ramalan ini berdasarkan
        ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih banyak data
        termasuk keputusan peperiksaan terdahulu.
      </p>
    </template>
  </DataTableCard>
</template>
