<script setup lang="ts">
/**
 * The one-time credential block of S12 (FR-M27-118, BR-M27-41): the only place a password is rendered. It holds
 * the `credential` of the create response in component memory only; it is never persisted or logged, and a reload
 * of the page shows nothing.
 */
import { DsPanel, DsText } from '@/ds'

import type { CreatePupilResult } from '../../api/school-admin'

defineProps<{ credential: CreatePupilResult['credential'] }>()
</script>

<template>
  <DsPanel data-testid="pupil-credential">
    <UAlert
      color="warning"
      variant="subtle"
      icon="i-ph-key"
      title="Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula."
      class="mb-4"
    />
    <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-body sm:grid-cols-2">
      <DsText variant="label" as="dt" tone="muted">Nama:</DsText>
      <dd class="min-w-0 break-words text-highlighted" data-testid="credential-name">
        {{ credential.name }}
      </dd>
      <DsText variant="label" as="dt" tone="muted">Sekolah:</DsText>
      <dd class="min-w-0 break-words text-highlighted" data-testid="credential-school">
        {{ credential.school }}
      </dd>
      <DsText variant="label" as="dt" tone="muted">Emel:</DsText>
      <dd class="min-w-0 break-all text-highlighted" data-testid="credential-email">
        {{ credential.email }}
      </dd>
      <DsText variant="label" as="dt" tone="muted">Kata laluan:</DsText>
      <dd class="tabular min-w-0 break-all text-highlighted" data-testid="credential-password">
        {{ credential.password }}
      </dd>
    </dl>
  </DsPanel>
</template>
