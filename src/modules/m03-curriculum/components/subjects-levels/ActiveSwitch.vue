<script setup lang="ts">
/**
 * The "Aktif?" switch of S6 and S9 (FR-42, FR-59): a `USwitch`, on = success. Presentational: it only
 * emits `toggle`; the page flips the value at once, calls the API and reverts on failure. The 44 px hit
 * area wraps the switch.
 */
defineOptions({ inheritAttrs: false })
defineProps<{ active: boolean; label?: string }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <span class="inline-flex min-h-11 min-w-11 items-center justify-center">
    <USwitch
      v-bind="$attrs"
      :model-value="active"
      :aria-label="label ?? 'Aktif'"
      color="success"
      @update:model-value="$emit('toggle')"
    />
  </span>
</template>
