<script setup lang="ts">
/** Native checkbox (the 44 px touch target comes from the wrapping label or cell). Supports an array v-model. */
defineOptions({ inheritAttrs: false })
const model = defineModel<unknown>()
</script>

<template>
  <input v-model="model" v-bind="$attrs" type="checkbox" class="size-5 shrink-0 accent-primary" />
</template>
