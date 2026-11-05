<script setup lang="ts">
/**
 * "Topik Perlu Diperkuat" (FR-MUR-2-6): the subjects with accuracy under 60 in the last 30 days, worst
 * first, each with a "Latih" button to Latih Tubi for the subject. The figures come from the existing
 * `GET /api/practice/progress?period=30` read; a failed call hides the card (the rest of Home is unaffected).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsCluster, DsPanel, DsStack, DsText } from '@/ds'

import { fetchProgress } from '../../api/practice'
import { WEAK_TOPIC_PERIOD, weakTopics } from '../dashboard/dashboard-lib'

const { data } = useApi((signal) => fetchProgress(WEAK_TOPIC_PERIOD, { signal }))
const topics = computed(() => weakTopics(data.value?.subjects ?? []))
</script>

<template>
  <DsPanel
    v-if="topics.length > 0"
    as="section"
    title="Topik Perlu Diperkuat"
    icon="warning"
    accent="heat"
    data-testid="dash-weak"
  >
    <DsStack as="ul" gap="sm">
      <li v-for="t in topics" :key="t.code" class="min-w-0" data-testid="dash-weak-row">
        <DsPanel tone="inset">
          <DsCluster gap="sm" justify="between">
            <DsStack gap="none" fill>
              <DsText variant="label" tone="highlighted" truncate data-testid="dash-weak-name">{{
                t.name
              }}</DsText>
              <DsText variant="caption" tone="muted">{{ t.answered }} soalan</DsText>
            </DsStack>
            <DsText variant="label" tone="error" tabular data-testid="dash-weak-pct"
              >{{ t.accuracyPct }}%</DsText
            >
            <UButton
              :to="`/practice/${t.code}`"
              variant="soft"
              class="min-h-11"
              data-testid="dash-weak-latih"
              >Latih</UButton
            >
          </DsCluster>
        </DsPanel>
      </li>
    </DsStack>
  </DsPanel>
</template>
