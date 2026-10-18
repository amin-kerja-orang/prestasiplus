<script setup lang="ts">
/**
 * PHASE 1: fold into DsPanel / DsFormSection surface; no canonical yet (docs/design/v2-ds-consolidation.md). Interim kit for the M02/M22/M03
 * admin revamp; do not build new screens on it.
 */
/**
 * A raised surface for admin page blocks (summary, notes, aside, filters, bulk bar): lg radius, card
 * shadow, 16/24px padding. Pages cannot decide radius, shadow or z-index, so they compose this. `as`
 * renders it as a `section` (default), `form`, `nav`, `aside` or `div`; `flush` removes the padding (the
 * page then sets its own); `tone="elevated"` is the second surface layer; `sticky` pins it to the top.
 */
withDefaults(
  defineProps<{
    as?: string
    flush?: boolean
    tone?: 'default' | 'elevated'
    sticky?: boolean
  }>(),
  { as: 'section', flush: false, tone: 'default', sticky: false },
)
</script>

<template>
  <component
    :is="as"
    class="min-w-0 rounded-lg shadow-card"
    :class="[
      tone === 'elevated' ? 'bg-elevated' : 'bg-default',
      flush ? '' : 'p-4 md:p-6',
      sticky ? 'sticky top-2 z-10' : '',
    ]"
    data-ds="admin-card"
  >
    <slot />
  </component>
</template>
