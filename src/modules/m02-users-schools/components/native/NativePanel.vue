<script setup lang="ts">
/**
 * A rounded surface for sub-sections inside a card (chosen-school chip, generated credentials, linked
 * child chip, package block). Tone is a layer, never a line. Outside the strict globs because it owns the
 * radius.
 */
withDefaults(
  defineProps<{
    as?: string
    tone?: 'elevated' | 'soft' | 'primary'
  }>(),
  { as: 'div', tone: 'elevated' },
)
</script>

<template>
  <component
    :is="as"
    class="min-w-0 rounded-card p-3"
    :class="{
      'bg-elevated': tone === 'elevated',
      'bg-muted': tone === 'soft',
      'bg-primary/10': tone === 'primary',
    }"
  >
    <slot />
  </component>
</template>
