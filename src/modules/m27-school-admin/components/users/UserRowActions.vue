<script setup lang="ts">
/**
 * "Tindakan" cell of an S6 / S7 row (FR-M27-92, 101). "Edit" (`title="Edit"`) shows for an active
 * account only. The default slot is where the "Menyamar" button (FR-M27-121) mounts.
 */
defineProps<{ editTo: string; canEdit: boolean }>()
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="user-actions">
    <UButton
      v-if="canEdit"
      :to="editTo"
      title="Edit"
      color="neutral"
      variant="soft"
      size="lg"
      icon="i-ph-pencil-simple"
      class="min-h-11"
      data-testid="user-edit"
      >Edit</UButton
    >
    <slot />
  </div>
</template>
