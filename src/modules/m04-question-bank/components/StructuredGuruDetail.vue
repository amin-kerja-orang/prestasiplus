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
import {
  GURU_REJECTED_LABEL,
  GURU_STATUS_LABEL,
  guruRejectionLine,
} from '../lib/structured-options'

const props = defineProps<{ detail: GuruStructuredDetail }>()

const STATUS: Record<GuruStructuredDetail['status'], DsStatus> = {
  approved: 'approved',
  review: 'awaiting-review',
}
/** An own submission the admin returned: the chip reads "Ditolak" and the reason shows under it. */
const rejectionReason = computed(() => {
  const reason = props.detail.form?.rejectionReason?.trim()
  return props.detail.source === 'submission' && reason ? reason : null
})
const statusKey = computed<DsStatus>(() =>
  rejectionReason.value ? 'rejected' : STATUS[props.detail.status],
)
const statusLabel = computed(() =>
  rejectionReason.value
    ? GURU_REJECTED_LABEL
    : (GURU_STATUS_LABEL[props.detail.status] ?? props.detail.status),
)
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
          <DsBadge
            v-if="detail.kbat"
            tone="info"
            :label="detail.kbat"
            data-testid="structured-pill-kbat"
          />
          <DsBadge
            tone="success"
            :label="`${detail.totalMarks} markah`"
            data-testid="structured-pill-marks"
          />
        </DsCluster>
        <DsStatusBadge :status="statusKey" :label="statusLabel" data-testid="structured-status" />
      </DsCluster>

      <DsText
        v-if="rejectionReason"
        variant="body"
        tone="default"
        wrap="anywhere"
        data-testid="structured-rejection"
      >
        {{ guruRejectionLine(rejectionReason) }}
      </DsText>

      <DsPanel v-if="detail.stimulus || figure" padding="sm">
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
