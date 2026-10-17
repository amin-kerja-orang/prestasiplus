<script setup lang="ts">
/** Renders the dialog behind `useConfirm()`. Mount once per shell (inside `UApp`). */
import { onBeforeUnmount, onMounted } from 'vue'

import DsDialog from './DsDialog.vue'
import { confirmHost, confirmState, settleConfirm } from './useConfirm'

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
    @update:open="onOpen"
  >
    <p class="text-body text-default" data-ds="confirm-message">{{ confirmState.message }}</p>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :label="confirmState.cancelLabel"
        data-ds="confirm-cancel"
        @click="settleConfirm(false)"
      />
      <UButton
        type="button"
        :color="confirmState.tone === 'danger' ? 'error' : 'primary'"
        :label="confirmState.confirmLabel"
        data-ds="confirm-ok"
        @click="settleConfirm(true)"
      />
    </template>
  </DsDialog>
</template>
