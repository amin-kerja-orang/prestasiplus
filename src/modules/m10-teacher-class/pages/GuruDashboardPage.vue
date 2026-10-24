<script setup lang="ts">
/**
 * S1 `/guru` "Dashboard Guru" (M10-T2; FR-M10-08…13, FR-M10-129; URS FT-M10-2.1). Guide, checklist,
 * stat cards, "Tindakan Hari Ini", "Padanan Rakan Pembimbing", "Tindakan Pantas", "Kelas Saya" and
 * "Penghantaran Terkini" from `GET /api/guru/dashboard`.
 */
import { computed, watchEffect } from 'vue'

import { useApi, usePageMeta, usePrototypeScope } from '@/composables'
import {
  DsEmptyState,
  DsIconChip,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatRow,
  type DsAccent,
  type StatItem,
} from '@/ds'
import { useSessionStore } from '@/stores/session'

import { fetchGuruDashboard } from '../api/guru'
import ChecklistCard from '../components/dashboard/ChecklistCard.vue'
import { DASH_COPY } from '../components/dashboard/copy'
import GuideCard from '../components/dashboard/GuideCard.vue'
import { welcomeSubtitle } from '../components/dashboard/lib'
import TodayPanel from '../components/dashboard/TodayPanel.vue'

const session = useSessionStore()
const { allows } = usePrototypeScope()
const { setHeader } = usePageMeta()
const { data, error, reload } = useApi((signal) => fetchGuruDashboard({ signal }))

watchEffect(() => {
  const name = session.user?.name
  if (name) setHeader({ title: 'Dashboard Guru', subtitle: welcomeSubtitle(name) })
})

/** FN-M10-2.1.3: four stat tiles, each with its own categorical accent (FR-M10-10, BR-M10-06). */
const stats = computed<StatItem[]>(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    {
      key: 'classes',
      label: DASH_COPY.statActiveClasses,
      value: s.activeClasses,
      sub: `${String(s.totalClasses)} jumlah kelas`,
      icon: 'chalkboard-teacher',
      accent: 'action',
    },
    {
      key: 'students',
      label: DASH_COPY.statStudents,
      value: s.students,
      sub: DASH_COPY.statStudentsCaption,
      icon: 'student',
      accent: 'win',
    },
    {
      key: 'questions',
      label: DASH_COPY.statQuestions,
      value: s.questions,
      sub: `✅ ${String(s.questionsApproved)} diluluskan`,
      icon: 'clipboard-text',
      accent: 'heat',
    },
    {
      key: 'assignments',
      label: DASH_COPY.statAssignments,
      value: s.assignments,
      sub: DASH_COPY.statAssignmentsCaption,
      icon: 'chart-bar',
      accent: 'trial',
    },
  ]
})

const QUICK_ICONS = ['plus-circle', 'pen-nib', 'graduation-cap', 'identification-card']
const QUICK_ACCENTS: DsAccent[] = ['action', 'win', 'heat', 'friend']
</script>

<template>
  <DsPage data-testid="guru-dashboard">
    <GuideCard />

    <DsLoadError
      v-if="error"
      :message="DASH_COPY.loadFailed"
      :retry-label="DASH_COPY.retry"
      testid="dashboard-error"
      @retry="reload"
    />

    <div
      v-else-if="!data"
      class="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-busy="true"
      data-testid="dashboard-loading"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-28 w-full" />
    </div>

    <template v-else>
      <DsStatRow :items="stats" prefix="stat" part-prefix="stat" data-testid="stat-cards" :cols="4" />
      <div class="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
        <div class="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <TodayPanel :today="data.today" />

          <DsPanel data-testid="peer-card">
            <p class="text-overline text-muted">{{ DASH_COPY.peerLabel }}</p>
            <h2 class="text-subheading text-highlighted">{{ DASH_COPY.peerTitle }}</h2>
            <p class="mt-1 text-body text-muted">{{ DASH_COPY.peerText }}</p>
            <p class="mt-4 text-body text-muted" data-testid="peer-empty">
              {{ DASH_COPY.peerEmpty }}
            </p>
          </DsPanel>

          <DsPanel
            :title="DASH_COPY.submissionsTitle"
            icon="clock"
            accent="heat"
            data-testid="submissions-card"
          >
            <DsEmptyState
              :title="DASH_COPY.submissionsEmpty"
              :description="DASH_COPY.submissionsHint"
              icon="tray"
              data-testid="submissions-empty"
            />
          </DsPanel>
        </div>

        <div class="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <ChecklistCard :checklist="data.checklist" />

          <DsPanel
            :title="DASH_COPY.quickTitle"
            icon="lightning"
            accent="win"
            data-testid="quick-card"
          >
            <div class="flex flex-col gap-2">
              <template v-for="(q, i) in DASH_COPY.quick" :key="q.to">
                <!-- Prototype scope (D43): tiles that lead outside the matrix are not shown. -->
                <UButton
                  v-if="allows(q.to)"
                  :to="q.to"
                  color="neutral"
                  variant="soft"
                  block
                  class="h-auto min-h-11 justify-start p-3"
                  data-testid="quick-tile"
                >
                  <DsIconChip :icon="QUICK_ICONS[i]!" :accent="QUICK_ACCENTS[i]" />
                  <span class="min-w-0">
                    <span class="block text-label text-highlighted">{{ q.title }}</span>
                    <span class="block text-caption text-muted">{{ q.text }}</span>
                  </span>
                </UButton>
              </template>
            </div>
          </DsPanel>

          <DsPanel
            :title="DASH_COPY.classesTitle"
            icon="chalkboard-teacher"
            accent="action"
            data-testid="classes-card"
          >
            <template #actions>
              <UButton to="/guru/kelas" variant="link" size="sm" data-testid="classes-all">{{
                DASH_COPY.all
              }}</UButton>
            </template>
            <p
              v-if="data.classes.length === 0"
              class="py-8 text-center text-body text-muted"
              data-testid="classes-empty"
            >
              {{ DASH_COPY.classesEmpty }}
            </p>
            <!-- PROPOSED layout (FN-M10-2.1.7): one line per own class. -->
            <ul v-else class="mt-3 flex flex-col gap-2" data-testid="classes-list">
              <li v-for="c in data.classes" :key="c.id" class="min-w-0" data-testid="classes-item">
                {{ c.name }} · {{ c.studentCount }} pelajar
              </li>
            </ul>
          </DsPanel>
        </div>
      </div>
    </template>
  </DsPage>
</template>
