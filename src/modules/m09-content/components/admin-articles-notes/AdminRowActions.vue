<script setup lang="ts">
/**
 * Row actions of S1 and S5 (FR-M09-08, FR-M09-09, FR-M09-45): `fa-eye` "Lihat", `fa-edit` "Edit",
 * `fa-trash` "Padam". The delete button only emits; the page owns the confirm and the request.
 * Hit area 44 px below `lg`.
 */
import { Eye, SquarePen, Trash } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { ICON_BUTTON_CLASS } from '../../lib/admin-articles-notes'

defineProps<{ viewTo: string; editTo: string; busy?: boolean }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <RouterLink
      :to="viewTo"
      title="Lihat"
      :class="[ICON_BUTTON_CLASS, 'text-blue-600 hover:bg-blue-50']"
      data-testid="row-view"
    >
      <Eye class="h-4 w-4" aria-hidden="true" />
    </RouterLink>
    <RouterLink
      :to="editTo"
      title="Edit"
      :class="[ICON_BUTTON_CLASS, 'text-indigo-600 hover:bg-indigo-50']"
      data-testid="row-edit"
    >
      <SquarePen class="h-4 w-4" aria-hidden="true" />
    </RouterLink>
    <button
      type="button"
      title="Padam"
      :disabled="busy"
      :class="[ICON_BUTTON_CLASS, 'text-red-600 hover:bg-red-50 disabled:opacity-60']"
      data-testid="row-delete"
      @click="$emit('remove')"
    >
      <Trash class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>
