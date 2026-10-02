<script setup lang="ts">
/**
 * The two S2 engagement tables (FN-M11-3.4.x student `#section-pelajar`, FN-M11-3.5.x teacher
 * `#section-guru`; FR-M11-37..42). Same columns, tahap colours, bar variants and legend; the teacher
 * table has "Login" instead of "Aktif" and one more legend entry. Empty rows render the headers and an
 * empty body with no message (FR-M11-51). The table scrolls inside its card with a right fade below `lg`.
 */
import { ChartBar, Presentation } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { SchoolEngagementRow, TeacherEngagementRow } from '../../api/types'
import { CARD, count, pct, TAHAP } from './monitoring-format'
import type { MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  kind: 'student' | 'teacher'
  rows: readonly (SchoolEngagementRow | TeacherEngagementRow)[]
  paths: MonitoringPaths
}>()

const isStudent = computed(() => props.kind === 'student')
const sectionId = computed(() => (isStudent.value ? 'section-pelajar' : 'section-guru'))
const title = computed(() =>
  isStudent.value ? 'Analisis Penglibatan Pelajar T4/T5' : 'Analisis Penglibatan Guru',
)
const activeLabel = computed(() => (isStudent.value ? 'Aktif' : 'Login'))

const active = (r: SchoolEngagementRow | TeacherEngagementRow) =>
  'engaged' in r ? r.engaged : r.loggedIn

const LEGEND = [
  ['bg-green-700', 'Cemerlang (> 60%)'],
  ['bg-orange-600', 'Sederhana (20-60%)'],
  ['bg-red-600', 'Rendah (5-20%)'],
  ['bg-red-800', 'Kritikal (< 5%)'],
  ['bg-gray-500', 'Tiada Langsung (0%)'],
] as const

const TH = 'px-3 py-2 text-left text-xs font-bold uppercase text-slate-500'
</script>

<template>
  <section
    :id="sectionId"
    :class="[CARD, 'scroll-mt-20 p-3 sm:p-5']"
    :data-testid="`mon-table-${kind}`"
  >
    <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
          <component
            :is="isStudent ? ChartBar : Presentation"
            :class="['h-5 w-5', isStudent ? 'text-indigo-600' : 'text-amber-500']"
          />{{ title }}
        </h3>
        <p class="text-xs text-slate-500">
          Mengikut sekolah — disusun mengikut % penglibatan tertinggi
        </p>
      </div>
      <span class="text-xs text-slate-400" data-testid="mon-table-count"
        >{{ count(rows.length) }} sekolah</span
      >
    </div>

    <div class="relative">
      <div class="overflow-x-auto" data-testid="mon-table-scroller">
        <table class="w-full min-w-[640px] text-sm">
          <thead>
            <tr class="border-b border-slate-100">
              <th :class="TH">#</th>
              <th :class="TH">Sekolah</th>
              <th :class="TH">Daftar</th>
              <th :class="TH">{{ activeLabel }}</th>
              <th :class="TH">%</th>
              <th :class="TH">Tahap</th>
              <th :class="[TH, 'min-w-[140px]']">Bar</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="r.schoolId"
              class="border-b border-slate-50"
              data-testid="mon-table-row"
              :data-school-id="r.schoolId"
            >
              <td class="px-3 py-2 font-mono text-xs text-slate-400">{{ i + 1 }}</td>
              <td class="px-3 py-2">
                <RouterLink
                  :to="paths.school(r.schoolId)"
                  class="font-semibold text-indigo-600 hover:underline"
                  data-testid="mon-school-link"
                  >{{ r.name }}</RouterLink
                >
                <p class="text-xs text-slate-400">{{ r.code ?? '-' }} · {{ r.state }}</p>
              </td>
              <td class="px-3 py-2 text-slate-600">{{ count(r.registered) }}</td>
              <td class="px-3 py-2 text-slate-600">{{ count(active(r)) }}</td>
              <td :class="['px-3 py-2 text-lg font-bold', TAHAP[r.tahap].text]">
                {{ pct(r.pct) }}
              </td>
              <td class="px-3 py-2">
                <span
                  :class="[
                    'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white',
                    TAHAP[r.tahap].pill,
                  ]"
                  >{{ r.tahap }}</span
                >
              </td>
              <td class="px-3 py-2">
                <div class="flex h-4 min-w-[140px] items-center rounded-full bg-slate-100">
                  <template v-if="TAHAP[r.tahap].bar === 'empty'">
                    <span class="pl-2 text-xs text-slate-400">0%</span>
                  </template>
                  <template v-else-if="TAHAP[r.tahap].bar === 'inside'">
                    <div
                      :class="[
                        'flex h-4 items-center justify-end overflow-hidden rounded-full pr-1',
                        TAHAP[r.tahap].fill,
                      ]"
                      :style="{ width: `${String(Math.max(r.pct, 3))}%` }"
                    >
                      <span
                        class="text-xs leading-none font-semibold whitespace-nowrap text-white"
                        >{{ pct(r.pct) }}</span
                      >
                    </div>
                  </template>
                  <template v-else>
                    <div
                      :class="['h-4 shrink-0 rounded-full', TAHAP[r.tahap].fill]"
                      :style="{ width: `${String(Math.max(r.pct, 3))}%` }"
                    />
                    <span
                      :class="['pl-1 text-xs leading-none font-semibold', TAHAP[r.tahap].text]"
                      >{{ pct(r.pct) }}</span
                    >
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white lg:hidden"
        data-testid="mon-table-fade"
      />
    </div>

    <p
      class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"
      data-testid="mon-legend"
    >
      <span class="font-semibold">Legenda:</span>
      <span v-for="[dot, label] in LEGEND" :key="label" class="flex items-center gap-1.5">
        <span :class="['h-2.5 w-2.5 rounded-full', dot]" />{{ label }}
      </span>
      <span v-if="!isStudent" class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-full bg-slate-300" />Tiada Guru (0 daftar)
      </span>
    </p>
  </section>
</template>
