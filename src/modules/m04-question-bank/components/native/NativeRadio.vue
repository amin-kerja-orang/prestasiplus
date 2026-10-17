<script setup lang="ts">
/** Native radio for the answer rows (value kept as a number / string; browser group + keyboard). */
defineProps<{ value: string | number | boolean }>()
const model = defineModel<unknown>({ required: true })
</script>

<template>
  <input v-model="model" type="radio" :value="value" class="size-5" />
</template>
