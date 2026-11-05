<script setup lang="ts">
/**
 * A link that degrades to a plain box: `to` is `null` when a page switches its detail links off
 * (`detailLinks: false`) and the element is then rendered without a link. Every shipped mount (admin, guru and
 * the school administrator's, FR-AS-11-1) has its detail links on.
 */
import { RouterLink } from 'vue-router'

defineProps<{ to: string | null; tag?: 'div' | 'span' }>()
</script>

<template>
  <RouterLink v-if="to !== null" :to="to"><slot /></RouterLink>
  <component :is="tag ?? 'div'" v-else><slot /></component>
</template>
