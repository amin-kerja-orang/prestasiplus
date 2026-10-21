<script setup lang="ts">
/**
 * S21 card "Perlu Tindakan Susulan" (copy rows 38-40): pupil name, "{jenis} · {d MMM yyyy}" and an effectiveness
 * badge. The arrow to S24 Log Intervensi is NOT rendered: S24 is not built (contract gap, design Q3).
 */
import { DsEmptyState, DsPanel, DsStatusBadge } from '@/ds'

import type { AmaranEffectivenessReportView } from '../../api/amaran'
import { followUpLine, KB_BADGE } from './kb-format'

defineProps<{ rows: AmaranEffectivenessReportView['followUps'] }>()
</script>

<template>
  <DsPanel title="Perlu Tindakan Susulan" data-testid="kb-followups">
    <DsEmptyState
      v-if="rows.length === 0"
      size="sm"
      title="Tiada tindakan susulan."
      data-testid="kb-followups-empty"
    />
    <ul v-else class="flex min-w-0 flex-col divide-y divide-default">
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="kb-followup-row"
      >
        <div class="min-w-0">
          <p class="text-label text-highlighted" data-testid="kb-followup-name">{{ r.studentName }}</p>
          <p class="text-caption text-muted" data-testid="kb-followup-line">
            {{ followUpLine(r.label, r.interventionDate) }}
          </p>
        </div>
        <DsStatusBadge
          :status="KB_BADGE[r.effectiveness].status"
          :label="KB_BADGE[r.effectiveness].label"
          class="w-fit"
          data-testid="kb-followup-badge"
        />
      </li>
    </ul>
  </DsPanel>
</template>
