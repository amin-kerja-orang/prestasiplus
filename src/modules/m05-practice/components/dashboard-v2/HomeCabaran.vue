<script setup lang="ts">
/**
 * "Cabaran Kilat" (violet "friend" card): the first three of today's challenges. Data comes from the
 * existing `GET /api/gamification/challenges`; the card is hidden while loading, with no rows and on
 * any error, so the rest of the dashboard is unaffected.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsBadge, DsCharacterCard, DsCluster, DsLink, DsProgress, DsStack, DsSurface, DsText } from '@/ds'

import { fetchChallengesToday } from '../../api/practice'
import { QUEST_DIFFICULTY, questPct } from '../dashboard/dashboard-lib'

const { data } = useApi((signal) => fetchChallengesToday({ signal }))
const rows = computed(() => (data.value ?? []).slice(0, 3))
const BADGE_TONE = { easy: 'success', medium: 'warning', hard: 'error' } as const
</script>

<template>
  <DsCharacterCard
    v-if="rows.length > 0"
    accent="friend"
    icon="lightning"
    title="⚡ Cabaran Kilat"
    data-testid="dash-cabaran"
  >
    <DsStack as="ul" gap="sm" data-testid="dash-cabaran-list">
      <li v-for="c in rows" :key="c.id" data-testid="dash-cabaran-row">
        <DsSurface padding="sm">
          <DsCluster gap="sm" :wrap="false">
            <DsText variant="heading" as="span" aria-hidden="true">{{ c.icon }}</DsText>
            <DsStack gap="xs" class="grow">
              <DsCluster gap="sm">
                <DsText variant="label" tone="highlighted" as="span" data-testid="dash-cabaran-title">{{
                  c.title
                }}</DsText>
                <DsBadge
                  :tone="BADGE_TONE[c.difficulty]"
                  :label="QUEST_DIFFICULTY[c.difficulty].label"
                  size="sm"
                  data-testid="dash-cabaran-chip"
                />
              </DsCluster>
              <DsCluster gap="sm" :wrap="false">
                <DsProgress
                  class="grow"
                  :value="questPct(c.progress, c.target)"
                  :show-value="false"
                  size="sm"
                  :aria-label="`Progres ${c.title}`"
                />
                <DsText
                  variant="caption"
                  tone="muted"
                  as="span"
                  tabular
                  data-testid="dash-cabaran-progress"
                  >{{ c.progress }}/{{ c.target }}</DsText
                >
              </DsCluster>
            </DsStack>
            <DsStack gap="none" align="center" class="shrink-0">
              <span aria-hidden="true">🪙</span>
              <DsText
                variant="caption"
                tone="highlighted"
                as="span"
                tabular
                data-testid="dash-cabaran-reward"
                >+{{ c.rewardSyiling }}</DsText
              >
            </DsStack>
          </DsCluster>
        </DsSurface>
      </li>
    </DsStack>
    <DsLink to="/gamification/challenges" data-testid="dash-cabaran-link">Lihat Semua →</DsLink>
  </DsCharacterCard>
</template>
