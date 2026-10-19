<script setup lang="ts">
/** S4 "Mengikut Subjek" (FN-M11-4.2.4; FR-M11-65): one bar row per answered subject. */
import type { StudentDetail } from '../../api/types'
import { ACCURACY_COLOR, accuracyBand, count, pct1 } from './monitoring-format'
import { DsCluster, DsStack, DsText } from '@/ds'

defineProps<{ subjects: StudentDetail['subjects'] }>()
</script>

<template>
  <UCard data-testid="mon-panel-subject">
    <DsStack>
      <h2 class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-book" class="size-5 text-primary-t" />Mengikut Subjek
      </h2>
      <DsStack gap="sm">
        <DsCluster
          v-for="s in subjects"
          :key="s.subjectId"
          :wrap="false"
          data-testid="mon-subject-row"
        >
          <DsText variant="body" as="span" truncate class="w-28 shrink-0 sm:w-40" :title="s.name">{{
            s.name
          }}</DsText>
          <UProgress
            :model-value="s.pct"
            :color="ACCURACY_COLOR[accuracyBand(s.pct)]"
            size="md"
            class="min-w-0 flex-1"
            :data-band="accuracyBand(s.pct)"
            data-testid="mon-subject-bar"
          />
          <DsText variant="label" align="end" tabular class="w-14 shrink-0">{{
            pct1(s.pct)
          }}</DsText>
          <DsText variant="caption" as="span" align="end" tabular class="w-16 shrink-0"
            >{{ count(s.correct) }}/{{ count(s.total) }}</DsText
          >
        </DsCluster>
      </DsStack>
    </DsStack>
  </UCard>
</template>
