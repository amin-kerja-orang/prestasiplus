<script setup lang="ts">
/**
 * Exclusion marker for a paper preview / builder row (AC-05.4): the red chip "Tidak disajikan"
 * (verbatim .cloud) and, on the next line, "Tidak dihidangkan kerana {sebab}.". `compact` = chip only
 * (bank browser cards). Presentational.
 */
import { notServedLine, qdCopy } from './copy'

withDefaults(defineProps<{ reason?: string; compact?: boolean }>(), {
  reason: undefined,
  compact: false,
})
</script>

<template>
  <div class="flex flex-col items-start gap-1" data-testid="not-served">
    <UBadge color="error" variant="subtle" class="gap-1" data-testid="not-served-chip">
      <UIcon name="i-ph-prohibit" class="size-4" aria-hidden="true" />
      {{ qdCopy.notServed }}
    </UBadge>
    <p v-if="reason && !compact" class="text-caption text-error" data-testid="not-served-reason">
      {{ notServedLine(reason.replace(/\.$/, '')) }}
    </p>
  </div>
</template>
