<script setup lang="ts">
/**
 * Native file input hidden behind a label button (the browser file dialog, `accept`); the input stays in
 * the DOM so `change` and the test id work as-is. Pass `inputTestid` for the test id of the `<input>`.
 */
import { ref } from 'vue'

defineProps<{
  accept?: string
  name?: string
  id?: string
  multiple?: boolean
  inputTestid?: string
}>()
const emit = defineEmits<{ change: [event: Event] }>()
const el = ref<HTMLInputElement | null>(null)
defineExpose({ el })
</script>

<template>
  <label
    class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-elevated px-4 py-2 text-label text-default focus-within:outline-2 focus-within:outline-primary hover:bg-accented"
  >
    <slot />
    <input
      :id="id"
      ref="el"
      type="file"
      class="sr-only"
      :accept="accept"
      :name="name"
      :multiple="multiple"
      :data-testid="inputTestid"
      @change="emit('change', $event)"
    />
  </label>
</template>
