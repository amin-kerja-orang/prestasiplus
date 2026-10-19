<script setup lang="ts">
/**
 * S5 Detail Guru (FR-M11-72..75; URS FT-M11-4.3). Header, four cards, "Prestasi Pelajar" (every T4/T5
 * pupil of the school, name A->Z; only pupils with answers are linked) and "Cadangan Tindakan" (each
 * box only when its count is > 0). The route prefix is a prop.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import {
  DsBreadcrumb,
  DsDataTable,
  DsIconChip,
  DsLoadError,
  DsPage,
  DsStatRow,
  type StatItem,
  DsCluster,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'

import { fetchTeacherDetail } from '../api'
import type { StudentStatus, TeacherDetail } from '../api/types'
import {
  ACCURACY_TEXT,
  STATUS_COLOR,
  STATUS_LABEL,
  accuracyBand,
  count,
  dmyHm,
  pct,
} from '../components/monitoring/monitoring-format'
import {
  MONITORING_BASE,
  monitoringCrumbs,
  monitoringPaths,
} from '../components/monitoring/monitoring-paths'
import { useMonitoringPage } from '../components/monitoring/use-monitoring-page'

const props = withDefaults(defineProps<{ schoolId: number; userId: number; basePath?: string }>(), {
  basePath: MONITORING_BASE,
})
const paths = computed(() => monitoringPaths(props.basePath))
const statusColor = (s: StudentStatus) => STATUS_COLOR[s]
const statusLabel = (s: StudentStatus) => STATUS_LABEL[s]

const { data, error, blocked, reload } = useMonitoringPage(
  (signal) => fetchTeacherDetail(props.schoolId, props.userId, { signal }),
  [() => props.schoolId, () => props.userId],
  (d) => `${d.teacher.name} - Detail Guru`,
)

const cards = computed<StatItem[]>(() => {
  const c = data.value?.cards
  if (!c) return []
  return [
    {
      key: 'students',
      label: 'Pelajar T4/T5',
      value: count(c.students),
      icon: 'i-ph-graduation-cap',
      accent: 'friend',
    },
    {
      key: 'engaged',
      label: 'Pelajar Aktif',
      value: count(c.engaged),
      icon: 'i-ph-check-circle',
      accent: 'win',
      valueTone: 'success',
    },
    {
      key: 'pct',
      label: '% Aktif',
      value: pct(c.pct),
      icon: 'i-ph-percent',
      accent: 'action',
      valueTone: 'primary',
    },
    {
      key: 'attention',
      label: 'Perlu Perhatian',
      value: count(c.needAttention),
      icon: 'i-ph-warning',
      accent: 'heat',
    },
  ]
})

type PupilRow = TeacherDetail['students'][number] & { rank: number } & Record<string, unknown>
const pupils = computed<PupilRow[]>(() =>
  (data.value?.students ?? []).map((s, i) => ({ ...s, rank: i + 1 })),
)
/** Paged at 20 rows (FN-M11-4.3.x). */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
const columns: TableColumn<PupilRow>[] = [
  { id: 'no', header: '#', accessorKey: 'rank' },
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
      <DsBreadcrumb
        :items="
          monitoringCrumbs(paths, data?.school.name ?? '', schoolId, data?.teacher.name ?? '')
        "
        data-testid="mon-crumbs"
      />

      <DsLoadError v-if="error" testid="mon-error" @retry="reload" />
      <p
        v-else-if="!data"
        class="flex items-center gap-2 text-body text-muted"
        data-testid="mon-loading"
      >
        <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
      </p>

      <template v-if="data">
        <UCard data-testid="mon-teacher-header">
          <DsCluster gap="md" justify="between">
            <DsCluster gap="md" :wrap="false">
              <DsIconChip icon="chalkboard-teacher" size="lg" />
              <DsStack gap="2xs">
                <DsHeading
                  :level="2"
                  variant="title"
                  wrap="anywhere"
                  data-testid="mon-teacher-name"
                >
                  {{ data.teacher.name }}
                </DsHeading>
                <DsText variant="body" tone="muted" class="break-all">{{
                  data.teacher.email
                }}</DsText>
                <DsText variant="body" tone="muted" data-testid="mon-teacher-last">
                  Login Terakhir: {{ dmyHm(data.teacher.lastLoginAt) }}
                </DsText>
              </DsStack>
            </DsCluster>
            <UBadge
              :color="data.teacher.lastLoginAt ? 'success' : 'neutral'"
              variant="subtle"
              size="lg"
              data-testid="mon-teacher-pill"
              :label="data.teacher.lastLoginAt ? 'Pernah Login' : 'Belum Login'"
            />
          </DsCluster>
        </UCard>

        <DsStatRow
          :items="cards"
          prefix="mon-stat"
          :cols="4"
          density="roomy"
          data-testid="mon-teacher-cards"
        />

        <UCard data-testid="mon-teacher-students">
          <DsStack gap="lg">
            <h2 class="flex items-center gap-2 text-heading text-highlighted">
              <UIcon name="i-ph-graduation-cap" class="size-6 text-primary-t" />Prestasi Pelajar
            </h2>
            <div data-testid="mon-teacher-students-scroller">
              <DsDataTable
                v-model:page-size="pageSize"
                variant="bare"
                :page-size-options="PAGE_SIZES"
                :data="pupils"
                :columns="columns"
                caption="Prestasi pelajar"
              >
                <template #no-cell="{ row }">
                  <DsText variant="body" as="span" tone="muted" tabular>{{
                    row.original.rank
                  }}</DsText>
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
                      class="line-clamp-2 text-label text-primary-t"
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
                    size="lg"
                    class="whitespace-nowrap"
                    :label="statusLabel(row.original.status)"
                  />
                </template>
                <template #card="{ row }">
                  <DsStack gap="sm">
                    <DsCluster align="start" justify="between" :wrap="false">
                      <RouterLink
                        v-if="(row as PupilRow).answers > 0"
                        :to="paths.student(schoolId, (row as PupilRow).id)"
                        class="line-clamp-2 text-label text-primary-t"
                        >{{ (row as PupilRow).name }}</RouterLink
                      >
                      <DsText v-else variant="label" tone="muted" :clamp="2">{{
                        (row as PupilRow).name
                      }}</DsText>
                      <UBadge
                        :color="statusColor((row as PupilRow).status)"
                        variant="subtle"
                        size="lg"
                        class="whitespace-nowrap"
                        :label="statusLabel((row as PupilRow).status)"
                      />
                    </DsCluster>
                    <dl class="grid grid-cols-2 gap-3 text-body">
                      <div>
                        <dt class="text-muted">Tingkatan · Soalan</dt>
                        <DsText variant="label" as="dd" tabular>
                          {{ (row as PupilRow).level }} · {{ count((row as PupilRow).answers) }}
                        </DsText>
                      </div>
                      <div>
                        <dt class="text-muted">Ketepatan</dt>
                        <DsText variant="label" as="dd" tabular>
                          {{
                            (row as PupilRow).accuracy === null
                              ? '-'
                              : pct((row as PupilRow).accuracy!)
                          }}
                        </DsText>
                      </div>
                    </dl>
                  </DsStack>
                </template>
              </DsDataTable>
            </div>
          </DsStack>
        </UCard>

        <UCard data-testid="mon-teacher-suggestions">
          <DsStack>
            <h2 class="flex items-center gap-2 text-heading text-highlighted">
              <UIcon name="i-ph-lightbulb" class="size-6 text-info" />Cadangan Tindakan
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
          </DsStack>
        </UCard>
      </template>
    </template>
  </DsPage>
</template>
