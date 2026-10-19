<script setup lang="ts">
/**
 * FN-M10-2.1.4: "Tindakan Hari Ini". The prototype returns no priority student, topic or action,
 * so the counters are 0, the empty texts and the single live action card always show (FR-M10-11;
 * populated rows UNVERIFIED, L-M10-01).
 */
import { DsIconChip, DsPanel } from '@/ds'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'

defineProps<{ today: GuruDashboard['today'] }>()
</script>

<template>
  <DsPanel data-testid="today-panel">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-overline text-muted">{{ DASH_COPY.todayLabel }}</p>
        <h2 class="text-subheading text-highlighted">{{ DASH_COPY.todayTitle }}</h2>
        <p class="mt-1 text-body text-muted">{{ DASH_COPY.todayText }}</p>
      </div>
      <div class="grid shrink-0 grid-cols-3 gap-2" data-testid="today-counters">
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
            <p class="text-overline text-muted">{{ label }}</p>
            <p class="tabular text-heading text-highlighted">{{ n }}</p>
          </div>
        </DsPanel>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
      <DsPanel tone="inset" data-testid="today-students">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-label text-highlighted">{{ DASH_COPY.colStudents }}</h3>
          <span class="text-caption text-muted">{{ DASH_COPY.top3 }}</span>
        </div>
        <p class="mt-3 text-body text-muted">{{ DASH_COPY.emptyStudents }}</p>
      </DsPanel>
      <DsPanel tone="inset" data-testid="today-topics">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-label text-highlighted">{{ DASH_COPY.colTopics }}</h3>
          <UButton
            to="/analitik/kelas"
            variant="link"
            size="sm"
            class="px-0"
            data-testid="today-analytics"
            >{{ DASH_COPY.analytics }}</UButton
          >
        </div>
        <p class="mt-3 text-body text-muted">{{ DASH_COPY.emptyTopics }}</p>
      </DsPanel>
      <DsPanel tone="inset" data-testid="today-actions">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-label text-highlighted">{{ DASH_COPY.colActions }}</h3>
          <span class="text-caption text-muted">{{ DASH_COPY.ruleBased }}</span>
        </div>
        <div class="mt-3 flex gap-3" data-testid="today-action">
          <DsIconChip icon="laptop" accent="win" />
          <div class="flex min-w-0 flex-col items-start gap-1">
            <p class="text-label text-highlighted">{{ DASH_COPY.actionTitle }}</p>
            <UBadge color="neutral" variant="subtle">{{ DASH_COPY.actionBadge }}</UBadge>
            <p class="text-body text-muted">{{ DASH_COPY.actionText }}</p>
            <UButton to="/guru/kelas" variant="link" class="px-0" data-testid="today-action-link">{{
              DASH_COPY.actionLink
            }}</UButton>
          </div>
        </div>
      </DsPanel>
    </div>
  </DsPanel>
</template>
