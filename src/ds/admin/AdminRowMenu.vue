<script setup lang="ts">
/** The "..." row-actions menu (`UDropdownMenu`): a 44px icon trigger, items from the caller. */
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  items: DropdownMenuItem[][]
  label?: string
}>()
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      size="md"
      icon="i-ph-dots-three-vertical"
      :aria-label="label ?? 'Tindakan lain'"
      data-testid="row-menu"
    />
  </UDropdownMenu>
</template>
