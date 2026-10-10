<script setup lang="ts">
/**
 * "Tindakan" cell of an S6 / S7 row (FR-M27-92, 101). "Edit" (`fa-edit`, `title="Edit"`) shows for an active
 * account only. The default slot is where M27-T6 mounts the "Menyamar" button (FR-M27-121); T4 leaves it empty.
 */
import { SquarePen } from '@lucide/vue'
import { RouterLink } from 'vue-router'

defineProps<{ editTo: string; canEdit: boolean }>()
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5" data-testid="user-actions">
    <RouterLink
      v-if="canEdit"
      :to="editTo"
      title="Edit"
      class="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-indigo-100 px-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:min-h-8"
      data-testid="user-edit"
    >
      <SquarePen class="h-3.5 w-3.5" aria-hidden="true" />Edit
    </RouterLink>
    <slot />
  </div>
</template>
