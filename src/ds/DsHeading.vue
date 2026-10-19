<script lang="ts">
/** Number of mounted level-1 headings (module scope: shared by all instances). */
let h1Count = 0
/** Test hook. */
export function __resetH1Count(): void {
  h1Count = 0
}
</script>

<script setup lang="ts">
/**
 * Semantic heading (v2-ds-hardening 3.2): `level` picks the element, `variant` the look (default
 * from the level). A second mounted `level=1` warns in dev (one h1 per page).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    level: 1 | 2 | 3 | 4 | 5 | 6
    variant?: 'display' | 'title' | 'heading' | 'subheading' | 'label' | 'overline'
    tone?: 'highlighted' | 'muted' | 'primary' | 'on-primary' | 'inverted'
    align?: 'start' | 'center' | 'end'
    truncate?: boolean
    clamp?: 1 | 2 | 3
    wrap?: 'normal' | 'balance' | 'anywhere'
    focusable?: boolean
  }>(),
  {
    variant: undefined,
    tone: 'highlighted',
    align: undefined,
    truncate: false,
    clamp: undefined,
    wrap: undefined,
    focusable: false,
  },
)

const LEVEL_VARIANT = { 1: 'title', 2: 'heading', 3: 'subheading', 4: 'label', 5: 'label', 6: 'label' } as const
const VARIANT = {
  display: 'font-display text-display',
  title: 'font-display text-title',
  heading: 'font-display text-heading',
  subheading: 'font-display text-subheading',
  label: 'font-ui text-label',
  overline: 'font-ui text-overline uppercase',
} as const
const TONE = {
  highlighted: 'text-highlighted',
  muted: 'text-muted',
  primary: 'text-primary-t',
  'on-primary': 'text-inverted',
  inverted: 'text-inverted',
} as const
const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' } as const
const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const
const WRAP = { normal: '', balance: 'text-balance', anywhere: 'break-words' } as const

const el = ref<HTMLElement | null>(null)
let counted = false
onMounted(() => {
  if (props.level !== 1) return
  counted = true
  h1Count += 1
  if (import.meta.env.DEV && h1Count > 1) {
    console.warn('[DsHeading] more than one level-1 heading is mounted; a page has exactly one h1.')
  }
})
onBeforeUnmount(() => {
  if (counted) h1Count -= 1
})

const classes = computed(() => [
  VARIANT[props.variant ?? LEVEL_VARIANT[props.level]],
  TONE[props.tone],
  props.align ? ALIGN[props.align] : '',
  props.clamp !== undefined ? CLAMP[props.clamp] : props.truncate ? 'truncate' : '',
  props.truncate || props.clamp !== undefined ? 'min-w-0' : '',
  WRAP[props.wrap ?? (props.level <= 2 ? 'balance' : 'normal')],
])

defineExpose({
  focus: () => {
    el.value?.focus()
  },
})
</script>

<template>
  <component
    :is="`h${level}`"
    ref="el"
    :class="classes"
    :tabindex="focusable ? -1 : undefined"
    data-ds="heading"
  >
    <slot />
  </component>
</template>
