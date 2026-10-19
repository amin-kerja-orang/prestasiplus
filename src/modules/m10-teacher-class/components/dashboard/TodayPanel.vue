<script setup lang="ts">
/**
 * FN-M10-2.1.4: "Tindakan Hari Ini". The prototype returns no priority student, topic or action,
 * so the counters are 0, the empty texts and the single live action card always show (FR-M10-11;
 * populated rows UNVERIFIED, L-M10-01).
 */
import { DsIconChip, DsPanel, DsGrid, DsCluster, DsStack, DsText, DsHeading } from '@/ds'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'

defineProps<{ today: GuruDashboard['today'] }>()
</script>

<template>
  <DsPanel data-testid="today-panel">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <DsText variant="overline" as="p">{{ DASH_COPY.todayLabel }}</DsText>
        <DsHeading :level="2" variant="subheading">{{ DASH_COPY.todayTitle }}</DsHeading>
        <p class="mt-1 text-body text-muted">{{ DASH_COPY.todayText }}</p>
      </div>
      <DsGrid :cols="3" gap="xs" class="shrink-0" data-testid="today-counters">
        <DsPanel
          v-for="[label, n] in [
            [DASH_COPY.counterStudents, today.students.length],
            [DASH_COPY.counterTopics, today.topics.length],
            [DASH_COPY.counterActions, today.actions.length],
          ]"
          :key="label"
          tone="inset"
          class="sm:min-w-20"
        >
          <div class="text-center">
            <DsText variant="overline" as="p">{{ label }}</DsText>
            <DsText variant="heading" tabular>{{ n }}</DsText>
          </div>
        </DsPanel>
      </DsGrid>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
      <DsPanel tone="inset" data-testid="today-students">
        <DsCluster gap="xs" justify="between" :wrap="false">
          <DsHeading :level="3" variant="label">{{ DASH_COPY.colStudents }}</DsHeading>
          <DsText variant="caption" as="span">{{ DASH_COPY.top3 }}</DsText>
        </DsCluster>
        <p class="mt-3 text-body text-muted">{{ DASH_COPY.emptyStudents }}</p>
      </DsPanel>
      <DsPanel tone="inset" data-testid="today-topics">
        <DsCluster gap="xs" justify="between" :wrap="false">
          <DsHeading :level="3" variant="label">{{ DASH_COPY.colTopics }}</DsHeading>
          <UButton
            to="/analitik/kelas"
            variant="link"
            size="sm"
            class="px-0"
            data-testid="today-analytics"
            >{{ DASH_COPY.analytics }}</UButton
          >
        </DsCluster>
        <p class="mt-3 text-body text-muted">{{ DASH_COPY.emptyTopics }}</p>
      </DsPanel>
      <DsPanel tone="inset" data-testid="today-actions">
        <DsCluster gap="xs" justify="between" :wrap="false">
          <DsHeading :level="3" variant="label">{{ DASH_COPY.colActions }}</DsHeading>
          <DsText variant="caption" as="span">{{ DASH_COPY.ruleBased }}</DsText>
        </DsCluster>
        <div class="mt-3 flex gap-3" data-testid="today-action">
          <DsIconChip icon="laptop" accent="win" />
          <DsStack gap="2xs" align="start">
            <DsText variant="label" as="p" tone="highlighted">{{ DASH_COPY.actionTitle }}</DsText>
            <UBadge color="neutral" variant="subtle">{{ DASH_COPY.actionBadge }}</UBadge>
            <DsText variant="body" tone="muted">{{ DASH_COPY.actionText }}</DsText>
            <UButton to="/guru/kelas" variant="link" class="px-0" data-testid="today-action-link">{{
              DASH_COPY.actionLink
            }}</UButton>
          </DsStack>
        </div>
      </DsPanel>
    </div>
  </DsPanel>
</template>
