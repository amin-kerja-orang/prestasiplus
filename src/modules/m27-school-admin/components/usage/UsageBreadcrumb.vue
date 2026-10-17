<script setup lang="ts">
/**
 * S1 breadcrumb (FR-M27-44, DV-M27-22): "← Dashboard Sekolah" (link to `/admin-sekolah`), a separator and the
 * screen title as a non-link.
 */
import ReportCrumb from '../shared/ReportCrumb.vue'
import { DASHBOARD_PATH } from './usage-format'

defineProps<{ title: string }>()
</script>

<template>
  <ReportCrumb
    prefix="su"
    back-label="← Dashboard Sekolah"
    :back-to="DASHBOARD_PATH"
    :title="title"
  />
</template>
