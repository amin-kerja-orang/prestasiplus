<script setup lang="ts">
/**
 * Breadcrumb of the M27 report screens (restyle spec AS-46 drill crumb): "← <back label>" as a link, a
 * separator and the screen title as plain text. Test ids are `<prefix>-breadcrumb`, `<prefix>-crumb-back`
 * and `<prefix>-crumb-current`. `to` is left out when the back link is hidden by the prototype scope.
 */
import { RouterLink } from 'vue-router'

defineProps<{ prefix: string; backLabel: string; backTo?: string; title: string; hideBack?: boolean }>()
</script>

<template>
  <nav
    class="flex min-w-0 flex-wrap items-center gap-x-2 text-body"
    aria-label="Breadcrumb"
    :data-testid="`${prefix}-breadcrumb`"
  >
    <template v-if="!hideBack">
      <RouterLink
        :to="backTo ?? '/admin-sekolah'"
        class="inline-flex min-h-11 items-center gap-1 text-muted hover:text-highlighted"
        :data-testid="`${prefix}-crumb-back`"
        >{{ backLabel }}</RouterLink
      >
      <span class="text-dimmed" aria-hidden="true">/</span>
    </template>
    <span
      class="text-label text-highlighted"
      aria-current="page"
      :data-testid="`${prefix}-crumb-current`"
      >{{ title }}</span
    >
  </nav>
</template>
