<script setup lang="ts" generic="Id extends string | number">
/**
 * Subject strip (design system 6, "Subject tile"): a horizontal strip of 88 x 104 tiles, each a
 * solid chip plus the subject label. The strip scrolls inside its own container (never the page).
 * Identity is the label, not a hue.
 */
import DsIconChip from './DsIconChip.vue'

export interface SubjectTile<I extends string | number = string> {
  id: I
  label: string
  /** Phosphor icon class for the chip, e.g. `i-ph-calculator-duotone`. */
  icon: string
}

defineProps<{
  items: SubjectTile<Id>[]
  /** Accessible name of the list (BM). */
  label: string
}>()

defineEmits<{ select: [id: Id] }>()
</script>

<template>
  <ul
    class="-mx-4 flex max-w-full gap-2.5 overflow-x-auto px-4 pt-1 pb-2.5"
    :aria-label="label"
    data-ds="subject-strip"
  >
    <li v-for="item in items" :key="item.id" class="shrink-0">
      <UButton
        color="neutral"
        variant="ghost"
        class="h-auto min-h-26 w-22 flex-col justify-center gap-2 rounded-card bg-default px-1 py-2.5 text-label font-semibold text-highlighted shadow-ds-xs hover:bg-default learner:shadow-lift"
        data-ds="subject-tile"
        @click="$emit('select', item.id)"
      >
        <DsIconChip :icon="item.icon" accent="action" />
        <span class="text-center">{{ item.label }}</span>
      </UButton>
    </li>
  </ul>
</template>
