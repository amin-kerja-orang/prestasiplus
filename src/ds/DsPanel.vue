<script setup lang="ts">
/**
 * Raised panel of the admin pattern (`docs/design/v2-admin-pages.md`), built on `DsSurface`: the
 * surface that holds a toolbar, a table or a summary on the page layer. `padding="none"` (or the
 * deprecated `flush`) drops the padding (tables go edge to edge); `behavior` is the positional part
 * (`bulk` / `bar` sticky bars, `float` result list). `title` (with optional `description` / `icon`)
 * and the `actions` slot print the standard panel header.
 *
 * Deprecated aliases, kept for one release: `tone` (`raised` | `inset` | `tint` set the layer;
 * `bulk` | `bar` | `float` mean `behavior`) and `flush` (= `padding="none"`).
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import DsHeading from './DsHeading.vue'
import DsIconChip from './DsIconChip.vue'
import DsSurface from './DsSurface.vue'
import DsText from './DsText.vue'
import type { DsAccent, DsPadding } from './types'

const props = withDefaults(
  defineProps<{
    /** @deprecated Use `behavior` (bulk, bar, float) and the surface layers. */
    tone?: 'raised' | 'bulk' | 'bar' | 'inset' | 'tint' | 'float'
    /** Positional behaviour: `bulk` = sticky selection bar; `bar` = sticky bottom action bar; `float` = floating result list under a search field. */
    behavior?: 'static' | 'bulk' | 'bar' | 'float'
    /** Root element (`div`, `form`, `section`, `nav`...). */
    as?: 'div' | 'section' | 'article' | 'aside' | 'li' | 'form' | 'nav' | 'header' | 'footer' | 'ul' | 'ol'
    padding?: DsPadding
    /** @deprecated Use `padding="none"`. */
    flush?: boolean
    /** Sticky positioning of the `bulk` and `bar` behaviours. */
    sticky?: boolean
    title?: string
    description?: string
    /** Phosphor icon class for the header chip. */
    icon?: string
    accent?: DsAccent
    /** Header link to the full list ("Lihat Semua"). */
    moreTo?: RouteLocationRaw
    moreLabel?: string
    /** Fills the height of its grid cell, so the panels of one row share a bottom edge. */
    stretch?: boolean
  }>(),
  {
    tone: 'raised',
    behavior: undefined,
    as: 'div',
    padding: undefined,
    flush: false,
    sticky: true,
    title: undefined,
    description: undefined,
    icon: undefined,
    accent: 'action',
    moreTo: undefined,
    moreLabel: dsCopy.viewAll,
    stretch: false,
  },
)

const behavior = computed<'static' | 'bulk' | 'bar' | 'float'>(() => {
  if (props.behavior) return props.behavior
  return props.tone === 'bulk' || props.tone === 'bar' || props.tone === 'float' ? props.tone : 'static'
})
const bar = computed(() => behavior.value === 'bulk' || behavior.value === 'bar')
const hasHeader = computed(() => Boolean(props.title))
</script>

<template>
  <DsSurface
    :as="as"
    :level="bar || tone === 'inset' ? 'elevated' : 'raised'"
    :tone="tone === 'tint' ? 'primary' : 'neutral'"
    :shadow="bar || behavior === 'float' ? 'lift' : tone === 'inset' ? 'none' : 'auto'"
    :padding="
      flush || padding === 'none' || behavior === 'float' || hasHeader || $slots.actions || moreTo
        ? 'none'
        : (padding ?? 'md')
    "
    :clip="behavior !== 'float'"
    :class="[
      stretch ? 'h-full' : '',
      behavior === 'float' ? 'absolute z-20 mt-1 max-h-64 w-full overflow-y-auto' : '',
      sticky && behavior === 'bulk' ? 'sticky top-2 z-20' : '',
      sticky && behavior === 'bar' ? 'sticky bottom-2 z-20' : '',
    ]"
    :data-tone="tone"
    :data-behavior="behavior"
    data-ds="panel"
  >
    <header
      v-if="hasHeader || $slots.actions || moreTo"
      class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-4 sm:flex-nowrap sm:p-5"
      data-ds="panel-header"
    >
      <div v-if="title" class="flex min-w-0 grow basis-32 items-center gap-3 sm:basis-0">
        <DsIconChip v-if="icon" :icon="icon" :accent="accent" size="sm" />
        <div class="min-w-0">
          <DsHeading :level="2" variant="subheading">{{ title }}</DsHeading>
          <DsText v-if="description" variant="caption" tone="muted">{{ description }}</DsText>
        </div>
      </div>
      <div v-if="$slots.actions || moreTo" class="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        <slot name="actions" />
        <UButton
          v-if="moreTo"
          :to="moreTo"
          color="primary"
          variant="link"
          trailing-icon="i-ph-arrow-right"
          :label="moreLabel"
          :aria-label="title ? `${moreLabel} ${title}` : undefined"
          class="min-h-11"
          data-ds="panel-more"
        />
      </div>
    </header>
    <div
      :class="
        !flush && padding !== 'none' && behavior !== 'float' && (hasHeader || $slots.actions || moreTo)
          ? 'px-4 pb-4 sm:px-5 sm:pb-5'
          : ''
      "
    >
      <slot />
    </div>
  </DsSurface>
</template>
