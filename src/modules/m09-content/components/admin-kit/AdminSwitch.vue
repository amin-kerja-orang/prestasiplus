<script setup lang="ts">
/** A labelled on/off row over a native checkbox; the 44 px row is the touch target. */
import NativeSwitch from './native/NativeSwitch.vue'

const model = defineModel<boolean>({ required: true })

defineProps<{ label: string; hint?: string; name?: string; testid?: string }>()
</script>

<template>
  <label class="flex min-h-11 cursor-pointer items-center gap-3">
    <NativeSwitch v-model="model" :name="name" value="1" :data-testid="testid" />
    <span class="min-w-0 flex-1">
      <span class="block text-label text-default">{{ label }}</span>
      <span v-if="hint" class="block text-caption text-muted">{{ hint }}</span>
    </span>
  </label>
</template>
