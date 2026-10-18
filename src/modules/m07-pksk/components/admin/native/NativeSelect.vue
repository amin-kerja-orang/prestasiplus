<script setup lang="ts">
/**
 * Native `<select>` in the staff control look (12 px radius, 44 px tall). Kept native on purpose: an empty
 * "Pilih" option, browser `required` validation and options that reload under the user.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <select
    v-model="model"
    v-bind="$attrs"
    class="min-h-11 w-full min-w-0 rounded-md bg-elevated px-3 text-body text-default disabled:text-dimmed"
  >
    <slot />
  </select>
</template>
