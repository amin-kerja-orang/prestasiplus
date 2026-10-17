<script setup lang="ts">
/** Native radio (arrow keys work). The look of a card radio is the caller's label. */
defineOptions({ inheritAttrs: false })
const model = defineModel<unknown>()
</script>

<template>
  <input v-model="model" v-bind="$attrs" type="radio" class="size-5 shrink-0 accent-primary" />
</template>
