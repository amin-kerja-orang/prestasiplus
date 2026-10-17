<script setup lang="ts">
/**
 * Native `<select>` in the staff form look. Kept native on purpose: an empty "-- Pilih --" option,
 * browser `required` validation and option lists that reload under the user (Nuxt UI `USelect`
 * cannot hold an empty value). Same approach as the M10 `components/native/NativeSelect.vue`.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <select
    v-model="model"
    v-bind="$attrs"
    class="min-h-11 w-full min-w-0 rounded-card bg-elevated px-3 text-body text-default disabled:text-dimmed"
  >
    <slot />
  </select>
</template>
