<script setup lang="ts">
/**
 * Page header: one `h1` (title), subtitle, optional back link, and the slots `leading`,
 * `breadcrumb`, `subtitle`, `actions` (right; wraps below the title on small screens, the primary
 * action last), `tabs` and `meta`. With `showTitle="auto"` the `h1` is left out when the shell
 * already prints the page title (see `shellTitle.ts`), so a page never has two.
 */
import { computed, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import DsBackLink from './DsBackLink.vue'
import { useShellPrintsTitle } from './shellTitle'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    backTo?: RouteLocationRaw
    backLabel?: string
    titleTestid?: string
    subtitleTestid?: string
    showTitle?: 'auto' | boolean
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    backTo: undefined,
    backLabel: dsCopy.back,
    titleTestid: undefined,
    subtitleTestid: undefined,
    showTitle: 'auto',
  },
)

const slots = useSlots()
const shellPrints = useShellPrintsTitle()
const titleShown = computed(
  () => Boolean(props.title) && (props.showTitle === 'auto' ? !shellPrints : props.showTitle),
)
const hasSubtitle = computed(() => Boolean(props.subtitle) || Boolean(slots.subtitle))
const hasAny = computed(
  () =>
    titleShown.value ||
    hasSubtitle.value ||
    props.backTo !== undefined ||
    Boolean(slots.leading ?? slots.breadcrumb ?? slots.actions ?? slots.tabs ?? slots.meta),
)
</script>

<template>
  <header v-if="hasAny" class="flex min-w-0 flex-col gap-3" data-ds="page-header">
    <slot name="breadcrumb" />
    <DsBackLink v-if="backTo !== undefined" :to="backTo" :label="backLabel" />
    <div
      v-if="titleShown || hasSubtitle || $slots.leading || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 staff:items-center"
    >
      <div class="flex min-w-0 items-start gap-3 staff:items-center staff:gap-4">
        <slot name="leading" />
        <div class="flex min-w-0 flex-col gap-1 staff:gap-0.5">
          <h1
            v-if="titleShown"
            class="font-display text-title font-extrabold text-highlighted"
            data-ds="page-title"
            :data-testid="titleTestid"
          >
            {{ title }}
          </h1>
          <div v-if="hasSubtitle" class="max-w-prose text-body text-muted" :data-testid="subtitleTestid">
            <slot name="subtitle">{{ subtitle }}</slot>
          </div>
          <div v-if="$slots.meta" class="flex flex-wrap items-center gap-2 pt-1">
            <slot name="meta" />
          </div>
        </div>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 staff:ms-auto staff:gap-3">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="$slots.meta && !(titleShown || hasSubtitle || $slots.leading || $slots.actions)" class="flex flex-wrap items-center gap-2">
      <slot name="meta" />
    </div>
    <div v-if="$slots.tabs" class="min-w-0 pt-1">
      <slot name="tabs" />
    </div>
  </header>
</template>
