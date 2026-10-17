<script setup lang="ts">
/**
 * A stat tile that is also a link (the S1 role cards). The active filter gets a primary frame (a layer,
 * not a line). Lives outside the strict globs because it decides radius and the frame colour.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{ to: RouteLocationRaw; active?: boolean }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="block min-w-0 rounded-card p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="active ? 'bg-primary' : 'bg-transparent'"
    :aria-current="active ? 'true' : undefined"
  >
    <slot />
  </RouterLink>
</template>
