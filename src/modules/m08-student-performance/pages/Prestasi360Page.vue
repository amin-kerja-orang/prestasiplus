<script setup lang="ts">
/**
 * S6 `/prestasi/{userId}` "Prestasi 360 — Dashboard Individu" (M08-T2; FR-M08-37…44), from
 * `GET /api/performance/students/:userId`: an unknown id is the standard 404 page, a pupil the viewer may
 * not open (§9) the 403 page. Tab title "Prestasi 360 — {nama} — PRESTASIPLUS" once the name is known.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DsBackLink, DsLoadError, DsPage, DsPageHeader, DsPanel, DsStatRow, DsStatTile } from '@/ds'
import { usePageMeta } from '@/composables/usePageMeta'

import { fetchStudentPerformance } from '../api/performance'
import ActivityHeatmap from '../components/prestasi360/ActivityHeatmap.vue'
import HeadcountCards from '../components/prestasi360/HeadcountCards.vue'
import MasteryCard from '../components/prestasi360/MasteryCard.vue'
import SuggestionsCard from '../components/prestasi360/SuggestionsCard.vue'
import WeakTopicsCard from '../components/prestasi360/WeakTopicsCard.vue'
import { usePhIcon } from '../lib/icons'
import { studyTime } from '../lib/analitik'
import { grouped, pct1, plain } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const icon = usePhIcon()
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

const stats = computed<StatSpec[]>(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    { id: 'sesi', label: 'Sesi Kuiz', value: plain(s.sessions), icon: 'clipboard-text' },
    { id: 'ketepatan', label: 'Ketepatan', value: pct1(s.accuracy), icon: 'check-circle' },
    { id: 'soalan', label: 'Soalan Dijawab', value: plain(s.answered), icon: 'question' },
    { id: 'masa', label: 'Masa Belajar', value: studyTime(s.seconds), icon: 'clock' },
  ]
})

const activity = computed(() => {
  const a = data.value?.activity
  if (!a) return []
  return [
    {
      id: 'kombo',
      label: 'Kombo Hari',
      value: plain(a.streakCurrent),
      icon: 'fire',
      accent: 'heat',
    },
    {
      id: 'rekod',
      label: 'Rekod Terbaik',
      value: plain(a.streakBest),
      icon: 'star',
      accent: 'action',
    },
    { id: 'koin', label: 'Koin', value: grouped(a.koinTotal), icon: 'medal', accent: 'heat' },
    {
      id: 'hari',
      label: 'Hari Latihan',
      value: plain(a.practiceDays),
      icon: 'calendar-dots',
      accent: 'action',
    },
  ] as const
})
</script>

<template>
  <DsPage data-testid="prestasi360-page">
    <h1 v-if="loadFailed || !data" class="sr-only">Prestasi 360</h1>
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div data-testid="hero">
        <DsPageHeader
          :show-title="true" :title="data.user.name"
          subtitle="Prestasi 360 — Dashboard Individu"
          title-testid="hero-name"
        >
          <template #breadcrumb>
            <DsBackLink to="/prestasi/kelas" label="Kembali" data-testid="back" @click.prevent="back" />
          </template>
          <template #leading>
            <UAvatar :text="data.user.initial" size="xl" data-testid="avatar" />
          </template>
          <template #actions>
            <div class="hidden gap-3 lg:flex" data-testid="hero-mini">
              <p class="flex flex-col items-center bg-elevated px-4 py-2">
                <span class="tabular text-heading text-highlighted" data-testid="hero-accuracy"
                  >{{ data.heroAccuracy }}%</span
                >
                <span class="text-caption text-muted">Ketepatan</span>
              </p>
              <p class="flex flex-col items-center bg-elevated px-4 py-2">
                <span class="tabular text-heading text-highlighted" data-testid="hero-streak">{{
                  data.streak
                }}</span>
                <span class="text-caption text-muted">Hari Kombo</span>
              </p>
            </div>
          </template>
        </DsPageHeader>
      </div>

      <DsStatRow :items="statItems(stats)" data-testid="stat-cards" :cols="4" prefix="stat" />

      <HeadcountCards
        v-if="data.headcount.length > 0"
        :user-id="data.user.id"
        :cards="data.headcount"
      />

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <MasteryCard :mastery="data.mastery" />
        <div class="flex min-w-0 flex-col gap-4 md:gap-6">
          <DsPanel class="min-w-0" data-testid="activity-card">
            <div class="flex flex-col gap-4">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon :name="icon('fire')" class="size-5 text-primary-t" />Aktiviti
              </h2>
              <ul class="grid grid-cols-2 gap-3">
                <li v-for="a in activity" :key="a.id" class="min-w-0">
                  <DsStatTile
                    :value="a.value"
                    :unit="a.label"
                    :icon="icon(a.icon)"
                    :accent="a.accent"
                    class="h-full"
                    :data-testid="`activity-${a.id}`"
                  />
                </li>
              </ul>
            </div>
          </DsPanel>
          <DsPanel v-if="data.badges.length > 0" class="min-w-0" data-testid="badges-card">
            <div class="flex flex-col gap-4">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon :name="icon('medal')" class="size-5 text-primary-t" />Lencana ({{
                  data.badges.length
                }})
              </h2>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="b in data.badges"
                  :key="b.name"
                  color="neutral"
                  variant="subtle"
                  size="lg"
                  :icon="icon('medal')"
                  :label="b.name"
                  :title="b.name"
                  data-testid="badge"
                />
              </div>
            </div>
          </DsPanel>
        </div>
      </div>

      <ActivityHeatmap :days="data.heatmap" />

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <WeakTopicsCard :topics="data.weakTopics" />
        <SuggestionsCard :items="data.suggestions" />
      </div>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
