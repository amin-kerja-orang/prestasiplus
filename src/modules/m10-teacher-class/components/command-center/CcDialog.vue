<script setup lang="ts">
/**
 * Dialog of S2 (`#drillModal` and the five modals of the top bar; FR-M10-19), now the DS dialog: a modal from
 * `sm`, a bottom sheet below. "Tutup", the close icon, Esc and the backdrop close it. A stacked holders dialog
 * opens above its parent (the Reka dialogs nest).
 */
import { ref, watch } from 'vue'

import { DsDialog, DsStack } from '@/ds'

defineProps<{ title: string; testid: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const open = ref(true)
watch(open, (value) => {
  if (!value) emit('close')
})
</script>

<template>
  <DsDialog v-model:open="open" :title="title" :class="wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'">
    <DsStack :data-testid="testid">
      <slot />
    </DsStack>
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
