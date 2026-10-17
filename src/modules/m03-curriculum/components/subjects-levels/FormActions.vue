<script setup lang="ts">
/**
 * The form button row of S7, S8, S10 and S11 (FR-99): "Batal" and the submit button side by side,
 * right-aligned at every width (they fit at 375 px).
 */
defineProps<{ cancelTo: string; submitLabel: string; saving?: boolean }>()
</script>

<template>
  <div class="flex justify-end gap-3">
    <UButton
      :to="cancelTo"
      color="neutral"
      variant="soft"
      class="min-h-11"
      data-testid="form-cancel"
    >
      Batal
    </UButton>
    <UButton
      type="submit"
      :loading="saving"
      :disabled="saving"
      :icon="saving ? undefined : 'i-ph-floppy-disk'"
      class="min-h-11"
      data-testid="form-submit"
    >
      {{ submitLabel }}
    </UButton>
  </div>
</template>
