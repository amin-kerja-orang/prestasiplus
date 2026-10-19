<script lang="ts">
import type { InjectionKey } from 'vue'

/** Nesting depth of enclosing surfaces: drives `radius="auto"` (card -> chip -> xs). */
export const surfaceDepthKey: InjectionKey<number> = Symbol('ds-surface-depth')
</script>

<script setup lang="ts">
/**
 * Surface primitive (v2-ds-hardening 3.8): background layer, tint, padding, radius and shadow in
 * one place. `radius="auto"` steps down one level for each enclosing `DsSurface`, so a card never
 * holds another `rounded-card`. `interactive` + `to` / `href` / `type` renders a link or button.
 */
import { computed, inject, provide } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { paddingUtil } from './layout'
import type { DsPadding, DsSurfaceLevel, DsTone } from './types'

type SurfaceTag = 'div' | 'section' | 'article' | 'aside' | 'li' | 'form' | 'nav' | 'header' | 'footer' | 'ul' | 'ol'
type Radius = 'auto' | 'chip' | 'card' | 'sheet' | 'none'
type Shadow = 'auto' | 'none' | 'raised' | 'card' | 'lift' | 'modal'

const props = withDefaults(
  defineProps<{
    as?: SurfaceTag
    level?: DsSurfaceLevel
    tone?: DsTone
    emphasis?: 'soft' | 'strong'
    padding?: DsPadding
    radius?: Radius
    shadow?: Shadow
    interactive?: boolean
    to?: RouteLocationRaw
    href?: string
    type?: 'button' | 'submit'
    selected?: boolean
    disabled?: boolean
    loading?: boolean
    invalid?: boolean
    clip?: boolean
  }>(),
  {
    as: 'div',
    level: 'raised',
    tone: 'neutral',
    emphasis: 'soft',
    padding: 'md',
    radius: 'auto',
    shadow: 'auto',
    interactive: false,
    to: undefined,
    href: undefined,
    type: undefined,
    selected: false,
    disabled: false,
    loading: false,
    invalid: false,
    clip: true,
  },
)

const depth = inject(surfaceDepthKey, 0)
provide(surfaceDepthKey, depth + 1)

const LEVEL: Record<DsSurfaceLevel, string> = {
  raised: 'bg-default',
  elevated: 'bg-elevated',
  soft: 'bg-soft',
  accented: 'bg-accented',
  inverted: 'bg-inverted text-inverted',
}
const TINT_SOFT: Record<Exclude<DsTone, 'neutral'>, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  error: 'bg-error/10',
  info: 'bg-info/10',
}
const TINT_STRONG: Record<Exclude<DsTone, 'neutral'>, string> = {
  primary: 'bg-primary text-inverted',
  success: 'bg-success text-on-sem',
  warning: 'bg-warning text-on-sem',
  error: 'bg-error text-on-sem',
  info: 'bg-info text-on-sem',
}
const RADIUS = { chip: 'rounded-chip', card: 'rounded-card', sheet: 'rounded-sheet', none: 'rounded-none' } as const
const SHADOW = {
  none: '',
  raised: 'shadow-ds-xs',
  card: 'shadow-card',
  lift: 'shadow-lift',
  modal: 'shadow-modal',
} as const
const AUTO_SHADOW: Record<DsSurfaceLevel, keyof typeof SHADOW> = {
  raised: 'raised',
  elevated: 'none',
  soft: 'none',
  accented: 'none',
  inverted: 'none',
}

/** The resolved radius: 'auto' is `card` at top level, `chip` inside one surface, `rounded-xs` deeper. */
const radiusClass = computed(() => {
  if (props.radius !== 'auto') return RADIUS[props.radius]
  return depth === 0 ? RADIUS.card : depth === 1 ? RADIUS.chip : 'rounded-xs'
})

const tag = computed(() => {
  if (props.to !== undefined) return RouterLink
  if (props.href !== undefined) return 'a'
  if (props.type !== undefined) return 'button'
  return props.as
})

const bg = computed(() => {
  if (props.invalid) return 'bg-error/10'
  if (props.selected) return 'bg-primary/10'
  if (props.tone !== 'neutral') return props.emphasis === 'strong' ? TINT_STRONG[props.tone] : TINT_SOFT[props.tone]
  return LEVEL[props.level]
})

const classes = computed(() => [
  'min-w-0',
  bg.value,
  radiusClass.value,
  SHADOW[props.shadow === 'auto' ? AUTO_SHADOW[props.level] : props.shadow],
  paddingUtil[props.padding],
  props.clip ? 'overflow-clip' : '',
  props.interactive || props.to !== undefined
    ? 'cursor-pointer transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-primary'
    : '',
  props.tone === 'neutral' && props.level !== 'inverted' ? 'text-default' : '',
  props.type !== undefined || props.href !== undefined || props.to !== undefined ? 'block text-start' : '',
  props.disabled ? 'pointer-events-none opacity-50' : '',
])

const isLink = computed(() => props.to !== undefined || props.href !== undefined)
const ariaPressed = computed(() =>
  props.type !== undefined && props.interactive ? props.selected : undefined,
)
</script>

<template>
  <component
    :is="tag"
    :class="classes"
    :to="to"
    :href="href"
    :type="type"
    :aria-busy="loading || undefined"
    :aria-disabled="disabled || undefined"
    :aria-invalid="invalid || undefined"
    :aria-pressed="ariaPressed"
    :aria-current="isLink && selected ? 'true' : undefined"
    :disabled="type !== undefined && disabled ? true : undefined"
    data-ds="surface"
    :data-level="level"
    :data-state="
      disabled ? 'disabled' : loading ? 'loading' : invalid ? 'invalid' : selected ? 'selected' : undefined
    "
  >
    <slot v-if="loading && $slots.skeleton" name="skeleton" />
    <slot v-else />
  </component>
</template>
