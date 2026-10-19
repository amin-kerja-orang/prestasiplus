<script setup lang="ts">
/** Renders the dialog behind `useConfirm()`. Mount once per shell (inside `UApp`). */
import { onBeforeUnmount, onMounted } from 'vue'

import DsDialog from './DsDialog.vue'
import { acceptConfirm, confirmHost, confirmState, settleConfirm } from './useConfirm'

onMounted(() => {
  confirmHost.count += 1
})
onBeforeUnmount(() => {
  confirmHost.count -= 1
  settleConfirm(false)
})

function onOpen(value: boolean): void {
  if (!value) settleConfirm(false)
}
</script>

<template>
  <DsDialog
    :open="confirmState.open"
    :title="confirmState.title"
    :description="confirmState.message"
    :tone="confirmState.tone === 'error' ? 'error' : 'default'"
    :loading="confirmState.loading"
    @update:open="onOpen"
  >
    <p class="text-body text-default" data-ds="confirm-message">{{ confirmState.message }}</p>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :disabled="confirmState.loading"
        :label="confirmState.cancelLabel"
        data-ds="confirm-cancel"
        @click="settleConfirm(false)"
      />
      <UButton
        type="button"
        :color="confirmState.tone === 'error' ? 'error' : 'primary'"
        :loading="confirmState.loading"
        :label="confirmState.confirmLabel"
        data-ds="confirm-ok"
        @click="acceptConfirm()"
      />
    </template>
  </DsDialog>
</template>
