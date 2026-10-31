<script setup lang="ts">
/**
 * "Sekolah" of S3 (FR-M17-41, 42, FN-M17-4.3.1-4.3.5, BR-M17-11, BR-M17-12): one clickable row per school with
 * activity in the period; a row click toggles its drill (Guru Aktif, Pelajar, Login, "Lihat penuh →"). Admin
 * only: the page does not render it for the school admin (FR-M17-116).
 */
import { DsBadge, DsEmptyState, EMPTY_VALUE, formatCount, formatPercent } from '@/ds'

import type { CcDailyActivity, CcSchoolActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { roleLabel, S3_COPY } from './board-copy'
import type { DrillState, LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{
  data: CcDailyActivity | null
  status: LoadStatus
  drill: DrillState | null
  basePath: string
}>()
defineEmits<{ toggle: [schoolId: number | string] }>()

const paths = ccPaths(props.basePath)

const hasAnswers = (s: CcSchoolActivity) => s.totalAnswers > 0
const accuracy = (s: CcSchoolActivity) =>
  s.accuracy === null ? EMPTY_VALUE : formatPercent(s.accuracy)
const toneOf = (value: number | null) =>
  value === null ? 'neutral' : value >= 70 ? 'success' : value >= 50 ? 'warning' : 'error'
const toneClass = (value: number) =>
  value >= 70 ? 'text-success' : value >= 50 ? 'text-warning' : 'text-error'
const pct1 = formatPercent
</script>

<template>
  <DailyPanel title="Sekolah" icon="i-ph-buildings" testid="cc-panel-schools" :state="status">
    <DsEmptyState
      v-if="!data || !data.schools || data.schools.length === 0"
      size="sm"
      :title="S3_COPY.noSchools"
      data-testid="cc-schools-empty"
    />
    <ul v-else class="flex flex-col gap-2">
      <li v-for="(s, i) in data.schools" :key="s.schoolId" data-testid="cc-school-item">
        <UButton
          color="neutral"
          :variant="hasAnswers(s) ? 'soft' : 'ghost'"
          block
          :trailing-icon="
            drill && drill.schoolId === s.schoolId ? 'i-ph-caret-up' : 'i-ph-caret-down'
          "
          class="h-auto min-h-14 flex-nowrap justify-between gap-3 py-2 text-start"
          :aria-expanded="drill !== null && drill.schoolId === s.schoolId"
          :data-school-id="s.schoolId"
          data-testid="cc-school-row"
          @click="$emit('toggle', s.schoolId)"
        >
          <span class="flex min-w-0 flex-1 flex-col text-start">
            <span
              class="min-w-0 text-label break-words text-highlighted"
              data-testid="cc-school-name"
              :title="s.schoolName"
              >{{ i + 1 }}. {{ shortSchool(s.schoolName) }}</span
            >
            <span class="tabular min-w-0 text-caption text-muted"
              ><span data-testid="cc-school-teachers">{{
                hasAnswers(s)
                  ? `${formatCount(s.activeTeachers)} guru`
                  : `${formatCount(s.loginCount)} login`
              }}</span>
              ·
              <span data-testid="cc-school-pupils"
                >{{ formatCount(s.activeStudents) }} pelajar</span
              >
              ·
              <span data-testid="cc-school-answers"
                >{{ formatCount(s.totalAnswers) }} soalan</span
              ></span
            >
          </span>
          <DsBadge
            :tone="toneOf(s.accuracy)"
            :label="accuracy(s)"
            data-testid="cc-school-accuracy"
          />
        </UButton>

        <div
          v-if="drill && drill.schoolId === s.schoolId"
          class="mt-2 bg-soft p-3"
          data-testid="cc-drill"
        >
          <p v-if="drill.status === 'loading'" class="flex justify-center py-3 text-muted">
            <UProgress class="w-24" aria-label="Memuatkan" />
          </p>
          <p
            v-else-if="drill.status === 'error' || !drill.data"
            class="py-3 text-center text-body text-error"
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
              class="py-3 text-center text-body text-muted"
              data-testid="cc-drill-empty"
            >
              {{ S3_COPY.noDrill }}
            </p>
            <div v-else class="flex flex-col gap-4">
              <section v-if="drill.data.teachers.length > 0" data-testid="cc-drill-teachers">
                <h3 class="mb-1 text-overline text-muted">
                  Guru Aktif ({{ drill.data.teachers.length }})
                </h3>
                <ul class="max-h-64 overflow-y-auto">
                  <li
                    v-for="t in drill.data.teachers"
                    :key="t.userId"
                    class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-body"
                    data-testid="cc-drill-teacher"
                  >
                    <UButton
                      :to="paths.teacher(s.schoolId, t.userId)"
                      variant="link"
                      color="neutral"
                      class="h-auto min-w-0 flex-1 justify-start p-0 text-start"
                      :label="t.name"
                    />
                    <span class="tabular text-highlighted">{{ t.students }} pelajar</span>
                    <span :class="['tabular', toneClass(t.accuracy)]">{{ pct1(t.accuracy) }}</span>
                    <span class="basis-full text-caption text-muted">{{ t.lastActiveHuman }}</span>
                  </li>
                </ul>
              </section>
              <section v-if="drill.data.students.length > 0" data-testid="cc-drill-students">
                <h3 class="mb-1 text-overline text-muted">
                  Pelajar ({{ drill.data.students.length }})
                </h3>
                <ul class="max-h-64 overflow-y-auto">
                  <li
                    v-for="p in drill.data.students"
                    :key="p.userId"
                    class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-body"
                    data-testid="cc-drill-student"
                  >
                    <UButton
                      :to="paths.student(p.userId)"
                      variant="link"
                      color="neutral"
                      class="h-auto min-w-0 flex-1 justify-start p-0 text-start"
                      :label="p.name"
                    />
                    <span class="tabular text-highlighted"
                      >{{ formatCount(p.answers) }} soalan</span
                    >
                    <span :class="['tabular', toneClass(p.accuracy)]">{{ pct1(p.accuracy) }}</span>
                    <span class="basis-full text-caption text-muted">{{ p.lastActiveHuman }}</span>
                  </li>
                </ul>
              </section>
              <section v-if="drill.data.logins.length > 0" data-testid="cc-drill-logins">
                <h3 class="mb-1 text-overline text-muted">
                  Login ({{ drill.data.logins.length }})
                </h3>
                <ul class="max-h-64 overflow-y-auto">
                  <li
                    v-for="l in drill.data.logins"
                    :key="l.userId"
                    class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-body"
                    data-testid="cc-drill-login"
                  >
                    <span class="min-w-0 flex-1 text-label break-words text-highlighted">{{
                      l.name
                    }}</span>
                    <DsBadge tone="primary" size="sm" :label="roleLabel(l.role)" />
                    <span class="text-caption text-muted">{{ l.timeAgo }}</span>
                  </li>
                </ul>
              </section>
            </div>
            <UButton
              :to="paths.school(s.schoolId)"
              variant="link"
              color="primary"
              class="mt-2"
              :label="S3_COPY.seeAll"
              data-testid="cc-drill-full"
            />
          </template>
        </div>
      </li>
    </ul>
  </DailyPanel>
</template>
