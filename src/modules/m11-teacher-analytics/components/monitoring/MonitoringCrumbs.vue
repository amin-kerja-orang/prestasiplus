<script setup lang="ts">
/**
 * Breadcrumb of S3-S5 (FR-M11-03, FN-M11-1.1.3): "← Monitoring" / "{sekolah}" (S4/S5: a link to S3) /
 * "{nama}". On live it sits under the admin header; here it is the first line of the page (the school
 * admin's user shell has no breadcrumb slot).
 */
import { ArrowLeft } from '@lucide/vue'
import { RouterLink } from 'vue-router'

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
  <nav class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="mon-crumbs">
    <RouterLink
      :to="paths.overview"
      class="flex min-h-11 items-center gap-1 text-indigo-600 hover:underline lg:min-h-9"
      data-testid="mon-crumb-monitoring"
    >
      <ArrowLeft class="h-4 w-4" />Monitoring
    </RouterLink>
    <template v-if="school">
      <span class="text-slate-300">/</span>
      <RouterLink
        v-if="schoolId !== undefined && person !== undefined"
        :to="paths.school(schoolId)"
        class="min-w-0 break-words text-indigo-600 hover:underline"
        data-testid="mon-crumb-school"
        >{{ school }}</RouterLink
      >
      <span v-else class="min-w-0 break-words text-slate-500" data-testid="mon-crumb-school">{{
        school
      }}</span>
    </template>
    <template v-if="person">
      <span class="text-slate-300">/</span>
      <span class="min-w-0 break-words text-slate-500" data-testid="mon-crumb-person">{{
        person
      }}</span>
    </template>
  </nav>
</template>
