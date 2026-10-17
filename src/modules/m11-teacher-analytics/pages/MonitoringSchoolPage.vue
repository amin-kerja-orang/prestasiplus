<script setup lang="ts">
/**
 * S3 Detail Sekolah (FR-M11-53..61; URS FT-M11-4.1). Header card, five cards, the pupil list with
 * client-side pills and search (rows are filtered by their data values, never by interpolated names:
 * DV-M11-18) and the teacher list. The route prefix is a prop (see `MonitoringPage.vue`).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { DsDrillTable, DsPage } from '@/ds'

import { fetchSchoolDetail } from '../api'
import type { SchoolDetailStudent, SchoolDetailTeacher, StudentStatus } from '../api/types'
import MonitoringCrumbs from '../components/monitoring/MonitoringCrumbs.vue'
import MonitoringStatCard from '../components/monitoring/MonitoringStatCard.vue'
import {
  LOAD_ERROR_COPY,
  STATUS_COLOR,
  STATUS_LABEL,
  TAHAP,
  count,
  dmy,
  dmyHm,
  pct,
  subscriptionDate,
} from '../components/monitoring/monitoring-format'
import { MONITORING_BASE, monitoringPaths } from '../components/monitoring/monitoring-paths'
import { useMonitoringPage } from '../components/monitoring/use-monitoring-page'
import NativeInput from '../components/native/NativeInput.vue'

const props = withDefaults(defineProps<{ schoolId: number; basePath?: string }>(), {
  basePath: MONITORING_BASE,
})
const paths = computed(() => monitoringPaths(props.basePath))
const statusColor = (s: StudentStatus) => STATUS_COLOR[s]
const statusLabel = (s: StudentStatus) => STATUS_LABEL[s]

const { data, error, blocked } = useMonitoringPage(
  (signal) => fetchSchoolDetail(props.schoolId, { signal }),
  () => props.schoolId,
  (d) => `${d.school.name} - Monitoring`,
)

type StudentFilter = 'all' | 'active' | 'login' | 'never'
const studentFilter = ref<StudentFilter>('all')
const search = ref('')
type TeacherFilter = 'all' | 'login' | 'never'
const teacherFilter = ref<TeacherFilter>('all')

const students = computed(() => {
  const d = data.value
  if (!d) return []
  const term = search.value.trim().toLowerCase()
  return d.students.filter((s) => {
    const byPill =
      studentFilter.value === 'all' ||
      (studentFilter.value === 'active' && s.engaged) ||
      (studentFilter.value === 'login' && s.answers === 0 && s.lastLoginAt !== null) ||
      (studentFilter.value === 'never' && s.lastLoginAt === null)
    return byPill && (term === '' || s.name.toLowerCase().includes(term))
  })
})

const teachers = computed(() => {
  const d = data.value
  if (!d) return []
  return d.teachers.filter(
    (t) =>
      teacherFilter.value === 'all' ||
      (teacherFilter.value === 'login' && t.loggedIn) ||
      (teacherFilter.value === 'never' && !t.loggedIn),
  )
})

const SUBSCRIPTION_COLOR = {
  active: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
} as const
const SUBSCRIPTION_LABEL = { active: 'Active', cancelled: 'Cancelled', expired: 'Expired' } as const

const STUDENT_PILLS: { key: StudentFilter; testid: string; label: () => string }[] = [
  {
    key: 'all',
    testid: 'mon-pill-all',
    label: () => `Semua (${count(data.value?.students.length ?? 0)})`,
  },
  {
    key: 'active',
    testid: 'mon-pill-active',
    label: () => `● Aktif (${count(data.value?.cards.engaged ?? 0)})`,
  },
  { key: 'login', testid: 'mon-pill-login', label: () => 'Login sahaja' },
  { key: 'never', testid: 'mon-pill-never', label: () => 'Belum login' },
]
const TEACHER_PILLS: { key: TeacherFilter; testid: string; label: string }[] = [
  { key: 'all', testid: 'mon-tpill-all', label: 'Semua' },
  { key: 'login', testid: 'mon-tpill-login', label: 'Pernah Login' },
  { key: 'never', testid: 'mon-tpill-never', label: 'Belum Login' },
]

type StudentRow = SchoolDetailStudent & Record<string, unknown>
type TeacherRow = SchoolDetailTeacher & Record<string, unknown>
const studentData = computed<StudentRow[]>(() => students.value.map((s) => ({ ...s })))
const teacherData = computed<TeacherRow[]>(() => teachers.value.map((t) => ({ ...t })))
const studentColumns: TableColumn<StudentRow>[] = [
  { id: 'no', header: '#', accessorFn: (r) => r.id },
  { id: 'name', header: 'Nama', accessorKey: 'name' },
  { id: 'level', header: 'Tingkatan', accessorKey: 'level' },
  { id: 'answers', header: 'Soalan', accessorKey: 'answers' },
  { id: 'status', header: 'Status', accessorKey: 'status' },
  { id: 'lastLogin', header: 'Login Terakhir', accessorKey: 'lastLoginAt' },
  { id: 'lastActivity', header: 'Aktiviti Terakhir', accessorKey: 'lastActivityAt' },
]
const teacherColumns: TableColumn<TeacherRow>[] = [
  { id: 'no', header: '#', accessorFn: (r) => r.id },
  { id: 'name', header: 'Nama', accessorKey: 'name' },
  { id: 'status', header: 'Status', accessorKey: 'loggedIn' },
  { id: 'lastLogin', header: 'Login Terakhir', accessorKey: 'lastLoginAt' },
  { id: 'createdAt', header: 'Daftar', accessorKey: 'createdAt' },
]
const FLAG_REVIEW_TITLE = 'Aktiviti luar biasa (kelajuan menjawab tidak munasabah) — perlu semak.'
const FLAG_EXCLUDED_TITLE = `${FLAG_REVIEW_TITLE} Dikecualikan dari peratus penglibatan.`
</script>

<template>
  <DsPage data-testid="monitoring-school-page">
    <template v-if="!blocked">
      <MonitoringCrumbs :paths="paths" :school="data?.school.name ?? ''" />

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
        <UCard data-testid="mon-school-header">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 flex-col gap-1">
              <h2 class="text-heading break-words text-highlighted" data-testid="mon-school-name">
                {{ data.school.name }}
              </h2>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted">
                <span class="flex items-center gap-1" data-testid="mon-school-code"
                  ><UIcon name="i-ph-hash" class="size-4" />{{ data.school.code ?? '-' }}</span
                >
                <span class="flex items-center gap-1" data-testid="mon-school-state"
                  ><UIcon name="i-ph-map-pin" class="size-4" />{{ data.school.state }}</span
                >
                <UBadge
                  v-if="data.subscription"
                  :color="SUBSCRIPTION_COLOR[data.subscription.status]"
                  variant="subtle"
                  icon="i-ph-circle-fill"
                  :data-status="data.subscription.status"
                  data-testid="mon-subscription"
                  :label="`${SUBSCRIPTION_LABEL[data.subscription.status]} — sehingga ${subscriptionDate(data.subscription.endsAt)}`"
                />
                <span v-else class="text-caption text-muted" data-testid="mon-subscription"
                  >Tiada langganan</span
                >
              </div>
            </div>
            <UBadge
              :color="TAHAP[data.tahap].color"
              variant="subtle"
              size="lg"
              data-testid="mon-school-tahap"
              :label="`${data.tahap} — ${pct(data.pct)}`"
            />
          </div>
        </UCard>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="mon-school-cards">
          <MonitoringStatCard label="Pelajar T4/T5" :value="count(data.cards.students)" />
          <MonitoringStatCard label="Pernah Aktif" :value="count(data.cards.engaged)" />
          <MonitoringStatCard label="Soalan Dijawab" :value="count(data.cards.answers)" />
          <MonitoringStatCard label="Guru Berdaftar" :value="count(data.cards.teachers)" />
          <MonitoringStatCard
            label="Guru Pernah Login"
            :value="count(data.cards.teachersLoggedIn)"
          />
        </section>

        <UCard data-testid="mon-students">
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 text-label text-highlighted">
                <UIcon name="i-ph-graduation-cap" class="size-5 text-primary" />Senarai Pelajar
                T4/T5
              </h2>
              <div class="flex flex-wrap gap-2" data-testid="mon-student-pills">
                <UButton
                  v-for="p in STUDENT_PILLS"
                  :key="p.key"
                  type="button"
                  size="lg"
                  :color="studentFilter === p.key ? 'primary' : 'neutral'"
                  :variant="studentFilter === p.key ? 'soft' : 'ghost'"
                  :label="p.label()"
                  :data-testid="p.testid"
                  @click="studentFilter = p.key"
                />
              </div>
            </div>

            <NativeInput
              v-model="search"
              placeholder="Cari nama pelajar..."
              aria-label="Cari nama pelajar"
              class="sm:w-64"
              data-testid="mon-student-search"
            />

            <UAlert v-if="data.warning" color="warning" variant="subtle" data-testid="mon-warning">
              <template #description>
                ⚠
                <strong>{{ data.warning.review + data.warning.excluded }} akaun</strong> menunjukkan
                aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak).
                <template v-if="data.warning.excluded > 0"
                  ><strong>{{ data.warning.excluded }}</strong> daripadanya dikecualikan dari
                  peratus penglibatan kerana corak seperti automasi.</template
                >
                Angka penglibatan di atas ialah nilai tulen selepas tapis.
              </template>
            </UAlert>

            <div data-testid="mon-student-scroller">
              <DsDrillTable :data="studentData" :columns="studentColumns" caption="Senarai pelajar">
                <template #no-cell="{ row }">
                  <span class="tabular text-caption text-muted">{{ row.index + 1 }}</span>
                </template>
                <template #name-cell="{ row }">
                  <div
                    :class="[
                      'flex min-w-48 flex-col',
                      row.original.answers === 0 ? 'text-muted' : '',
                    ]"
                    :data-faded="row.original.answers === 0 ? 'true' : 'false'"
                    data-testid="mon-student-row"
                    :data-student-id="row.original.id"
                  >
                    <RouterLink
                      v-if="row.original.answers > 0 || paths.kirkpatrickStudent(row.original.id)"
                      :to="
                        row.original.answers > 0
                          ? paths.student(schoolId, row.original.id)
                          : (paths.kirkpatrickStudent(row.original.id) ?? '')
                      "
                      :class="[
                        'text-label',
                        row.original.answers > 0 ? 'text-primary' : 'text-muted',
                      ]"
                      data-testid="mon-student-link"
                      >{{ row.original.name }}</RouterLink
                    >
                    <span v-else class="text-label text-muted" data-testid="mon-student-name">{{
                      row.original.name
                    }}</span>
                    <span class="text-caption text-muted">{{ row.original.email }}</span>
                    <UBadge
                      v-if="row.original.flag === 'review'"
                      color="warning"
                      variant="subtle"
                      size="sm"
                      class="self-start"
                      :title="FLAG_REVIEW_TITLE"
                      data-testid="mon-flag"
                      label="⚠ Perlu Semak"
                    />
                    <UBadge
                      v-else-if="row.original.flag === 'excluded'"
                      color="error"
                      variant="subtle"
                      size="sm"
                      class="self-start"
                      :title="FLAG_EXCLUDED_TITLE"
                      data-testid="mon-flag"
                      label="⚠ Perlu Semak · ditapis"
                    />
                  </div>
                </template>
                <template #answers-cell="{ row }">
                  <span class="tabular text-label">{{ count(row.original.answers) }}</span>
                </template>
                <template #status-cell="{ row }">
                  <UBadge
                    :color="statusColor(row.original.status)"
                    variant="subtle"
                    data-testid="mon-student-status"
                    :label="statusLabel(row.original.status)"
                  />
                </template>
                <template #lastLogin-cell="{ row }">
                  <span class="tabular whitespace-nowrap">{{
                    dmyHm(row.original.lastLoginAt)
                  }}</span>
                </template>
                <template #lastActivity-cell="{ row }">
                  <span class="tabular whitespace-nowrap">{{
                    dmyHm(row.original.lastActivityAt)
                  }}</span>
                </template>
              </DsDrillTable>
            </div>
          </div>
        </UCard>

        <UCard data-testid="mon-teachers">
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 text-label text-highlighted">
                <UIcon name="i-ph-chalkboard-teacher" class="size-5 text-primary" />Senarai Guru ({{
                  count(data.teachers.length)
                }})
              </h2>
              <div
                v-if="data.teachers.length > 0"
                class="flex flex-wrap gap-2"
                data-testid="mon-teacher-pills"
              >
                <UButton
                  v-for="p in TEACHER_PILLS"
                  :key="p.key"
                  type="button"
                  size="lg"
                  :color="teacherFilter === p.key ? 'primary' : 'neutral'"
                  :variant="teacherFilter === p.key ? 'soft' : 'ghost'"
                  :label="p.label"
                  :data-testid="p.testid"
                  @click="teacherFilter = p.key"
                />
              </div>
            </div>

            <p
              v-if="data.teachers.length === 0"
              class="py-4 text-center text-body text-muted"
              data-testid="mon-teachers-empty"
            >
              Tiada guru berdaftar untuk sekolah ini.
            </p>
            <div v-else data-testid="mon-teacher-scroller">
              <DsDrillTable :data="teacherData" :columns="teacherColumns" caption="Senarai guru">
                <template #no-cell="{ row }">
                  <span class="tabular text-caption text-muted">{{ row.index + 1 }}</span>
                </template>
                <template #name-cell="{ row }">
                  <div class="flex min-w-48 flex-col" data-testid="mon-teacher-row">
                    <RouterLink
                      :to="paths.teacher(schoolId, row.original.id)"
                      class="text-label text-primary"
                      data-testid="mon-teacher-link"
                      >{{ row.original.name }}</RouterLink
                    >
                    <span class="text-caption text-muted">{{ row.original.email }}</span>
                  </div>
                </template>
                <template #status-cell="{ row }">
                  <UBadge
                    :color="row.original.loggedIn ? 'success' : 'neutral'"
                    variant="subtle"
                    data-testid="mon-teacher-status"
                    :label="row.original.loggedIn ? 'Pernah login' : 'Belum login'"
                  />
                </template>
                <template #lastLogin-cell="{ row }">
                  <span class="tabular whitespace-nowrap">{{
                    dmyHm(row.original.lastLoginAt)
                  }}</span>
                </template>
                <template #createdAt-cell="{ row }">
                  <span class="tabular whitespace-nowrap">{{ dmy(row.original.createdAt) }}</span>
                </template>
              </DsDrillTable>
            </div>
          </div>
        </UCard>
      </template>
    </template>
  </DsPage>
</template>
