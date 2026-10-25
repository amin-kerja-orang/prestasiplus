<script setup lang="ts">
/**
 * The DSKP tag of a question as one wrapping badge row (UX spec 6.2 and 7.1): Unit, SP, TP, KBAT.
 * A flagged tag shows the warning badge instead of the unit and hides the SP; a T1-T3 question shows
 * the exempt copy and no SP. Used by the bank "Soalan" cell, the bank drawer and the review meta;
 * the default slot appends further badges (group, version) to the same row.
 */
import { computed } from 'vue'

import { DsCluster } from '@/ds'

import { KBAT_LABEL, REVIEW_TOPIC, spBadgeText, type TagBadgeData } from './dskp-filter'

const props = defineProps<{ tag: TagBadgeData }>()

const exempt = computed(() => props.tag.formOrigin === 'T1-T3')
const showSp = computed(() => !props.tag.tagReview && !exempt.value && props.tag.spCodes.length > 0)
</script>

<template>
  <DsCluster as="span" gap="2xs" align="start">
    <UBadge
      v-if="tag.tagReview"
      color="warning"
      variant="subtle"
      icon="i-ph-warning"
      class="max-w-full whitespace-normal"
      data-testid="tag-flag"
      >{{ REVIEW_TOPIC }}</UBadge
    >
    <UBadge
      v-else-if="tag.topic"
      color="neutral"
      variant="subtle"
      class="max-w-full whitespace-normal"
      data-testid="tag-unit"
      >{{ tag.topic }}</UBadge
    >
    <UBadge
      v-if="showSp"
      color="neutral"
      variant="subtle"
      class="max-w-full whitespace-normal"
      :title="tag.spCodes.join(', ')"
      data-testid="tag-sp"
      >{{ spBadgeText(tag.spCodes) }}</UBadge
    >
    <UBadge
      v-if="tag.tp !== null"
      color="neutral"
      variant="subtle"
      class="max-w-full whitespace-normal"
      data-testid="tag-tp"
      >TP {{ tag.tp }}</UBadge
    >
    <UBadge
      v-if="tag.kbat"
      color="neutral"
      variant="subtle"
      class="max-w-full whitespace-normal"
      data-testid="tag-kbat"
      >KBAT: {{ KBAT_LABEL[tag.kbat] }}</UBadge
    >
    <slot />
  </DsCluster>
</template>
