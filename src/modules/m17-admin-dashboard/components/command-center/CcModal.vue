<script setup lang="ts">
/**
 * Dialog of the S7 drill (`#weekModal`, `#sessionModal`), now the DS dialog: a modal from `sm`, a bottom
 * sheet below. "Tutup", the close icon, Esc and the backdrop close it (FR-M17-56). The session dialog opens
 * above the sessions dialog (the Reka dialogs nest).
 */
import { ref, watch } from 'vue'

import { DsDialog } from '@/ds'

defineProps<{ title: string; subtitle?: string; stacked?: boolean; testid: string }>()
const emit = defineEmits<{ close: [] }>()

const open = ref(true)
watch(open, (value) => {
  if (!value) emit('close')
})
</script>

<template>
  <DsDialog v-model:open="open" :title="title" :description="subtitle" class="sm:max-w-2xl">
    <div class="flex min-w-0 flex-col gap-4" :data-testid="testid">
      <p v-if="subtitle" class="text-body text-muted" data-testid="cc-modal-subtitle">
        {{ subtitle }}
      </p>
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
