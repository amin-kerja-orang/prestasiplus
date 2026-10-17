<script setup lang="ts">
/** An image the user uploaded or the server stored; no Nuxt UI component renders a plain `<img>`. */
defineProps<{ src: string; alt: string }>()
</script>

<template>
  <img :src="src" :alt="alt" class="max-h-64 max-w-full min-w-0 rounded-card object-contain" />
</template>
