<script setup lang="ts">
/** Native search input of the school page (kept native like `NativeSelect`; outside the strict globs). */
const model = defineModel<string>({ required: true })
</script>

<template>
  <input
    v-model="model"
    type="text"
    class="min-h-11 w-full min-w-0 rounded-card bg-elevated px-3 text-body text-default placeholder:text-dimmed"
  />
</template>
