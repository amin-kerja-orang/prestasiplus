<script setup lang="ts">
/**
 * Teacher detail body of "Soalan Berstruktur" (R1-GUR-44b, S6-T17): status chip, the summary pills, the
 * stimulus once ("Rangsangan"), "Sub-Soalan ({n})" with each part, its marks and "Skema Jawapan".
 * No admin-only field is read. The page owns the load, the 404 and the back link.
 */
import { computed } from 'vue'

import {
  DsArt3D,
  DsBadge,
  DsCluster,
  DsHeading,
  DsPanel,
  DsStack,
  DsStatusBadge,
  DsText,
} from '@/ds'
import type { DsStatus } from '@/ds'

import type { GuruStructuredDetail } from '../api/structured-guru'
import { GURU_STATUS_LABEL } from '../lib/structured-options'

const props = defineProps<{ detail: GuruStructuredDetail }>()

const STATUS: Record<GuruStructuredDetail['status'], DsStatus> = {
  approved: 'approved',
  review: 'awaiting-review',
}
/** Only an http(s), root-relative or blob URL is rendered as the stimulus figure. */
const figure = computed(() => {
  const url = props.detail.stimulusImage
  if (!url) return null
  return /^https?:\/\//i.test(url) || /^\/(?![/\\])/.test(url) || /^blob:/i.test(url) ? url : null
})
</script>

<template>
  <DsPanel data-testid="structured-header">
    <DsStack gap="md">
      <DsCluster justify="between" align="start">
        <DsCluster>
          <DsBadge
            v-if="detail.subject?.name"
            tone="primary"
            :label="detail.subject?.name"
            data-testid="structured-pill-subject"
          />
          <DsBadge
            v-if="detail.level?.name"
            tone="neutral"
            :label="detail.level?.name"
            data-testid="structured-pill-level"
          />
          <DsBadge tone="info" :label="detail.kbat" data-testid="structured-pill-kbat" />
          <DsBadge
            tone="success"
            :label="`${detail.totalMarks} markah`"
            data-testid="structured-pill-marks"
          />
        </DsCluster>
        <DsStatusBadge
          :status="STATUS[detail.status]"
          :label="GURU_STATUS_LABEL[detail.status] ?? detail.status"
          data-testid="structured-status"
        />
      </DsCluster>

      <DsPanel padding="sm">
        <DsStack gap="xs">
          <DsHeading :level="2" variant="overline" tone="muted">Rangsangan</DsHeading>
          <DsText
            variant="body"
            tone="highlighted"
            wrap="anywhere"
            data-testid="structured-stimulus"
          >
            {{ detail.stimulus }}
          </DsText>
          <DsArt3D
            v-if="figure"
            variant="plain"
            :src="figure"
            alt="Rajah rangsangan"
            data-testid="structured-stimulus-image"
          />
        </DsStack>
      </DsPanel>
    </DsStack>
  </DsPanel>

  <DsHeading :level="2" variant="subheading" data-testid="structured-subs-heading">
    Sub-Soalan ({{ detail.subQuestions.length }})
  </DsHeading>

  <DsPanel v-for="(sub, i) in detail.subQuestions" :key="i" data-testid="structured-sub">
    <DsStack gap="sm">
      <DsCluster justify="between" align="start" :wrap="false">
        <DsText variant="body" tone="highlighted" wrap="anywhere">
          <DsText variant="body-strong" as="span" data-testid="structured-sub-label"
            >({{ sub.partLabel.toLowerCase() }})</DsText
          >
          {{ sub.questionText }} [{{ sub.marks }} markah]
        </DsText>
        <DsBadge tone="neutral" :label="`${sub.marks}m`" data-testid="structured-sub-marks" />
      </DsCluster>
      <DsPanel padding="sm">
        <DsStack gap="xs">
          <DsHeading :level="3" variant="overline" tone="muted">Skema Jawapan</DsHeading>
          <DsText variant="body" tone="default" wrap="anywhere">{{ sub.modelAnswer }}</DsText>
        </DsStack>
      </DsPanel>
    </DsStack>
  </DsPanel>
</template>
