<script setup lang="ts">
/**
 * S1 `/guru` "Dashboard Guru" (M10-T2; FR-M10-08…13, FR-M10-129; URS FT-M10-2.1). Guide, checklist,
 * stat cards, "Tindakan Hari Ini", "Peer Tutor Matching", "Tindakan Pantas", "Kelas Saya" and
 * "Penghantaran Terkini" from `GET /api/guru/dashboard`.
 */
import { Clock, GraduationCap, IdCard, Inbox, PenTool, Plus, School, Zap } from '@lucide/vue'
import { watchEffect } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'
import { useSessionStore } from '@/stores/session'

import { fetchGuruDashboard } from '../api/guru'
import ChecklistCard from '../components/dashboard/ChecklistCard.vue'
import { DASH_COPY } from '../components/dashboard/copy'
import GuideCard from '../components/dashboard/GuideCard.vue'
import { welcomeSubtitle } from '../components/dashboard/lib'
import StatCards from '../components/dashboard/StatCards.vue'
import TodayPanel from '../components/dashboard/TodayPanel.vue'

const session = useSessionStore()
const { setHeader } = usePageMeta()
const { data, error, reload } = useApi((signal) => fetchGuruDashboard({ signal }))

watchEffect(() => {
  const name = session.user?.name
  if (name) setHeader({ title: 'Dashboard Guru', subtitle: welcomeSubtitle(name) })
})

const QUICK_ICONS = [Plus, PenTool, GraduationCap, IdCard]
const QUICK_TONES = [
  'bg-emerald-50 [&>span:first-child]:bg-emerald-500',
  'bg-emerald-50 [&>span:first-child]:bg-emerald-500',
  'bg-blue-50 [&>span:first-child]:bg-blue-500',
  'bg-purple-50 [&>span:first-child]:bg-purple-500',
]
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-5" data-testid="guru-dashboard">
    <GuideCard />

    <div
      v-if="error"
      class="min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="dashboard-error"
    >
      <AlertBox :messages="DASH_COPY.loadFailed" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
        data-testid="dashboard-retry"
        @click="reload"
      >
        {{ DASH_COPY.retry }}
      </button>
    </div>

    <div
      v-else-if="!data"
      class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
      data-testid="dashboard-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <template v-else>
      <ChecklistCard :checklist="data.checklist" />
      <StatCards :stats="data.stats" />
      <TodayPanel :today="data.today" />

      <section
        class="min-w-0 rounded-3xl bg-linear-to-br from-teal-50 to-white p-4 shadow-sm sm:p-6"
        data-testid="peer-card"
      >
        <p class="text-xs font-bold tracking-wide text-teal-700 uppercase">
          {{ DASH_COPY.peerLabel }}
        </p>
        <h2 class="font-heading text-xl font-bold text-slate-800">{{ DASH_COPY.peerTitle }}</h2>
        <p class="mt-1 text-sm text-slate-600">{{ DASH_COPY.peerText }}</p>
        <p
          class="mt-4 rounded-xl bg-white/70 px-4 py-4 text-sm text-slate-600"
          data-testid="peer-empty"
        >
          {{ DASH_COPY.peerEmpty }}
        </p>
      </section>

      <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr] lg:items-start">
        <div class="min-w-0 space-y-4">
          <section class="rounded-3xl bg-white p-4 shadow-sm sm:p-6" data-testid="quick-card">
            <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
              <Zap class="h-5 w-5 text-amber-500" />{{ DASH_COPY.quickTitle }}
            </h2>
            <div class="mt-3 space-y-3">
              <RouterLink
                v-for="(q, i) in DASH_COPY.quick"
                :key="q.to"
                :to="q.to"
                :class="['flex min-h-11 items-center gap-3 rounded-xl p-3', QUICK_TONES[i]]"
                data-testid="quick-tile"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                  ><component :is="QUICK_ICONS[i]" class="h-5 w-5"
                /></span>
                <span class="min-w-0">
                  <span class="block text-sm font-bold text-slate-800">{{ q.title }}</span>
                  <span class="block text-xs text-slate-500">{{ q.text }}</span>
                </span>
              </RouterLink>
            </div>
          </section>

          <section class="rounded-3xl bg-white p-4 shadow-sm sm:p-6" data-testid="classes-card">
            <div class="flex items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
                <School class="h-5 w-5 text-teal-600" />{{ DASH_COPY.classesTitle }}
              </h2>
              <RouterLink
                to="/guru/kelas"
                class="inline-flex min-h-11 items-center text-sm font-semibold text-teal-600"
                data-testid="classes-all"
                >{{ DASH_COPY.all }}</RouterLink
              >
            </div>
            <p
              v-if="data.classes.length === 0"
              class="py-8 text-center text-sm text-slate-400"
              data-testid="classes-empty"
            >
              {{ DASH_COPY.classesEmpty }}
            </p>
            <!-- PROPOSED layout (FN-M10-2.1.7): one line per own class. -->
            <ul v-else class="mt-3 space-y-2" data-testid="classes-list">
              <li
                v-for="c in data.classes"
                :key="c.id"
                class="min-w-0 rounded-xl bg-slate-50 px-3 py-2 text-sm break-words text-slate-700"
                data-testid="classes-item"
              >
                {{ c.name }} · {{ c.studentCount }} pelajar
              </li>
            </ul>
          </section>
        </div>

        <section
          class="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-6"
          data-testid="submissions-card"
        >
          <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
            <Clock class="h-5 w-5 text-blue-500" />{{ DASH_COPY.submissionsTitle }}
          </h2>
          <div class="py-10 text-center" data-testid="submissions-empty">
            <Inbox class="mx-auto h-10 w-10 text-slate-400" />
            <p class="mt-3 text-sm text-slate-400">{{ DASH_COPY.submissionsEmpty }}</p>
            <p class="text-xs text-slate-400">{{ DASH_COPY.submissionsHint }}</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
