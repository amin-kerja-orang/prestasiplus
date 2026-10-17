<script setup lang="ts">
/**
 * Breadcrumb of S3-S5 (FR-M11-03, FN-M11-1.1.3): "Monitoring" / "{sekolah}" (S4/S5: a link to S3) /
 * "{nama}". On live it sits under the admin header; here it is the first line of the page (the school
 * admin's user shell has no breadcrumb slot).
 */
import type { MonitoringPaths } from './monitoring-paths'

defineProps<{
  paths: MonitoringPaths
  /** The school name; empty while loading. */
  school: string
  /** Set on S4/S5: the school crumb becomes a link to S3. */
  schoolId?: number
  /** The person (S4/S5). */
  person?: string
}>()
</script>

<template>
  <nav
    class="flex min-w-0 flex-wrap items-center gap-1 text-caption text-muted"
    aria-label="Breadcrumb"
    data-testid="mon-crumbs"
  >
    <UButton
      :to="paths.overview"
      color="neutral"
      variant="ghost"
      size="lg"
      icon="i-ph-arrow-left"
      label="Monitoring"
      data-testid="mon-crumb-monitoring"
    />
    <template v-if="school">
      <span aria-hidden="true">/</span>
      <UButton
        v-if="schoolId !== undefined && person !== undefined"
        :to="paths.school(schoolId)"
        color="neutral"
        variant="ghost"
        size="lg"
        class="min-w-0 break-words whitespace-normal"
        :label="school"
        data-testid="mon-crumb-school"
      />
      <span v-else class="min-w-0 break-words text-default" data-testid="mon-crumb-school">{{
        school
      }}</span>
    </template>
    <template v-if="person">
      <span aria-hidden="true">/</span>
      <span class="min-w-0 break-words text-default" data-testid="mon-crumb-person">{{
        person
      }}</span>
    </template>
  </nav>
</template>
