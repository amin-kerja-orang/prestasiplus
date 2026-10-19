<script setup lang="ts">
/**
 * One expandable S1 card (FN-M11-2.2.2...2.2.6): icon chip, big value, title, sub-lines (slot) and the
 * "Klik untuk ..." hint with a chevron that turns when open. A card with a click handler, as live
 * (D10: no role, no tabindex). The open card takes the outlined variant (the single focus point).
 */
import { type DsAccent, DsIconChip, DsStack, DsCluster, DsText } from '@/ds'

defineProps<{
  icon: string
  accent?: DsAccent
  value: string
  title: string
  hint: string
  open: boolean
  testId: string
}>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <UCard
    :variant="open ? 'outline' : 'soft'"
    class="min-w-0 cursor-pointer"
    :data-testid="testId"
    :data-open="open ? 'true' : 'false'"
    @click="$emit('toggle')"
  >
    <DsStack gap="xs">
      <DsCluster gap="xs" justify="between" :wrap="false">
        <DsIconChip :icon="icon" :accent="accent" />
        <DsText variant="heading" as="span" tabular data-testid="card-value">{{ value }}</DsText>
      </DsCluster>
      <DsText variant="label" as="p" tone="highlighted" data-testid="card-title">
        {{ title }}
      </DsText>
      <slot />
      <p class="flex items-center gap-1 text-caption text-muted">
        <UIcon :name="open ? 'i-ph-caret-up' : 'i-ph-caret-down'" class="size-3 shrink-0" />
        {{ hint }}
      </p>
    </DsStack>
  </UCard>
</template>
