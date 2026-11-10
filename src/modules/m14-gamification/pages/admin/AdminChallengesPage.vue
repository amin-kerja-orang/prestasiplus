<script setup lang="ts">
/**
 * `/admin/gamification/challenges` "Cabaran Harian" (V2 `admin/gamification/challenges.blade.php`; M14 S3), read only
 * (decision D118-3): the heading "Senarai Cabaran (N)" with the active count, then one card per challenge (icon, title,
 * difficulty, status, description, type, target, rewards) and the V2 footer line "N sertai / N siap" (`enrolled`,
 * `completed`; T-C12: 0 when the endpoint does not send them, as the mock does not).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsBadge,
  DsCluster,
  DsEmptyState,
  DsGrid,
  DsHeading,
  DsIcon,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStateView,
  DsText,
  formatCount,
} from '@/ds'

import { fetchAdminChallenges } from '../../api/admin'
import type { Difficulty } from '../../api/types'
import { ADMIN_COMMON, CHALLENGES_COPY as COPY } from '../../lib/admin/copy'

const load = useApi((signal) => fetchAdminChallenges({ signal }))
const list = computed(() => load.data.value)
const activeCount = computed(() => (list.value ?? []).filter((c) => c.isActive).length)

const DIFFICULTY_TONE: Record<Difficulty, 'success' | 'warning' | 'error'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
}
</script>

<template>
  <DsPage layout="list" data-testid="gam-challenges">
    <DsLoadError
      v-if="load.error.value"
      :message="ADMIN_COMMON.loadFailed"
      testid="gam-challenges-error"
      @retry="load.reload()"
    />
    <DsStateView v-else-if="list === null" status="loading" skeleton="cards" />
    <template v-else>
      <DsCluster justify="between" gap="md">
        <DsHeading :level="2" variant="subheading" data-testid="gam-challenges-title">
          {{ COPY.listTitle(list.length) }}
        </DsHeading>
        <DsBadge tone="success" :label="COPY.activeCount(activeCount)" data-testid="gam-challenges-active" />
      </DsCluster>

      <DsEmptyState v-if="list.length === 0" icon="target" :title="COPY.empty" data-testid="gam-challenges-empty" />
      <DsGrid v-else :balanced="2" gap="md">
        <DsPanel v-for="c in list" :key="c.id" stretch :data-testid="`gam-challenge-${String(c.id)}`">
          <DsCluster align="start" gap="md" :wrap="false">
            <DsText variant="display" as="span" aria-hidden="true">{{ c.icon || '🎯' }}</DsText>
            <DsStack gap="sm">
              <DsCluster gap="sm">
                <DsHeading :level="3" variant="subheading">{{ c.title }}</DsHeading>
                <DsBadge :tone="DIFFICULTY_TONE[c.difficulty]" :label="COPY.difficulty[c.difficulty]" size="sm" />
                <DsBadge
                  :tone="c.isActive ? 'success' : 'neutral'"
                  :label="c.isActive ? COPY.active : COPY.inactive"
                  size="sm"
                  :data-testid="`gam-challenge-${String(c.id)}-status`"
                />
              </DsCluster>
              <DsText variant="body" tone="muted">{{ c.description || COPY.noDescription }}</DsText>
              <DsCluster gap="sm">
                <DsBadge tone="neutral" icon="stack" :label="c.challengeType" size="sm" />
                <DsBadge tone="neutral" icon="flag-checkered" :label="COPY.target(formatCount(c.targetValue))" size="sm" />
                <DsBadge tone="warning" icon="coins" :label="`+${formatCount(c.rewardSyiling)}`" size="sm" />
                <DsBadge tone="info" icon="lightning" :label="`+${formatCount(c.rewardXp)} XP`" size="sm" />
              </DsCluster>
              <DsCluster gap="md" :data-testid="`gam-challenge-${String(c.id)}-stats`">
                <DsCluster gap="xs" as="span">
                  <DsIcon name="users" />
                  <DsText variant="caption" tone="muted" as="span">{{ COPY.enrolled(formatCount(c.enrolled ?? 0)) }}</DsText>
                </DsCluster>
                <DsCluster gap="xs" as="span">
                  <DsIcon name="check-circle" />
                  <DsText variant="caption" tone="muted" as="span">{{ COPY.completed(formatCount(c.completed ?? 0)) }}</DsText>
                </DsCluster>
              </DsCluster>
            </DsStack>
          </DsCluster>
        </DsPanel>
      </DsGrid>
    </template>
  </DsPage>
</template>
