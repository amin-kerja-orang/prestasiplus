<script setup lang="ts">
/**
 * Dialog of S2 (`#drillModal` and the five modals of the top bar; FR-M10-19), now the DS dialog: a modal from
 * `sm`, a bottom sheet below. "Tutup", the close icon, Esc and the backdrop close it. A stacked holders dialog
 * opens above its parent (the Reka dialogs nest).
 */
import { ref, watch } from 'vue'

import { DsDialog } from '@/ds'

defineProps<{ title: string; testid: string; wide?: boolean }>()
// G5-M10 B3: the width is the DS `size` (its panel ignores a `class`). `lg` = 672px is the widest `DsDialog`
// offers, so `wide` (the old `sm:max-w-4xl`) and the default both use it until the DS gains an `xl` size.
const SIZE = { normal: 'lg', wide: 'lg' } as const
const emit = defineEmits<{ close: [] }>()

const open = ref(true)
watch(open, (value) => {
  if (!value) emit('close')
})
</script>

<template>
  <DsDialog v-model:open="open" :title="title" :size="wide ? SIZE.wide : SIZE.normal">
    <div class="flex min-w-0 flex-col gap-4" :data-testid="testid">
      <slot />
    </div>
    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        label="Tutup"
        data-testid="cc-modal-close"
        @click="open = false"
      />
    </template>
  </DsDialog>
</template>
