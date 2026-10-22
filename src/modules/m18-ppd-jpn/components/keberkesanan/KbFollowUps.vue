<script setup lang="ts">
/**
 * S21 card "Perlu Tindakan Susulan" (copy rows 38-40): pupil name, "{jenis} · {d MMM yyyy}" and an effectiveness
 * badge. The arrow to S24 Log Intervensi is NOT rendered: S24 is not built (contract gap, design Q3).
 */
import { DsCluster, DsEmptyState, DsPanel, DsStack, DsStatusBadge, DsSurface, DsText } from '@/ds'

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
    <DsStack v-else as="ul" gap="xs">
      <DsSurface
        v-for="r in rows"
        :key="r.id"
        as="li"
        level="soft"
        padding="sm"
        data-testid="kb-followup-row"
      >
        <DsCluster stack-below="sm" justify="between" gap="xs">
          <DsStack gap="none">
            <DsText variant="label" tone="highlighted" data-testid="kb-followup-name">{{ r.studentName }}</DsText>
            <DsText variant="caption" data-testid="kb-followup-line">
              {{ followUpLine(r.label, r.interventionDate) }}
            </DsText>
          </DsStack>
          <DsStatusBadge
            :status="KB_BADGE[r.effectiveness].status"
            :label="KB_BADGE[r.effectiveness].label"
            class="w-fit"
            data-testid="kb-followup-badge"
          />
        </DsCluster>
      </DsSurface>
    </DsStack>
  </DsPanel>
</template>
