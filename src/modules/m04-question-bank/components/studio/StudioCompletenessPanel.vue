<script setup lang="ts">
/**
 * The completeness panel of the wizard (FR-ADM-QE4.1, FR-QA-11): every missing field by name, with a link that scrolls
 * to the field and focuses it. A row reads the API `message` exactly, or the client text of `draftGaps()` before a save.
 */
import { DsPanel, DsStack, DsText } from '@/ds'

import type { CompletenessRow } from '../../lib/studio/draft'

/** `loadFailed`: a read behind the gate failed, so an empty list proves nothing. */
defineProps<{ rows: readonly CompletenessRow[]; loadFailed?: boolean }>()
const emit = defineEmits<{ jump: [field: string] }>()
</script>

<template>
  <DsPanel :title="rows.length > 0 ? `${String(rows.length)} belum lengkap` : undefined" data-testid="studio-completeness">
    <DsStack v-if="rows.length > 0" as="ul" gap="2xs" data-testid="studio-completeness-list">
      <DsText v-for="(r, i) in rows" :key="i" as="li" variant="body">
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
    <DsText v-if="loadFailed" variant="body" tone="warning" role="alert" data-testid="studio-completeness-failed">
      Semakan kelengkapan tidak dapat dimuatkan. Muat semula halaman untuk cuba lagi.
    </DsText>
    <DsText v-else-if="rows.length === 0" variant="body" tone="muted" data-testid="studio-completeness-empty">Semua medan wajib telah lengkap.</DsText>
  </DsPanel>
</template>
