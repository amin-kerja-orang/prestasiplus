<script setup lang="ts">
/**
 * The one-time credential block of S12 (FR-M27-118, BR-M27-41): the only place a password is rendered. It holds
 * the `credential` of the create response in component memory only; it is never persisted or logged, and a reload
 * of the page shows nothing.
 */
import { DsPanel } from '@/ds'

import type { CreatedCredential } from '../../api/school-admin'

withDefaults(defineProps<{ credential: CreatedCredential; who?: string }>(), { who: 'pelajar' })
</script>

<template>
  <DsPanel data-testid="pupil-credential">
    <UAlert
      color="warning"
      variant="subtle"
      icon="i-ph-key"
      :title="`Maklumat log masuk ${who} — catat sekarang, ia tidak akan dipaparkan semula.`"
      class="mb-4"
    />
    <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-body sm:grid-cols-2">
      <dt class="text-label text-muted">Nama:</dt>
      <dd class="min-w-0 break-words text-highlighted" data-testid="credential-name">
        {{ credential.name }}
      </dd>
      <dt class="text-label text-muted">Sekolah:</dt>
      <dd class="min-w-0 break-words text-highlighted" data-testid="credential-school">
        {{ credential.school }}
      </dd>
      <dt class="text-label text-muted">Emel:</dt>
      <dd class="min-w-0 break-all text-highlighted" data-testid="credential-email">
        {{ credential.email }}
      </dd>
      <dt class="text-label text-muted">Kata laluan:</dt>
      <dd class="tabular min-w-0 break-all text-highlighted" data-testid="credential-password">
        {{ credential.password }}
      </dd>
    </dl>
  </DsPanel>
</template>
