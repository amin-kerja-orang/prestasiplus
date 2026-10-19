<script setup lang="ts">
import { DsSurface } from '@/ds'

/** One selected photo of the S17 form: the preview and its remove button (44px target). */
defineProps<{ src: string }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <DsSurface
    level="elevated"
    radius="card"
    padding="none"
    class="relative aspect-square"
    data-testid="photo-preview"
  >
    <img :src="src" alt="Preview" class="size-full object-cover" />
    <UButton
      type="button"
      color="error"
      size="lg"
      icon="i-ph-x"
      aria-label="Buang gambar"
      class="absolute end-1 top-1"
      data-testid="photo-remove"
      @click="$emit('remove')"
    />
  </DsSurface>
</template>
