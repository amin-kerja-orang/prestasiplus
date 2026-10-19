<script setup lang="ts">
/** One selected photo of the S17 form: the preview and its remove button (44px target). */
defineProps<{ src: string }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <div
    class="relative aspect-square overflow-hidden rounded-card bg-elevated"
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
  </div>
</template>
