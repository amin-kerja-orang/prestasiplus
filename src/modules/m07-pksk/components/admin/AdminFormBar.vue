<script setup lang="ts">
/**
 * Sticky action bar of the admin forms: "Batal" and the submit button on one right-aligned row that stays
 * in view at the bottom of the screen. The default slot sits on the left (status text, hints).
 */
withDefaults(
  defineProps<{
    cancelTo: string
    submitLabel: string
    saving?: boolean
    cancelLabel?: string
    cancelTestid?: string
  }>(),
  { saving: false, cancelLabel: 'Batal', cancelTestid: 'form-cancel' },
)
</script>

<template>
  <UCard class="sticky bottom-0" :ui="{ body: 'p-4 sm:p-6' }" data-ds="form-bar">
    <div class="flex flex-wrap items-center justify-end gap-3">
      <div class="mr-auto min-w-0 text-caption text-muted empty:hidden"><slot /></div>
      <UButton
        :to="cancelTo"
        color="neutral"
        variant="soft"
        icon="i-ph-arrow-left"
        :label="cancelLabel"
        class="min-h-11"
        :data-testid="cancelTestid"
      />
      <UButton
        type="submit"
        icon="i-ph-floppy-disk"
        :label="submitLabel"
        :loading="saving"
        :disabled="saving"
        class="min-h-11"
        data-testid="form-submit"
      />
    </div>
  </UCard>
</template>
