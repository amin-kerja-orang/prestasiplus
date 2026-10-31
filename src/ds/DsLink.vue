<script setup lang="ts">
/**
 * Text link (admin page templates 9): the link of a table cell or a list row, a school or pupil
 * name. A `RouterLink` in the primary text colour with an underline on hover and the focus ring of
 * the system; it keeps the 44px touch target through its padding. `clamp` limits a long name to
 * 1 to 3 lines. Pages use this instead of a raw anchor or a padded `UButton variant="link"`.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    to: RouteLocationRaw
    clamp?: 1 | 2 | 3
    /** Muted instead of primary (a row that has little to show). */
    muted?: boolean
  }>(),
  { clamp: 2, muted: false },
)

const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' } as const
const classes = computed(() => [
  'min-w-0 max-w-full break-words text-label hover:underline focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:py-2',
  CLAMP[props.clamp],
  props.muted ? 'text-muted' : 'text-primary-t',
])
</script>

<template>
  <RouterLink :to="to" :class="classes" data-ds="link"><slot /></RouterLink>
</template>
