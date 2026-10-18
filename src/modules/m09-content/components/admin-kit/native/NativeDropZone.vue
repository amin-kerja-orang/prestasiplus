<script setup lang="ts">
/**
 * Drop zone over a native multi-file input: a click opens the browser dialog, a drop (or the dialog's
 * change) emits the picked files at once. The input stays in the DOM (`file-input`) so tests and keyboard
 * users work as-is.
 */
import { ref } from 'vue'

defineProps<{ accept?: string; name?: string }>()
const emit = defineEmits<{ files: [files: File[]] }>()
const dragging = ref(false)

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = input.files ? [...input.files] : []
  input.value = ''
  emit('files', picked)
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  emit('files', event.dataTransfer?.files ? [...event.dataTransfer.files] : [])
}
</script>

<template>
  <div>
    <label
      for="screenshot-input"
      class="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg px-4 py-8 text-center transition focus-within:outline-2 focus-within:outline-primary"
      :class="dragging ? 'bg-primary/10 text-primary' : 'bg-muted text-muted hover:bg-elevated'"
      data-testid="drop-zone"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <slot />
    </label>
    <input
      id="screenshot-input"
      type="file"
      :name="name"
      :accept="accept"
      multiple
      class="sr-only"
      data-testid="file-input"
      @change="onPick"
    />
  </div>
</template>
