<script setup lang="ts">
/**
 * Typography primitive (v2-ds-hardening 3.1): one `variant` = one type role from the strict scale,
 * `tone` = a text colour role. Pages never write `text-*`, `font-*` or `truncate` themselves.
 * The prop is `variant`, not `role`, so ARIA `role="status"` still falls through to the element.
 */
import { computed, watchEffect } from 'vue'

import type { DsTextRole, DsTextTone } from './types'

type TextTag =
  | 'p' | 'span' | 'div' | 'label' | 'legend' | 'dt' | 'dd' | 'li'
  | 'strong' | 'em' | 'small' | 'time' | 'figcaption'

const props = withDefaults(
  defineProps<{
    variant: DsTextRole
    as?: TextTag
    tone?: DsTextTone
    align?: 'start' | 'center' | 'end'
    truncate?: boolean
    clamp?: 1 | 2 | 3 | 4 | 5 | 6
    wrap?: 'normal' | 'balance' | 'anywhere'
    tabular?: boolean
    prose?: boolean
    srOnly?: boolean
    /** Only with `as="label"`. */
    for?: string
  }>(),
  {
    as: undefined,
    tone: undefined,
    align: undefined,
    truncate: false,
    clamp: undefined,
    wrap: 'normal',
    tabular: undefined,
    prose: false,
    srOnly: false,
    for: undefined,
  },
)

const VARIANT: Record<DsTextRole, { cls: string; tone: DsTextTone; tag: TextTag; tabular: boolean }> = {
  display: { cls: 'font-display text-display', tone: 'highlighted', tag: 'p', tabular: false },
  title: { cls: 'font-display text-title', tone: 'highlighted', tag: 'p', tabular: false },
  heading: { cls: 'font-display text-heading', tone: 'highlighted', tag: 'p', tabular: false },
  subheading: { cls: 'font-display text-subheading', tone: 'highlighted', tag: 'p', tabular: false },
  body: { cls: 'font-ui text-body', tone: 'default', tag: 'p', tabular: false },
  'body-strong': { cls: 'font-ui text-body font-semibold', tone: 'highlighted', tag: 'p', tabular: false },
  label: { cls: 'font-ui text-label', tone: 'default', tag: 'span', tabular: false },
  caption: { cls: 'font-ui text-caption', tone: 'muted', tag: 'p', tabular: false },
  meta: { cls: 'font-ui text-caption', tone: 'dimmed', tag: 'span', tabular: true },
  overline: { cls: 'font-ui text-overline uppercase', tone: 'muted', tag: 'span', tabular: false },
  kpi: { cls: 'font-display text-kpi', tone: 'highlighted', tag: 'span', tabular: true },
  // Token gap: no `text-kpi-lg` step yet; `text-display` is the closest.
  'kpi-lg': { cls: 'font-display text-display', tone: 'highlighted', tag: 'span', tabular: true },
}
const TONE: Record<DsTextTone, string> = {
  highlighted: 'text-highlighted',
  default: 'text-default',
  toned: 'text-toned',
  muted: 'text-muted',
  dimmed: 'text-dimmed',
  inverted: 'text-inverted',
  primary: 'text-primary-t',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
  'on-primary': 'text-inverted',
  'on-sem': 'text-on-sem',
}
const CLAMP = {
  1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3',
  4: 'line-clamp-4', 5: 'line-clamp-5', 6: 'line-clamp-6',
} as const
const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const
const WRAP = { normal: '', balance: 'text-balance', anywhere: 'break-words' } as const

watchEffect(() => {
  if (import.meta.env.DEV && props.truncate && props.clamp !== undefined) {
    console.warn('[DsText] `truncate` and `clamp` are mutually exclusive; clamp wins.')
  }
})

const tag = computed(() => props.as ?? VARIANT[props.variant].tag)
const classes = computed(() => {
  const v = VARIANT[props.variant]
  return [
    v.cls,
    TONE[props.tone ?? v.tone],
    props.align ? ALIGN[props.align] : '',
    props.clamp !== undefined ? CLAMP[props.clamp] : props.truncate ? 'truncate' : '',
    props.truncate || props.clamp !== undefined ? 'min-w-0' : '',
    WRAP[props.wrap],
    (props.tabular ?? v.tabular) ? 'tabular-nums' : '',
    props.prose ? 'max-w-prose' : '',
    props.srOnly ? 'sr-only' : '',
  ]
})
</script>

<template>
  <component
    :is="tag"
    :class="classes"
    :for="tag === 'label' ? props.for : undefined"
    data-ds="text"
    :data-variant="variant"
  >
    <slot />
  </component>
</template>
