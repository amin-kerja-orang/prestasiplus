<script setup lang="ts">
/** The stimulus image of a structured question (only a safe URL from M04 reaches it). Decorative. */
defineProps<{ src: string }>()
</script>

<template>
  <img :src="src" alt="" class="max-h-96 max-w-full rounded-card" data-ds="stimulus-image" />
</template>
