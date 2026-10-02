<script setup lang="ts">
/**
 * Global 404 page (M01 S10, FR-M01-50; build-plan F-21). Rendered by the catch-all route and by
 * the in-place 404 outcome in LayoutHost. The tab title comes from the router (`NOT_FOUND_TITLE`).
 *
 * Fidelity:
 * - Copy and links as live, except "Mula Latihan" → `/practice` (M01 DV-02; live `/latih-tubi`
 *   is itself a 404).
 * - Background: the `bg-error-page` token (blue-900 -> violet-600 -> pink-500, measured on live).
 *
 * `data-testid="app-placeholder"` is kept for the F-01 scaffold smoke (`e2e/global/smoke.spec.ts`,
 * owned by F-22) until F-22 asserts the real 404 copy; `data-page` is used by the F-13 tests.
 */
import ErrorPageLayout from './ErrorPageLayout.vue'
</script>

<template>
  <ErrorPageLayout
    data-page="not-found"
    data-testid="app-placeholder"
    code="404"
    emoji="🔍"
    heading="Halaman Tidak Dijumpai"
    message="Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?"
    :primary="{ label: 'Halaman Utama', to: '/' }"
    :secondary="{ label: 'Mula Latihan', to: '/practice' }"
    background-class="bg-error-page"
    primary-text-class="text-violet-600"
    message-width-class="max-w-md"
  />
</template>
