<script setup lang="ts">
/**
 * Raised panel of the admin pattern (`docs/design/v2-admin-pages.md`), built on `DsSurface`: the
 * surface that holds a toolbar, a table or a summary on the page layer. `padding="none"` (or the
 * deprecated `flush`) drops the padding (tables go edge to edge); `behavior` is the positional part
 * (`bulk` / `bar` sticky bars, `float` result list). `title` (with optional `description` / `icon`)
 * and the `actions` slot print the standard panel header.
 *
 * `level` is the surface layer: `raised` (default), `inset` (sunken block) or `tint` (primary soft
 * tint).
 *
 * Deprecated aliases, kept for one release: `tone` (`inset` | `tint` mean `level`;
 * `bulk` | `bar` | `float` mean `behavior`) and `flush` (= `padding="none"`).
 */
import { computed } from 'vue'

import DsHeading from './DsHeading.vue'
import DsIconChip from './DsIconChip.vue'
import DsSurface from './DsSurface.vue'
import type { DsAccent, DsPadding } from './types'

const props = withDefaults(
  defineProps<{
    /** @deprecated Use `behavior` (bulk, bar, float) and the surface layers. */
    tone?: 'raised' | 'bulk' | 'bar' | 'inset' | 'tint' | 'float'
    /** Positional behaviour: `bulk` = sticky selection bar; `bar` = sticky bottom action bar; `float` = floating result list under a search field. */
    /** Surface layer: raised card, inset (sunken) block, or primary-tinted block. */
    level?: 'raised' | 'inset' | 'tint'
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
  },
)

const behavior = computed<'static' | 'bulk' | 'bar' | 'float'>(() => {
  if (props.behavior) return props.behavior
  return props.tone === 'bulk' || props.tone === 'bar' || props.tone === 'float' ? props.tone : 'static'
})
const layer = computed<'raised' | 'inset' | 'tint'>(
  () => props.level ?? (props.tone === 'inset' || props.tone === 'tint' ? props.tone : 'raised'),
)
const bar = computed(() => behavior.value === 'bulk' || behavior.value === 'bar')
const hasHeader = computed(() => Boolean(props.title))
</script>

<template>
  <DsSurface
    :as="as"
    :level="bar || layer === 'inset' ? 'elevated' : 'raised'"
    :tone="layer === 'tint' ? 'primary' : 'neutral'"
    :shadow="bar || behavior === 'float' ? 'lift' : layer === 'inset' ? 'none' : 'auto'"
    :padding="
      flush || padding === 'none' || behavior === 'float' || hasHeader || $slots.actions
        ? 'none'
        : (padding ?? 'md')
    "
    :clip="behavior !== 'float'"
    :class="[
      behavior === 'float' ? 'absolute z-20 mt-1 max-h-64 w-full overflow-y-auto' : '',
      sticky && behavior === 'bulk' ? 'sticky top-2 z-20' : '',
      sticky && behavior === 'bar' ? 'sticky bottom-2 z-20' : '',
    ]"
    :data-tone="tone === 'raised' && layer !== 'raised' ? layer : tone"
    :data-behavior="behavior"
    data-ds="panel"
  >
    <header
      v-if="hasHeader || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"
      data-ds="panel-header"
    >
      <div v-if="title" class="flex min-w-0 items-center gap-3">
        <DsIconChip v-if="icon" :icon="icon" :accent="accent" size="sm" />
        <div class="min-w-0">
          <DsHeading :level="2" variant="subheading">{{ title }}</DsHeading>
          <p v-if="description" class="text-caption text-muted">{{ description }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div
      :class="
        !flush && padding !== 'none' && behavior !== 'float' && (hasHeader || $slots.actions)
          ? 'px-4 pb-4 sm:px-5 sm:pb-5'
          : ''
      "
    >
      <slot />
    </div>
  </DsSurface>
</template>
