<script setup lang="ts">
/**
 * Global 403 page "Akses Ditolak" (M08 FN-M08-1.2.4 / FR-M08-08; build-plan F-21). Rendered in
 * place by LayoutHost when a guard decides `onForbidden: '403'`; the URL stays as typed. The tab
 * title comes from the router (`FORBIDDEN_TITLE`). v2: `DsErrorPage` (friend for the learner,
 * icon chip for staff).
 */
import GlobalErrorPage from './GlobalErrorPage.vue'
</script>

<template>
  <GlobalErrorPage
    data-page="forbidden"
    :code="403"
    heading="Akses Ditolak"
    message="Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir."
    :primary="{ label: 'Halaman Utama', to: '/' }"
    :secondary="{ label: 'Log Masuk', to: '/login' }"
  />
</template>
