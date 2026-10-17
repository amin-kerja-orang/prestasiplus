<script setup lang="ts">
/**
 * Native `<select>` for filters and forms whose first option is an empty value ("Semua",
 * "Tiada kelas"): Nuxt UI `USelect` cannot hold an empty value. Same wrapper as M10
 * `components/native/NativeSelect.vue`; lives outside the strict globs for that reason.
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
