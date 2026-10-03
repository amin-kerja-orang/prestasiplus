<script setup lang="ts">
/**
 * S3 Detail Sekolah (FR-M11-53..61; URS FT-M11-4.1). Header card, five cards, the pupil list with
 * client-side pills and search (rows are filtered by their data values, never by interpolated names:
 * DV-M11-18) and the teacher list. The route prefix is a prop (see `MonitoringPage.vue`).
 */
import { Circle, GraduationCap, Hash, MapPin, Presentation } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { fetchSchoolDetail } from '../api'
import MonitoringCrumbs from '../components/monitoring/MonitoringCrumbs.vue'
import MonitoringStatCard from '../components/monitoring/MonitoringStatCard.vue'
import {
  CARD,
  LOAD_ERROR_COPY,
  STAT_TONE,
  STATUS_LABEL,
  STATUS_PILL,
  TAHAP,
  count,
  dmy,
  dmyHm,
  pct,
  subscriptionDate,
} from '../components/monitoring/monitoring-format'
import { MONITORING_BASE, monitoringPaths } from '../components/monitoring/monitoring-paths'
import { useMonitoringPage } from '../components/monitoring/use-monitoring-page'

const props = withDefaults(defineProps<{ schoolId: number; basePath?: string }>(), {
  basePath: MONITORING_BASE,
})
const paths = computed(() => monitoringPaths(props.basePath))

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

const SUBSCRIPTION_PILL = {
  active: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
  expired: 'bg-slate-100 text-slate-500',
} as const
const SUBSCRIPTION_LABEL = { active: 'Active', cancelled: 'Cancelled', expired: 'Expired' } as const

