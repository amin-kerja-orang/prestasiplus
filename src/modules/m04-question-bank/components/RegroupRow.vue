<script setup lang="ts">
/**
 * One row of the regroup work-list (PRD45 6.6.2): `Soalan` (first 120 characters), `Subjek`, `Tingkatan`, `Kertas sumber` and
 * number, `Sebab` and `Rujukan`. `Cadangan` and the row actions come with API-Q-12, API-Q-24 and API-Q-36 (S1-T07 part 2).
 */
import { DsCluster, DsStack, DsSurface, DsText } from '@/ds'

import { regroupReference, regroupSource, type RegroupWorkRow } from '../lib/question-list'

defineProps<{ row: RegroupWorkRow }>()
</script>

<template>
  <DsSurface as="li" level="soft" padding="sm" shadow="none" :data-testid="`regroup-row-${row.questionId}`">
    <DsStack gap="2xs">
      <DsText variant="body" data-testid="regroup-stem">{{ row.stemExcerpt }}</DsText>
      <DsCluster gap="sm">
        <DsText variant="caption" tone="muted">{{ row.subject }}</DsText>
        <DsText variant="caption" tone="muted">{{ row.level }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="regroup-source">{{ regroupSource(row) }}</DsText>
        <DsText variant="caption" tone="warning" data-testid="regroup-flag">{{ row.flag }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="regroup-reference">{{ regroupReference(row) }}</DsText>
      </DsCluster>
    </DsStack>
  </DsSurface>
</template>
