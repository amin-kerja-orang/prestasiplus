<script setup lang="ts">
/** Native colour picker (`<input type="color">`): the browser colour dialog; no Nuxt UI equivalent. */
const model = defineModel<string>({ required: true })
</script>

<template>
  <input
    v-model="model"
    type="color"
    class="h-11 w-14 shrink-0 cursor-pointer rounded-card bg-elevated p-1"
  />
</template>
