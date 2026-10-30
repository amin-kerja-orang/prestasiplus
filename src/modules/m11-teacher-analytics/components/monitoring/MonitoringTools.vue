<script setup lang="ts">
/**
 * S2 header actions: PDF / CSV export, Refresh and the auto-refresh countdown (FN-M11-3.2.3..3.2.5;
 * FR-M11-32..34). "Refresh" is a submit button of the filter form (`form` attribute), as on live. The
 * old system put PDF / CSV / Refresh on the filter row and the countdown beside the page subtitle.
 */
import type { MonitoringFilterQuery, MonitoringPaths } from './monitoring-paths'

defineProps<{
  /** `status` = the auto-refresh countdown (page subtitle line); `actions` = PDF / CSV / Refresh (filter card). */
  part: 'status' | 'actions'
  query: MonitoringFilterQuery
  paths: MonitoringPaths
  refreshDisplay: string
  refreshRunning: boolean
  formId: string
}>()

const emit = defineEmits<{ export: [format: 'pdf' | 'csv']; toggle: [] }>()
</script>

<template>
  <p
    v-if="part === 'status'"
    class="flex items-center gap-1 text-caption text-muted"
    data-testid="mon-auto-refresh"
  >
    <UIcon name="i-ph-clock" class="size-4" />
    <span
      >Auto-refresh dalam
      <span class="tabular text-highlighted" data-testid="mon-countdown">{{
        refreshDisplay
      }}</span></span
    >
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      size="sm"
      :icon="refreshRunning ? 'i-ph-pause' : 'i-ph-play'"
      :aria-label="refreshRunning ? 'Jeda auto-refresh' : 'Sambung auto-refresh'"
      :data-icon="refreshRunning ? 'pause' : 'play'"
      data-testid="mon-refresh-toggle"
      @click="emit('toggle')"
    />
  </p>
  <div v-else class="flex flex-wrap items-center gap-2" data-testid="mon-tools">
    <UButton
      :href="paths.exportHref('pdf', query)"
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-ph-file-pdf"
      label="PDF"
      data-testid="mon-export-pdf"
      @click.prevent="emit('export', 'pdf')"
    />
    <UButton
      :href="paths.exportHref('csv', query)"
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-ph-file-csv"
      label="CSV"
      data-testid="mon-export-csv"
      @click.prevent="emit('export', 'csv')"
    />
    <UButton
      type="submit"
      name="refresh"
      :form="formId"
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-ph-arrows-clockwise"
      label="Refresh"
      data-testid="mon-refresh"
    />
  </div>
</template>
