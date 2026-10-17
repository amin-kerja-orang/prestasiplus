<script setup lang="ts">
/** Applies the Arabic / Jawi display face (`font-jawi` token) to whatever it wraps. */
defineProps<{ rtl: boolean }>()
</script>

<template>
  <div :class="rtl ? 'min-w-0 font-jawi' : 'min-w-0'"><slot /></div>
</template>
