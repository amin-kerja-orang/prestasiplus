<script setup lang="ts">
/**
 * "Cabaran Kilat" (violet "friend" card): the first three of today's challenges. Data comes from the
 * existing `GET /api/gamification/challenges`; the card is hidden while loading, with no rows and on
 * any error, so the rest of the dashboard is unaffected.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsCharacterCard } from '@/ds'

import { fetchChallengesToday } from '../../api/practice'
import { QUEST_DIFFICULTY, questPct } from '../dashboard/dashboard-lib'

const { data } = useApi((signal) => fetchChallengesToday({ signal }))
const rows = computed(() => (data.value ?? []).slice(0, 3))
const BADGE_COLOR = { easy: 'success', medium: 'warning', hard: 'error' } as const
</script>

<template>
  <DsCharacterCard
    v-if="rows.length > 0"
    accent="friend"
    icon="lightning"
    title="⚡ Cabaran Kilat"
    data-testid="dash-cabaran"
  >
    <ul class="flex flex-col gap-2" data-testid="dash-cabaran-list">
      <li v-for="c in rows" :key="c.id" data-testid="dash-cabaran-row">
        <UCard :ui="{ body: 'flex items-center gap-3 p-3' }">
          <span class="text-heading" aria-hidden="true">{{ c.icon }}</span>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-label text-highlighted" data-testid="dash-cabaran-title">{{
                c.title
              }}</span>
              <UBadge
                :color="BADGE_COLOR[c.difficulty]"
                variant="subtle"
                size="sm"
                data-testid="dash-cabaran-chip"
                >{{ QUEST_DIFFICULTY[c.difficulty].label }}</UBadge
              >
            </div>
            <div class="flex items-center gap-2">
              <UProgress
                :model-value="questPct(c.progress, c.target)"
                :max="100"
                size="sm"
                class="flex-1"
                :aria-label="`Progres ${c.title}`"
              />
              <span class="tabular text-caption text-muted" data-testid="dash-cabaran-progress"
                >{{ c.progress }}/{{ c.target }}</span
              >
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-center">
            <span aria-hidden="true">🪙</span>
            <span class="tabular text-caption text-highlighted" data-testid="dash-cabaran-reward"
              >+{{ c.rewardSyiling }}</span
            >
          </div>
        </UCard>
      </li>
    </ul>
    <RouterLink
      to="/gamification/challenges"
      class="text-label text-primary-t"
      data-testid="dash-cabaran-link"
      >Lihat Semua →</RouterLink
    >
  </DsCharacterCard>
</template>
