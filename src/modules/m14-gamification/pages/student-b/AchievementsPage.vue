<script setup lang="ts">
/**
 * S15 `/gamification/achievements` "Pencapaian Anda" (M14-T2b; FR-M14-44..51, BR-M14-15/16;
 * FN-M14-6.1.*). Hero with "{unlocked}/25 dicapai", the streak card from the single M14 store, the
 * rarity pills (links, `?rarity=`) and the 25 cards; an unlocked card opens the share modal.
 * An unknown `?rarity=` renders the pills and no card and no message (FR-M14-08).
 */
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { useSession } from '@/composables/useSession'

import { fetchGamificationAchievements, type AchievementItem } from '../../api'
import AchievementBadgeCard from '../../components/student-b/AchievementBadgeCard.vue'
import AchievementShareModal from '../../components/student-b/AchievementShareModal.vue'
import StudentBLoadState from '../../components/student-b/StudentBLoadState.vue'
import {
  ACHIEVEMENTS_COPY,
  ACHIEVEMENTS_PATH,
  RARITY_PILLS,
  achievementsSubtitle,
  readRarity,
  streakBestLabel,
  streakBonusLabel,
} from '../../lib/student/achievements-lib'
import { profileUrlOf } from '../../lib/student/studentb-share'

const route = useRoute()
const { user } = useSession()
const rarity = computed(() => readRarity(route.query.rarity))

const { data, error, reload } = useApi(
  (signal) => fetchGamificationAchievements({ rarity: rarity.value }, { signal }),
  rarity,
)

const selected = ref<AchievementItem | null>(null)

const progressWidth = computed(() =>
  data.value && data.value.total > 0
    ? Math.min(100, (data.value.unlocked / data.value.total) * 100)
    : 0,
)
</script>

<template>
  <div class="space-y-5" data-testid="achievements-page">
    <template v-if="data">
      <section
        class="rounded-2xl bg-linear-to-br from-violet-500 to-purple-400 px-5 py-5 text-white shadow-lg"
        data-testid="achievements-hero"
      >
        <h1 class="font-heading text-2xl font-bold text-white">{{ ACHIEVEMENTS_COPY.title }}</h1>
        <p class="mt-1 text-sm text-white/90" data-testid="achievements-subtitle">
          {{ achievementsSubtitle(data.unlocked, data.total) }}
        </p>
        <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/30">
          <div
            class="h-full rounded-full bg-white/80"
            :style="{ width: `${String(progressWidth)}%` }"
          ></div>
        </div>
      </section>

      <section
        class="flex items-center justify-between gap-4 rounded-2xl bg-linear-to-br from-orange-500 to-red-500 px-5 py-5 text-white shadow-lg"
        data-testid="achievements-streak"
      >
        <div class="flex min-w-0 items-center gap-4">
          <div class="text-4xl" aria-hidden="true">🔥</div>
          <div class="min-w-0">
            <div class="font-heading text-4xl leading-none font-bold" data-testid="streak-current">
              {{ data.streak.current }}
            </div>
            <div class="mt-1 text-sm">{{ ACHIEVEMENTS_COPY.streakLabel }}</div>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <span
            class="inline-block rounded-full bg-white/25 px-3 py-1 text-sm font-bold"
            data-testid="streak-bonus"
            >{{ streakBonusLabel(data.streak.multiplier) }}</span
          >
          <div class="mt-2 text-sm" data-testid="streak-best">
            {{ streakBestLabel(data.streak.best) }}
          </div>
        </div>
      </section>

      <nav class="flex flex-wrap gap-2" data-testid="achievements-pills">
        <RouterLink
          v-for="pill in RARITY_PILLS"
          :key="pill.label"
          :to="
            pill.value === null
              ? { path: ACHIEVEMENTS_PATH }
              : { path: ACHIEVEMENTS_PATH, query: { rarity: pill.value } }
          "
          :class="[
            'inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition',
            rarity === pill.value
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50',
          ]"
          :data-active="rarity === pill.value ? 'true' : 'false'"
          data-testid="achievements-pill"
          >{{ pill.label }}</RouterLink
        >
      </nav>

      <div
        class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5"
        data-testid="achievements-grid"
      >
        <AchievementBadgeCard
          v-for="item in data.items"
          :key="item.id"
          :item="item"
          @open="selected = $event"
        />
      </div>

      <AchievementShareModal
        v-if="selected"
        :item="selected"
        :user-name="user?.name ?? ''"
        :profile-url="profileUrlOf(user?.id ?? 0)"
        @close="selected = null"
      />
    </template>
    <StudentBLoadState
      v-else
      :error="error !== null"
      :message="ACHIEVEMENTS_COPY.loadError"
      :retry-label="ACHIEVEMENTS_COPY.retry"
      test-key="achievements"
      @retry="reload()"
    />
  </div>
</template>
