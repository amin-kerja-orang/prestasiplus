<script setup lang="ts">
/**
 * S15 `/gamification/achievements` "Pencapaian Anda" (M14-T2b; FR-M14-44..51, BR-M14-15/16;
 * FN-M14-6.1.*). Hero with "{unlocked}/25 dicapai", the streak card from the single M14 store, the
 * rarity pills (links, `?rarity=`) and the 25 cards; an unlocked card opens the share modal.
 * An unknown `?rarity=` renders the pills and no card and no message (FR-M14-08).
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { useSession } from '@/composables/useSession'
import { DsArt3D, DsPage, DsLoadError, DsGrid, DsStack, DsCluster, DsHeading, DsText } from '@/ds'

import { fetchGamificationAchievements, type AchievementItem } from '../../api'
import AchievementBadgeCard from '../../components/student-b/AchievementBadgeCard.vue'
import AchievementShareModal from '../../components/student-b/AchievementShareModal.vue'
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
  <DsPage data-testid="achievements-page">
    <template v-if="data">
      <DsGrid :cols="{ base: 1, md: 2 }">
        <UCard data-testid="achievements-hero">
          <DsStack gap="sm">
            <DsCluster :wrap="false">
              <DsArt3D name="trophy" size="lg" float />
              <DsStack gap="2xs">
                <DsHeading :level="1">
                  {{ ACHIEVEMENTS_COPY.title }}
                </DsHeading>
                <DsText variant="label" as="p" tone="muted" data-testid="achievements-subtitle">
                  {{ achievementsSubtitle(data.unlocked, data.total) }}
                </DsText>
              </DsStack>
            </DsCluster>
            <UProgress
              :model-value="progressWidth"
              :max="100"
              aria-label="Pencapaian dicapai"
              :data-value="progressWidth"
            />
          </DsStack>
        </UCard>

        <UCard data-testid="achievements-streak">
          <DsCluster gap="md" justify="between" :wrap="false">
            <DsCluster :wrap="false">
              <DsArt3D name="fire" size="lg" float />
              <DsStack gap="none">
                <DsText variant="display" as="span" tabular data-testid="streak-current">{{
                  data.streak.current
                }}</DsText>
                <DsText variant="label" tone="muted">{{ ACHIEVEMENTS_COPY.streakLabel }}</DsText>
              </DsStack>
            </DsCluster>
            <DsStack gap="2xs" align="end" class="shrink-0">
              <UBadge color="warning" variant="solid" data-testid="streak-bonus">{{
                streakBonusLabel(data.streak.multiplier)
              }}</UBadge>
              <DsText variant="caption" as="span" data-testid="streak-best">{{
                streakBestLabel(data.streak.best)
              }}</DsText>
            </DsStack>
          </DsCluster>
        </UCard>
      </DsGrid>

      <DsCluster
        as="nav"
        gap="xs"
        align="stretch"
        :wrap="false"
        class="overflow-x-auto"
        data-testid="achievements-pills"
        aria-label="Kelangkaan"
      >
        <UButton
          v-for="pill in RARITY_PILLS"
          :key="pill.label"
          :to="
            pill.value === null
              ? { path: ACHIEVEMENTS_PATH }
              : { path: ACHIEVEMENTS_PATH, query: { rarity: pill.value } }
          "
          size="lg"
          class="shrink-0"
          :color="rarity === pill.value ? 'primary' : 'neutral'"
          :variant="rarity === pill.value ? 'solid' : 'soft'"
          :data-active="rarity === pill.value ? 'true' : 'false'"
          data-testid="achievements-pill"
          >{{ pill.label }}</UButton
        >
      </DsCluster>

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
    <DsLoadError
      v-else-if="error !== null"
      :message="ACHIEVEMENTS_COPY.loadError"
      :retry-label="ACHIEVEMENTS_COPY.retry"
      testid="achievements-error"
      retry-testid="achievements-retry"
      @retry="reload()"
    />
    <DsStack v-else gap="sm" aria-busy="true" data-testid="achievements-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
