<script setup lang="ts">
/**
 * Wraps Arabic / Jawi text: right-to-left, the `font-jawi` display face and body size. Pass
 * `rtl=false` to render the same wrapper without the Arabic treatment (mixed-language forms).
 */
withDefaults(defineProps<{ rtl?: boolean }>(), { rtl: true })
</script>

<template>
  <div
    class="min-w-0"
    :class="rtl ? 'font-jawi text-body' : ''"
    :dir="rtl ? 'rtl' : undefined"
    data-ds="rtl-scope"
  >
    <slot />
  </div>
</template>
