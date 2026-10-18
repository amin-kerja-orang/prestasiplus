<script setup lang="ts">
/**
 * Page root contract (v2-ds-hardening R6, D-H12): `layout` is the page archetype and drives the
 * content width, the section gap and how the header sits; `width` overrides the archetype width
 * and `gap` the section gap. Pages never set `max-w-*` or `gap-*` on their root. The header is
 * rendered by `DsPageHeader` (one `h1`, subtitle, back link and the header slots); pages that
 * already get their title from the shell leave it to `showTitle="auto"`.
 *
 * Archetype defaults (width / header):
 * - `list`      wide     / actions beside the title, filter bar and table follow
 * - `form`      prose    / narrow column, title and back link above the form
 * - `report`    full     / title, then filters and figures across the full width
 * - `dashboard` wide     / title, then the KPI row and the 8/4 split
 * - `detail`    default  / back link, title and meta, then sections (the legacy default)
 * - `learner`   default  / the learner header; roomier section gap
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import DsPageHeader from './DsPageHeader.vue'
import { gapAll } from './layout'
import type { DsPageLayout, DsPageWidth, DsSpace } from './types'

const props = withDefaults(
  defineProps<{
    layout?: DsPageLayout
    width?: DsPageWidth
    gap?: DsSpace
    title?: string
    subtitle?: string
    backTo?: RouteLocationRaw
    backLabel?: string
    showTitle?: 'auto' | boolean
    titleTestid?: string
    subtitleTestid?: string
  }>(),
  {
    layout: 'detail',
    width: undefined,
    gap: 'section',
    title: undefined,
    subtitle: undefined,
    backTo: undefined,
    backLabel: undefined,
    showTitle: 'auto',
    titleTestid: undefined,
    subtitleTestid: undefined,
  },
)

const headerSlots = ['leading', 'breadcrumb', 'subtitle', 'actions', 'tabs', 'meta'] as const

const LAYOUT_WIDTH: Record<DsPageLayout, DsPageWidth> = {
  list: 'wide',
  form: 'prose',
  report: 'full',
  dashboard: 'wide',
  detail: 'default',
  learner: 'default',
}
const WIDTH: Record<DsPageWidth, string> = {
  prose: 'max-w-3xl',
  default: 'max-w-6xl staff:max-w-none',
  wide: 'max-w-7xl staff:max-w-none',
  full: 'max-w-none',
}
const rootClass = computed(() => [
  'mx-auto flex w-full min-w-0 flex-col',
  WIDTH[props.width ?? LAYOUT_WIDTH[props.layout]],
  gapAll[props.gap],
])
</script>

<template>
  <div :class="rootClass" data-ds="page" :data-layout="layout">
    <DsPageHeader
      :title="title"
      :subtitle="subtitle"
      :back-to="backTo"
      :back-label="backLabel"
      :show-title="showTitle"
      :stack-actions="layout === 'form'"
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
