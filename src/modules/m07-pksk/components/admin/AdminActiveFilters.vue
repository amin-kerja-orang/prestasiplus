<script setup lang="ts">
/** Chips of the applied filters, each removable, and a reset link. Renders nothing without chips. */
defineProps<{ chips: readonly { key: string; label: string }[] }>()
defineEmits<{ remove: [key: string]; reset: [] }>()
</script>

<template>
  <div
    v-if="chips.length > 0"
    class="flex flex-wrap items-center gap-2"
    data-testid="active-filters"
  >
    <span class="text-caption text-muted">Penapis aktif:</span>
    <UButton
      v-for="c in chips"
      :key="c.key"
      type="button"
      color="neutral"
      variant="soft"
      size="md"
      trailing-icon="i-ph-x"
      :label="c.label"
      :aria-label="`Buang penapis ${c.label}`"
      data-testid="active-filter"
      @click="$emit('remove', c.key)"
    />
    <UButton
      type="button"
      color="neutral"
      variant="link"
      size="md"
      label="Set semula"
      data-testid="active-filters-reset"
      @click="$emit('reset')"
    />
  </div>
</template>
