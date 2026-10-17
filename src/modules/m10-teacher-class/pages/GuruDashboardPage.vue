<script setup lang="ts">
/**
 * S1 `/guru` "Dashboard Guru" (M10-T2; FR-M10-08…13, FR-M10-129; URS FT-M10-2.1). Guide, checklist,
 * stat cards, "Tindakan Hari Ini", "Peer Tutor Matching", "Tindakan Pantas", "Kelas Saya" and
 * "Penghantaran Terkini" from `GET /api/guru/dashboard`.
 */
import { watchEffect } from 'vue'

import { useApi, usePageMeta, usePrototypeScope } from '@/composables'
import { DsIconChip, DsPage } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { fetchGuruDashboard } from '../api/guru'
import ChecklistCard from '../components/dashboard/ChecklistCard.vue'
import { DASH_COPY } from '../components/dashboard/copy'
import GuideCard from '../components/dashboard/GuideCard.vue'
import { welcomeSubtitle } from '../components/dashboard/lib'
import StatCards from '../components/dashboard/StatCards.vue'
import TodayPanel from '../components/dashboard/TodayPanel.vue'

const session = useSessionStore()
const { allows } = usePrototypeScope()
const { setHeader } = usePageMeta()
const { data, error, reload } = useApi((signal) => fetchGuruDashboard({ signal }))

watchEffect(() => {
  const name = session.user?.name
  if (name) setHeader({ title: 'Dashboard Guru', subtitle: welcomeSubtitle(name) })
})

const QUICK_ICONS = [
  'i-ph-plus-circle-duotone',
  'i-ph-pen-nib-duotone',
  'i-ph-graduation-cap-duotone',
  'i-ph-identification-card-duotone',
]
</script>

<template>
  <DsPage data-testid="guru-dashboard">
    <GuideCard />

    <UCard v-if="error" data-testid="dashboard-error">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="DASH_COPY.loadFailed"
        role="alert"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        class="mt-3"
        data-testid="dashboard-retry"
        @click="reload"
      >
        {{ DASH_COPY.retry }}
      </UButton>
    </UCard>

    <div
      v-else-if="!data"
      class="grid grid-cols-2 gap-3 lg:grid-cols-4"
      aria-busy="true"
      data-testid="dashboard-loading"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-28 w-full" />
    </div>

    <template v-else>
      <StatCards :stats="data.stats" />
      <div class="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
        <div class="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <TodayPanel :today="data.today" />

          <UCard data-testid="peer-card">
            <p class="text-overline text-muted">{{ DASH_COPY.peerLabel }}</p>
            <h2 class="text-subheading text-highlighted">{{ DASH_COPY.peerTitle }}</h2>
            <p class="mt-1 text-body text-muted">{{ DASH_COPY.peerText }}</p>
            <p class="mt-4 text-body text-muted" data-testid="peer-empty">
              {{ DASH_COPY.peerEmpty }}
            </p>
          </UCard>

          <UCard data-testid="submissions-card">
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-clock-duotone" class="size-5 text-primary" />{{
                DASH_COPY.submissionsTitle
              }}
            </h2>
            <div
              class="flex flex-col items-center gap-2 py-8 text-center"
              data-testid="submissions-empty"
            >
              <UIcon name="i-ph-tray-duotone" class="size-10 text-dimmed" />
              <p class="text-body text-muted">{{ DASH_COPY.submissionsEmpty }}</p>
              <p class="text-caption text-muted">{{ DASH_COPY.submissionsHint }}</p>
            </div>
          </UCard>
        </div>

        <div class="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <ChecklistCard :checklist="data.checklist" />

          <UCard data-testid="quick-card">
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-lightning-duotone" class="size-5 text-primary" />{{
                DASH_COPY.quickTitle
              }}
            </h2>
            <div class="mt-3 flex flex-col gap-2">
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
                  <DsIconChip :icon="QUICK_ICONS[i]!" />
                  <span class="min-w-0">
                    <span class="block text-label text-highlighted">{{ q.title }}</span>
                    <span class="block text-caption text-muted">{{ q.text }}</span>
                  </span>
                </UButton>
              </template>
            </div>
          </UCard>

          <UCard data-testid="classes-card">
            <div class="flex items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-chalkboard-teacher-duotone" class="size-5 text-primary" />{{
                  DASH_COPY.classesTitle
                }}
              </h2>
              <UButton to="/guru/kelas" variant="link" size="sm" data-testid="classes-all">{{
                DASH_COPY.all
              }}</UButton>
            </div>
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
          </UCard>
        </div>
      </div>
    </template>
  </DsPage>
</template>
