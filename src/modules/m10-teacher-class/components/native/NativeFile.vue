<script setup lang="ts">
/** Native file input (browser file dialog, `required`, `accept`); `hidden` makes it screen-reader only. */
import { ref } from 'vue'

defineProps<{ hidden?: boolean }>()
const el = ref<HTMLInputElement | null>(null)
defineExpose({ el })
</script>

<template>
  <input
    ref="el"
    type="file"
    :class="
      hidden
        ? 'sr-only'
        : 'block min-h-11 w-full min-w-0 rounded-card bg-elevated p-2 text-body text-default'
    "
  />
</template>
