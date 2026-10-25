<script setup lang="ts">
/**
 * AI badge on the label of a Tag DSKP field (design 3.6): "Cadangan AI · Keyakinan {tahap}" while the
 * suggestion waits (warning when the confidence is low), "Disahkan" once ticked. Icon and words, never
 * colour alone.
 */
import { computed } from 'vue'

import { CONFIDENCE_WORD, TAG_COPY } from '../domain/tag-view'
import type { AiFieldState } from '../domain/tag-view'

const props = defineProps<{ state: AiFieldState['badge'] }>()

const text = computed(() => {
  const s = props.state
  if (!s) return ''
  if (s.kind === 'confirmed') return TAG_COPY.aiConfirmed
  return s.confidence
    ? TAG_COPY.aiConfidence(CONFIDENCE_WORD[s.confidence as keyof typeof CONFIDENCE_WORD] ?? s.confidence)
    : TAG_COPY.aiSuggested
})
</script>

<template>
  <UBadge
    v-if="state?.kind === 'confirmed'"
    color="success"
    variant="subtle"
    size="sm"
    icon="i-ph-check-bold"
    data-testid="ai-badge"
  >
    {{ text }}
  </UBadge>
  <UBadge
    v-else-if="state"
    :color="state.warning ? 'warning' : 'info'"
    variant="subtle"
    size="sm"
    icon="i-ph-sparkle"
    data-testid="ai-badge"
  >
    {{ text }}
  </UBadge>
</template>
