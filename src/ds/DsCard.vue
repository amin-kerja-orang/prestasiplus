<script setup lang="ts">
/**
 * `UCard` with a typed body padding (v2-ds-hardening gap close): replaces the page-level
 * `:ui="{ body: 'p-3 sm:p-3' }"` overrides. Everything else (`variant`, `color`, slots `header`,
 * `default`, `footer`, attributes) is passed straight to `UCard`. `ui` stays available for layout
 * utilities of the body (`flex`, `gap-*`); the padding comes from `padding`.
 */
import { computed } from 'vue'

import { cardBodyPadding } from './layout'
import type { DsCardPadding } from './types'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Body padding at every width: `none` p-0, `sm` p-3, `md` p-4. Omit for the theme default (p-4, p-5 from sm). */
    padding?: DsCardPadding
    ui?: Record<string, string | undefined>
  }>(),
  { padding: undefined, ui: undefined },
)

const mergedUi = computed(() => {
  if (!props.padding) return props.ui
  const body = [cardBodyPadding[props.padding], props.ui?.body].filter(Boolean).join(' ')
  return { ...props.ui, body }
})
</script>

<template>
  <UCard v-bind="$attrs" :ui="mergedUi" data-ds="card" :data-padding="padding">
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </UCard>
</template>
