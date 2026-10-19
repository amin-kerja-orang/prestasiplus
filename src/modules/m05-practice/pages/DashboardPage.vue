<script setup lang="ts">
/**
 * S1 `/dashboard` "Dashboard" — the Murid Home in v2 (M05-T3; SRS M05 v1.20 FR-M05-01…28, §6.10;
 * design `docs/design/v2-learner-prototype.html`, decisions D35–D38).
 *
 * One call, `GET /api/dashboard` (#1), feeds every block, in the order of the approved prototype:
 * greeting card (friend avatar + speech bubble), reward tiles, "Sambung latihan" hero, free-trial
 * card, announcement carousel, Kombo warning, five stat cards, "Misi Harian", badges, quick
 * actions, articles, "Subjek Tersedia", "Statistik Platform", "Tahap Pendidikan", "Soalan
 * Terkini", "Tahap Kesukaran" and "Statistik Subjek". The unobserved conditional sections are not
 * rendered (FR-M05-20). A strict design-system page: layout utilities and `@/ds` composites only.
 */
import { computed, nextTick, watch } from 'vue'

import { useApi } from '@/composables'
import { useFriend } from '@/composables/useFriend'

import { fetchDashboard } from '../api/practice'
import { showKombo } from '../components/dashboard/dashboard-lib'
import HomeArticles from '../components/dashboard-v2/HomeArticles.vue'
import HomeBadges from '../components/dashboard-v2/HomeBadges.vue'
import HomeCarousel from '../components/dashboard-v2/HomeCarousel.vue'
import HomeDifficulty from '../components/dashboard-v2/HomeDifficulty.vue'
import HomeGreeting from '../components/dashboard-v2/HomeGreeting.vue'
import HomeKombo from '../components/dashboard-v2/HomeKombo.vue'
import HomeLevels from '../components/dashboard-v2/HomeLevels.vue'
import HomePlatform from '../components/dashboard-v2/HomePlatform.vue'
import HomeQuests from '../components/dashboard-v2/HomeQuests.vue'
import HomeQuickActions from '../components/dashboard-v2/HomeQuickActions.vue'
import HomeRecent from '../components/dashboard-v2/HomeRecent.vue'
import HomeRewards from '../components/dashboard-v2/HomeRewards.vue'
import HomeStats from '../components/dashboard-v2/HomeStats.vue'
import HomeSubjects from '../components/dashboard-v2/HomeSubjects.vue'
import HomeSubjectStats from '../components/dashboard-v2/HomeSubjectStats.vue'
import HomeTrial from '../components/dashboard-v2/HomeTrial.vue'
import { DsLoadError } from '@/ds'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchDashboard({ signal }))
const { offerFirstRun } = useFriend()

const kombo = computed(() => (data.value ? showKombo(data.value.streak) : false))

// First visit: the friend picker opens over Home after the first paint (design v2-shells 5.4).
watch(
  () => data.value?.user.role,
  (role) => {
    if (role === 'student') void nextTick(offerFirstRun)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6" data-testid="dashboard-page">
    <div v-if="data" class="flex min-w-0 flex-col gap-6" data-testid="dashboard-main">
      <HomeGreeting
        :period="data.greetingPeriod"
        :name="data.user.name"
        :streak-at-risk="kombo"
        :streak-count="data.streak.count"
      />
      <HomeRewards :data="data" />
      <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <HomeTrial v-if="data.trial.active" :trial="data.trial" />
        <HomeCarousel v-if="data.banners.length > 0" :banners="data.banners" />
        <HomeKombo v-if="kombo" :count="data.streak.count" />
      </div>
      <HomeStats :wallet="data.wallet" :streak="data.streak" :week="data.week" />
      <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <HomeQuests :quests="data.quests" :completed="data.questsCompleted" />
        <HomeBadges :badges="data.badges" />
      </div>
      <HomeQuickActions
        :revision-total="data.revisionTotal"
        :is-admin="data.user.role === 'admin'"
      />
      <HomeArticles :articles="data.articles" />
      <HomeSubjects :subjects="data.subjects" />
      <HomePlatform :stats="data.stats" />
      <HomeLevels :pills="data.levelPills" />
      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <HomeRecent :questions="data.recentQuestions" />
        <HomeDifficulty :chart="data.difficultyChart" />
      </div>
      <HomeSubjectStats :stats="data.subjectStats" />
    </div>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      testid="dashboard-error"
      retry-testid="dashboard-retry"
      @retry="reload()"
    />

    <div v-else class="flex flex-col gap-4" aria-busy="true" data-testid="dashboard-loading">
      <USkeleton class="h-32 w-full" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>
  </div>
</template>
