<script setup lang="ts">
/**
 * Guest public layout (F-20; build-plan F-20, M09 SRS §2, FR-M09-29, FR-M09-31, FR-M09-39,
 * FR-M09-82). `LayoutHost` renders it for a `public-or-user` route when no one is logged in
 * (`/artikel`, `/artikel/:slug` provisional, `/video`); a logged-in user gets the user shell.
 *
 *   nav (top bar) │ div (page, no landmark) │ section (CTA) │ footer
 *
 * Landmarks are OBSERVED from the `guest__1280` inventory state (S15, S17): `nav`, `form`,
 * `section`, `footer` and the pager's `nav`; there is **no `<main>`**, so the page area is a plain
 * `div` (D10: replicate live accessibility). Copy and order are OBSERVED; the classes
 * (background, container, spacing) are INFERRED, as discovery captured no markup, styles or
 * screenshot of the guest layout.
 *
 * The page owns everything between the top bar and the CTA (hero, lists, pager). The section
 * (label, CTA copy) follows the route path (`publicSectionFor`). The guest tab title is not set
 * here: the router applies the route's `meta.guestTitle` when this layout is resolved
 * (`guards.ts`), so it is right on the first load before this lazy chunk arrives.
 */
import { DsConfirmHost } from '@/ds'
import { uiLocale } from '@/theme/locale-ms'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PublicCta from './PublicCta.vue'
import PublicFooter from './PublicFooter.vue'
import PublicTopBar from './PublicTopBar.vue'
import { publicSectionFor } from './public-sections'

const route = useRoute()

const section = computed(() => publicSectionFor(route.path))
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="flex min-h-screen flex-col bg-app-user font-body antialiased"
      data-layout="public"
      :data-section="section?.key"
    >
      <PublicTopBar :section="section" />

      <div
        :key="route.path"
        class="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-6 sm:py-8"
        data-testid="public-layout-main"
      >
        <slot />
      </div>

      <PublicCta v-if="section" :cta="section.cta" />

      <PublicFooter />
    </div>
    <DsConfirmHost />
  </UApp>
</template>
