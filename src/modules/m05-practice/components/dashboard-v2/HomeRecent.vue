<script setup lang="ts">
/** "Soalan Terkini" (FR-M05-26): the latest questions with subject, star difficulty, age and level. */
import { diffForHumans } from '@/lib/time'

import type { DashboardRecentQuestion } from '../../api/types'
import { starStates } from '../dashboard/dashboard-lib'
import { DsCluster, DsStack, DsHeading, DsText } from '@/ds'

defineProps<{ questions: DashboardRecentQuestion[] }>()
</script>

<template>
  <DsStack as="section" gap="sm" aria-labelledby="dash-recent-h" data-testid="dash-recent">
    <DsHeading id="dash-recent-h" :level="2">⚡ Soalan Terkini</DsHeading>
    <DsStack as="ul" gap="xs">
      <li v-for="q in questions" :key="q.id" data-testid="dash-recent-item">
        <UCard :ui="{ body: 'flex flex-col gap-2 p-4' }">
          <DsCluster gap="xs" justify="between" :wrap="false">
            <UBadge color="neutral" variant="subtle" data-testid="dash-recent-subject">{{
              q.subjectName
            }}</UBadge>
            <DsCluster
              as="span"
              gap="none"
              align="stretch"
              :wrap="false"
              data-testid="dash-recent-stars"
              :aria-label="`Kesukaran ${q.difficulty} daripada 5`"
            >
              <span
                v-for="(on, i) in starStates(q.difficulty)"
                :key="i"
                :class="on ? 'text-warning' : 'text-dimmed'"
                :data-on="on ? 'true' : 'false'"
                aria-hidden="true"
                >★</span
              >
            </DsCluster>
          </DsCluster>
          <DsText variant="label" as="p" wrap="anywhere" data-testid="dash-recent-text">
            {{ q.text }}
          </DsText>
          <div class="flex items-center justify-between gap-2 text-caption text-muted">
            <span>{{ diffForHumans(q.createdAt) }}</span>
            <UBadge color="primary" variant="subtle" size="sm" data-testid="dash-recent-level">{{
              q.levelCode
            }}</UBadge>
          </div>
        </UCard>
      </li>
    </DsStack>
  </DsStack>
</template>
