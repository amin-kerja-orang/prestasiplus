<script setup lang="ts">
/**
 * "Sekolah" of S3 (FR-M17-41, 42, FN-M17-4.3.1-4.3.5, BR-M17-11, BR-M17-12): one clickable row per school with
 * activity in the period; a row click toggles its drill (Guru Aktif, Pelajar, Login, "Lihat penuh →"). Admin
 * only: the page does not render it for the school admin (FR-M17-116).
 */
import { formatCount, formatNumber } from '@/lib/number'

import type { CcDailyActivity, CcSchoolActivity } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { S3_COPY } from './board-copy'
import type { DrillState, LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'
import { DsStack, DsText } from '@/ds'

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
    ? 'text-success'
    : value !== null && value >= 50
      ? 'text-warning'
      : 'text-error'
const pct1 = (n: number) => `${formatNumber(n, { decimals: 1 })}%`
</script>

<template>
  <DailyPanel
    title="Sekolah"
    icon="i-ph-buildings"
    testid="cc-panel-schools"
    :state="status"
    class="md:col-span-2 xl:col-span-1"
  >
    <p
      v-if="!data || !data.schools || data.schools.length === 0"
      class="py-4 text-center text-body text-muted"
      data-testid="cc-schools-empty"
    >
      {{ S3_COPY.noSchools }}
    </p>
    <DsStack v-else as="ul" gap="xs">
      <li v-for="(s, i) in data.schools" :key="s.schoolId" data-testid="cc-school-item">
        <UButton
          color="neutral"
          :variant="hasAnswers(s) ? 'soft' : 'ghost'"
          block
          :trailing-icon="
            drill && drill.schoolId === s.schoolId ? 'i-ph-caret-up' : 'i-ph-caret-down'
          "
          class="h-auto min-h-11 flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-start"
          :aria-expanded="drill !== null && drill.schoolId === s.schoolId"
          :data-school-id="s.schoolId"
          data-testid="cc-school-row"
          @click="$emit('toggle', s.schoolId)"
        >
          <span
            class="min-w-0 basis-full text-label break-words text-highlighted"
            data-testid="cc-school-name"
            :title="s.schoolName"
            >{{ i + 1 }}. {{ shortSchool(s.schoolName) }}</span
          >
          <span class="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-center">
            <span data-testid="cc-school-teachers">
              <b class="block text-label text-highlighted">{{
                hasAnswers(s) ? formatCount(s.activeTeachers) : formatCount(s.loginCount)
              }}</b>
              <DsText variant="caption" as="span" class="block">{{
                hasAnswers(s) ? 'GURU' : 'LOGIN'
              }}</DsText>
            </span>
            <span data-testid="cc-school-pupils">
              <b class="block text-label text-highlighted">{{ formatCount(s.activeStudents) }}</b>
              <DsText variant="caption" as="span" class="block">PELAJAR</DsText>
            </span>
            <span data-testid="cc-school-answers">
              <b class="block text-label text-highlighted">{{ formatCount(s.totalAnswers) }}</b>
              <DsText variant="caption" as="span" class="block">SOALAN</DsText>
            </span>
            <span
              :class="['w-16 text-label', toneOf(s.accuracy)]"
              data-testid="cc-school-accuracy"
              >{{ accuracy(s) }}</span
            >
          </span>
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
            <DsStack v-else>
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
                    <span :class="['tabular', toneOf(t.accuracy)]">{{ pct1(t.accuracy) }}</span>
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
                    <span :class="['tabular', toneOf(p.accuracy)]">{{ pct1(p.accuracy) }}</span>
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
                    <UBadge color="primary" variant="soft" size="sm">{{ l.role }}</UBadge>
                    <DsText variant="caption" as="span">{{ l.timeAgo }}</DsText>
                  </li>
                </ul>
              </section>
            </DsStack>
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
    </DsStack>
  </DailyPanel>
</template>
