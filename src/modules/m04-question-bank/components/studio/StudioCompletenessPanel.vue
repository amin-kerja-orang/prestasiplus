<script setup lang="ts">
/**
 * The completeness panel of the wizard (FR-ADM-QE4.1, FR-QA-11): every missing field by name, with a link that scrolls
 * to the field and focuses it. A row reads the API `message` exactly, or the client text of `draftGaps()` before a save.
 */
import { DsPanel, DsStack, DsText } from '@/ds'

export interface CompletenessRow {
  message: string
  /** `data-testid` of the field. */
  field: string
}

defineProps<{ rows: readonly CompletenessRow[] }>()
const emit = defineEmits<{ jump: [field: string] }>()
</script>

<template>
  <DsPanel :title="rows.length > 0 ? `${String(rows.length)} belum lengkap` : undefined" data-testid="studio-completeness">
    <DsStack v-if="rows.length > 0" as="ul" gap="2xs" data-testid="studio-completeness-list">
      <DsText v-for="r in rows" :key="r.message" as="li" variant="body">
        <UButton
          type="button"
          color="neutral"
          variant="link"
          :label="r.message"
          data-testid="studio-completeness-row"
          @click="emit('jump', r.field)"
        />
      </DsText>
    </DsStack>
    <DsText v-else variant="body" tone="muted" data-testid="studio-completeness-empty">Semua medan wajib telah lengkap.</DsText>
  </DsPanel>
</template>
