<script setup lang="ts">
/**
 * S1 `/dashboard` "Dashboard" — the user-portal home (M05-T3; SRS M05 v1.20 FR-M05-01…28, §6.10).
 *
 * One call, `GET /api/dashboard` (#1), feeds every block, in the live DOM order: hero, free-trial
 * card, announcement carousel, Kombo reminder, five stat cards, "Misi Harian" widget, badge shelf,
 * quick actions, articles strip, "Subjek Tersedia", "Statistik Platform", "Tahap Pendidikan",
 * "Soalan Terkini" + "Tahap Kesukaran", "Statistik Subjek", and (≥ 1024 px) the right aside
 * "Artikel Terkini". The unobserved conditional sections are not rendered (FR-M05-20).
 * Live pages are server-rendered: no skeleton, the content area stays empty until the data is ready.
 */
import { computed } from 'vue'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchDashboard } from '../api/practice'
import ArticleBlocks from '../components/dashboard/ArticleBlocks.vue'
import BadgeShelf from '../components/dashboard/BadgeShelf.vue'
import BannerCarousel from '../components/dashboard/BannerCarousel.vue'
import { showKombo } from '../components/dashboard/dashboard-lib'
import DifficultyChart from '../components/dashboard/DifficultyChart.vue'
import HeroGreeting from '../components/dashboard/HeroGreeting.vue'
import KomboBanner from '../components/dashboard/KomboBanner.vue'
import LevelGroups from '../components/dashboard/LevelGroups.vue'
import PlatformStats from '../components/dashboard/PlatformStats.vue'
import QuestWidget from '../components/dashboard/QuestWidget.vue'
import QuickActions from '../components/dashboard/QuickActions.vue'
import RecentQuestions from '../components/dashboard/RecentQuestions.vue'
import StatCards from '../components/dashboard/StatCards.vue'
import SubjectCards from '../components/dashboard/SubjectCards.vue'
import SubjectStats from '../components/dashboard/SubjectStats.vue'
import TrialCard from '../components/dashboard/TrialCard.vue'
import '../components/dashboard/dashboard.css'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchDashboard({ signal }))

const kombo = computed(() => (data.value ? showKombo(data.value.streak) : false))
</script>

<template>
  <div class="m05-dashboard lg:grid lg:grid-cols-[1fr_300px] lg:gap-3" data-testid="dashboard-page">
    <div v-if="data" class="min-w-0 space-y-4 sm:space-y-8" data-testid="dashboard-main">
      <HeroGreeting :period="data.greetingPeriod" :name="data.user.name" />
      <TrialCard v-if="data.trial.active" :trial="data.trial" />
      <BannerCarousel v-if="data.banners.length > 0" :banners="data.banners" />
      <KomboBanner v-if="kombo" :count="data.streak.count" />
      <StatCards :wallet="data.wallet" :streak="data.streak" :week="data.week" />
      <QuestWidget :quests="data.quests" :completed="data.questsCompleted" />
      <BadgeShelf :badges="data.badges" />
      <QuickActions :revision-total="data.revisionTotal" :is-admin="data.user.role === 'admin'" />
      <ArticleBlocks variant="strip" :articles="data.articles" />
      <SubjectCards :subjects="data.subjects" />
      <PlatformStats :stats="data.stats" />
      <LevelGroups :pills="data.levelPills" />
      <div class="grid grid-cols-1 gap-3 sm:gap-7 lg:grid-cols-2">
        <RecentQuestions :questions="data.recentQuestions" :subjects="data.subjects" />
        <DifficultyChart :chart="data.difficultyChart" />
      </div>
      <SubjectStats :stats="data.subjectStats" />
    </div>

    <aside v-if="data" class="hidden lg:block" data-testid="dashboard-aside">
      <div class="sticky top-24 space-y-3 sm:space-y-6">
        <ArticleBlocks variant="aside" :articles="data.articles" />
      </div>
    </aside>

    <div
      v-else-if="error"
      class="mx-auto max-w-xl space-y-3 lg:col-span-2"
      data-testid="dashboard-error"
    >
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="dashboard-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>
  </div>
</template>
