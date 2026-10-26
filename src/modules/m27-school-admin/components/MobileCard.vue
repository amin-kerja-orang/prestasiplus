<script setup lang="ts">
/**
 * Body of one `DsDataTable` card below `md` for the M27 lists (S4, S6, S7), supplied through the table's `card` slot.
 * It mirrors the default card (title button, label/value pairs) with two differences: a value wraps instead of being
 * cut with an ellipsis, and the row actions (default slot) sit below the fields instead of beside them, so the
 * fields keep the full card width at 375px. The card actions slot of the table stays empty.
 */
import type { CardField } from '@/ds'
import { DsCluster, DsGrid, DsGridItem, DsStack, DsText } from '@/ds'

defineProps<{
  title: string
  fields: CardField[]
  row: Record<string, unknown>
}>()
defineEmits<{ open: [] }>()
defineSlots<{ default?: () => unknown }>()

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key]
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
}
</script>

<template>
  <DsStack gap="xs" data-testid="m27-card">
    <DsCluster gap="none" justify="start">
      <ULink as="button" type="button" class="min-h-11 text-start" @click="$emit('open')">
        <DsText as="span" variant="label">{{ cell(row, title) }}</DsText>
      </ULink>
    </DsCluster>
    <DsGrid :cols="2" gap="xs" align="start" data-testid="m27-card-fields">
      <DsGridItem v-for="f in fields" :key="f.key">
        <dl>
          <DsText as="dt" variant="caption">{{ f.label }}</DsText>
          <DsText as="dd" variant="body" wrap="anywhere" tabular>{{ cell(row, f.key) }}</DsText>
        </dl>
      </DsGridItem>
    </DsGrid>
    <DsCluster v-if="$slots.default" gap="sm" align="center" data-testid="m27-card-actions">
      <slot />
    </DsCluster>
  </DsStack>
</template>
