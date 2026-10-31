<script setup lang="ts">
/**
 * Page header: one `h1` (title), subtitle, optional back link, and the slots `leading`,
 * `breadcrumb` (deprecated: the shell prints the crumbs), `subtitle`, `actions` (right from `sm`;
 * below `sm` they stack full width under the subtitle in source order, so the primary action,
 * written last, stays last), `tabs` and `meta` (every layout, `detail` included). With `showTitle="auto"` the `h1` is left out when the shell
 * already prints the page title (see `shellTitle.ts`), so a page never has two.
 */
import { computed, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import { warnDeprecated } from './deprecate'
import DsBackLink from './DsBackLink.vue'
import DsHeading from './DsHeading.vue'
import { useShellPrintsSubtitle, useShellPrintsTitle, useShellSubtitle } from './shellTitle'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    backTo?: RouteLocationRaw
    backLabel?: string
    titleTestid?: string
    subtitleTestid?: string
    showTitle?: 'auto' | boolean
    /** Actions sit under the title instead of beside it (the learner `form` archetype; staff keeps them on the right). */
    stackActions?: boolean
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    backTo: undefined,
    backLabel: dsCopy.back,
    titleTestid: undefined,
    subtitleTestid: undefined,
    showTitle: 'auto',
    stackActions: false,
  },
)

const slots = useSlots()
const shellPrints = useShellPrintsTitle()
if (slots.breadcrumb) warnDeprecated('DsPageHeader', '#breadcrumb', 'the shell breadcrumb')
const titleShown = computed(
  () => Boolean(props.title) && (props.showTitle === 'auto' ? !shellPrints : props.showTitle),
)
const hasSubtitle = computed(() => Boolean(props.subtitle) || Boolean(slots.subtitle))
// In the Pentadbiran shell a plain-text description moves up into the shell header (v1 pattern).
const lifted = useShellPrintsSubtitle() && !slots.subtitle
if (lifted) useShellSubtitle(() => props.subtitle)
const hasAny = computed(
  () =>
    titleShown.value ||
    (hasSubtitle.value && !lifted) ||
    props.backTo !== undefined ||
    Boolean(slots.leading ?? slots.breadcrumb ?? slots.actions ?? slots.tabs ?? slots.meta),
)
</script>

<template>
  <header v-if="hasAny" class="flex min-w-0 flex-col gap-3" data-ds="page-header">
    <span v-if="lifted && subtitle" hidden :data-testid="subtitleTestid">{{ subtitle }}</span>
    <slot name="breadcrumb" />
    <DsBackLink v-if="backTo !== undefined" :to="backTo" :label="backLabel" />
    <div
      v-if="titleShown || (hasSubtitle && !lifted) || $slots.leading || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 staff:items-center"
      :class="stackActions ? 'flex-col staff:flex-row' : ''"
    >
      <div class="flex min-w-0 items-start gap-3 staff:items-center staff:gap-4">
        <slot name="leading" />
        <div class="flex min-w-0 flex-col gap-1 staff:gap-0.5">
          <DsHeading
            v-if="titleShown"
            :level="1"
            variant="title"
            data-ds="page-title"
            :data-testid="titleTestid"
          >
            {{ title }}
          </DsHeading>
          <div v-if="hasSubtitle && !lifted" class="max-w-prose text-body text-muted" :data-testid="subtitleTestid">
            <slot name="subtitle">{{ subtitle }}</slot>
          </div>
          <div v-if="$slots.meta" class="flex flex-wrap items-center gap-2 pt-1">
            <slot name="meta" />
          </div>
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end staff:ms-auto staff:gap-3"
        data-ds="page-header-actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <div v-if="$slots.meta && !(titleShown || (hasSubtitle && !lifted) || $slots.leading || $slots.actions)" class="flex flex-wrap items-center gap-2">
      <slot name="meta" />
    </div>
    <div v-if="$slots.tabs" class="min-w-0 pt-1">
      <slot name="tabs" />
    </div>
  </header>
<!-- Lifted into the shell header: kept (hidden) for its test id, never printed twice. -->
  <span v-else-if="lifted && subtitle" hidden :data-testid="subtitleTestid">{{ subtitle }}</span>
</template>
