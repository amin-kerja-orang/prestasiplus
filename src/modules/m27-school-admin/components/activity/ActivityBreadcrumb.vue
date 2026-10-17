<script setup lang="ts">
/**
 * S3 breadcrumb (FR-M27-66): "← Dashboard Sekolah" (link to `/admin-sekolah`), a separator and the screen
 * title as a non-link.
 */
import ReportCrumb from '../shared/ReportCrumb.vue'
import { DASHBOARD_PATH } from './activity-format'

defineProps<{ title: string }>()
</script>

<template>
  <ReportCrumb
    prefix="la"
    back-label="← Dashboard Sekolah"
    :back-to="DASHBOARD_PATH"
    :title="title"
  />
</template>
