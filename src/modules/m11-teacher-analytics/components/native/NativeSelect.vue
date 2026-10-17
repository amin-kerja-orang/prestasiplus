<script setup lang="ts">
/**
 * Native `<select>` for the M11 filter forms. Kept native on purpose: the live forms submit an empty
 * "Semua ..." option and tests drive `change`. Lives outside the strict globs for that reason (same
 * approach as M10 `NativeSelect`).
 */
defineProps<{ modelValue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <select
    :value="modelValue"
    class="min-h-11 w-full min-w-0 rounded-card bg-elevated px-3 text-body text-default"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <slot />
  </select>
</template>
