<script setup lang="ts">
/**
 * Print-only A4 layout wrapper (Kirkpatrick PDF page): the sheet always uses the light tokens
 * (`DsThemeScope` scheme light), and the print rules in `src/theme/ds-extras.css` hide every
 * other element when printing. The optional print button is hidden on paper.
 */
import type { Personality } from '@/theme/color-mode'

import DsThemeScope from './DsThemeScope.vue'

withDefaults(
  defineProps<{
    personality?: Personality
    /** Label of the "print" button; omit to hide the button. */
    printLabel?: string
  }>(),
  { personality: 'staff', printLabel: undefined },
)

function print(): void {
  window.print()
}
</script>

<template>
  <div class="flex flex-col gap-3" data-ds="print-sheet-root">
    <div v-if="printLabel" class="flex justify-end print:hidden">
      <UButton type="button" icon="i-ph-printer" :label="printLabel" @click="print" />
    </div>
    <div data-ds="print-sheet" class="mx-auto w-full max-w-3xl print:max-w-none">
      <DsThemeScope :personality="personality" scheme="light" class="print:p-0">
        <slot />
      </DsThemeScope>
    </div>
  </div>
</template>
