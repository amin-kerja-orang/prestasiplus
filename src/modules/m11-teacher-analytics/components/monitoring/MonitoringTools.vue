<script setup lang="ts">
/**
 * S2 header actions: PDF / CSV export, Refresh and the auto-refresh countdown (FN-M11-3.2.3..3.2.5;
 * FR-M11-32..34). "Refresh" is a submit button of the filter form (`form` attribute), as on live.
 */
import type { MonitoringFilterQuery, MonitoringPaths } from './monitoring-paths'

defineProps<{
  query: MonitoringFilterQuery
  paths: MonitoringPaths
  refreshDisplay: string
  refreshRunning: boolean
  formId: string
}>()

const emit = defineEmits<{ export: [format: 'pdf' | 'csv']; toggle: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3" data-testid="mon-tools">
    <p class="flex items-center gap-2 text-body text-muted" data-testid="mon-auto-refresh">
      <UIcon name="i-ph-clock" class="size-5" />
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
        size="md"
        :icon="refreshRunning ? 'i-ph-pause' : 'i-ph-play'"
        :aria-label="refreshRunning ? 'Jeda auto-refresh' : 'Sambung auto-refresh'"
        :data-icon="refreshRunning ? 'pause' : 'play'"
        data-testid="mon-refresh-toggle"
        @click="emit('toggle')"
      />
    </p>
    <UButton
      type="submit"
      name="refresh"
      :form="formId"
      color="neutral"
      variant="soft"
      size="md"
      icon="i-ph-arrows-clockwise"
      label="Refresh"
      data-testid="mon-refresh"
    />
    <UButton
      :href="paths.exportHref('pdf', query)"
      color="neutral"
      variant="soft"
      size="md"
      icon="i-ph-file-pdf"
      label="PDF"
      data-testid="mon-export-pdf"
      @click.prevent="emit('export', 'pdf')"
    />
    <UButton
      :href="paths.exportHref('csv', query)"
      color="primary"
      size="md"
      icon="i-ph-file-csv"
      label="CSV"
      data-testid="mon-export-csv"
      @click.prevent="emit('export', 'csv')"
    />
  </div>
</template>
