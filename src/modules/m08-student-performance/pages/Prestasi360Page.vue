<script setup lang="ts">
/**
 * S6 `/prestasi/{userId}` "Prestasi 360 — Dashboard Individu" (M08-T2; FR-M08-37…44), from
 * `GET /api/performance/students/:userId`: an unknown id is the standard 404 page, a pupil the viewer may
 * not open (§9) the 403 page. Tab title "Prestasi 360 — {nama} — PRESTASIPLUS" once the name is known.
 */
import {
  ArrowLeft,
  CircleCheck,
  CircleQuestionMark,
  ClipboardList,
  Clock,
  Flame,
  Medal,
} from '@lucide/vue'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { AppIcon } from '@/components/icon'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchStudentPerformance } from '../api/performance'
import ActivityHeatmap from '../components/prestasi360/ActivityHeatmap.vue'
import HeadcountCards from '../components/prestasi360/HeadcountCards.vue'
import MasteryCard from '../components/prestasi360/MasteryCard.vue'
import SuggestionsCard from '../components/prestasi360/SuggestionsCard.vue'
import WeakTopicsCard from '../components/prestasi360/WeakTopicsCard.vue'
import { studyTime } from '../lib/analitik'
import { grouped, pct1, plain } from '../lib/prestasi/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const userId = computed(() => Number(route.params.userId))

const { data, error, reload } = useRouteData(
  (signal) => fetchStudentPerformance(userId.value, { signal }),
  () => userId.value,
)
const loadFailed = computed(() => isLoadError(error.value))

watch(
  data,
  (d) => {
    if (d) pageMeta.setTitle(`Prestasi 360 — ${d.user.name} — PRESTASIPLUS`)
  },
  { immediate: true },
)

/** The back control is the browser history back (FR-M08-37). */
const back = (): void => {
  router.back()
}

const stats = computed(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    {
      id: 'sesi',
      label: 'Sesi Kuiz',
      value: plain(s.sessions),
      icon: ClipboardList,
      tile: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'ketepatan',
      label: 'Ketepatan',
      value: pct1(s.accuracy),
      icon: CircleCheck,
      tile: 'bg-green-100 text-green-600',
    },
    {
      id: 'soalan',
      label: 'Soalan Dijawab',
      value: plain(s.answered),
      icon: CircleQuestionMark,
      tile: 'bg-purple-100 text-purple-600',
    },
    {
      id: 'masa',
      label: 'Masa Belajar',
      value: studyTime(s.seconds),
      icon: Clock,
      tile: 'bg-amber-100 text-amber-600',
    },
  ]
})

const activity = computed(() => {
  const a = data.value?.activity
  if (!a) return []
  return [
    { id: 'kombo', label: 'Kombo Hari', value: plain(a.streakCurrent), tone: 'text-orange-500' },
    { id: 'rekod', label: 'Rekod Terbaik', value: plain(a.streakBest), tone: 'text-slate-700' },
    { id: 'koin', label: 'Koin', value: grouped(a.koinTotal), tone: 'text-amber-500' },
    { id: 'hari', label: 'Hari Latihan', value: plain(a.practiceDays), tone: 'text-indigo-500' },
  ]
})
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="prestasi360-page">
    <div v-if="loadFailed" class="space-y-3" data-testid="page-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <template v-else-if="data">
      <header
        class="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-800 to-blue-500 p-5 text-white shadow-lg"
        data-testid="hero"
      >
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
          data-testid="back"
          @click="back"
        >
          <ArrowLeft class="h-5 w-5" />
        </button>
        <span
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold sm:h-16 sm:w-16"
          data-testid="avatar"
          >{{ data.user.initial }}</span
        >
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-bold break-words text-white" data-testid="hero-name">
            {{ data.user.name }}
          </h1>
          <p class="text-sm text-white/80">Prestasi 360 — Dashboard Individu</p>
        </div>
        <div class="ml-auto hidden gap-3 lg:flex" data-testid="hero-mini">
          <div class="rounded-xl bg-white/15 px-4 py-2 text-center">
            <p class="text-2xl font-bold" data-testid="hero-accuracy">{{ data.heroAccuracy }}%</p>
            <p class="text-xs">Ketepatan</p>
          </div>
          <div class="rounded-xl bg-white/15 px-4 py-2 text-center">
            <p class="text-2xl font-bold" data-testid="hero-streak">{{ data.streak }}</p>
            <p class="text-xs">Hari Kombo</p>
          </div>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stat-cards">
        <div
          v-for="s in stats"
          :key="s.id"
          class="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4 shadow"
          :data-testid="`stat-${s.id}`"
        >
          <span :class="['flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.tile]"
            ><component :is="s.icon" class="h-5 w-5"
          /></span>
          <div class="min-w-0">
            <p
              class="text-xl font-bold break-words text-slate-800 sm:text-2xl"
              data-testid="stat-value"
            >
              {{ s.value }}
            </p>
            <p class="text-xs text-slate-500">{{ s.label }}</p>
          </div>
        </div>
      </div>

      <HeadcountCards
        v-if="data.headcount.length > 0"
        :user-id="data.user.id"
        :cards="data.headcount"
      />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <MasteryCard :mastery="data.mastery" />
        <div class="min-w-0 space-y-5">
          <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="activity-card">
            <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
              <Flame class="h-5 w-5 text-orange-500" />Aktiviti
            </h2>
            <div class="grid grid-cols-2 gap-4 text-center">
              <div v-for="a in activity" :key="a.id" :data-testid="`activity-${a.id}`">
                <p :class="['text-3xl font-bold break-words', a.tone]" data-testid="activity-value">
                  {{ a.value }}
                </p>
                <p class="text-xs text-slate-500">{{ a.label }}</p>
              </div>
            </div>
          </section>
          <section
            v-if="data.badges.length > 0"
            class="min-w-0 rounded-2xl bg-white p-5 shadow"
            data-testid="badges-card"
          >
            <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
              <Medal class="h-5 w-5 text-amber-500" />Lencana ({{ data.badges.length }})
            </h2>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="b in data.badges"
                :key="b.name"
                class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"
                :title="b.name"
                data-testid="badge"
              >
                <AppIcon :name="b.icon" class="h-5 w-5" />
              </span>
            </div>
          </section>
        </div>
      </div>

      <ActivityHeatmap :days="data.heatmap" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WeakTopicsCard :topics="data.weakTopics" />
        <SuggestionsCard :items="data.suggestions" />
      </div>
    </template>
  </div>
</template>
