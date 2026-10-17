<script setup lang="ts">
/**
 * Native `<select>` for the S22 cascade form. Kept native on purpose: browser `required`
 * validation, an empty "-- Pilih --" option and option lists that reload under the user (Nuxt UI
 * `USelect` cannot hold an empty value). Lives outside the strict globs for that reason.
 */
const model = defineModel<string>({ required: true })
</script>

<template>
  <select
    v-model="model"
    class="min-h-11 w-full min-w-0 rounded-card bg-elevated px-3 text-body text-default disabled:text-dimmed"
  >
    <slot />
  </select>
</template>
