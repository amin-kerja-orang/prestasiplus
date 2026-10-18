<script setup lang="ts">
/**
 * Neutral tag for a category, type or code in a table cell (design language 3, badges). Same pill
 * as the status badge but without an icon; the text is set in sentence case even when the stored
 * value is a raw code ("HERO" reads "Hero").
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ label: string; size?: 'sm' | 'md' }>(), { size: 'md' })
const text = computed(() => props.label.charAt(0).toUpperCase() + props.label.slice(1).toLowerCase())
</script>

<template>
  <UBadge color="neutral" variant="subtle" :size="size" class="whitespace-nowrap" data-ds="tag">
    {{ text }}
  </UBadge>
</template>
