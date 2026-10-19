<script setup lang="ts">
/** Grid child (v2-ds-hardening 3.5): `span` / `start` are responsive column placements. */
import { computed } from 'vue'

import { spanClasses, startClasses } from './layout'
import type { DsCols, DsResponsive } from './types'

const props = withDefaults(
  defineProps<{
    as?: 'div' | 'li' | 'article' | 'section'
    span?: DsCols | DsResponsive<DsCols>
    start?: DsResponsive<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12>
  }>(),
  { as: 'div', span: undefined, start: undefined },
)

const classes = computed(() => ['min-w-0', ...spanClasses(props.span), ...startClasses(props.start)])
</script>

<template>
  <component :is="as" :class="classes" data-ds-grid-item data-ds="grid-item"><slot /></component>
</template>
