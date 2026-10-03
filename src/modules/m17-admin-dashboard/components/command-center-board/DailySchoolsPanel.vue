<script setup lang="ts">
/**
 * "Sekolah" of S3 (FR-M17-41, 42, FN-M17-4.3.1-4.3.5, BR-M17-11, BR-M17-12): one clickable row per school with
 * activity in the period; a row click toggles its drill (Guru Aktif, Pelajar, Login, "Lihat penuh →"). Admin
 * only: the page does not render it for the school admin (FR-M17-116).
 */
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { formatCount, formatNumber } from '@/lib/number'

import type { CcDailyActivity, CcSchoolActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { S3_COPY } from './board-copy'
import type { DrillState, LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{
  data: CcDailyActivity | null
  status: LoadStatus
  drill: DrillState | null
  basePath: string
}>()
defineEmits<{ toggle: [schoolId: number] }>()

const paths = ccPaths(props.basePath)

const hasAnswers = (s: CcSchoolActivity) => s.totalAnswers > 0
const accuracy = (s: CcSchoolActivity) =>
  s.accuracy === null ? '-%' : `${formatNumber(s.accuracy, { decimals: 1 })}%`
const toneOf = (value: number | null) =>
  value !== null && value >= 70
    ? 'text-emerald-400'
    : value !== null && value >= 50
      ? 'text-amber-400'
      : 'text-rose-400'
const pct1 = (n: number) => `${formatNumber(n, { decimals: 1 })}%`
const ROLE_CHIP = 'rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold uppercase'
</script>

<template>
  <DailyPanel
    title="Sekolah"
    dot="bg-emerald-500"
    testid="cc-panel-schools"
    :state="status"
    class="md:col-span-2 xl:col-span-1"
  >
    <p
      v-if="!data || !data.schools || data.schools.length === 0"
      class="py-4 text-center text-sm text-slate-400"
      data-testid="cc-schools-empty"
    >
      {{ S3_COPY.noSchools }}
    </p>
    <ul v-else class="divide-y divide-slate-800">
      <li v-for="(s, i) in data.schools" :key="s.schoolId" data-testid="cc-school-item">
        <div
          :class="[
            'flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 py-2 transition hover:bg-slate-800/60',
            hasAnswers(s) ? '' : 'opacity-50',
          ]"
          :data-school-id="s.schoolId"
          data-testid="cc-school-row"
          @click="$emit('toggle', s.schoolId)"
        >
          <span
            class="min-w-0 basis-full text-sm font-bold break-words text-slate-50 sm:flex-1 sm:basis-0"
            data-testid="cc-school-name"
            >{{ i + 1 }}. {{ s.schoolName }}</span
          >
          <span class="flex shrink-0 items-center gap-4 text-center font-mono">
            <span data-testid="cc-school-teachers">
              <b class="block text-sm text-cyan-400">{{
                hasAnswers(s) ? formatCount(s.activeTeachers) : formatCount(s.loginCount)
              }}</b>
              <span class="block text-xs text-slate-400">{{
                hasAnswers(s) ? 'GURU' : 'LOGIN'
              }}</span>
            </span>
            <span data-testid="cc-school-pupils">
              <b class="block text-sm text-amber-400">{{ formatCount(s.activeStudents) }}</b>
              <span class="block text-xs text-slate-400">PELAJAR</span>
            </span>
            <span data-testid="cc-school-answers">
              <b class="block text-sm text-indigo-300">{{ formatCount(s.totalAnswers) }}</b>
              <span class="block text-xs text-slate-400">SOALAN</span>
            </span>
            <span
              :class="['w-16 text-sm font-bold', toneOf(s.accuracy)]"
              data-testid="cc-school-accuracy"
              >{{ accuracy(s) }}</span
            >
          </span>
        </div>

        <div
          v-if="drill && drill.schoolId === s.schoolId"
          class="mb-2 rounded-xl bg-slate-950 p-3"
          data-testid="cc-drill"
        >
          <p v-if="drill.status === 'loading'" class="flex justify-center py-3 text-slate-400">
            <LoadingSpinner class="h-5 w-5" />
          </p>
          <p
            v-else-if="drill.status === 'error' || !drill.data"
            class="py-3 text-center text-sm text-rose-400"
            data-testid="cc-drill-error"
          >
            {{ S3_COPY.drillFailed }}
          </p>
          <template v-else>
            <p
              v-if="
                drill.data.teachers.length === 0 &&
                drill.data.students.length === 0 &&
                drill.data.logins.length === 0
              "
              class="py-3 text-center text-sm text-slate-400"
              data-testid="cc-drill-empty"
            >
              {{ S3_COPY.noDrill }}
            </p>
            <div v-else class="space-y-3">
              <section v-if="drill.data.teachers.length > 0" data-testid="cc-drill-teachers">
                <h3 class="mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <span>👨‍🏫 </span>Guru Aktif ({{ drill.data.teachers.length }})
                </h3>
                <ul class="max-h-64 overflow-y-auto">
                  <li
                    v-for="t in drill.data.teachers"
                    :key="t.userId"
                    class="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 text-sm"
                    data-testid="cc-drill-teacher"
                  >
                    <RouterLink
                      :to="paths.teacher(s.schoolId, t.userId)"
                      class="min-w-0 font-semibold break-words text-slate-100 hover:text-indigo-300"
                      >{{ t.name }}</RouterLink
                    >
                    <span class="font-mono text-slate-100">{{ t.students }} pelajar</span>
                    <span :class="['font-mono', toneOf(t.accuracy)]">{{ pct1(t.accuracy) }}</span>
                    <span class="col-span-3 text-xs text-slate-400">{{ t.lastActiveHuman }}</span>
                  </li>
                </ul>
              </section>
              <section v-if="drill.data.students.length > 0" data-testid="cc-drill-students">
                <h3 class="mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <span>🎓 </span>Pelajar ({{ drill.data.students.length }})
                </h3>
                <ul class="max-h-64 overflow-y-auto">
                  <li
                    v-for="p in drill.data.students"
                    :key="p.userId"
                    class="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 text-sm"
                    data-testid="cc-drill-student"
                  >
                    <RouterLink
                      :to="paths.student(p.userId)"
                      class="min-w-0 font-semibold break-words text-slate-100 hover:text-indigo-300"
                      >{{ p.name }}</RouterLink
                    >
                    <span class="font-mono text-slate-100"
                      >{{ formatCount(p.answers) }} soalan</span
                    >
                    <span :class="['font-mono', toneOf(p.accuracy)]">{{ pct1(p.accuracy) }}</span>
                    <span class="col-span-3 text-xs text-slate-400">{{ p.lastActiveHuman }}</span>
                  </li>
                </ul>
              </section>
              <section v-if="drill.data.logins.length > 0" data-testid="cc-drill-logins">
                <h3 class="mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <span>👤 </span>Login ({{ drill.data.logins.length }})
                </h3>
                <ul class="max-h-64 overflow-y-auto">
                  <li
                    v-for="l in drill.data.logins"
                    :key="l.userId"
                    class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
                    data-testid="cc-drill-login"
                  >
                    <span class="min-w-0 flex-1 font-semibold break-words text-slate-100">{{
                      l.name
                    }}</span>
                    <span :class="[ROLE_CHIP, 'text-indigo-300']">{{ l.role }}</span>
                    <span class="text-xs text-slate-400">{{ l.timeAgo }}</span>
                  </li>
                </ul>
              </section>
            </div>
            <RouterLink
              :to="paths.school(s.schoolId)"
              class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-300 hover:text-indigo-200"
              data-testid="cc-drill-full"
              >{{ S3_COPY.seeAll }}</RouterLink
            >
          </template>
        </div>
      </li>
    </ul>
  </DailyPanel>
</template>
