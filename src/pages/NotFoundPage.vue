<script setup lang="ts">
/**
 * Global 404 page (M01 S10, FR-M01-50; build-plan F-21). Rendered by the catch-all route and by
 * the in-place 404 outcome in LayoutHost. The tab title comes from the router (`NOT_FOUND_TITLE`).
 *
 * Copy and links as live, except "Mula Latihan" → `/practice` (M01 DV-02; live `/latih-tubi`
 * is itself a 404). v2: `DsErrorPage` (friend for the learner, icon chip for staff).
 *
 * `data-testid="app-placeholder"` is kept for the F-01 scaffold smoke (`e2e/global/smoke.spec.ts`);
 * `data-page` is used by the tests.
 */
import GlobalErrorPage from './GlobalErrorPage.vue'
</script>

<template>
  <GlobalErrorPage
    data-page="not-found"
    data-testid="app-placeholder"
    :code="404"
    heading="Halaman Tidak Dijumpai"
    message="Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?"
    :primary="{ label: 'Halaman Utama', to: '/' }"
    :secondary="{ label: 'Mula Latihan', to: '/practice' }"
  />
</template>
