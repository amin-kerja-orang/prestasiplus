<script setup lang="ts">
/**
 * A fixed shell icon from its live Font Awesome class. Rendered as a Lucide `<svg class="pp-icon">`
 * sized `1em`, so the live font-size classes (`text-lg`, `text-xs`, ...) size it as they sized the
 * FA glyph, and `w-5`/`w-4` give the same fixed box. The caller passes the live class list.
 */
import { computed } from 'vue'

import { shellIcon } from './shell-icons'

const props = defineProps<{ fa: string }>()

const icon = computed(() => shellIcon(props.fa))
</script>

<template>
  <component :is="icon" v-if="icon" class="pp-icon" width="1em" height="1em" aria-hidden="true" />
</template>
