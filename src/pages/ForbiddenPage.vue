<script setup lang="ts">
/**
 * Global 403 page "Akses Ditolak" (M08 FN-M08-1.2.4 / FR-M08-08; build-plan F-21). Rendered in
 * place by LayoutHost when a guard decides `onForbidden: '403'`; the URL stays as typed. The tab
 * title comes from the router (`FORBIDDEN_TITLE`).
 *
 * Fidelity: same template as the 404 page, with the `bg-forbidden-page` token (red-800 -> red-600
 * -> orange-500, measured on live) and a red-600 primary pill text.
 */
import ErrorPageLayout from './ErrorPageLayout.vue'
</script>

<template>
  <ErrorPageLayout
    data-page="forbidden"
    code="403"
    emoji="🚫"
    heading="Akses Ditolak"
    message="Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir."
    :primary="{ label: 'Halaman Utama', to: '/' }"
    :secondary="{ label: 'Log Masuk', to: '/login' }"
    background-class="bg-forbidden-page"
    primary-text-class="text-red-600"
    message-width-class="max-w-lg"
  />
</template>
