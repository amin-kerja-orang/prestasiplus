<script setup lang="ts">
/**
 * Native file input hidden behind a label button (the browser file dialog, `accept`); the input stays in
 * the DOM so `change` and the test id work as-is. Pass `inputTestid` for the test id of the `<input>`.
 */
import { ref } from 'vue'

defineProps<{ accept?: string; name?: string; inputTestid?: string }>()
const emit = defineEmits<{ change: [event: Event] }>()
const el = ref<HTMLInputElement | null>(null)
defineExpose({ el })
</script>

<template>
  <label
    class="inline-flex min-h-11 cursor-pointer items-center rounded-card bg-primary px-4 py-2 text-label text-inverted hover:bg-primary/90 focus-within:outline-2 focus-within:outline-primary"
  >
    <slot />
    <input
      ref="el"
      type="file"
      class="sr-only"
      :accept="accept"
      :name="name"
      :data-testid="inputTestid"
      @change="emit('change', $event)"
    />
  </label>
</template>
