<script setup lang="ts">
/**
 * One GPS value of the Trend GPS table (BR-M12-20): success at <= 4.00, warning above, "-" dimmed when the year
 * has no value. Shared by the table cell and the card below md, so both draw the same element.
 */
import { gpsText } from './results-format'

defineProps<{ value: number | null; text: string }>()
</script>

<template>
  <span
    :class="['text-label', value === null ? 'text-dimmed' : gpsText(value)]"
    data-testid="res-trend-cell"
    >{{ text }}</span
  >
</template>
