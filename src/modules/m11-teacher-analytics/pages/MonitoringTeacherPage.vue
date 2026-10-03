<script setup lang="ts">
/**
 * S5 Detail Guru (FR-M11-72..75; URS FT-M11-4.3). Header, four cards, "Prestasi Pelajar" (every T4/T5
 * pupil of the school, name A→Z; only pupils with answers are linked) and "Cadangan Tindakan" (each
 * box only when its count is > 0). The route prefix is a prop.
 */
import { CircleCheck, GraduationCap, Lightbulb, Presentation, TriangleAlert } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { fetchTeacherDetail } from '../api'
import MonitoringCrumbs from '../components/monitoring/MonitoringCrumbs.vue'
import MonitoringStatCard from '../components/monitoring/MonitoringStatCard.vue'
import {
  ACCURACY_TEXT_600,
  CARD,
  LOAD_ERROR_COPY,
  STAT_TONE,
  STATUS_LABEL,
  STATUS_PILL,
  accuracyBand,
  count,
  dmyHm,
  pct,
} from '../components/monitoring/monitoring-format'
import { MONITORING_BASE, monitoringPaths } from '../components/monitoring/monitoring-paths'
import { useMonitoringPage } from '../components/monitoring/use-monitoring-page'

const props = withDefaults(defineProps<{ schoolId: number; userId: number; basePath?: string }>(), {
  basePath: MONITORING_BASE,
})
const paths = computed(() => monitoringPaths(props.basePath))

const { data, error, blocked } = useMonitoringPage(
  (signal) => fetchTeacherDetail(props.schoolId, props.userId, { signal }),
  [() => props.schoolId, () => props.userId],
  (d) => `${d.teacher.name} - Detail Guru`,
)

const TH = 'px-3 py-2 text-left text-xs font-bold text-slate-500'
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="monitoring-teacher-page">
    <template v-if="!blocked">
      <MonitoringCrumbs
        :paths="paths"
        :school="data?.school.name ?? ''"
        :school-id="schoolId"
        :person="data?.teacher.name ?? ''"
      />

      <p v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700" data-testid="mon-error">
        {{ LOAD_ERROR_COPY }}
      </p>
      <p
        v-else-if="!data"
        class="flex items-center gap-2 text-sm text-slate-500"
        data-testid="mon-loading"
      >
        <LoadingSpinner class="h-4 w-4" />Memuatkan...
      </p>

      <template v-if="data">
        <section
          :class="[CARD, 'flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6']"
          data-testid="mon-teacher-header"
        >
          <div class="flex min-w-0 items-center gap-4">
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
            >
              <Presentation class="h-6 w-6" />
            </span>
            <div class="min-w-0">
              <h2
                class="font-heading text-lg font-bold break-words text-slate-800"
                data-testid="mon-teacher-name"
              >
                {{ data.teacher.name }}
              </h2>
              <p class="text-sm break-all text-slate-500">{{ data.teacher.email }}</p>
              <p class="text-xs text-slate-400" data-testid="mon-teacher-last">
                Login Terakhir: {{ dmyHm(data.teacher.lastLoginAt) }}
              </p>
            </div>
          </div>
          <span
            :class="[
              'rounded-full px-3 py-1 text-xs font-semibold',
              data.teacher.lastLoginAt
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500',
            ]"
            data-testid="mon-teacher-pill"
            >{{ data.teacher.lastLoginAt ? 'Pernah Login' : 'Belum Login' }}</span
          >
        </section>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="mon-teacher-cards">
          <MonitoringStatCard
            label="Pelajar T4/T5"
            :value="count(data.cards.students)"
            :tone="STAT_TONE.blue"
          />
          <MonitoringStatCard
            label="Pelajar Aktif"
            :value="count(data.cards.engaged)"
            :tone="STAT_TONE.green"
          />
          <MonitoringStatCard
            label="% Aktif"
            :value="pct(data.cards.pct)"
            :tone="STAT_TONE.purple"
          />
          <MonitoringStatCard
            label="Perlu Perhatian"
            :value="count(data.cards.needAttention)"
            :tone="STAT_TONE.rose"
          />
        </section>

        <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-teacher-students">
          <h3 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
            <GraduationCap class="h-5 w-5 text-indigo-600" />Prestasi Pelajar
          </h3>
          <div class="overflow-x-auto" data-testid="mon-teacher-students-scroller">
            <table class="w-full min-w-[560px] text-sm">
              <thead>
                <tr class="border-b border-slate-100">
                  <th :class="TH">#</th>
                  <th :class="TH">Pelajar</th>
                  <th :class="TH">Tingkatan</th>
                  <th :class="TH">Soalan</th>
                  <th :class="TH">Ketepatan</th>
                  <th :class="TH">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(s, i) in data.students"
                  :key="s.id"
                  :class="['border-b border-slate-50', s.answers === 0 ? 'opacity-50' : '']"
                  data-testid="mon-teacher-student-row"
                  :data-student-id="s.id"
                >
                  <td class="px-3 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-3 py-2">
                    <RouterLink
                      v-if="s.answers > 0"
                      :to="paths.student(schoolId, s.id)"
                      class="font-semibold text-indigo-600 hover:underline"
                      data-testid="mon-teacher-student-link"
                      >{{ s.name }}</RouterLink
                    >
                    <span v-else class="text-slate-700">{{ s.name }}</span>
                  </td>
                  <td class="px-3 py-2 text-slate-600">{{ s.level }}</td>
                  <td class="px-3 py-2 text-slate-600">{{ count(s.answers) }}</td>
                  <td
                    :class="[
                      'px-3 py-2 font-semibold',
                      s.accuracy === null
                        ? 'text-slate-300'
                        : ACCURACY_TEXT_600[accuracyBand(s.accuracy)],
                    ]"
                    data-testid="mon-teacher-accuracy"
                  >
                    {{ s.accuracy === null ? '-' : pct(s.accuracy) }}
                  </td>
                  <td class="px-3 py-2">
                    <span
                      :class="[
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_PILL[s.status],
                      ]"
                      >{{ STATUS_LABEL[s.status] }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section :class="[CARD, 'space-y-2 p-3 sm:p-5']" data-testid="mon-teacher-suggestions">
          <h3 class="mb-1 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
            <Lightbulb class="h-5 w-5 text-blue-500" />Cadangan Tindakan
          </h3>
          <p
            v-if="data.suggestions.neverLoggedIn > 0"
            class="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            data-testid="mon-suggestion-never"
          >
            <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />{{ data.suggestions.neverLoggedIn }}
            pelajar belum pernah login. Cadangan: Adakan sesi pengenalan platform di kelas.
          </p>
          <p
            v-if="data.suggestions.lowAccuracy > 0"
            class="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            data-testid="mon-suggestion-low"
          >
            {{ data.suggestions.lowAccuracy }} pelajar aktif mempunyai ketepatan bawah 50%.
            Cadangan: Beri perhatian khas kepada pelajar ini.
          </p>
          <p
            v-if="data.suggestions.answered > 0"
            class="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"
            data-testid="mon-suggestion-answered"
          >
            <CircleCheck class="mt-0.5 h-4 w-4 shrink-0" />{{ data.suggestions.answered }} pelajar
            telah mula menjawab soalan. Galakkan mereka kekalkan momentum.
          </p>
        </section>
      </template>
    </template>
  </div>
</template>
