<script setup lang="ts">
/**
 * Native `<select>` in the staff form look: delegates to `AdminSelect` (md radius, 44px height, chevron).
 * Kept native on purpose: an empty "-- Pilih --" option, browser `required` validation and option lists
 * that reload under the user (Nuxt UI `USelect` cannot hold an empty value).
 */
import AdminSelect from './AdminSelect.vue'

defineOptions({ inheritAttrs: false })
const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <AdminSelect v-model="model" v-bind="$attrs">
    <slot />
  </AdminSelect>
</template>
