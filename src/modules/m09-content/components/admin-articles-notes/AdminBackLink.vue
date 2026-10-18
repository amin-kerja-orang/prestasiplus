<script setup lang="ts">
/** "Kembali ke Senarai" link (S2-S4, S6-S8): arrow + text, 44 px tall. */
withDefaults(defineProps<{ to: string; label?: string }>(), { label: 'Kembali ke Senarai' })
</script>

<template>
  <div>
    <UButton
      :to="to"
      color="neutral"
      variant="ghost"
      icon="i-ph-arrow-left"
      :label="label"
      class="min-h-11"
      data-testid="back-link"
    />
  </div>
</template>
