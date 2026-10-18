<script setup lang="ts">
/**
 * Page root helper (restyle spec 1.2): content width by personality, standard gaps, and the page
 * header, which `DsPageHeader` renders (one `h1`, subtitle, back link and the header slots). Pages
 * that already get their title from the shell leave it to `showTitle="auto"`.
 */
import type { RouteLocationRaw } from 'vue-router'

import DsPageHeader from './DsPageHeader.vue'

withDefaults(
  defineProps<{
  title?: string
  subtitle?: string
  backTo?: RouteLocationRaw
  backLabel?: string
  showTitle?: 'auto' | boolean
  titleTestid?: string
  subtitleTestid?: string
}>(),
  { title: undefined, subtitle: undefined, backTo: undefined, backLabel: undefined, showTitle: 'auto', titleTestid: undefined, subtitleTestid: undefined },
)

const headerSlots = ['leading', 'breadcrumb', 'subtitle', 'actions', 'tabs', 'meta'] as const
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 md:gap-6 lg:gap-8 staff:max-w-none"
    data-ds="page"
  >
    <DsPageHeader
      :title="title"
      :subtitle="subtitle"
      :back-to="backTo"
      :back-label="backLabel"
      :show-title="showTitle"
      :title-testid="titleTestid"
      :subtitle-testid="subtitleTestid"
    >
      <template v-for="name in headerSlots.filter((n) => $slots[n])" :key="name" #[name]>
        <slot :name="name" />
      </template>
    </DsPageHeader>
    <slot />
  </div>
</template>
