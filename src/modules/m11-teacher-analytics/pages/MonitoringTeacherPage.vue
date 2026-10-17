<script setup lang="ts">
/**
 * S5 Detail Guru (FR-M11-72..75; URS FT-M11-4.3). Header, four cards, "Prestasi Pelajar" (every T4/T5
 * pupil of the school, name A->Z; only pupils with answers are linked) and "Cadangan Tindakan" (each
 * box only when its count is > 0). The route prefix is a prop.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsDrillTable, DsPage } from '@/ds'

import { fetchTeacherDetail } from '../api'
import type { StudentStatus, TeacherDetail } from '../api/types'
import MonitoringCrumbs from '../components/monitoring/MonitoringCrumbs.vue'
import MonitoringStatCard from '../components/monitoring/MonitoringStatCard.vue'
import {
  ACCURACY_TEXT,
  LOAD_ERROR_COPY,
  STATUS_COLOR,
  STATUS_LABEL,
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
const statusColor = (s: StudentStatus) => STATUS_COLOR[s]
const statusLabel = (s: StudentStatus) => STATUS_LABEL[s]

const { data, error, blocked } = useMonitoringPage(
  (signal) => fetchTeacherDetail(props.schoolId, props.userId, { signal }),
  [() => props.schoolId, () => props.userId],
  (d) => `${d.teacher.name} - Detail Guru`,
)

type PupilRow = TeacherDetail['students'][number] & Record<string, unknown>
const pupils = computed<PupilRow[]>(() => (data.value?.students ?? []).map((s) => ({ ...s })))
const columns: TableColumn<PupilRow>[] = [
  { id: 'no', header: '#', accessorFn: (r) => r.id },
  { id: 'name', header: 'Pelajar', accessorKey: 'name' },
  { id: 'level', header: 'Tingkatan', accessorKey: 'level' },
  { id: 'answers', header: 'Soalan', accessorKey: 'answers' },
  { id: 'accuracy', header: 'Ketepatan', accessorKey: 'accuracy' },
  { id: 'status', header: 'Status', accessorKey: 'status' },
]
</script>

<template>
  <DsPage data-testid="monitoring-teacher-page">
    <template v-if="!blocked">
      <MonitoringCrumbs
        :paths="paths"
        :school="data?.school.name ?? ''"
        :school-id="schoolId"
        :person="data?.teacher.name ?? ''"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-ph-warning"
        :description="LOAD_ERROR_COPY"
        data-testid="mon-error"
      />
      <p
        v-else-if="!data"
        class="flex items-center gap-2 text-body text-muted"
        data-testid="mon-loading"
      >
        <UIcon name="i-ph-circle-notch" class="size-4" />Memuatkan...
      </p>

      <template v-if="data">
        <UCard data-testid="mon-teacher-header">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-4">
              <UIcon name="i-ph-chalkboard-teacher" class="size-8 shrink-0 text-primary" />
              <div class="flex min-w-0 flex-col gap-1">
                <h2
                  class="text-heading break-words text-highlighted"
                  data-testid="mon-teacher-name"
                >
                  {{ data.teacher.name }}
                </h2>
                <p class="text-body break-all text-muted">{{ data.teacher.email }}</p>
                <p class="text-caption text-muted" data-testid="mon-teacher-last">
                  Login Terakhir: {{ dmyHm(data.teacher.lastLoginAt) }}
                </p>
              </div>
            </div>
            <UBadge
              :color="data.teacher.lastLoginAt ? 'success' : 'neutral'"
              variant="subtle"
              data-testid="mon-teacher-pill"
              :label="data.teacher.lastLoginAt ? 'Pernah Login' : 'Belum Login'"
            />
          </div>
        </UCard>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="mon-teacher-cards">
          <MonitoringStatCard label="Pelajar T4/T5" :value="count(data.cards.students)" />
          <MonitoringStatCard label="Pelajar Aktif" :value="count(data.cards.engaged)" />
          <MonitoringStatCard label="% Aktif" :value="pct(data.cards.pct)" />
          <MonitoringStatCard label="Perlu Perhatian" :value="count(data.cards.needAttention)" />
        </section>

        <UCard data-testid="mon-teacher-students">
          <div class="flex flex-col gap-4">
            <h2 class="flex items-center gap-2 text-label text-highlighted">
              <UIcon name="i-ph-graduation-cap" class="size-5 text-primary" />Prestasi Pelajar
            </h2>
            <div data-testid="mon-teacher-students-scroller">
              <DsDrillTable :data="pupils" :columns="columns" caption="Prestasi pelajar">
                <template #no-cell="{ row }">
                  <span class="tabular text-caption text-muted">{{ row.index + 1 }}</span>
                </template>
                <template #name-cell="{ row }">
                  <div
                    :class="['min-w-48', row.original.answers === 0 ? 'text-muted' : '']"
                    :data-faded="row.original.answers === 0 ? 'true' : 'false'"
                    data-testid="mon-teacher-student-row"
                    :data-student-id="row.original.id"
                  >
                    <RouterLink
                      v-if="row.original.answers > 0"
                      :to="paths.student(schoolId, row.original.id)"
                      class="text-label text-primary"
                      data-testid="mon-teacher-student-link"
                      >{{ row.original.name }}</RouterLink
                    >
                    <span v-else>{{ row.original.name }}</span>
                  </div>
                </template>
                <template #answers-cell="{ row }">
                  <span class="tabular">{{ count(row.original.answers) }}</span>
                </template>
                <template #accuracy-cell="{ row }">
                  <span
                    :class="[
                      'tabular text-label',
                      row.original.accuracy === null
                        ? 'text-dimmed'
                        : ACCURACY_TEXT[accuracyBand(row.original.accuracy)],
                    ]"
                    data-testid="mon-teacher-accuracy"
                    >{{ row.original.accuracy === null ? '-' : pct(row.original.accuracy) }}</span
                  >
                </template>
                <template #status-cell="{ row }">
                  <UBadge
                    :color="statusColor(row.original.status)"
                    variant="subtle"
                    :label="statusLabel(row.original.status)"
                  />
                </template>
              </DsDrillTable>
            </div>
          </div>
        </UCard>

        <UCard data-testid="mon-teacher-suggestions">
          <div class="flex flex-col gap-3">
            <h2 class="flex items-center gap-2 text-label text-highlighted">
              <UIcon name="i-ph-lightbulb" class="size-5 text-info" />Cadangan Tindakan
            </h2>
            <UAlert
              v-if="data.suggestions.neverLoggedIn > 0"
              color="error"
              variant="subtle"
              icon="i-ph-warning"
              data-testid="mon-suggestion-never"
              :description="`${data.suggestions.neverLoggedIn} pelajar belum pernah login. Cadangan: Adakan sesi pengenalan platform di kelas.`"
            />
            <UAlert
              v-if="data.suggestions.lowAccuracy > 0"
              color="error"
              variant="subtle"
              data-testid="mon-suggestion-low"
              :description="`${data.suggestions.lowAccuracy} pelajar aktif mempunyai ketepatan bawah 50%. Cadangan: Beri perhatian khas kepada pelajar ini.`"
            />
            <UAlert
              v-if="data.suggestions.answered > 0"
              color="success"
              variant="subtle"
              icon="i-ph-check-circle"
              data-testid="mon-suggestion-answered"
              :description="`${data.suggestions.answered} pelajar telah mula menjawab soalan. Galakkan mereka kekalkan momentum.`"
            />
          </div>
        </UCard>
      </template>
    </template>
  </DsPage>
</template>