const PILL = 'min-h-11 whitespace-nowrap rounded-full px-3 text-xs font-semibold lg:min-h-9'
const pillClass = (on: boolean, onCls: string, offCls: string) => [PILL, on ? onCls : offCls]
const TH = 'px-3 py-2 text-left text-xs font-bold uppercase text-slate-500'
const FLAG_REVIEW_TITLE = 'Aktiviti luar biasa (kelajuan menjawab tidak munasabah) — perlu semak.'
const FLAG_EXCLUDED_TITLE = `${FLAG_REVIEW_TITLE} Dikecualikan dari peratus penglibatan.`
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="monitoring-school-page">
    <template v-if="!blocked">
      <MonitoringCrumbs :paths="paths" :school="data?.school.name ?? ''" />

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
          data-testid="mon-school-header"
        >
          <div class="min-w-0">
            <h2
              class="font-heading text-xl font-bold break-words text-slate-800"
              data-testid="mon-school-name"
            >
              {{ data.school.name }}
            </h2>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span class="flex items-center gap-1" data-testid="mon-school-code"
                ><Hash class="h-4 w-4" />{{ data.school.code ?? '-' }}</span
              >
              <span class="flex items-center gap-1" data-testid="mon-school-state"
                ><MapPin class="h-4 w-4" />{{ data.school.state }}</span
              >
              <span
                v-if="data.subscription"
                :class="[
                  'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  SUBSCRIPTION_PILL[data.subscription.status],
                ]"
                data-testid="mon-subscription"
              >
                <Circle class="h-2 w-2 fill-current" />{{
                  SUBSCRIPTION_LABEL[data.subscription.status]
                }}
                — sehingga {{ subscriptionDate(data.subscription.endsAt) }}
              </span>
              <span v-else class="text-xs text-slate-400" data-testid="mon-subscription"
                >Tiada langganan</span
              >
            </div>
          </div>
          <span
            :class="['rounded-full px-4 py-2 text-sm font-bold text-white', TAHAP[data.tahap].pill]"
            data-testid="mon-school-tahap"
            >{{ data.tahap }} — {{ pct(data.pct) }}</span
          >
        </section>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="mon-school-cards">
          <MonitoringStatCard
            label="Pelajar T4/T5"
            :value="count(data.cards.students)"
            :tone="STAT_TONE.blue"
          />
          <MonitoringStatCard
            label="Pernah Aktif"
            :value="count(data.cards.engaged)"
            :tone="STAT_TONE.green"
          />
          <MonitoringStatCard
            label="Soalan Dijawab"
            :value="count(data.cards.answers)"
            :tone="STAT_TONE.purple"
          />
          <MonitoringStatCard
            label="Guru Berdaftar"
            :value="count(data.cards.teachers)"
            :tone="STAT_TONE.amber"
          />
          <MonitoringStatCard
            label="Guru Pernah Login"
            :value="count(data.cards.teachersLoggedIn)"
            :tone="STAT_TONE.rose"
          />
        </section>

        <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-students">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
              <GraduationCap class="h-5 w-5 text-indigo-600" />Senarai Pelajar T4/T5
            </h3>
            <div class="flex flex-wrap gap-2" data-testid="mon-student-pills">
              <button
                type="button"
                :class="
                  pillClass(
                    studentFilter === 'all',
                    'bg-indigo-600 text-white',
                    'bg-slate-100 text-slate-600',
                  )
                "
                data-testid="mon-pill-all"
                @click="studentFilter = 'all'"
              >
                Semua ({{ count(data.students.length) }})
              </button>
              <button
                type="button"
                :class="
                  pillClass(
                    studentFilter === 'active',
                    'bg-green-600 text-white',
                    'bg-green-100 text-green-700',
                  )
                "
                data-testid="mon-pill-active"
                @click="studentFilter = 'active'"
              >
                ● Aktif ({{ count(data.cards.engaged) }})
              </button>
              <button
                type="button"
                :class="
                  pillClass(
                    studentFilter === 'login',
                    'bg-amber-600 text-white',
                    'bg-amber-100 text-amber-700',
                  )
                "
                data-testid="mon-pill-login"
                @click="studentFilter = 'login'"
              >
                Login sahaja
              </button>
              <button
                type="button"
                :class="
                  pillClass(
                    studentFilter === 'never',
                    'bg-red-600 text-white',
                    'bg-slate-100 text-slate-500',
                  )
                "
                data-testid="mon-pill-never"
                @click="studentFilter = 'never'"
              >
                Belum login
              </button>
            </div>
          </div>

          <input
            v-model="search"
            type="text"
            placeholder="Cari nama pelajar..."
            class="mb-3 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm sm:w-64 lg:min-h-9"
            data-testid="mon-student-search"
          />

          <p
            v-if="data.warning"
            class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            data-testid="mon-warning"
          >
            ⚠ <strong>{{ data.warning.review + data.warning.excluded }} akaun</strong> menunjukkan
            aktiviti luar biasa (kelajuan menjawab tidak munasabah — perlu semak).
            <template v-if="data.warning.excluded > 0"
              ><strong>{{ data.warning.excluded }}</strong> daripadanya dikecualikan dari peratus
              penglibatan kerana corak seperti automasi.</template
            >
            Angka penglibatan di atas ialah nilai tulen selepas tapis.
          </p>

          <div class="overflow-x-auto" data-testid="mon-student-scroller">
            <table class="w-full min-w-[720px] text-sm">
              <thead>
                <tr class="border-b border-slate-100">
                  <th :class="TH">#</th>
                  <th :class="TH">Nama</th>
                  <th :class="TH">Tingkatan</th>
                  <th :class="TH">Soalan</th>
                  <th :class="TH">Status</th>
                  <th :class="TH">Login Terakhir</th>
                  <th :class="TH">Aktiviti Terakhir</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(s, i) in students"
                  :key="s.id"
                  :class="['border-b border-slate-50', s.answers === 0 ? 'opacity-60' : '']"
                  data-testid="mon-student-row"
                  :data-student-id="s.id"
                >
                  <td class="px-3 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-3 py-2">
                    <RouterLink
                      v-if="s.answers > 0 || paths.kirkpatrickStudent(s.id)"
                      :to="
                        s.answers > 0
                          ? paths.student(schoolId, s.id)
                          : (paths.kirkpatrickStudent(s.id) ?? '')
                      "
                      :class="[
                        'font-semibold hover:underline',
                        s.answers > 0 ? 'text-indigo-600' : 'text-slate-500',
                      ]"
                      data-testid="mon-student-link"
                      >{{ s.name }}</RouterLink
                    >
                    <span
                      v-else
                      class="font-semibold text-slate-500"
                      data-testid="mon-student-name"
                      >{{ s.name }}</span
                    >
                    <p class="text-xs text-slate-400">{{ s.email }}</p>
                    <span
                      v-if="s.flag === 'review'"
                      class="mt-0.5 inline-block rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-700"
                      :title="FLAG_REVIEW_TITLE"
                      data-testid="mon-flag"
                      >⚠ Perlu Semak</span
                    >
                    <span
                      v-else-if="s.flag === 'excluded'"
                      class="mt-0.5 inline-block rounded bg-rose-100 px-1.5 text-xs font-semibold text-rose-700"
                      :title="FLAG_EXCLUDED_TITLE"
                      data-testid="mon-flag"
                      >⚠ Perlu Semak · ditapis</span
                    >
                  </td>
                  <td class="px-3 py-2 text-slate-600">{{ s.level }}</td>
                  <td
                    :class="[
                      'px-3 py-2 font-semibold',
                      s.answers > 0 ? 'text-indigo-600' : 'text-slate-300',
                    ]"
                  >
                    {{ count(s.answers) }}
                  </td>
                  <td class="px-3 py-2">
                    <span
                      :class="[
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_PILL[s.status],
                      ]"
                      data-testid="mon-student-status"
                      >{{ STATUS_LABEL[s.status] }}</span
                    >
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap text-slate-500">
                    {{ dmyHm(s.lastLoginAt) }}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap text-slate-500">
                    {{ dmyHm(s.lastActivityAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-teachers">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
              <Presentation class="h-5 w-5 text-amber-500" />Senarai Guru ({{
                count(data.teachers.length)
              }})
            </h3>
            <div
              v-if="data.teachers.length > 0"
              class="flex flex-wrap gap-2"
              data-testid="mon-teacher-pills"
            >
              <button
                type="button"
                :class="
                  pillClass(
                    teacherFilter === 'all',
                    'bg-indigo-600 text-white',
                    'bg-slate-100 text-slate-600',
                  )
                "
                data-testid="mon-tpill-all"
                @click="teacherFilter = 'all'"
              >
                Semua
              </button>
              <button
                type="button"
                :class="
                  pillClass(
                    teacherFilter === 'login',
                    'bg-green-600 text-white',
                    'bg-green-100 text-green-700',
                  )
                "
                data-testid="mon-tpill-login"
                @click="teacherFilter = 'login'"
              >
                Pernah Login
              </button>
              <button
                type="button"
                :class="
                  pillClass(
                    teacherFilter === 'never',
                    'bg-red-600 text-white',
                    'bg-slate-100 text-slate-500',
                  )
                "
                data-testid="mon-tpill-never"
                @click="teacherFilter = 'never'"
              >
                Belum Login
              </button>
            </div>
          </div>

          <p
            v-if="data.teachers.length === 0"
            class="py-4 text-center text-sm text-slate-400"
            data-testid="mon-teachers-empty"
          >
            Tiada guru berdaftar untuk sekolah ini.
          </p>
          <div v-else class="overflow-x-auto" data-testid="mon-teacher-scroller">
            <table class="w-full min-w-[640px] text-sm">
              <thead>
                <tr class="border-b border-slate-100">
                  <th :class="TH">#</th>
                  <th :class="TH">Nama</th>
                  <th :class="TH">Status</th>
                  <th :class="TH">Login Terakhir</th>
                  <th :class="TH">Daftar</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(t, i) in teachers"
                  :key="t.id"
                  class="border-b border-slate-50"
                  data-testid="mon-teacher-row"
                >
                  <td class="px-3 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-3 py-2">
                    <RouterLink
                      :to="paths.teacher(schoolId, t.id)"
                      class="font-semibold text-indigo-600 hover:underline"
                      data-testid="mon-teacher-link"
                      >{{ t.name }}</RouterLink
                    >
                    <p class="text-xs text-slate-400">{{ t.email }}</p>
                  </td>
                  <td class="px-3 py-2">
                    <span
                      :class="[
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        t.loggedIn ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                      ]"
                      data-testid="mon-teacher-status"
                      >{{ t.loggedIn ? 'Pernah login' : 'Belum login' }}</span
                    >
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap text-slate-500">
                    {{ dmyHm(t.lastLoginAt) }}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap text-slate-500">{{ dmy(t.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
