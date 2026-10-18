<script setup lang="ts">
/** A form section card: icon chip + title + hint, then a two-column grid on desktop (20-24px padding). */
import DsIconChip from '../DsIconChip.vue'

defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-6 rounded-lg bg-default p-5 shadow-card md:p-6"
    data-ds="admin-section"
  >
    <div class="flex items-center gap-4">
      <DsIconChip v-if="icon" :icon="icon" size="lg" />
      <div class="min-w-0">
        <h2 class="text-subheading font-semibold text-highlighted">{{ title }}</h2>
        <p v-if="description" class="text-body text-muted">{{ description }}</p>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <slot />
    </div>
  </section>
</template>
