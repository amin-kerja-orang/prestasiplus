<script setup lang="ts">
/** Pill switch over a native checkbox (keyboard and label work as-is). */
defineOptions({ inheritAttrs: false })
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <input v-model="model" v-bind="$attrs" type="checkbox" class="peer sr-only" />
    <span
      class="relative h-6 w-11 rounded-full bg-accented transition peer-checked:bg-success peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-default after:shadow-xs after:transition peer-checked:after:translate-x-5"
      aria-hidden="true"
    ></span>
  </span>
</template>
