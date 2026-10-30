<script setup lang="ts">
/**
 * `DsFormSection` whose field grid is one column below 768px and two columns from `md` up
 * (AC-M02-32.4, DV-M02-31). `DsFormSection` with `columns=2` switches at 640px, so this keeps the
 * section on one column and puts the two-column grid inside it. Full-width fields span both columns from the same breakpoint.
 * The field gap is the DS `lg` step (24px); `DsFormSection` itself uses 20px, which no page-level class can express.
 * Its props and the `actions` / `footer` slots pass straight through to `DsFormSection`.
 */
import { DsFormSection, DsGrid, type DsAccent, type DsIconProp } from '@/ds'

defineProps<{
  title: string
  description?: string
  icon?: DsIconProp
  accent?: DsAccent
  tone?: 'default' | 'error' | 'danger'
}>()
</script>

<template>
  <DsFormSection
    :title="title"
    :description="description"
    :icon="icon"
    :accent="accent"
    :tone="tone"
  >
    <DsGrid :cols="{ base: 1, md: 2 }" gap="lg" data-testid="form-section-grid">
      <slot />
    </DsGrid>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </DsFormSection>
</template>
