<script setup lang="ts">
/**
 * Live `fa-spinner fa-spin` / `fa-circle-notch fa-spin` (F-15; design-system §3.4, §6.2).
 * Lucide `LoaderCircle` with `animate-spin`. Without `size` it is 1em square, like the inline
 * FA glyph; a size class from the caller (`w-5 h-5`) wins because CSS overrides SVG attributes.
 */
import { LoaderCircle } from '@lucide/vue'
import { computed } from 'vue'

const props = defineProps<{ size?: number }>()

// Lucide types `width`/`height` as numbers, but its SVG accepts any length ("1em").
const svgSize = computed((): Record<string, string | number> => {
  if (props.size === undefined) return { width: '1em', height: '1em' }
  return { size: props.size }
})
</script>

<template>
  <LoaderCircle v-bind="svgSize" class="animate-spin" />
</template>
